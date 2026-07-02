// 간편(hosted) 모드 복구 — weddingId + ownerToken + weddingKey 를 복구 링크로 묶고 푼다.
//
// 세 값은 '#' 프래그먼트에만 담겨 서버로 전송되지 않는다. 새 공유 링크는 ownerToken+weddingKey 를
// 공유 비밀번호로 감싼 blob 으로만 담아, 링크만으로는 열 수 없게 한다. 이 링크 하나로:
//   - 기기 교체 복구 (새 기기에서 열면 그대로 이어받음)
//   - 부부 공유 (상대가 열면 함께 편집 가능)
// 가 된다. 운영자는 이 링크를 절대 못 보므로 암호문을 못 푼다.
//
// ⚠️ 이 링크는 '마스터 열쇠' — 전체 데이터 접근 + 복호화 권한을 모두 담는다.
// UI 는 단톡방·SNS 공유를 강하게 경고해야 한다. (Phase C)

import { base64UrlToBytes, bytesToBase64Url, generateInviteKey, type Bytes } from "./inviteCrypto";

export type RecoveryBundle = {
  weddingId: string;
  ownerToken: string;
  weddingKey: string;
};

export type ProtectedRecoveryPayload = {
  weddingId: string;
  blob: string;
  salt: string;
};

const LEGACY_SHARE_PBKDF2_ITERS = 210_000;
const SHARE_PBKDF2_ITERS = 600_000;
const COMMON_SHARE_PASSWORDS = [
  "password",
  "qwerty",
  "dearie",
  "wedding",
  "1234",
  "123456",
  "654321",
  "abcdef",
  "abc123",
  "0000",
  "1111",
  "사랑해",
  "결혼",
  "결혼준비",
];

export function isRecoveryBundle(value: unknown): value is RecoveryBundle {
  if (!value || typeof value !== "object") return false;
  const bundle = value as Partial<RecoveryBundle>;
  return (
    typeof bundle.weddingId === "string" && /^w[a-z2-7]{24}$/.test(bundle.weddingId) &&
    typeof bundle.ownerToken === "string" && bundle.ownerToken.length >= 32 && bundle.ownerToken.length <= 256 &&
    typeof bundle.weddingKey === "string" && /^[A-Za-z0-9_-]{43}$/.test(bundle.weddingKey)
  );
}

export function validateSharePassword(password: string, confirmation?: string): string | null {
  if (password !== password.trim()) return "공유 비밀번호 앞뒤 공백은 빼주세요.";
  if (password.length < 6) return "공유 비밀번호는 6자 이상으로 정해주세요.";
  if (password.length > 128) return "공유 비밀번호가 너무 깁니다.";
  if (confirmation !== undefined && password !== confirmation) return "공유 비밀번호가 서로 달라요.";
  if (/^(.)\1+$/.test(password)) return "같은 글자만 반복한 비밀번호는 사용할 수 없어요.";
  const lower = password.toLowerCase();
  if (COMMON_SHARE_PASSWORDS.some((word) => lower.includes(word))) {
    return "너무 흔한 단어가 들어간 비밀번호는 피해주세요.";
  }
  return null;
}

export function suggestSharePassword(): string {
  const words = ["miso", "duri", "bom", "dal", "nuri", "soso", "jadu", "lumi"];
  const word = words[randomInt(words.length)];
  const number = String(randomInt(90) + 10);
  const suffix = ["!", "", ""][randomInt(3)];
  const candidate = `${word}${number}${suffix}`;
  return validateSharePassword(candidate) ? `duri${randomInt(90) + 10}` : candidate;
}

function randomInt(max: number): number {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % max;
}

function isProtectedRecoveryPayload(value: unknown): value is ProtectedRecoveryPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ProtectedRecoveryPayload>;
  return (
    typeof payload.weddingId === "string" && /^w[a-z2-7]{24}$/.test(payload.weddingId) &&
    typeof payload.blob === "string" && /^[A-Za-z0-9_-]{24,4096}$/.test(payload.blob) &&
    typeof payload.salt === "string" && payload.salt.length >= 16 && payload.salt.length <= 256
  );
}

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

/** 복구 번들 → 비밀번호 보호 공유/복구 링크. ownerToken·weddingKey 는 URL 에 평문으로 담지 않는다. */
export async function buildProtectedRecoveryLink(
  bundle: RecoveryBundle,
  password: string,
  origin?: string,
): Promise<string> {
  if (!isRecoveryBundle(bundle)) throw new Error("invalid recovery bundle");
  const validation = validateSharePassword(password);
  if (validation) throw new Error(validation);
  const wrapped = await wrapRecoveryBundle(bundle, password);
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const frag = new URLSearchParams({ w: bundle.weddingId, b: wrapped.blob, s: wrapped.salt }).toString();
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
  const bundle = { weddingId, ownerToken, weddingKey };
  return isRecoveryBundle(bundle) ? bundle : null;
}

/** '#w=..&b=..&s=..' 프래그먼트 → 비밀번호 보호 복구 payload. */
export function parseProtectedRecoveryFragment(hash: string): ProtectedRecoveryPayload | null {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h) return null;
  let p: URLSearchParams;
  try { p = new URLSearchParams(h); } catch { return null; }
  const payload = {
    weddingId: (p.get("w") ?? "").trim(),
    blob: (p.get("b") ?? "").trim(),
    salt: (p.get("s") ?? "").trim(),
  };
  return isProtectedRecoveryPayload(payload) ? payload : null;
}

export async function unwrapProtectedRecoveryBundle(
  payload: ProtectedRecoveryPayload,
  password: string,
): Promise<RecoveryBundle> {
  if (!isProtectedRecoveryPayload(payload)) throw new Error("invalid protected recovery link");
  if (!password || password.length > 128) throw new Error("invalid share password");
  const tagged = payload.salt.match(/^v1\.(\d+)\.(.+)$/);
  const iterations = tagged ? Number(tagged[1]) : LEGACY_SHARE_PBKDF2_ITERS;
  const rawSalt = tagged ? tagged[2] : payload.salt;
  if (!Number.isInteger(iterations) || iterations < LEGACY_SHARE_PBKDF2_ITERS || iterations > 2_000_000) {
    throw new Error("invalid KDF parameters");
  }
  const key = await deriveShareKey(password, base64UrlToBytes(rawSalt), iterations);
  const bytes = base64UrlToBytes(payload.blob);
  if (bytes.length < 29 || bytes.length > 3072) throw new Error("invalid wrapped recovery bundle");
  const iv = bytes.slice(0, 12);
  const body = bytes.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, body);
  const bundle: unknown = JSON.parse(new TextDecoder().decode(pt));
  if (!isRecoveryBundle(bundle) || bundle.weddingId !== payload.weddingId) {
    throw new Error("invalid recovery bundle");
  }
  return bundle;
}

async function wrapRecoveryBundle(
  bundle: RecoveryBundle,
  password: string,
): Promise<{ blob: string; salt: string }> {
  const salt: Bytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveShareKey(password, salt, SHARE_PBKDF2_ITERS);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(bundle))),
  );
  const out: Bytes = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return { blob: bytesToBase64Url(out), salt: `v1.${SHARE_PBKDF2_ITERS}.${bytesToBase64Url(salt)}` };
}

async function deriveShareKey(password: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
