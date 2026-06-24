// 영역 간 파생값 — 한 곳의 데이터로 다른 곳을 똑똑하게 채운다.
// 모든 화면이 같은 계산을 공유하도록 단일 소스로 모은다(읽기 전용, 사용자 데이터를 덮어쓰지 않음).
import type { WeddingData, WeddingVenue } from "./schema";

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
  const range = mealCostRange(contractedVenue(data), expectedHeadcount(data));
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
