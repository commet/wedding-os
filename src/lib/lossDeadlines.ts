// 미루면 손해 — 돈이 걸린 날짜를 한 파이프라인으로.
// 무료취소 기한, 가계약 만료, 보증인원 확정 마감, 잔금일, 예산 항목 마감일을
// 자유 텍스트가 아니라 구조화 date 필드에서 모아 D-day 신호로 승격한다.
// (PRODUCT_INSIGHTS.md "미루면 손해 보는 일을 먼저 보여주기" 원칙의 단일 소스)
import type { WeddingData } from "./schema";

export type LossDeadlineKind =
  | "free-cancel"    // 무료취소 마감 — 지나면 위약금
  | "hold-expiry"    // 가계약 만료 — 지나면 날짜·홀을 놓침
  | "guarantee-due"  // 보증인원 확정 마감 — 지나면 미달분도 식대 지불
  | "balance"        // 잔금일 — 지나면 연체·계약 위반
  | "budget-due";    // 예산 항목 마감일 (사용자 지정)

export type LossDeadline = {
  id: string;
  kind: LossDeadlineKind;
  /** 마감 종류 라벨 — "무료취소 기한" */
  label: string;
  /** 대상 이름 — 업체·항목 이름 */
  name: string;
  date: string;          // ISO (YYYY-MM-DD)
  daysLeft: number;      // 음수 = 이미 지남
  amountKRW?: number;    // 걸린 금액 (잔금 등 알 수 있을 때만)
  /** 이 날짜를 넘기면 무엇을 잃는지 — 감정적 압박 없이 사실만 */
  lossHint: string;
  targetPath: string;
  severity: "high" | "medium" | "low";
};

const KIND_LABEL: Record<LossDeadlineKind, string> = {
  "free-cancel": "무료취소 기한",
  "hold-expiry": "가계약 만료",
  "guarantee-due": "보증인원 확정",
  balance: "잔금일",
  "budget-due": "결제 마감",
};

const KIND_LOSS_HINT: Record<LossDeadlineKind, string> = {
  "free-cancel": "지나면 취소 위약금이 생겨요",
  "hold-expiry": "지나면 잡아둔 날짜·홀이 풀려요",
  "guarantee-due": "지나면 미달 인원분도 식대를 내요",
  balance: "지나면 연체·계약 조건 문제가 생길 수 있어요",
  "budget-due": "직접 정해둔 결제 마감이에요",
};

function severityOf(daysLeft: number): "high" | "medium" | "low" {
  if (daysLeft <= 3) return "high";
  if (daysLeft <= 14) return "medium";
  return "low";
}

function daysBetween(dateISO: string, todayISO: string): number | null {
  const days = Math.round((Date.parse(dateISO.slice(0, 10)) - Date.parse(todayISO)) / 86_400_000);
  return Number.isNaN(days) ? null : days;
}

/**
 * 돈이 걸린 모든 마감을 임박한 순으로.
 * @param windowDays 앞으로 며칠까지 볼지 (기본 90일). 지난 마감은 7일까지 유지해 "지남"을 알려준다.
 */
export function collectLossDeadlines(
  data: WeddingData,
  today: string,
  windowDays = 90,
): LossDeadline[] {
  const out: LossDeadline[] = [];
  const push = (
    kind: LossDeadlineKind,
    idSuffix: string,
    name: string,
    date: string | undefined,
    targetPath: string,
    amountKRW?: number,
  ) => {
    if (!date) return;
    const iso = date.slice(0, 10);
    const daysLeft = daysBetween(iso, today);
    if (daysLeft === null) return;
    if (daysLeft < -7 || daysLeft > windowDays) return;
    out.push({
      id: `loss-${kind}-${idSuffix}`,
      kind,
      label: KIND_LABEL[kind],
      name,
      date: iso,
      daysLeft,
      amountKRW: amountKRW && amountKRW > 0 ? amountKRW : undefined,
      lossHint: KIND_LOSS_HINT[kind],
      targetPath,
      severity: daysLeft < 0 ? "high" : severityOf(daysLeft),
    });
  };

  for (const v of data.venues ?? []) {
    push("free-cancel", v.id, v.name, v.freeCancelUntil, "/venues", v.depositKRW);
    push("hold-expiry", v.id, v.name, v.holdExpiresAt, "/venues");
    push("guarantee-due", v.id, v.name, v.guaranteeDueAt, "/venues");
    if ((v.balanceKRW ?? 0) > 0) push("balance", v.id, v.name, v.balanceDueAt, "/venues", v.balanceKRW);
  }
  for (const s of data.sdm ?? []) {
    const path = s.category === "snap" ? "/snap" : "/sdm";
    push("free-cancel", s.id, s.name, s.freeCancelUntil, path, s.depositKRW);
    if ((s.balanceKRW ?? 0) > 0) push("balance", s.id, s.name, s.balanceDueAt, path, s.balanceKRW);
  }
  for (const h of data.hotels ?? []) {
    push("free-cancel", h.id, h.name, h.freeCancelUntil, "/trip");
  }
  for (const b of data.budget ?? []) {
    if (b.paid) continue;
    push("budget-due", b.id, b.category, b.dueDate, "/budget", b.planned ?? b.actual);
  }

  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name));
}

/** 특정 섹션 경로의 손해 마감만 — 서브 화면 상단 신호용 */
export function lossDeadlinesFor(
  data: WeddingData,
  today: string,
  targetPath: string,
  windowDays = 90,
): LossDeadline[] {
  return collectLossDeadlines(data, today, windowDays).filter((d) => d.targetPath === targetPath);
}

/** D-day 문구 — "D-3" / "오늘" / "3일 지남" */
export function lossDdayLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)}일 지남`;
  if (daysLeft === 0) return "오늘";
  return `D-${daysLeft}`;
}
