import { useMemo, useState } from "react";
import type { WeddingData } from "../lib/schema";
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

const TOTAL_STEPS = 7;

export default function AgentOnboarding({ data, hostedReady, onComplete, onAdvanced, onDemo }: Props) {
  const [step, setStep] = useState(0);
  const existingInvitation = data.preferences.isDemo ? undefined : data.invitation;
  const [answers, setAnswers] = useState<AgentAnswers>({
    firstName: existingInvitation?.groomName ?? "",
    secondName: existingInvitation?.brideName ?? "",
    date: existingInvitation?.date ?? "",
    venue: existingInvitation?.venue ?? "",
    budgetKRW: data.preferences.isDemo ? undefined : data.ai?.profile?.budgetKRW,
    priority: data.preferences.isDemo ? "venue" : data.ai?.profile?.priority ?? "venue",
    storage: "local",
  });

  const progress = Math.round((step / TOTAL_STEPS) * 100);
  const selectedPriority = AGENT_PRIORITIES[answers.priority];
  const coupleLabel = [answers.firstName.trim(), answers.secondName.trim()].filter(Boolean).join(" · ") || "두 분";
  const summary = useMemo(() => [
    { label: "두 사람", value: coupleLabel },
    { label: "예식", value: answers.date || "아직 미정" },
    { label: "장소", value: answers.venue.trim() || "후보부터 찾기" },
    { label: "예산", value: answers.budgetKRW ? `${Math.round(answers.budgetKRW / 10_000_000)}천만원 안팎` : "함께 정하기" },
    { label: "첫 우선순위", value: selectedPriority.label },
  ], [answers, coupleLabel, selectedPriority.label]);

  const next = () => setStep((value) => Math.min(TOTAL_STEPS, value + 1));
  const back = () => setStep((value) => Math.max(0, value - 1));
  const set = <K extends keyof AgentAnswers>(key: K, value: AgentAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="agent-canvas min-h-screen max-w-app mx-auto overflow-hidden">
      <div className="px-6 pt-7 pb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AgentMark small />
          <div>
            <div className="text-[13px] font-semibold tracking-wide text-ink">Wedding OS Agent</div>
            <div className="text-[10.5px] text-sage mt-0.5">준비를 함께 정리하는 중</div>
          </div>
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
            <p className="text-[13.5px] text-soft leading-[1.75]">
              여섯 번만 짧게 물어볼게요. 답을 바탕으로 오늘 할 일, 예산의 큰 틀, 체크리스트와 청첩장 기본 정보를 한 번에 구성합니다.
            </p>
            <div className="mt-7 rounded-[22px] border border-white/80 bg-white/65 p-5 shadow-[0_18px_45px_rgba(104,82,50,0.08)]">
              <div className="flex items-center gap-3 mb-4">
                <AgentMark small />
                <p className="text-[12.5px] text-ink leading-relaxed">완벽한 답은 필요 없어요.<br />모르는 건 모른다고 해도 됩니다.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-soft">
                <span className="rounded-full bg-cream px-2 py-2">약 2분</span>
                <span className="rounded-full bg-cream px-2 py-2">나중에 수정</span>
                <span className="rounded-full bg-cream px-2 py-2">자동 저장</span>
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
          <AgentStep eyebrow="01 · 두 사람" title={<>어떻게<br /><em>불러드릴까요?</em></>} message="이름은 홈과 청첩장 초안에만 먼저 넣어둘게요.">
            <div className="space-y-4 mt-7">
              <AgentInput label="한 분 이름" value={answers.firstName} onChange={(value) => set("firstName", value)} placeholder="예: 민준" />
              <AgentInput label="다른 한 분 이름" value={answers.secondName} onChange={(value) => set("secondName", value)} placeholder="예: 서연" />
            </div>
            <AgentPrimary onClick={next}>계속</AgentPrimary>
          </AgentStep>
        )}

        {step === 2 && (
          <AgentStep eyebrow="02 · 일정" title={<>예식 날짜가<br /><em>정해졌나요?</em></>} message="날짜를 알면 모든 체크리스트 마감일을 자동으로 맞출 수 있어요.">
            <div className="mt-7 rounded-[20px] border border-hair bg-white/65 px-5 py-3">
              <label className="label">예식 날짜</label>
              <input type="date" className="input" value={answers.date} onChange={(event) => set("date", event.target.value)} />
            </div>
            <AgentPrimary onClick={next}>{answers.date ? "이 날짜로 일정 만들기" : "아직 미정이에요"}</AgentPrimary>
          </AgentStep>
        )}

        {step === 3 && (
          <AgentStep eyebrow="03 · 장소" title={<>마음에 둔 장소가<br /><em>있나요?</em></>} message="계약 전 후보여도 괜찮아요. 비워두면 예식장 찾기를 먼저 제안할게요.">
            <div className="mt-7 rounded-[20px] border border-hair bg-white/65 px-5 py-3">
              <AgentInput label="예식장 또는 지역" value={answers.venue} onChange={(value) => set("venue", value)} placeholder="예: 강남, 그랜드하우스" />
            </div>
            <AgentPrimary onClick={next}>{answers.venue.trim() ? "장소 반영하기" : "후보부터 찾아볼게요"}</AgentPrimary>
          </AgentStep>
        )}

        {step === 4 && (
          <AgentStep eyebrow="04 · 비용" title={<>두 분이 생각한<br /><em>예산의 범위</em>가 있나요?</>} message="정답이 아니라 첫 배분안을 만들기 위한 기준이에요. 신혼집 비용은 제외합니다.">
            <ChoiceGrid>
              <Choice active={answers.budgetKRW === 30_000_000} onClick={() => { set("budgetKRW", 30_000_000); next(); }} title="3천만원 안팎" desc="간결하게 준비" />
              <Choice active={answers.budgetKRW === 50_000_000} onClick={() => { set("budgetKRW", 50_000_000); next(); }} title="5천만원 안팎" desc="균형 있게 준비" />
              <Choice active={answers.budgetKRW === 80_000_000} onClick={() => { set("budgetKRW", 80_000_000); next(); }} title="8천만원 이상" desc="선택 폭을 넓게" />
              <Choice active={!answers.budgetKRW} onClick={() => { set("budgetKRW", undefined); next(); }} title="아직 모르겠어요" desc="예산 정하기부터" />
            </ChoiceGrid>
          </AgentStep>
        )}

        {step === 5 && (
          <AgentStep eyebrow="05 · 우선순위" title={<>지금 가장 마음이<br /><em>쓰이는 한 가지</em>는요?</>} message="선택한 일부터 홈 맨 위에 두고, 나머지는 차례대로 정리할게요.">
            <div className="mt-7 space-y-3">
              {(Object.entries(AGENT_PRIORITIES) as Array<[AgentPriority, typeof selectedPriority]>).map(([id, item]) => (
                <button key={id} onClick={() => { set("priority", id); next(); }} className="w-full min-h-[64px] rounded-[18px] border border-hair bg-white/70 px-4 py-3 text-left flex items-center justify-between gap-4 hover:border-gold transition">
                  <span>
                    <span className="block text-[14px] font-medium text-ink">{item.label}</span>
                    <span className="block text-[11.5px] text-soft mt-1">{item.reason}</span>
                  </span>
                  <span className="text-gold">→</span>
                </button>
              ))}
            </div>
          </AgentStep>
        )}

        {step === 6 && (
          <AgentStep eyebrow="06 · 저장" title={<>이 준비판을<br /><em>어떻게 이어갈까요?</em></>} message="어떤 방식을 골라도 먼저 안전하게 이 기기에 초안을 만들어요.">
            <div className="mt-7 space-y-3">
              <StorageChoice active={answers.storage === "local"} onClick={() => { set("storage", "local"); next(); }} title="우선 이 기기에서 시작" desc="가입 없이 바로 열고, 나중에 둘이 쓰기로 바꿀 수 있어요." badge="가장 빠름" />
              <StorageChoice active={answers.storage === "hosted"} onClick={() => { if (hostedReady) { set("storage", "hosted"); next(); } }} title="처음부터 둘이 같이" desc={hostedReady ? "로그인 후 암호화된 준비판을 함께 편집해요." : "현재 배포에서 로그인 연결이 필요해요."} badge="추천" disabled={!hostedReady} />
            </div>
            <button onClick={onAdvanced} className="mt-5 min-h-11 text-[12px] text-soft underline underline-offset-4">내 저장소로 직접 운영</button>
          </AgentStep>
        )}

        {step === 7 && (
          <AgentStep eyebrow="초안 준비 완료" title={<>{coupleLabel}의<br /><em>첫 준비판</em>을 만들었어요.</>} message={`먼저 “${selectedPriority.title}”부터 시작하도록 정리했습니다.`}>
            <div className="mt-7 rounded-[24px] border border-white bg-white/75 p-5 shadow-[0_20px_55px_rgba(104,82,50,0.10)]">
              <div className="space-y-3">
                {summary.map((item) => (
                  <div key={item.label} className="flex items-baseline justify-between gap-4 border-b border-hair/70 pb-3 last:border-0 last:pb-0">
                    <span className="text-[11px] text-soft">{item.label}</span>
                    <span className="text-[13px] text-ink text-right">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-[16px] bg-[#F3EEE5] p-4">
                <div className="text-[10.5px] tracking-[0.18em] uppercase text-gold mb-2">Agent's first move</div>
                <div className="font-serif text-[17px] text-ink">{selectedPriority.title}</div>
                <p className="text-[11.5px] text-soft leading-relaxed mt-2">{selectedPriority.reason}</p>
              </div>
            </div>
            <AgentPrimary onClick={() => onComplete(answers)}>
              {answers.storage === "hosted" ? "초안 열고 둘이 연결하기" : "내 준비판 열기"}
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
      <h1 className="font-serif text-[2.05rem] leading-[1.17] tracking-tight text-ink [&_em]:font-normal [&_em]:text-gold">{title}</h1>
      {message && (
        <div className="mt-6 flex items-start gap-3">
          <AgentMark small />
          <p className="flex-1 rounded-[4px_18px_18px_18px] bg-white/75 px-4 py-3 text-[12.5px] text-soft leading-relaxed shadow-[0_10px_30px_rgba(104,82,50,0.06)]">{message}</p>
        </div>
      )}
      {children}
    </section>
  );
}

function AgentMark({ small = false }: { small?: boolean }) {
  return <span aria-hidden="true" className={`${small ? "w-9 h-9 text-[12px]" : "w-12 h-12 text-sm"} flex-shrink-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,#DCC49A,#9B7443_70%)] text-white flex items-center justify-center font-serif shadow-[0_8px_22px_rgba(155,116,67,0.22)]`}>W</span>;
}

function AgentPrimary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="mt-8 w-full min-h-[54px] rounded-full bg-ink px-6 text-[13px] font-medium tracking-wide text-paper shadow-[0_14px_35px_rgba(27,26,23,0.16)] active:scale-[0.99] transition">{children} →</button>;
}

function AgentInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={80} />
    </label>
  );
}

function ChoiceGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 mt-7">{children}</div>;
}

function Choice({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button onClick={onClick} className={`min-h-[104px] rounded-[20px] border p-4 text-left transition ${active ? "border-gold bg-white shadow-[0_12px_30px_rgba(104,82,50,0.08)]" : "border-hair bg-white/60"}`}>
      <span className="block font-serif text-[16px] text-ink">{title}</span>
      <span className="block text-[11.5px] text-soft mt-2 leading-relaxed">{desc}</span>
    </button>
  );
}

function StorageChoice({ active, onClick, title, desc, badge, disabled = false }: { active: boolean; onClick: () => void; title: string; desc: string; badge: string; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`w-full min-h-[92px] rounded-[20px] border p-4 text-left transition disabled:opacity-45 ${active ? "border-gold bg-white" : "border-hair bg-white/60"}`}>
      <span className="flex items-center justify-between gap-3">
        <span className="font-serif text-[16px] text-ink">{title}</span>
        <span className="rounded-full bg-cream px-2.5 py-1 text-[10px] text-gold">{badge}</span>
      </span>
      <span className="block text-[11.5px] text-soft mt-2 leading-relaxed">{desc}</span>
    </button>
  );
}
