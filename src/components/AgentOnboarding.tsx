import { useMemo, useState } from "react";
import type { WeddingData } from "../lib/schema";
import { koBreak } from "../lib/typography";
import { AgentIdentity } from "./AgentIdentity";
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

const REGIONS = [
  "서울",
  "경기·인천",
  "강원",
  "대전·충청·세종",
  "대구·경북",
  "부산·울산·경남",
  "광주·전라",
  "제주",
  "기타 (직접 입력)",
];

export default function AgentOnboarding({ data, hostedReady, onComplete, onAdvanced, onDemo }: Props) {
  const [step, setStep] = useState(0);
  const existingInvitation = data.preferences.isDemo ? undefined : data.invitation;
  const savedPriority = data.preferences.isDemo ? undefined : data.ai?.profile?.priority;
  const savedRegion = data.preferences.isDemo ? "" : data.ai?.profile?.region ?? "";
  const [answers, setAnswers] = useState<AgentAnswers>({
    groomName: existingInvitation?.groomName ?? "",
    brideName: existingInvitation?.brideName ?? "",
    date: existingInvitation?.date ?? "",
    region: savedRegion,
    priority: savedPriority ?? "venue",
    storage: "local",
  });
  const [otherOpen, setOtherOpen] = useState(Boolean(savedRegion) && !REGIONS.includes(savedRegion));

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
      <div className="px-6 pt-7 pb-5 flex items-center justify-between gap-4">
        <AgentIdentity compact />
        {step > 0 && step < TOTAL_STEPS && (
          <button onClick={back} className="min-h-11 px-2 text-[13px] text-soft underline underline-offset-2">이전</button>
        )}
      </div>

      <div className="h-px bg-hair mx-6">
        <div className="h-px bg-gold transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      {step > 0 && step < TOTAL_STEPS && (
        <div className="px-6 pt-3 text-right font-serif text-[13px] text-soft">
          {String(step).padStart(2, "0")} <span className="text-soft/70">/ 05</span>
        </div>
      )}

      <main className="px-6 pt-9 pb-12">
        {step === 0 && (
          <AgentStep
            eyebrow="처음 만났어요"
            title="막막한 준비를 두 분의 순서로 바꿔드릴게요."
            message="기본 정보 몇 가지만 알려주시면, 두 분 상황에 맞춰 먼저 볼 일과 그다음 순서를 정리해 드릴게요. 모르는 건 비워두셔도 괜찮아요."
          >
            <div className="mt-9 grid grid-cols-3 divide-x divide-hair border-y border-hair py-5 text-center text-[13px] leading-[1.7] text-soft">
              <span className="px-2">약 2분</span>
              <span className="px-2">나중에 수정</span>
              <span className="px-2">자동 저장</span>
            </div>
            <AgentPrimary onClick={next}>에이전트와 시작하기</AgentPrimary>
            <div className="mt-5 flex justify-center gap-6">
              <button onClick={onDemo} className="min-h-11 text-[13px] text-soft underline underline-offset-2">완성 예시 보기</button>
              <button onClick={onAdvanced} className="min-h-11 text-[13px] text-soft underline underline-offset-2">고급 저장 설정</button>
            </div>
          </AgentStep>
        )}

        {step === 1 && (
          <AgentStep eyebrow="01 · 두 사람" title={koBreak("두 분의 성함을 알려주세요.")} message="신랑·신부를 구분해 청첩장 기본 정보에도 그대로 반영할게요.">
            <div className="mt-9 space-y-5">
              <AgentInput label="신랑 성함" value={answers.groomName} onChange={(value) => set("groomName", value)} placeholder="예: 김민준" autoComplete="name" />
              <AgentInput label="신부 성함" value={answers.brideName} onChange={(value) => set("brideName", value)} placeholder="예: 이서연" autoComplete="name" />
            </div>
            <AgentPrimary onClick={next}>계속</AgentPrimary>
          </AgentStep>
        )}

        {step === 2 && (
          <AgentStep eyebrow="02 · 일정" title={koBreak("예식 날짜가 정해졌나요?")} message="날짜를 알면 체크리스트 마감일을 자동으로 맞춰드려요.">
            <div className="mt-9 border-y border-hair px-1 py-4">
              <label className="label">예식 날짜</label>
              <input type="date" className="input" value={answers.date} onChange={(event) => set("date", event.target.value)} />
            </div>
            <AgentPrimary onClick={next}>{answers.date ? "이 날짜로 일정 만들기" : "아직 미정이에요"}</AgentPrimary>
          </AgentStep>
        )}

        {step === 3 && (
          <AgentStep eyebrow="03 · 지역" title={koBreak("어느 지역을 생각하고 계세요?")} message="정확한 예식장이 아니라, 대략의 지역만 알려주세요. 후보를 좁힐 기준으로 쓸게요.">
            <div className="mt-9 flex flex-wrap gap-2">
              {REGIONS.map((region) => {
                const isOther = region.startsWith("기타");
                const selected = isOther ? otherOpen : (!otherOpen && answers.region === region);
                return (
                  <button
                    key={region}
                    aria-pressed={selected}
                    onClick={() => {
                      if (isOther) { setOtherOpen(true); set("region", ""); }
                      else { setOtherOpen(false); set("region", region); next(); }
                    }}
                    className={`min-h-11 px-4 py-2.5 text-[13px] border transition ${selected ? "border-ink text-ink" : "border-hair text-soft"}`}
                  >
                    {region}
                  </button>
                );
              })}
            </div>
            {otherOpen && (
              <div className="mt-5">
                <AgentInput label="지역 직접 입력" value={answers.region} onChange={(value) => set("region", value)} placeholder="예: 서울 강남구" />
                <AgentPrimary onClick={next}>이 지역으로 보기</AgentPrimary>
              </div>
            )}
            <button onClick={() => { setOtherOpen(false); set("region", ""); next(); }} className="mt-5 block min-h-11 text-[13px] text-soft underline underline-offset-2">지역은 나중에 정할게요</button>
          </AgentStep>
        )}

        {step === 4 && (
          <AgentStep eyebrow="04 · 우선순위" title={koBreak("가장 먼저 함께 풀고 싶은 일은요?")} message="한 가지만 골라주세요. 그 일부터 시작하기 좋게 순서를 잡아드릴게요.">
            <div className="mt-9">
              {(Object.entries(AGENT_PRIORITIES) as Array<[AgentPriority, typeof selectedPriority]>).map(([id, item], index) => (
                <button key={id} onClick={() => { set("priority", id); next(); }} className="flex min-h-[68px] w-full items-start justify-between gap-4 border-b border-hair py-4 text-left transition last:border-b-0 hover:border-gold">
                  <span className="flex items-start gap-3">
                    <span className="w-5 shrink-0 font-serif text-[13px] leading-[1.6] text-gold">{index + 1}</span>
                    <span>
                      <span className="block text-[15px] leading-[1.4] font-medium text-ink">{item.label}</span>
                      <span className="mt-1 block text-[13px] leading-[1.7] text-soft">{item.reason}</span>
                    </span>
                  </span>
                  <span className="self-center text-[13px] text-gold">→</span>
                </button>
              ))}
            </div>
          </AgentStep>
        )}

        {step === 5 && (
          <AgentStep eyebrow="05 · 보관" title={koBreak("준비 내용을 어디에 보관할까요?")} message="지금 바로 시작할 수도, 로그인해 두 사람이 함께 쓸 수도 있어요.">
            <div className="mt-9 border-y border-hair divide-y divide-hair">
              <StorageChoice active={answers.storage === "local"} onClick={() => { set("storage", "local"); next(); }} title="우선 이 기기에서 시작" desc="가입 없이 바로 열고, 나중에 둘이 쓰기로 바꿀 수 있어요." badge="가장 빠름" />
              <StorageChoice active={answers.storage === "hosted"} onClick={() => { if (hostedReady) { set("storage", "hosted"); next(); } }} title="처음부터 둘이 같이" desc={hostedReady ? "로그인 후 암호화된 준비판을 함께 편집해요." : "현재 배포에서 로그인 연결이 필요해요."} badge="추천" disabled={!hostedReady} />
            </div>
            <button onClick={onAdvanced} className="mt-5 min-h-11 text-[13px] text-soft underline underline-offset-2">내 저장소로 직접 운영</button>
          </AgentStep>
        )}

        {step === 6 && (
          <AgentStep eyebrow="첫 브리핑" title={koBreak(`${coupleLabel} 두 분을 위한 시작 순서예요.`)} message="한꺼번에 다 하지 않아도 돼요. 첫 번째 일부터 함께 이어가요.">
            <div className="mt-9 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-hair px-1 py-6">
              {summary.map((item) => (
                <div key={item.label}>
                  <span className="block mb-1.5 text-[11px] uppercase tracking-[0.2em] font-medium text-soft">{item.label}</span>
                  <span className="text-[14px] leading-[1.5] text-ink">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 agent-briefing">
              <div className="agent-briefing-number">01</div>
              <div className="min-w-0">
                <div className="eyebrow-gold mb-2">가장 먼저</div>
                <h2 className="font-serif text-[19px] leading-[1.5] text-ink">{selectedPriority.title}</h2>
                <p className="mt-2 text-[13px] leading-[1.8] text-soft">{selectedPriority.reason}</p>
              </div>
            </div>
            <AgentPrimary onClick={() => onComplete(answers)}>
              {answers.storage === "hosted" ? "준비판 열고 함께 연결하기" : "이 순서로 준비 시작하기"}
            </AgentPrimary>
            <button onClick={back} className="block mx-auto mt-4 min-h-11 text-[13px] text-soft underline underline-offset-2">답변 다시 보기</button>
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
      <h1 className="font-serif text-[26px] leading-[1.5] tracking-[-0.005em] text-ink break-keep [text-wrap:balance] max-w-[19rem]">{title}</h1>
      {message && <p className="mt-4 max-w-[20rem] text-[15px] leading-[1.85] text-soft">{message}</p>}
      {children}
    </section>
  );
}

function AgentPrimary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="mt-9 min-h-[52px] w-full rounded-none bg-ink px-6 text-[13px] font-medium tracking-[0.04em] text-paper transition hover:opacity-90 active:opacity-85">
      {children} →
    </button>
  );
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
    <button disabled={disabled} aria-pressed={active} aria-disabled={disabled} onClick={onClick} className="w-full px-1 py-5 text-left transition disabled:opacity-45">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium text-ink">{title}</span>
        <span className={`border-b pb-0.5 text-[10px] uppercase tracking-[0.16em] ${active ? "border-gold text-gold" : "border-hair text-soft"}`}>{badge}</span>
      </span>
      <span className="mt-2 block text-[13px] leading-[1.7] text-soft">{desc}</span>
    </button>
  );
}
