// 간편(hosted) 모드 어댑터 — 운영자 호스팅 + 종단간 암호화.
//
// 운영자 Supabase(env: VITE_SUPABASE_*)의 weddingos.weddings 행에 *암호문만* 저장한다.
// WeddingData 전체를 weddingKey 로 이 기기에서 암호화한 뒤 올리므로 운영자는 못 읽는다.
// 접근은 wos_load / wos_save RPC(ownerToken bcrypt 검증)로만.
//
// 자격증명(url·key·weddingId·weddingKey·ownerToken)을 파라미터로 받는다 — 테스트 가능하도록.
// 실제 값 조립(env + 시크릿)은 storage.ts 의 selectDriver 가 한다.
//
// 실시간(realtime)은 RPC-only RLS 구조라 postgres_changes 가 동작하지 않는다 →
// v1 은 subscribe 없이 load-on-focus + 충돌 UI 로 수렴. (계획상 알려진 제약)

import { createClient } from "@supabase/supabase-js";
import type { StorageDriver } from "./storage";
import type { WeddingData } from "./schema";
import { isSupabaseHost } from "./security";
import {
  importInviteKey,
  encryptJSON,
  decryptJSON,
  bytesToBase64Url,
  base64UrlToBytes,
} from "./inviteCrypto";

// data 컬럼에 들어가는 봉투. ct = base64url(iv+ciphertext). 운영자엔 불투명.
type Envelope = { ct?: string; v?: number };

const noopDriver: StorageDriver = {
  async load() { return null; },
  async save() { return { ok: false }; },
};

/** 호스팅 결혼 데이터 행 삭제 (계정/데이터 완전 삭제용). ownerToken 검증은 RPC 내부. */
export async function deleteHostedWedding(
  url: string,
  anonKey: string,
  weddingId: string,
  ownerToken: string,
): Promise<boolean> {
  if (!url || !anonKey || !weddingId || !ownerToken || !isSupabaseHost(url)) return false;
  try {
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.rpc("wos_delete", { p_id: weddingId, p_token: ownerToken });
    return !error;
  } catch {
    return false;
  }
}

export function createHostedStorage(
  url: string,
  anonKey: string,
  weddingId: string,
  weddingKeyRaw: string,
  ownerToken: string,
  accessToken?: string,
): StorageDriver {
  if (!url || !anonKey || !weddingId || !weddingKeyRaw || !ownerToken) return noopDriver;
  // 도메인 화이트리스트 — 변조된 env 로 anon key 가 새지 않도록.
  if (!isSupabaseHost(url)) {
    if (typeof console !== "undefined") console.warn("[hosted] non-supabase host blocked:", url);
    return noopDriver;
  }
  // RPC 전용 클라이언트 — Auth 세션을 건드리지 않게(auth.ts 싱글톤과 충돌 방지).
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
  // weddingKey 는 1회만 import 해서 재사용.
  let keyPromise: Promise<CryptoKey> | null = null;
  const getKey = () => (keyPromise ??= importInviteKey(weddingKeyRaw));

  return {
    async load() {
      try {
        const { data: row, error } = await client
          .rpc("wos_load", { p_id: weddingId, p_token: ownerToken })
          .single();
        if (error || !row) return null;
        const envelope = ((row as { data?: Envelope }).data) ?? {};
        const version = (row as { version?: number }).version;
        if (!envelope.ct) return null; // 아직 저장된 암호문 없음 (새 행)
        const key = await getKey();
        const decoded = await decryptJSON<WeddingData>(base64UrlToBytes(envelope.ct), key);
        return { data: decoded, version };
      } catch {
        return null;
      }
    },

    async save(payload, expectedVersion) {
      try {
        const key = await getKey();
        const ct = bytesToBase64Url(await encryptJSON(payload, key));
        const envelope: Envelope = { ct, v: 1 };
        const { data: row, error } = await client
          .rpc("wos_save", {
            p_id: weddingId,
            p_token: ownerToken,
            p_data: envelope,
            p_expected_version: expectedVersion ?? null,
          })
          .single();
        if (error || !row) return { ok: false };
        const r = row as { ok?: boolean; version?: number; conflict?: boolean };
        if (!r.ok) return { ok: false, conflict: !!r.conflict };
        return { ok: true, version: r.version };
      } catch {
        return { ok: false };
      }
    },
    // subscribe 없음 — 위 주석 참고.
  };
}
