import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { useMemo, useState } from "react";
import { recalcDueDates } from "../data/checklistTemplate";
import { daysUntilISODate, parseISODateLocal } from "../lib/date";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import { type BridgePrompt, weddingPlanStarterPrompt } from "../lib/chatbotBridge";
import { AGENT_PRIORITIES, type AgentPriority } from "../lib/agentProfile";
import { applyAgentAnswer, nextAgentQuestion, type AgentLoopQuestion } from "../lib/agentLoop";
import { buildMenuGroups } from "../lib/menu";
import { applyStarterPlan, normalizeTargetPath, type StarterResult } from "../lib/agentStarter";
import {
  budgetTotals, overdueChecklistCount, formatKRW, upcomingBalances, upcomingEvents,
  rsvpReadiness, mealBudgetCheck, contractedVenue, planningHeadcount, venueCapacityFit,
  planningStatusReport, decisionMap, PLANNING_STATE_LABEL,
  type DecisionItem, type DecisionStage, type PlanningSectionStatus, type PlanningStatusState,
} from "../lib/derived";
import { koBreak } from "../lib/typography";

type Props = { data: WeddingData; update: (patch: any) => void; };

type FocusItem = {
  to: string;
  title: string;
  desc: string;
  tag: string;
};

const DECISION_STAGE_LABEL: Record<DecisionStage, string> = {
  now: "지금 결정",
  soon: "곧 결정",
  later: "나중에",
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
  const empty = !agentOnboarded && !data.invitation.groomName && !data.invitation.brideName;

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
  const overdueCount = overdueChecklistCount(data);
  const balanceDueSoon = upcomingBalances(data).filter((b) => b.daysLeft <= 14)[0]; // 가장 임박한 잔금
  const timeline = upcomingEvents(data); // 예식·마감·잔금·답사를 한 시간축으로

  // 에이전트 '상황 읽기' — 부부 데이터에서 직접 추론한 신호들(읽기 전용, AI 비용 없음).
  const contractVenueForFit = contractedVenue(data);
  const headcountForFit = planningHeadcount(data);
  const capFit = venueCapacityFit(contractVenueForFit, headcountForFit);
  const rsvp = rsvpReadiness(data);
  const mealCheck = mealBudgetCheck(data);
  // 회신 독려는 충분히 보냈는데 응답이 더딜 때만 — 거짓 경보 방지.
  const rsvpNudge = rsvp.invited >= 20 && rsvp.rate !== null && rsvp.rate < 50 && (rsvp.daysSinceFirstInvite ?? 0) >= 14;
  const capitalRisk = capFit === "over" || capFit === "under";
  const hasRisk = overdueCount > 0 || overBudgetCount > 0 || !!balanceDueSoon || capitalRisk || rsvpNudge || !!mealCheck;
  const agentQuestion = useMemo(() => nextAgentQuestion(data), [data]);
  const statusReport = useMemo(() => planningStatusReport(data), [data]);
  const decisions = useMemo(() => decisionMap(data), [data]);
  const visibleDecisions = empty ? [] : decisions.items.slice(0, 4);
  const primaryDecision = visibleDecisions[0];
  const readiness = statusReport.sections;
  const readinessPercent = statusReport.overallPercent;
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

  const answerAgentQuestion = (question: AgentLoopQuestion, value: string) => {
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
    setAiMessage(added > 0 ? "시작점을 만들었어요. 아래에서 바로 이어갈 수 있습니다." : "답변은 받았지만 반영할 항목이 없었어요.");
  };

  const focusItems = useMemo<FocusItem[]>(() => {
    const items: FocusItem[] = [];
    const aiToday = (data.ai?.today ?? [])
      .map((item) => ({
        to: normalizeTargetPath(item.targetPath) ?? "/checklist",
        title: item.title,
        desc: item.reason || "AI가 현재 입력된 정보를 보고 먼저 볼 일로 골랐습니다.",
        tag: "AI",
      }))
      .filter((item) => item.title)
      .slice(0, 3);
    items.push(...aiToday);
    if (nextStatus && !(empty && nextStatus.to === "/invitation")) {
      items.push({
        to: nextStatus.to,
        title: nextStatus.nextAction,
        desc: `${nextStatus.label} · ${nextStatus.detail}`,
        tag: PLANNING_STATE_LABEL[nextStatus.state],
      });
    }
    if (!data.invitation.date && !empty) {
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
        desc: "비용 항목을 먼저 펼쳐두면 견적을 받을 때 빠진 항목과 초과 금액을 바로 확인할 수 있어요.",
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
    const deduped = dedupeFocusItems(items);
    // 반지는 중요한 시작 '킥'이지만 첫 번째(01)로는 띄우지 않는다 — 반지 관련 항목은
    // 항상 마지막 네 번째 자리(04)로 내려 고정한다(노출은 유지).
    const nonRings = deduped.filter((i) => i.to !== "/rings");
    let ringItem = deduped.find((i) => i.to === "/rings");
    if (!ringItem && data.rings.length === 0) {
      ringItem = {
        to: "/rings",
        title: "반지 후보 풀 만들기",
        desc: "브랜드·예산·소재 기준으로 볼 만한 후보를 빠르게 좁힙니다.",
        tag: "후보 정리",
      };
    }
    return ringItem ? [...nonRings.slice(0, 3), ringItem] : nonRings.slice(0, 4);
  }, [
    data.ai?.today,
    budgetCount,
    data.honeymoon.regions.length,
    data.flights.length,
    data.hotels.length,
    data.invitation.date,
    data.invitation.venue,
    empty,
    nextStatus,
    data.preferences.mode,
    data.rings.length,
    invitationReadyCount,
    venueCount,
  ]);

  // 전역 메뉴 — AppShell "더보기" 시트와 동일한 단일 소스(lib/menu.ts)를 공유.
  const MENU_GROUPS = buildMenuGroups(data);
  const explicitAgentFocus = focusItems.find((item) => item.tag === "AI");
  const decisionPrimaryForCard = explicitAgentFocus ? undefined : primaryDecision;
  const decisionRows = decisionPrimaryForCard ? visibleDecisions.slice(1, 4) : visibleDecisions.slice(0, 3);
  const primaryFocus = explicitAgentFocus ?? (decisionPrimaryForCard ? {
    to: decisionPrimaryForCard.to,
    title: decisionPrimaryForCard.title,
    desc: decisionPrimaryForCard.whyNow,
    tag: DECISION_STAGE_LABEL[decisionPrimaryForCard.stage],
  } : focusItems[0] ?? {
    to: "/checklist",
    title: "오늘 할 일 확인하기",
    desc: "완료한 일과 다음 일정을 가볍게 확인해보세요.",
    tag: "다음 단계",
  });
  const primaryAction = decisionPrimaryForCard?.nextAction ?? "이 일 시작하기";
  const agentCaption = explicitAgentFocus
    ? "AI가 고른 오늘의 한 가지를 앞에 두었어요."
    : decisionPrimaryForCard
      ? "둘이 같이 보면 좋은 결정을 앞에 모았어요."
      : hasRisk
        ? "먼저 확인할 위험 신호가 있어요."
        : agentQuestion
          ? "답 하나만 고르면 다음 순서가 줄어듭니다."
          : "지금 바로 이어갈 일 하나를 골라두었어요.";
  const coupleDisplay = [data.invitation.groomName, data.invitation.brideName].filter(Boolean).join(" · ") || "우리";

  return (
    <div className="pb-10">
      <section className="page pt-4 pb-4 lg:pt-6 lg:pb-5">
        {empty ? (
          <div className="rounded-[8px] border border-sage/25 bg-sage/10 p-5 shadow-[0_16px_40px_rgba(27,26,23,0.05)]">
            <div className="mb-3 text-[12px] font-semibold text-sage">처음 1분</div>
            <h1 className="font-serif text-[1.85rem] leading-[1.18] tracking-tight text-ink">
              {koBreak("예식 날짜가 정해졌나요?")}
            </h1>
            <p className="mt-3 text-[15px] text-soft leading-relaxed mb-5">
              날짜를 넣으면 준비 일정을 맞춰드려요. 아직 미정이면 건너뛰고 바로 할 일부터 볼 수 있습니다.
            </p>
            <label className="block mb-4">
              <span className="label">예식 날짜</span>
              <input
                type="date"
                className="input bg-paper"
                value={data.invitation.date}
                onChange={(e) => setWeddingDate(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/invitation" className="btn-primary min-h-11 flex items-center justify-center px-3 text-[12.5px] text-center">
                이름·장소 입력
              </Link>
              <a href="#today-focus" className="btn-secondary min-h-11 flex items-center justify-center px-3 text-[12.5px] text-center">
                아직 미정
              </a>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-sage/25 bg-sage/10 shadow-[0_16px_44px_rgba(27,26,23,0.05)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 sm:gap-5 lg:p-6">
              <div className="min-w-0">
                <div className="mb-2 text-[12px] font-semibold text-sage">오늘 같이 볼 준비</div>
                <h1 className="font-serif text-[1.55rem] leading-[1.15] tracking-tight text-ink sm:text-[2.05rem]">
                  {koBreak(coupleDisplay)}
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-soft break-keep">
                  {formatWeddingDate(data.invitation.date) || "날짜 미정"}
                  {data.invitation.time && ` · ${data.invitation.time}`}
                  {data.invitation.venue && ` · ${data.invitation.venue}`}
                </p>
              </div>
              {dday !== null && (
                <div className="inline-flex w-fit items-end gap-2 rounded-[8px] border border-line bg-paper px-3 py-2 sm:block sm:min-w-[8.25rem] sm:px-4 sm:py-3 sm:text-right">
                  <div className="text-[11.5px] font-semibold text-soft">{dday >= 0 ? "예식까지" : "예식 후"}</div>
                  <div className={`font-serif leading-none tabular-nums ${dday === 0 ? "text-[1.3rem] text-gold sm:text-[1.55rem]" : "text-[1.55rem] text-ink sm:text-[1.95rem]"}`}>
                    {dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : `+${Math.abs(dday)}`}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 border-t border-sage/20 bg-paper/65">
              <div className="px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="text-[11.5px] font-medium text-soft">준비도</div>
                <div className="mt-0.5 text-[17px] font-semibold text-ink tabular-nums">{readinessPercent}%</div>
              </div>
              <div className="border-x border-sage/20 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="text-[11.5px] font-medium text-soft">확인 필요</div>
                <div className="mt-0.5 text-[17px] font-semibold text-ink tabular-nums">{statusReport.counts.attention}</div>
              </div>
              <div className="px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="text-[11.5px] font-medium text-soft">지금 결정</div>
                <div className="mt-0.5 text-[17px] font-semibold text-ink tabular-nums">{decisions.counts.now}</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── Agent briefing — 지금 할 일 하나와 다음 순서 ─── */}
      <section id="today-focus" className="page pb-7 pt-2 scroll-mt-20">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold text-gold">오늘 할 일</div>
            <p className="mt-1 max-w-[22rem] text-[14px] leading-relaxed text-soft break-keep">{agentCaption}</p>
          </div>
          <span className="rounded-full border border-line bg-cream/70 px-3 py-1.5 text-right text-[11.5px] font-semibold leading-tight text-soft">{coupleDisplay}<br />진행 기준</span>
        </div>
        {aiMessage && (
          <p className="mb-5 border-l border-gold pl-4 text-[13px] leading-[1.75] text-soft">
            {aiMessage}
          </p>
        )}
        {starterResult && <StarterResultPanel result={starterResult} />}
        {agentChoosing ? (
          <div className="page-enter">
            <div className="eyebrow mb-3">우선순위 바꾸기</div>
            <h2 className="mb-2 max-w-[19rem] font-serif text-[1.625rem] leading-[1.4] text-ink break-keep [text-wrap:balance]">{koBreak("지금 더 마음이 가는 일은 무엇인가요?")}</h2>
            <p className="mb-6 text-[15px] leading-relaxed text-soft">고른 일을 첫 번째로 옮기고 다음 순서도 다시 맞출게요.</p>
            <div className="space-y-2.5">
              {(Object.entries(AGENT_PRIORITIES) as Array<[AgentPriority, (typeof AGENT_PRIORITIES)[AgentPriority]]>).map(([id, item]) => (
                <button key={id} onClick={() => chooseAgentPriority(id)} className="flex min-h-[62px] w-full items-center justify-between gap-3 border-b border-hair px-1 py-3 text-left transition hover:border-gold">
                  <span>
                    <span className="block text-[13px] font-medium text-ink">{item.label}</span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-soft">{item.reason}</span>
                  </span>
                  <span className="text-gold">→</span>
                </button>
              ))}
            </div>
            <button onClick={() => setAgentChoosing(false)} className="mt-4 min-h-11 text-[12px] text-soft underline underline-offset-4">지금 제안으로 돌아가기</button>
          </div>
        ) : (
          <div className="page-enter grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.72fr)] lg:items-start lg:gap-6">
            <div className="min-w-0">
              <Link
                to={primaryFocus.to}
                className="block rounded-[8px] border border-hair bg-paper p-4 shadow-[0_16px_45px_rgba(27,26,23,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(27,26,23,0.08)] sm:p-6 lg:p-7"
              >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ink px-3 py-1 text-[11.5px] font-semibold text-paper">
                    {decisionPrimaryForCard ? "지금 같이 볼 결정" : "오늘의 첫 단계"}
                  </span>
                  <span className="rounded-full bg-cream px-3 py-1 text-[11.5px] font-semibold text-soft">{primaryFocus.tag}</span>
                </div>
                <h2 className="max-w-[18em] font-serif text-[1.72rem] leading-[1.22] tracking-tight text-ink break-keep sm:text-[2.15rem] lg:text-[2.35rem]">
                  {primaryFocus.title}
                </h2>
                <p className="mt-4 max-w-[42rem] text-[15px] leading-[1.75] text-soft sm:text-[15.5px]">
                  {primaryFocus.desc}
                </p>
                <span className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[6px] bg-ink px-5 text-[13.5px] font-semibold text-paper">
                  {primaryAction} →
                </span>
                {decisionPrimaryForCard && <DecisionFactPreview item={decisionPrimaryForCard} />}
              </Link>
              {data.ai?.starterSummary && (
                <p className="mt-4 rounded-[8px] border border-line bg-cream/35 px-4 py-3 text-[13px] leading-relaxed text-soft break-keep">
                  {data.ai.starterSummary}
                </p>
              )}
            </div>
            <div className="space-y-4 lg:pt-0">
              {decisionRows.length > 0 && (
                <div className="hidden lg:block">
                  <DecisionChoiceRows decisions={decisionRows} counts={decisions.counts} compact />
                </div>
              )}
              {agentQuestion && (
                <AgentQuestionCard question={agentQuestion} onAnswer={answerAgentQuestion} />
              )}
              {hasRisk && (
                <div className="overflow-hidden rounded-[8px] border border-line bg-cream/35">
                  <div className="border-b border-line px-4 py-3">
                    <div className="text-[14px] font-semibold text-ink">놓치면 아쉬운 신호</div>
                  </div>
                {overdueCount > 0 && (
                  <Link to="/checklist" className="row-tap flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">지난 마감 <b className="font-semibold">{overdueCount}건</b>이 남아 있어요</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {overBudgetCount > 0 && (
                  <Link to="/budget" className="row-tap flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">예산을 <b className="font-semibold">{overBudgetCount}건</b> 초과했어요 · +{formatKRW(overBudgetSum)}</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {balanceDueSoon && (
                  <Link to={balanceDueSoon.targetPath} className="row-tap flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">{balanceDueSoon.name} 잔금 {balanceDueSoon.daysLeft < 0 ? `${-balanceDueSoon.daysLeft}일 지남` : balanceDueSoon.daysLeft === 0 ? "오늘" : `D-${balanceDueSoon.daysLeft}`} · {formatKRW(balanceDueSoon.amount)}</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {capFit === "over" && (
                  <Link to="/guests" className="row-tap flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">초대 인원 <b className="font-semibold tabular-nums">{headcountForFit}명</b>이 {contractVenueForFit?.name} 수용(<span className="tabular-nums">{contractVenueForFit?.capacityMax}명</span>)을 넘을 수 있어요</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {capFit === "under" && (
                  <Link to="/venues" className="row-tap flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">초대 인원 <span className="tabular-nums">{headcountForFit}명</span>이 최소 보증인원(<span className="tabular-nums">{contractVenueForFit?.capacityMin}명</span>)보다 적어요 · 보증금 확인</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {rsvpNudge && (
                  <Link to="/guests" className="row-tap flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">청첩장 보낸 지 <span className="tabular-nums">{rsvp.daysSinceFirstInvite}일</span> · 회신 <b className="font-semibold tabular-nums">{rsvp.rate}%</b> · 미응답 <span className="tabular-nums">{rsvp.pending}명</span></span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {mealCheck?.kind === "missing" && (
                  <Link to="/budget" className="row-tap flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">예상 식대 약 <b className="font-semibold">{formatKRW(mealCheck.expected)}</b> · 예산표에 식대 항목이 없어요</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {mealCheck?.kind === "low" && (
                  <Link to="/budget" className="row-tap flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">예산 식대(<span className="tabular-nums">{formatKRW(mealCheck.planned!)}</span>)가 예상(<span className="tabular-nums">{formatKRW(mealCheck.expected)}</span>)보다 적어요</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
              </div>
            )}
            </div>
          </div>
        )}
        {!agentChoosing && decisionRows.length > 0 && (
          <div className="lg:hidden">
            <DecisionChoiceRows decisions={decisionRows} counts={decisions.counts} />
          </div>
        )}
        {!agentChoosing && decisionRows.length === 0 && focusItems.length > 1 && (
          <div className="mt-6 rounded-[8px] border border-line bg-paper">
            {focusItems.slice(1, 4).map((item, index) => (
              <Link key={`${item.to}-${item.title}`} to={item.to} className="row-tap grid min-h-[66px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-snug text-ink">{item.title}</span>
                  <span className="mt-1 block text-[12px] text-soft">{item.tag}</span>
                </span>
                <span className="text-soft">→</span>
              </Link>
            ))}
          </div>
        )}
        {!agentChoosing && (
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1">
            <button onClick={() => setAgentChoosing(true)} className="min-h-11 text-[12.5px] text-soft underline underline-offset-4 hover:text-ink">먼저 할 일 바꾸기</button>
            <button data-testid="dashboard-ai-starter" onClick={openAiStarter} className="min-h-11 text-[12.5px] text-soft underline underline-offset-4 hover:text-ink">계획 다시 잡기</button>
          </div>
        )}
      </section>

      {!empty && <>
      <div className="hairline" />
      <section className="page py-7">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow block mb-1">지금 볼 상태</div>
            <h2 className="font-serif text-[1.375rem] leading-snug text-ink">{koBreak("다음만 남기기")}</h2>
          </div>
          <span className="text-right text-[12px] leading-relaxed text-soft">
            완료 {statusReport.counts.done}<br />
            확인 필요 {statusReport.counts.attention}
          </span>
        </div>
        <StatusBoard nextSections={statusReport.nextSections} allSections={readiness} />
      </section>
      </>}

      <div className="hairline" />

      {!empty && timeline.length > 0 && (
        <>
          <section className="page py-9">
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <div className="eyebrow-gold">다가오는 일정</div>
              <Link to="/checklist" className="inline-flex min-h-11 items-center text-[12px] text-soft underline underline-offset-4 hover:text-ink">전체 일정 →</Link>
            </div>
            <ol>
              {timeline.map((e, i) => (
                <li key={`${e.kind}-${e.date}-${i}`} className="relative pl-8">
                  <span
                    aria-hidden="true"
                    className={`absolute left-[6px] w-px bg-hair ${i === 0 ? "top-[1.05rem]" : "top-0"} ${i === timeline.length - 1 ? "h-[1.05rem]" : "bottom-0"}`}
                  />
                  <span aria-hidden="true" className="absolute left-0 top-[0.7rem] flex h-3.5 w-3.5 items-center justify-center">
                    <span className={`w-[8px] h-[8px] rotate-45 border ${e.kind === "wedding" ? "bg-gold border-gold" : "border-mute bg-paper"}`} />
                  </span>
                  <Link to={e.targetPath} className="row-tap flex items-baseline gap-2 border-b border-hair py-3 last:border-b-0">
                    <span className="w-12 flex-shrink-0 text-[12px] text-soft tabular-nums">{e.date.slice(5).replace("-", ".")}</span>
                    <span className={`min-w-0 truncate break-keep text-[14px] ${e.kind === "wedding" ? "font-serif text-ink" : "text-ink"}`}>{e.label}</span>
                    <span className={`ml-auto flex-shrink-0 text-[12px] tabular-nums ${e.daysLeft <= 14 ? "text-gold font-medium" : "text-soft"}`}>{e.daysLeft === 0 ? "오늘" : `D-${e.daysLeft}`}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
          <div className="hairline" />
        </>
      )}

      {/* ─── 전체 메뉴는 접어서, 첫 화면 집중도를 유지 ─── */}
      <section className="page py-7">
        <details>
          <summary className="list-none cursor-pointer flex items-baseline justify-between gap-4">
            <span>
              <span className="eyebrow block mb-1">준비 도구</span>
              <span className="font-serif text-lg text-ink">{koBreak("다른 메뉴 보기")}</span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
          </summary>
          <div className="pt-7 space-y-8">
            {MENU_GROUPS.map((group) => (
              <div key={group.title}>
                <h2 className="eyebrow mb-3">{group.title}</h2>
                <ul className="border-y border-hair divide-y divide-hair">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="flex items-baseline justify-between gap-4 py-3.5 active:opacity-60 transition"
                      >
                        <div className="min-w-0">
                          <div className="font-serif text-[15px] text-ink leading-tight">{item.label}</div>
                          <div className="text-[12px] text-soft mt-1 truncate">{item.sub}</div>
                        </div>
                        <span className="text-soft flex-shrink-0">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </section>

      <ChatbotBridgeModal
        open={!!aiPrompt}
        onClose={() => setAiPrompt(null)}
        prompt={aiPrompt}
        onApply={applyAiStarter}
      />
    </div>
  );
}

function AgentQuestionCard({ question, onAnswer }: { question: AgentLoopQuestion; onAnswer: (question: AgentLoopQuestion, value: string) => void }) {
  return (
    <details open className="overflow-hidden rounded-[8px] border border-sage/25 bg-sage/5 shadow-[0_12px_34px_rgba(27,26,23,0.04)]">
      <summary className="flex min-h-[68px] cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 text-left">
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold text-sage">{question.eyebrow}</span>
          <h3 className="mt-1 text-[17px] font-semibold leading-snug text-ink break-keep">{question.title}</h3>
        </span>
        <span className="mt-0.5 flex-shrink-0 rounded-full bg-paper px-3 py-1 text-[12px] font-semibold text-soft">답하기</span>
      </summary>
      <div className="border-t border-sage/20 px-4 pb-4 pt-3">
      <p className="text-[14px] leading-[1.7] text-soft">{question.body}</p>
      <div className="mt-4 grid gap-2">
        {question.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onAnswer(question, option.value)}
            className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-[6px] border border-line bg-paper px-3 py-3 text-left transition hover:border-sage/50 hover:bg-white active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-ink break-keep">{option.label}</span>
              {option.desc && <span className="mt-0.5 block text-[12.5px] leading-relaxed text-soft break-keep">{option.desc}</span>}
            </span>
            <span className="flex-shrink-0 text-sage">→</span>
          </button>
        ))}
      </div>
      </div>
    </details>
  );
}

function DecisionFactPreview({ item }: { item: DecisionItem }) {
  return (
    <div className="mt-5 grid gap-4 border-y border-line py-4 sm:grid-cols-2">
      <div className="min-w-0 border-l-2 border-sage pl-3">
        <div className="mb-2 text-[12px] font-semibold text-sage">준비된 재료</div>
        <ul className="space-y-1.5">
          {item.preparedFacts.slice(0, 2).map((fact) => (
            <li key={fact} className="text-[13.5px] leading-relaxed text-soft break-keep">{fact}</li>
          ))}
        </ul>
      </div>
      <div className="min-w-0 border-l-2 border-gold pl-3">
        <div className="mb-2 text-[12px] font-semibold text-gold">남은 확인</div>
        <ul className="space-y-1.5">
          {item.missingInputs.slice(0, 2).map((input) => (
            <li key={input} className="text-[13.5px] leading-relaxed text-soft break-keep">{input}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DecisionChoiceRows({
  decisions,
  counts,
  compact = false,
}: {
  decisions: DecisionItem[];
  counts: Record<DecisionStage, number>;
  compact?: boolean;
}) {
  return (
    <div className={`${compact ? "mt-0" : "mt-6"} overflow-hidden rounded-[8px] border border-hair bg-paper shadow-[0_12px_34px_rgba(27,26,23,0.04)]`}>
      <div className="flex min-h-[56px] items-center justify-between gap-3 bg-cream/35 px-4 py-3">
        <span className="text-[14px] font-semibold text-ink">다음 같이 정할 것</span>
        <span className="text-[12px] leading-relaxed text-soft tabular-nums">지금 {counts.now} · 곧 {counts.soon}</span>
      </div>
      {decisions.map((item, index) => (
        <Link
          key={item.id}
          to={item.to}
          className="row-tap grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-line px-4 py-3"
        >
          <span className="min-w-0">
            <span className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[14px] font-semibold leading-snug text-ink break-keep">{item.title}</span>
              <span className="rounded-full bg-cream px-2 py-0.5 text-[11.5px] font-semibold text-soft">{DECISION_STAGE_LABEL[item.stage]}</span>
            </span>
            <span className="block text-[13px] leading-relaxed text-soft">{item.nextAction}</span>
          </span>
          <span className="text-gold">→</span>
        </Link>
      ))}
    </div>
  );
}

// 헤드라인 준비도 미터 — 막대 그 자체보다 한 톤 정제. 금색 그라데이션 채움 +
// 사분위 눈금 + 진행 머리의 다이아 마커(식순 타임라인과 같은 모티프). 슬림하게.
function StatusBoard({
  nextSections,
  allSections,
}: {
  nextSections: PlanningSectionStatus[];
  allSections: PlanningSectionStatus[];
}) {
  const priority = nextSections.slice(0, 4);
  return (
    <div className="space-y-3">
      <div className="divide-y divide-hair border-y border-hair">
        {priority.map((section) => <StatusRow key={section.key} section={section} />)}
      </div>
      <details className="border-t border-hair pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[12px] text-soft hover:text-ink">
          <span className="eyebrow">전체 영역 {allSections.length}개</span>
          <span className="underline underline-offset-4">보기</span>
        </summary>
        <div className="divide-y divide-hair border-t border-hair">
          {allSections.map((section) => <StatusRow key={section.key} section={section} compact />)}
        </div>
      </details>
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
          <span className={`leading-tight text-ink ${compact ? "text-[14px] font-semibold" : "font-serif text-[16px]"}`}>{section.label}</span>
          <StatePill state={section.state} />
        </span>
        <ProgressLine value={section.percent} subtle />
        <span className="mt-1.5 block truncate text-[13px] text-soft">
          {section.nextAction}
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
            <div className="font-serif text-[16px] text-ink">문안 초안</div>
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

function formatWeddingDate(iso?: string): string {
  const d = parseISODateLocal(iso);
  if (!d) return "";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${days[d.getDay()]}`;
}
