import { defaultChecklist } from "../data/checklistTemplate";
import { defaultData, type WeddingData } from "./schema";

export type AgentPriority = "venue" | "invitation" | "rings" | "trip";
export type AgentStorage = "local" | "hosted";

export type AgentAnswers = {
  groomName: string;
  brideName: string;
  date: string;
  region: string;
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
    label: "예식장을 찾고 싶어요",
    title: "조건에 맞는 예식장 후보 추리기",
    reason: "지역과 날짜를 기준으로 비교할 곳부터 정리해요.",
    targetPath: "/venues",
  },
  invitation: {
    label: "청첩장을 만들고 싶어요",
    title: "청첩장 기본 정보부터 채우기",
    reason: "이름·날짜·장소만 정리하면 공유까지 금방이에요.",
    targetPath: "/invitation",
  },
  rings: {
    label: "예물·반지를 보고 싶어요",
    title: "두 사람의 반지 취향 맞추기",
    reason: "브랜드보다 공통 기준을 먼저 정하면 후보가 빠르게 좁혀져요.",
    targetPath: "/rings",
  },
  trip: {
    label: "신혼여행을 정하고 싶어요",
    title: "신혼여행 후보 지역 좁히기",
    reason: "기간과 분위기를 먼저 맞춘 뒤 항공·숙소를 비교해요.",
    targetPath: "/trip",
  },
};

export function buildAgentDraft(current: WeddingData, answers: AgentAnswers): WeddingData {
  const base = current.preferences.isDemo ? defaultData() : current;
  const date = answers.date.trim();
  const selected = AGENT_PRIORITIES[answers.priority];
  const nextTasks = [
    answers.priority === "venue" && answers.region.trim() ? {
      ...selected,
      title: `${answers.region.trim()} 예식장 후보 추리기`,
      reason: `${answers.region.trim()}에서 날짜와 조건이 맞는 곳부터 비교해요.`,
    } : selected,
    !date ? {
      title: "예식 날짜 후보 이야기하기",
      reason: "정확한 날짜가 아니어도 계절이나 월만 정하면 다음 일정이 선명해집니다.",
      targetPath: "/invitation",
    } : undefined,
    answers.priority !== "venue" ? {
      ...AGENT_PRIORITIES.venue,
      title: answers.region.trim() ? `${answers.region.trim()} 예식장 후보 추리기` : AGENT_PRIORITIES.venue.title,
    } : undefined,
    answers.priority !== "invitation" ? AGENT_PRIORITIES.invitation : undefined,
  ].filter(Boolean).slice(0, 3) as Array<{ title: string; reason: string; targetPath: string }>;

  const name = [answers.groomName.trim(), answers.brideName.trim()].filter(Boolean).join(" · ");
  const summaryParts = [
    name || "두 분",
    date ? `${date} 예식` : "날짜 미정",
    answers.region.trim() ? `${answers.region.trim()} 선호` : "지역 미정",
  ];

  return {
    ...base,
    preferences: { ...base.preferences, mode: "local", isDemo: false },
    invitation: {
      ...base.invitation,
      groomName: answers.groomName.trim() || base.invitation.groomName,
      brideName: answers.brideName.trim() || base.invitation.brideName,
      date: date || base.invitation.date,
    },
    checklist: base.checklist.length > 0 ? base.checklist : defaultChecklist(date),
    ai: {
      ...(base.ai ?? {}),
      starterSummary: `${summaryParts.join(" · ")}. 이 정보를 바탕으로 시작 순서를 만들었어요.`,
      today: nextTasks,
      updatedAt: new Date().toISOString(),
      profile: {
        priority: answers.priority,
        region: answers.region.trim() || undefined,
        onboardedAt: new Date().toISOString(),
      },
    },
  };
}
