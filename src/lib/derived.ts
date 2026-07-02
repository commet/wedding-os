// 영역 간 파생값 — 한 곳의 데이터로 다른 곳을 똑똑하게 채운다.
// 모든 화면이 같은 계산을 공유하도록 단일 소스로 모은다(읽기 전용, 사용자 데이터를 덮어쓰지 않음).
import type { WeddingData, WeddingVenue, GuestCategory, SdmCategory } from "./schema";
import { ringConsultationProgress } from "./ringConsultation";
import { consultationProgress, consultationFacts, consultationHeadcountBand } from "./sectionConsultation";
import { collectLossDeadlines, lossDdayLabel, type LossDeadline } from "./lossDeadlines";

// 하객 분류 — 계산기/명단 공통 라벨과 표시 순서.
export const GUEST_CATEGORIES: { key: GuestCategory; label: string }[] = [
  { key: "family", label: "가족" },
  { key: "relative", label: "친척" },
  { key: "work", label: "직장" },
  { key: "school", label: "학교" },
  { key: "friend", label: "친구" },
  { key: "acquaintance", label: "지인" },
];
export const GUEST_CATEGORY_LABEL: Record<GuestCategory, string> = {
  family: "가족", relative: "친척", work: "직장", school: "학교", friend: "친구", acquaintance: "지인",
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 참석으로 응답한 하객 수 */
export function attendingCount(data: WeddingData): number {
  return (data.guests ?? []).filter((g) => g.status === "참석").length;
}

/** 불참·미정을 뺀, 식수에 잡히는 실질 인원(참석 + 아직 확정 전 초대) */
export function expectedHeadcount(data: WeddingData): number {
  return (data.guests ?? []).filter((g) => g.status !== "불참" && g.status !== "미정").length;
}

/** 식권 예상 장수 — 참석 + 식사함 하객의 동반 인원 합 (당일 식수 정산용) */
export function mealTicketCount(data: WeddingData): number {
  return (data.guests ?? [])
    .filter((g) => g.status === "참석" && g.meal !== false)
    .reduce((s, g) => s + (g.partyCount ?? 1), 0);
}

/** 계산기에 입력한 예상 인원 합계 (측 무관) */
export function estimateTotal(data: WeddingData): number {
  return (data.headcount?.estimates ?? []).reduce((s, e) => s + (e.expected || 0), 0);
}

/**
 * 계획 인원 — 계약/예산/보증인원 판단에 쓰는 '현재 최선 추정'.
 * 명단이 비었어도 계산기 추정으로 동작하고, 명단이 추정을 넘어서면 명단을 따른다.
 * 계산기·명단이 모두 비어 있으면 상담 답변(규모 밴드)을 대신 쓴다 —
 * 첫 답변부터 보증인원·식대 판단이 바로 작동하게.
 */
export function planningHeadcount(data: WeddingData): number {
  const measured = Math.max(estimateTotal(data), expectedHeadcount(data));
  if (measured > 0) return measured;
  return consultationHeadcountBand(data) ?? 0;
}

export type HeadcountSummary = {
  estTotal: number;
  estBySide: { groom: number; bride: number };
  listed: number;            // 명단에 적힌 인원(불참 제외)
  confirmed: number;         // 참석 회신
  rows: { category: GuestCategory; label: string; groomEst: number; brideEst: number; listed: number }[];
};
/** 예상 인원 계산기의 reconcile 요약 — 분류별 추정 vs 명단, 측별 합계. */
export function headcountSummary(data: WeddingData): HeadcountSummary {
  const estimates = data.headcount?.estimates ?? [];
  const guests = (data.guests ?? []).filter((g) => g.status !== "불참");
  const estOf = (side: "groom" | "bride", cat: GuestCategory) =>
    estimates.find((e) => e.side === side && e.category === cat)?.expected ?? 0;
  const rows = GUEST_CATEGORIES.map(({ key, label }) => ({
    category: key,
    label,
    groomEst: estOf("groom", key),
    brideEst: estOf("bride", key),
    listed: guests.filter((g) => g.category === key).length,
  }));
  const groom = estimates.filter((e) => e.side === "groom").reduce((s, e) => s + e.expected, 0);
  const bride = estimates.filter((e) => e.side === "bride").reduce((s, e) => s + e.expected, 0);
  return {
    estTotal: groom + bride,
    estBySide: { groom, bride },
    listed: guests.length,
    confirmed: attendingCount(data),
    rows,
  };
}

/** 계약 확정한 예식장 (없으면 undefined) */
export function contractedVenue(data: WeddingData): WeddingVenue | undefined {
  return (data.venues ?? []).find((v) => v.status === "계약");
}

export type BudgetTotals = { planned: number; actual: number; overCount: number; overSum: number };
export function budgetTotals(data: WeddingData): BudgetTotals {
  const items = data.budget ?? [];
  const planned = items.reduce((n, b) => n + (b.planned ?? 0), 0);
  const actual = items.reduce((n, b) => n + (b.actual ?? 0), 0);
  const over = items.filter((b) => (b.actual ?? 0) > (b.planned ?? 0));
  const overSum = over.reduce((n, b) => n + ((b.actual ?? 0) - (b.planned ?? 0)), 0);
  return { planned, actual, overCount: over.length, overSum };
}

/** 마감일이 지났는데 아직 못 끝낸 체크리스트 항목 수 */
export function overdueChecklistCount(data: WeddingData, today: string = todayISO()): number {
  let count = 0;
  for (const section of data.checklist) {
    for (const item of section.items) {
      if (!item.done && item.dueDate && item.dueDate.slice(0, 10) < today) count++;
    }
  }
  return count;
}

export type VenueFit = "under" | "tight" | "ok" | "over" | "unknown";
/** 초대 인원 대비 예식장 수용 여유도 */
export function venueCapacityFit(venue: WeddingVenue | undefined, headcount: number): VenueFit {
  if (!venue || !headcount) return "unknown";
  const min = venue.capacityMin;
  const max = venue.capacityMax;
  if (max !== undefined && headcount > max) return "over";
  if (min !== undefined && headcount < min) return "under"; // 최소 보증인원 미달 → 보증금 손해
  if (max !== undefined && headcount >= max * 0.9) return "tight";
  if (min !== undefined || max !== undefined) return "ok";
  return "unknown";
}

export type MealCost = { min?: number; max?: number; headcount: number };
/** 인원 × 1인 식대 → 예상 식대 범위 (원) */
export function mealCostRange(venue: WeddingVenue | undefined, headcount: number): MealCost | null {
  if (!venue || !headcount) return null;
  const min = venue.mealPriceMin ? venue.mealPriceMin * headcount : undefined;
  const max = venue.mealPriceMax ? venue.mealPriceMax * headcount : undefined;
  if (min === undefined && max === undefined) return null;
  return { min, max, headcount };
}

export type BalanceDue = { name: string; amount: number; dueAt: string; daysLeft: number; targetPath: string };
/** 예식장·스드메 등 잔금이 남은 계약을 잔금일 순으로 — 임박/지난 결제 알림용 */
export function upcomingBalances(data: WeddingData, today: string = todayISO()): BalanceDue[] {
  const out: BalanceDue[] = [];
  const add = (name: string, balanceKRW: number | undefined, balanceDueAt: string | undefined, targetPath: string) => {
    if (!balanceKRW || balanceKRW <= 0 || !balanceDueAt) return;
    const dueAt = balanceDueAt.slice(0, 10);
    const daysLeft = Math.round((Date.parse(dueAt) - Date.parse(today)) / 86_400_000);
    if (Number.isNaN(daysLeft)) return;
    out.push({ name, amount: balanceKRW, dueAt, daysLeft, targetPath });
  };
  for (const v of data.venues ?? []) add(v.name, v.balanceKRW, v.balanceDueAt, "/venues");
  for (const s of data.sdm ?? []) add(s.name, s.balanceKRW, s.balanceDueAt, s.category === "snap" ? "/snap" : "/sdm");
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export type TimelineKind = "wedding" | "task" | "balance" | "visit" | "deadline";
export type TimelineEvent = { date: string; daysLeft: number; label: string; kind: TimelineKind; targetPath: string };
/**
 * 흩어진 모든 날짜를 하나의 시간축으로 — 예식 당일·체크리스트 마감·벤더 잔금일·답사일.
 * 오늘 이후(미래)만, 가까운 순. limit 으로 상위 N개.
 */
export function upcomingEvents(data: WeddingData, today: string = todayISO(), limit = 6): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const push = (date: string | undefined, label: string, kind: TimelineKind, targetPath: string) => {
    if (!date) return;
    const d = date.slice(0, 10);
    const daysLeft = Math.round((Date.parse(d) - Date.parse(today)) / 86_400_000);
    if (Number.isNaN(daysLeft) || daysLeft < 0) return; // 미래(오늘 포함)만
    events.push({ date: d, daysLeft, label, kind, targetPath });
  };
  push(data.invitation.date, "예식 당일", "wedding", "/dashboard");
  for (const sec of data.checklist) {
    for (const it of sec.items) {
      if (!it.done && it.dueDate) push(it.dueDate, it.text, "task", "/checklist");
    }
  }
  for (const v of data.venues ?? []) {
    if (v.status === "계약" && (v.balanceKRW ?? 0) > 0) push(v.balanceDueAt, `${v.name} 잔금`, "balance", "/venues");
    push(v.visitedAt, `${v.name} 답사`, "visit", "/venues");
  }
  for (const s of data.sdm ?? []) {
    if (s.status === "계약" && (s.balanceKRW ?? 0) > 0) push(s.balanceDueAt, `${s.name} 잔금`, "balance", s.category === "snap" ? "/snap" : "/sdm");
  }
  // 미루면 손해 마감(무료취소·가계약·보증인원·결제)도 같은 시간축에 — 잔금은 위에서 이미 넣었으므로 제외.
  for (const loss of collectLossDeadlines(data, today)) {
    if (loss.kind === "balance") continue;
    push(loss.date, `${loss.name} ${loss.label}`, "deadline", loss.targetPath);
  }
  events.sort((a, b) => a.daysLeft - b.daysLeft || a.label.localeCompare(b.label));
  return events.slice(0, limit);
}

/** 계약(status=계약) 벤더들의 선금·잔금 합계 — "얼마 걸렸고 얼마 남았나" */
export function contractedTotals(data: WeddingData): { depositTotal: number; balanceTotal: number; count: number } {
  let depositTotal = 0;
  let balanceTotal = 0;
  let count = 0;
  const add = (status: string | undefined, deposit?: number, balance?: number) => {
    if (status !== "계약") return;
    if ((deposit ?? 0) > 0 || (balance ?? 0) > 0) count += 1;
    depositTotal += deposit ?? 0;
    balanceTotal += balance ?? 0;
  };
  for (const v of data.venues ?? []) add(v.status, v.depositKRW, v.balanceKRW);
  for (const s of data.sdm ?? []) add(s.status, s.depositKRW, s.balanceKRW);
  return { depositTotal, balanceTotal, count };
}

/** 청첩장 공유 준비도 — 핵심 5필드 중 채워진 수 */
export function invitationReadiness(data: WeddingData): { filled: number; total: number; missing: string[] } {
  const fields: [string, unknown][] = [
    ["신랑 이름", data.invitation.groomName],
    ["신부 이름", data.invitation.brideName],
    ["예식 날짜", data.invitation.date],
    ["예식 장소", data.invitation.venue],
    ["인사말", data.invitation.greeting],
  ];
  const missing = fields.filter(([, v]) => !v).map(([k]) => k);
  return { filled: fields.length - missing.length, total: fields.length, missing };
}

export type PlanningStatusState = "done" | "active" | "attention" | "empty";
export type PlanningSectionStatus = {
  key: string;
  label: string;
  to: string;
  percent: number;
  state: PlanningStatusState;
  detail: string;
  nextAction: string;
  weight: number;
};
export type PlanningStatusReport = {
  overallPercent: number;
  sections: PlanningSectionStatus[];
  counts: Record<PlanningStatusState, number>;
  nextSections: PlanningSectionStatus[];
};

export const PLANNING_STATE_LABEL: Record<PlanningStatusState, string> = {
  done: "완료",
  active: "진행 중",
  attention: "진행 중",
  empty: "시작 전",
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sectionStatus(
  input: Omit<PlanningSectionStatus, "percent" | "state"> & {
    percent: number;
    attention?: boolean;
  },
): PlanningSectionStatus {
  const percent = clampPercent(input.percent);
  const state: PlanningStatusState = input.attention
    ? percent > 0 ? "attention" : "empty"
    : percent >= 95
      ? "done"
      : percent > 0
        ? "active"
        : "empty";
  return { ...input, percent, state };
}

function daysLeftFrom(date: string | undefined, today: string): number | null {
  if (!date) return null;
  const days = Math.round((Date.parse(date.slice(0, 10)) - Date.parse(today)) / 86_400_000);
  return Number.isNaN(days) ? null : days;
}

function sdmCategoryScore(data: WeddingData, category: SdmCategory): number {
  const vendors = data.sdm.filter((vendor) => vendor.category === category);
  if (vendors.some((vendor) => vendor.status === "계약")) return 100;
  if (vendors.some((vendor) => vendor.status === "상담")) return 65;
  if (vendors.length > 0) return 35;
  return 0;
}

/**
 * 전체 준비 상태판 — 각 화면의 진행률을 실제 결혼 준비 단계로 환산한다.
 * 후보 개수만 세지 않고 계약, 발행, 회신, 결제, 당일 운영처럼 다음 행동이 달라지는 상태를 반영한다.
 */
export function planningStatusReport(data: WeddingData, today: string = todayISO()): PlanningStatusReport {
  const dday = daysLeftFrom(data.invitation.date, today);
  const venues = data.venues ?? [];
  const venueContract = contractedVenue(data);
  const venueTourCount = venues.filter((venue) => venue.status === "투어" || venue.status === "계약").length;
  const headcount = planningHeadcount(data);
  const capacityFit = venueCapacityFit(venueContract, headcount);
  const invitation = invitationReadiness(data);
  const checklistTotal = data.checklist.reduce((count, section) => count + section.items.length, 0);
  const checklistDone = data.checklist.reduce((count, section) => count + section.items.filter((item) => item.done).length, 0);
  const overdue = overdueChecklistCount(data, today);
  const budget = budgetTotals(data);
  const mealCheck = mealBudgetCheck(data);
  const headcountSummaryValue = headcountSummary(data);
  const rsvp = rsvpReadiness(data, today);
  const sdmCategories: SdmCategory[] = ["studio", "dress", "makeup"];
  const sdmScores = sdmCategories.map((category) => sdmCategoryScore(data, category));
  const sdmContracted = sdmCategories.filter((category) =>
    data.sdm.some((vendor) => vendor.category === category && vendor.status === "계약"),
  ).length;
  const snapConsultation = consultationProgress(data, "snap");
  const snapVendors = data.sdm.filter((vendor) => vendor.category === "snap");
  const snapContracted = snapVendors.filter((vendor) => vendor.status === "계약").length;
  const ringsLikedByGroom = data.rings.filter((ring) => ring.likedBy?.includes("groom") || ring.starredBy?.includes("groom")).length;
  const ringsLikedByBride = data.rings.filter((ring) => ring.likedBy?.includes("bride") || ring.starredBy?.includes("bride")).length;
  const pricedRings = data.rings.filter((ring) => (ring.priceKRW ?? 0) > 0).length;
  const ringConsultation = ringConsultationProgress(data);
  const ringConsultationScore = Math.round((ringConsultation.answered / ringConsultation.total) * 25);
  const tripRegionCount = data.honeymoon.regions.length;
  const guestCount = data.guests?.length ?? 0;
  const invitedCount = data.guests?.filter((guest) => guest.status !== "초대 예정").length ?? 0;
  const budgetCount = data.budget?.length ?? 0;
  const budgetMoneyCount = data.budget?.filter((item) => (item.planned ?? 0) > 0 || (item.actual ?? 0) > 0).length ?? 0;
  const paidBudgetCount = data.budget?.filter((item) => item.paid || (item.actual ?? 0) > 0).length ?? 0;
  const ceremonySteps = data.ceremony ?? [];
  const ceremonyDone = ceremonySteps.filter((step) => step.done).length;
  const videoPhotos = data.video?.photos?.length ?? 0;
  const videoActs = data.video?.acts?.length ?? 0;
  const venueConsultation = consultationProgress(data, "venues");
  const sdmConsultation = consultationProgress(data, "sdm");
  const tripConsultation = consultationProgress(data, "trip");
  const invitationConsultation = consultationProgress(data, "invitation");
  const guestConsultation = consultationProgress(data, "guests");
  const budgetConsultation = consultationProgress(data, "budget");
  const checklistConsultation = consultationProgress(data, "checklist");
  const ceremonyConsultation = consultationProgress(data, "ceremony");
  const videoConsultation = consultationProgress(data, "video");
  const shareConsultation = consultationProgress(data, "share");
  const consultationPct = (progress: { answered: number; total: number }, max = 20) =>
    Math.round((progress.answered / progress.total) * max);
  const hasMeaningfulData = !!(
    data.invitation.groomName ||
    data.invitation.brideName ||
    venues.length ||
    data.sdm.length ||
    data.rings.length ||
    budgetCount ||
    guestCount
  );

  const sections: PlanningSectionStatus[] = [
    sectionStatus({
      key: "basics",
      label: "기본 정보",
      to: "/invitation",
      percent: ([data.invitation.groomName, data.invitation.brideName, data.invitation.date, data.invitation.venue].filter(Boolean).length / 4) * 100,
      detail: data.invitation.date
        ? `${data.invitation.venue || "장소 미정"} · ${data.invitation.date}`
        : "예식 날짜가 아직 없어요",
      nextAction: !data.invitation.date ? "예식 날짜 넣기" : !data.invitation.venue ? "식장 이름 넣기" : "두 분 이름 확인",
      weight: 9,
      attention: !data.invitation.date,
    }),
    sectionStatus({
      key: "venues",
      label: "예식장",
      to: "/venues",
      percent: venueContract ? 100 : Math.min(95, consultationPct(venueConsultation, 25) + (data.invitation.venue ? 55 : venueTourCount > 0 ? 45 : venues.length > 0 ? 30 : 0)),
      detail: venueContract
        ? `계약 · ${venueContract.name}`
        : venueTourCount > 0
          ? `${venueTourCount}곳 답사/상담 중`
          : venues.length > 0
            ? `${venues.length}곳 후보`
            : data.invitation.venue
              ? "장소 입력됨"
              : "후보 없음",
      nextAction: venueContract ? "계약 조건·잔금 확인" : !venueConsultation.complete ? "예식장 기준 답하기" : data.invitation.venue ? "식장 정보 확인" : venues.length > 0 ? "답사 후보 정하기" : "예식장 후보 담기",
      weight: 12,
      attention: capacityFit === "over" || capacityFit === "under" || (!venueContract && dday !== null && dday <= 180),
    }),
    sectionStatus({
      key: "sdm",
      label: "스드메",
      to: "/sdm",
      percent: Math.min(100, consultationPct(sdmConsultation, 20) + (sdmScores.reduce((sum, score) => sum + score, 0) / sdmScores.length) * 0.8),
      detail: sdmContracted > 0 ? `기준 ${sdmConsultation.answered}/${sdmConsultation.total} · 계약 ${sdmContracted}/3` : data.sdm.filter((vendor) => vendor.category !== "snap").length > 0 ? `기준 ${sdmConsultation.answered}/${sdmConsultation.total} · 후보 비교 중` : `기준 ${sdmConsultation.answered}/${sdmConsultation.total}`,
      nextAction: !sdmConsultation.complete ? "스드메 기준 답하기" : sdmContracted >= 3 ? "잔금·촬영일 확인" : "빠진 업체 후보 채우기",
      weight: 10,
      attention: sdmContracted < 3 && dday !== null && dday <= 150,
    }),
    sectionStatus({
      key: "snap",
      label: "본식 스냅",
      to: "/snap",
      percent: Math.min(100, consultationPct(snapConsultation, 20) + sdmCategoryScore(data, "snap") * 0.8),
      detail: snapContracted > 0
        ? `기준 ${snapConsultation.answered}/${snapConsultation.total} · 계약 ${snapContracted}곳`
        : snapVendors.length > 0
          ? `기준 ${snapConsultation.answered}/${snapConsultation.total} · 후보 ${snapVendors.length}곳`
          : `기준 ${snapConsultation.answered}/${snapConsultation.total}`,
      nextAction: !snapConsultation.complete
        ? "스냅 기준 답하기"
        : snapContracted > 0
          ? "납품·잔금 조건 확인"
          : snapVendors.length > 0
            ? "상담 후보 고르기"
            : "스냅 후보 담기",
      weight: 4,
      attention: snapContracted === 0 && dday !== null && dday <= 120,
    }),
    sectionStatus({
      key: "rings",
      label: "결혼반지",
      to: "/rings",
      percent: Math.min(100, ringConsultationScore + (data.rings.length > 0 ? 20 + Math.min(20, data.rings.length * 3) + Math.min(20, (ringsLikedByGroom + ringsLikedByBride) * 4) + (pricedRings > 0 ? 15 : 0) : 0)),
      detail: data.rings.length > 0 ? `기준 ${ringConsultation.answered}/${ringConsultation.total} · 신랑 ${ringsLikedByGroom} · 신부 ${ringsLikedByBride}` : `기준 ${ringConsultation.answered}/${ringConsultation.total} · 후보 없음`,
      nextAction: data.rings.length === 0
        ? ringConsultation.answered === 0 ? "반지 질문 고르기" : ringConsultation.answered < ringConsultation.total ? "반지 취향 이어 고르기" : "취향 후보 담기"
        : ringConsultation.answered < ringConsultation.total
          ? "반지 취향 이어 고르기"
          : ringsLikedByGroom === 0 || ringsLikedByBride === 0
            ? "각자 마음 표시하기"
            : "가격과 매장 확인",
      weight: 5,
    }),
    sectionStatus({
      key: "trip",
      label: "신혼여행",
      to: "/trip",
      percent: consultationPct(tripConsultation, 20)
        + (tripRegionCount > 0 ? 20 : 0)
        + (data.honeymoon.startDate && data.honeymoon.endDate ? 15 : 0)
        + (data.flights.length > 0 ? 25 : 0)
        + (data.hotels.length > 0 ? 15 : 0)
        + (data.honeymoon.notes ? 5 : 0),
      detail: tripRegionCount > 0 ? `기준 ${tripConsultation.answered}/${tripConsultation.total} · ${tripRegionCount}곳 · 항공 ${data.flights.length}` : `기준 ${tripConsultation.answered}/${tripConsultation.total}`,
      nextAction: !tripConsultation.complete ? "여행 기준 답하기" : tripRegionCount === 0 ? "여행지 후보 비교" : data.flights.length === 0 ? "항공 후보 넣기" : data.hotels.length === 0 ? "숙소 후보 넣기" : "총액과 일정 확인",
      weight: 7,
    }),
    sectionStatus({
      key: "invitation",
      label: "청첩장",
      to: "/invitation",
      percent: consultationPct(invitationConsultation, 15)
        + Math.round((invitation.filled / invitation.total) * 55)
        + (data.invitation.heroImageUrl ? 10 : 0)
        + ((data.invitation.gallery?.length ?? 0) > 0 ? 5 : 0)
        + (data.publish ? 15 : 0),
      detail: data.publish ? "하객용 링크 발행됨" : invitation.missing.length > 0 ? `기준 ${invitationConsultation.answered}/${invitationConsultation.total} · 빠짐 ${invitation.missing.slice(0, 2).join(", ")}` : `기준 ${invitationConsultation.answered}/${invitationConsultation.total} · 발행 전`,
      nextAction: !invitationConsultation.complete ? "청첩장 기준 답하기" : invitation.missing.length > 0 ? "빠진 정보 채우기" : data.publish ? "하객 시점 확인" : "하객용 링크 발행",
      weight: 11,
      attention: invitation.missing.length > 0 && dday !== null && dday <= 90,
    }),
    sectionStatus({
      key: "guests",
      label: "하객",
      to: "/guests",
      percent: consultationPct(guestConsultation, 20)
        + (headcountSummaryValue.estTotal > 0 ? 20 : 0)
        + (guestCount > 0 ? 20 : 0)
        + (guestCount > 0 ? Math.round((invitedCount / guestCount) * 20) : 0)
        + (rsvp.rate !== null ? Math.round((rsvp.rate / 100) * 20) : 0),
      detail: guestCount > 0 ? `기준 ${guestConsultation.answered}/${guestConsultation.total} · ${guestCount}명 · 회신 ${rsvp.rate ?? 0}%` : headcountSummaryValue.estTotal > 0 ? `기준 ${guestConsultation.answered}/${guestConsultation.total} · 예상 ${headcountSummaryValue.estTotal}명` : `기준 ${guestConsultation.answered}/${guestConsultation.total}`,
      nextAction: !guestConsultation.complete ? "하객 기준 답하기" : guestCount === 0 ? "하객 명단 시작" : invitedCount < guestCount ? "초대 발송 표시" : rsvp.pending > 0 ? "미응답 확인" : "식수 최종 확인",
      weight: 11,
      attention: (guestCount === 0 && dday !== null && dday <= 90) || (rsvp.invited >= 20 && (rsvp.rate ?? 100) < 50),
    }),
    sectionStatus({
      key: "budget",
      label: "예산",
      to: "/budget",
      percent: budgetCount === 0 ? consultationPct(budgetConsultation, 25) : consultationPct(budgetConsultation, 20) + 25 + Math.round((budgetMoneyCount / budgetCount) * 25) + Math.round((paidBudgetCount / budgetCount) * 15) + (budget.overCount === 0 ? 15 : 0),
      detail: budgetCount > 0 ? `기준 ${budgetConsultation.answered}/${budgetConsultation.total} · ${budgetCount}개 항목${budget.overCount > 0 ? ` · 초과 ${budget.overCount}` : ""}` : `기준 ${budgetConsultation.answered}/${budgetConsultation.total}`,
      nextAction: !budgetConsultation.complete ? "예산 기준 답하기" : budgetCount === 0 ? "예산 템플릿 불러오기" : budget.overCount > 0 ? "초과 항목 확인" : mealCheck ? "식대 항목 확인" : "실제 지출 채우기",
      weight: 10,
      attention: budget.overCount > 0 || !!mealCheck,
    }),
    sectionStatus({
      key: "checklist",
      label: "체크리스트",
      to: "/checklist",
      percent: checklistTotal > 0 ? consultationPct(checklistConsultation, 15) + (checklistDone / checklistTotal) * 85 : consultationPct(checklistConsultation, 25),
      detail: checklistTotal > 0 ? `기준 ${checklistConsultation.answered}/${checklistConsultation.total} · ${checklistDone}/${checklistTotal} 완료${overdue > 0 ? ` · 지난 마감 ${overdue}` : ""}` : `기준 ${checklistConsultation.answered}/${checklistConsultation.total}`,
      nextAction: !checklistConsultation.complete ? "준비 리듬 답하기" : checklistTotal === 0 ? "타임라인 불러오기" : overdue > 0 ? "지난 마감 처리" : "이번 주 할 일 확인",
      weight: 10,
      attention: overdue > 0,
    }),
    sectionStatus({
      key: "ceremony",
      label: "식순",
      to: "/ceremony",
      percent: ceremonySteps.length > 0 ? consultationPct(ceremonyConsultation, 20) + Math.max(25, (ceremonyDone / ceremonySteps.length) * 80) : consultationPct(ceremonyConsultation, 25),
      detail: ceremonySteps.length > 0 ? `기준 ${ceremonyConsultation.answered}/${ceremonyConsultation.total} · ${ceremonyDone}/${ceremonySteps.length} 확인` : `기준 ${ceremonyConsultation.answered}/${ceremonyConsultation.total}`,
      nextAction: !ceremonyConsultation.complete ? "본식 진행 기준 답하기" : ceremonySteps.length === 0 ? "기본 식순 불러오기" : ceremonyDone < ceremonySteps.length ? "진행 단계 확인" : "사회자용 시트 저장",
      weight: 5,
      attention: ceremonySteps.length === 0 && dday !== null && dday <= 45,
    }),
    sectionStatus({
      key: "video",
      label: "식전영상",
      to: "/video",
      percent: consultationPct(videoConsultation, 20)
        + (videoPhotos > 0 ? Math.min(55, 20 + videoPhotos * 4) : 0)
        + (videoActs > 0 ? 15 : 0)
        + (data.video?.bgmUrl ? 5 : 0)
        + (data.video?.ending?.message ? 5 : 0),
      detail: videoPhotos > 0 ? `기준 ${videoConsultation.answered}/${videoConsultation.total} · 사진 ${videoPhotos}장` : `기준 ${videoConsultation.answered}/${videoConsultation.total}`,
      nextAction: !videoConsultation.complete ? "영상 기준 답하기" : videoPhotos === 0 ? "사진 넣기" : data.video?.bgmUrl ? "미리보기 확인" : "BGM 정하기",
      weight: 3,
    }),
    sectionStatus({
      key: "share",
      label: "공유/백업",
      to: "/share",
      percent: consultationPct(shareConsultation, 15)
        + (data.preferences.mode === "hosted" || data.preferences.mode === "supabase"
        ? (data.publish ? 85 : 65)
        : data.preferences.lastBackupAt
          ? 60
          : hasMeaningfulData
            ? 30
            : 0),
      detail: data.publish ? "청첩장 링크 있음" : data.preferences.mode === "local" ? `기준 ${shareConsultation.answered}/${shareConsultation.total} · 이 기기에 저장 중` : `기준 ${shareConsultation.answered}/${shareConsultation.total} · 함께 편집 준비`,
      nextAction: !shareConsultation.complete ? "공유 기준 답하기" : data.publish ? "공유 센터 확인" : data.preferences.mode === "local" ? "백업 내려받기" : "공유 링크 만들기",
      weight: 4,
      attention: data.preferences.mode === "local" && hasMeaningfulData && !data.preferences.lastBackupAt,
    }),
  ];

  const totalWeight = sections.reduce((sum, section) => sum + section.weight, 0) || 1;
  const overallPercent = clampPercent(
    sections.reduce((sum, section) => sum + section.percent * section.weight, 0) / totalWeight,
  );
  const counts = sections.reduce<Record<PlanningStatusState, number>>(
    (acc, section) => {
      acc[section.state] += 1;
      return acc;
    },
    { done: 0, active: 0, attention: 0, empty: 0 },
  );
  const stateRank: Record<PlanningStatusState, number> = { attention: 0, empty: 1, active: 2, done: 3 };
  const nextSections = sections
    .filter((section) => section.state !== "done")
    .sort((a, b) => stateRank[a.state] - stateRank[b.state] || b.weight - a.weight || a.percent - b.percent);

  return { overallPercent, sections, counts, nextSections };
}

export type DecisionSection =
  | "venues"
  | "budget"
  | "guests"
  | "invitation"
  | "sdm"
  | "rings"
  | "trip"
  | "checklist"
  | "ceremony"
  | "video"
  | "share";
export type DecisionStage = "now" | "soon" | "later";
export type DecisionRiskLevel = "low" | "medium" | "high";
export type DecisionItem = {
  id: string;
  section: DecisionSection;
  stage: DecisionStage;
  title: string;
  whyNow: string;
  preparedFacts: string[];
  missingInputs: string[];
  nextAction: string;
  to: string;
  risk?: { level: DecisionRiskLevel; label: string };
  score: number;
};
export type DecisionMap = {
  items: DecisionItem[];
  now: DecisionItem[];
  soon: DecisionItem[];
  later: DecisionItem[];
  counts: Record<DecisionStage, number>;
  primary?: DecisionItem;
};

const DECISION_STAGE_RANK: Record<DecisionStage, number> = { now: 0, soon: 1, later: 2 };
const DECISION_RISK_RANK: Record<DecisionRiskLevel, number> = { high: 0, medium: 1, low: 2 };

function compactFacts(values: Array<string | undefined | false | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function decisionRiskRank(item: DecisionItem): number {
  return item.risk ? DECISION_RISK_RANK[item.risk.level] : 3;
}

function sortDecisionItems(items: DecisionItem[]): DecisionItem[] {
  return [...items].sort(
    (a, b) =>
      DECISION_STAGE_RANK[a.stage] - DECISION_STAGE_RANK[b.stage] ||
      decisionRiskRank(a) - decisionRiskRank(b) ||
      b.score - a.score ||
      a.title.localeCompare(b.title),
  );
}

function missingContractFields(venue: WeddingVenue | undefined): string[] {
  if (!venue) return [];
  const contract = venue.contract ?? {};
  const fields: Array<[keyof NonNullable<WeddingVenue["contract"]>, string]> = [
    ["quote", "견적 기준"],
    ["payment", "결제 일정"],
    ["cancellation", "취소·변경"],
    ["included", "포함 항목"],
    ["extras", "별도 비용"],
    ["evidence", "증빙 보관"],
  ];
  return fields.filter(([key]) => !contract[key]?.trim()).map(([, label]) => label);
}

/**
 * 함께 결정 지도 — 저장 스키마를 바꾸지 않고 현재 데이터에서 "지금 같이 보면 좋은 결정"을 파생한다.
 * 책임자를 추적하지 않는다. 결정 시점, 판단 재료, 남은 확인만 보여준다.
 */
export function decisionMap(data: WeddingData, today: string = todayISO()): DecisionMap {
  const items: DecisionItem[] = [];
  const dday = daysLeftFrom(data.invitation.date, today);
  const venues = data.venues ?? [];
  const venueContract = contractedVenue(data);
  const headcount = planningHeadcount(data);
  const headcountValue = headcountSummary(data);
  const capacityFit = venueCapacityFit(venueContract, headcount);
  const budget = budgetTotals(data);
  const mealCheck = mealBudgetCheck(data);
  const invitation = invitationReadiness(data);
  const overdue = overdueChecklistCount(data, today);
  const balances = upcomingBalances(data, today);
  const lossDeadlines = collectLossDeadlines(data, today);
  const venueConsultation = consultationProgress(data, "venues");
  const sdmConsultation = consultationProgress(data, "sdm");
  const tripConsultation = consultationProgress(data, "trip");
  const ringProgress = ringConsultationProgress(data);
  const ringsLikedByGroom = data.rings.filter((ring) => ring.likedBy?.includes("groom") || ring.starredBy?.includes("groom")).length;
  const ringsLikedByBride = data.rings.filter((ring) => ring.likedBy?.includes("bride") || ring.starredBy?.includes("bride")).length;
  const sdmCore = data.sdm.filter((vendor) => vendor.category !== "snap");
  const sdmContracted = sdmCore.filter((vendor) => vendor.status === "계약").length;
  const tripRegionCount = data.honeymoon.regions.length;
  const ceremonySteps = data.ceremony ?? [];
  const ceremonyDone = ceremonySteps.filter((step) => step.done).length;
  const videoPhotoCount = data.video?.photos?.length ?? 0;
  const videoActCount = data.video?.acts?.length ?? 0;
  const hasMeaningfulData = !!(
    data.invitation.groomName ||
    data.invitation.brideName ||
    venues.length ||
    data.sdm.length ||
    data.rings.length ||
    (data.budget ?? []).length ||
    (data.guests ?? []).length
  );

  const add = (item: DecisionItem) => {
    if (items.some((existing) => existing.id === item.id)) return;
    items.push({
      ...item,
      preparedFacts: item.preparedFacts.length ? item.preparedFacts : ["아직 정리된 재료가 적어요"],
      missingInputs: item.missingInputs.length ? item.missingInputs : ["같이 볼 결정을 하나만 고르면 됩니다"],
    });
  };

  // ── 미루면 손해 — 돈이 걸린 마감이 가장 먼저 올라온다 ──
  // 잔금(balance)은 아래 payment-upcoming 이 다루므로 그 외 마감(무료취소·가계약·보증인원·결제)만.
  const urgentLoss = lossDeadlines.find((entry) => entry.kind !== "balance" && entry.daysLeft <= 21);
  if (urgentLoss) {
    const lossTitleByKind: Record<LossDeadline["kind"], string> = {
      "free-cancel": "무료취소 기한 전에 유지·취소 정하기",
      "hold-expiry": "가계약 만료 전에 본계약 정하기",
      "guarantee-due": "보증인원 확정하기",
      balance: "다가오는 잔금 확인하기",
      "budget-due": "결제 마감 확인하기",
    };
    add({
      id: "loss-deadline",
      section: urgentLoss.targetPath === "/budget" ? "budget" : urgentLoss.targetPath === "/trip" ? "trip" : urgentLoss.targetPath === "/sdm" || urgentLoss.targetPath === "/snap" ? "sdm" : "venues",
      stage: "now",
      title: lossTitleByKind[urgentLoss.kind],
      whyNow: `${urgentLoss.name}의 ${urgentLoss.label}이 ${lossDdayLabel(urgentLoss.daysLeft)}이에요. ${urgentLoss.lossHint}.`,
      preparedFacts: compactFacts([
        `${urgentLoss.name} · ${urgentLoss.label} ${urgentLoss.date.slice(5).replace("-", ".")}`,
        urgentLoss.amountKRW ? `걸린 금액 약 ${formatKRW(urgentLoss.amountKRW)}` : undefined,
      ]),
      missingInputs: ["유지할지 취소할지", "조건 변경 가능 여부", "다음 확인 통화 날짜"],
      nextAction: "마감 조건 보기",
      to: urgentLoss.targetPath,
      risk: { level: urgentLoss.daysLeft <= 7 ? "high" : "medium", label: `${urgentLoss.label} ${lossDdayLabel(urgentLoss.daysLeft)}` },
      score: urgentLoss.daysLeft <= 7 ? 100 : 93,
    });
  }

  if (!data.invitation.date && (data.invitation.groomName || data.invitation.brideName || data.preferences.mode)) {
    add({
      id: "basics-date",
      section: "invitation",
      stage: "now",
      title: "예식 날짜 기준 정하기",
      whyNow: "날짜가 정해지면 체크리스트 마감과 계약 확인 시점이 한 번에 맞춰져요.",
      preparedFacts: compactFacts([
        data.invitation.groomName || data.invitation.brideName ? "두 사람 이름은 시작됐어요" : undefined,
      ]),
      missingInputs: ["예식 날짜", "아직 미정이면 후보 월"],
      nextAction: "날짜 기준 넣기",
      to: "/invitation",
      risk: { level: "medium", label: "일정 기준 없음" },
      score: 96,
    });
  }

  if (!venueContract && (venues.length >= 2 || (dday !== null && dday <= 240))) {
    const stage: DecisionStage = dday !== null && dday <= 180 ? "now" : "soon";
    add({
      id: "venues-tour-order",
      section: "venues",
      stage,
      title: "예식장 답사 순서 정하기",
      whyNow: dday !== null && dday <= 180
        ? "큰 계약은 시간대와 조건이 먼저 빠지는 편이라, 답사 순서만 정해도 다음 상담을 바로 잡을 수 있어요."
        : "후보가 모였을 때 1순위만 같이 고르면 상담이 훨씬 빨라져요.",
      preparedFacts: compactFacts([
        venues.length > 0 ? `후보 ${venues.length}곳` : undefined,
        ...consultationFacts(data, "venues", 2),
        data.invitation.venue ? `입력된 장소: ${data.invitation.venue}` : undefined,
      ]),
      missingInputs: ["답사 1순위", "상담 가능한 날짜", "식대·보증인원 상한"],
      nextAction: "후보 비교 보기",
      to: venues.length > 0 ? "/venues" : "/venues?starter=1",
      risk: stage === "now" ? { level: "high", label: "큰 계약 시점" } : { level: "medium", label: "후보 좁히기" },
      score: stage === "now" ? 94 : 82,
    });
  }

  const contractMissing = missingContractFields(venueContract);
  if (venueContract && contractMissing.length >= 2) {
    add({
      id: "venues-contract-terms",
      section: "venues",
      stage: "now",
      title: "계약 전 확인 조건 채우기",
      whyNow: "계약한 뒤에는 말로 들은 조건을 되짚기 어려워요. 견적, 결제, 취소 조건만 먼저 남기면 안전합니다.",
      preparedFacts: compactFacts([
        `계약 식장: ${venueContract.name}`,
        venueContract.mealPriceMin ? `식대 ${formatKRW(venueContract.mealPriceMin)}부터` : undefined,
        headcount > 0 ? `예상 하객 ${headcount}명` : undefined,
      ]),
      missingInputs: contractMissing.slice(0, 4),
      nextAction: "계약 조건 채우기",
      to: "/venues",
      risk: { level: "high", label: "계약 조건 누락" },
      score: 98,
    });
  }

  if (((data.budget ?? []).length === 0 || budget.planned === 0) && !data.budgetMeta?.capKRW) {
    const stage: DecisionStage = venueContract || venues.length > 0 || (dday !== null && dday <= 240) ? "now" : "soon";
    add({
      id: "budget-total-cap",
      section: "budget",
      stage,
      title: "전체 예산 상한 정하기",
      whyNow: "예산 상한이 있어야 식대, 스드메, 반지, 여행 후보를 같은 기준으로 비교할 수 있어요.",
      preparedFacts: compactFacts([
        ...consultationFacts(data, "budget", 2),
        venues.length > 0 ? `예식장 후보 ${venues.length}곳` : undefined,
        headcount > 0 ? `예상 하객 ${headcount}명` : undefined,
      ]),
      missingInputs: ["총 예산 상한", "꼭 지킬 항목", "줄여도 되는 항목"],
      nextAction: "예산 기준 잡기",
      to: "/budget",
      risk: stage === "now" ? { level: "medium", label: "비교 기준 없음" } : undefined,
      score: stage === "now" ? 88 : 70,
    });
  }

  if (mealCheck) {
    add({
      id: "budget-meal-range",
      section: "budget",
      stage: "now",
      title: "식대 예산 범위 확인하기",
      whyNow: "식대는 하객 수와 바로 연결돼서, 낮게 잡히면 전체 예산이 한 번에 흔들릴 수 있어요.",
      preparedFacts: compactFacts([
        `예상 식대 약 ${formatKRW(mealCheck.expected)}`,
        mealCheck.planned ? `예산표 식대 ${formatKRW(mealCheck.planned)}` : undefined,
        headcount > 0 ? `예상 하객 ${headcount}명` : undefined,
      ]),
      missingInputs: [mealCheck.kind === "missing" ? "예산표 식대 항목" : "식대 상한 재확인", "음주류·봉사료 포함 여부"],
      nextAction: "식대 예산 보기",
      to: "/budget",
      risk: { level: "high", label: "예산 흔들림" },
      score: 95,
    });
  }

  if (headcount === 0) {
    const stage: DecisionStage = venueContract || venues.length > 0 || (dday !== null && dday <= 180) ? "now" : "soon";
    add({
      id: "guests-headcount-band",
      section: "guests",
      stage,
      title: "예상 하객 범위 정하기",
      whyNow: "하객 범위가 있어야 보증인원, 식대 예산, 청첩장 발송 시점을 같이 볼 수 있어요.",
      preparedFacts: compactFacts([
        ...consultationFacts(data, "guests", 2),
        venueContract ? `계약 식장: ${venueContract.name}` : undefined,
        venues.length > 0 ? `비교 중인 식장 ${venues.length}곳` : undefined,
      ]),
      missingInputs: ["신랑측 예상", "신부측 예상", "부모님 확인 필요 인원"],
      nextAction: "하객 범위 잡기",
      to: "/guests",
      risk: stage === "now" ? { level: "medium", label: "보증인원 기준 없음" } : undefined,
      score: stage === "now" ? 86 : 68,
    });
  }

  if (venueContract && (capacityFit === "over" || capacityFit === "under")) {
    add({
      id: "guests-capacity-fit",
      section: "guests",
      stage: "now",
      title: "보증인원과 초대 범위 맞추기",
      whyNow: capacityFit === "over"
        ? "초대 규모가 수용 범위를 넘으면 테이블, 식수, 홀 변경을 빨리 확인해야 해요."
        : "초대 규모가 최소 보증보다 적으면 식대와 보증금 손해가 생길 수 있어요.",
      preparedFacts: compactFacts([
        `예상 하객 ${headcount}명`,
        venueContract.capacityMin ? `최소 보증 ${venueContract.capacityMin}명` : undefined,
        venueContract.capacityMax ? `최대 수용 ${venueContract.capacityMax}명` : undefined,
      ]),
      missingInputs: ["최종 초대 범위", "보증인원 조정 가능 여부", "테이블 배치 여유"],
      nextAction: "하객 기준 보기",
      to: capacityFit === "over" ? "/guests" : "/venues",
      risk: { level: "high", label: capacityFit === "over" ? "수용 초과" : "보증 미달" },
      score: 99,
    });
  }

  if ((invitation.missing.length > 0 || !data.publish) && dday !== null && dday <= 100) {
    add({
      id: "invitation-public-info",
      section: "invitation",
      stage: dday <= 70 ? "now" : "soon",
      title: "하객에게 공개할 정보 정하기",
      whyNow: "청첩장은 발송 직전보다 조금 일찍 같이 보면, 주소·시간·계좌처럼 민감한 정보를 차분히 확인할 수 있어요.",
      preparedFacts: compactFacts([
        invitation.filled > 0 ? `기본 정보 ${invitation.filled}/${invitation.total}` : undefined,
        data.invitation.venue ? `장소: ${data.invitation.venue}` : undefined,
        data.publish ? "하객용 링크 발행됨" : undefined,
      ]),
      missingInputs: invitation.missing.length > 0 ? invitation.missing.slice(0, 4) : ["발행 전 하객 시점 확인"],
      nextAction: "청첩장 확인",
      to: "/invitation",
      risk: dday <= 70 ? { level: "medium", label: "발송 준비" } : undefined,
      score: dday <= 70 ? 86 : 72,
    });
  }

  if (data.rings.length >= 3 && (ringsLikedByGroom === 0 || ringsLikedByBride === 0)) {
    const stage: DecisionStage = dday !== null && dday <= 160 ? "now" : "later";
    add({
      id: "rings-shared-shortlist",
      section: "rings",
      stage,
      title: "같이 볼 반지 후보 좁히기",
      whyNow: "반지는 취향 차이가 빨리 드러나는 항목이라, 각자 마음에 드는 후보만 표시해도 매장 상담이 쉬워져요.",
      preparedFacts: compactFacts([
        `후보 ${data.rings.length}개`,
        ringProgress.answered > 0 ? `취향 기준 ${ringProgress.answered}/${ringProgress.total}` : undefined,
        ringsLikedByGroom > 0 ? `신랑 표시 ${ringsLikedByGroom}개` : undefined,
        ringsLikedByBride > 0 ? `신부 표시 ${ringsLikedByBride}개` : undefined,
      ]),
      missingInputs: ["각자 마음에 드는 후보 표시", "예산 상한", "매장 상담 우선순위"],
      nextAction: "반지 후보 보기",
      to: "/rings",
      score: stage === "now" ? 74 : 45,
    });
  }

  if (sdmContracted < 3 && (sdmCore.length > 0 || (dday !== null && dday <= 170))) {
    const stage: DecisionStage = dday !== null && dday <= 130 ? "now" : "soon";
    add({
      id: "sdm-core-choice",
      section: "sdm",
      stage,
      title: "스드메 상담 후보 고르기",
      whyNow: "촬영과 가봉 일정은 뒤로 갈수록 선택지가 줄어들 수 있어요. 먼저 상담할 조합만 정해도 다음 단계가 열립니다.",
      preparedFacts: compactFacts([
        sdmCore.length > 0 ? `후보 ${sdmCore.length}곳` : undefined,
        ...consultationFacts(data, "sdm", 2),
        sdmContracted > 0 ? `계약 ${sdmContracted}/3` : undefined,
      ]),
      missingInputs: ["상담 1순위", "촬영 희망 시기", "드레스/메이크업 우선순위"],
      nextAction: "스드메 후보 보기",
      to: "/sdm",
      risk: stage === "now" ? { level: "medium", label: "일정 선택지 감소" } : undefined,
      score: stage === "now" ? 80 : 62,
    });
  }

  if ((tripRegionCount === 0 || data.flights.length === 0 || data.hotels.length === 0) && dday !== null && dday <= 180) {
    const stage: DecisionStage = dday <= 120 ? "now" : "soon";
    add({
      id: "trip-direction",
      section: "trip",
      stage,
      title: "신혼여행 방향 정하기",
      whyNow: "여행지는 항공권과 숙소 가격이 같이 움직여요. 지역 2~3곳만 정해도 실제 예산 비교가 시작됩니다.",
      preparedFacts: compactFacts([
        ...consultationFacts(data, "trip", 2),
        tripRegionCount > 0 ? `여행지 후보 ${tripRegionCount}곳` : undefined,
        data.flights.length > 0 ? `항공 후보 ${data.flights.length}개` : undefined,
        data.hotels.length > 0 ? `숙소 후보 ${data.hotels.length}곳` : undefined,
      ]),
      missingInputs: compactFacts([
        tripRegionCount === 0 ? "여행지 후보" : undefined,
        data.flights.length === 0 ? "항공 후보" : undefined,
        data.hotels.length === 0 ? "숙소 후보" : undefined,
      ]),
      nextAction: "여행 기준 보기",
      to: tripRegionCount === 0 ? "/trip?starter=1" : "/trip",
      risk: stage === "now" ? { level: "medium", label: "가격 변동" } : undefined,
      score: stage === "now" ? 78 : 60,
    });
  }

  if (overdue > 0) {
    add({
      id: "checklist-overdue",
      section: "checklist",
      stage: "now",
      title: "지난 마감 정리하기",
      whyNow: "지난 마감은 계속 남겨두면 오늘 볼 결정까지 흐려져요. 필요한 것만 다시 날짜를 잡고, 끝난 일은 지우면 됩니다.",
      preparedFacts: [`지난 마감 ${overdue}건`],
      missingInputs: ["다시 잡을 일정", "이미 끝난 항목"],
      nextAction: "마감 정리하기",
      to: "/checklist",
      risk: { level: "medium", label: "마감 지남" },
      score: 84,
    });
  }

  if (dday !== null && dday <= 45 && ceremonySteps.length > 0 && ceremonyDone < ceremonySteps.length) {
    const roleMissing = ceremonySteps.filter((step) => !step.role?.trim()).length;
    const musicMissing = ceremonySteps.filter((step) => !step.music?.trim()).length;
    add({
      id: "ceremony-run-of-show",
      section: "ceremony",
      stage: dday <= 21 ? "now" : "soon",
      title: "본식 진행표 같이 확인하기",
      whyNow: "식순은 사회자, 식장, 가족 동선이 함께 맞아야 해서 늦게 보면 현장 질문이 늘어날 수 있어요.",
      preparedFacts: compactFacts([
        `식순 ${ceremonyDone}/${ceremonySteps.length} 확인`,
        roleMissing > 0 ? `담당 없음 ${roleMissing}개` : "담당 입력됨",
        musicMissing > 0 ? `음악 없음 ${musicMissing}개` : "음악 입력됨",
      ]),
      missingInputs: compactFacts([
        roleMissing > 0 ? "담당자 빈칸" : undefined,
        musicMissing > 0 ? "음악 빈칸" : undefined,
        "사회자에게 보낼 최종본",
      ]),
      nextAction: "진행표 보기",
      to: "/ceremony",
      risk: dday <= 21 ? { level: "medium", label: "본식 임박" } : undefined,
      score: dday <= 21 ? 82 : 64,
    });
  }

  if (dday !== null && dday <= 70 && (videoPhotoCount < 30 || videoActCount === 0 || !data.video?.ending?.venue)) {
    add({
      id: "video-storyboard",
      section: "video",
      stage: dday <= 45 ? "now" : "soon",
      title: "식전영상 구성 정하기",
      whyNow: "영상은 사진을 고르는 시간이 오래 걸려요. 챕터와 엔딩 정보만 먼저 정해도 편집 막판 혼선을 줄일 수 있습니다.",
      preparedFacts: compactFacts([
        videoActCount > 0 ? `챕터 ${videoActCount}개` : undefined,
        videoPhotoCount > 0 ? `사진 ${videoPhotoCount}장` : undefined,
        data.video?.ending?.venue ? "엔딩 장소 있음" : undefined,
      ]),
      missingInputs: compactFacts([
        videoActCount === 0 ? "영상 챕터" : undefined,
        videoPhotoCount < 30 ? "사진 30장 이상" : undefined,
        !data.video?.ending?.venue ? "엔딩 날짜·장소" : undefined,
      ]),
      nextAction: "영상 구성 보기",
      to: "/video",
      risk: dday <= 45 ? { level: "medium", label: "편집 시간 필요" } : undefined,
      score: dday <= 45 ? 76 : 58,
    });
  }

  const nextBalance = balances.find((balance) => balance.daysLeft <= 14);
  if (nextBalance) {
    add({
      id: "payment-upcoming",
      section: "budget",
      stage: "now",
      title: "다가오는 잔금 확인하기",
      whyNow: "잔금은 일정과 금액을 같이 확인해야 해서, 늦게 보면 계좌·카드·현금영수증 조건을 놓치기 쉬워요.",
      preparedFacts: compactFacts([
        `${nextBalance.name} · ${formatKRW(nextBalance.amount)}`,
        nextBalance.daysLeft < 0 ? `${Math.abs(nextBalance.daysLeft)}일 지남` : nextBalance.daysLeft === 0 ? "오늘" : `D-${nextBalance.daysLeft}`,
      ]),
      missingInputs: ["결제 방식", "증빙 보관 위치", "잔금 전 확인 조건"],
      nextAction: "잔금 조건 보기",
      to: nextBalance.targetPath,
      risk: { level: nextBalance.daysLeft <= 3 ? "high" : "medium", label: "결제 임박" },
      score: nextBalance.daysLeft <= 3 ? 100 : 90,
    });
  }

  if (hasMeaningfulData && data.preferences.mode === "local" && !data.preferences.lastBackupAt) {
    add({
      id: "share-collaboration-safe",
      section: "share",
      stage: "soon",
      title: "같이 볼 준비판 안전하게 공유하기",
      whyNow: "혼자 정리한 내용이 많아졌다면, 하객 링크와 편집 링크를 구분해두는 게 먼저예요.",
      preparedFacts: compactFacts([
        venues.length > 0 ? `예식장 후보 ${venues.length}곳` : undefined,
        (data.budget ?? []).length > 0 ? `예산 항목 ${(data.budget ?? []).length}개` : undefined,
        (data.guests ?? []).length > 0 ? `하객 ${(data.guests ?? []).length}명` : undefined,
      ]),
      missingInputs: ["함께 편집 방식", "최신 백업", "하객용 링크와 편집 링크 구분"],
      nextAction: "공유 센터 보기",
      to: "/share",
      risk: { level: "medium", label: "기기 저장만 사용" },
      score: 66,
    });
  }

  const sorted = sortDecisionItems(items);
  const now = sorted.filter((item) => item.stage === "now");
  const soon = sorted.filter((item) => item.stage === "soon");
  const later = sorted.filter((item) => item.stage === "later");
  return {
    items: sorted,
    now,
    soon,
    later,
    counts: { now: now.length, soon: soon.length, later: later.length },
    primary: sorted[0],
  };
}

export type WeddingPhase = { key: string; label: string; focus: string };
/**
 * 남은 일수(D-day)로 현재 준비 '국면'을 판단 — 체크리스트 템플릿의 시기 분포에 맞춤.
 * 에이전트가 "지금 어느 단계인지"를 알고 말하게 하는 기반.
 */
export function weddingPhase(dday: number | null): WeddingPhase {
  if (dday === null) return { key: "undated", label: "날짜 정하기", focus: "예식 날짜를 정하면 준비 일정이 한 번에 잡혀요." };
  if (dday < 0) return { key: "after", label: "결혼 후", focus: "감사 인사와 비용 정산을 마무리하는 시기예요." };
  if (dday <= 14) return { key: "week", label: "본식 주간", focus: "큐시트·봉투·준비물 등 당일 운영만 남았어요." };
  if (dday <= 45) return { key: "final", label: "마무리", focus: "청첩장 발송·가봉·리허설·잔금을 마치는 구간이에요." };
  if (dday <= 90) return { key: "confirm", label: "확정", focus: "청첩장·하객·신혼여행·식순을 확정하는 시기예요." };
  if (dday <= 150) return { key: "detail", label: "디테일", focus: "반지·스냅·드레스와 청첩장 방향을 정하는 구간이에요." };
  if (dday <= 300) return { key: "contract", label: "큰 계약", focus: "예식장·스드메 같은 큰 계약을 마무리하는 시기예요." };
  return { key: "start", label: "준비 시작", focus: "예식장과 날짜부터 정하면 나머지가 수월해져요." };
}

export type RsvpReadiness = { invited: number; responded: number; pending: number; rate: number | null; daysSinceFirstInvite: number | null };
/** 회신 진척 — 초대 보낸 사람 대비 참석/불참 응답 비율, 첫 초대 후 경과일. */
export function rsvpReadiness(data: WeddingData, today: string = todayISO()): RsvpReadiness {
  const guests = data.guests ?? [];
  const invited = guests.filter((g) => g.status !== "초대 예정");
  const responded = guests.filter((g) => g.status === "참석" || g.status === "불참");
  const rate = invited.length > 0 ? Math.round((responded.length / invited.length) * 100) : null;
  const dates = guests.map((g) => g.invitedAt).filter((d): d is string => !!d).map((d) => d.slice(0, 10)).sort();
  const daysSinceFirstInvite = dates.length
    ? Math.round((Date.parse(today) - Date.parse(dates[0])) / 86_400_000)
    : null;
  return { invited: invited.length, responded: responded.length, pending: invited.length - responded.length, rate, daysSinceFirstInvite };
}

export type MealBudgetCheck = { kind: "missing" | "low"; expected: number; planned?: number };
/** 예상 식대(계약 식장 단가 × 인원) 대비 예산표의 식대 항목 점검 — 빠졌거나 크게 모자라면 알림. */
export function mealBudgetCheck(data: WeddingData): MealBudgetCheck | null {
  const range = mealCostRange(contractedVenue(data), planningHeadcount(data));
  if (!range) return null;
  const expected = range.max ?? range.min ?? 0;
  if (expected <= 0) return null;
  const budget = data.budget ?? [];
  if (budget.length === 0) return null; // 예산 시작 전엔 보채지 않음
  const mealItem = budget.find((b) => /식대|식사/.test(b.category));
  if (!mealItem) return { kind: "missing", expected };
  const planned = mealItem.planned ?? mealItem.actual ?? 0;
  if (planned > 0 && planned < expected * 0.7) return { kind: "low", expected, planned };
  return null;
}

// 분류별 1인 평균 축의금 가정치(원) — 거친 참고값. 지역·관계·시기에 따라 크게 다름.
// 직계가족·혼주 지인은 보통 별도라 가족은 낮게 잡고, 사용자가 조정할 수 있다.
export const GIFT_AVG_DEFAULT: Record<GuestCategory, number> = {
  family: 100_000,
  relative: 100_000,
  work: 50_000,
  school: 70_000,
  friend: 70_000,
  acquaintance: 50_000,
};

export function giftAvgFor(data: WeddingData, category: GuestCategory): number {
  const override = data.headcount?.giftAvg?.find((g) => g.category === category);
  return override ? override.krw : GIFT_AVG_DEFAULT[category];
}

export type GiftIncome = {
  total: number;
  byCategory: { category: GuestCategory; label: string; count: number; avg: number; sum: number }[];
  basis: "estimate" | "listed";
  count: number;
};
/** 예상 축의금 — 분류별 (예상 인원 × 1인 평균). 예상치가 없으면 명단의 분류별 인원으로. */
export function expectedGiftIncome(data: WeddingData): GiftIncome | null {
  const sum = headcountSummary(data);
  const useEstimate = sum.estTotal > 0;
  const byCategory = sum.rows.map((r) => {
    const count = useEstimate ? r.groomEst + r.brideEst : r.listed;
    const avg = giftAvgFor(data, r.category);
    return { category: r.category, label: r.label, count, avg, sum: count * avg };
  });
  const total = byCategory.reduce((s, r) => s + r.sum, 0);
  const count = byCategory.reduce((s, r) => s + r.count, 0);
  if (count === 0) return null;
  return { total, byCategory, basis: useEstimate ? "estimate" : "listed", count };
}

export type BreakEven = { gift: number; mealCost: number | null; plannedBudget: number; vsMeal: number | null };
/** 본전 — 예상 축의금 vs 예상 식대·총예산. "축의금으로 메워지나"에 답한다. */
export function breakEven(data: WeddingData): BreakEven | null {
  const income = expectedGiftIncome(data);
  if (!income) return null;
  const meal = mealCostRange(contractedVenue(data), planningHeadcount(data));
  const mealCost = meal ? (meal.max ?? meal.min ?? null) : null;
  const plannedBudget = (data.budget ?? []).reduce((s, b) => s + (b.planned ?? 0), 0);
  return { gift: income.total, mealCost, plannedBudget, vsMeal: mealCost !== null ? income.total - mealCost : null };
}

// ── 파트 간 숫자 흐름 — 각 화면의 확정 숫자가 예산으로 자동 제안된다 ──

export type TripCostEstimate = {
  flightKRW?: number;   // 가장 싼 항공 후보
  hotelKRW?: number;    // 가장 싼 숙소 × 박수
  nights?: number;
  total: number;
  basis: string;        // "항공 최저 150만 + 숙소 5박 200만"
};
/** 신혼여행 예상 총액 — 담아둔 항공·숙소 후보에서 최저 조합을 파생. */
export function tripCostEstimate(data: WeddingData): TripCostEstimate | null {
  const flightPrices = data.flights.map((f) => f.priceKRW ?? 0).filter((p) => p > 0);
  const flightKRW = flightPrices.length ? Math.min(...flightPrices) : undefined;
  let nights: number | undefined;
  if (data.honeymoon.startDate && data.honeymoon.endDate) {
    const n = Math.round((Date.parse(data.honeymoon.endDate.slice(0, 10)) - Date.parse(data.honeymoon.startDate.slice(0, 10))) / 86_400_000);
    if (Number.isFinite(n) && n > 0) nights = n;
  }
  const hotelNightPrices = (data.hotels ?? [])
    .map((h) => Math.min(...(h.rooms ?? []).map((r) => r.pricePerNight ?? Infinity)))
    .filter((p) => Number.isFinite(p) && p > 0);
  const cheapestNight = hotelNightPrices.length ? Math.min(...hotelNightPrices) : undefined;
  const hotelKRW = cheapestNight !== undefined ? cheapestNight * (nights ?? 5) : undefined;
  const total = (flightKRW ?? 0) + (hotelKRW ?? 0);
  if (total <= 0) return null;
  const basisParts = [
    flightKRW ? `항공 최저 ${formatKRW(flightKRW)}` : undefined,
    hotelKRW ? `숙소 ${nights ?? 5}박 약 ${formatKRW(hotelKRW)}` : undefined,
  ].filter(Boolean);
  return { flightKRW, hotelKRW, nights, total, basis: basisParts.join(" + ") };
}

export type BudgetSyncSuggestion = {
  key: string;
  /** 매칭된 기존 예산 항목 (없으면 새로 만들 것을 제안) */
  itemId?: string;
  categoryLabel: string;   // 항목 이름 (새로 만들 때 사용)
  suggestedKRW: number;
  currentKRW?: number;     // 매칭된 항목의 현재 planned
  basis: string;           // 근거 — "계약 식장 식대 9만원 × 200명"
  from: string;            // 출처 화면 라벨
  to: string;              // 출처 화면 경로
};
/**
 * 예산 동기화 제안 — 예식장·스드메·반지·여행의 확정/후보 숫자를 예산표 항목과 비교해
 * "가져오기" 한 번으로 반영할 수 있는 제안 목록을 만든다. 사용자가 같은 숫자를 두 번 치지 않게.
 */
export function budgetSyncSuggestions(data: WeddingData): BudgetSyncSuggestion[] {
  const out: BudgetSyncSuggestion[] = [];
  const items = data.budget ?? [];
  const findItem = (pattern: RegExp) => items.find((b) => pattern.test(b.category));
  const propose = (
    key: string,
    pattern: RegExp,
    categoryLabel: string,
    suggestedKRW: number,
    basis: string,
    from: string,
    to: string,
  ) => {
    if (!suggestedKRW || suggestedKRW <= 0) return;
    const item = findItem(pattern);
    const currentKRW = item?.planned;
    // 이미 비슷하게 잡혀 있으면(±10%) 제안하지 않는다 — 소음 방지
    if (currentKRW && Math.abs(currentKRW - suggestedKRW) <= suggestedKRW * 0.1) return;
    out.push({ key, itemId: item?.id, categoryLabel, suggestedKRW, currentKRW, basis, from, to });
  };

  const venue = contractedVenue(data);
  const headcount = planningHeadcount(data);
  const meal = mealCostRange(venue, headcount);
  if (venue && meal) {
    const expected = meal.max ?? meal.min ?? 0;
    const unit = venue.mealPriceMax ?? venue.mealPriceMin ?? 0;
    propose(
      "venue-meal", /식대|식사/, "예식장 식대", expected,
      `${venue.name} 식대 ${formatKRW(unit)} × ${headcount}명`, "예식장", "/venues",
    );
  }
  if (venue && ((venue.depositKRW ?? 0) > 0 || (venue.balanceKRW ?? 0) > 0)) {
    propose(
      "venue-contract", /대관|홀비/, "예식장 대관·홀비",
      (venue.depositKRW ?? 0) + (venue.balanceKRW ?? 0),
      `${venue.name} 계약금 ${formatKRW(venue.depositKRW ?? 0)} + 잔금 ${formatKRW(venue.balanceKRW ?? 0)}`,
      "예식장", "/venues",
    );
  }

  const sdmContracts = data.sdm.filter((s) => s.category !== "snap" && s.status === "계약");
  const sdmTotal = sdmContracts.reduce((sum, s) => sum + (s.depositKRW ?? 0) + (s.balanceKRW ?? 0), 0);
  if (sdmTotal > 0) {
    propose(
      "sdm-contract", /스튜디오|스드메/, "스튜디오 (촬영)", sdmTotal,
      `계약 ${sdmContracts.length}곳 계약금+잔금 합계`, "스드메", "/sdm",
    );
  }
  const snapContracts = data.sdm.filter((s) => s.category === "snap" && s.status === "계약");
  const snapTotal = snapContracts.reduce((sum, s) => sum + (s.depositKRW ?? 0) + (s.balanceKRW ?? 0), 0);
  if (snapTotal > 0) {
    propose("snap-contract", /본식 스냅/, "본식 스냅", snapTotal, `계약 ${snapContracts.length}곳 계약금+잔금 합계`, "본식 스냅", "/snap");
  }

  const pickedRings = data.rings.filter((r) => (r.priceKRW ?? 0) > 0 && ((r.likedBy?.length ?? 0) > 0 || (r.starredBy?.length ?? 0) > 0));
  if (pickedRings.length > 0) {
    const cheapestPair = [...pickedRings].sort((a, b) => (a.priceKRW ?? 0) - (b.priceKRW ?? 0)).slice(0, 2);
    const ringTotal = cheapestPair.reduce((sum, r) => sum + (r.priceKRW ?? 0), 0) * (cheapestPair.length === 1 ? 2 : 1);
    propose(
      "rings", /결혼반지|예물/, "결혼반지 (커플)", ringTotal,
      `마음 표시한 후보 중 최저가 기준${cheapestPair.length === 1 ? " ×2" : ""}`, "반지", "/rings",
    );
  }

  const trip = tripCostEstimate(data);
  if (trip) {
    propose("trip", /항공권|신혼여행|허니문/, "항공권 (2인)", trip.total, trip.basis, "신혼여행", "/trip");
  }

  return out;
}

/** 만원 단위 한국어 포맷 (예: 145000000 → "1억 4,500만") */
export function formatKRW(won: number): string {
  if (!won) return "0원";
  const man = Math.round(won / 10000);
  if (man >= 10000) {
    const eok = Math.floor(man / 10000);
    const rest = man % 10000;
    return rest ? `${eok}억 ${rest.toLocaleString()}만` : `${eok}억`;
  }
  return `${man.toLocaleString()}만원`;
}
