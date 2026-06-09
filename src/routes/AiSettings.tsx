import { useMemo, useState } from "react";
import { defaultModel, hasDirectAi, runAiPrompt } from "../lib/aiClient";
import { type AiConfig, type AiProvider, getAiConfig, setAiConfig } from "../lib/security";

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

  const selected = useMemo(() => PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0], [provider]);
  const directReady = hasDirectAi({ provider, apiKey, model, baseUrl });

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
        <div className="eyebrow-gold mb-2">AI Settings</div>
        <h1 className="font-serif text-[2rem] leading-none">AI 연결</h1>
      </div>

      <p className="text-[13px] text-soft leading-relaxed border-b border-hair pb-5">
        Wedding OS는 AI 없이도 저장·공유 도구로 작동합니다. 연결해두면 준비 초안 만들기,
        청첩장 문안, 반지 가격 확인, 숙소·항공 검색처럼 막히기 쉬운 작업을 앱 안에서 바로 정리할 수 있습니다.
      </p>

      <section>
        <div className="eyebrow-gold mb-4">사용 방식</div>
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
                <p className="text-[11.5px] text-soft leading-relaxed mt-1">{p.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {provider === "managed" && (
        <section className="border-y border-hair py-4 space-y-4">
          <div>
            <div className="eyebrow-gold mb-2">배포에서 켜는 방법</div>
            <p className="text-[12.5px] text-soft leading-relaxed">
              Vercel 프로젝트에 서버 환경변수
              <code className="bg-cream px-1 mx-1">ANTHROPIC_API_KEY</code>
              를 넣고 다시 배포하면, 사용자는 별도 키 없이 앱 안에서 바로 실행할 수 있습니다.
            </p>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-[12px] text-soft leading-relaxed">
            <li>Anthropic Console에서 API 키를 새로 만듭니다.</li>
            <li>Vercel 프로젝트의 Settings → Environment Variables로 갑니다.</li>
            <li>이름은 <code className="bg-cream px-1">ANTHROPIC_API_KEY</code>, 값은 발급받은 키 전체를 넣습니다.</li>
            <li>Production과 Preview에 적용하고 저장한 뒤, 새 배포를 실행합니다.</li>
          </ol>
          <p className="text-[11px] text-soft leading-relaxed">
            이 키는 서버 함수에서만 읽습니다. <code className="bg-cream px-1">VITE_</code>를 붙이지 말고,
            코드나 백업 파일에 저장하지 마세요.
          </p>
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
              모델 이름은 각 provider 콘솔에서 현재 사용 가능한 이름으로 바꿀 수 있어요.
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
              <a href={selected.link} target="_blank" rel="noopener noreferrer" className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
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
        <button onClick={save} className="btn-primary w-full py-3.5 text-[12.5px]">
          설정 저장 →
        </button>
        {provider !== "bridge" && (
          <button
            onClick={test}
            disabled={!directReady || status === "testing"}
            className="block w-full text-center text-[12px] underline underline-offset-4 text-soft hover:text-ink disabled:opacity-40"
          >
            {status === "testing" ? "테스트 중…" : "연결 테스트"}
          </button>
        )}
        {message && (
          <p className={`text-center text-[11.5px] leading-relaxed ${status === "fail" ? "text-gold" : "text-soft"}`}>
            {message}
          </p>
        )}
      </section>

      <section className="border-t border-hair pt-6">
        <div className="eyebrow-gold mb-3">Privacy</div>
        <p className="text-[12px] text-soft leading-relaxed">
          API 모드를 쓰면 선택한 작업의 프롬프트가 해당 AI provider로 전송됩니다.
          Wedding OS는 전화번호·계좌·축의금 같은 민감 정보가 필요한 작업이 아니라면 보내지 않도록 기능을 작게 쪼개는 방향으로 설계합니다.
        </p>
      </section>
    </div>
  );
}
