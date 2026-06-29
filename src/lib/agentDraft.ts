import { defaultChecklist, recalcDueDates } from "../data/checklistTemplate";
import { BUDGET_TEMPLATE } from "../data/budgetTemplate";
import { HONEYMOON_CATALOG } from "../data/honeymoonCatalog";
import { VENUE_CATALOG } from "../data/venueCatalog";
import { defaultData, type WeddingData } from "./schema";
import { AGENT_PRIORITIES, type AgentAnswers, type AgentPriority } from "./agentProfile";

export function buildAgentDraft(current: WeddingData, answers: AgentAnswers): WeddingData {
  const base = current.preferences.isDemo ? defaultData() : current;
  const date = answers.date.trim();
  const region = answers.region.trim();
  const selected = AGENT_PRIORITIES[answers.priority];
  const starterVenues = pickStarterVenues(region);
  const starterBudget = pickStarterBudget(answers.priority);
  const starterChecklist = buildStarterChecklist(answers);
  const starterTrips = answers.priority === "trip" ? HONEYMOON_CATALOG.slice(0, 3) : [];
  const nextTasks = [
    answers.priority === "venue" && region ? {
      ...selected,
      title: `${region} 예식장 후보 추리기`,
      reason: `${region}에서 보증인원·식대·동선이 맞는 곳부터 비교해요.`,
    } : selected,
    !date ? {
      title: "예식 날짜 후보 이야기하기",
      reason: "정확한 날짜가 아니어도 계절이나 월만 정하면 다음 일정이 선명해집니다.",
      targetPath: "/invitation",
    } : undefined,
    answers.priority !== "venue" ? {
      ...AGENT_PRIORITIES.venue,
      title: region ? `${region} 예식장 후보 추리기` : AGENT_PRIORITIES.venue.title,
    } : undefined,
    answers.priority !== "invitation" ? AGENT_PRIORITIES.invitation : undefined,
  ].filter(Boolean).slice(0, 3) as Array<{ title: string; reason: string; targetPath: string }>;

  const name = [answers.groomName.trim(), answers.brideName.trim()].filter(Boolean).join(" · ");
  const summaryParts = [
    name || "두 분",
    date ? `${date} 예식` : "날짜 미정",
    region ? `${region} 선호` : "지역 미정",
  ];
  const generatedParts = [
    starterVenues.length ? `예식장 후보 ${starterVenues.length}곳` : undefined,
    starterBudget.length ? `예산 항목 ${starterBudget.length}개` : undefined,
    starterChecklist.length ? `첫 체크리스트 ${starterChecklist.length}개` : undefined,
    starterTrips.length ? `여행 후보 ${starterTrips.length}곳` : undefined,
  ].filter(Boolean);

  const existingVenueNames = new Set((base.venues ?? []).map((venue) => venue.name.trim()));
  const existingBudgetCategories = new Set((base.budget ?? []).map((item) => item.category.trim()));
  const existingRegionNames = new Set(base.honeymoon.regions.map((item) => item.name.trim()));

  const nextChecklist = base.checklist.length > 0 ? base.checklist : defaultChecklist(date);
  const checklistWithStarter = starterChecklist.length > 0
    ? [
        {
          id: `agent-first-${Date.now()}`,
          icon: "AI",
          title: "에이전트 첫 정리",
          items: starterChecklist,
        },
        ...nextChecklist,
      ]
    : nextChecklist;

  return {
    ...base,
    preferences: { ...base.preferences, mode: "local", isDemo: false },
    invitation: {
      ...base.invitation,
      groomName: answers.groomName.trim() || base.invitation.groomName,
      brideName: answers.brideName.trim() || base.invitation.brideName,
      date: date || base.invitation.date,
    },
    checklist: recalcDueDates(checklistWithStarter, date),
    venues: [
      ...(base.venues ?? []),
      ...starterVenues
        .filter((venue) => !existingVenueNames.has(venue.name.trim()))
        .map((venue, index) => ({
          ...venue,
          id: `agent-venue-${Date.now()}-${index}`,
          status: "관심" as const,
          notes: [
            venue.notes,
            region ? `${region} 기준으로 먼저 비교할 후보입니다.` : "처음 비교해볼 후보입니다.",
            "상담 때 보증인원, 식대, 부가세·봉사료, 외부업체 반입료, 동시 예식 수를 확인하고 계약서에 남기세요.",
          ].filter(Boolean).join("\n"),
        })),
    ],
    budget: [
      ...(base.budget ?? []),
      ...starterBudget
        .filter((item) => !existingBudgetCategories.has(item.category.trim()))
        .map((item, index) => ({ ...item, id: `agent-budget-${Date.now()}-${index}` })),
    ],
    honeymoon: {
      ...base.honeymoon,
      regions: [
        ...base.honeymoon.regions,
        ...starterTrips
          .filter((item) => !existingRegionNames.has(item.region.trim()))
          .map((item, index) => ({
            id: `agent-trip-${Date.now()}-${index}`,
            name: item.region,
            durationDays: 6,
            notes: [
              item.vibe,
              `[추천 시기] ${item.bestSeason}`,
              `[비행] ${item.flightHours}`,
              `[예산] ${item.budgetKRWPerPerson}`,
              item.tip,
            ].join("\n"),
          })),
      ],
    },
    ai: {
      ...(base.ai ?? {}),
      starterSummary: `${summaryParts.join(" · ")}. ${generatedParts.length ? `${generatedParts.join(" · ")}를 먼저 깔아두었어요.` : "이 정보를 바탕으로 시작 순서를 만들었어요."}`,
      today: nextTasks,
      updatedAt: new Date().toISOString(),
      profile: {
        priority: answers.priority,
        region: region || undefined,
        onboardedAt: new Date().toISOString(),
      },
    },
  };
}

function pickStarterVenues(region: string) {
  if (!region) return [];
  const matches = VENUE_CATALOG
    .map((venue) => {
      let score = 0;
      if (matchesRegion(region, venue.region)) score += 5;
      if (venue.hallType === "general" || venue.hallType === "convention") score += 2;
      if ((venue.mealPriceMin ?? Infinity) <= 100_000) score += 2;
      if ((venue.capacityMax ?? 0) >= 250) score += 1;
      return { venue, score };
    })
    .filter(({ score }) => score >= 5)
    .sort((a, b) => b.score - a.score || (a.venue.mealPriceMin ?? 0) - (b.venue.mealPriceMin ?? 0))
    .slice(0, 3)
    .map(({ venue }) => venue);
  return matches;
}

function matchesRegion(answerRegion: string, venueRegion?: string): boolean {
  const region = answerRegion.replace(/\s/g, "");
  const venue = (venueRegion ?? "").replace(/\s/g, "");
  if (!venue) return false;
  if (region.includes("서울")) return !venue.includes("경기") && !venue.includes("일산") && !venue.includes("제주");
  if (region.includes("경기") || region.includes("인천")) return venue.includes("경기") || venue.includes("일산") || venue.includes("인천");
  if (region.includes("강남")) return venue.includes("강남") || venue.includes("삼성") || venue.includes("양재") || venue.includes("청담") || venue.includes("신사") || venue.includes("잠원");
  if (region.includes("제주")) return venue.includes("제주");
  return venue.includes(region) || region.includes(venue);
}

function pickStarterBudget(priority: AgentPriority) {
  const wanted: Record<AgentPriority, string[]> = {
    venue: ["예식장 식대", "부가세·봉사료·음주류", "외부업체 반입료", "계약금·취소 위약금"],
    invitation: ["종이 청첩장", "모바일 청첩장 (유료)", "답례품 (식권·소품)", "우편 발송·봉투·스티커"],
    rings: ["결혼반지 (커플)", "예물 (목걸이·귀걸이 등)", "예비비 (예상 외 지출)"],
    trip: ["항공권 (2인)", "숙소 (5~7박)", "현지 경비 (식비·투어·쇼핑)", "여행자보험·환전 수수료"],
  };
  const byCategory = new Map(BUDGET_TEMPLATE.flatMap((group) => group.items.map((item) => [item.category, item])));
  return wanted[priority].flatMap((category) => {
    const item = byCategory.get(category);
    return item ? [{
      category,
      planned: item.avgKRW,
      avgKRW: item.avgKRW,
      notes: item.notes,
    }] : [];
  });
}

function buildStarterChecklist(answers: AgentAnswers) {
  const region = answers.region.trim();
  const base = [
    {
      text: "양가와 이번 주에 정할 것 3가지만 합의하기",
      ddayOffset: -390,
      priority: "yellow" as const,
    },
    {
      text: "예식 예상 인원 범위 적기 (신랑측·신부측 따로)",
      ddayOffset: -380,
      priority: "yellow" as const,
    },
  ];
  const byPriority: Record<AgentPriority, Array<{ text: string; ddayOffset: number; priority: "red" | "yellow" | "green" }>> = {
    venue: [
      { text: `${region || "희망 지역"} 예식장 3곳 상담 가능 일정 확인`, ddayOffset: -370, priority: "red" },
      { text: "상담 질문 준비: 보증인원·식대·환급 기준·외부업체 반입료·동시 예식 수", ddayOffset: -365, priority: "red" },
      { text: "계약서에 예식 장소·식사 메뉴·지불보증인원·총액이 적히는지 확인", ddayOffset: -360, priority: "red" },
    ],
    invitation: [
      { text: "청첩장에 들어갈 이름·날짜·장소·혼주 표기 방식 확인", ddayOffset: -75, priority: "red" },
      { text: "계좌·연락처·오시는 길 공개 범위 정하기", ddayOffset: -70, priority: "yellow" },
      { text: "RSVP는 이름·측·참석 여부·인원·식사 메모처럼 필요한 정보만 받기", ddayOffset: -35, priority: "yellow" },
      { text: "혼인신고서에 필요한 등록기준지·본·증인 2명 서명 확인", ddayOffset: -14, priority: "yellow" },
    ],
    rings: [
      { text: "반지 예산 상한과 선호 소재 합의하기", ddayOffset: -160, priority: "yellow" },
      { text: "백화점·청담·종로 중 먼저 볼 동선 정하기", ddayOffset: -150, priority: "yellow" },
    ],
    trip: [
      { text: "예식 후 바로 출발할지, 며칠 쉬고 갈지 정하기", ddayOffset: -150, priority: "yellow" },
      { text: "휴양·관광·럭셔리 중 여행 분위기 하나 고르기", ddayOffset: -145, priority: "yellow" },
    ],
  };
  return [...base, ...byPriority[answers.priority]].map((item, index) => ({
    id: `agent-task-${Date.now()}-${index}`,
    text: item.text,
    done: false,
    source: "ai" as const,
    ddayOffset: item.ddayOffset,
    priority: item.priority,
  }));
}
