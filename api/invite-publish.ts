// POST /api/invite-publish?meta=<base64url(JSON)>
//
// 청첩장 '간편 발행' — 암호화된 청첩장 본문을 Vercel Blob 에 저장한다.
//   body  : 바이너리 = 암호문 (운영자는 복호화 불가 — 키는 클라이언트 링크의 # 에만)
//   query : meta = base64url(JSON) { ogMeta:{groomName,brideName,date}, ownerToken, code? }
//           code 없음 → 새 발행(코드 생성).  code 있음 → 재발행(ownerToken 해시 검증).
// 응답   : { code } 또는 { error }
//
// Blob 은 모두 access:'private' — 추측 가능한 공개 URL 이 없고, 읽기는 이 프로젝트의
// 함수(토큰 보유)만 가능. 운영자가 평문으로 보는 건 ogMeta(이름·날짜)뿐이며,
// 그 외 청첩장 내용·전화·계좌·사진은 전부 암호문 안에 있어 운영자도 못 읽는다.

import { put, get } from "@vercel/blob";

declare const process: { env: Record<string, string | undefined> };

const MAX_BYTES = 8 * 1024 * 1024;

type OgMeta = { groomName: string; brideName: string; date: string };
type PublishMeta = { ogMeta: OgMeta; ownerToken: string; code?: string };
type StoredMeta = { ogMeta: OgMeta; ownerTokenHash: string; updatedAt: string; expiresAt: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function decodeBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function sha256Hex(s: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // 헷갈리는 글자(l,o,0,1) 제외
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % 32];
  return out;
}

// 만료 = 결혼식 날짜 + 6개월 (날짜 모르면 발행 시점 + 6개월). 결혼식은 시한이 있어 영구 보관 불필요.
function computeExpiry(weddingDate: string): string {
  const parsed = weddingDate ? new Date(weddingDate) : null;
  const base = parsed && !isNaN(parsed.getTime()) ? parsed : new Date();
  base.setDate(base.getDate() + 180);
  return base.toISOString();
}

async function readStoredMeta(code: string, token: string): Promise<StoredMeta | null> {
  try {
    const res = await get(`invite/${code}/meta.json`, { access: "private", token });
    if (!res || res.statusCode !== 200) return null;
    return (await new Response(res.stream).json()) as StoredMeta;
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST 요청만 허용됩니다." }, 405);

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: "스토리지가 아직 연결되지 않았어요 (운영자 설정 필요)." }, 503);

  const metaRaw = new URL(req.url).searchParams.get("meta");
  if (!metaRaw) return json({ error: "발행 정보가 없습니다." }, 400);

  let meta: PublishMeta;
  try {
    meta = JSON.parse(decodeBase64Url(metaRaw)) as PublishMeta;
  } catch {
    return json({ error: "발행 정보가 손상됐습니다." }, 400);
  }
  if (!meta?.ownerToken || meta.ownerToken.length < 16) {
    return json({ error: "소유자 토큰이 올바르지 않습니다." }, 400);
  }
  if (!meta.ogMeta || typeof meta.ogMeta.groomName !== "string") {
    return json({ error: "청첩장 기본 정보가 없습니다." }, 400);
  }

  const ciphertext = await req.arrayBuffer();
  if (ciphertext.byteLength === 0) return json({ error: "청첩장 내용이 비어 있습니다." }, 400);
  if (ciphertext.byteLength > MAX_BYTES) {
    return json({ error: "청첩장 용량이 너무 큽니다. 사진 수를 줄여주세요." }, 413);
  }

  const ownerTokenHash = await sha256Hex(meta.ownerToken);
  let code = typeof meta.code === "string" && /^[a-z0-9]{6,16}$/.test(meta.code) ? meta.code : undefined;

  if (code) {
    const existing = await readStoredMeta(code, token);
    if (!existing) return json({ error: "수정할 청첩장을 찾을 수 없습니다." }, 404);
    if (existing.ownerTokenHash !== ownerTokenHash) {
      return json({ error: "이 청첩장을 수정할 권한이 없습니다." }, 403);
    }
  } else {
    code = genCode();
  }

  const stored: StoredMeta = {
    ogMeta: meta.ogMeta,
    ownerTokenHash,
    updatedAt: new Date().toISOString(),
    expiresAt: computeExpiry(meta.ogMeta.date ?? ""),
  };

  try {
    await put(`invite/${code}/payload.enc`, ciphertext, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/octet-stream",
      token,
    });
    await put(`invite/${code}/meta.json`, JSON.stringify(stored), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token,
    });
  } catch {
    return json({ error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, 502);
  }

  return json({ code });
}
