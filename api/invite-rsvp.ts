// /api/invite-rsvp?code=<code>
//
// POST : 하객이 RSVP 를 보낸다. body = 암호화된 RSVP 바이트.
//        하객 브라우저가 청첩장과 같은 키(링크 #)로 암호화해 올리므로 운영자는 못 읽는다.
// GET  : 부부(오너)가 받은 RSVP 를 가져간다. ?owner=<base64url ownerToken> 으로 권한 검증.
//        암호화된 RSVP 들을 base64 배열로 돌려주고, 복호화는 오너 브라우저에서 한다.

import { put, get, list } from "@vercel/blob";

declare const process: { env: Record<string, string | undefined> };

const MAX_RSVP_BYTES = 64 * 1024;

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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function sha256Hex(s: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function readMeta(
  code: string,
  token: string,
): Promise<{ ownerTokenHash: string; expiresAt?: string } | null> {
  try {
    const res = await get(`invite/${code}/meta.json`, { access: "private", token });
    if (!res || res.statusCode !== 200) return null;
    return (await new Response(res.stream).json()) as {
      ownerTokenHash: string;
      expiresAt?: string;
    };
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  if (!/^[a-z0-9]{6,16}$/.test(code)) return json({ error: "잘못된 코드입니다." }, 400);

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: "스토리지가 아직 연결되지 않았어요." }, 503);

  // ── 하객 RSVP 제출 ──
  if (req.method === "POST") {
    const meta = await readMeta(code, token);
    if (!meta) return json({ error: "청첩장을 찾을 수 없어요." }, 404);
    if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
      return json({ error: "만료된 청첩장이에요." }, 410);
    }
    const body = await req.arrayBuffer();
    if (body.byteLength === 0) return json({ error: "응답 내용이 비어 있어요." }, 400);
    if (body.byteLength > MAX_RSVP_BYTES) return json({ error: "응답이 너무 큽니다." }, 413);
    try {
      await put(`invite/${code}/rsvp/${crypto.randomUUID()}.enc`, body, {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/octet-stream",
        token,
      });
    } catch {
      return json({ error: "응답 저장에 실패했어요." }, 502);
    }
    return json({ ok: true });
  }

  // ── 오너가 받은 RSVP 조회 ──
  if (req.method === "GET") {
    const ownerB64 = url.searchParams.get("owner") ?? "";
    if (!ownerB64) return json({ error: "권한 정보가 없습니다." }, 400);
    const meta = await readMeta(code, token);
    if (!meta) return json({ error: "청첩장을 찾을 수 없어요." }, 404);
    let providedHash: string;
    try {
      providedHash = await sha256Hex(decodeBase64Url(ownerB64));
    } catch {
      return json({ error: "권한 정보가 손상됐습니다." }, 400);
    }
    if (providedHash !== meta.ownerTokenHash) {
      return json({ error: "RSVP 를 볼 권한이 없습니다." }, 403);
    }
    const { blobs } = await list({ prefix: `invite/${code}/rsvp/`, token });
    const items = await Promise.all(
      blobs.map(async (b) => {
        try {
          const r = await get(b.pathname, { access: "private", token });
          if (!r || r.statusCode !== 200) return null;
          const bytes = new Uint8Array(await new Response(r.stream).arrayBuffer());
          return bytesToBase64(bytes);
        } catch {
          return null;
        }
      }),
    );
    return json({ rsvps: items.filter((x): x is string => x !== null) });
  }

  return json({ error: "허용되지 않은 메서드입니다." }, 405);
}
