import { Link } from "react-router-dom";
import type { WeddingData, WeddingUpdate } from "../lib/schema";
import { useEffect, useMemo, useState } from "react";
import { recalcDueDates } from "../data/checklistTemplate";
import { daysUntilISODate } from "../lib/date";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import { type BridgePrompt, weddingPlanStarterPrompt } from "../lib/chatbotBridge";
import { AGENT_PRIORITIES, type AgentPriority } from "../lib/agentProfile";
import { applyAgentAnswer, nextAgentQuestion, type AgentLoopQuestion } from "../lib/agentLoop";
import { applyStarterPlan, normalizeTargetPath, type StarterResult } from "../lib/agentStarter";
import {
  budgetTotals, formatKRW, upcomingBalances, upcomingEvents, todayISO,
  weddingPhase, rsvpReadiness, mealBudgetCheck, contractedVenue, planningHeadcount, venueCapacityFit,
  planningStatusReport, PLANNING_STATE_LABEL,
  decisionMap, type DecisionItem, type DecisionStage,
  type PlanningSectionStatus, type PlanningStatusState,
} from "../lib/derived";
import { collectLossDeadlines, lossDdayLabel, type LossDeadline } from "../lib/lossDeadlines";
import { buildDecisionPacket } from "../lib/decisionPackets";
import { DecisionLoopActions } from "../components/DecisionLoopPanel";
import { koBreak } from "../lib/typography";

type Props = { data: WeddingData; update: (patch: WeddingUpdate) => void; };

type FocusItem = {
  to: string;
  title: string;
  desc: string;
  tag: string;
  actionLabel?: string;
  preparedFacts?: string[];
  missingInputs?: string[];
  riskLabel?: string;
  stage?: DecisionStage;
};

type DashboardApp = PlanningSectionStatus & {
  icon: AppIconName;
  group: "start" | "decide" | "invite" | "day";
};

type AppIconName =
  | "basics"
  | "venues"
  | "sdm"
  | "snap"
  | "rings"
  | "trip"
  | "invitation"
  | "guests"
  | "budget"
  | "checklist"
  | "ceremony"
  | "video"
  | "share";

type DashboardGroup = {
  key: DashboardApp["group"];
  title: string;
  helper: string;
  apps: DashboardApp[];
};

export default function Dashboard({ data, update }: Props) {
  const [aiPrompt, setAiPrompt] = useState<BridgePrompt | null>(null);
  const [aiMessage, setAiMessage] = useState("");
  const [starterResult, setStarterResult] = useState<StarterResult | null>(null);
  const [agentChoosing, setAgentChoosing] = useState(false);
  const dday = useMemo(() => {
    return daysUntilISODate(data.invitation.date);
  }, [data.invitation.date]);

  const agentOnboarded = !!data.ai?.profile?.onboardedAt;
  const empty = !agentOnboarded && !data.invitation.groomName && !data.invitation.brideName && !data.invitation.date;

  const venueCount = (data.venues ?? []).length;
  const budgetCount = (data.budget ?? []).length;
  const invitationReadyCount = [
    data.invitation.groomName,
    data.invitation.brideName,
    data.invitation.date,
    data.invitation.venue,
    data.invitation.greeting,
  ].filter(Boolean).length;
  // 영역 간 위험 신호 — 서브페이지를 안 열어도 홈에서 한눈에.
  const { overCount: overBudgetCount, overSum: overBudgetSum } = budgetTotals(data);
  const balanceDueSoon = upcomingBalances(data).filter((b) => b.daysLeft <= 14)[0]; // 가장 임박한 잔금
  const timeline = upcomingEvents(data); // 예식·마감·잔금·답사를 한 시간축으로

  // 에이전트 '상황 읽기' — D-day 국면 + 부부 데이터에서 직접 추론한 신호들(읽기 전용, AI 비용 없음).
  const phase = weddingPhase(dday);
  const contractVenueForFit = contractedVenue(data);
  const headcountForFit = planningHeadcount(data);
  const capFit = venueCapacityFit(contractVenueForFit, headcountForFit);
  const rsvp = rsvpReadiness(data);
  const mealCheck = mealBudgetCheck(data);
  // 회신 독려는 충분히 보냈는데 응답이 더딜 때만 — 거짓 경보 방지.
  const rsvpNudge = rsvp.invited >= 20 && rsvp.rate !== null && rsvp.rate < 50 && (rsvp.daysSinceFirstInvite ?? 0) >= 14;
  const capitalRisk = capFit === "over" || capFit === "under";
  const agentQuestion = useMemo(() => nextAgentQuestion(data), [data]);
  const statusReport = useMemo(() => planningStatusReport(data), [data]);
  const decisions = useMemo(() => decisionMap(data), [data]);
  // 미루면 손해 — 무료취소·가계약·보증인원·잔금·결제 마감을 임박순으로 (상위 3건만 홈에).
  const lossDeadlines = useMemo(() => collectLossDeadlines(data, todayISO()).slice(0, 3), [data]);
  const readiness = statusReport.sections;
  const nextStatus = statusReport.nextSections[0];

  const setWeddingDate = (date: string) => {
    update((prev: WeddingData) => {
      const next = {
        ...prev,
        invitation: { ...prev.invitation, date },
      };
      return {
        ...next,
        checklist: recalcDueDates(next.checklist, date),
      };
    });
  };

  const skipFirstMinute = () => {
    update((prev: WeddingData) => ({
      ...prev,
      ai: {
        ...(prev.ai ?? {}),
        profile: {
          ...(prev.ai?.profile ?? {}),
          onboardedAt: new Date().toISOString(),
        },
      },
    }));
  };

  const openAiStarter = () => {
    setAiMessage("");
    setStarterResult(null);
    setAiPrompt(weddingPlanStarterPrompt(data));
  };

  const chooseAgentPriority = (priority: AgentPriority) => {
    const choice = AGENT_PRIORITIES[priority];
    update((prev: WeddingData) => ({
      ...prev,
      ai: {
        ...(prev.ai ?? {}),
        profile: { ...(prev.ai?.profile ?? {}), priority },
        today: [
          { title: choice.title, reason: choice.reason, targetPath: choice.targetPath },
          ...(prev.ai?.today ?? []).filter((item) => item.targetPath !== choice.targetPath),
        ].slice(0, 3),
        updatedAt: new Date().toISOString(),
      },
    }));
    setAgentChoosing(false);
  };

  const answerAgentQuestion = (question: AgentLoopQuestion, value: string | string[]) => {
    const result = applyAgentAnswer(data, question, value);
    update(() => result.next);
    setAiMessage(result.message);
  };

  const applyAiStarter = (parsed: any) => {
    let applied = 0;
    let hasSummary = false;
    let starter: StarterResult | null = null;
    update((prev: WeddingData) => {
      const draft = applyStarterPlan(prev, parsed);
      applied = draft.appliedCount;
      hasSummary = draft.hasSummary;
      starter = draft.result;
      return draft.next;
    });

    const added = applied + (hasSummary ? 1 : 0);
    setStarterResult(applied > 0 ? starter : null);
    setAiMessage(added > 0 ? "시작점을 만들었어요. 아래에서 바로 이어갈 수 있습니다." : "답변은 받았지만 적용할 항목이 없었어요.");
  };

  const focusItems = useMemo<FocusItem[]>(() => {
    const items: FocusItem[] = decisions.items.map(decisionToFocusItem);
    if (nextStatus) {
      items.push({
        to: nextStatus.to,
        title: nextStatus.nextAction,
        desc: `${nextStatus.label} · ${nextStatus.detail}`,
        tag: PLANNING_STATE_LABEL[nextStatus.state],
      });
    }
    if (!data.invitation.date) {
      items.push({
        to: "/invitation",
        title: "기본 정보 정리하기",
        desc: "정해진 이름·날짜·장소만 넣어두면 다음 준비가 더 정확해집니다.",
        tag: "기본 정보",
      });
    }
    if (!data.invitation.venue && venueCount === 0) {
      items.push({
        to: "/venues",
        title: "예식장 후보 정리하기",
        desc: "지역과 식수 기준으로 비교할 후보를 먼저 담아두세요.",
        tag: "큰 예약",
      });
    }
    if (budgetCount === 0) {
      items.push({
        to: "/budget",
        title: "예산표 시작하기",
        desc: "기본 비용표를 만들어두면 견적을 받을 때 빠진 항목과 초과 금액을 바로 확인할 수 있어요.",
        tag: "돈 관리",
      });
    }
    if (data.rings.length === 0) {
      items.push({
        to: "/rings",
        title: "반지 후보 풀 만들기",
        desc: "브랜드·예산·소재 기준으로 볼 만한 후보를 빠르게 좁힙니다.",
        tag: "후보 정리",
      });
    }
    if (data.honeymoon.regions.length + data.flights.length + data.hotels.length === 0) {
      items.push({
        to: "/trip",
        title: "신혼여행 지역 비교하기",
        desc: "기간과 예산을 기준으로 여행 후보와 일정 초안을 만들 수 있어요.",
        tag: "지역 비교",
      });
    }
    if (invitationReadyCount < 4) {
      items.push({
        to: "/invitation",
        title: "청첩장 기본 정보 채우기",
        desc: "이름·날짜·장소만 넣어도 공유 가능한 미리보기가 생깁니다.",
        tag: "공유 준비",
      });
    }
    if (data.preferences.mode === "supabase") {
      items.push({
        to: "/share",
        title: "같이 편집할 사람 초대하기",
        desc: "하객용 청첩장 링크와 다른 편집자용 링크를 공유 센터에서 보냅니다.",
        tag: "함께 편집",
      });
    }
    if (data.preferences.mode === "local") {
      items.push({
        to: "/start-hosted",
        title: "링크로 같이 쓰기",
        desc: "혼자 정리한 내용은 그대로 두고, 배우자와 함께 편집할 수 있는 링크를 만듭니다.",
        tag: "함께 편집",
      });
    }
    const aiToday = (data.ai?.today ?? [])
      .map((item) => ({
        to: normalizeTargetPath(item.targetPath) ?? "/checklist",
        title: item.title,
        desc: item.reason || "지금 입력된 정보를 기준으로 이어서 볼 일입니다.",
        tag: "Dearie 제안",
      }))
      .filter((item) => item.title)
      .slice(0, 2);
    items.push(...aiToday);
    // 순서는 decisionMap의 stage·risk·score 정렬을 그대로 신뢰한다 — UI 편의 재배치 금지.
    return dedupeFocusItems(items).slice(0, 4);
  }, [
    decisions.items,
    data.ai?.today,
    budgetCount,
    data.honeymoon.regions.length,
    data.flights.length,
    data.hotels.length,
    data.invitation.date,
    data.invitation.venue,
    nextStatus,
    data.preferences.mode,
    data.rings.length,
    invitationReadyCount,
    venueCount,
  ]);

  const primaryFocus = focusItems[0] ?? {
    to: "/checklist",
    title: "오늘 할 일 확인하기",
    desc: "완료한 일과 다음 일정을 가볍게 확인해보세요.",
    tag: "다음 단계",
  };
  const coupleDisplay = [data.invitation.groomName, data.invitation.brideName].filter(Boolean).join(" · ") || "우리";
  // 최상단 카드가 decisionMap 출신이면 DecisionItem 원본을 유지 — 서브페이지와 같은
  // payoff(같이 볼 요약·카톡 복사·캘린더 담기)가 홈에서 바로 실행되게.
  const primaryDecision = decisions.items.find(
    (item) => item.to === primaryFocus.to && item.title === primaryFocus.title,
  );
  const secondaryFocusItems = focusItems.slice(1, 4);
  const dashboardGroups = useMemo(() => buildDashboardGroups(readiness), [readiness]);
  const briefing = primaryFocus.desc || data.ai?.starterSummary || phase.focus;
  const alertItems = [
    capitalRisk ? { to: capFit === "under" ? "/venues" : "/guests", label: "예상 인원과 예식장 조건 확인" } : null,
    mealCheck ? { to: "/budget", label: "식대 예산 다시 확인" } : null,
    balanceDueSoon ? { to: balanceDueSoon.targetPath, label: `${balanceDueSoon.name} 잔금 ${balanceDueSoon.daysLeft <= 0 ? "오늘 확인" : `D-${balanceDueSoon.daysLeft}`}` } : null,
    overBudgetCount > 0 ? { to: "/budget", label: `예산 초과 ${overBudgetCount}건 · +${formatKRW(overBudgetSum)}` } : null,
    rsvpNudge ? { to: "/guests", label: `회신 ${rsvp.rate}% · 미응답 ${rsvp.pending}명` } : null,
  ].filter((item): item is { to: string; label: string } => !!item && item.to !== primaryFocus.to).slice(0, 1);

  return (
    <div className="pb-10">
      {empty ? (
        <section className="page pt-6 pb-7">
          <div className="panel px-5 py-6">
            <div className="eyebrow mb-3">처음 1분</div>
            <h1 className="display-sm mb-3">{koBreak("예식 날짜가 정해졌나요?")}</h1>
            <p className="mb-5 text-[15px] leading-relaxed text-soft">
              날짜를 넣으면 준비 일정을 맞춰드려요. 아직 미정이면 건너뛰고 바로 할 일부터 볼 수 있습니다.
            </p>
            <label className="mb-4 block">
              <span className="label">예식 날짜</span>
              <input
                type="date"
                className="input bg-paper"
                value={data.invitation.date}
                onChange={(e) => setWeddingDate(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/invitation" className="btn-primary flex min-h-11 items-center justify-center px-3 text-center text-[12px]">
                이름·장소 입력
              </Link>
              <button type="button" onClick={skipFirstMinute} className="btn-secondary flex min-h-11 items-center justify-center px-3 text-center text-[12px]">
                준비판 먼저 보기
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section id="today-focus" className="page pt-5 pb-4 scroll-mt-20">
            <MasterPlannerPanel
              coupleDisplay={coupleDisplay}
              dday={dday}
              phaseLabel={phase.label}
              briefing={briefing}
              primaryFocus={primaryFocus}
              primaryDecision={primaryDecision}
              data={data}
              alertItems={alertItems}
              aiMessage={aiMessage}
              starterResult={starterResult}
              agentChoosing={agentChoosing}
              onTalk={openAiStarter}
              onChoosePriority={() => setAgentChoosing(true)}
              onCancelChoosing={() => setAgentChoosing(false)}
              onPriority={chooseAgentPriority}
            />
          </section>

          {lossDeadlines.length > 0 && <LossDeadlineStrip items={lossDeadlines} />}

          <section className="page py-3">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <div className="home-kicker">준비 도구</div>
                <h2 className="section-title">{koBreak("필요한 화면으로 바로 가기")}</h2>
              </div>
              <span className="text-right text-[11.5px] leading-relaxed text-soft">
                진행 {statusReport.counts.active + statusReport.counts.attention} · 완료 {statusReport.counts.done}
              </span>
            </div>
            <AppLauncher groups={dashboardGroups} />
            {(agentQuestion || secondaryFocusItems.length > 0) && (
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                {agentQuestion && <MasterQuestionCard question={agentQuestion} onAnswer={answerAgentQuestion} />}
                {secondaryFocusItems.length > 0 && <FocusQueue items={secondaryFocusItems} />}
              </div>
            )}
          </section>

          <section className="page py-4">
            <details>
              <summary className="quiet-disclosure">
                <span>
                  <span className="section-title block">전체 준비 흐름</span>
                  <span className="mt-1 block text-[12.5px] text-soft">진행률과 남은 일은 필요할 때 펼쳐 봅니다.</span>
                </span>
                <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
              </summary>
              <div className="pt-4">
                <StatusBoard allSections={readiness} />
              </div>
            </details>
          </section>

          {timeline.length > 0 && (
            <>
              <div className="hairline" />
              <UpcomingTimeline items={timeline.slice(0, 4)} />
            </>
          )}
        </>
      )}

      <ChatbotBridgeModal
        open={!!aiPrompt}
        onClose={() => setAiPrompt(null)}
        prompt={aiPrompt}
        onApply={applyAiStarter}
      />
    </div>
  );
}

function MasterPlannerPanel({
  coupleDisplay,
  dday,
  phaseLabel,
  briefing,
  primaryFocus,
  primaryDecision,
  data,
  alertItems,
  aiMessage,
  starterResult,
  agentChoosing,
  onTalk,
  onChoosePriority,
  onCancelChoosing,
  onPriority,
}: {
  coupleDisplay: string;
  dday: number | null;
  phaseLabel: string;
  briefing: string;
  primaryFocus: FocusItem;
  primaryDecision?: DecisionItem;
  data: WeddingData;
  alertItems: { to: string; label: string }[];
  aiMessage: string;
  starterResult: StarterResult | null;
  agentChoosing: boolean;
  onTalk: () => void;
  onChoosePriority: () => void;
  onCancelChoosing: () => void;
  onPriority: (priority: AgentPriority) => void;
}) {
  // 이 결정을 끝내면 생기는 것 — 서브페이지 결정 카드와 같은 요약을 홈에서도.
  const primaryOutcome = useMemo(
    () => (primaryDecision ? buildDecisionPacket(primaryDecision, data).outcome : null),
    [primaryDecision, data],
  );
  const ddayLabel =
    dday === null ? "D-day 미정" :
    dday > 0 ? `D-${dday}` :
    dday === 0 ? "오늘 예식" :
    `예식 후 ${Math.abs(dday)}일`;
  const friendlyPhaseLabel = phaseLabel === "디테일" ? "세부 준비" : phaseLabel;

  return (
    <div className="home-hero">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.54fr)] lg:items-start">
        <div className="min-w-0">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="home-kicker">오늘 먼저</div>
              <div className="mt-1 truncate text-[13px] font-medium text-soft">{coupleDisplay}의 준비판</div>
            </div>
            <div className="text-right">
              <div className="home-dday">{ddayLabel}</div>
              <div className="mt-1 text-[11.5px] font-medium text-soft">{friendlyPhaseLabel}</div>
            </div>
          </div>

          <h1 className="home-title">
            {koBreak(primaryFocus.title)}
          </h1>

          <p className="mt-3 max-w-[40rem] text-[14px] leading-[1.65] text-soft break-keep md:text-[15px]">
            {briefing}
          </p>

          <DecisionFacts item={primaryFocus} />
        </div>

        <div className="home-actions lg:self-start">
          {aiMessage && (
            <p className="mb-3 border-l border-gold pl-3 text-[12.5px] leading-relaxed text-soft">
              {aiMessage}
            </p>
          )}
          {starterResult && <StarterResultPanel result={starterResult} />}

          {agentChoosing ? (
            <PriorityChooser onPriority={onPriority} onCancel={onCancelChoosing} />
          ) : (
            <>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-[12px] font-semibold text-ink">바로 이어가기</span>
                <button type="button" onClick={onChoosePriority} className="min-h-9 text-[12px] text-soft underline underline-offset-4 hover:text-ink">
                  다른 일 보기
                </button>
              </div>
              <Link
                to={primaryFocus.to}
                className="focus-primary-action"
              >
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-semibold text-ink/55">{primaryFocus.tag}</span>
                  <span className="mt-0.5 block text-[15px] font-semibold leading-snug">{primaryFocus.actionLabel ?? "이 결정부터 보기"}</span>
                </span>
                <span aria-hidden="true" className="text-gold">→</span>
              </Link>

              {primaryOutcome && (
                <p className="mt-2 border-l border-gold/50 pl-3 text-[12px] leading-relaxed text-ink/80 break-keep">
                  {primaryOutcome}
                </p>
              )}
              {primaryDecision && (
                <DecisionLoopActions data={data} item={primaryDecision} compact includeOpenLink={false} />
              )}

              <button
                type="button"
                data-testid="dashboard-ai-starter"
                onClick={onTalk}
                className="focus-secondary-action mt-2 text-[13px]"
              >
                <span>상황 정리 부탁하기</span>
                <span aria-hidden="true" className="text-gold">→</span>
              </button>

              {alertItems.length > 0 && (
                <div className="mt-3 divide-y divide-line overflow-hidden rounded-[8px] border border-line bg-vellum/80">
                  {alertItems.map((item) => (
                    <Link key={`${item.to}-${item.label}`} to={item.to} className="row-tap flex min-h-10 items-center justify-between gap-3 px-3 py-1.5">
                      <span className="text-[12.5px] font-medium text-ink break-keep">{item.label}</span>
                      <span aria-hidden="true" className="text-gold">→</span>
                    </Link>
                  ))}
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 미루면 손해 스트립 — 기한이 지나면 되돌릴 수 없는 날짜를 홈에서 여러 건 그대로.
function LossDeadlineStrip({ items }: { items: LossDeadline[] }) {
  return (
    <section className="page py-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="eyebrow-gold">미루면 손해</div>
        <span className="text-[11px] text-soft">기한이 지나면 되돌리기 어려운 날짜예요</span>
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-[8px] border border-line bg-vellum/80">
        {items.map((item) => (
          <Link key={item.id} to={item.targetPath} className="row-tap flex min-h-12 items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className={`shrink-0 text-[12px] font-semibold tabular-nums ${item.severity === "high" ? "text-gold" : "text-ink"}`}>
                  {lossDdayLabel(item.daysLeft)}
                </span>
                <span className="truncate text-[12.5px] font-medium text-ink">
                  {item.name} · {item.label}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-soft">
                {item.lossHint}
                {item.amountKRW ? ` · ${formatKRW(item.amountKRW)}` : ""}
              </span>
            </span>
            <span aria-hidden="true" className="shrink-0 text-gold">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const DECISION_STAGE_LABEL: Record<DecisionStage, string> = {
  now: "지금 같이 볼 결정",
  soon: "곧 같이 볼 결정",
  later: "나중에 볼 결정",
};

function decisionToFocusItem(item: DecisionItem): FocusItem {
  return {
    to: item.to,
    title: item.title,
    desc: item.whyNow,
    tag: item.risk?.label ?? DECISION_STAGE_LABEL[item.stage],
    actionLabel: item.nextAction,
    preparedFacts: item.preparedFacts,
    missingInputs: item.missingInputs,
    riskLabel: item.risk?.label,
    stage: item.stage,
  };
}

function DecisionFacts({ item }: { item: FocusItem }) {
  const useful = (value: string) => !/(아직|없어요|적어요|미정)$/.test(value.trim());
  const prepared = (item.preparedFacts ?? []).filter(useful).slice(0, 3);
  const missing = (item.missingInputs ?? []).slice(0, 3);
  if (prepared.length === 0 && missing.length === 0) return null;

  return (
    // 모바일에서도 판단 재료가 보여야 한다 — 480px에서는 세로 스택, 넓어지면 2열.
    <div className="mt-4 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
      <DecisionFactLine label="이미 있는 정보" values={prepared} />
      <DecisionFactLine label="확인하면 좋은 것" values={missing} accent />
    </div>
  );
}

function DecisionFactLine({ label, values, accent = false }: { label: string; values: string[]; accent?: boolean }) {
  if (values.length === 0) return null;
  return (
    <div className="min-w-0 rounded-[8px] border border-line bg-vellum/70 px-3 py-2.5">
      <div className={`text-[11px] font-semibold ${accent ? "text-gold" : "text-soft"}`}>{label}</div>
      <p className="mt-1 min-w-0 text-[12px] leading-relaxed text-ink/82 break-keep">
        {values.join(" · ")}
      </p>
    </div>
  );
}

function PriorityChooser({ onPriority, onCancel }: { onPriority: (priority: AgentPriority) => void; onCancel: () => void }) {
  return (
    <div className="page-enter">
      <div className="eyebrow-gold mb-2">우선순위 바꾸기</div>
      <h2 className="font-serif text-[22px] leading-snug text-ink break-keep">{koBreak("지금 더 마음이 가는 일은 무엇인가요?")}</h2>
      <div className="mt-3 divide-y divide-hair border-y border-hair">
        {(Object.entries(AGENT_PRIORITIES) as Array<[AgentPriority, (typeof AGENT_PRIORITIES)[AgentPriority]]>).map(([id, item]) => (
          <button key={id} onClick={() => onPriority(id)} className="row-tap flex min-h-[58px] w-full items-center justify-between gap-3 py-3 text-left">
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">{item.label}</span>
              <span className="mt-0.5 block truncate text-[11.5px] text-soft">{item.reason}</span>
            </span>
            <span aria-hidden="true" className="text-gold">→</span>
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="mt-2 min-h-10 text-[12px] text-soft underline underline-offset-4">지금 제안으로 돌아가기</button>
    </div>
  );
}

function MasterQuestionCard({
  question,
  onAnswer,
}: {
  question: AgentLoopQuestion;
  onAnswer: (question: AgentLoopQuestion, value: string | string[]) => void;
}) {
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const hasDraft = draftValues.length > 0;

  useEffect(() => {
    setDraftValues([]);
  }, [question.id]);

  const toggleDraft = (value: string) => {
    setDraftValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const applyDraft = () => {
    if (!hasDraft) return;
    onAnswer(question, draftValues);
    setDraftValues([]);
  };

  return (
    <div className="agent-panel mt-2">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="eyebrow-gold">{question.eyebrow}</span>
        <span className="text-[11px] text-soft">{question.multiple ? "여러 개 선택 가능" : "답하면 후보가 좁혀져요"}</span>
      </div>
      <h3 className="text-[13.5px] font-semibold leading-snug text-ink break-keep">{question.title}</h3>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-soft break-keep">{question.body}</p>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {question.options.map((option) => {
          const selected = draftValues.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => question.multiple ? toggleDraft(option.value) : onAnswer(question, option.value)}
              className={`row-tap min-h-10 border px-2.5 py-1.5 text-left transition ${
                selected ? "border-gold bg-gold/5 text-ink" : "border-hair text-soft hover:border-gold hover:text-ink"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="block truncate text-[12px] font-semibold text-ink">{option.label}</span>
                {question.multiple && <span className="text-[10.5px] text-soft">{selected ? "선택됨" : "추가"}</span>}
              </span>
              {option.desc && <span className="mt-0.5 block text-[10.5px] leading-relaxed text-soft break-keep">{option.desc}</span>}
            </button>
          );
        })}
      </div>
      {question.multiple && (
        <button
          type="button"
          onClick={applyDraft}
          disabled={!hasDraft}
          className="btn-primary mt-2 min-h-10 w-full text-[12px] disabled:opacity-40"
        >
          선택한 항목 {draftValues.length}개 적용 →
        </button>
      )}
    </div>
  );
}

function FocusQueue({ items }: { items: FocusItem[] }) {
  return (
    <div className="panel-muted">
      <div className="px-3 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="section-title">다음에 볼 일</span>
        <span className="text-[11px] text-soft">{items.length}개</span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {items.map((item) => (
          <Link key={`${item.to}-${item.title}`} to={item.to} className="home-mini-link row-tap min-w-0">
            <span className="block truncate text-[11px] text-soft">{item.tag}</span>
            <span className="mt-0.5 block truncate text-[12.5px] font-semibold text-ink">{item.title}</span>
          </Link>
        ))}
      </div>
      </div>
    </div>
  );
}

function AppLauncher({ groups }: { groups: DashboardGroup[] }) {
  return (
    <div className="home-workspaces">
      {groups.map((group) => (
        <section key={group.key} className="home-workspace">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-semibold leading-tight text-ink">{group.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-soft">{group.helper}</p>
            </div>
            <span className="shrink-0 text-[11px] text-soft tabular-nums">{group.apps.length}개</span>
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {group.apps.map((app) => <AppTile key={app.key} app={app} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function AppTile({ app }: { app: DashboardApp }) {
  const stateTone =
    app.state === "attention" ? "text-gold" :
    app.state === "done" ? "text-sage" :
    app.state === "active" ? "text-ink" :
    "text-soft";

  return (
    <Link
      to={app.to}
      className="home-app-link row-tap"
      aria-label={`${app.label}: ${PLANNING_STATE_LABEL[app.state]}, ${app.percent}%`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-line bg-shell text-ink">
        <span className="scale-[0.82]">
          <AppIcon name={app.icon} />
        </span>
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12.5px] font-semibold text-ink">{app.label}</span>
          <span className={`shrink-0 text-[10.5px] font-semibold ${stateTone}`}>{PLANNING_STATE_LABEL[app.state]}</span>
        </span>
        <span className="mt-0.5 block truncate text-[10.5px] leading-snug text-soft">{app.nextAction}</span>
      </span>
    </Link>
  );
}

function UpcomingTimeline({ items }: { items: ReturnType<typeof upcomingEvents> }) {
  return (
    <section className="page py-6">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div className="eyebrow-gold">다가오는 일정</div>
        <Link to="/checklist" className="inline-flex min-h-10 items-center text-[11px] text-soft underline underline-offset-4 hover:text-ink">전체 일정 →</Link>
      </div>
      <ol className="divide-y divide-hair border-y border-hair">
        {items.map((event, index) => (
          <li key={`${event.kind}-${event.date}-${index}`}>
            <Link to={event.targetPath} className="row-tap grid min-h-[54px] grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5">
              <span className="text-[12px] text-soft tabular-nums">{event.date.slice(5).replace("-", ".")}</span>
              <span className="truncate text-[13px] font-medium text-ink">{event.label}</span>
              <span className={`text-[12px] tabular-nums ${event.daysLeft <= 14 ? "font-semibold text-gold" : "text-soft"}`}>
                {event.daysLeft === 0 ? "오늘" : `D-${event.daysLeft}`}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

const APP_META: Record<string, { icon: AppIconName; group: DashboardApp["group"] }> = {
  basics: { icon: "basics", group: "start" },
  budget: { icon: "budget", group: "start" },
  checklist: { icon: "checklist", group: "start" },
  venues: { icon: "venues", group: "decide" },
  sdm: { icon: "sdm", group: "decide" },
  snap: { icon: "snap", group: "decide" },
  rings: { icon: "rings", group: "decide" },
  trip: { icon: "trip", group: "decide" },
  invitation: { icon: "invitation", group: "invite" },
  guests: { icon: "guests", group: "invite" },
  share: { icon: "share", group: "invite" },
  ceremony: { icon: "ceremony", group: "day" },
  video: { icon: "video", group: "day" },
};

const DASHBOARD_GROUP_META: Record<DashboardApp["group"], { title: string; helper: string }> = {
  start: { title: "기준 잡기", helper: "날짜, 예산, 준비 리듬을 먼저 맞춥니다." },
  decide: { title: "후보 비교", helper: "큰 예약과 취향 후보를 같이 좁힙니다." },
  invite: { title: "초대와 공유", helper: "청첩장, 하객, 함께 편집을 관리합니다." },
  day: { title: "본식 당일", helper: "진행표와 식전 영상을 마지막으로 잠급니다." },
};

function buildDashboardGroups(sections: PlanningSectionStatus[]): DashboardGroup[] {
  const apps = sections.map((section): DashboardApp => {
    const meta = APP_META[section.key] ?? { icon: "basics" as AppIconName, group: "start" as const };
    return { ...section, icon: meta.icon, group: meta.group };
  });
  return (["start", "decide", "invite", "day"] as DashboardApp["group"][])
    .map((key) => ({
      key,
      ...DASHBOARD_GROUP_META[key],
      apps: apps.filter((app) => app.group === key),
    }))
    .filter((group) => group.apps.length > 0);
}

function AppIcon({ name }: { name: AppIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths(name)}
    </svg>
  );
}

function iconPaths(name: AppIconName) {
  switch (name) {
    case "venues":
      return <><path d="M4 20h16" /><path d="M6 20V9l6-4 6 4v11" /><path d="M10 20v-6h4v6" /><path d="M9 10h.01M15 10h.01" /></>;
    case "sdm":
      return <><path d="M6 20h12" /><path d="M8 20l1.5-10h5L16 20" /><path d="M10 10V5h4v5" /><path d="M9.5 5h5" /></>;
    case "snap":
      return <><rect x="4" y="7" width="16" height="12" rx="1" /><path d="M8 7l1.5-2h5L16 7" /><circle cx="12" cy="13" r="3" /></>;
    case "rings":
      return <><circle cx="9" cy="14" r="4" /><circle cx="15" cy="14" r="4" /><path d="M12 8l2-3 2 3" /></>;
    case "trip":
      return <><path d="M4 17l16-10" /><path d="M7 7l3 3" /><path d="M14 14l3 3" /><path d="M5 18l4 1 1-4" /></>;
    case "invitation":
      return <><rect x="4" y="6" width="16" height="12" rx="1" /><path d="M4 8l8 6 8-6" /></>;
    case "guests":
      return <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9" r="2.25" /><path d="M15.5 15.5A4.5 4.5 0 0 1 21 19" /></>;
    case "budget":
      return <><path d="M6 5h12v14H6z" /><path d="M9 9h6" /><path d="M9 13h3" /><path d="M15 13h.01" /><path d="M9 16h3" /><path d="M15 16h.01" /></>;
    case "checklist":
      return <><path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" /><path d="M4 6l1 1 2-2" /><path d="M4 12l1 1 2-2" /><path d="M4 18l1 1 2-2" /></>;
    case "ceremony":
      return <><path d="M12 4v16" /><path d="M7 9h10" /><path d="M8 20h8" /><path d="M6 13l6-9 6 9" /></>;
    case "video":
      return <><rect x="4" y="6" width="12" height="12" rx="1" /><path d="M16 10l4-2v8l-4-2" /><path d="M8 10l4 2-4 2z" /></>;
    case "share":
      return <><circle cx="7" cy="12" r="2.5" /><circle cx="17" cy="6" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="M9.2 10.8l5.6-3.6" /><path d="M9.2 13.2l5.6 3.6" /></>;
    case "basics":
    default:
      return <><path d="M5 6h14" /><path d="M5 12h14" /><path d="M5 18h9" /><path d="M17 18h2" /></>;
  }
}

const STATUS_FLOW_GROUPS: { title: string; helper: string; keys: string[] }[] = [
  { title: "01 시작 기준", helper: "날짜, 예산, 전체 리듬을 먼저 잡아요.", keys: ["basics", "budget", "checklist"] },
  { title: "02 후보 결정", helper: "큰 예약과 취향 후보를 상담 가능한 상태로 좁혀요.", keys: ["venues", "sdm", "snap", "rings", "trip"] },
  { title: "03 초대 관리", helper: "청첩장, 하객, 공유 범위를 이어서 정리해요.", keys: ["invitation", "guests", "share"] },
  { title: "04 본식 당일", helper: "당일 진행표와 식전 영상을 마지막으로 잠가요.", keys: ["ceremony", "video"] },
];

function StatusBoard({
  allSections,
}: {
  allSections: PlanningSectionStatus[];
}) {
  const byKey = new Map(allSections.map((section) => [section.key, section]));
  const groups = STATUS_FLOW_GROUPS
    .map((group) => ({
      ...group,
      sections: group.keys
        .map((key) => byKey.get(key))
        .filter((section): section is PlanningSectionStatus => !!section),
    }))
    .filter((group) => group.sections.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title}>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h3 className="section-title">{group.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed text-soft break-keep">{group.helper}</p>
            </div>
            <span className="eyebrow tabular-nums whitespace-nowrap">{group.sections.length}개</span>
          </div>
          <div className="divide-y divide-hair border-y border-hair">
            {group.sections.map((section) => <StatusRow key={section.key} section={section} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatusRow({ section, compact = false }: { section: PlanningSectionStatus; compact?: boolean }) {
  return (
    <Link
      to={section.to}
      className={`row-tap grid items-center gap-4 py-3 ${compact ? "grid-cols-[minmax(0,1fr)_3rem]" : "min-h-[72px] grid-cols-[minmax(0,1fr)_3.3rem]"}`}
    >
      <span className="min-w-0">
        <span className="mb-1.5 flex items-center justify-between gap-3">
          <span className="eyebrow-gold">{section.label}</span>
          <StatePill state={section.state} />
        </span>
        <span className={`mb-2 block leading-snug text-ink break-keep ${compact ? "text-[14px] font-semibold" : "font-serif text-[16px]"}`}>
          {section.nextAction}
        </span>
        <ProgressLine value={section.percent} subtle />
        <span className="mt-1.5 block truncate text-[13px] text-soft">
          {section.detail}
        </span>
      </span>
      <span className="text-right">
        <span className={`block font-serif leading-none tabular-nums ${compact ? "text-[17px]" : "text-[20px]"} ${section.state === "attention" ? "text-gold" : "text-ink"}`}>
          {section.percent}
        </span>
        <span className="mt-0.5 block text-[11px] text-soft">%</span>
      </span>
    </Link>
  );
}

function StatePill({ state }: { state: PlanningStatusState }) {
  const tone =
    state === "attention"
      ? "text-gold before:bg-gold"
      : state === "done"
        ? "text-sage before:bg-sage"
        : state === "empty"
          ? "text-soft before:bg-mute"
          : "text-ink before:bg-ink";
  return (
    <span className={`inline-flex flex-shrink-0 items-center gap-1.5 text-[11px] font-semibold tracking-eyebrow uppercase ${tone} before:block before:h-1.5 before:w-1.5 before:rotate-45`}>
      {PLANNING_STATE_LABEL[state]}
    </span>
  );
}

function ProgressLine({ value, subtle = false }: { value: number; subtle?: boolean }) {
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return (
    <div className={`h-2 overflow-hidden ${subtle ? "bg-line" : "bg-hair"}`}>
      <div className={`h-full transition-all duration-500 ${subtle ? "bg-gold" : "bg-ink"}`} style={{ width }} />
    </div>
  );
}

function StarterResultPanel({ result }: { result: StarterResult }) {
  const rows = [
    { to: "/checklist", label: "체크리스트", value: result.tasks, unit: "개" },
    { to: "/budget", label: "예산 항목", value: result.budget, unit: "개" },
    { to: "/trip", label: "여행 후보", value: result.regions, unit: "곳" },
    { to: "/checklist", label: "오늘 볼 일", value: result.today, unit: "개" },
  ].filter((row) => row.value > 0);

  return (
    <div className="mb-5 border-y border-hair py-4">
      <div className="grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <Link key={row.label} to={row.to} className="border border-hair px-3 py-3 active:opacity-70 transition">
            <div className="eyebrow mb-2">{row.label}</div>
            <div className="font-serif text-2xl text-ink tabular-nums">
              {row.value}
              <span className="ml-1 text-[12px] text-soft font-sans">{row.unit}</span>
            </div>
          </Link>
        ))}
        {result.greeting && (
          <Link to="/invitation" className="border border-hair px-3 py-3 active:opacity-70 transition">
            <div className="eyebrow mb-2">청첩장 문안</div>
            <div className="font-serif text-[16px] text-ink">초안 적용</div>
          </Link>
        )}
      </div>
    </div>
  );
}

function dedupeFocusItems(items: FocusItem[]): FocusItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.to}|${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
