// 로그인 복구용 — 복구 번들(weddingId·ownerToken·weddingKey)을 passphrase 로 감싼다(wrap).
//
// 서버에는 이 wrap 된 blob 만 올라가고, passphrase 는 절대 전송되지 않는다.
// 따라서 운영자는 blob 을 풀 수 없다(weddingId 조차 모름). "로그인 + 암호문구" 를 아는
// 본인만 새 기기에서 복원할 수 있다 — 영지식 E2E 유지.

import { isRecoveryBundle, type RecoveryBundle } from "./recovery";
import { bytesToBase64Url, base64UrlToBytes, type Bytes } from "./inviteCrypto";

const LEGACY_PBKDF2_ITERS = 210_000;
const PBKDF2_ITERS = 600_000;

const COMMON_RECOVERY_PHRASES = [
  "password",
  "qwerty",
  "dearie",
  "wedding",
  "1234",
  "0000",
  "사랑해",
  "결혼준비",
];

export function validateRecoveryPassphrase(passphrase: string): string | null {
  if (passphrase !== passphrase.trim()) return "복구 비밀번호 앞뒤 공백은 빼주세요.";
  if (passphrase.length < 16) return "복구 비밀번호는 16자 이상으로 정해주세요.";
  if (passphrase.length > 512) return "복구 비밀번호가 너무 깁니다.";
  if (/^(.)\1+$/.test(passphrase)) return "같은 글자만 반복한 복구 비밀번호는 사용할 수 없어요.";
  const lower = passphrase.toLowerCase();
  if (COMMON_RECOVERY_PHRASES.some((word) => lower.includes(word))) {
    return "너무 흔한 단어가 들어간 복구 비밀번호는 피해주세요.";
  }
  const classes = [
    /[A-Za-z가-힣]/.test(passphrase),
    /\d/.test(passphrase),
    /[^A-Za-z0-9가-힣\s]/.test(passphrase),
    /\s/.test(passphrase),
  ].filter(Boolean).length;
  if (passphrase.length < 24 && classes < 3) {
    return "20자 안팎이면 글자, 숫자, 기호나 띄어쓰기를 섞어주세요.";
  }
  return null;
}

async function deriveKey(passphrase: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
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
  if (!isRecoveryBundle(bundle)) throw new Error("invalid recovery bundle");
  if (validateRecoveryPassphrase(passphrase)) throw new Error("invalid passphrase strength");
  const salt: Bytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERS);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(bundle))),
  );
  const out: Bytes = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return { blob: bytesToBase64Url(out), salt: `v2.${PBKDF2_ITERS}.${bytesToBase64Url(salt)}` };
}

/** { blob, salt } + passphrase → 복구 번들. passphrase 가 틀리면 throw (AES-GCM 인증 실패). */
export async function unwrapBundle(
  blob: string,
  salt: string,
  passphrase: string,
): Promise<RecoveryBundle> {
  if (!blob || blob.length > 4096 || !salt || salt.length > 256) throw new Error("invalid wrapped bundle");
  if (!passphrase || passphrase.length > 512) throw new Error("invalid passphrase length");
  const tagged = salt.match(/^v2\.(\d+)\.(.+)$/);
  const iterations = tagged ? Number(tagged[1]) : LEGACY_PBKDF2_ITERS;
  const rawSalt = tagged ? tagged[2] : salt;
  if (!Number.isInteger(iterations) || iterations < LEGACY_PBKDF2_ITERS || iterations > 2_000_000) {
    throw new Error("invalid KDF parameters");
  }
  const key = await deriveKey(passphrase, base64UrlToBytes(rawSalt), iterations);
  const bytes = base64UrlToBytes(blob);
  if (bytes.length < 29 || bytes.length > 3072) throw new Error("invalid wrapped bundle");
  const iv = bytes.slice(0, 12);
  const body = bytes.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, body);
  const bundle: unknown = JSON.parse(new TextDecoder().decode(pt));
  if (!isRecoveryBundle(bundle)) throw new Error("invalid recovery bundle");
  return bundle;
}
