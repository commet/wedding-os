import { useEffect, useMemo, useState } from "react";
import { defaultModel, hasDirectAi, runAiPrompt } from "../lib/aiClient";
import { type AiConfig, type AiProvider, getAiConfig, setAiConfig } from "../lib/security";
import { currentAccessToken } from "../lib/auth";
import { koBreak } from "../lib/typography";

type Props = { data?: unknown };

const PROVIDERS: { id: AiProvider; label: string; desc: string; link?: string }[] = [
  { id: "managed", label: "Wedding OS AI", desc: "운영자 서버의 AI로 앱 안에서 바로 실행하는 기본 방식" },
  { id: "bridge", label: "복붙 모드", desc: "API 키 없이 챗봇에 프롬프트를 복사해 쓰는 기본 방식" },
  { id: "gemini", label: "Gemini API", desc: "Google AI Studio 키로 앱 안에서 바로 실행", link: "https://ai.google.dev/gemini-api/docs/api-key" },
  { id: "openai", label: "OpenAI API", desc: "OpenAI API 키로 앱 안에서 바로 실행", link: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Claude API", desc: "Anthropic API 키로 앱 안에서 바로 실행", link: "https://console.anthropic.com/settings/keys" },
  { id: "ollama", label: "Ollama 로컬", desc: "내 컴퓨터의 로컬 LLM 서버에 연결", link: "https://ollama.com/download" },
];

export default function AiSettings(_: Props) {
  const initial = getAiConfig();
  const [provider, setProvider] = useState<AiProvider>(initial.provider);
  const [apiKey, setApiKey] = useState(initial.apiKey ?? "");
  const [model, setModel] = useState(initial.model ?? defaultModel(initial.provider));
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? "http://localhost:11434");
  const [status, setStatus] = useState<"idle" | "saved" | "testing" | "ok" | "fail">("idle");
  const [message, setMessage] = useState("");
  const [managedSignedIn, setManagedSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void currentAccessToken().then((token) => { if (!cancelled) setManagedSignedIn(!!token); });
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0], [provider]);
  const directReady = provider === "managed" ? managedSignedIn : hasDirectAi({ provider, apiKey, model, baseUrl });

  const save = () => {
    const next: AiConfig = {
      provider,
      apiKey: provider === "bridge" || provider === "managed" || provider === "ollama" ? undefined : apiKey,
      model: provider === "bridge" || provider === "managed" ? undefined : model || defaultModel(provider),
      baseUrl: provider === "ollama" ? baseUrl : undefined,
    };
    setAiConfig(next);
    setStatus("saved");
    setMessage("AI 설정을 이 기기에 저장했어요.");
    window.setTimeout(() => setStatus("idle"), 2400);
  };

  const test = async () => {
    save();
    const config = getAiConfig();
    if (!hasDirectAi(config)) {
      setStatus("fail");
      setMessage("API 키, 모델, URL 설정을 확인해주세요.");
      return;
    }
    setStatus("testing");
    setMessage("짧은 테스트 요청을 보내는 중…");
    const r = await runAiPrompt({
      title: "AI 연결 테스트",
      expectedShape: "text",
      prompt: "Wedding OS 연결 테스트입니다. 한국어로 '연결 완료'라고 짧게 답해주세요.",
    }, config);
    if (r.ok) {
      setStatus("ok");
      setMessage(r.text?.slice(0, 160) || "연결 완료");
    } else {
      setStatus("fail");
      setMessage(r.reason ?? "연결 실패");
    }
  };

  const chooseProvider = (id: AiProvider) => {
    setProvider(id);
    if (!model || model === defaultModel(provider)) setModel(defaultModel(id));
    if (id === "ollama" && !baseUrl) setBaseUrl("http://localhost:11434");
  };

  return (
    <div className="page pt-8 pb-10 space-y-9">
      <div>
        <div className="eyebrow-gold mb-2">도움 기능</div>
        <h1 className="h-page">{koBreak("AI 연결")}</h1>
      </div>

      <p className="text-[15px] text-soft leading-[1.85] border-b border-hair pb-5">
        AI는 선택 사항입니다. 연결하면 준비 순서, 청첩장 문안, 후보 비교처럼 막히기 쉬운 일을 앱 안에서 정리할 수 있어요.
      </p>

      <section>
        <div className="eyebrow mb-4">사용 방식</div>
        <div className="border-y border-hair divide-y divide-hair">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => chooseProvider(p.id)}
              className="w-full py-4 text-left flex items-baseline gap-4"
            >
              <span className={`w-3 h-3 border ${provider === p.id ? "bg-ink border-ink" : "border-soft"} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[16px] text-ink">{p.label}</div>
                <p className="text-[13px] text-soft leading-relaxed mt-1">{p.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {provider === "managed" && (
        <section className="border-y border-hair py-4 space-y-4">
          {managedSignedIn ? (
            <div>
              <div className="eyebrow mb-2">사용 가능</div>
              <p className="text-[13px] text-soft leading-relaxed">
                별도 API 키 없이 Wedding OS AI를 사용할 수 있습니다. 선택한 작업에 필요한 내용만 AI 제공자에게 전송되며,
                결과는 확인한 뒤 직접 반영합니다.
              </p>
            </div>
          ) : (
            <p className="text-[13px] text-soft leading-relaxed">
              Wedding OS AI는 비용 오남용 방지를 위해 로그인이 필요합니다. <a href="/login" className="underline underline-offset-4 text-ink">로그인하기 →</a>
            </p>
          )}
        </section>
      )}

      {provider !== "bridge" && provider !== "managed" && (
        <section className="space-y-5">
          <div>
            <label className="label">모델</label>
            <input
              className="input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={defaultModel(provider)}
            />
            <p className="text-[11px] text-soft mt-2 leading-relaxed">
              모델 이름은 선택한 AI 서비스에서 사용할 수 있는 이름으로 바꿀 수 있어요.
            </p>
          </div>

          {provider === "ollama" ? (
            <div>
              <label className="label">Ollama URL</label>
              <input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:11434" />
              <p className="text-[11px] text-soft mt-2 leading-relaxed">
                브라우저에서 로컬 서버 접근이 막히면 Ollama의 CORS 설정이 필요할 수 있습니다.
              </p>
            </div>
          ) : (
            <div>
              <label className="label">API 키</label>
              <input
                className="input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-... / AIza..."
                type="password"
                autoComplete="off"
              />
              <p className="text-[11px] text-soft mt-2 leading-relaxed">
                키는 이 기기에만 따로 저장되고, 백업 파일이나 같이 쓰는 저장소에는 들어가지 않습니다.
              </p>
            </div>
          )}

          <div className="flex gap-5 flex-wrap border-t border-hair pt-4">
            {selected.link && (
              <a href={selected.link} target="_blank" rel="noopener noreferrer" className="text-[12px] underline underline-offset-4 text-soft hover:text-ink">
                키 발급/설정 열기 ↗
              </a>
            )}
            <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noopener noreferrer" className="text-[12px] underline underline-offset-4 text-soft hover:text-ink">
              Gemini 가격 ↗
            </a>
            <a href="https://openai.com/api/pricing/" target="_blank" rel="noopener noreferrer" className="text-[12px] underline underline-offset-4 text-soft hover:text-ink">
              OpenAI 가격 ↗
            </a>
            <a href="https://docs.anthropic.com/en/docs/about-claude/pricing" target="_blank" rel="noopener noreferrer" className="text-[12px] underline underline-offset-4 text-soft hover:text-ink">
              Anthropic 가격 ↗
            </a>
          </div>
        </section>
      )}

      <section className="space-y-3 border-t border-hair pt-6">
        <button onClick={save} className="btn-primary w-full py-3.5 text-[13px]">
          설정 저장 →
        </button>
        {provider !== "bridge" && (
          <button
            onClick={test}
            disabled={!directReady || status === "testing"}
            className="block w-full text-center text-[13px] underline underline-offset-4 text-soft hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "testing" ? "테스트 중…" : "연결 테스트"}
          </button>
        )}
        {message && (
          <p className={`text-center text-[13px] leading-relaxed ${status === "fail" ? "text-ink" : "text-soft"}`}>
            {message}
          </p>
        )}
      </section>

      <section className="border-t border-hair pt-6">
        <div className="eyebrow mb-3">개인정보</div>
        <p className="text-[12px] text-soft leading-relaxed">
          AI를 실행하면 해당 작업에 필요한 내용이 선택한 AI 서비스로 전송됩니다.
          전화번호·계좌·축의금 같은 민감 정보는 AI 작업에 포함하지 않습니다.
        </p>
      </section>
    </div>
  );
}
