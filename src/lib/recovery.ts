// 간편(hosted) 모드 복구 — weddingId + ownerToken + weddingKey 를 하나의 복구 링크로 묶고 푼다.
//
// 세 값이 '#' 프래그먼트에만 담겨 서버로 전송되지 않는다. 이 링크 하나로:
//   - 기기 교체 복구 (새 기기에서 열면 그대로 이어받음)
//   - 부부 공유 (상대가 열면 함께 편집 가능)
// 가 된다. 운영자는 이 링크를 절대 못 보므로 암호문을 못 푼다.
//
// ⚠️ 이 링크는 '마스터 열쇠' — 전체 데이터 접근 + 복호화 권한을 모두 담는다.
// UI 는 단톡방·SNS 공유를 강하게 경고해야 한다. (Phase C)

import { generateInviteKey } from "./inviteCrypto";

export type RecoveryBundle = {
  weddingId: string;
  ownerToken: string;
  weddingKey: string;
};

const B32 = "abcdefghijklmnopqrstuvwxyz234567";

/** 추측 불가능한 weddingId 생성 — 'w' + 24 base32 (≈120bit). 스키마 제약(8~64자) 충족. */
export function generateWeddingId(): string {
  const n = 24;
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = "w";
  for (let i = 0; i < n; i++) s += B32[bytes[i] % 32];
  return s;
}

/** 새 weddingKey 생성 — base64url raw (inviteCrypto 재사용). */
export async function generateWeddingKeyRaw(): Promise<string> {
  const { raw } = await generateInviteKey();
  return raw;
}

/** 복구 번들 → 공유/복구 링크. 세 값은 '#' 프래그먼트에만 (서버 전송 안 됨). */
export function buildRecoveryLink(b: RecoveryBundle, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const frag = new URLSearchParams({ w: b.weddingId, t: b.ownerToken, k: b.weddingKey }).toString();
  return `${base}/recover#${frag}`;
}

/** '#w=..&t=..&k=..' 프래그먼트 → 복구 번들. 형식이 어긋나면 null. */
export function parseRecoveryFragment(hash: string): RecoveryBundle | null {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h) return null;
  let p: URLSearchParams;
  try { p = new URLSearchParams(h); } catch { return null; }
  const weddingId = (p.get("w") ?? "").trim();
  const ownerToken = (p.get("t") ?? "").trim();
  const weddingKey = (p.get("k") ?? "").trim();
  // ownerToken 은 최소 32자(security.ts 와 동일 기준), weddingId 는 스키마 제약(8~64).
  if (weddingId.length < 8 || weddingId.length > 64) return null;
  if (ownerToken.length < 32 || !weddingKey) return null;
  return { weddingId, ownerToken, weddingKey };
}
