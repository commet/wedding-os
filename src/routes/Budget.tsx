import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { WeddingData, WeddingUpdate, BudgetItem, GuestCategory } from "../lib/schema";
import { defaultBudget, BUDGET_TOTAL_NOTE, templateGroupTotalKRW } from "../data/budgetTemplate";
import {
  planningHeadcount, formatKRW, contractedVenue, mealCostRange, upcomingBalances, contractedTotals,
  breakEven, expectedGiftIncome, budgetSyncSuggestions,
  type BreakEven, type GiftIncome, type BudgetSyncSuggestion,
} from "../lib/derived";
import { lossDeadlinesFor, lossDdayLabel } from "../lib/lossDeadlines";
import { todayISO } from "../lib/freshness";
import { koBreak } from "../lib/typography";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import SectionConsultationPanel from "../components/SectionConsultationPanel";
import { SectionDecisionLoop } from "../components/DecisionLoopPanel";
import DearieConfirmModal from "../components/DearieConfirmModal";

type Props = { data: WeddingData; update: (patch: WeddingUpdate) => void };
type View = "all" | "current" | "unpaid" | "over";

export default function Budget({ data, update }: Props) {
  const items = data.budget ?? [];
  const headcount = planningHeadcount(data); // 예상 인원 계산기·명단 중 큰 값(현재 최선 추정)
  const meal = mealCostRange(contractedVenue(data), headcount); // 계약 예식장 식대 단가 × 예상 식수
  const balances = upcomingBalances(data).slice(0, 3); // 벤더 계약 잔금 — 다가오는 결제
  const ct = contractedTotals(data); // 계약 선금·잔금 합계
  const [view, setView] = useState<View>("all");
  const [customName, setCustomName] = useState("");
  const [confirmWipe, setConfirmWipe] = useState(false);

  // ── 스코프 게이트 — 템플릿을 붓기 전에 "어디까지 이 예산인가"를 먼저 정한다 ──
  const meta = data.budgetMeta;
  const [capMan, setCapMan] = useState(meta?.capKRW ? String(Math.round(meta.capKRW / 10000)) : "");
  const [includeHome, setIncludeHome] = useState(meta?.includeHome ?? false);
  const [includeYedan, setIncludeYedan] = useState(meta?.includeYedan ?? false);
  const [capEditOpen, setCapEditOpen] = useState(false);

  const capKRW = meta?.capKRW ?? 0;
  const homeTotal = templateGroupTotalKRW("newhome");
  const yedanTotal = templateGroupTotalKRW("tradition");

  // 손해 마감 — 이 화면 항목의 dueDate에서 (미결제만)
  const lossDL = lossDeadlinesFor(data, todayISO(), "/budget");
  // 다른 화면 확정 숫자 → 예산 항목 제안 (같은 숫자를 두 번 치지 않게)
  const syncs = budgetSyncSuggestions(data);

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

  // 게이트 답을 기록하고, 답에 맞는 그룹만 불러온다
  const loadWithScope = () => {
    const cap = capMan.trim() ? Math.max(0, Math.round(Number(capMan) || 0)) * 10000 : 0;
    update((prev: WeddingData) => ({
      ...prev,
      budget: [...(prev.budget ?? []), ...defaultBudget({ includeHome, includeYedan })],
      budgetMeta: {
        ...prev.budgetMeta,
        // 빈 입력 = "아직 미정" — 이전 상한을 조용히 유지하지 않는다 (saveCap과 같은 의미론)
        capKRW: cap > 0 ? cap : undefined,
        includeHome,
        includeYedan,
        decidedAt: new Date().toISOString(),
      },
    }));
  };

  // 상한만 나중에 정하거나 고칠 때 (기존 사용자 포함)
  const saveCap = (manRaw: string) => {
    const krw = Math.max(0, Math.round(Number(manRaw) || 0)) * 10000;
    update((prev: WeddingData) => ({
      ...prev,
      budgetMeta: {
        ...prev.budgetMeta,
        capKRW: krw > 0 ? krw : undefined,
        decidedAt: prev.budgetMeta?.decidedAt ?? new Date().toISOString(),
      },
    }));
    setCapEditOpen(false);
  };

  // 제안 가져오기 — 매칭 항목이 있으면 planned 갱신, 없으면 새 항목 생성
  const applySync = (s: BudgetSyncSuggestion) => {
    update((prev: WeddingData) => {
      const budget = prev.budget ?? [];
      if (s.itemId && budget.some((b) => b.id === s.itemId)) {
        return {
          ...prev,
          budget: budget.map((b) =>
            b.id === s.itemId ? { ...b, planned: s.suggestedKRW, notes: b.notes || s.basis } : b,
          ),
        };
      }
      return {
        ...prev,
        budget: [
          ...budget,
          {
            id: `budget-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category: s.categoryLabel,
            planned: s.suggestedKRW,
            notes: s.basis,
          },
        ],
      };
    });
  };

  const wipeAll = () => {
    setConfirmWipe(true);
  };

  const confirmWipeAll = () => {
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

  const mealExpected = meal ? (meal.max ?? meal.min ?? 0) : 0;
  const mealBudgetItem = items.find((item) => /식대|식사/.test(item.category));
  const mealBudgetLow = mealExpected > 0 && ((mealBudgetItem?.planned ?? mealBudgetItem?.actual ?? 0) < mealExpected * 0.7);
  const syncMealBudget = () => {
    if (!mealExpected) return;
    update((prev: WeddingData) => {
      const budget = prev.budget ?? [];
      const index = budget.findIndex((item) => /식대|식사/.test(item.category));
      const note = `예상 식수 ${meal?.headcount ?? headcount}명 기준 · 계약 식장 단가에서 자동 계산`;
      if (index >= 0) {
        return {
          ...prev,
          budget: budget.map((item, i) => i === index ? { ...item, planned: mealExpected, notes: item.notes || note } : item),
        };
      }
      return {
        ...prev,
        budget: [
          ...budget,
          {
            id: `agent-meal-${Date.now()}`,
            category: "[예식] 예식장 식대",
            planned: mealExpected,
            avgKRW: mealExpected,
            notes: note,
          },
        ],
      };
    });
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
      <div className="page pt-12 pb-10 text-center space-y-6 md:pt-20 md:space-y-8">
        <div>
          <div className="eyebrow-gold mb-4">비용 관리</div>
          <h1 className="display-sm mb-4">{koBreak("무엇에 얼마가 드는지")}<br /><span className="italic font-light text-gold">{koBreak("같이 정리해볼까요?")}</span></h1>
          <p className="text-[13px] text-soft leading-relaxed">
            기본 항목을 불러온 뒤 필요한 것만 남기고<br />두 분의 금액을 채워보세요.
          </p>
        </div>
        <div className="text-left">
          <SectionDecisionLoop data={data} sectionId="budget" />
        </div>
        <p className="border-y border-hair py-3 text-[12.5px] leading-relaxed text-soft md:hidden">
          실제 견적을 받으면 참고값을 두 분 금액으로 바꾸면 됩니다.
        </p>
        <p className="hidden text-[12.5px] text-soft leading-relaxed border-y border-hair py-4 md:block">
          {BUDGET_TOTAL_NOTE}
        </p>

        {/* 스코프 게이트 — 항목을 붓기 전에 총액 프레임부터. 이 세 답이 합계를 2~3배 흔든다 */}
        <div className="text-left border-y border-hair py-5 space-y-5">
          <div>
            <div className="eyebrow-gold mb-1.5">시작 전에 세 가지만</div>
            <p className="text-[12.5px] text-soft leading-relaxed break-keep">
              어디까지 이 예산으로 볼지 먼저 정하면, 합계가 처음부터 두 분 기준으로 잡혀요.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="budget-cap">총 예산 상한 (만원) — 아직 미정이면 비워두세요</label>
            <input
              id="budget-cap"
              type="number"
              min={0}
              inputMode="numeric"
              className="input text-[14px] tabular-nums"
              value={capMan}
              onChange={(e) => setCapMan(e.target.value)}
              placeholder="예: 5000"
            />
          </div>
          <div className="space-y-4">
            <ScopeToggle
              question="신혼집(가전·가구)도 이 예산에서 볼까요?"
              hint={`포함하면 참고 기준으로 약 ${formatKRW(homeTotal)}이 더해져요.`}
              value={includeHome}
              onChange={setIncludeHome}
            />
            <ScopeToggle
              question="예단·함·이바지도 포함할까요?"
              hint={`생략하는 커플도 많아요. 포함하면 참고 기준 약 ${formatKRW(yedanTotal)}.`}
              value={includeYedan}
              onChange={setIncludeYedan}
            />
          </div>
          <p className="text-[11px] text-soft leading-relaxed break-keep">
            나중에 마음이 바뀌면 항목을 추가하거나 지우면 됩니다.
          </p>
        </div>

        <ProcessAgentPanel
          title="예산표를 계약과 하객에 연결할 준비"
          summary="처음에는 정확한 금액보다 빠진 항목을 줄이는 게 중요해요. 기본 항목을 준비하고, 이후 식대·잔금·축의금 추정치를 자동으로 맞춰갑니다."
          metrics={[
            { label: "항목", value: "0개", tone: "warn" },
            { label: "하객 기준", value: headcount ? `${headcount}명` : "미정", tone: headcount ? "normal" : "muted" },
            { label: "계약 잔금", value: balances.length ? `${balances.length}건` : "없음", tone: balances.length ? "warn" : "muted" },
          ]}
          steps={[
            { label: "기본 비용 항목 준비하기", detail: "식장·스드메·청첩장·신혼여행처럼 큰 비용부터 먼저 잡아요.", done: false },
            { label: "견적 받는 즉시 실제 지출로 교체하기", detail: "참고값은 감 잡기용이고, 계약 금액이 들어오면 그 값이 기준입니다." },
          ]}
          actions={[
            { label: "이 기준으로 항목 불러오기 →", onClick: loadWithScope, tone: "primary" },
          ]}
        />
        <div className="text-left">
          <SectionConsultationPanel sectionId="budget" data={data} update={update} />
        </div>
      </div>
    );
  }

  return (
    <div className="page pt-6 pb-10 space-y-6">
      <div>
        <div className="eyebrow-gold mb-2">예산과 지출</div>
        <h1 className="h-page">{koBreak("비용 관리")}</h1>
      </div>

      <SectionDecisionLoop data={data} sectionId="budget" />

      <ProcessAgentPanel
        title={totals.overCount > 0 ? "초과 항목부터 다시 보는 중" : mealBudgetLow ? "식대 예산을 보정해야 해요" : "돈 흐름을 계약과 맞추는 중"}
        summary={
          totals.overCount > 0
            ? `${totals.overCount}개 항목이 예상보다 커졌어요. 초과분을 먼저 보고 결제 완료와 잔금 일정을 맞춰보겠습니다.`
            : mealBudgetLow
              ? `계약 식장과 예상 하객 기준 식대가 약 ${formatKRW(mealExpected)}인데, 예산표의 식대가 비어 있거나 낮게 잡혀 있어요.`
              : "예산표는 단순 가계부가 아니라 계약·하객·잔금이 만나는 통제판입니다. 지금은 미결제와 큰 비용 누락을 먼저 봅니다."
        }
        mood={totals.overCount > 0 || mealBudgetLow || totals.unpaidCount > 0 ? "watching" : "ready"}
        metrics={[
          { label: "예산", value: formatKRW(totals.planned), tone: totals.planned > 0 ? "normal" : "muted" },
          { label: "실지출", value: formatKRW(totals.actual), tone: totals.actual > totals.planned && totals.planned > 0 ? "warn" : "normal" },
          { label: "미결제", value: `${totals.unpaidCount}개`, tone: totals.unpaidCount > 0 ? "warn" : "muted" },
        ]}
        steps={[
          { label: "기본 항목을 빠짐없이 준비하기", detail: "항목이 있어야 견적을 받았을 때 바로 실제 금액으로 바꿀 수 있어요.", done: items.length >= 8 },
          { label: "계약 잔금과 예산표 맞추기", detail: balances.length ? "예식장·스드메 잔금이 예산표와 별도로 잡혀 있어요." : "잔금일이 들어오면 이 화면에서 같이 보입니다.", done: balances.length === 0 || totals.unpaidCount > 0 },
          { label: "식대 예산을 하객 기준으로 보정하기", detail: mealExpected ? `현재 계산값 ${formatKRW(mealExpected)}.` : "계약 식장과 예상 인원이 있으면 자동 계산됩니다.", done: !mealBudgetLow },
        ]}
        actions={[
          ...(mealBudgetLow ? [{ label: "식대 예산 자동 맞추기 →", onClick: syncMealBudget, tone: "primary" as const }] : []),
          ...(totals.unpaidCount > 0 ? [{ label: "미결제만 보기", onClick: () => setView("unpaid"), tone: "primary" as const }] : []),
          ...(totals.overCount > 0 ? [{ label: "초과 항목 보기", onClick: () => setView("over"), tone: "warn" as const }] : []),
          { label: "전체 보기", onClick: () => setView("all") },
        ]}
      />

      <SectionConsultationPanel sectionId="budget" data={data} update={update} />

      {/* 합계 요약 */}
      <div className="space-y-4 border-y border-hair py-6">
        {/* 총 상한 대비 — 상한이 있어야 초과/여유 판단이 성립한다 */}
        {capEditOpen ? (
          <form
            onSubmit={(e) => { e.preventDefault(); saveCap(capMan); }}
            className="flex items-end gap-3 border-b border-hair pb-4"
          >
            <div className="flex-1">
              <label className="label" htmlFor="budget-cap-edit">총 예산 상한 (만원)</label>
              <input
                id="budget-cap-edit"
                type="number" min={0} inputMode="numeric"
                className="input text-[14px] tabular-nums"
                value={capMan}
                onChange={(e) => setCapMan(e.target.value)}
                placeholder="예: 5000"
                autoFocus
              />
            </div>
            <button type="submit" className="text-[12px] text-ink underline underline-offset-4 pb-3 hover:text-gold whitespace-nowrap">
              저장
            </button>
          </form>
        ) : capKRW > 0 ? (
          <div className="border-b border-hair pb-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="eyebrow-gold">총 상한 대비</span>
              <button
                onClick={() => { setCapMan(String(Math.round(capKRW / 10000))); setCapEditOpen(true); }}
                className="text-[11px] text-soft underline underline-offset-2 hover:text-gold"
              >
                고치기
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="eyebrow">상한</span>
                <span className="block text-[13px] text-ink tabular-nums mt-0.5 break-keep">{formatKRW(capKRW)}</span>
              </div>
              <div>
                <span className="eyebrow">계획</span>
                <span className="block text-[13px] text-ink tabular-nums mt-0.5 break-keep">{formatKRW(totals.planned)}</span>
              </div>
              <div>
                <span className="eyebrow">{totals.planned > capKRW ? "초과" : "남음"}</span>
                <span className={`block text-[13px] tabular-nums mt-0.5 break-keep ${totals.planned > capKRW ? "text-gold font-semibold" : "text-ink"}`}>
                  {formatKRW(Math.abs(capKRW - totals.planned))}
                </span>
              </div>
            </div>
            <div className="w-full h-1 bg-mute/30 relative mt-2.5">
              <div
                className={`absolute top-0 left-0 h-1 ${totals.planned > capKRW ? "bg-gold" : "bg-ink"}`}
                style={{ width: `${Math.min(100, (totals.planned / capKRW) * 100)}%` }}
              />
            </div>
            {totals.planned > capKRW && (
              <p className="mt-2 text-[11px] text-gold break-keep">
                계획이 상한을 넘었어요. 큰 항목부터 같이 다시 보면 좋아요.
              </p>
            )}
            {meta?.decidedAt && (
              <p className="mt-2 text-[11px] text-soft break-keep">
                신혼집 {meta.includeHome ? "포함" : "별도"} · 예단·함 {meta.includeYedan ? "포함" : "별도"} 기준
              </p>
            )}
          </div>
        ) : (
          <div className="border-b border-hair pb-4">
            <button
              onClick={() => setCapEditOpen(true)}
              className="text-[12px] text-ink underline underline-offset-4 hover:text-gold"
            >
              총 예산 상한 정하기 →
            </button>
            <p className="mt-1.5 text-[11px] text-soft break-keep">상한이 있어야 초과·여유를 바로 알 수 있어요.</p>
          </div>
        )}
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

      {/* 다가오는 마감·납부 — 계약 잔금 + 항목별 결제 마감(dueDate)을 임박한 순으로 (미루면 손해가 최상단) */}
      {(() => {
        const rows = [
          ...lossDL.map((d) => ({
            key: d.id,
            name: d.name.replace(/^\[[^\]]+\]\s*/, ""),
            tag: d.label,
            amount: d.amountKRW,
            daysLeft: d.daysLeft,
            to: undefined as string | undefined,
          })),
          ...balances.map((b) => ({
            key: b.name + b.dueAt,
            name: b.name,
            tag: "잔금",
            amount: b.amount as number | undefined,
            daysLeft: b.daysLeft,
            to: b.targetPath as string | undefined,
          })),
        ].sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 6);
        if (rows.length === 0) return null;
        return (
          <div className="border-y border-hair py-5">
            <div className="eyebrow-gold mb-1.5">다가오는 마감·납부</div>
            <p className="text-[11px] text-soft break-keep mb-2.5">늦어지면 추가금이 생길 수 있는 항목이에요.</p>
            <div>
              {rows.map((r) => {
                const inner = (
                  <>
                    <span className="text-[13px] text-ink break-keep">{r.name} <span className="text-soft">{r.tag}</span></span>
                    <span className="flex items-baseline gap-2.5 tabular-nums break-keep">
                      {r.amount ? <b className="text-[13px] font-semibold text-ink">{formatKRW(r.amount)}</b> : null}
                      <span className={`text-[12px] ${r.daysLeft <= 14 ? "text-gold font-medium" : "text-soft"}`}>
                        {lossDdayLabel(r.daysLeft)}
                      </span>
                    </span>
                  </>
                );
                return r.to ? (
                  <Link key={r.key} to={r.to} className="row-tap flex items-baseline justify-between gap-3 border-b border-hair py-2.5 last:border-b-0">
                    {inner}
                  </Link>
                ) : (
                  <div key={r.key} className="flex items-baseline justify-between gap-3 border-b border-hair py-2.5 last:border-b-0">
                    {inner}
                  </div>
                );
              })}
            </div>
            {ct.balanceTotal > 0 && (
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-hair pt-3">
                <span className="eyebrow break-keep">남은 잔금 합계</span>
                <span className="text-[13px] font-semibold text-ink tabular-nums break-keep">{formatKRW(ct.balanceTotal)}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* 다른 화면 숫자 가져오기 — 예식장·스드메·반지·여행의 확정 숫자를 예산에 한 번에 */}
      {syncs.length > 0 && (
        <div className="border-y border-hair py-5">
          <div className="eyebrow-gold mb-1.5">다른 화면에서 온 숫자</div>
          <p className="text-[11px] text-soft break-keep mb-2.5">
            계약·후보에서 나온 금액이에요. 같은 숫자를 두 번 치지 않아도 됩니다.
          </p>
          <div>
            {syncs.map((s) => (
              <div key={s.key} className="border-b border-hair py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-ink break-keep">{s.categoryLabel}</span>
                  <span className="tabular-nums break-keep">
                    {s.currentKRW ? (
                      <span className="text-[12px] text-soft line-through mr-1.5">{formatKRW(s.currentKRW)}</span>
                    ) : null}
                    <b className="text-[13px] font-semibold text-ink">{formatKRW(s.suggestedKRW)}</b>
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <Link to={s.to} className="text-[11px] text-soft underline underline-offset-2 hover:text-gold break-keep min-w-0">
                    {s.basis}
                  </Link>
                  <button
                    onClick={() => applySync(s)}
                    className="text-[12px] text-ink underline underline-offset-4 hover:text-gold whitespace-nowrap"
                  >
                    가져오기 →
                  </button>
                </div>
              </div>
            ))}
          </div>
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
          // 마감이 걸린 미결제 항목을 그룹 안에서도 맨 위로 (같으면 템플릿 순서 유지)
          const sorted = [...visible].sort((a, b) => {
            const ak = a.dueDate && !a.paid ? a.dueDate.slice(0, 10) : "9999-12-31";
            const bk = b.dueDate && !b.paid ? b.dueDate.slice(0, 10) : "9999-12-31";
            return ak.localeCompare(bk);
          });
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
                {sorted.map((b) => (
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
      <DearieConfirmModal
        open={confirmWipe}
        title="예산 항목을 모두 지울까요?"
        body="예상 금액, 실제 지출, 결제 완료 표시가 모두 사라집니다. 새로 시작하려는 상황이 아니면 취소하고 필요한 항목만 삭제하는 편이 안전해요."
        confirmLabel="모두 지우기"
        tone="warn"
        onClose={() => setConfirmWipe(false)}
        onConfirm={confirmWipeAll}
      />
    </div>
  );
}

// 예상 축의금 · 본전 — "축의금으로 메워지나"에 답한다. 인원은 예상 계산기/명단에서,
// 1인 평균은 분류별 가정치(조정 가능). 식대·총예산과 자동 reconcile.
function GiftBreakEven({ data, update, income, be }: {
  data: WeddingData;
  update: (patch: WeddingUpdate) => void;
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

  const showBurden = be.plannedBudget > 0;
  const netBurden = Math.max(0, be.plannedBudget - be.gift);

  return (
    <div className="border-y border-hair py-5">
      {showBurden ? (
        <>
          <div className="eyebrow-gold mb-1.5">예상 실부담</div>
          <div className="font-serif text-[2rem] leading-none text-ink tabular-nums">{formatKRW(netBurden)}</div>
          <p className="mt-1.5 text-[11px] text-soft break-keep tabular-nums">
            우리 예산 {formatKRW(be.plannedBudget)} <span className="text-mute">−</span> 예상 축의금 {formatKRW(be.gift)}
          </p>
        </>
      ) : (
        <>
          <div className="eyebrow-gold mb-1.5">예상 축의금</div>
          <div className="font-serif text-[2rem] leading-none text-ink tabular-nums">{formatKRW(be.gift)}</div>
          <p className="mt-1.5 text-[11px] text-soft break-keep">
            {income.basis === "estimate" ? "예상 인원" : "명단"} <span className="tabular-nums">{income.count}</span>명 기준
          </p>
        </>
      )}

      {/* 축의금 vs 식대 — "식대는 축의금으로 메워지나"에 한 줄로 답한다 */}
      {be.vsMeal !== null && (
        <p className="mt-2 text-[11.5px] text-soft tabular-nums break-keep">
          예상 축의금 <b className="text-ink font-medium">{formatKRW(be.gift)}</b> — 식대 대비{" "}
          <span className={be.vsMeal < 0 ? "text-gold font-medium" : "text-ink"}>
            {be.vsMeal >= 0 ? `+${formatKRW(be.vsMeal)} 여유` : `${formatKRW(Math.abs(be.vsMeal))} 부족`}
          </span>
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

// 스코프 게이트 한 줄 — 질문 + 포함/별도 선택. 답은 budgetMeta와 상단 요약("신혼집 별도 기준")에 남는다.
function ScopeToggle({ question, hint, value, onChange }: {
  question: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <div className="text-[13px] text-ink break-keep mb-1.5">{question}</div>
      <div className="flex items-center gap-5">
        <button type="button" onClick={() => onChange(true)} className={`tracking-wide ${value ? "seg-active" : "seg"}`}>
          포함할게요
        </button>
        <button type="button" onClick={() => onChange(false)} className={`tracking-wide ${!value ? "seg-active" : "seg"}`}>
          따로 볼게요
        </button>
      </div>
      <p className="mt-1 text-[11px] text-soft break-keep">{hint}</p>
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
  // 마감일이 걸린 미결제 항목은 접힌 상태에서도 D-day가 보여야 한다
  const dueDays = b.dueDate
    ? Math.round((Date.parse(b.dueDate.slice(0, 10)) - Date.parse(todayISO())) / 86_400_000)
    : null;
  const showDue = !b.paid && dueDays !== null && Number.isFinite(dueDays);

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
          {showDue && (
            <span className={`mt-0.5 text-[10.5px] tabular-nums ${dueDays! <= 14 ? "text-gold font-medium" : "text-soft"}`}>
              {lossDdayLabel(dueDays!)} 마감
            </span>
          )}
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
          <div>
            <label className="label">결제·확정 마감일</label>
            <input
              type="date"
              className="input text-[13px]"
              value={b.dueDate ? b.dueDate.slice(0, 10) : ""}
              onChange={(e) => onChange({ dueDate: e.target.value || undefined })}
            />
            <p className="mt-1 text-[10.5px] text-soft break-keep">잔금·무료취소처럼 날짜가 걸린 항목만 적으면, 임박 순으로 위에 올라와요.</p>
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
