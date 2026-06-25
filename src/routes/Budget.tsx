import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { WeddingData, BudgetItem, GuestCategory } from "../lib/schema";
import { defaultBudget, BUDGET_TEMPLATE, BUDGET_TOTAL_NOTE } from "../data/budgetTemplate";
import {
  planningHeadcount, formatKRW, contractedVenue, mealCostRange, upcomingBalances, contractedTotals,
  breakEven, expectedGiftIncome, type BreakEven, type GiftIncome,
} from "../lib/derived";
import { koBreak } from "../lib/typography";

type Props = { data: WeddingData; update: (patch: any) => void };
type View = "all" | "current" | "unpaid" | "over";

export default function Budget({ data, update }: Props) {
  const items = data.budget ?? [];
  const headcount = planningHeadcount(data); // 예상 인원 계산기·명단 중 큰 값(현재 최선 추정)
  const meal = mealCostRange(contractedVenue(data), headcount); // 계약 예식장 식대 단가 × 예상 식수
  const balances = upcomingBalances(data).slice(0, 3); // 벤더 계약 잔금 — 다가오는 결제
  const ct = contractedTotals(data); // 계약 선금·잔금 합계
  const [view, setView] = useState<View>("all");
  const [customName, setCustomName] = useState("");

  const totals = useMemo(() => {
    const planned = items.reduce((s, b) => s + (b.planned ?? 0), 0);
    const actual = items.reduce((s, b) => s + (b.actual ?? 0), 0);
    const avg = items.reduce((s, b) => s + (b.avgKRW ?? 0), 0);
    // 결제 완료 합계는 '실제 지출'만 더한다 — 금액 미입력 상태로 체크만 한 항목의
    // 예상치(planned)를 지출로 둔갑시키지 않도록. (실제 지출 합계와 항상 일치)
    const paid = items.filter((b) => b.paid).reduce((s, b) => s + (b.actual ?? 0), 0);
    const unpaidCount = items.filter((b) => ((b.planned ?? 0) > 0 || (b.actual ?? 0) > 0) && !b.paid).length;
    const overCount = items.filter((b) => (b.planned ?? 0) > 0 && (b.actual ?? 0) > (b.planned ?? 0)).length;
    return { planned, actual, avg, paid, unpaidCount, overCount };
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

  const addCustom = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    update((prev: WeddingData) => ({
      ...prev,
      budget: [
        ...(prev.budget ?? []),
        {
          id: `budget-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: cleanName,
        },
      ],
    }));
    setCustomName("");
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
          <div className="eyebrow-gold mb-4">비용 관리</div>
          <h1 className="display-sm mb-4">{koBreak("무엇에 얼마가 드는지")}<br /><span className="italic font-light text-gold">{koBreak("먼저 펼쳐볼까요?")}</span></h1>
          <p className="text-[13px] text-soft leading-relaxed">
            기본 항목을 불러온 뒤 필요한 것만 남기고<br />두 분의 금액을 채워보세요.
          </p>
        </div>
        <p className="text-[12.5px] text-soft leading-relaxed border-y border-hair py-4">
          {BUDGET_TOTAL_NOTE}
        </p>
        <button onClick={loadDefault} className="btn-primary px-8 py-3.5 text-[12.5px]">
          기본 비용 항목 불러오기 →
        </button>
      </div>
    );
  }

  return (
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-2">예산과 지출</div>
        <h1 className="h-page">{koBreak("비용 관리")}</h1>
      </div>

      {/* 합계 요약 */}
      <div className="space-y-4 border-y border-hair py-6">
        <SummaryRow label="우리 예산 합계" value={totals.planned} accent />
        <SummaryRow label="실제 지출" value={totals.actual} muted />
        <SummaryRow label="참고 기준값" value={totals.avg} muted />
        <details className="text-[11.5px] text-soft">
          <summary className="cursor-pointer list-none underline underline-offset-2 hover:text-ink">
            ‘참고 기준값’은 어디서 온 값인가요?
          </summary>
          <p className="mt-2 leading-relaxed break-keep">
            국가가 발표한 공식 통계가 아니라, 공개된 결혼 비용 자료와 업계의 일반적인 견적
            범위를 묶어 만든 <b className="text-ink font-medium">대략적인 참고치</b>예요. 지역·시즌·요일·보증인원·계약
            조건에 따라 실제 금액은 크게 달라집니다. 실제 견적을 받으면 그 값으로 바꿔
            비교하시길 권해요. 어떤 업체와도 제휴·후원 관계가 없습니다.
          </p>
        </details>
        <div className="pt-3 border-t border-hair">
          <SummaryRow label="결제 완료" value={totals.paid} muted small />
          <div className="grid grid-cols-2 gap-4 pt-3 text-[11.5px]">
            <button onClick={() => setView("unpaid")} className="text-left border-t border-hair pt-2">
              <span className="eyebrow">미결제</span>
              <span className="block font-serif text-xl text-ink tabular-nums mt-1">{totals.unpaidCount}</span>
            </button>
            <button onClick={() => setView("over")} className="text-left border-t border-hair pt-2">
              <span className="eyebrow">예산 초과</span>
              <span className="block font-serif text-xl text-ink font-semibold tabular-nums mt-1">{totals.overCount}</span>
            </button>
          </div>
          {totals.planned > 0 && (
            <div className="mt-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="eyebrow">예산 대비 지출</span>
                <span className="text-[11.5px] tabular-nums text-soft">
                  {totals.planned > 0 ? Math.round((totals.actual / totals.planned) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-1 bg-mute/30 relative">
                <div
                  className={`absolute top-0 left-0 h-1 transition-all ${totals.actual > totals.planned ? "bg-gold" : "bg-ink"}`}
                  style={{ width: `${Math.min(100, totals.planned > 0 ? (totals.actual / totals.planned) * 100 : 0)}%` }}
                />
              </div>
            </div>
          )}
          {totals.planned > 0 && headcount > 0 && (
            <Link to="/guests" className="row-tap mt-3 flex items-baseline justify-between gap-3 border-t border-hair pt-3">
              <span className="eyebrow break-keep">예상 하객 {headcount}명 기준</span>
              <span className="text-[12px] text-soft break-keep">1인당 약 <b className="font-semibold tabular-nums text-ink">{formatKRW(Math.round(totals.planned / headcount))}</b></span>
            </Link>
          )}
          {meal && (
            <Link to="/venues" className="row-tap mt-3 flex items-baseline justify-between gap-3 border-t border-hair pt-3">
              <span className="eyebrow break-keep">예상 식대 · {meal.headcount}명</span>
              <span className="text-[12px] text-soft break-keep tabular-nums">
                <b className="font-semibold text-ink">{meal.min ? formatKRW(meal.min) : ""}{meal.max && meal.max !== meal.min ? `~${formatKRW(meal.max)}` : ""}</b>
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* 예상 축의금 · 본전 — 분류별 인원 × 평균 가정 vs 식대·총예산 */}
      {(() => {
        const income = expectedGiftIncome(data);
        const be = breakEven(data);
        if (!income || !be) return null;
        return <GiftBreakEven data={data} update={update} income={income} be={be} />;
      })()}

      {/* 다가오는 결제 — 예식장·스드메 계약 잔금 (잔금일 순) */}
      {balances.length > 0 && (
        <div className="border-y border-hair py-5">
          <div className="eyebrow-gold mb-3">다음 납부</div>
          <div>
            {balances.map((b) => (
              <Link
                key={b.name + b.dueAt}
                to={b.targetPath}
                className="row-tap flex items-baseline justify-between gap-3 border-b border-hair py-2.5 last:border-b-0"
              >
                <span className="text-[13px] text-ink break-keep">{b.name} <span className="text-soft">잔금</span></span>
                <span className="flex items-baseline gap-2.5 tabular-nums break-keep">
                  <b className="text-[13px] font-semibold text-ink">{formatKRW(b.amount)}</b>
                  <span className={`text-[12px] ${b.daysLeft <= 14 ? "text-gold font-medium" : "text-soft"}`}>
                    {b.daysLeft < 0 ? `${-b.daysLeft}일 지남` : b.daysLeft === 0 ? "오늘" : `D-${b.daysLeft}`}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          {ct.balanceTotal > 0 && (
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-hair pt-3">
              <span className="eyebrow break-keep">남은 잔금 합계</span>
              <span className="text-[13px] font-semibold text-ink tabular-nums break-keep">{formatKRW(ct.balanceTotal)}</span>
            </div>
          )}
        </div>
      )}

      {/* 토글 */}
      <div className="flex items-center gap-6 border-b border-hair pb-3">
        <button
          onClick={() => setView("all")}
          className={`tracking-wide ${view === "all" ? "seg-active" : "seg"}`}
        >
          전체
        </button>
        <button
          onClick={() => setView("current")}
          className={`tracking-wide ${view === "current" ? "seg-active" : "seg"}`}
        >
          입력된 것만
        </button>
        <button
          onClick={() => setView("unpaid")}
          className={`tracking-wide ${view === "unpaid" ? "seg-active" : "seg"}`}
        >
          미결제
        </button>
        <button
          onClick={() => setView("over")}
          className={`tracking-wide ${view === "over" ? "seg-active" : "seg"}`}
        >
          초과
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCustom(customName);
        }}
        className="flex items-end gap-3 border-b border-hair pb-2"
      >
        <input
          className="input flex-1 text-[14px]"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="추가 비용 항목"
        />
        <button
          type="submit"
          disabled={!customName.trim()}
          className="text-[12px] text-ink underline underline-offset-4 pb-3 hover:text-gold disabled:opacity-40 whitespace-nowrap"
        >
          추가 →
        </button>
      </form>

      {/* 그룹별 */}
      <div className="space-y-10">
        {Array.from(grouped.entries()).map(([group, list]) => {
          const visible = list.filter((b) => {
            if (view === "current") return (b.planned ?? 0) > 0 || (b.actual ?? 0) > 0;
            if (view === "unpaid") return ((b.planned ?? 0) > 0 || (b.actual ?? 0) > 0) && !b.paid;
            if (view === "over") return (b.planned ?? 0) > 0 && (b.actual ?? 0) > (b.planned ?? 0);
            return true;
          });
          if (visible.length === 0) return null;
          const groupPlanned = list.reduce((s, b) => s + (b.planned ?? 0), 0);
          const groupActual = list.reduce((s, b) => s + (b.actual ?? 0), 0);
          // 미결제 정의는 합계(totals.unpaidCount)와 동일하게 — 두 수치가 어긋나지 않게.
          const groupUnpaid = list.filter((b) => ((b.planned ?? 0) > 0 || (b.actual ?? 0) > 0) && !b.paid).length;
          return (
            <section key={group}>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <h2 className="section-title">{koBreak(group)}</h2>
                <span className="flex items-baseline gap-2 text-[11.5px] tabular-nums break-keep">
                  {groupUnpaid > 0 && <span className="text-ink">미결제 {groupUnpaid}</span>}
                  <span className="text-soft">
                    {groupPlanned > 0 ? `${fmtMan(groupPlanned)}만원 예산` : ""}
                    {groupActual > 0 && groupPlanned > 0 && " · "}
                    {groupActual > 0 && `${fmtMan(groupActual)}만원 지출`}
                  </span>
                </span>
              </div>
              <ul className="group-card">
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
        기본 금액은 실제 견적 전 감을 잡기 위한 참고치입니다. 지역·시즌·요일·보증인원·계약 조건에 따라 크게 달라집니다.
      </p>
    </div>
  );
}

// 예상 축의금 · 본전 — "축의금으로 메워지나"에 답한다. 인원은 예상 계산기/명단에서,
// 1인 평균은 분류별 가정치(조정 가능). 식대·총예산과 자동 reconcile.
function GiftBreakEven({ data, update, income, be }: {
  data: WeddingData;
  update: (patch: any) => void;
  income: GiftIncome;
  be: BreakEven;
}) {
  const [open, setOpen] = useState(false);

  const setGiftAvgMan = (category: GuestCategory, manRaw: string) => {
    const krw = Math.max(0, Math.min(100_000_000, Math.round((Number(manRaw) || 0) * 10000)));
    update((prev: WeddingData) => {
      const list = (prev.headcount?.giftAvg ?? []).filter((g) => g.category !== category);
      list.push({ category, krw });
      return { ...prev, headcount: { estimates: prev.headcount?.estimates ?? [], giftAvg: list } };
    });
  };

  const coverage = be.mealCost && be.mealCost > 0 ? Math.round((be.gift / be.mealCost) * 100) : null;
  const coverNote =
    coverage === null ? "" :
    coverage >= 100 ? "예상 축의금이 식대를 충분히 충당하는 수준이에요. 나머지 비용은 예산에서 관리하면 돼요." :
    coverage >= 85 ? "예상 축의금이 식대를 거의 충당해요." :
    "예상 축의금만으로는 식대를 다 채우기 어려울 수 있어요. 다른 비용과 함께 살펴보세요.";

  return (
    <div className="border-y border-hair py-5">
      <div className="eyebrow-gold mb-1.5">예상 축의금</div>
      <div className="font-serif text-[2rem] leading-none text-ink tabular-nums">{formatKRW(be.gift)}</div>
      <p className="mt-1.5 text-[11px] text-soft break-keep">
        {income.basis === "estimate" ? "예상 인원" : "명단"} <span className="tabular-nums">{income.count}</span>명 · 분류별 평균 가정
      </p>

      <div className="mt-4 space-y-2.5">
        {be.mealCost !== null && (
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-soft break-keep">예상 식대</span>
            <span className="tabular-nums text-ink">{formatKRW(be.mealCost)}</span>
          </div>
        )}
        {coverage !== null && (
          <div className="flex items-baseline justify-between gap-3 text-[13px] border-t border-hair pt-2.5">
            <span className="break-keep text-ink">식대 충당률</span>
            <span className={`tabular-nums font-semibold ${coverage >= 100 ? "text-sage" : "text-ink"}`}>{coverage}%</span>
          </div>
        )}
        {be.plannedBudget > 0 && (
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-soft break-keep">총예산의</span>
            <span className="tabular-nums text-ink">
              {Math.round((be.gift / be.plannedBudget) * 100)}%
              <span className="text-soft text-[11px] ml-1.5">/ {formatKRW(be.plannedBudget)}</span>
            </span>
          </div>
        )}
      </div>

      {coverNote && (
        <p className="mt-3.5 border-l-2 border-gold/60 pl-3 text-[12.5px] text-soft leading-relaxed break-keep">
          {coverNote}
        </p>
      )}

      <button onClick={() => setOpen((o) => !o)} className="mt-4 text-[12px] underline underline-offset-4 text-ink hover:text-gold">
        {open ? "분류별 가정 접기" : "분류별 평균 조정 →"}
      </button>

      {open && (
        <div className="mt-4 border-t border-hair pt-4">
          <div className="grid grid-cols-[1fr_2.2rem_3.4rem_auto] gap-x-3 gap-y-2 items-center">
            <span className="eyebrow">분류</span>
            <span className="eyebrow text-center">인원</span>
            <span className="eyebrow text-center">만원</span>
            <span className="eyebrow text-right">소계</span>
            {income.byCategory.map((r) => (
              <Fragment key={r.category}>
                <span className="text-[13px] text-ink">{r.label}</span>
                <span className="text-[13px] text-soft text-center tabular-nums">{r.count}</span>
                <input
                  type="number" min={0} inputMode="numeric"
                  aria-label={`${r.label} 1인 평균 축의금 (만원)`}
                  className="input text-[12px] tabular-nums text-center py-1.5"
                  value={Math.round(r.avg / 10000) || ""}
                  onChange={(e) => setGiftAvgMan(r.category, e.target.value)}
                  placeholder="0"
                />
                <span className="text-[12px] text-ink text-right tabular-nums">{formatKRW(r.sum)}</span>
              </Fragment>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-soft leading-relaxed break-keep">
            평균값은 <b className="text-ink font-medium">거친 가정</b>이에요 — 지역·관계·시기에 따라 크게 달라요.
            직계가족·혼주 지인 축의는 보통 별도예요. 분류 인원은{" "}
            <Link to="/guests" className="underline underline-offset-2 text-ink">하객</Link>에서 조정하세요.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, accent, muted, small }: { label: string; value: number; accent?: boolean; muted?: boolean; small?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`${small ? "text-[11px]" : "text-[12.5px]"} ${muted ? "text-soft" : "text-ink"} tracking-wide`}>{label}</span>
      <span className={`font-serif tabular-nums ${accent ? "text-2xl text-ink" : small ? "text-base text-soft" : "text-xl text-soft"}`}>
        {fmtMan(value)}<span className={`${small ? "text-[11px]" : "text-xs"} text-soft ml-1`}>만원</span>
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
    <li className="row-tap px-4 py-3.5">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left flex items-baseline justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-ink">{name}</div>
          {b.avgKRW && (
            <div className="eyebrow mt-0.5">기준 <span className="tabular-nums">{fmtMan(b.avgKRW)}만</span></div>
          )}
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <span className={`font-serif text-base tabular-nums ${actual > 0 ? (overBudget ? "text-gold" : "text-ink") : "text-soft"}`}>
            {fmtMan(actual || planned)}<span className="text-[11px] text-soft ml-0.5">만</span>
          </span>
          {b.paid && <span className="eyebrow mt-0.5">완료</span>}
        </div>
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-hair space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">우리 예상 (원)</label>
              <input
                type="number"
                min={0}
                className="input text-[13px] tabular-nums"
                value={b.planned ?? ""}
                onChange={(e) => onChange({ planned: parseAmount(e.target.value) })}
                placeholder={b.avgKRW ? String(b.avgKRW) : "0"}
              />
            </div>
            <div>
              <label className="label">실제 지출 (원)</label>
              <input
                type="number"
                min={0}
                className="input text-[13px] tabular-nums"
                value={b.actual ?? ""}
                onChange={(e) => onChange({ actual: parseAmount(e.target.value) })}
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
                기준값 대비{" "}
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

// 금액 입력 파싱 — 빈 칸은 undefined, "0"은 0으로 유지, 음수·비정상값은 거부.
function parseAmount(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}
