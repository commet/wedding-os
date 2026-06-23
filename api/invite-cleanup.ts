// GET /api/invite-cleanup  (Vercel Cron 이 매일 호출)
//
// 만료된(결혼식 + 6개월 지난) 청첩장을 실제로 삭제한다.
// 기존엔 만료가 "읽기 시점 차단"일 뿐이라 암호문·RSVP·평문 메타가 영구 잔존했다 —
// 프라이버시 우선 제품에 맞게 보존 기간이 끝난 데이터를 물리적으로 지운다.
//
// 보호: CRON_SECRET 및 Authorization: Bearer <secret> 을 필수로 요구한다.
//       Vercel Cron 은 설정된 CRON_SECRET을 자동으로 헤더에 붙인다.

import { get, del } from "@vercel/blob";
import { listAllBlobs } from "./_blob";

declare const process: { env: Record<string, string | undefined> };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: "스토리지가 연결되지 않았어요." }, 503);

  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "CRON_SECRET 설정이 필요합니다." }, 503);
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);

  const now = Date.now();
  let removed = 0;
  let checked = 0;

  try {
    // 한 번에 invite/ 아래 전부 나열 — code 별로 그룹핑.
    const blobs = await listAllBlobs("invite/", token, 1_000_000);
    const byCode = new Map<string, string[]>(); // code → blob url[]
    for (const b of blobs) {
      const m = b.pathname.match(/^invite\/([a-z0-9]{6,16})\//);
      if (!m) continue;
      const arr = byCode.get(m[1]) ?? [];
      arr.push(b.url);
      byCode.set(m[1], arr);
    }

    for (const [code, urls] of byCode) {
      checked++;
      let expired = false;
      try {
        const res = await get(`invite/${code}/meta.json`, { access: "private", token });
        // 메타를 확실히 읽어 만료가 확인된 경우에만 삭제한다.
        // (메타 없음/읽기 실패는 발행 진행 중일 수도 있으므로 보수적으로 보존.)
        if (res && res.statusCode === 200) {
          const meta = (await new Response(res.stream).json()) as { expiresAt?: string };
          const exp = meta.expiresAt ? new Date(meta.expiresAt).getTime() : NaN;
          expired = !isNaN(exp) && exp < now;
        }
      } catch {
        expired = false;
      }
      if (expired && urls.length > 0) {
        await del(urls, { token });
        removed++;
      }
    }
  } catch {
    return json({ error: "정리 중 오류가 났어요." }, 502);
  }

  return json({ ok: true, checked, removed });
}
