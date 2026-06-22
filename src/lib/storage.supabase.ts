// 모드 2 (셀프 호스팅) 어댑터.
// 사용자가 자기 Supabase 프로젝트의 URL + anon key를 입력하면 활성화.
// 데이터는 사용자의 DB에 저장 — 본인은 절대 접근할 수 없다.

import { createClient } from "@supabase/supabase-js";
import type { StorageDriver, RealtimeStatus } from "./storage";
import type { WeddingData } from "./schema";
import { getOrCreateOwnerToken, isSupabaseHost } from "./security";

const DEFAULT_TABLE = "wedding_data";
const DEFAULT_CONFIG_ID = "default";

// 짧은 지수 백오프 — 일시 네트워크 끊김 회복용. 너무 길게 잡으면 사용자 다음 편집이 밀려서 UX 망함.
// fn 은 thenable (supabase builder 가 PostgrestBuilder 라 정식 Promise 가 아님) 를 받기 위해 PromiseLike.
async function withRetry<T>(fn: () => PromiseLike<T>, isOk: (r: T) => boolean, tries = 3): Promise<T> {
  let last: T | undefined;
  for (let i = 0; i < tries; i++) {
    try {
      last = await fn();
      if (isOk(last)) return last;
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    // 200ms → 600ms → 1800ms
    await new Promise((resolve) => setTimeout(resolve, 200 * Math.pow(3, i)));
  }
  return last as T;
}

const noopDriver: StorageDriver = {
  async load() { return null; },
  async save() { return { ok: false }; },
};

export function createSupabaseStorage(
  url: string,
  anonKey: string,
  configId: string = DEFAULT_CONFIG_ID
): StorageDriver {
  if (!url || !anonKey) return noopDriver;
  // 도메인 화이트리스트 — 변조된 localStorage 의 URL 이나 import 파일의 URL 에 의해
  // anon key 가 공격자 호스트로 새지 않도록 마지막 방어선. (Setup 위저드도 이미 검사하지만 한 번 더.)
  if (!isSupabaseHost(url)) {
    if (typeof console !== "undefined") console.warn("[storage] non-supabase host blocked:", url);
    return noopDriver;
  }
  const client = createClient(url, anonKey);
  const ownerToken = getOrCreateOwnerToken();

  return {
    async load() {
      try {
        const r = await withRetry(
          () => client.rpc("load_wedding_data", { p_id: configId, p_token: ownerToken }).single(),
          (res) => !res.error,
          2
        );
        const row = r.data as { data?: WeddingData; version?: number } | null;
        if (r.error || !row?.data) return null;
        return { data: row.data, version: row.version };
      } catch {
        return null;
      }
    },
    async save(payload, expectedVersion) {
      try {
        const r = await withRetry(
          () => client.rpc("save_wedding_data", {
            p_id: configId,
            p_token: ownerToken,
            p_data: payload,
            p_expected_version: expectedVersion ?? null,
          }).single(),
          (res) => !res.error,
          3
        );
        const row = r.data as { ok?: boolean; version?: number; conflict?: boolean } | null;
        if (r.error || !row?.ok) return { ok: false, conflict: !!row?.conflict };
        return { ok: true, version: row.version };
      } catch {
        return { ok: false };
      }
    },
    subscribe(cb, onStatus) {
      const channel = client.channel(`wedding-data-${configId}`)
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: DEFAULT_TABLE, filter: `id=eq.${configId}` },
          (payload: any) => {
            const next = payload.new?.data ?? payload.record?.data;
            const ver = payload.new?.version ?? payload.record?.version;
            if (next) cb(next as WeddingData, typeof ver === "number" ? ver : undefined);
          }
        )
        .subscribe((status) => {
          if (!onStatus) return;
          const map: Record<string, RealtimeStatus> = {
            SUBSCRIBED: "subscribed",
            CHANNEL_ERROR: "disconnected",
            TIMED_OUT: "disconnected",
            CLOSED: "disconnected",
          };
          onStatus(map[status] ?? "connecting");
        });
      onStatus?.("connecting");
      return () => { client.removeChannel(channel); };
    },
  };
}

export async function loadPublicInvitation(
  url: string,
  anonKey: string,
  configId: string = DEFAULT_CONFIG_ID,
): Promise<{ ok: boolean; invitation?: WeddingData["invitation"]; reason?: string }> {
  try {
    if (!url || !anonKey) return { ok: false, reason: "연결 정보 없음" };
    if (!isSupabaseHost(url)) return { ok: false, reason: "안전하지 않은 호스트" };
    const client = createClient(url, anonKey);
    const r = await client.rpc("get_public_invitation", { p_id: configId });
    if (r.error) return { ok: false, reason: r.error.message };
    return { ok: true, invitation: r.data as WeddingData["invitation"] };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "연결 실패" };
  }
}

/** 하객 RSVP 제출 — supabase.rsvp 테이블에 직접 insert */
export type RsvpInput = {
  name: string;
  attending: boolean;
  side?: "groom" | "bride";
  guests?: number;
  meal?: string;
  message?: string;
};

export type RsvpRow = {
  id: string;
  name: string;
  side?: "groom" | "bride";
  attending: boolean;
  guests?: number;
  meal?: string;
  message?: string;
  created_at?: string;
};

// 한 기기·한 청첩장당 최소 60초 간격 — 봇/실수 도배 1차 방어.
// (서버에서도 막아야 하지만 RLS 가 anon insert 만 허용하는 현재 구조에선 클라 가드가 1차 방어선.)
const RSVP_RATE_LIMIT_MS = 60_000;
function rsvpRateLimitKey(url: string) { return `wedding-os/rsvp-last/${url}`; }

export async function insertRsvp(
  url: string,
  anonKey: string,
  rsvp: RsvpInput,
  configId: string = DEFAULT_CONFIG_ID,
  rsvpToken?: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!url || !anonKey) return { ok: false, reason: "연결 정보 없음" };
    if (!isSupabaseHost(url)) return { ok: false, reason: "안전하지 않은 호스트" };
    const name = rsvp.name.trim();
    if (!name) return { ok: false, reason: "이름을 입력해주세요" };
    // 필드 길이 가드 — 대량 텍스트 폭격 차단
    if (name.length > 40) return { ok: false, reason: "이름이 너무 길어요 (40자 이내)" };
    const meal = rsvp.meal?.trim();
    if (meal && meal.length > 80) return { ok: false, reason: "식사 메모는 80자 이내로" };
    const message = rsvp.message?.trim();
    if (message && message.length > 500) return { ok: false, reason: "메시지는 500자 이내로" };
    const guests = typeof rsvp.guests === "number" ? Math.max(0, Math.min(rsvp.guests, 20)) : 1;

    // Rate limit 체크
    try {
      const last = localStorage.getItem(rsvpRateLimitKey(url));
      if (last) {
        const diff = Date.now() - Number(last);
        if (diff < RSVP_RATE_LIMIT_MS) {
          const sec = Math.ceil((RSVP_RATE_LIMIT_MS - diff) / 1000);
          return { ok: false, reason: `${sec}초 후 다시 시도해주세요` };
        }
      }
    } catch { /* localStorage 없으면 그냥 통과 */ }

    const client = createClient(url, anonKey);
    if (!rsvpToken) return { ok: false, reason: "RSVP 제출 권한이 없습니다." };
    const { error } = await client.rpc("submit_rsvp", {
      p_id: configId,
      p_token: rsvpToken,
      p_name: name,
      p_attending: rsvp.attending,
      p_side: rsvp.side ?? null,
      p_guests: guests,
      p_meal: meal || null,
      p_message: message || null,
    });
    if (error) return { ok: false, reason: error.message };
    try { localStorage.setItem(rsvpRateLimitKey(url), String(Date.now())); } catch { /* noop */ }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "알 수 없는 오류" };
  }
}

/** 오너 기기에서 RSVP 목록 읽기 — SECURITY DEFINER RPC + owner token */
export async function listRsvps(
  url: string,
  anonKey: string,
  configId: string = DEFAULT_CONFIG_ID,
): Promise<{ ok: boolean; rows?: RsvpRow[]; reason?: string }> {
  try {
    if (!url || !anonKey) return { ok: false, reason: "연결 정보 없음" };
    if (!isSupabaseHost(url)) return { ok: false, reason: "안전하지 않은 호스트" };
    const client = createClient(url, anonKey);
    const ownerToken = getOrCreateOwnerToken();
    const { data, error } = await client.rpc("list_rsvp", { p_id: configId, p_token: ownerToken });
    if (error) return { ok: false, reason: error.message };
    return { ok: true, rows: (data ?? []) as RsvpRow[] };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "RSVP를 불러오지 못했어요" };
  }
}

/** 사용자 Supabase에 ping — 셋업 위저드 검증용 */
export async function pingSupabase(url: string, anonKey: string): Promise<{ ok: boolean; reason?: string; }> {
  try {
    const client = createClient(url, anonKey);
    const { error } = await client.rpc("get_public_invitation", { p_id: DEFAULT_CONFIG_ID });
    if (error) {
      if (error.message.includes("does not exist")) {
        return { ok: false, reason: "테이블이 아직 없어요. 다음 단계에서 SQL을 실행해주세요." };
      }
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "연결 실패" };
  }
}
