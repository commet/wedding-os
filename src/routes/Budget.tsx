import { useMemo, useState } from "react";
import type { WeddingData, BudgetItem } from "../lib/schema";
import { defaultBudget, BUDGET_TEMPLATE, BUDGET_TOTAL_NOTE } from "../data/budgetTemplate";

type Props = { data: WeddingData; update: (patch: any) => void };
type View = "all" | "current";

export default function Budget({ data, update }: Props) {
  const items = data.budget ?? [];
  const [view, setView] = useState<View>("all");

  const totals = useMemo(() => {
    const planned = items.reduce((s, b) => s + (b.planned ?? 0), 0);
    const actual = items.reduce((s, b) => s + (b.actual ?? 0), 0);
    const avg = items.reduce((s, b) => s + (b.avgKRW ?? 0), 0);
    const paid = items.filter((b) => b.paid).reduce((s, b) => s + (b.actual ?? b.planned ?? 0), 0);
    return { planned, actual, avg, paid };
  }, [items]);

  const loadDefault = () => {
    update((prev: WeddingData) => ({
      ...prev,
      budget: [...(prev.budget ?? []), ...defaultBudget()],
    }));
  };

  const wipeAll = () => {
    if (!confirm("예산 항목을 모두 지울까요? 되돌릴 수 없어요.")) return;
    update((prev: WeddingData) => ({ ...prev, budget: [] }));
  };

  const updateItem = (id: string, patch: Partial<BudgetItem>) => {
    update((prev: WeddingData) => ({
      ...prev,
      budget: (prev.budget ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  };

  const removeItem = (id: string) => {
    update((prev: WeddingData) => ({
      ...prev,
      budget: (prev.budget ?? []).filter((b) => b.id !== id),
    }));
  };

  const addCustom = () => {
    const name = prompt("새 비용 항목 이름:");
    if (!name?.trim()) return;
    update((prev: WeddingData) => ({
      ...prev,
      budget: [
        ...(prev.budget ?? []),
        {
          id: `budget-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: name.trim(),
        },
      ],
    }));
  };

  // 그룹화 — 카테고리 prefix [그룹명] 기반
  const grouped = useMemo(() => {
    const m = new Map<string, BudgetItem[]>();
    for (const b of items) {
      const match = b.category.match(/^\[([^\]]+)\]\s*(.*)$/);
      const key = match ? match[1] : "기타";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(b);
    }
    return m;
  }, [items]);

  // 빈 상태
  if (items.length === 0) {
    return (
      <div className="page pt-20 pb-10 text-center space-y-8">
        <div>
          <div className="eyebrow-gold mb-4">Budget</div>
          <h2 className="display-sm mb-4">
            얼마면 될까?<br />
            <span className="italic font-light text-gold">미리 그려보세요.</span>
          </h2>
          <p className="text-[13px] text-soft leading-relaxed">
            한국 평균 비용을 기반으로 한 표준 카테고리를 불러오면<br />
            우리 예산과 한눈에 비교돼요.
          </p>
        </div>
        <p className="text-[12.5px] text-soft leading-relaxed border-y border-hair py-4">
          {BUDGET_TOTAL_NOTE}
        </p>
        <button onClick={loadDefault} className="btn-primary px-8 py-3.5 text-[12.5px]">
          평균 비용 카테고리 불러오기 →
        </button>
      </div>
    );
  }

  return (
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-2">Budget</div>
        <h1 className="font-serif text-[2rem] leading-none">예산 · 비용</h1>
      </div>

      {/* 합계 요약 */}
      <div className="space-y-4 border-y border-hair py-6">
        <SummaryRow label="우리 예산 합계" value={totals.planned} accent />
        <SummaryRow label="실제 지출" value={totals.actual} muted />
        <SummaryRow label="한국 평균 (참고)" value={totals.avg} muted />
        <div className="pt-3 border-t border-hair">
          <SummaryRow label="결제 완료" value={totals.paid} muted small />
          {totals.planned > 0 && (
            <div className="mt-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="eyebrow">예산 대비 지출</span>
                <span className="text-[11.5px] tabular-nums text-soft">
                  {totals.planned > 0 ? Math.round((totals.actual / totals.planned) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-px bg-line relative">
                <div
                  className={`absolute top-0 left-0 h-px transition-all ${totals.actual > totals.planned ? "bg-gold" : "bg-ink"}`}
                  style={{ width: `${Math.min(100, totals.planned > 0 ? (totals.actual / totals.planned) * 100 : 0)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 토글 */}
      <div className="flex items-center gap-6 border-b border-hair pb-3">
        <button
          onClick={() => setView("all")}
          className={`text-[12px] tracking-wide pb-1 transition ${view === "all" ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
        >
          전체
        </button>
        <button
          onClick={() => setView("current")}
          className={`text-[12px] tracking-wide pb-1 transition ${view === "current" ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
        >
          입력된 것만
        </button>
        <button onClick={addCustom} className="ml-auto text-[12px] underline underline-offset-4 text-ink hover:text-gold">
          + 항목 추가
        </button>
      </div>

      {/* 그룹별 */}
      <div className="space-y-10">
        {Array.from(grouped.entries()).map(([group, list]) => {
          const visible = view === "current" ? list.filter((b) => (b.planned ?? 0) > 0 || (b.actual ?? 0) > 0) : list;
          if (visible.length === 0) return null;
          const groupPlanned = list.reduce((s, b) => s + (b.planned ?? 0), 0);
          const groupActual = list.reduce((s, b) => s + (b.actual ?? 0), 0);
          return (
            <section key={group}>
              <div className="flex items-baseline justify-between border-b border-hair pb-2 mb-1">
                <h2 className="eyebrow-gold">{group}</h2>
                <span className="text-[11.5px] text-soft tabular-nums">
                  {groupPlanned > 0 ? `${fmtMan(groupPlanned)}만원 예산` : ""}
                  {groupActual > 0 && groupPlanned > 0 && " · "}
                  {groupActual > 0 && `${fmtMan(groupActual)}만원 지출`}
                </span>
              </div>
              <ul className="divide-y divide-hair">
                {visible.map((b) => (
                  <BudgetRow key={b.id} b={b} onChange={(patch) => updateItem(b.id, patch)} onRemove={() => removeItem(b.id)} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="pt-6 border-t border-hair text-center">
        <button onClick={wipeAll} className="text-[12px] underline underline-offset-4 text-soft hover:text-gold">
          모든 항목 지우기
        </button>
      </div>

      <p className="text-[10.5px] text-soft text-center leading-relaxed">
        평균 비용은 듀오웨드·한국소비자원 등 공개 자료 참고치 — 지역·시즌·취향에 따라 크게 달라집니다.
      </p>
    </div>
  );
}

function SummaryRow({ label, value, accent, muted, small }: { label: string; value: number; accent?: boolean; muted?: boolean; small?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`${small ? "text-[11px]" : "text-[12.5px]"} ${muted ? "text-soft" : "text-ink"} tracking-wide`}>{label}</span>
      <span className={`font-serif tabular-nums ${accent ? "text-2xl text-ink" : small ? "text-base text-soft" : "text-xl text-soft"}`}>
        {fmtMan(value)}<span className={`${small ? "text-[10px]" : "text-xs"} text-soft ml-1`}>만원</span>
      </span>
    </div>
  );
}

function BudgetRow({ b, onChange, onRemove }: { b: BudgetItem; onChange: (p: Partial<BudgetItem>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const name = b.category.replace(/^\[[^\]]+\]\s*/, "");
  const planned = b.planned ?? 0;
  const actual = b.actual ?? 0;
  const overBudget = planned > 0 && actual > planned;

  return (
    <li className="py-3.5">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left flex items-baseline justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-ink">{name}</div>
          {b.avgKRW && (
            <div className="eyebrow mt-0.5">평균 <span className="tabular-nums">{fmtMan(b.avgKRW)}만</span></div>
          )}
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <span className={`font-serif text-base tabular-nums ${actual > 0 ? (overBudget ? "text-gold" : "text-ink") : "text-soft"}`}>
            {fmtMan(actual || planned)}<span className="text-[10px] text-soft ml-0.5">만</span>
          </span>
          {b.paid && <span className="eyebrow-gold mt-0.5">완료</span>}
        </div>
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-hair space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">우리 예상 (원)</label>
              <input
                type="number"
                className="input text-[13px] tabular-nums"
                value={b.planned ?? ""}
                onChange={(e) => onChange({ planned: Number(e.target.value) || undefined })}
                placeholder={b.avgKRW ? String(b.avgKRW) : "0"}
              />
            </div>
            <div>
              <label className="label">실제 지출 (원)</label>
              <input
                type="number"
                className="input text-[13px] tabular-nums"
                value={b.actual ?? ""}
                onChange={(e) => onChange({ actual: Number(e.target.value) || undefined })}
                placeholder="0"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-soft">
            <input
              type="checkbox"
              checked={!!b.paid}
              onChange={(e) => onChange({ paid: e.target.checked })}
              className="accent-ink"
            />
            결제 완료
          </label>
          <input
            className="input text-[12.5px]"
            placeholder="메모 (업체·견적·결제수단)"
            value={b.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
          <div className="flex items-center justify-between pt-2 border-t border-hair">
            {b.avgKRW && (
              <span className="text-[11px] text-soft">
                평균 대비{" "}
                <span className={`tabular-nums ${(planned || actual) > b.avgKRW ? "text-gold" : "text-soft"}`}>
                  {planned || actual ? `${Math.round(((planned || actual) / b.avgKRW) * 100)}%` : "—"}
                </span>
              </span>
            )}
            <button onClick={onRemove} className="text-[11px] text-soft hover:text-gold underline underline-offset-4 ml-auto">
              삭제
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function fmtMan(krw: number): string {
  return Math.round(krw / 10000).toLocaleString();
}
