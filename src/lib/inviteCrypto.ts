// 발행 청첩장 종단간 암호화 (AES-GCM-256).
//
// 운영자 서버는 암호문만 보관하고 키를 절대 받지 못한다 — 키는 공유 링크의
// '#' 프래그먼트에만 존재하고, 브라우저는 프래그먼트를 서버로 전송하지 않는다.
// 따라서 링크를 가진 사람(하객)만 청첩장을 열 수 있고, 운영자는 내용을 못 읽는다.

const ALGO = "AES-GCM";
const KEY_BITS = 256;
const IV_BYTES = 12;

/** ArrayBuffer 로 뒷받침되는 바이트 배열 — Web Crypto 의 BufferSource 와 호환되는 형태.
 *  (최신 TS 는 Uint8Array 를 제네릭으로 보므로 명시적으로 좁혀 둔다.) */
export type Bytes = Uint8Array<ArrayBuffer>;

export function bytesToBase64Url(bytes: Bytes): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(s: string): Bytes {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("invalid base64url");
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 새 청첩장 키 생성. raw 는 공유 링크 '#' 에 넣을 base64url 문자열. */
export async function generateInviteKey(): Promise<{ key: CryptoKey; raw: string }> {
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_BITS },
    true,
    ["encrypt", "decrypt"],
  );
  const raw: Bytes = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return { key, raw: bytesToBase64Url(raw) };
}

/** 공유 링크 '#' 의 base64url 키 문자열 → CryptoKey */
export async function importInviteKey(raw: string): Promise<CryptoKey> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new Error("invalid invitation key");
  return crypto.subtle.importKey(
    "raw",
    base64UrlToBytes(raw),
    { name: ALGO },
    false,
    ["encrypt", "decrypt"],
  );
}

/** 평문 바이트 → IV(12바이트) + 암호문 을 이어붙인 하나의 Uint8Array.
 *  IV 는 매 호출마다 새로 난수 생성 (AES-GCM 은 IV 재사용이 치명적). */
export async function encryptBytes(plain: Bytes, key: CryptoKey): Promise<Bytes> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct: Bytes = new Uint8Array(await crypto.subtle.encrypt({ name: ALGO, iv }, key, plain));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

/** encryptBytes 의 역 — 앞 12바이트를 IV 로 떼어 복호화. 키·암호문이 어긋나면 throw. */
export async function decryptBytes(payload: Bytes, key: CryptoKey): Promise<Bytes> {
  if (payload.length < IV_BYTES + 16) throw new Error("invalid encrypted payload");
  const iv = payload.slice(0, IV_BYTES);
  const ct = payload.slice(IV_BYTES);
  return new Uint8Array(await crypto.subtle.decrypt({ name: ALGO, iv }, key, ct));
}

export async function encryptJSON(obj: unknown, key: CryptoKey): Promise<Bytes> {
  const plain: Bytes = new Uint8Array(new TextEncoder().encode(JSON.stringify(obj)));
  return encryptBytes(plain, key);
}

export async function decryptJSON<T>(payload: Bytes, key: CryptoKey): Promise<T> {
  const plain = await decryptBytes(payload, key);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
