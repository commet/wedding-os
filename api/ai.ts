// POST /api/ai
// 운영자 Anthropic 키를 서버 환경변수로만 사용해 Wedding OS AI를 실행한다.
// 클라이언트에는 키를 절대 내려보내지 않는다.

declare const process: { env: Record<string, string | undefined> };
import { json, rateLimit, requireAuthenticatedUser } from "./_security";

const MAX_PROMPT_CHARS = 30_000;
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST 요청만 허용됩니다." }, 405);
  const limited = rateLimit(req, "ai", 10, 60_000);
  if (limited) return limited;
  const unauthorized = await requireAuthenticatedUser(req);
  if (unauthorized) return unauthorized;

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "JSON 요청만 허용됩니다." }, 415);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: "Wedding OS AI를 지금 사용할 수 없습니다. 잠시 후 다시 시도해주세요." }, 503);
  }

  let body: { prompt?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "요청 본문이 올바르지 않습니다." }, 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "프롬프트가 비어 있습니다." }, 400);
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json({ error: "AI 요청이 너무 깁니다. 사진이나 긴 메모를 줄여주세요." }, 413);
  }

  // Managed mode에서는 클라이언트가 모델을 고르지 못하게 한다.
  // 운영자가 비용/품질 정책을 환경변수로만 바꾼다.
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(55_000),
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ error: out?.error?.message ?? `AI 호출 실패 (${res.status})` }, 502);
    }
    const text = out?.content?.map((part: any) => part?.text).filter(Boolean).join("\n");
    return text ? json({ text }) : json({ error: "AI 응답이 비어 있습니다." }, 502);
  } catch {
    return json({ error: "AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요." }, 502);
  }
}

export default { fetch: handler };
