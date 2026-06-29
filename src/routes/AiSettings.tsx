import { useEffect, useMemo, useState } from "react";
import { defaultModel, hasDirectAi, runAiPrompt } from "../lib/aiClient";
import { type AiConfig, type AiProvider, getAiConfig, setAiConfig } from "../lib/security";
import { currentAccessToken } from "../lib/auth";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import { koBreak } from "../lib/typography";

type Props = { data?: unknown };

const PROVIDERS: { id: AiProvider; label: string; desc: string; link?: string }[] = [
  { id: "managed", label: "Dearie AI", desc: "설정 없이 바로 쓸 수 있어요. 무료로 체험한 뒤 필요하면 로그인" },
  { id: "bridge", label: "복붙 모드", desc: "평소 쓰는 챗봇(ChatGPT·Claude)에 복사해서 쓰기 — 키도 비용도 없음" },
  { id: "gemini", label: "Gemini API", desc: "Google AI Studio 키로 앱 안에서 바로 실행", link: "https://ai.google.dev/gemini-api/docs/api-key" },
  { id: "openai", label: "OpenAI API", desc: "OpenAI API 키로 앱 안에서 바로 실행", link: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Claude API", desc: "Anthropic API 키로 앱 안에서 바로 실행", link: "https://console.anthropic.com/settings/keys" },
  { id: "ollama", label: "Ollama 로컬", desc: "내 컴퓨터의 로컬 LLM 서버에 연결", link: "https://ollama.com/download" },
];

const PROVIDER_GUIDE: Partial<Record<AiProvider, {
  keyName: string;
  placeholder: string;
  modelHint: string;
  steps: string[];
}>> = {
  gemini: {
    keyName: "Gemini API 키",
    placeholder: "AIza...",
    modelHint: "모델을 잘 모르면 기본값을 그대로 두세요. 나중에 Google AI Studio에서 쓰는 모델명으로 바꿀 수 있습니다.",
    steps: [
      "Google AI Studio에서 새 API 키를 만듭니다.",
      "복사한 키를 아래 입력칸에 붙여넣습니다.",
      "연결 테스트를 눌러 '연결 완료'가 뜨는지 확인합니다.",
    ],
  },
  openai: {
    keyName: "OpenAI API 키",
    placeholder: "sk-...",
    modelHint: "모델을 잘 모르면 기본값을 그대로 두세요. OpenAI 콘솔에서 사용하는 모델명으로 바꿀 수 있습니다.",
    steps: [
      "OpenAI API Keys 화면에서 새 secret key를 만듭니다.",
      "복사한 키를 아래 입력칸에 붙여넣습니다.",
      "연결 테스트를 눌러 '연결 완료'가 뜨는지 확인합니다.",
    ],
  },
  anthropic: {
    keyName: "Claude API 키",
    placeholder: "sk-ant-...",
    modelHint: "모델을 잘 모르면 기본값을 그대로 두세요. Anthropic Console에서 사용하는 Claude 모델명으로 바꿀 수 있습니다.",
    steps: [
      "Anthropic Console에서 새 API 키를 만듭니다.",
      "복사한 키를 아래 입력칸에 붙여넣습니다.",
      "연결 테스트를 눌러 '연결 완료'가 뜨는지 확인합니다.",
    ],
  },
  ollama: {
    keyName: "Ollama URL",
    placeholder: "http://localhost:11434",
    modelHint: "모델명은 내 컴퓨터에 내려받은 Ollama 모델 이름과 같아야 합니다.",
    steps: [
      "Ollama를 설치하고 원하는 모델을 내려받습니다.",
      "Ollama 앱 또는 서버를 켠 뒤 URL을 확인합니다.",
      "연결 테스트를 눌러 브라우저에서 접근되는지 확인합니다.",
    ],
  },
};

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
  const guide = PROVIDER_GUIDE[provider];
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
      prompt: "Dearie 연결 테스트입니다. 한국어로 '연결 완료'라고 짧게 답해주세요.",
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
  const executionReady = provider === "bridge" || directReady;
  const aiAgentSummary = executionReady
    ? `${selected.label} 방식으로 준비됐어요. 실제 추천은 각 작업 화면에서 적용 전 확인 단계까지 거치게 됩니다.`
    : `${selected.label} 방식은 아직 연결 정보가 부족해요. 키, 모델, URL을 확인한 뒤 저장과 테스트를 진행하면 됩니다.`;

  return (
    <div className="page pt-8 pb-10 space-y-9">
      <div>
        <div className="eyebrow-gold mb-2">도움 기능</div>
        <h1 className="h-page">{koBreak("AI 연결")}</h1>
      </div>

      <p className="text-[15px] text-soft leading-[1.85] border-b border-hair pb-5">
        AI는 선택 사항입니다. 연결하면 준비 순서, 청첩장 문안, 후보 비교처럼 막히기 쉬운 일을 앱 안에서 정리할 수 있어요.
      </p>

      <ProcessAgentPanel
        title={executionReady ? "AI 실행 방식을 정리했어요" : "AI 연결값을 기다리는 중"}
        summary={aiAgentSummary}
        mood={executionReady ? "ready" : "watching"}
        metrics={[
          { label: "방식", value: selected.label, hint: provider === "bridge" ? "복붙" : "앱 안 실행" },
          { label: "연결", value: executionReady ? "가능" : "대기", tone: executionReady ? "normal" : "warn" },
          { label: "상태", value: status === "saved" ? "저장" : status === "ok" ? "성공" : status === "fail" ? "확인" : "대기", tone: status === "fail" ? "warn" : "normal" },
        ]}
        steps={[
          { label: "비용과 개인정보 기준에 맞는 방식 선택", detail: "복붙 모드는 가장 보수적이고, 개인 API 키는 사용량 비용이 본인 계정에 청구됩니다.", done: !!provider },
          { label: "앱 안 실행 방식이면 연결값 확인", detail: "키는 이 기기에만 저장되고 WeddingData 백업에는 들어가지 않습니다.", done: executionReady },
          { label: "민감 정보는 프롬프트에서 빼기", detail: "계좌, 복구 링크, 하객 연락처는 꼭 필요할 때만 최소한으로 다룹니다.", done: true },
        ]}
        actions={[
          { label: "복붙 모드로 전환 →", onClick: () => chooseProvider("bridge"), tone: provider === "bridge" ? "quiet" : "primary" },
          { label: "Dearie AI 선택 →", onClick: () => chooseProvider("managed") },
          { label: "설정 저장 →", onClick: save },
          ...(provider !== "bridge" ? [{ label: "연결 테스트 →", onClick: test, disabled: !directReady || status === "testing" }] : []),
        ]}
      />

      <section className="border-y border-hair py-4 space-y-3">
        <div className="eyebrow-gold">AI로 보내기 전</div>
        <p className="text-[12px] text-soft leading-relaxed">
          AI에는 선택한 작업의 프롬프트만 보냅니다. 그래도 이름, 전화번호, 계좌, 하객별 축의금,
          복구 링크처럼 꼭 필요하지 않은 정보는 지우거나 익명화한 뒤 쓰는 편이 안전합니다.
        </p>
        <div className="grid grid-cols-1 gap-2 text-[11.5px] text-soft leading-relaxed">
          <p><b className="text-ink">복붙 모드</b> · 전송 버튼이 없고, 사용자가 직접 외부 챗봇에 붙여넣습니다.</p>
          <p><b className="text-ink">본인 API 키</b> · 키는 이 기기에만 저장되고, 요청은 선택한 provider로 직접 갑니다.</p>
          <p><b className="text-ink">Dearie AI</b> · 운영자 서버가 프롬프트를 받아 Anthropic으로 전달합니다.</p>
        </div>
      </section>

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
                별도 API 키 없이 Dearie AI를 사용할 수 있습니다. 프롬프트는 Dearie 서버와 Anthropic을 거치며,
                결과는 확인한 뒤 직접 반영합니다. 하객 명단·계좌·복구 링크처럼 민감한 내용은 요청 전에 빼주세요.
              </p>
            </div>
          ) : (
            <div>
              <div className="eyebrow mb-2">가장 간단해요</div>
              <p className="text-[13px] text-soft leading-relaxed">
                특별한 키나 설정 없이 바로 시작할 수 있어요. 먼저 무료로 짧게 써 보고,
                더 자주 쓰고 싶으면{" "}
                <a href="/login" className="underline underline-offset-4 text-ink">로그인</a>하면 넉넉하게 이어집니다.
              </p>
            </div>
          )}
        </section>
      )}

      {provider !== "bridge" && provider !== "managed" && (
        <section className="space-y-5">
          {guide && (
            <div className="border border-hair bg-cream/30 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="eyebrow-gold mb-2">처음 연결</div>
                  <h2 className="font-serif text-[19px] text-ink leading-tight">
                    키를 만들고 붙여넣으면 끝입니다.
                  </h2>
                </div>
                {selected.link && (
                  <a
                    href={selected.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-3 py-2 text-[11px] whitespace-nowrap"
                  >
                    키 만들기 ↗
                  </a>
                )}
              </div>
              <ol className="space-y-2">
                {guide.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-[12.5px] text-soft leading-relaxed">
                    <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center border border-hair text-[10px] text-ink tabular-nums">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <label className="label">모델</label>
            <input
              className="input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={defaultModel(provider)}
            />
            <p className="text-[11px] text-soft mt-2 leading-relaxed">
              {guide?.modelHint ?? "모델 이름은 선택한 AI 서비스에서 사용할 수 있는 이름으로 바꿀 수 있어요."}
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
              <label className="label">{guide?.keyName ?? "API 키"}</label>
              <input
                className="input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={guide?.placeholder ?? "sk-... / AIza..."}
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
                키 만드는 곳 열기 ↗
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
        <div className="space-y-2 text-[12px] text-soft leading-relaxed">
          <p>
            AI 응답은 자동으로 덮어쓰지 않고 적용 전 확인합니다. 복붙 모드와 본인 API 키 방식은 운영자가 프롬프트를 받지 않지만,
            Dearie AI는 오남용 방지와 실행을 위해 서버를 거칩니다. 공개 청첩장 링크와 복구 링크는 AI 프롬프트에 넣지 마세요.
          </p>
          <p>
            개인 API 키는 이 브라우저에만 저장됩니다. 공용 PC에서는 쓰지 말고, 키가 노출됐다고 느끼면 각 AI 콘솔에서 바로 폐기하세요.
          </p>
        </div>
      </section>
    </div>
  );
}
