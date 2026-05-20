import type { BridgePrompt } from "./chatbotBridge";
import { type AiConfig, getAiConfig } from "./security";

export type AiRunResult = {
  ok: boolean;
  text?: string;
  reason?: string;
};

export function hasDirectAi(config: AiConfig = getAiConfig()): boolean {
  if (config.provider === "bridge") return false;
  if (config.provider === "ollama") return !!config.baseUrl && !!config.model;
  return !!config.apiKey && !!config.model;
}

export function defaultModel(provider: AiConfig["provider"]): string {
  if (provider === "gemini") return "gemini-1.5-flash";
  if (provider === "openai") return "gpt-4o-mini";
  if (provider === "anthropic") return "claude-3-5-haiku-latest";
  if (provider === "ollama") return "llama3.1";
  return "";
}

export async function runAiPrompt(prompt: BridgePrompt, config: AiConfig = getAiConfig()): Promise<AiRunResult> {
  try {
    if (!hasDirectAi(config)) {
      return { ok: false, reason: "AI 설정이 아직 없어요. 복붙 모드를 쓰거나 API 키를 연결해주세요." };
    }
    if (config.provider === "gemini") return runGemini(prompt.prompt, config);
    if (config.provider === "openai") return runOpenAI(prompt.prompt, config);
    if (config.provider === "anthropic") return runAnthropic(prompt.prompt, config);
    if (config.provider === "ollama") return runOllama(prompt.prompt, config);
    return { ok: false, reason: "지원하지 않는 AI provider 입니다." };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "AI 호출에 실패했어요." };
  }
}

async function runGemini(input: string, config: AiConfig): Promise<AiRunResult> {
  const model = config.model || defaultModel("gemini");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey ?? "")}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: input }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: json?.error?.message ?? `Gemini 오류 (${res.status})` };
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n");
  return text ? { ok: true, text } : { ok: false, reason: "Gemini 응답이 비어 있어요." };
}

async function runOpenAI(input: string, config: AiConfig): Promise<AiRunResult> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || defaultModel("openai"),
      input,
      temperature: 0.2,
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
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
  const res = await fetch(`${baseUrl}/api/generate`, {
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
