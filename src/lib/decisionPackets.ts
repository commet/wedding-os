import type { WeddingData } from "./schema";
import {
  decisionMap,
  upcomingBalances,
  todayISO,
  type DecisionItem,
  type DecisionSection,
  type DecisionStage,
} from "./derived";
import { collectLossDeadlines } from "./lossDeadlines";

export type DecisionCalendarEvent = {
  title: string;
  date: string;
  description: string;
  filename: string;
};

export type DecisionPacket = {
  item: DecisionItem;
  sectionLabel: string;
  stageLabel: string;
  outcome: string;
  shareText: string;
  calendar?: DecisionCalendarEvent;
};

const SECTION_LABEL: Record<DecisionSection, string> = {
  venues: "예식장",
  budget: "예산",
  guests: "하객",
  invitation: "청첩장",
  sdm: "스드메",
  rings: "반지",
  trip: "신혼여행",
  checklist: "체크리스트",
  ceremony: "식순",
  video: "식전영상",
  share: "공유",
};

const STAGE_LABEL: Record<DecisionStage, string> = {
  now: "오늘 같이 볼 결정",
  soon: "곧 같이 볼 결정",
  later: "나중에 봐도 되는 결정",
};

export function sectionLabel(section: DecisionSection): string {
  return SECTION_LABEL[section];
}

export function stageLabel(stage: DecisionStage): string {
  return STAGE_LABEL[stage];
}

export function firstDecisionForSection(data: WeddingData, section: DecisionSection): DecisionItem | undefined {
  return decisionMap(data).items.find((item) => item.section === section);
}

export function buildDecisionPacket(item: DecisionItem, data: WeddingData, baseUrl?: string, today = todayISO()): DecisionPacket {
  const section = sectionLabel(item.section);
  const outcome = outcomeForDecision(item);
  const routeUrl = buildRouteUrl(item.to, baseUrl);
  const shareText = buildDecisionShareText(item, data, routeUrl);
  const calendar = buildDecisionCalendarEvent(item, data, routeUrl, today);
  return {
    item,
    sectionLabel: section,
    stageLabel: stageLabel(item.stage),
    outcome,
    shareText,
    calendar,
  };
}

export function buildDecisionShareText(item: DecisionItem, data: WeddingData, routeUrl?: string): string {
  const couple = [data.invitation.groomName, data.invitation.brideName].filter(Boolean).join(" · ") || "우리";
  const prepared = item.preparedFacts.slice(0, 3).join(", ");
  const missing = item.missingInputs.slice(0, 3).join(", ");
  return [
    `${couple}, 오늘은 '${item.title}'만 같이 볼까요?`,
    item.whyNow,
    prepared ? `준비된 것: ${prepared}` : "",
    missing ? `같이 확인할 것: ${missing}` : "",
    `하면 되는 일: ${item.nextAction}`,
    routeUrl ? `이어보기: ${routeUrl}` : "",
  ].filter(Boolean).join("\n");
}

export function decisionCalendarIcs(event: DecisionCalendarEvent, routeUrl?: string): string {
  const start = compactDate(event.date);
  const end = compactDate(addDays(event.date, 1));
  const uid = `dearie-${slug(event.title)}-${start}@dearie`;
  const description = routeUrl ? `${event.description}\n${routeUrl}` : event.description;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dearie//Decision Loop//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${utcStamp()}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function buildDecisionCalendarEvent(item: DecisionItem, data: WeddingData, routeUrl: string | undefined, today: string): DecisionCalendarEvent | undefined {
  const date = suggestedDecisionDate(item, data, today);
  if (!date) return undefined;
  const title = `Dearie: ${item.title}`;
  const description = [
    item.whyNow,
    item.preparedFacts.length ? `준비된 것: ${item.preparedFacts.slice(0, 3).join(", ")}` : "",
    item.missingInputs.length ? `확인할 것: ${item.missingInputs.slice(0, 3).join(", ")}` : "",
    routeUrl ? "링크에서 이어서 확인하세요." : "",
  ].filter(Boolean).join("\n");
  return {
    title,
    date,
    description,
    filename: `dearie-${slug(item.id)}.ics`,
  };
}

function suggestedDecisionDate(item: DecisionItem, data: WeddingData, today: string): string | undefined {
  if (item.id === "payment-upcoming") {
    const balance = upcomingBalances(data, today).find((entry) => entry.daysLeft <= 14);
    return balance?.dueAt ?? today;
  }
  if (item.id === "loss-deadline") {
    const loss = collectLossDeadlines(data, today).find((entry) => entry.kind !== "balance" && entry.daysLeft <= 21);
    return loss?.date ?? today;
  }
  if (item.id === "checklist-overdue") return today;
  if (item.id === "invitation-public-info") return relativeToWedding(data, -70, today, 5);
  if (item.id === "venues-tour-order") return relativeToWedding(data, -180, today, 3);
  if (item.id === "sdm-core-choice") return relativeToWedding(data, -140, today, 7);
  if (item.id === "trip-direction") return relativeToWedding(data, -120, today, 7);
  if (item.id === "video-storyboard") return relativeToWedding(data, -45, today, 7);
  if (item.id === "ceremony-run-of-show") return relativeToWedding(data, -21, today, 7);
  if (item.id === "share-collaboration-safe") return addDays(today, 1);
  if (item.stage === "now") return addDays(today, 2);
  if (item.stage === "soon") return addDays(today, 7);
  return undefined;
}

function relativeToWedding(data: WeddingData, offsetDays: number, today: string, fallbackDays: number): string {
  if (!data.invitation.date) return addDays(today, fallbackDays);
  const target = addDays(data.invitation.date.slice(0, 10), offsetDays);
  return target < today ? addDays(today, fallbackDays) : target;
}

function outcomeForDecision(item: DecisionItem): string {
  if (item.id === "loss-deadline") return "위약금·조건 손해 없이 마감 전에 결정을 끝낼 수 있어요.";
  if (item.id.startsWith("venues")) return "상담 순서와 계약 질문이 선명해져요.";
  if (item.id.startsWith("budget") || item.id === "payment-upcoming") return "예산표와 실제 결제 흐름이 맞춰져요.";
  if (item.id.startsWith("guests")) return "보증인원, 식대, 초대 범위를 같은 기준으로 볼 수 있어요.";
  if (item.id.startsWith("invitation")) return "하객에게 보일 정보를 실수 없이 잠글 수 있어요.";
  if (item.id.startsWith("sdm")) return "상담할 조합과 추가금 질문이 줄어들어요.";
  if (item.id.startsWith("rings")) return "각자 취향 표시만으로 매장 상담 후보가 좁혀져요.";
  if (item.id.startsWith("trip")) return "지역, 항공, 숙소가 같은 예산 기준으로 묶여요.";
  if (item.id.startsWith("ceremony")) return "사회자와 식장이 같은 진행표를 보게 됩니다.";
  if (item.id.startsWith("video")) return "사진과 엔딩 정보를 미리 모아 편집 막판 혼선을 줄여요.";
  if (item.id.startsWith("share")) return "하객 링크와 편집 링크를 헷갈리지 않게 나눌 수 있어요.";
  return "오늘 할 결정이 다음 화면의 기준으로 이어져요.";
}

function buildRouteUrl(path: string, baseUrl?: string): string | undefined {
  if (!baseUrl) return undefined;
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function compactDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function utcStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "decision";
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
