// 로그인 복구용 — 복구 번들(weddingId·ownerToken·weddingKey)을 passphrase 로 감싼다(wrap).
//
// 서버에는 이 wrap 된 blob 만 올라가고, passphrase 는 절대 전송되지 않는다.
// 따라서 운영자는 blob 을 풀 수 없다(weddingId 조차 모름). "로그인 + 암호문구" 를 아는
// 본인만 새 기기에서 복원할 수 있다 — 영지식 E2E 유지.

import type { RecoveryBundle } from "./recovery";
import { bytesToBase64Url, base64UrlToBytes, type Bytes } from "./inviteCrypto";

const PBKDF2_ITERS = 210_000; // 2026 기준 모바일 균형값

async function deriveKey(passphrase: string, salt: Bytes): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** 복구 번들 → { blob, salt }. passphrase 로 암호화된 불투명 blob. */
export async function wrapBundle(
  bundle: RecoveryBundle,
  passphrase: string,
): Promise<{ blob: string; salt: string }> {
  const salt: Bytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(bundle))),
  );
  const out: Bytes = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return { blob: bytesToBase64Url(out), salt: bytesToBase64Url(salt) };
}

/** { blob, salt } + passphrase → 복구 번들. passphrase 가 틀리면 throw (AES-GCM 인증 실패). */
export async function unwrapBundle(
  blob: string,
  salt: string,
  passphrase: string,
): Promise<RecoveryBundle> {
  const key = await deriveKey(passphrase, base64UrlToBytes(salt));
  const bytes = base64UrlToBytes(blob);
  const iv = bytes.slice(0, 12);
  const body = bytes.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, body);
  return JSON.parse(new TextDecoder().decode(pt)) as RecoveryBundle;
}
