// 모드 2 (셀프 호스팅) 어댑터.
// 사용자가 자기 Supabase 프로젝트의 URL + anon key를 입력하면 활성화.
// 데이터는 사용자의 DB에 저장 — 본인은 절대 접근할 수 없다.

import { createClient } from "@supabase/supabase-js";
import type { StorageDriver } from "./storage";
import type { WeddingData } from "./schema";

const DEFAULT_TABLE = "wedding_data";
const DEFAULT_CONFIG_ID = "default";

export function createSupabaseStorage(
  url: string,
  anonKey: string,
  configId: string = DEFAULT_CONFIG_ID
): StorageDriver {
  if (!url || !anonKey) {
    // 셋업 안 끝났으면 noop 드라이버 — load는 null, save는 false
    return {
      async load() { return null; },
      async save() { return false; },
    };
  }
  const client = createClient(url, anonKey);

  return {
    async load() {
      try {
        const { data, error } = await client
          .from(DEFAULT_TABLE)
          .select("data")
          .eq("id", configId)
          .single();
        if (error || !data?.data) return null;
        return data.data as WeddingData;
      } catch {
        return null;
      }
    },
    async save(payload) {
      try {
        const { error } = await client
          .from(DEFAULT_TABLE)
          .upsert({ id: configId, data: payload, updated_at: new Date().toISOString() });
        return !error;
      } catch {
        return false;
      }
    },
    subscribe(cb) {
      const channel = client.channel(`wedding-data-${configId}`)
        .on(
          "postgres_changes" as any,
          { event: "UPDATE", schema: "public", table: DEFAULT_TABLE, filter: `id=eq.${configId}` },
          (payload: any) => {
            if (payload.new?.data) cb(payload.new.data as WeddingData);
          }
        )
        .subscribe();
      return () => { client.removeChannel(channel); };
    },
  };
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

export async function insertRsvp(
  url: string,
  anonKey: string,
  rsvp: RsvpInput
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!url || !anonKey) return { ok: false, reason: "연결 정보 없음" };
    if (!rsvp.name.trim()) return { ok: false, reason: "이름을 입력해주세요" };
    const client = createClient(url, anonKey);
    const { error } = await client.from("rsvp").insert([rsvp]);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "알 수 없는 오류" };
  }
}

/** 사용자 Supabase에 ping — 셋업 위저드 검증용 */
export async function pingSupabase(url: string, anonKey: string): Promise<{ ok: boolean; reason?: string; }> {
  try {
    const client = createClient(url, anonKey);
    const { error } = await client.from(DEFAULT_TABLE).select("id").limit(1);
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
