// GET /api/invite-payload?code=<code>
//
// 발행된 청첩장의 암호문(payload.enc)을 그대로 돌려준다.
// 운영자도 못 읽는 불투명 바이트 — 게스트 브라우저가 링크의 # 키로 복호화한다.
// Blob 은 private — 토큰을 가진 이 함수만 읽을 수 있고, 응답은 같은 출처라 CORS 무관.
// 모든 응답은 privateNoStoreHeaders 로 cache-control: private, no-store 를 붙인다.

import { get } from "@vercel/blob";
import { privateNoStoreHeaders, rateLimit, rateLimitByKey } from "./_security";

declare const process: { env: Record<string, string | undefined> };

function err(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: privateNoStoreHeaders("application/json; charset=utf-8"),
  });
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") return err("GET 요청만 허용됩니다.", 405);
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!/^[a-z0-9]{6,16}$/.test(code)) return err("잘못된 코드입니다.", 400);
  const limited = rateLimit(req, "invite-payload", 120, 60_000) ?? rateLimitByKey(req, "invite-payload-code", code, 300, 60_000);
  if (limited) return limited;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return err("스토리지가 아직 연결되지 않았어요.", 503);

  // 만료 검사 — meta.json 을 읽어 expiresAt 확인.
  try {
    const metaRes = await get(`invite/${code}/meta.json`, { access: "private", useCache: false, token });
    if (!metaRes || metaRes.statusCode !== 200) return err("청첩장을 찾을 수 없어요.", 404);
    const meta = (await new Response(metaRes.stream).json()) as { expiresAt?: string; payloadPath?: string };
    if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
      return err("만료된 청첩장이에요.", 410);
    }
    const payloadPath = meta.payloadPath || `invite/${code}/payload.enc`;
    const payloadRes = await get(payloadPath, { access: "private", useCache: false, token });
    if (!payloadRes || payloadRes.statusCode !== 200) return err("청첩장을 찾을 수 없어요.", 404);
    return new Response(payloadRes.stream, {
      status: 200,
      headers: privateNoStoreHeaders("application/octet-stream"),
    });
  } catch {
    return err("청첩장 정보를 읽지 못했어요.", 502);
  }
}

export default { fetch: handler };
