// POST /api/invite-unpublish?code=<code>
//
// 발행 취소 — 부부(오너)가 발행한 청첩장을 내린다.
//   header : x-owner-token = ownerToken (쿼리가 아니라 헤더 — 로그에 안 남도록)
// 권한    : meta.json 의 ownerTokenHash 와 대조. 발행한 본인만 내릴 수 있다.
// 동작    : invite/<code>/ 아래 모든 blob(payload.enc · meta.json · rsvp/*.enc)을 삭제.
//
// 설계 원칙 #1(사용자가 자기 데이터를 통제) — 한 번 발행하면 못 내리던 구멍을 막는다.

import { get } from "@vercel/blob";
import { deleteAllBlobs } from "./_blob";
import { json, rateLimit, sha256Hex } from "./_security";

declare const process: { env: Record<string, string | undefined> };

async function readOwnerHash(code: string, token: string): Promise<string | null> {
  try {
    const res = await get(`invite/${code}/meta.json`, { access: "private", token });
    if (!res || res.statusCode !== 200) return null;
    const meta = (await new Response(res.stream).json()) as { ownerTokenHash?: string };
    return meta.ownerTokenHash ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST 요청만 허용됩니다." }, 405);
  const limited = rateLimit(req, "invite-unpublish", 5, 60_000);
  if (limited) return limited;

  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!/^[a-z0-9]{6,16}$/.test(code)) return json({ error: "잘못된 코드입니다." }, 400);

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: "스토리지가 아직 연결되지 않았어요." }, 503);

  const ownerToken = req.headers.get("x-owner-token") ?? "";
  if (ownerToken.length < 32 || ownerToken.length > 256) return json({ error: "권한 정보가 올바르지 않습니다." }, 400);

  const storedHash = await readOwnerHash(code, token);
  if (!storedHash) return json({ error: "청첩장을 찾을 수 없어요." }, 404);
  if ((await sha256Hex(ownerToken)) !== storedHash) {
    return json({ error: "이 청첩장을 내릴 권한이 없습니다." }, 403);
  }

  // invite/<code>/ 아래 전부 삭제 — payload.enc · meta.json · rsvp/*.enc.
  try {
    await deleteAllBlobs(`invite/${code}/`, token);
  } catch {
    return json({ error: "삭제에 실패했습니다. 잠시 후 다시 시도해주세요." }, 502);
  }

  return json({ ok: true });
}
