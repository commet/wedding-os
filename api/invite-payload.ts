// GET /api/invite-payload?code=<code>
//
// 발행된 청첩장의 암호문(payload.enc)을 그대로 돌려준다.
// 운영자도 못 읽는 불투명 바이트 — 게스트 브라우저가 링크의 # 키로 복호화한다.
// Blob 을 직접 노출하지 않고 함수로 프록시 — 같은 출처 응답이라 CORS 걱정 없음.

import { list } from "@vercel/blob";

declare const process: { env: Record<string, string | undefined> };

function err(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!/^[a-z0-9]{6,16}$/.test(code)) return err("잘못된 코드입니다.", 400);

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return err("스토리지가 아직 연결되지 않았어요.", 503);

  const { blobs } = await list({ prefix: `invite/${code}/`, token });
  const metaBlob = blobs.find((b) => b.pathname === `invite/${code}/meta.json`);
  const payloadBlob = blobs.find((b) => b.pathname === `invite/${code}/payload.enc`);
  if (!metaBlob || !payloadBlob) return err("청첩장을 찾을 수 없어요.", 404);

  // 만료 검사 — 메타를 못 읽으면 검사만 건너뛰고 본문 제공은 시도한다.
  try {
    const meta = (await fetch(metaBlob.url, { cache: "no-store" }).then((r) => r.json())) as {
      expiresAt?: string;
    };
    if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) {
      return err("만료된 청첩장이에요.", 410);
    }
  } catch {
    /* 만료 검사 생략 */
  }

  const payloadRes = await fetch(payloadBlob.url, { cache: "no-store" });
  if (!payloadRes.ok) return err("청첩장 데이터를 받지 못했어요.", 502);

  return new Response(await payloadRes.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "public, max-age=60",
    },
  });
}
