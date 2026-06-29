import { recalcDueDates } from "../data/checklistTemplate";
import type { BudgetItem, CheckItem, GuestCategory, WeddingData } from "./schema";

export type AgentLoopOption = {
  label: string;
  value: string;
  desc?: string;
};

export type AgentLoopQuestion = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  options: AgentLoopOption[];
};

const MEAL_UNIT_KRW = 90_000;

export function nextAgentQuestion(data: WeddingData): AgentLoopQuestion | null {
  const answered = new Set((data.ai?.dialogue ?? []).map((item) => item.id));
  const headcount = data.headcount?.estimates?.reduce((sum, item) => sum + item.expected, 0) ?? 0;

  if (!answered.has("headcount-scale") && headcount <= 0 && (data.venues?.length || data.ai?.profile?.priority === "venue")) {
    return {
      id: "headcount-scale",
      eyebrow: "다음 질문",
      title: "예상 하객은 어느 정도로 잡을까요?",
      body: "예식장 보증인원, 식대, 홀 크기를 같이 계산하려면 대략의 범위가 먼저 필요합니다. 나중에 얼마든지 고칠 수 있어요.",
      options: [
        { label: "100명 안팎", value: "100", desc: "스몰·하우스웨딩까지 열어두기" },
        { label: "200명 안팎", value: "200", desc: "일반 예식장과 호텔 일부 비교" },
        { label: "300명 이상", value: "300", desc: "컨벤션·대형 홀 위주로 보기" },
        { label: "아직 모르겠어요", value: "unknown", desc: "인원 취합을 먼저 할 일로 올리기" },
      ],
    };
  }

  const venues = data.venues ?? [];
  const tourCandidates = venues.filter((venue) => venue.status !== "투어" && venue.status !== "계약").slice(0, 3);
  if (!answered.has("venue-first-tour") && tourCandidates.length > 0) {
    return {
      id: "venue-first-tour",
      eyebrow: "다음 질문",
      title: "먼저 상담 예약할 후보를 하나 고를까요?",
      body: "후보를 많이 담아두는 것보다 첫 상담을 잡아야 조건표가 실제 견적으로 바뀝니다.",
      options: [
        ...tourCandidates.map((venue) => ({
          label: venue.name,
          value: `venue:${venue.id}`,
          desc: [venue.region, venue.capacityMax ? `최대 ${venue.capacityMax}명` : undefined].filter(Boolean).join(" · "),
        })),
        { label: "아직 고르지 않기", value: "skip", desc: "후보 비교를 조금 더 보고 결정" },
      ],
    };
  }

  const invitationReadyCount = [
    data.invitation.groomName,
    data.invitation.brideName,
    data.invitation.date,
    data.invitation.venue,
  ].filter(Boolean).length;
  if (!answered.has("invitation-final-check") && invitationReadyCount >= 3 && !data.publish?.code) {
    return {
      id: "invitation-final-check",
      eyebrow: "다음 질문",
      title: "청첩장은 무엇부터 점검할까요?",
      body: "공유 전에 한 번만 잡아두면 실수가 크게 줄어드는 부분입니다.",
      options: [
        { label: "이름·날짜 오탈자", value: "typo", desc: "가장 치명적인 기본 정보 검수" },
        { label: "계좌·연락처 공개 범위", value: "privacy", desc: "민감 정보 노출 줄이기" },
        { label: "지도·주차 안내", value: "map", desc: "하객 문의 줄이기" },
      ],
    };
  }

  if (!answered.has("trip-style") && data.honeymoon.regions.length > 0 && !data.honeymoon.notes?.trim()) {
    return {
      id: "trip-style",
      eyebrow: "다음 질문",
      title: "신혼여행은 어떤 분위기로 좁힐까요?",
      body: "같은 지역도 분위기를 정해야 숙소와 동선 기준이 선명해집니다.",
      options: [
        { label: "휴양 위주", value: "rest", desc: "풀빌라·리조트·스파 중심" },
        { label: "관광과 맛집", value: "city", desc: "동선과 예약 난이도 중심" },
        { label: "한 번뿐인 럭셔리", value: "luxury", desc: "객실·전망·허니문 베네핏 중심" },
      ],
    };
  }

  return null;
}

export function applyAgentAnswer(data: WeddingData, question: AgentLoopQuestion, value: string): { next: WeddingData; message: string } {
  if (question.id === "headcount-scale") return applyHeadcount(data, question, value);
  if (question.id === "venue-first-tour") return applyVenueTour(data, question, value);
  if (question.id === "invitation-final-check") return applyInvitationCheck(data, question, value);
  if (question.id === "trip-style") return applyTripStyle(data, question, value);
  return { next: rememberAnswer(data, question, value), message: "답을 저장했어요." };
}

function applyHeadcount(data: WeddingData, question: AgentLoopQuestion, value: string) {
  if (value === "unknown") {
    const next = addAgentTask(rememberAnswer(data, question, value), {
      text: "양가 예상 하객 수를 신랑측·신부측으로 나눠 적기",
      ddayOffset: -380,
      priority: "yellow",
    });
    return { next, message: "인원 취합을 오늘 할 일로 올렸어요." };
  }

  const total = Number(value);
  const estimates = buildHeadcountEstimates(total);
  const nextBase = rememberAnswer(data, question, value);
  const next: WeddingData = {
    ...nextBase,
    headcount: {
      ...(nextBase.headcount ?? {}),
      estimates,
    },
    budget: upsertMealBudget(nextBase.budget ?? [], total),
    ai: {
      ...(nextBase.ai ?? {}),
      today: [
        {
          title: `예상 하객 ${total}명 기준으로 예식장 다시 보기`,
          reason: `식대 기준 예상치는 약 ${formatKRW(total * MEAL_UNIT_KRW)}입니다. 보증인원과 홀 수용 범위를 같이 확인하세요.`,
          targetPath: "/venues",
        },
        ...(nextBase.ai?.today ?? []),
      ].slice(0, 3),
      updatedAt: new Date().toISOString(),
    },
  };
  return { next, message: `예상 하객 ${total}명과 식대 기준을 준비판에 반영했어요.` };
}

function applyVenueTour(data: WeddingData, question: AgentLoopQuestion, value: string) {
  const nextBase = rememberAnswer(data, question, value);
  if (!value.startsWith("venue:")) {
    return {
      next: addAgentTask(nextBase, {
        text: "예식장 후보 3곳을 보증인원·식대·동선 기준으로 비교하기",
        ddayOffset: -370,
        priority: "yellow",
      }),
      message: "후보 비교를 오늘 할 일에 남겼어요.",
    };
  }

  const venueId = value.slice("venue:".length);
  const venue = (nextBase.venues ?? []).find((item) => item.id === venueId);
  const next: WeddingData = {
    ...nextBase,
    venues: (nextBase.venues ?? []).map((item) => item.id === venueId ? { ...item, status: "투어" as const } : item),
    ai: {
      ...(nextBase.ai ?? {}),
      today: [
        {
          title: `${venue?.name ?? "예식장"} 상담 예약하기`,
          reason: "상담 때 보증인원, 식대, 취소 위약금, 외부업체 반입료를 한 번에 확인하세요.",
          targetPath: "/venues",
        },
        ...(nextBase.ai?.today ?? []),
      ].slice(0, 3),
      updatedAt: new Date().toISOString(),
    },
  };
  return { next, message: `${venue?.name ?? "선택한 후보"}를 첫 상담 후보로 표시했어요.` };
}

function applyInvitationCheck(data: WeddingData, question: AgentLoopQuestion, value: string) {
  const textByValue: Record<string, string> = {
    typo: "청첩장 이름·날짜·시간·장소 오탈자 최종 검수",
    privacy: "청첩장 계좌·연락처·혼주 정보 공개 범위 확인",
    map: "청첩장 지도·주차·대중교통 안내 문구 확인",
  };
  const next = addAgentTask(rememberAnswer(data, question, value), {
    text: textByValue[value] ?? "청첩장 공유 전 최종 검수",
    ddayOffset: -35,
    priority: value === "typo" ? "red" : "yellow",
  });
  return { next, message: "청첩장 공유 전 점검 항목을 추가했어요." };
}

function applyTripStyle(data: WeddingData, question: AgentLoopQuestion, value: string) {
  const noteByValue: Record<string, string> = {
    rest: "휴양 위주: 리조트 위치, 객실 컨디션, 수영장·스파, 이동 피로를 우선 비교",
    city: "관광과 맛집: 주요 동선, 예약 필요한 식당, 대중교통·렌터카 난이도를 우선 비교",
    luxury: "럭셔리: 객실 등급, 전망, 허니문 베네핏, 올인클루시브 포함 범위를 우선 비교",
  };
  const nextBase = rememberAnswer(data, question, value);
  const next: WeddingData = {
    ...nextBase,
    honeymoon: {
      ...nextBase.honeymoon,
      notes: noteByValue[value] ?? "여행 분위기 기준 정리",
    },
    ai: {
      ...(nextBase.ai ?? {}),
      today: [
        {
          title: "신혼여행 후보를 분위기 기준으로 다시 비교하기",
          reason: noteByValue[value],
          targetPath: "/trip",
        },
        ...(nextBase.ai?.today ?? []),
      ].slice(0, 3),
      updatedAt: new Date().toISOString(),
    },
  };
  return { next, message: "신혼여행 비교 기준을 저장했어요." };
}

function rememberAnswer(data: WeddingData, question: AgentLoopQuestion, value: string): WeddingData {
  const option = question.options.find((item) => item.value === value);
  const answeredAt = new Date().toISOString();
  return {
    ...data,
    ai: {
      ...(data.ai ?? {}),
      dialogue: [
        ...(data.ai?.dialogue ?? []).filter((item) => item.id !== question.id),
        {
          id: question.id,
          question: question.title,
          answer: option?.label ?? value,
          answeredAt,
        },
      ].slice(-12),
      updatedAt: answeredAt,
    },
  };
}

function addAgentTask(data: WeddingData, item: Pick<CheckItem, "text" | "ddayOffset" | "priority">): WeddingData {
  const now = Date.now();
  const sectionId = "agent-followup";
  const task: CheckItem = {
    id: `agent-followup-${now}`,
    text: item.text,
    done: false,
    source: "ai",
    ddayOffset: item.ddayOffset,
    priority: item.priority,
  };
  const existing = data.checklist.find((section) => section.id === sectionId);
  const checklist = existing
    ? data.checklist.map((section) => section.id === sectionId ? { ...section, items: [task, ...section.items].slice(0, 10) } : section)
    : [{ id: sectionId, icon: "AI", title: "Dee의 후속 정리", items: [task] }, ...data.checklist];
  return { ...data, checklist: recalcDueDates(checklist, data.invitation.date) };
}

function buildHeadcountEstimates(total: number) {
  const sideTotal = Math.round(total / 2);
  const rows: Array<{ side: "groom" | "bride"; category: GuestCategory; ratio: number }> = [
    { side: "groom", category: "relative", ratio: 0.3 },
    { side: "groom", category: "work", ratio: 0.3 },
    { side: "groom", category: "friend", ratio: 0.4 },
    { side: "bride", category: "relative", ratio: 0.3 },
    { side: "bride", category: "work", ratio: 0.3 },
    { side: "bride", category: "friend", ratio: 0.4 },
  ];
  return rows.map((row) => ({
    side: row.side,
    category: row.category,
    expected: Math.max(0, Math.round(sideTotal * row.ratio)),
  }));
}

function upsertMealBudget(items: BudgetItem[], total: number): BudgetItem[] {
  const planned = total * MEAL_UNIT_KRW;
  const index = items.findIndex((item) => item.category.includes("예식장 식대"));
  if (index >= 0) {
    return items.map((item, i) => i === index ? { ...item, planned, notes: item.notes || `${formatKRW(MEAL_UNIT_KRW)} × ${total}명 기준` } : item);
  }
  return [
    ...items,
    {
      id: `agent-meal-${Date.now()}`,
      category: "예식장 식대",
      planned,
      avgKRW: planned,
      notes: `${formatKRW(MEAL_UNIT_KRW)} × ${total}명 기준. 실제 식대·음주류·봉사료 별도 여부 확인`,
    },
  ];
}

function formatKRW(value: number): string {
  if (value >= 100_000_000) return `${Math.round(value / 100_000_000)}억원`;
  if (value >= 10_000) return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`;
  return `${value.toLocaleString("ko-KR")}원`;
}
