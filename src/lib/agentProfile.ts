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
