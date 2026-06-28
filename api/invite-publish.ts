// POST /api/invite-publish, header x-publish-meta=<base64url(JSON)>
//
// 청첩장 '간편 발행' — 암호화된 청첩장 본문을 Vercel Blob 에 저장한다.
//   body  : 바이너리 = 암호문 (운영자는 복호화 불가 — 키는 클라이언트 링크의 # 에만)
//           또는 multipart/form-data { payload: 암호문, ogImage?: 공개 미리보기 JPEG }
//   header: x-publish-meta = base64url(JSON) { ogMeta, rsvpToken, code? }
//           x-owner-token = ownerToken (자격증명과 개인정보를 URL 로그에 남기지 않는다)
//           code 없음 → 새 발행(코드 생성).  code 있음 → 재발행(ownerToken 해시 검증).
// 응답   : { code } 또는 { error }
//
// Blob 은 기본 access:'private' — 읽기는 이 프로젝트의 함수(토큰 보유)만 가능.
// 사용자가 링크 미리보기 대표사진을 켠 경우에만 축소 JPEG 하나를 public 으로 저장한다.
// 운영자가 평문으로 보는 건 ogMeta(이름·날짜)와 사용자가 공개 선택한 썸네일뿐이며,
// 그 외 청첩장 내용·전화·계좌·사진은 전부 암호문 안에 있어 운영자도 못 읽는다.

import { put, get, del } from "@vercel/blob";
import { json, rateLimit, requireAuthenticatedUser, sha256Hex } from "./_security";

declare const process: { env: Record<string, string | undefined> };

// Vercel Function request body hard limit is 4.5 MB. Keep our own cap lower
// so users get an app-level message instead of a platform 413.
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_OG_IMAGE_BYTES = 1024 * 1024;

type OgMeta = { groomName: string; brideName: string; date: string; heroImageUrl?: string };
type PublishMeta = { ogMeta: OgMeta; rsvpToken: string; code?: string };
type StoredMeta = {
  ogMeta: OgMeta;
  ownerTokenHash: string;
  rsvpTokenHash: string;
  payloadPath?: string;
  updatedAt: string;
  expiresAt: string;
};
type PublishBody = { ciphertext: ArrayBuffer; ogImage?: Blob };

function decodeBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
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

async function readPublishBody(req: Request): Promise<PublishBody | Response> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const form = await req.formData();
    const payload = form.get("payload");
    if (!(payload instanceof Blob)) return json({ error: "청첩장 암호문이 없습니다." }, 400);

    const ogEntry = form.get("ogImage");
    let ogImage: Blob | undefined;
    if (ogEntry !== null) {
      if (!(ogEntry instanceof Blob)) return json({ error: "미리보기 사진 형식이 올바르지 않습니다." }, 400);
      if (ogEntry.size > 0) {
        const imageType = ogEntry.type.split(";", 1)[0].trim().toLowerCase();
        if (imageType !== "image/jpeg") return json({ error: "미리보기 사진은 JPEG만 사용할 수 있습니다." }, 415);
        if (ogEntry.size > MAX_OG_IMAGE_BYTES) return json({ error: "미리보기 사진이 너무 큽니다." }, 413);
        ogImage = ogEntry;
      }
    }

    return { ciphertext: await payload.arrayBuffer(), ogImage };
  }

  return { ciphertext: await req.arrayBuffer() };
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST 요청만 허용됩니다." }, 405);
  const limited = rateLimit(req, "invite-publish", 5, 60_000);
  if (limited) return limited;
  const unauthorized = await requireAuthenticatedUser(req);
  if (unauthorized) return unauthorized;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: "스토리지가 아직 연결되지 않았어요 (운영자 설정 필요)." }, 503);

  const metaRaw = req.headers.get("x-publish-meta");
  if (!metaRaw) return json({ error: "발행 정보가 없습니다." }, 400);
  if (metaRaw.length > 16_384) return json({ error: "발행 정보가 너무 큽니다." }, 431);

  let meta: PublishMeta;
  try {
    meta = JSON.parse(decodeBase64Url(metaRaw)) as PublishMeta;
  } catch {
    return json({ error: "발행 정보가 손상됐습니다." }, 400);
  }
  const ownerToken = req.headers.get("x-owner-token") ?? "";
  if (ownerToken.length < 32 || ownerToken.length > 256) {
    return json({ error: "소유자 토큰이 올바르지 않습니다." }, 400);
  }
  if (typeof meta?.rsvpToken !== "string" || meta.rsvpToken.length < 32 || meta.rsvpToken.length > 256) {
    return json({ error: "RSVP 제출 토큰이 올바르지 않습니다." }, 400);
  }
  if (
    !meta.ogMeta ||
    typeof meta.ogMeta.groomName !== "string" ||
    typeof meta.ogMeta.brideName !== "string" ||
    typeof meta.ogMeta.date !== "string"
  ) {
    return json({ error: "청첩장 기본 정보가 없습니다." }, 400);
  }
  if (meta.ogMeta.groomName.length > 80 || meta.ogMeta.brideName?.length > 80 || meta.ogMeta.date?.length > 32) {
    return json({ error: "청첩장 기본 정보가 너무 깁니다." }, 400);
  }
  const baseOgMeta: OgMeta = {
    groomName: meta.ogMeta.groomName,
    brideName: meta.ogMeta.brideName,
    date: meta.ogMeta.date,
  };

  const body = await readPublishBody(req);
  if (body instanceof Response) return body;
  const { ciphertext, ogImage } = body;
  if (ciphertext.byteLength === 0) return json({ error: "청첩장 내용이 비어 있습니다." }, 400);
  if (ciphertext.byteLength > MAX_BYTES) {
    return json({ error: "청첩장 용량이 너무 큽니다. 사진 수를 줄여주세요." }, 413);
  }

  const ownerTokenHash = await sha256Hex(ownerToken);
  const rsvpTokenHash = await sha256Hex(meta.rsvpToken);
  let code = typeof meta.code === "string" && /^[a-z0-9]{6,16}$/.test(meta.code) ? meta.code : undefined;
  let existing: StoredMeta | null = null;

  if (code) {
    existing = await readStoredMeta(code, token);
    if (!existing) return json({ error: "수정할 청첩장을 찾을 수 없습니다." }, 404);
    if (existing.ownerTokenHash !== ownerTokenHash) {
      return json({ error: "이 청첩장을 수정할 권한이 없습니다." }, 403);
    }
  } else {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = genCode();
      if (!(await readStoredMeta(candidate, token))) { code = candidate; break; }
    }
    if (!code) return json({ error: "발행 코드를 만들지 못했습니다. 다시 시도해주세요." }, 503);
  }

  const payloadPath = `invite/${code}/payload-${crypto.randomUUID()}.enc`;
  const ogImagePath = ogImage ? `invite/${code}/og-image-${crypto.randomUUID()}.jpg` : undefined;
  let uploadedOgImage = false;

  try {
    // 새 payload를 먼저 쓰고 meta 포인터를 마지막에 전환한다. meta 저장 실패 시 기존 발행본은 유지된다.
    await put(payloadPath, ciphertext, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/octet-stream",
      token,
    });
    let heroImageUrl: string | undefined;
    if (ogImage && ogImagePath) {
      const uploaded = await put(ogImagePath, ogImage, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "image/jpeg",
        token,
      });
      uploadedOgImage = true;
      heroImageUrl = uploaded.url;
    }
    const stored: StoredMeta = {
      ogMeta: heroImageUrl ? { ...baseOgMeta, heroImageUrl } : baseOgMeta,
      ownerTokenHash,
      rsvpTokenHash,
      payloadPath,
      updatedAt: new Date().toISOString(),
      expiresAt: computeExpiry(baseOgMeta.date),
    };
    await put(`invite/${code}/meta.json`, JSON.stringify(stored), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token,
    });
    if (existing?.payloadPath && existing.payloadPath !== payloadPath) {
      await del(existing.payloadPath, { token }).catch(() => undefined);
    }
    if (existing?.ogMeta.heroImageUrl && existing.ogMeta.heroImageUrl !== heroImageUrl) {
      await del(existing.ogMeta.heroImageUrl, { token }).catch(() => undefined);
    }
  } catch {
    await del(payloadPath, { token }).catch(() => undefined);
    if (uploadedOgImage && ogImagePath) await del(ogImagePath, { token }).catch(() => undefined);
    return json({ error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, 502);
  }

  return json({ code });
}

export default { fetch: handler };
