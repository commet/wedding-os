import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { useMemo, useState } from "react";
import { recalcDueDates } from "../data/checklistTemplate";
import { daysUntilISODate, parseISODateLocal } from "../lib/date";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import { type BridgePrompt, weddingPlanStarterPrompt } from "../lib/chatbotBridge";
import { defaultData } from "../lib/schema";
import { AGENT_PRIORITIES, type AgentPriority } from "../lib/agentProfile";
import { applyAgentAnswer, nextAgentQuestion, type AgentLoopQuestion } from "../lib/agentLoop";
import { AgentIdentity } from "../components/AgentIdentity";
import { buildMenuGroups } from "../lib/menu";
import {
  budgetTotals, overdueChecklistCount, formatKRW, upcomingBalances, upcomingEvents,
  weddingPhase, rsvpReadiness, mealBudgetCheck, contractedVenue, planningHeadcount, venueCapacityFit,
} from "../lib/derived";
import { koBreak } from "../lib/typography";

type Props = { data: WeddingData; update: (patch: any) => void; };

type FocusItem = {
  to: string;
  title: string;
  desc: string;
  tag: string;
};

type ReadinessItem = {
  to: string;
  label: string;
  percent: number;
  detail: string;
};

type StarterResult = {
  tasks: number;
  budget: number;
  regions: number;
  today: number;
  greeting: boolean;
};

export default function Dashboard({ data, update }: Props) {
  const [aiPrompt, setAiPrompt] = useState<BridgePrompt | null>(null);
  const [aiMessage, setAiMessage] = useState("");
  const [starterResult, setStarterResult] = useState<StarterResult | null>(null);
  const [agentChoosing, setAgentChoosing] = useState(false);
  const dday = useMemo(() => {
    return daysUntilISODate(data.invitation.date);
  }, [data.invitation.date]);

  const checklistTotal = data.checklist.reduce((n, s) => n + s.items.length, 0);
  const checklistDone = data.checklist.reduce((n, s) => n + s.items.filter((i) => i.done).length, 0);
  const progress = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const agentOnboarded = !!data.ai?.profile?.onboardedAt;
  const empty = !agentOnboarded && !data.invitation.groomName && !data.invitation.brideName;

  const venueCount = (data.venues ?? []).length;
  const budgetCount = (data.budget ?? []).length;
  const guestCount = (data.guests ?? []).length;
  const guestAttending = (data.guests ?? []).filter((g) => g.status === "참석").length;
  const sdmCount = data.sdm.filter((v) => v.category !== "snap").length;
  const snapCount = data.sdm.filter((v) => v.category === "snap").length;
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
  const hasRisk = overdueCount > 0 || overBudgetCount > 0 || !!balanceDueSoon || capitalRisk || rsvpNudge || !!mealCheck;
  const agentQuestion = useMemo(() => nextAgentQuestion(data), [data]);
  const agentCaption = hasRisk
    ? "놓치기 쉬운 신호를 먼저 보고 있어요."
    : agentQuestion
      ? "다음 결정을 하나만 물어볼게요."
      : "지금은 준비판을 조용히 정리해두고 있어요.";

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
    const now = Date.now();
    const checklistItems = Array.isArray(parsed?.checklistItems) ? parsed.checklistItems : [];
    const budgetItems = Array.isArray(parsed?.budgetItems) ? parsed.budgetItems : [];
    const honeymoonRegions = Array.isArray(parsed?.honeymoonRegions) ? parsed.honeymoonRegions : [];
    const todayItems = Array.isArray(parsed?.today) ? parsed.today : [];
    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
    const greeting = typeof parsed?.invitationGreeting === "string" ? parsed.invitationGreeting.trim() : "";
    const defaultGreeting = defaultData().invitation.greeting.trim();
    const result: StarterResult = {
      tasks: 0,
      budget: 0,
      regions: 0,
      today: 0,
      greeting: false,
    };

    update((prev: WeddingData) => {
      let next: WeddingData = { ...prev };

      const newTasks = checklistItems
        .map((item: any, idx: number) => ({
          id: `ai-task-${now}-${idx}`,
          text: typeof item?.text === "string" ? item.text.trim() : "",
          done: false,
          source: "ai" as const,
          ddayOffset: typeof item?.ddayOffset === "number" ? item.ddayOffset : undefined,
          priority: ["red", "yellow", "green"].includes(item?.priority) ? item.priority : "yellow",
        }))
        .filter((item: any) => item.text);
      if (newTasks.length > 0) {
        const sectionId = "ai-starter";
        const existing = next.checklist.find((section) => section.id === sectionId);
        const checklist = existing
          ? next.checklist.map((section) =>
              section.id === sectionId
                ? { ...section, items: [...newTasks, ...section.items].slice(0, 12) }
                : section,
            )
          : [
              {
                id: sectionId,
                icon: "AI",
                title: "AI 시작 정리",
                items: newTasks,
              },
              ...next.checklist,
            ];
        next = {
          ...next,
          checklist: recalcDueDates(checklist, next.invitation.date),
        };
        result.tasks = newTasks.length;
      }

      const budgetCategories = new Set((next.budget ?? []).map((item) => item.category.trim()));
      const newBudget = budgetItems
        .map((item: any, idx: number) => ({
          id: `ai-budget-${now}-${idx}`,
          category: typeof item?.category === "string" ? item.category.trim() : "",
          planned: typeof item?.planned === "number" && item.planned > 0 ? Math.round(item.planned) : undefined,
          notes: typeof item?.notes === "string" ? item.notes.trim() : undefined,
        }))
        .filter((item: any) => item.category && !budgetCategories.has(item.category));
      if (newBudget.length > 0) {
        next = { ...next, budget: [...(next.budget ?? []), ...newBudget] };
        result.budget = newBudget.length;
      }

      const regionNames = new Set(next.honeymoon.regions.map((region) => region.name.trim()));
      const newRegions = honeymoonRegions
        .map((item: any, idx: number) => ({
          id: `ai-region-${now}-${idx}`,
          name: typeof item?.name === "string" ? item.name.trim() : "",
          durationDays: typeof item?.durationDays === "number" ? Math.round(item.durationDays) : undefined,
          notes: typeof item?.notes === "string" ? item.notes.trim() : undefined,
        }))
        .filter((item: any) => item.name && !regionNames.has(item.name));
      if (newRegions.length > 0) {
        next = {
          ...next,
          honeymoon: {
            ...next.honeymoon,
            regions: [...next.honeymoon.regions, ...newRegions],
          },
        };
        result.regions = newRegions.length;
      }

      if (greeting && (!next.invitation.greeting.trim() || next.invitation.greeting.trim() === defaultGreeting)) {
        next = { ...next, invitation: { ...next.invitation, greeting } };
        result.greeting = true;
      }

      const normalizedToday = todayItems
        .map((item: any) => ({
          title: typeof item?.title === "string" ? item.title.trim() : "",
          reason: typeof item?.reason === "string" ? item.reason.trim() : undefined,
          targetPath: normalizeTargetPath(item?.targetPath),
        }))
        .filter((item: { title: string }) => item.title)
        .slice(0, 3);
      if (summary || normalizedToday.length > 0) {
        next = {
          ...next,
          ai: {
            ...(next.ai ?? {}),
            starterSummary: summary || next.ai?.starterSummary,
            today: normalizedToday.length > 0 ? normalizedToday : next.ai?.today,
            updatedAt: new Date(now).toISOString(),
          },
        };
        result.today = normalizedToday.length;
      }

      return next;
    });

    const applied = result.tasks + result.budget + result.regions + result.today + (result.greeting ? 1 : 0);
    const added = applied + (summary ? 1 : 0);
    setStarterResult(applied > 0 ? result : null);
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
    data.preferences.mode,
    data.rings.length,
    invitationReadyCount,
    venueCount,
  ]);

  const readiness: ReadinessItem[] = [
    {
      to: "/checklist",
      label: "체크리스트",
      percent: progress,
      detail: checklistTotal > 0 ? `${checklistDone}/${checklistTotal} 완료` : "기본판 필요",
    },
    {
      to: "/invitation",
      label: "청첩장",
      percent: Math.round((invitationReadyCount / 5) * 100),
      detail: invitationReadyCount >= 4 ? "공유 준비 중" : "기본 정보 입력",
    },
    {
      to: "/venues",
      label: "예식장",
      percent: data.invitation.venue || venueCount > 0 ? 70 : 0,
      detail: venueCount > 0 ? `${venueCount}곳 후보` : data.invitation.venue ? "장소 입력됨" : "후보 없음",
    },
    {
      to: "/budget",
      label: "예산",
      percent: budgetCount > 0 ? 60 : 0,
      detail: budgetCount > 0 ? `${budgetCount}개 항목` : "템플릿 필요",
    },
    {
      to: "/guests",
      label: "하객",
      percent: guestCount > 0 ? Math.min(85, 30 + guestAttending * 5) : 0,
      detail: guestCount > 0 ? `${guestCount}명 · 참석 ${guestAttending}` : "명단 시작 전",
    },
    {
      to: "/trip",
      label: "신혼여행",
      percent: data.honeymoon.regions.length > 0 ? 45 : 0,
      detail: data.honeymoon.regions.length > 0 ? `${data.honeymoon.regions.length}곳 후보` : "지역 비교 전",
    },
  ];

  // 헤드라인 준비도 — 영역별 부분 진행률(readiness)의 평균. 한 곳만 채워도 지표가 움직인다.
  const readinessPercent = readiness.length
    ? Math.round(readiness.reduce((sum, r) => sum + r.percent, 0) / readiness.length)
    : 0;

  // 전역 메뉴 — AppShell "더보기" 시트와 동일한 단일 소스(lib/menu.ts)를 공유.
  const MENU_GROUPS = buildMenuGroups(data);
  const primaryFocus = focusItems[0] ?? {
    to: "/checklist",
    title: "오늘 할 일 확인하기",
    desc: "완료한 일과 다음 일정을 가볍게 확인해보세요.",
    tag: "다음 단계",
  };
  const coupleDisplay = [data.invitation.groomName, data.invitation.brideName].filter(Boolean).join(" · ") || "우리";

  return (
    <div className="pb-10">
      {/* ─── 히어로 — 박스 없이 풀폭 타이포 ─── */}
      <section className="page pt-6 pb-6">
        {empty ? (
          <div className="border-y border-hair py-6">
            <div className="eyebrow mb-3">처음 1분</div>
            <h1 className="display-sm mb-3">
              {koBreak("예식 날짜가 정해졌나요?")}
            </h1>
            <p className="text-[15px] text-soft leading-relaxed mb-5">
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
              <Link to="/invitation" className="btn-primary min-h-11 flex items-center justify-center px-3 text-[12px] text-center">
                이름·장소 입력
              </Link>
              <a href="#today-focus" className="btn-secondary min-h-11 flex items-center justify-center px-3 text-[12px] text-center">
                아직 미정
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* 1) 정체성 — 누구의 준비판인가 */}
            <div className="eyebrow-gold mb-4">두 분의 준비판</div>
            <h1 className="font-serif text-[1.625rem] leading-[1.4] text-ink tracking-wide break-keep">
              {koBreak(coupleDisplay)}
            </h1>

            {/* 2) 큰 숫자 — D-day */}
            {dday !== null && (
              <div className="mt-6">
                {dday > 0 ? (
                  <div className="font-serif text-[5rem] leading-none text-ink tracking-tight">
                    D−<span className="tabular-nums">{dday}</span>
                  </div>
                ) : dday === 0 ? (
                  <div className="font-serif text-[3.5rem] leading-none text-gold tracking-tight">
                    D — DAY
                  </div>
                ) : (
                  <div className="font-serif text-3xl leading-none text-soft">
                    결혼 +<span className="tabular-nums">{Math.abs(dday)}</span>일
                  </div>
                )}
              </div>
            )}

            {/* 3) 사실 밴드 — 날짜·장소, 한 단 낮은 위계로 hairline 구분 */}
            <div className="mt-7 border-t border-hair pt-4 space-y-1">
              <p className="text-[13px] text-ink tracking-wide break-keep">
                {formatWeddingDate(data.invitation.date) || "날짜 미정"}
                {data.invitation.time && ` · ${data.invitation.time}`}
              </p>
              <p className="eyebrow">
                {data.invitation.venue || "장소 미정"}
              </p>
            </div>

            {/* 4) 준비도 — 또 한 단 분리, 정제된 미터 */}
            <div className="mt-6 border-t border-hair pt-5">
              <div className="flex items-end justify-between mb-2.5">
                <span className="eyebrow">전체 준비도</span>
                <span className="font-serif text-2xl text-ink tabular-nums leading-none">
                  {readinessPercent}<span className="text-[14px] text-soft ml-0.5">%</span>
                </span>
              </div>
              <ReadinessMeter value={readinessPercent} />
            </div>
          </>
        )}
      </section>

      <div className="hairline" />

      {/* ─── Agent briefing — 지금 할 일 하나와 다음 순서 ─── */}
      <section id="today-focus" className="page py-9 scroll-mt-20">
        <div className="mb-7 flex items-end justify-between gap-4">
          <AgentIdentity mood={agentQuestion ? "thinking" : hasRisk ? "watching" : "ready"} caption={agentCaption} />
          <span className="eyebrow text-right">{coupleDisplay}<br />오늘의 브리핑</span>
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
                    <span className="mt-1 block text-[11px] leading-relaxed text-soft">{item.reason}</span>
                  </span>
                  <span className="text-gold">→</span>
                </button>
              ))}
            </div>
            <button onClick={() => setAgentChoosing(false)} className="mt-4 min-h-11 text-[12px] text-soft underline underline-offset-4">지금 제안으로 돌아가기</button>
          </div>
        ) : (
          <div className="page-enter lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-start lg:gap-x-10">
            <div>
            {dday !== null && (
              <div className="mb-3 flex items-baseline gap-2">
                <span className="eyebrow-gold">{phase.label}</span>
                {dday >= 0 && <span className="text-[11px] text-soft tabular-nums">D-{dday}</span>}
              </div>
            )}
            <p className="mb-6 max-w-[21rem] text-[15px] leading-[1.8] text-soft">
              {data.ai?.starterSummary || (dday !== null ? phase.focus : "현재 준비 상태를 보고, 다음 결정이 쉬워지는 순서로 정리했어요.")}
            </p>
            <div className="agent-briefing mb-7 lg:mb-0">
              <div className="agent-briefing-number">01</div>
              <div className="min-w-0">
                <div className="eyebrow-gold mb-2">오늘의 첫 단계</div>
                <h2 className="font-serif text-[1.625rem] leading-[1.4] text-ink break-keep">{primaryFocus.title}</h2>
                <p className="mt-3 text-[15px] leading-[1.75] text-soft">{primaryFocus.desc}</p>
                <Link to={primaryFocus.to} className="mt-5 inline-flex min-h-11 items-center border-b border-ink text-[12.5px] font-medium text-ink">
                  에이전트와 이 일 시작하기&nbsp; →
                </Link>
              </div>
            </div>
            </div>
            <div className="lg:pt-1">
            {agentQuestion && (
              <AgentQuestionCard question={agentQuestion} onAnswer={answerAgentQuestion} />
            )}
            {hasRisk && (
              <div className="mb-7 border-y border-l-2 border-hair border-l-gold bg-cream/40">
                {overdueCount > 0 && (
                  <Link to="/checklist" className="row-tap flex items-center justify-between gap-3 border-b border-hair px-3 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">지난 마감 <b className="font-semibold">{overdueCount}건</b>이 남아 있어요</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {overBudgetCount > 0 && (
                  <Link to="/budget" className="row-tap flex items-center justify-between gap-3 border-b border-hair px-3 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">예산을 <b className="font-semibold">{overBudgetCount}건</b> 초과했어요 · +{formatKRW(overBudgetSum)}</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {balanceDueSoon && (
                  <Link to={balanceDueSoon.targetPath} className="row-tap flex items-center justify-between gap-3 border-b border-hair px-3 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">{balanceDueSoon.name} 잔금 {balanceDueSoon.daysLeft < 0 ? `${-balanceDueSoon.daysLeft}일 지남` : balanceDueSoon.daysLeft === 0 ? "오늘" : `D-${balanceDueSoon.daysLeft}`} · {formatKRW(balanceDueSoon.amount)}</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {capFit === "over" && (
                  <Link to="/guests" className="row-tap flex items-center justify-between gap-3 border-b border-hair px-3 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">초대 인원 <b className="font-semibold tabular-nums">{headcountForFit}명</b>이 {contractVenueForFit?.name} 수용(<span className="tabular-nums">{contractVenueForFit?.capacityMax}명</span>)을 넘을 수 있어요</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {capFit === "under" && (
                  <Link to="/venues" className="row-tap flex items-center justify-between gap-3 border-b border-hair px-3 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">초대 인원 <span className="tabular-nums">{headcountForFit}명</span>이 최소 보증인원(<span className="tabular-nums">{contractVenueForFit?.capacityMin}명</span>)보다 적어요 · 보증금 확인</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {rsvpNudge && (
                  <Link to="/guests" className="row-tap flex items-center justify-between gap-3 border-b border-hair px-3 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">청첩장 보낸 지 <span className="tabular-nums">{rsvp.daysSinceFirstInvite}일</span> · 회신 <b className="font-semibold tabular-nums">{rsvp.rate}%</b> · 미응답 <span className="tabular-nums">{rsvp.pending}명</span></span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {mealCheck?.kind === "missing" && (
                  <Link to="/budget" className="row-tap flex items-center justify-between gap-3 border-b border-hair px-3 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">예상 식대 약 <b className="font-semibold">{formatKRW(mealCheck.expected)}</b> · 예산표에 식대 항목이 없어요</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
                {mealCheck?.kind === "low" && (
                  <Link to="/budget" className="row-tap flex items-center justify-between gap-3 border-b border-hair px-3 py-3 last:border-b-0">
                    <span className="text-[13px] text-ink break-keep">예산 식대(<span className="tabular-nums">{formatKRW(mealCheck.planned!)}</span>)가 예상(<span className="tabular-nums">{formatKRW(mealCheck.expected)}</span>)보다 적어요</span>
                    <span className="flex-shrink-0 text-gold">→</span>
                  </Link>
                )}
              </div>
            )}
            </div>
          </div>
        )}
        {!agentChoosing && focusItems.length > 1 && (
          <div className="mt-7 border-t border-hair">
            {focusItems.slice(1, 4).map((item, index) => (
              <Link key={`${item.to}-${item.title}`} to={item.to} className="row-tap grid min-h-[70px] grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-hair py-3">
                <span className="font-serif text-[14px] text-gold">0{index + 2}</span>
                <span className="text-[13px] leading-relaxed text-ink">{item.title}</span>
                <span className="text-soft">→</span>
              </Link>
            ))}
          </div>
        )}
        {!agentChoosing && (
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1">
            <button onClick={() => setAgentChoosing(true)} className="min-h-11 text-[12px] text-soft underline underline-offset-4 hover:text-ink">먼저 할 일 바꾸기</button>
            <button data-testid="dashboard-ai-starter" onClick={openAiStarter} className="min-h-11 text-[12px] text-soft underline underline-offset-4 hover:text-ink">에이전트에게 계획 다시 부탁하기</button>
          </div>
        )}
      </section>

      {!empty && <>
      <div className="hairline" />
      <section className="page py-7">
        <details>
          <summary className="list-none cursor-pointer flex items-center justify-between gap-4 min-h-11">
            <span>
              <span className="eyebrow block mb-1">영역별 현황</span>
              <span className="font-serif text-2xl text-ink">{koBreak("어디까지 왔는지 보기")}</span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4">펼쳐보기</span>
          </summary>
          <div className="grid grid-cols-2 gap-3 pt-5">
            {readiness.map((item) => (
              <Link key={item.label} to={item.to} className="border border-hair bg-paper p-3 active:opacity-70 transition">
                <div className="flex items-baseline justify-between gap-2 mb-3">
                  <span className="font-serif text-[15px] text-ink">{item.label}</span>
                  <span className="text-[12px] text-soft tabular-nums">{item.percent}%</span>
                </div>
                <ProgressLine value={item.percent} subtle />
                <div className="text-[12px] text-soft mt-2 leading-snug">{item.detail}</div>
              </Link>
            ))}
          </div>
        </details>
      </section>
      </>}

      <div className="hairline" />

      {!empty && timeline.length > 0 && (
        <>
          <section className="page py-9">
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <div className="eyebrow-gold">다가오는 일정</div>
              <Link to="/checklist" className="inline-flex min-h-11 items-center text-[11px] text-soft underline underline-offset-4 hover:text-ink">전체 일정 →</Link>
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
    <div className="mb-7 border-y border-hair bg-paper py-5">
      <div className="mb-4 flex items-center gap-3">
        <AgentIdentity compact mood="thinking" />
        <div className="min-w-0">
          <div className="eyebrow-gold">{question.eyebrow}</div>
          <div className="mt-1 text-[11px] leading-snug text-soft">답을 고르면 제가 준비판에 바로 반영할게요.</div>
        </div>
      </div>
      <h2 className="font-serif text-[20px] leading-[1.45] text-ink break-keep">{question.title}</h2>
      <p className="mt-2 text-[13px] leading-[1.75] text-soft">{question.body}</p>
      <div className="mt-5 divide-y divide-hair border-y border-hair">
        {question.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onAnswer(question, option.value)}
            className="row-tap flex min-h-[62px] w-full items-center justify-between gap-3 py-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink break-keep">{option.label}</span>
              {option.desc && <span className="mt-1 block text-[11.5px] leading-relaxed text-soft break-keep">{option.desc}</span>}
            </span>
            <span className="flex-shrink-0 text-gold">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// 헤드라인 준비도 미터 — 막대 그 자체보다 한 톤 정제. 금색 그라데이션 채움 +
// 사분위 눈금 + 진행 머리의 다이아 마커(식순 타임라인과 같은 모티프). 슬림하게.
function ReadinessMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-[6px] bg-hair">
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/55 to-gold transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
      {[25, 50, 75].map((q) => (
        <span key={q} aria-hidden="true" className="absolute inset-y-0 w-px bg-paper/70" style={{ left: `${q}%` }} />
      ))}
      {pct > 1 && pct < 99 && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gold border border-paper"
          style={{ left: `${pct}%` }}
        />
      )}
    </div>
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
            <div className="font-serif text-[16px] text-ink">초안 반영</div>
          </Link>
        )}
      </div>
    </div>
  );
}

const SAFE_TARGET_PATHS = new Set([
  "/dashboard",
  "/checklist",
  "/budget",
  "/guests",
  "/invitation",
  "/rings",
  "/trip",
  "/venues",
  "/share",
  "/setup",
  "/settings",
]);

function normalizeTargetPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const path = value.trim();
  return SAFE_TARGET_PATHS.has(path) ? path : undefined;
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
