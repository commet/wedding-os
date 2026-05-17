// 데이터 신선도 표시 유틸. 90일/180일 휴리스틱.

import { formatISODateLocal, parseISODateLocal } from "./date";

export function daysSince(iso?: string): number | null {
  const date = parseISODateLocal(iso);
  if (!date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export type FreshnessLevel = "fresh" | "stale" | "rotten" | "unknown";

export function freshnessLevel(iso?: string): FreshnessLevel {
  const d = daysSince(iso);
  if (d === null) return "unknown";
  if (d < 90) return "fresh";
  if (d < 180) return "stale";
  return "rotten";
}

export function formatVerifiedDate(iso?: string): string {
  if (!iso) return "직접 확인 필요";
  const d = parseISODateLocal(iso);
  if (!d) return "직접 확인 필요";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} 기준`;
}

export function todayISO(): string {
  return formatISODateLocal(new Date());
}
