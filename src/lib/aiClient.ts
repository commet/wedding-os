import type { BridgePrompt } from "./chatbotBridge";
import { type AiConfig, getAiConfig } from "./security";
import { currentAccessToken } from "./auth";

export type AiRunResult = {
  ok: boolean;
  text?: string;
  reason?: string;
};

const MAX_PROMPT_CHARS = 30_000;
const AI_TIMEOUT_MS = 60_000;
const TRIAL_ID_KEY = "wedding-os/ai-trial-id/v1";

async function fetchAi(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function validOllamaUrl(value?: string): boolean {
  try {
    const url = new URL(value || "");
    return (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
  } catch {
    return false;
  }
}

export function hasDirectAi(config: AiConfig = getAiConfig()): boolean {
  if (config.provider === "managed") return true;
  if (config.provider === "bridge") return false;
  if (config.provider === "ollama") return validOllamaUrl(config.baseUrl) && !!config.model;
  return !!config.apiKey && !!config.model;
}

export function defaultModel(provider: AiConfig["provider"]): string {
  if (provider === "managed") return "claude-haiku-4-5-20251001";
  if (provider === "gemini") return "gemini-2.5-flash";
  if (provider === "openai") return "gpt-5.4-mini";
  if (provider === "anthropic") return "claude-haiku-4-5-20251001";
  if (provider === "ollama") return "llama3.1";
  return "";
}

export async function runAiPrompt(prompt: BridgePrompt, config: AiConfig = getAiConfig()): Promise<AiRunResult> {
  try {
    if (!prompt.prompt.trim() || prompt.prompt.length > MAX_PROMPT_CHARS) {
      return { ok: false, reason: "AI 요청이 비어 있거나 너무 큽니다." };
    }
    if (!hasDirectAi(config)) {
      return { ok: false, reason: "AI 설정이 아직 없어요. 복붙 모드를 쓰거나 API 키를 연결해주세요." };
    }
    if (config.provider === "managed") return runManagedAI(prompt);
    if (config.provider === "gemini") return runGemini(prompt.prompt, config);
    if (config.provider === "openai") return runOpenAI(prompt.prompt, config);
    if (config.provider === "anthropic") return runAnthropic(prompt.prompt, config);
    if (config.provider === "ollama") return runOllama(prompt.prompt, config);
    return { ok: false, reason: "지원하지 않는 AI provider 입니다." };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "AI 호출에 실패했어요." };
  }
}

async function runManagedAI(prompt: BridgePrompt): Promise<AiRunResult> {
  const accessToken = await currentAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  else headers["X-WOS-Trial-Id"] = getOrCreateTrialId();
  const res = await fetchAi("/api/ai", {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt: prompt.prompt, tier: prompt.tier ?? "standard" }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 404) {
    return {
      ok: false,
      reason: "Dearie AI를 지금 사용할 수 없습니다. 잠시 후 다시 시도하거나 다른 AI 사용 방식을 선택해주세요.",
    };
  }
  if (!res.ok) return { ok: false, reason: json?.error ?? `Dearie AI 오류 (${res.status})` };
  return json?.text ? { ok: true, text: json.text } : { ok: false, reason: "Dearie AI 응답이 비어 있어요." };
}

function getOrCreateTrialId(): string {
  try {
    const current = localStorage.getItem(TRIAL_ID_KEY);
    if (current && /^[A-Za-z0-9_-]{16,80}$/.test(current)) return current;
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(TRIAL_ID_KEY, id);
    return id;
  } catch {
    return "trial-unavailable";
  }
}

async function runGemini(input: string, config: AiConfig): Promise<AiRunResult> {
  const model = config.model || defaultModel("gemini");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey ?? "")}`;
  const res = await fetchAi(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: input }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: json?.error?.message ?? `Gemini 오류 (${res.status})` };
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n");
  return text ? { ok: true, text } : { ok: false, reason: "Gemini 응답이 비어 있어요." };
}

async function runOpenAI(input: string, config: AiConfig): Promise<AiRunResult> {
  const res = await fetchAi("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || defaultModel("openai"),
      input,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: json?.error?.message ?? `OpenAI 오류 (${res.status})` };
  const text =
    json?.output_text ??
    json?.output?.flatMap((o: any) => o?.content ?? []).map((c: any) => c?.text).filter(Boolean).join("\n");
  return text ? { ok: true, text } : { ok: false, reason: "OpenAI 응답이 비어 있어요." };
}

async function runAnthropic(input: string, config: AiConfig): Promise<AiRunResult> {
  const res = await fetchAi("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey ?? "",
      "anthropic-version": "2023-06-01",
      // Anthropic은 브라우저 직접 호출을 명시적으로 허용할 때만 열어준다.
      // 키가 사용자 기기에만 저장되는 구조지만, 공개 PC/공유 기기에서는 쓰지 않는 것이 좋다.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model || defaultModel("anthropic"),
      max_tokens: 4096,
      temperature: 0.2,
      messages: [{ role: "user", content: input }],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: json?.error?.message ?? `Anthropic 오류 (${res.status})` };
  const text = json?.content?.map((p: any) => p.text).filter(Boolean).join("\n");
  return text ? { ok: true, text } : { ok: false, reason: "Claude 응답이 비어 있어요." };
}

async function runOllama(input: string, config: AiConfig): Promise<AiRunResult> {
  const baseUrl = (config.baseUrl || "http://localhost:11434").replace(/\/+$/, "");
  if (!validOllamaUrl(baseUrl)) return { ok: false, reason: "Ollama는 이 기기의 localhost 주소만 연결할 수 있습니다." };
  const res = await fetchAi(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model || defaultModel("ollama"),
      prompt: input,
      stream: false,
      options: { temperature: 0.2 },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: json?.error ?? `Ollama 오류 (${res.status})` };
  return json?.response ? { ok: true, text: json.response } : { ok: false, reason: "Ollama 응답이 비어 있어요." };
}
