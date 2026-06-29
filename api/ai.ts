// POST /api/ai
// 운영자 Anthropic 키를 서버 환경변수로만 사용해 Dearie AI를 실행한다.
// 클라이언트에는 키를 절대 내려보내지 않는다.

declare const process: { env: Record<string, string | undefined> };
import { authenticateUserOptional, json, jsonWithHeaders, rateLimit, rateLimitByKey, sha256Hex } from "./_security";

const MAX_TRIAL_PROMPT_CHARS = 6_000;
const MAX_STANDARD_PROMPT_CHARS = 16_000;
const MAX_DEEP_PROMPT_CHARS = 24_000;
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_DEEP_MODEL = "claude-sonnet-4-6";
const TRIAL_MAX_TOKENS = 900;
const STANDARD_MAX_TOKENS = 1800;
const DEEP_MAX_TOKENS = 3200;
type AiTier = "standard" | "deep";
const TRIAL_COOKIE = "wos_ai_trial";
const TRIAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function requestedTier(value: unknown): AiTier {
  return value === "deep" ? "deep" : "standard";
}

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown")
    .split(",")[0]
    .trim();
}

function cookieValue(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  const prefix = `${name}=`;
  return raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function signedTrialCookie(req: Request): Promise<{ id: string; setCookie?: string }> {
  const secret = process.env.AI_TRIAL_SECRET || process.env.CRON_SECRET || process.env.ANTHROPIC_API_KEY || "dev-only";
  const raw = cookieValue(req, TRIAL_COOKIE);
  if (raw) {
    const [id, sig] = raw.split(".");
    if (/^[a-f0-9]{32}$/.test(id) && sig) {
      const expected = (await sha256Hex(`${id}.${secret}`)).slice(0, 24);
      if (sig === expected) return { id };
    }
  }
  const id = randomToken();
  const sig = (await sha256Hex(`${id}.${secret}`)).slice(0, 24);
  return {
    id,
    setCookie: `${TRIAL_COOKIE}=${id}.${sig}; Max-Age=${TRIAL_COOKIE_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax; Secure`,
  };
}

function localTrialId(req: Request): string | undefined {
  const id = req.headers.get("x-wos-trial-id") ?? "";
  return /^[A-Za-z0-9_-]{16,80}$/.test(id) ? id : undefined;
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST 요청만 허용됩니다." }, 405);
  const limited = rateLimit(req, "ai-ip", 12, 60_000);
  if (limited) return limited;
  const auth = await authenticateUserOptional(req);
  if (!auth.ok) return auth.response;
  const signedIn = !!auth.userId;

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "JSON 요청만 허용됩니다." }, 415);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: "Dearie AI를 지금 사용할 수 없습니다. 잠시 후 다시 시도해주세요." }, 503);
  }

  let body: { prompt?: unknown; tier?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "요청 본문이 올바르지 않습니다." }, 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return json({ error: "프롬프트가 비어 있습니다." }, 400);
  const tier = requestedTier(body.tier);
  if (!signedIn && tier === "deep") {
    return json({ error: "중요한 AI 작업은 로그인 후 사용할 수 있어요. 먼저 짧은 체험 호출을 사용해보세요." }, 401);
  }
  const promptLimit = !signedIn
    ? MAX_TRIAL_PROMPT_CHARS
    : tier === "deep" ? MAX_DEEP_PROMPT_CHARS : MAX_STANDARD_PROMPT_CHARS;
  if (prompt.length > promptLimit) {
    return json({ error: "AI 요청이 너무 깁니다. 사진이나 긴 메모를 줄여주세요." }, 413);
  }

  // Managed mode에서는 클라이언트가 모델을 고르지 못하게 한다.
  // 운영자가 비용/품질 정책을 환경변수로만 바꾸며, deep tier 는 별도 quota 로 제한한다.
  const standardModel = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const deepModel = process.env.ANTHROPIC_DEEP_MODEL || DEFAULT_DEEP_MODEL;
  const useDeep = signedIn && tier === "deep" && !!deepModel;
  const model = useDeep ? deepModel : standardModel;
  const maxTokens = !signedIn ? TRIAL_MAX_TOKENS : useDeep ? DEEP_MAX_TOKENS : STANDARD_MAX_TOKENS;

  let trialCookie: string | undefined;
  if (!signedIn) {
    const cookie = await signedTrialCookie(req);
    trialCookie = cookie.setCookie;
    const localId = localTrialId(req);
    const ipKey = clientIp(req);
    const trialBurst = rateLimit(req, "ai-trial-ip-minute", 8, 60_000);
    if (trialBurst) return trialCookie ? withTrialCookie(trialBurst, trialCookie) : trialBurst;
    const trialHour = rateLimit(req, "ai-trial-ip-hour", 8, 60 * 60_000);
    if (trialHour) return trialCookie ? withTrialCookie(trialHour, trialCookie) : trialHour;
    const trialDay = rateLimit(req, "ai-trial-ip-day", 20, 24 * 60 * 60_000);
    if (trialDay) return trialCookie ? withTrialCookie(trialDay, trialCookie) : trialDay;
    const cookieHour = rateLimitByKey(req, "ai-trial-cookie-hour", cookie.id, 8, 60 * 60_000);
    if (cookieHour) return trialCookie ? withTrialCookie(cookieHour, trialCookie) : cookieHour;
    const cookieDay = rateLimitByKey(req, "ai-trial-cookie-day", cookie.id, 20, 24 * 60 * 60_000);
    if (cookieDay) return trialCookie ? withTrialCookie(cookieDay, trialCookie) : cookieDay;
    if (localId) {
      const localHour = rateLimitByKey(req, "ai-trial-local-hour", localId, 8, 60 * 60_000);
      if (localHour) return trialCookie ? withTrialCookie(localHour, trialCookie) : localHour;
      const localDay = rateLimitByKey(req, "ai-trial-local-day", localId, 20, 24 * 60 * 60_000);
      if (localDay) return trialCookie ? withTrialCookie(localDay, trialCookie) : localDay;
    }
    const subnetHour = rateLimitByKey(req, "ai-trial-subnet-hour", ipKey.split(".").slice(0, 3).join("."), 40, 60 * 60_000);
    if (subnetHour) return trialCookie ? withTrialCookie(subnetHour, trialCookie) : subnetHour;
  } else {
    const userLimit = rateLimitByKey(req, "ai-user-hour", auth.userId!, 24, 60 * 60_000);
    if (userLimit) return userLimit;
  }
  if (useDeep) {
    const deepUserLimit = rateLimitByKey(req, "ai-deep-user-hour", auth.userId!, 2, 60 * 60_000);
    if (deepUserLimit) return deepUserLimit;
    const deepIpLimit = rateLimit(req, "ai-deep-ip-hour", 5, 60 * 60_000);
    if (deepIpLimit) return deepIpLimit;
  }

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
        max_tokens: maxTokens,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      return jsonAi({ error: out?.error?.message ?? `AI 호출 실패 (${res.status})` }, 502, trialCookie);
    }
    const text = out?.content?.map((part: any) => part?.text).filter(Boolean).join("\n");
    return text ? jsonAi({ text }, 200, trialCookie) : jsonAi({ error: "AI 응답이 비어 있습니다." }, 502, trialCookie);
  } catch {
    return jsonAi({ error: "AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요." }, 502, trialCookie);
  }
}

function jsonAi(body: unknown, status = 200, trialCookie?: string): Response {
  return trialCookie ? jsonWithHeaders(body, status, { "set-cookie": trialCookie }) : json(body, status);
}

function withTrialCookie(response: Response, trialCookie: string): Response {
  response.headers.set("set-cookie", trialCookie);
  return response;
}

export default { fetch: handler };
