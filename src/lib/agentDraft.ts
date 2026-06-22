import { defaultChecklist } from "../data/checklistTemplate";
import { defaultData, type BudgetItem, type WeddingData } from "./schema";

export type AgentPriority = "venue" | "budget" | "invitation" | "rings" | "trip";
export type AgentStorage = "local" | "hosted";

export type AgentAnswers = {
  firstName: string;
  secondName: string;
  date: string;
  venue: string;
  budgetKRW?: number;
  priority: AgentPriority;
  storage: AgentStorage;
};

export const AGENT_PRIORITIES: Record<AgentPriority, {
  label: string;
  title: string;
  reason: string;
  targetPath: string;
}> = {
  venue: {
    label: "예식장부터",
    title: "예식장 후보 3곳 비교하기",
    reason: "날짜와 전체 비용에 가장 큰 영향을 주는 결정부터 잡습니다.",
    targetPath: "/venues",
  },
  budget: {
    label: "예산부터",
    title: "둘이 쓸 수 있는 총예산 정하기",
    reason: "견적을 보기 전에 상한선을 정하면 선택이 훨씬 쉬워집니다.",
    targetPath: "/budget",
  },
  invitation: {
    label: "청첩장부터",
    title: "청첩장 기본 정보 완성하기",
    reason: "이름·날짜·장소를 한 번 정리하면 공유 준비가 빠르게 끝납니다.",
    targetPath: "/invitation",
  },
  rings: {
    label: "반지부터",
    title: "반지 취향과 예산 기준 맞추기",
    reason: "브랜드보다 먼저 둘의 공통 기준을 만들면 후보가 빠르게 줄어듭니다.",
    targetPath: "/rings",
  },
  trip: {
    label: "신혼여행부터",
    title: "신혼여행 지역 후보 3곳 고르기",
    reason: "기간과 여행 분위기를 먼저 맞춘 뒤 항공과 숙소를 비교합니다.",
    targetPath: "/trip",
  },
};

export function buildAgentDraft(current: WeddingData, answers: AgentAnswers): WeddingData {
  const base = current.preferences.isDemo ? defaultData() : current;
  const date = answers.date.trim();
  const selected = AGENT_PRIORITIES[answers.priority];
  const nextTasks = [
    selected,
    !date ? {
      title: "예식 날짜 후보 이야기하기",
      reason: "정확한 날짜가 아니어도 계절이나 월만 정하면 다음 일정이 선명해집니다.",
      targetPath: "/invitation",
    } : undefined,
    !answers.venue.trim() && answers.priority !== "venue" ? AGENT_PRIORITIES.venue : undefined,
    answers.priority !== "budget" ? AGENT_PRIORITIES.budget : undefined,
  ].filter(Boolean).slice(0, 3) as Array<{ title: string; reason: string; targetPath: string }>;

  const name = [answers.firstName.trim(), answers.secondName.trim()].filter(Boolean).join(" · ");
  const summaryParts = [
    name ? `${name} 두 분의 준비판` : "두 분의 준비판",
    date ? `${date} 예식 기준` : "날짜 미정 상태",
    answers.venue.trim() ? `${answers.venue.trim()} 반영` : "장소 후보 탐색 중",
  ];

  return {
    ...base,
    preferences: { ...base.preferences, mode: "local", isDemo: false },
    invitation: {
      ...base.invitation,
      groomName: answers.firstName.trim() || base.invitation.groomName,
      brideName: answers.secondName.trim() || base.invitation.brideName,
      date: date || base.invitation.date,
      venue: answers.venue.trim() || base.invitation.venue,
    },
    checklist: base.checklist.length > 0 ? base.checklist : defaultChecklist(date),
    budget: (base.budget?.length ?? 0) > 0
      ? base.budget
      : createStarterBudget(answers.budgetKRW),
    ai: {
      ...(base.ai ?? {}),
      starterSummary: `${summaryParts.join(" · ")}. 지금은 ${selected.label.replace("부터", "")}에 먼저 집중하도록 구성했어요.`,
      today: nextTasks,
      updatedAt: new Date().toISOString(),
      profile: {
        priority: answers.priority,
        budgetKRW: answers.budgetKRW,
        onboardedAt: new Date().toISOString(),
      },
    },
  };
}

function createStarterBudget(total?: number): BudgetItem[] {
  if (!total || total <= 0) return [];
  const rows = [
    ["예식장·식대", 0.45],
    ["스드메·본식 촬영", 0.18],
    ["결혼반지", 0.08],
    ["신혼여행", 0.17],
    ["청첩장·예비비", 0.12],
  ] as const;
  return rows.map(([category, ratio], index) => ({
    id: `agent-budget-${index}-${Date.now()}`,
    category,
    planned: Math.round(total * ratio / 100_000) * 100_000,
    notes: "Agent가 만든 첫 배분안 · 실제 견적에 맞게 조정하세요",
  }));
}
