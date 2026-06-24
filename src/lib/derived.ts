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
