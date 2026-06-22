import { useMemo, useState } from "react";
import type { WeddingData } from "../lib/schema";
import { AgentIdentity, AgentMark } from "./AgentIdentity";
import {
  AGENT_PRIORITIES,
  type AgentAnswers,
  type AgentPriority,
  type AgentStorage,
} from "../lib/agentDraft";

type Props = {
  data: WeddingData;
  hostedReady: boolean;
  onComplete: (answers: AgentAnswers) => void;
  onAdvanced: () => void;
  onDemo: () => void;
};

const TOTAL_STEPS = 6;

export default function AgentOnboarding({ data, hostedReady, onComplete, onAdvanced, onDemo }: Props) {
  const [step, setStep] = useState(0);
  const existingInvitation = data.preferences.isDemo ? undefined : data.invitation;
  const [answers, setAnswers] = useState<AgentAnswers>({
    groomName: existingInvitation?.groomName ?? "",
    brideName: existingInvitation?.brideName ?? "",
    date: existingInvitation?.date ?? "",
    region: data.preferences.isDemo ? "" : data.ai?.profile?.region ?? "",
    priority: data.preferences.isDemo ? "venue" : data.ai?.profile?.priority ?? "venue",
    storage: "local",
  });

  const progress = Math.round((step / TOTAL_STEPS) * 100);
  const selectedPriority = AGENT_PRIORITIES[answers.priority];
  const coupleLabel = [answers.groomName.trim(), answers.brideName.trim()].filter(Boolean).join(" · ") || "두 분";
  const summary = useMemo(() => [
    { label: "신랑", value: answers.groomName.trim() || "나중에 입력" },
    { label: "신부", value: answers.brideName.trim() || "나중에 입력" },
    { label: "예식 날짜", value: answers.date || "아직 미정" },
    { label: "희망 지역", value: answers.region.trim() || "지역을 열어두고 찾기" },
  ], [answers]);

  const next = () => setStep((value) => Math.min(TOTAL_STEPS, value + 1));
  const back = () => setStep((value) => Math.max(0, value - 1));
  const set = <K extends keyof AgentAnswers>(key: K, value: AgentAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="agent-canvas min-h-screen max-w-app mx-auto overflow-hidden">
      <div className="px-6 pt-7 pb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AgentIdentity compact />
        </div>
        {step > 0 && step < TOTAL_STEPS && (
          <button onClick={back} className="min-h-11 px-2 text-[12px] text-soft underline underline-offset-4">이전</button>
        )}
      </div>

      <div className="h-px bg-hair/70 mx-6">
        <div className="h-px bg-gold transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <main className="px-6 pt-8 pb-12">
        {step === 0 && (
          <AgentStep eyebrow="처음 만났네요" title={<>막막한 준비를<br /><em>두 분의 순서</em>로 바꿔볼게요.</>}>
            <p className="max-w-[21rem] text-[13.5px] leading-[1.85] text-soft">
              몇 가지 기본 정보만 알려주세요. 두 분의 상황에 맞춰 먼저 볼 일과 그다음 순서를 정리해드릴게요.
            </p>
            <div className="mt-8 border-y border-hair py-5">
              <div className="flex items-center gap-3 mb-4">
                <AgentMark compact />
                <p className="text-[12.5px] text-ink leading-relaxed">완벽한 답은 필요 없어요.<br />모르는 건 모른다고 해도 됩니다.</p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-hair text-center text-[11px] leading-relaxed text-soft">
                <span className="px-2 py-1">약 2분</span>
                <span className="px-2 py-1">나중에 수정</span>
                <span className="px-2 py-1">자동 저장</span>
              </div>
            </div>
            <AgentPrimary onClick={next}>Agent와 준비 시작하기</AgentPrimary>
            <div className="mt-5 flex justify-center gap-5">
              <button onClick={onDemo} className="min-h-11 text-[12px] text-soft underline underline-offset-4">완성 예시 보기</button>
              <button onClick={onAdvanced} className="min-h-11 text-[12px] text-soft underline underline-offset-4">고급 저장 설정</button>
            </div>
          </AgentStep>
        )}

        {step === 1 && (
          <AgentStep eyebrow="01 · 두 사람" title={<>두 분을<br /><em>소개해 주세요.</em></>} message="신랑과 신부를 구분해 청첩장 기본 정보에도 정확히 반영할게요.">
            <div className="space-y-4 mt-7">
              <AgentInput label="신랑 성함" value={answers.groomName} onChange={(value) => set("groomName", value)} placeholder="예: 김민준" autoComplete="name" />
              <AgentInput label="신부 성함" value={answers.brideName} onChange={(value) => set("brideName", value)} placeholder="예: 이서연" autoComplete="name" />
            </div>
            <AgentPrimary onClick={next}>계속</AgentPrimary>
          </AgentStep>
        )}

        {step === 2 && (
          <AgentStep eyebrow="02 · 일정" title={<>예식 날짜가<br /><em>정해졌나요?</em></>} message="날짜를 알면 모든 체크리스트 마감일을 자동으로 맞출 수 있어요.">
            <div className="mt-8 border-y border-hair px-1 py-3">
              <label className="label">예식 날짜</label>
              <input type="date" className="input" value={answers.date} onChange={(event) => set("date", event.target.value)} />
            </div>
            <AgentPrimary onClick={next}>{answers.date ? "이 날짜로 일정 만들기" : "아직 미정이에요"}</AgentPrimary>
          </AgentStep>
        )}

        {step === 3 && (
          <AgentStep eyebrow="03 · 지역" title={<>어느 지역에서<br /><em>예식을 생각하세요?</em></>} message="정확한 예식장이 아니라 희망 지역만 알려주세요. 후보를 좁힐 때 기준으로 쓸게요.">
            <div className="mt-8 border-y border-hair px-1 py-3">
              <AgentInput label="희망 지역" value={answers.region} onChange={(value) => set("region", value)} placeholder="예: 서울 강남구" />
            </div>
            <AgentPrimary onClick={next}>{answers.region.trim() ? "이 지역을 기준으로 보기" : "지역은 열어둘게요"}</AgentPrimary>
          </AgentStep>
        )}

        {step === 4 && (
          <AgentStep eyebrow="04 · 지금의 마음" title={<>가장 먼저<br /><em>도움을 받고 싶은 일</em>은요?</>} message="한 가지만 골라주세요. 그 일부터 시작하기 좋게 준비판의 순서를 잡을게요.">
            <div className="mt-7 space-y-3">
              {(Object.entries(AGENT_PRIORITIES) as Array<[AgentPriority, typeof selectedPriority]>).map(([id, item]) => (
                <button key={id} onClick={() => { set("priority", id); next(); }} className="flex min-h-[68px] w-full items-center justify-between gap-4 border-b border-hair px-1 py-3 text-left transition hover:border-gold">
                  <span>
                    <span className="block text-[14px] font-medium text-ink">{item.label}</span>
                    <span className="mt-1 block text-[11.5px] leading-[1.65] text-soft">{item.reason}</span>
                  </span>
                  <span className="text-gold">→</span>
                </button>
              ))}
            </div>
          </AgentStep>
        )}

        {step === 5 && (
          <AgentStep eyebrow="05 · 저장" title={<>두 분의 준비를<br /><em>어디에 보관할까요?</em></>} message="지금 바로 시작할 수도 있고, 로그인해서 두 사람이 함께 쓸 수도 있어요.">
            <div className="mt-7 space-y-3">
              <StorageChoice active={answers.storage === "local"} onClick={() => { set("storage", "local"); next(); }} title="우선 이 기기에서 시작" desc="가입 없이 바로 열고, 나중에 둘이 쓰기로 바꿀 수 있어요." badge="가장 빠름" />
              <StorageChoice active={answers.storage === "hosted"} onClick={() => { if (hostedReady) { set("storage", "hosted"); next(); } }} title="처음부터 둘이 같이" desc={hostedReady ? "로그인 후 암호화된 준비판을 함께 편집해요." : "현재 배포에서 로그인 연결이 필요해요."} badge="추천" disabled={!hostedReady} />
            </div>
            <button onClick={onAdvanced} className="mt-5 min-h-11 text-[12px] text-soft underline underline-offset-4">내 저장소로 직접 운영</button>
          </AgentStep>
        )}

        {step === 6 && (
          <AgentStep eyebrow="두 분의 첫 브리핑" title={<>{coupleLabel}에게 맞춘<br /><em>시작 순서</em>예요.</>} message="한꺼번에 다 하지 않아도 돼요. 첫 번째 일부터 함께 이어가겠습니다.">
            <div className="mt-7 border-y border-hair bg-white/45 px-1 py-5">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                {summary.map((item) => (
                  <div key={item.label}>
                    <span className="eyebrow block mb-1.5">{item.label}</span>
                    <span className="text-[13px] leading-relaxed text-ink">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 agent-briefing">
              <div className="agent-briefing-number">01</div>
              <div>
                <div className="eyebrow-gold mb-2">가장 먼저</div>
                <h2 className="font-serif text-[1.25rem] leading-[1.45] text-ink">{selectedPriority.title}</h2>
                <p className="mt-2 text-[12.5px] leading-[1.75] text-soft">{selectedPriority.reason}</p>
              </div>
            </div>
            <AgentPrimary onClick={() => onComplete(answers)}>
              {answers.storage === "hosted" ? "준비판 열고 함께 연결하기" : "이 순서로 준비 시작하기"}
            </AgentPrimary>
            <button onClick={back} className="block mx-auto mt-4 min-h-11 text-[12px] text-soft underline underline-offset-4">답변 다시 보기</button>
          </AgentStep>
        )}
      </main>
    </div>
  );
}

function AgentStep({ eyebrow, title, message, children }: { eyebrow: string; title: React.ReactNode; message?: string; children: React.ReactNode }) {
  return (
    <section className="page-enter">
      <div className="eyebrow-gold mb-4">{eyebrow}</div>
      <h1 className="font-serif text-[2.05rem] leading-[1.24] tracking-tight text-ink [&_em]:font-normal [&_em]:text-gold">{title}</h1>
      {message && (
        <div className="mt-7 flex items-start gap-3">
          <AgentMark compact />
          <p className="flex-1 border-l border-gold/60 py-1 pl-4 text-[12.5px] leading-[1.75] text-soft">{message}</p>
        </div>
      )}
      {children}
    </section>
  );
}

function AgentPrimary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="mt-8 min-h-[54px] w-full bg-ink px-6 text-[13px] font-medium tracking-wide text-paper shadow-[0_12px_28px_rgba(27,26,23,0.12)] transition active:opacity-85">{children} →</button>;
}

function AgentInput({ label, value, onChange, placeholder, autoComplete }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; autoComplete?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={80} autoComplete={autoComplete} />
    </label>
  );
}

function StorageChoice({ active, onClick, title, desc, badge, disabled = false }: { active: boolean; onClick: () => void; title: string; desc: string; badge: string; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`min-h-[92px] w-full border-y px-1 py-4 text-left transition disabled:opacity-45 ${active ? "border-gold" : "border-hair"}`}>
      <span className="flex items-center justify-between gap-3">
        <span className="font-serif text-[16px] text-ink">{title}</span>
        <span className="border-b border-gold pb-1 text-[10px] text-gold">{badge}</span>
      </span>
      <span className="mt-2 block text-[11.5px] leading-[1.7] text-soft">{desc}</span>
    </button>
  );
}
