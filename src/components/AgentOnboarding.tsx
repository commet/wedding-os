import { useEffect, useMemo, useState } from "react";
import type { WeddingData } from "../lib/schema";
import { koBreak } from "../lib/typography";
import {
  AGENT_PRIORITIES,
  type AgentAnswers,
  type AgentPriority,
} from "../lib/agentProfile";

type Props = {
  data: WeddingData;
  hostedReady: boolean;
  onComplete: (answers: AgentAnswers) => void;
  onAdvanced: () => void;
  onDemo: () => void;
};

const QUESTION_STEPS = 5;
const FINAL_STEP = 6;

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
  // 마지막 화면 payoff — 답변으로 만들어질 준비판에서 "지금 같이 볼 첫 결정"을 미리 계산.
  const [firstDecision, setFirstDecision] = useState("");

  useEffect(() => {
    if (step !== FINAL_STEP) return;
    let cancelled = false;
    void (async () => {
      try {
        const [{ buildAgentDraft }, { decisionMap }] = await Promise.all([
          import("../lib/agentDraft"),
          import("../lib/derived"),
        ]);
        const preview = decisionMap(buildAgentDraft(data, answers));
        if (!cancelled) setFirstDecision(preview.primary?.title ?? "");
      } catch {
        if (!cancelled) setFirstDecision("");
      }
    })();
    return () => { cancelled = true; };
  }, [step, data, answers]);

  const progress = step === 0 ? 0 : step >= FINAL_STEP ? 100 : Math.round((step / QUESTION_STEPS) * 100);
  const showQuestionProgress = step > 0 && step < FINAL_STEP;
  const progressText = step >= FINAL_STEP
    ? "시작 준비 완료"
    : step === QUESTION_STEPS
      ? "마지막 질문"
      : `${QUESTION_STEPS - step}개 질문 남음`;
  const selectedPriority = AGENT_PRIORITIES[answers.priority];
  const coupleLabel = [answers.groomName.trim(), answers.brideName.trim()].filter(Boolean).join(" · ") || "두 분";
  const summary = useMemo(() => [
    { label: "예식 날짜", value: answers.date || "아직 미정" },
    { label: "함께 보기", value: answers.storage === "hosted" ? "둘이 같이 (링크)" : "혼자 먼저 (이 기기)" },
    { label: "신랑", value: answers.groomName.trim() || "나중에 입력" },
    { label: "신부", value: answers.brideName.trim() || "나중에 입력" },
    { label: "희망 지역", value: answers.region.trim() || "지역을 열어두고 찾기" },
  ], [answers]);
  const generatedPreview = useMemo(() => {
    const items = [
      { label: "오늘의 첫 단계", value: selectedPriority.title },
      { label: "체크리스트", value: "상황별 핵심 할 일 4개를 맨 위에 추가" },
      { label: "예산표", value: "먼저 빠뜨리기 쉬운 항목만 선별" },
    ];
    if (answers.priority === "venue") {
      items.push({
        label: "예식장",
        value: answers.region.trim() ? `${answers.region.trim()} 기준 후보와 상담 질문` : "후보 비교 기준과 상담 질문",
      });
    }
    if (answers.priority === "trip") {
      items.push({ label: "신혼여행", value: "처음 비교하기 좋은 지역 3곳" });
    }
    return items;
  }, [answers.priority, answers.region, selectedPriority.title]);

  const next = () => setStep((value) => Math.min(FINAL_STEP, value + 1));
  const back = () => setStep((value) => Math.max(0, value - 1));
  const set = <K extends keyof AgentAnswers>(key: K, value: AgentAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="agent-canvas min-h-screen max-w-app mx-auto overflow-hidden">
      <div className="px-6 pt-7 pb-5 flex items-center justify-between gap-4">
        <div>
          <div className="font-serif text-[17px] leading-none text-ink">Dearie</div>
          <div className="mt-1 text-[11px] font-medium text-soft">질문 5개로 시작</div>
        </div>
        {showQuestionProgress && (
          <button onClick={back} className="min-h-11 px-2 text-[13px] text-soft underline underline-offset-2">이전</button>
        )}
      </div>

      <div className="h-px bg-hair mx-6">
        <div className="h-px bg-gold transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      {step > 0 && (
        <div className="flex items-center justify-between gap-3 px-6 pt-3 text-[12px] text-soft">
          <span className="eyebrow">{progressText}</span>
          <span className="font-serif text-[13px] tabular-nums">
            {showQuestionProgress ? (
              <>
                {String(step).padStart(2, "0")} <span className="text-soft/70">/ {String(QUESTION_STEPS).padStart(2, "0")}</span>
              </>
            ) : "완료"}
          </span>
        </div>
      )}

      <main className="px-6 pt-7 pb-12">
        {step === 0 && (
          <AgentStep
            eyebrow="처음 시작"
            title="질문 5개로 오늘 할 일부터 정할게요."
            message="이름, 날짜, 지역처럼 이미 아는 것만 고르면 됩니다. 모르는 건 비워두고 바로 시작할 수 있어요."
          >
            <div className="mt-7 grid grid-cols-3 divide-x divide-hair border-y border-hair py-4 text-center text-[13px] leading-[1.6] text-soft">
              <span className="px-2">약 2분</span>
              <span className="px-2">나중에 수정</span>
              <span className="px-2">자동 저장</span>
            </div>
            <AgentPrimary onClick={next}>질문 5개 시작하기</AgentPrimary>
            <div className="mt-5 flex justify-center gap-6">
              <button onClick={onDemo} className="min-h-11 text-[13px] text-soft underline underline-offset-2">완성 예시 보기</button>
              <button onClick={onAdvanced} className="min-h-11 text-[13px] text-soft underline underline-offset-2">직접 운영하기 (개발자)</button>
            </div>
          </AgentStep>
        )}

        {step === 1 && (
          <AgentStep eyebrow="01 · 예식일" title={koBreak("예식 날짜가 정해졌나요?")} message="날짜를 알면 취소 기한·잔금처럼 늦어지면 손해인 일부터 먼저 챙겨드릴 수 있어요.">
            <div className="mt-9 border-y border-hair px-1 py-4">
              <label className="label">예식 날짜</label>
              <input type="date" className="input" value={answers.date} onChange={(event) => set("date", event.target.value)} />
            </div>
            <AgentPrimary onClick={next}>{answers.date ? "이 날짜 기준으로 볼게요" : "아직 미정이에요"}</AgentPrimary>
          </AgentStep>
        )}

        {step === 2 && (
          <AgentStep eyebrow="02 · 함께" title={koBreak("혼자 정리할까요, 둘이 같이 볼까요?")} message="둘이 같이 보면 링크 하나로 같은 준비판을 함께 편집해요. 혼자 시작해도 나중에 언제든 바꿀 수 있어요.">
            <div className="mt-9 border-y border-hair divide-y divide-hair">
              <StorageChoice
                active={answers.storage === "hosted"}
                onClick={() => { set("storage", hostedReady ? "hosted" : "local"); next(); }}
                title="둘이 같이 볼게요"
                desc={hostedReady
                  ? "질문이 끝나면 배우자에게 보낼 링크를 만들어요. 내용은 안전하게 보호돼요."
                  : "지금은 이 기기에서 시작하고, 함께 보기가 열리면 기록을 그대로 옮겨드려요."}
                badge="링크 공유"
              />
              <StorageChoice
                active={answers.storage === "local"}
                onClick={() => { set("storage", "local"); next(); }}
                title="혼자 먼저 정리할게요"
                desc="가입 없이 이 기기에서 바로 시작해요. 나중에 둘이 같이 보기로 바꿀 수 있어요."
                badge="바로 시작"
              />
            </div>
          </AgentStep>
        )}

        {step === 3 && (
          <AgentStep eyebrow="03 · 두 사람" title={koBreak("두 분의 성함을 알려주세요.")} message="신랑·신부를 구분해 청첩장 기본 정보에도 같이 써요.">
            <div className="mt-9 space-y-5">
              <AgentInput label="신랑 성함" value={answers.groomName} onChange={(value) => set("groomName", value)} placeholder="예: 김민준" autoComplete="name" />
              <AgentInput label="신부 성함" value={answers.brideName} onChange={(value) => set("brideName", value)} placeholder="예: 이서연" autoComplete="name" />
            </div>
            <AgentPrimary onClick={next}>계속</AgentPrimary>
          </AgentStep>
        )}

        {step === 4 && (
          <AgentStep eyebrow="04 · 지역" title={koBreak("어느 지역을 생각하고 계세요?")} message="정확한 예식장이 아니라, 대략의 지역만 알려주세요. 후보를 좁힐 기준으로 쓸게요.">
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

        {step === 5 && (
          <AgentStep eyebrow="05 · 우선순위" title={koBreak("가장 먼저 함께 풀고 싶은 일은요?")} message="한 가지만 골라주세요. 그 일부터 시작하기 좋게 순서를 잡아드릴게요.">
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

        {step === 6 && (
          <AgentStep
            eyebrow="시작 순서"
            title={koBreak(coupleLabel === "두 분" ? "두 분을 위한 시작 순서예요." : `${coupleLabel} 두 분을 위한 시작 순서예요.`)}
            message={<>한꺼번에 다 하지 않아도 돼요. <span className="whitespace-nowrap">첫 번째 일부터 함께 이어가요.</span></>}
          >
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
            <div className="mt-7 border-y border-hair py-4">
              <div className="eyebrow mb-3">처음 열 화면</div>
              <div className="divide-y divide-hair">
                {generatedPreview.map((item) => (
                  <div key={item.label} className="grid grid-cols-[5.5rem_1fr] gap-3 py-3 text-[12.5px] leading-relaxed">
                    <span className="text-soft">{item.label}</span>
                    <span className="text-ink break-keep">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {(firstDecision || !answers.date) && (
              <div className="mt-7 border-y border-hair py-4">
                <div className="eyebrow-gold mb-1.5">지금 같이 볼 첫 결정</div>
                <p className="font-serif text-[16px] leading-[1.5] text-ink break-keep">
                  {firstDecision || "예식 날짜부터 같이 정해요"}
                </p>
              </div>
            )}
            <AgentPrimary onClick={() => onComplete(answers)}>
              {answers.storage === "hosted" ? "링크 만들고 둘이 같이 보기" : "이 결정부터 열기"}
            </AgentPrimary>
            <button onClick={back} className="block mx-auto mt-4 min-h-11 text-[13px] text-soft underline underline-offset-2">답변 다시 보기</button>
          </AgentStep>
        )}
      </main>
    </div>
  );
}

function AgentStep({ eyebrow, title, message, children }: { eyebrow: string; title: React.ReactNode; message?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="page-enter">
      <div className="eyebrow-gold mb-3">{eyebrow}</div>
      <h1 className="font-serif text-[26px] leading-[1.38] text-ink break-keep [text-wrap:balance] max-w-[19rem]">{title}</h1>
      {message && <p className="mt-3 max-w-[20rem] text-[15px] leading-[1.75] text-soft">{message}</p>}
      {children}
    </section>
  );
}

function AgentPrimary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="mt-7 min-h-[52px] w-full rounded-none bg-ink px-6 text-[13px] font-medium tracking-[0.04em] text-paper transition hover:opacity-90 active:opacity-85">
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
        <span className={`border-b pb-0.5 text-[11.5px] uppercase tracking-[0.12em] ${active ? "border-gold text-gold" : "border-hair text-soft"}`}>{badge}</span>
      </span>
      <span className="mt-2 block text-[13px] leading-[1.7] text-soft">{desc}</span>
    </button>
  );
}
