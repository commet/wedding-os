// 영역 간 파생값 — 한 곳의 데이터로 다른 곳을 똑똑하게 채운다.
// 모든 화면이 같은 계산을 공유하도록 단일 소스로 모은다(읽기 전용, 사용자 데이터를 덮어쓰지 않음).
import type { WeddingData, WeddingVenue, GuestCategory, SdmCategory } from "./schema";
import { ringConsultationProgress } from "./ringConsultation";
import { consultationProgress } from "./sectionConsultation";

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
 */
export function planningHeadcount(data: WeddingData): number {
  return Math.max(estimateTotal(data), expectedHeadcount(data));
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

export type TimelineKind = "wedding" | "task" | "balance" | "visit";
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
  attention: "확인 필요",
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
    ? "attention"
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
        ? ringConsultation.answered === 0 ? "반지 기준 잡기" : ringConsultation.answered < ringConsultation.total ? "반지 취향 질문 이어가기" : "취향에 맞는 후보 담기"
        : ringConsultation.answered < ringConsultation.total
          ? "반지 취향 질문 이어가기"
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
