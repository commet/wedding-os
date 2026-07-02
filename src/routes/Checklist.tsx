import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import type { WeddingData, WeddingUpdate, CheckItem, ChecklistSection } from "../lib/schema";
import { defaultChecklist, recalcDueDates } from "../data/checklistTemplate";
import { daysSince, todayISO } from "../lib/freshness";
import { collectLossDeadlines, lossDdayLabel, type LossDeadline } from "../lib/lossDeadlines";
import { consultationChoice } from "../lib/sectionConsultation";
import { formatKRW } from "../lib/derived";
import { GIFT_TIER_LABEL, GIFT_IDEAS, GIFT_TIP } from "../data/giftCatalog";
import { koBreak } from "../lib/typography";
import { buildChecklistSheet, shareOrDownloadText } from "../lib/textExport";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import SectionConsultationPanel from "../components/SectionConsultationPanel";
import { SectionDecisionLoop } from "../components/DecisionLoopPanel";

type Props = { data: WeddingData; update: (patch: WeddingUpdate) => void; };
type View = "category" | "timeline" | "week";

/** 상담 답변(checklist-mode) → 기본 보기. timeline=일정순, category=분야별, weekly=이번 주만 */
function viewFromChoice(choice: string | undefined): View {
  if (choice === "category") return "category";
  if (choice === "weekly") return "week";
  return "timeline";
}

export default function Checklist({ data, update }: Props) {
  const modeChoice = consultationChoice(data, "checklist", "checklist-mode")[0];
  const [view, setView] = useState<View>(() => viewFromChoice(modeChoice));
  const [appliedChoice, setAppliedChoice] = useState(modeChoice);
  // 상담에서 보기 방식을 (다시) 답하면 그 답을 실제 뷰에 한 번 반영 — 이후 수동 전환은 존중.
  useEffect(() => {
    if (modeChoice === appliedChoice) return;
    setAppliedChoice(modeChoice);
    setView(viewFromChoice(modeChoice));
  }, [modeChoice, appliedChoice]);
  const [query, setQuery] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(true);
  const [deleted, setDeleted] = useState<{ sid: string; item: CheckItem; index: number } | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const sections = data.checklist;
  const weddingDate = data.invitation.date;

  // 결혼식 날짜 있는데 ddayOffset만 박힌 항목(dueDate 없음) 발견 시 자동 재계산
  useEffect(() => {
    if (!weddingDate || sections.length === 0) return;
    const needsRecalc = sections.some((s) =>
      s.items.some((i) => i.ddayOffset !== undefined && !i.dueDate)
    );
    if (needsRecalc) {
      update((prev: WeddingData) => ({
        ...prev,
        checklist: recalcDueDates(prev.checklist, prev.invitation.date),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingDate, sections.length]);

  const allItems = useMemo(
    () => sections.flatMap((s) => s.items.map((i) => ({ ...i, sid: s.id, section: s.title, icon: s.icon }))),
    [sections]
  );
  const doneCount = allItems.filter((i) => i.done).length;
  const incompleteCount = allItems.length - doneCount;
  // 돈이 걸린 마감(무료취소·가계약·보증인원·잔금·결제) — 일반 할 일과 섞이지 않게 별도 스트립으로.
  const losses = useMemo(() => collectLossDeadlines(data, todayISO()), [data]);

  const loadDefault = () => {
    update((prev: WeddingData) => ({ ...prev, checklist: defaultChecklist(prev.invitation.date) }));
  };

  const exportChecklist = async () => {
    const r = await shareOrDownloadText({
      title: "체크리스트",
      text: buildChecklistSheet(data),
      filename: "체크리스트.txt",
    });
    setExportToast(
      r === "shared" ? "공유 시트를 열었어요" :
      r === "copied" ? "파일로 저장하고 클립보드에 복사했어요" :
      "파일로 저장했어요",
    );
    window.setTimeout(() => setExportToast(null), 2600);
  };

  const recalc = () => {
    update((prev: WeddingData) => ({
      ...prev,
      checklist: recalcDueDates(prev.checklist, prev.invitation.date),
    }));
  };

  const mutate = (fn: (sections: ChecklistSection[]) => ChecklistSection[]) => {
    update((prev: WeddingData) => ({ ...prev, checklist: fn(prev.checklist) }));
  };

  const toggleItem = (sid: string, iid: string) =>
    mutate((secs) => secs.map((s) => s.id !== sid ? s : {
      ...s, items: s.items.map((i) => i.id !== iid ? i : { ...i, done: !i.done }),
    }));

  const setDue = (sid: string, iid: string, dueDate: string) =>
    mutate((secs) => secs.map((s) => s.id !== sid ? s : {
      ...s, items: s.items.map((i) => {
        if (i.id !== iid) return i;
        // 사용자가 날짜를 직접 정하면 ddayOffset 을 떼어 낸다 — 그래야 이후
        // '날짜 기준 재계산'이 이 항목의 수동 날짜를 다시 덮어쓰지 않는다.
        if (dueDate) return { ...i, dueDate, ddayOffset: undefined };
        // 날짜를 비우면 dueDate 만 지운다 — ddayOffset 이 있으면 재계산으로 복구 가능.
        return { ...i, dueDate: undefined };
      }),
    }));

  const addItem = (sid: string, text: string) => {
    if (!text.trim()) return;
    mutate((secs) => secs.map((s) => s.id !== sid ? s : {
      ...s, items: [...s.items, { id: `cl-${Date.now()}`, text: text.trim(), done: false }],
    }));
  };

  const deleteItem = (sid: string, iid: string) => {
    const section = sections.find((item) => item.id === sid);
    const index = section?.items.findIndex((item) => item.id === iid) ?? -1;
    if (!section || index < 0) return;
    setDeleted({ sid, item: section.items[index], index });
    mutate((secs) => secs.map((item) => item.id !== sid ? item : {
      ...item,
      items: item.items.filter((candidate) => candidate.id !== iid),
    }));
  };

  const undoDelete = () => {
    if (!deleted) return;
    mutate((secs) => secs.map((s) => {
      if (s.id !== deleted.sid) return s;
      const items = [...s.items];
      items.splice(Math.min(deleted.index, items.length), 0, deleted.item);
      return { ...s, items };
    }));
    setDeleted(null);
  };

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ko");
    return allItems.filter((item) =>
      (!incompleteOnly || !item.done) &&
      (!needle || `${item.text} ${item.section}`.toLocaleLowerCase("ko").includes(needle)),
    );
  }, [allItems, incompleteOnly, query]);
  const overdueCount = allItems.filter((item) => bucketOf(item) === "overdue").length;
  const weekCount = allItems.filter((item) => bucketOf(item) === "week").length;
  const nodateCount = allItems.filter((item) => bucketOf(item) === "nodate").length;
  const isSearching = query.trim().length > 0;
  const triageTimeline = view === "timeline" && !isSearching && visibleItems.length > TRIAGE_THRESHOLD;

  if (sections.length === 0) {
    return (
      <div className="page pt-12 pb-10 text-center space-y-6 md:pt-20 md:space-y-8">
        <div>
          <div className="eyebrow-gold mb-4">준비 일정</div>
          <h1 className="display-sm mb-4 [text-wrap:balance] max-w-[18rem] mx-auto">{koBreak("할 일을 날짜에 맞춰")} <span className="font-light">{koBreak("정리해드릴게요.")}</span></h1>
          <p className="text-[15px] text-soft leading-[1.85]">
            기본 목록을 불러오면 예식 날짜에 맞춰<br />할 일과 마감일이 정리됩니다.
          </p>
        </div>
        {!weddingDate && (
          <p className="text-[12px] text-soft leading-relaxed">
            먼저 <Link to="/invitation" className="underline underline-offset-2">청첩장</Link>에서 결혼식 날짜를 입력하면 더 정확해요.
          </p>
        )}
        <ProcessAgentPanel
          title="날짜가 생기면 준비 순서를 바로 짭니다"
          summary="체크리스트는 할 일을 많이 보여주는 화면이 아니라, 지금 시점에 늦은 것과 이번 주 할 일을 먼저 꺼내는 운영판입니다."
          metrics={[
            { label: "할 일", value: "0개", tone: "warn" },
            { label: "예식일", value: weddingDate ? "있음" : "미정", tone: weddingDate ? "normal" : "muted" },
            { label: "기준", value: weddingDate ? "D-day" : "템플릿", tone: weddingDate ? "normal" : "muted" },
          ]}
          steps={[
            { label: "예식 날짜 입력", detail: "날짜가 있으면 모든 D-day 항목이 실제 마감일로 바뀝니다.", done: !!weddingDate },
            { label: "기본 타임라인 불러오기", detail: "처음부터 완벽히 고르지 말고, 지우면서 두 분 일정으로 맞추면 됩니다." },
          ]}
          actions={[
            { label: "준비 타임라인 불러오기 →", onClick: loadDefault, tone: "primary" },
          ]}
        />
        <div className="text-left">
          <SectionConsultationPanel sectionId="checklist" data={data} update={update} />
        </div>
      </div>
    );
  }

  return (
    <div className="page pt-6 pb-6 space-y-6">
      <div>
        <div className="eyebrow-gold mb-2">준비 일정</div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-[2rem] leading-none">{koBreak("체크리스트")}</h1>
          <span className="font-serif text-lg text-soft tabular-nums">{doneCount}<span className="text-soft/60"> / {allItems.length}</span></span>
        </div>
      </div>

      {/* 진행률 — hairline */}
      <div className="w-full h-px bg-line relative">
        <div className="absolute top-0 left-0 h-px bg-ink transition-all" style={{ width: `${allItems.length ? (doneCount / allItems.length) * 100 : 0}%` }} />
      </div>

      {/* 돈이 걸린 마감 — 일반 할 일보다 먼저, 목록과 분리해 최상단에 */}
      <LossStrip losses={losses} />

      {/* 보기 방식을 아직 안 정했으면 상담을 위에 — 답이 바로 아래 목록의 기본 뷰가 됩니다 */}
      {!modeChoice && <SectionConsultationPanel sectionId="checklist" data={data} update={update} />}

      {/* 뷰 토글 — underline 탭 */}
      <div className="flex items-center gap-6 border-b border-hair pb-3">
        <button
          onClick={() => setView("timeline")}
          className={`tracking-wide ${view === "timeline" ? "seg-active" : "seg"}`}
        >
          일정순
        </button>
        <button
          onClick={() => setView("week")}
          className={`tracking-wide ${view === "week" ? "seg-active" : "seg"}`}
        >
          이번 주
        </button>
        <button
          onClick={() => setView("category")}
          className={`tracking-wide ${view === "category" ? "seg-active" : "seg"}`}
        >
          카테고리
        </button>
        <div className="ml-auto flex items-center gap-4">
          <button onClick={exportChecklist} className="text-[11px] text-soft underline underline-offset-4 hover:text-ink">
            내보내기
          </button>
          {weddingDate && (
            <button onClick={recalc} className="text-[11px] text-soft underline underline-offset-4 hover:text-ink">
              날짜 기준 재계산
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="flex-1">
          <span className="sr-only">체크리스트 검색</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="할 일 또는 카테고리 검색"
            className="input-boxed min-h-11 text-[13px]"
          />
        </label>
        <label className="min-h-11 flex items-center gap-2 text-[12px] text-ink cursor-pointer">
          <input type="checkbox" checked={incompleteOnly} onChange={(e) => setIncompleteOnly(e.target.checked)} />
          미완료만 보기
        </label>
      </div>

      {triageTimeline && (
        <div className="border-y border-hair py-3 text-[12px] leading-relaxed text-soft">
          <span className="font-medium text-ink">급한 일부터 먼저 보여드려요.</span>{" "}
          각 묶음은 처음 {TRIAGE_LIMIT}개까지 보이고, 검색하면 전체 결과를 확인할 수 있습니다.
        </div>
      )}

      {view === "category" ? (
        <CategoryView
          sections={sections.map((section) => ({
            ...section,
            items: section.items.filter((item) => visibleItems.some((visible) => visible.sid === section.id && visible.id === item.id)),
          }))}
          onToggle={toggleItem} onSetDue={setDue} onAdd={addItem} onDelete={deleteItem}
        />
      ) : (
        <TimelineView
          items={visibleItems}
          onToggle={toggleItem}
          onSetDue={setDue}
          onDelete={deleteItem}
          expandAll={isSearching}
          triage={triageTimeline}
          weekOnly={view === "week" && !isSearching}
          onShowAll={() => setView("timeline")}
          losses={losses}
        />
      )}

      {/* week 뷰는 TimelineView 안에 자체 빈 안내가 있어 중복 표시하지 않는다 */}
      {visibleItems.length === 0 && view !== "week" && (
        <p className="py-10 text-center text-[15px] text-soft leading-[1.85]">조건에 맞는 할 일이 없어요.</p>
      )}

      {/* 상태 요약·상담·결정 루프는 목록 아래로 — 목록이 먼저, 패널은 보조 */}
      <div className="pt-4 space-y-6 border-t border-hair">
        <ProcessAgentPanel
          title={overdueCount > 0 ? "지난 마감 정리" : weekCount > 0 ? "이번 주 할 일" : "다음 마감 준비"}
          summary={
            overdueCount > 0
              ? `${overdueCount}개 항목이 마감일을 지났어요. 끝낸 건 체크하고, 아니면 날짜를 다시 잡는 게 먼저입니다.`
              : weekCount > 0
                ? `이번 주 안에 볼 일이 ${weekCount}개 있습니다. 하나씩 처리하면 됩니다.`
                : "마감이 급한 항목은 적어요. 날짜 없는 항목을 정리하면 일정이 더 정확해집니다."
          }
          mood={overdueCount > 0 ? "watching" : weekCount > 0 ? "thinking" : "ready"}
          metrics={[
            { label: "완료", value: `${doneCount}/${allItems.length}` },
            { label: "마감 지남", value: `${overdueCount}개`, tone: overdueCount > 0 ? "warn" : "muted" },
            { label: "날짜 없음", value: `${nodateCount}개`, tone: nodateCount > 0 ? "warn" : "muted" },
          ]}
          actions={[
            ...(incompleteCount > 0 ? [{
              label: overdueCount > 0 || weekCount > 0 ? "급한 것만 보기 →" : "남은 할 일 일정순 보기 →",
              onClick: () => {
                setView(overdueCount > 0 || weekCount > 0 ? "week" : "timeline");
                setIncompleteOnly(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              },
              tone: "primary" as const,
            }] : []),
            ...(weddingDate ? [{ label: "날짜 기준 재계산", onClick: recalc }] : []),
          ]}
        />
        <SectionDecisionLoop data={data} sectionId="checklist" />
        {modeChoice && <SectionConsultationPanel sectionId="checklist" data={data} update={update} />}
      </div>

      {deleted && (
        <div role="status" className="anim-sheet fixed left-1/2 bottom-24 z-40 -translate-x-1/2 w-[min(90vw,420px)] bg-ink text-paper px-4 py-3 flex items-center justify-between gap-4 border border-hair">
          <span className="text-[12px] truncate">‘{deleted.item.text}’ 삭제됨</span>
          <button onClick={undoDelete} className="min-h-11 px-2 text-[12px] font-medium underline underline-offset-4">실행 취소</button>
        </div>
      )}

      {exportToast && (
        <div role="status" className="anim-pop fixed inset-x-0 bottom-24 z-40 flex justify-center px-6 pointer-events-none">
          <div className="bg-ink text-paper text-[12px] px-4 py-2.5">{exportToast}</div>
        </div>
      )}

      <GiftGuide />
    </div>
  );
}

function GiftGuide() {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="pt-8 mt-4 border-t border-hair"
    >
      <summary className="cursor-pointer flex items-baseline justify-between py-2">
        <span className="font-serif text-[17px] text-ink">답례품 카탈로그 <span className="text-soft text-[12px]">— 가격대별 가이드</span></span>
        <span className="text-soft text-[11px]">{open ? "−" : "+"}</span>
      </summary>
      <GiftPanel />
    </details>
  );
}

function GiftPanel() {
  const [tier, setTier] = useState<"low" | "mid" | "high">("low");
  const tierData = GIFT_TIER_LABEL[tier];
  const ideas = GIFT_IDEAS.filter((g) => g.tier === tier);

  return (
    <div className="mt-4 space-y-5">
      <p className="text-[12px] text-soft leading-relaxed">{GIFT_TIP}</p>

      <div className="flex items-center gap-6 border-b border-hair pb-3">
        {(["low", "mid", "high"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`tracking-wide ${tier === t ? "seg-active" : "seg"}`}
          >
            {GIFT_TIER_LABEL[t].range.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="text-[12px] text-soft leading-relaxed">
        <span className="text-ink font-medium">{tierData.range}</span> · {tierData.ideal}
      </div>

      <ul className="group-card px-4">
        {ideas.map((g, i) => (
          <li key={i} className="py-4 space-y-2">
            <div className="font-serif text-[15px] text-ink">{g.category}</div>
            <div className="text-[12px] text-soft leading-relaxed">
              예 · {g.examples.join(" / ")}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
              <div>
                <div className="eyebrow mb-0.5">장점</div>
                <div className="text-[12px] text-soft leading-relaxed">{g.pros}</div>
              </div>
              <div>
                <div className="eyebrow mb-0.5">아쉬운 점</div>
                <div className="text-[12px] text-soft leading-relaxed">{g.cons}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-soft text-center pt-2">
        업체 추천이 아닌 카테고리 가이드. 표시 삭제·정정 요청은{" "}
        <a href="mailto:yclee913@gmail.com" rel="noopener noreferrer" className="underline underline-offset-2 text-ink">yclee913@gmail.com</a>.
      </p>
    </div>
  );
}

/* ─── 미루면 손해 스트립 — 돈이 걸린 마감만 (전 화면 공통 신호) ─── */

function LossStrip({ losses }: { losses: LossDeadline[] }) {
  if (losses.length === 0) return null;
  const shown = losses.slice(0, 4);
  return (
    <section className="group-card px-4" aria-label="미루면 손해 보는 마감">
      <div className="flex items-baseline justify-between py-3">
        <span className="eyebrow-gold">미루면 손해</span>
        <span className="eyebrow tabular-nums">{losses.length}</span>
      </div>
      {shown.map((loss) => (
        <Link key={loss.id} to={loss.targetPath} className="row-tap flex items-center gap-3 py-3 min-h-11">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] truncate">
              <span className={loss.severity === "high" ? "text-gold font-medium" : "text-ink"}>{loss.label}</span>
              <span className="text-ink"> · {loss.name}</span>
            </div>
            <div className="text-[11px] text-soft mt-0.5 truncate">
              {loss.lossHint}{loss.amountKRW ? ` · ${formatKRW(loss.amountKRW)}` : ""}
            </div>
          </div>
          <span className={`text-[12px] tabular-nums whitespace-nowrap ${loss.daysLeft <= 3 ? "text-gold font-semibold" : "text-soft"}`}>
            {lossDdayLabel(loss.daysLeft)}
          </span>
        </Link>
      ))}
      {losses.length > shown.length && (
        <div className="py-2 text-[11px] text-soft">외 {losses.length - shown.length}개 — 각 화면에서 이어집니다.</div>
      )}
    </section>
  );
}

/* ─── 일정순 뷰 ─── */

type FlatItem = CheckItem & { sid: string; section: string; icon: string; };

/** 이 할 일이 돈이 걸린 마감과 같은 건인지 — 이름이 겹칠 때만 (억지 매칭 금지) */
function lossFor(item: FlatItem, losses: LossDeadline[]): LossDeadline | undefined {
  if (item.done || losses.length === 0) return undefined;
  return losses.find((loss) => loss.name.length >= 2 && item.text.includes(loss.name));
}

function bucketOf(item: FlatItem): "overdue" | "week" | "month" | "later" | "nodate" | "done" {
  if (item.done) return "done";
  if (!item.dueDate) return "nodate";
  const d = daysSince(item.dueDate); // 양수 = 지남
  if (d === null) return "nodate";
  if (d > 0) return "overdue";
  const until = -d;
  if (until <= 7) return "week";
  if (until <= 30) return "month";
  return "later";
}

const BUCKET_META: Record<string, { label: string; color: string }> = {
  overdue: { label: "마감 지남", color: "text-gold" },
  week: { label: "이번 주", color: "text-ink" },
  month: { label: "이번 달", color: "text-ink" },
  later: { label: "다가오는 일정", color: "text-soft" },
  nodate: { label: "날짜 미정", color: "text-soft" },
  done: { label: "완료", color: "text-soft" },
};
const BUCKET_ORDER = ["overdue", "week", "month", "later", "nodate", "done"] as const;
const TRIAGE_LIMIT = 5;
const TRIAGE_THRESHOLD = 28;

const WEEK_BUCKETS = ["overdue", "week"] as const;

function TimelineView({
  items, onToggle, onSetDue, onDelete, expandAll, triage, weekOnly, onShowAll, losses,
}: {
  items: FlatItem[];
  onToggle: (sid: string, iid: string) => void;
  onSetDue: (sid: string, iid: string, d: string) => void;
  onDelete: (sid: string, iid: string) => void;
  expandAll: boolean;
  triage: boolean;
  weekOnly?: boolean;
  onShowAll?: () => void;
  losses?: LossDeadline[];
}) {
  const grouped = useMemo(() => {
    const g: Record<string, FlatItem[]> = {};
    for (const it of items) {
      const b = bucketOf(it);
      (g[b] ??= []).push(it);
    }
    for (const k in g) {
      // 마감일 오름차순 → 같은 날짜면 '중요' 표시(priority) 우선
      g[k].sort((a, b) =>
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
        (a.priority === "red" ? -1 : 0) - (b.priority === "red" ? -1 : 0)
      );
    }
    return g;
  }, [items]);

  const buckets = weekOnly ? WEEK_BUCKETS : BUCKET_ORDER;
  const urgentEmpty = weekOnly && WEEK_BUCKETS.every((b) => !grouped[b]?.length);
  const restCount = weekOnly
    ? items.length - WEEK_BUCKETS.reduce((n, b) => n + (grouped[b]?.length ?? 0), 0)
    : 0;

  return (
    <div className="space-y-10">
      {urgentEmpty && (
        <p className="py-6 text-center text-[14px] text-soft leading-[1.85]">
          이번 주 마감은 없어요. 다가오는 일정은 일정순에서 볼 수 있습니다.
        </p>
      )}
      {buckets.map((bucket) => {
        const list = grouped[bucket];
        if (!list || list.length === 0) return null;
        return (
          <TimelineGroup
            key={bucket}
            bucket={bucket}
            list={list}
            expandAll={expandAll}
            limit={triage ? TRIAGE_LIMIT : undefined}
            onToggle={onToggle}
            onSetDue={onSetDue}
            onDelete={onDelete}
            losses={losses}
          />
        );
      })}
      {weekOnly && restCount > 0 && onShowAll && (
        <button
          type="button"
          onClick={onShowAll}
          className="min-h-11 text-[12px] font-medium text-ink underline underline-offset-4"
        >
          다가오는 일정까지 모두 보기 ({restCount}개) →
        </button>
      )}
    </div>
  );
}

function TimelineGroup({ bucket, list, expandAll, limit, onToggle, onSetDue, onDelete, losses }: {
  bucket: typeof BUCKET_ORDER[number];
  list: FlatItem[];
  expandAll: boolean;
  limit?: number;
  onToggle: (sid: string, iid: string) => void;
  onSetDue: (sid: string, iid: string, d: string) => void;
  onDelete: (sid: string, iid: string) => void;
  losses?: LossDeadline[];
}) {
  const collapsible = bucket === "later" || bucket === "done" || (bucket === "nodate" && list.length > 8);
  const [open, setOpen] = useState(!collapsible);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (expandAll) {
      setOpen(true);
      setShowAll(true);
      return;
    }
    if (limit && list.length > limit) setShowAll(false);
  }, [expandAll, limit, list.length]);
  const meta = BUCKET_META[bucket];
  const capped = !showAll && !!limit && list.length > limit;
  const visibleRows = capped ? list.slice(0, limit) : list;
  const overdueBucket = bucket === "overdue";
  const rows = (
    <>
      {overdueBucket && (
        <p className="mb-1 text-[11px] text-soft leading-relaxed">
          끝낸 건 끝냄으로, 미룬 건 날짜를 다시 잡으면 목록이 정리됩니다.
        </p>
      )}
      <div className="divide-y divide-hair">
        {visibleRows.map((item) => (
          <TimelineRow
            key={item.id}
            item={item}
            onToggle={onToggle}
            onSetDue={onSetDue}
            onDelete={onDelete}
            overdue={overdueBucket}
            loss={overdueBucket && losses ? lossFor(item, losses) : undefined}
          />
        ))}
      </div>
      {capped && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 min-h-11 text-[12px] font-medium text-ink underline underline-offset-4"
        >
          나머지 {list.length - visibleRows.length}개 보기
        </button>
      )}
    </>
  );

  if (!collapsible) {
    return (
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="section-title">{meta.label}</h2>
          <span className="eyebrow tabular-nums">{list.length}</span>
        </div>
        {rows}
      </section>
    );
  }

  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between border-b border-hair py-2">
        <h2 className="section-title !text-soft">{meta.label} <span className="ml-1 font-normal tabular-nums">{list.length}</span></h2>
        <span className="text-[12px] text-soft">{open ? "접기" : "보기"}</span>
      </summary>
      <div className="pt-2">{rows}</div>
    </details>
  );
}

function TimelineRow({
  item, onToggle, onSetDue, onDelete, overdue, loss,
}: {
  item: FlatItem;
  onToggle: (sid: string, iid: string) => void;
  onSetDue: (sid: string, iid: string, d: string) => void;
  onDelete: (sid: string, iid: string) => void;
  overdue?: boolean;
  loss?: LossDeadline;
}) {
  const [editDate, setEditDate] = useState(false);
  const sid = item.sid;
  const d = item.dueDate ? daysSince(item.dueDate) : null;
  const ddayLabel =
    d === null ? null : d > 0 ? `${d}일 지남` : d === 0 ? "오늘" : `${-d}일 남음`;

  return (
    <div className="flex items-start gap-3 py-4">
      <button
        onClick={() => onToggle(sid, item.id)}
        className={`w-11 h-11 -m-3 mr-0 flex items-center justify-center flex-shrink-0 transition after:w-4 after:h-4 after:border ${item.done ? "after:bg-ink after:border-ink" : "after:border-mute hover:after:border-ink"}`}
        aria-label="완료 토글"
      >
        {item.done && <span className="block text-paper text-[10px] leading-4 text-center">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] ${item.done ? "line-through text-soft" : "text-ink"}`}>
          {item.priority === "red" && <span className="text-gold">● </span>}
          {item.text}
          {item.source === "ai" && (
            <span className="ml-2 align-middle text-[10px] tracking-wide text-gold">AI</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[11px]">
          <span className="text-soft">{item.section}</span>
          {editDate ? (
            <input
              type="date"
              autoFocus
              defaultValue={item.dueDate ?? ""}
              onBlur={(e) => { onSetDue(sid, item.id, e.target.value); setEditDate(false); }}
              className="border-b border-line bg-transparent px-1 py-0.5 text-[11px]"
            />
          ) : (
            <button onClick={() => setEditDate(true)} className="text-soft underline underline-offset-4 hover:text-ink tabular-nums">
              {item.dueDate ? `${item.dueDate}${ddayLabel ? ` · ${ddayLabel}` : ""}` : "+ 마감일"}
            </button>
          )}
        </div>
        {loss && !item.done && (
          <Link
            to={loss.targetPath}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-gold underline underline-offset-4"
          >
            {loss.label} · {loss.lossHint} →
          </Link>
        )}
        {overdue && !item.done && !loss && (
          <div className="flex items-center gap-4 mt-1.5">
            <button
              type="button"
              onClick={() => setEditDate(true)}
              className="text-[11px] text-ink underline underline-offset-4"
            >
              날짜 다시 잡기
            </button>
            <button
              type="button"
              onClick={() => onToggle(sid, item.id)}
              className="text-[11px] text-soft underline underline-offset-4 hover:text-ink"
            >
              끝냄 처리
            </button>
          </div>
        )}
      </div>
      <button onClick={() => onDelete(sid, item.id)} aria-label={`${item.text} 삭제`} className="text-soft hover:text-ink text-base min-w-11 min-h-11">×</button>
    </div>
  );
}

/* ─── 카테고리 뷰 ─── */

function CategoryView({
  sections, onToggle, onSetDue, onAdd, onDelete,
}: {
  sections: ChecklistSection[];
  onToggle: (sid: string, iid: string) => void;
  onSetDue: (sid: string, iid: string, d: string) => void;
  onAdd: (sid: string, text: string) => void;
  onDelete: (sid: string, iid: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(() => sections[0]?.id ?? "");
  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];

  if (!selected) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {sections.map((section) => {
          const done = section.items.filter((i) => i.done).length;
          const pct = section.items.length ? Math.round((done / section.items.length) * 100) : 0;
          const active = selected.id === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setSelectedId(section.id)}
              className={`text-left border p-3 transition ${active ? "border-ink" : "border-hair hover:border-mute"}`}
            >
              <div className="font-serif text-[14px] text-ink truncate">{section.title}</div>
              <div className="eyebrow mt-2 tabular-nums">{done}/{section.items.length} · {pct}%</div>
              <div className="h-px bg-line mt-2 relative">
                <div className="absolute left-0 top-0 h-px bg-ink" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      <SectionCard
        section={selected}
        onToggle={onToggle}
        onSetDue={onSetDue}
        onAdd={onAdd}
        onDelete={onDelete}
      />
    </div>
  );
}

function SectionCard({
  section, onToggle, onSetDue, onAdd, onDelete,
}: {
  section: ChecklistSection;
  onToggle: (sid: string, iid: string) => void;
  onSetDue: (sid: string, iid: string, d: string) => void;
  onAdd: (sid: string, text: string) => void;
  onDelete: (sid: string, iid: string) => void;
}) {
  const [newText, setNewText] = useState("");
  const doneCount = section.items.filter((i) => i.done).length;

  return (
    <section>
      <div className="w-full flex items-baseline justify-between border-b border-hair pb-2">
        <span className="font-serif text-[17px] text-ink">{section.title}</span>
        <span className="eyebrow tabular-nums">
          {doneCount} / {section.items.length}
        </span>
      </div>

      <>
          <ul className="divide-y divide-hair">
            {section.items.map((item) => (
              <CategoryRow
                key={item.id}
                sid={section.id}
                item={item}
                onToggle={onToggle}
                onSetDue={onSetDue}
                onDelete={onDelete}
              />
            ))}
          </ul>

          <form
            onSubmit={(e) => { e.preventDefault(); onAdd(section.id, newText); setNewText(""); }}
            className="mt-3 flex gap-3 items-end border-b border-hair pb-2"
          >
            <input
              className="input flex-1 text-[14px]"
              placeholder="새 항목…"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
            />
            <button className="text-[12px] text-ink underline underline-offset-4 pb-2 hover:text-gold" type="submit">추가 →</button>
          </form>
        </>
    </section>
  );
}

function CategoryRow({
  sid, item, onToggle, onSetDue, onDelete,
}: {
  sid: string;
  item: CheckItem;
  onToggle: (sid: string, iid: string) => void;
  onSetDue: (sid: string, iid: string, d: string) => void;
  onDelete: (sid: string, iid: string) => void;
}) {
  const [editDate, setEditDate] = useState(false);
  const d = item.dueDate ? daysSince(item.dueDate) : null;
  const overdue = !item.done && d !== null && d > 0;

  return (
    <li className="flex items-start gap-3 py-3.5 text-[14px]">
      <button
        onClick={() => onToggle(sid, item.id)}
        className={`w-11 h-11 -m-3 mr-0 flex items-center justify-center flex-shrink-0 transition after:w-4 after:h-4 after:border ${item.done ? "after:bg-ink after:border-ink" : "after:border-mute hover:after:border-ink"}`}
        aria-label="완료 토글"
      >
        {item.done && <span className="block text-paper text-[10px] leading-4 text-center">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <span className={item.done ? "line-through text-soft" : "text-ink"}>
          {item.priority === "red" && <span className="text-gold">● </span>}{item.text}
          {item.source === "ai" && (
            <span className="ml-2 align-middle text-[10px] tracking-wide text-gold">AI</span>
          )}
        </span>
        <div className="mt-1 text-[11px]">
          {editDate ? (
            <input
              type="date"
              autoFocus
              defaultValue={item.dueDate ?? ""}
              onBlur={(e) => { onSetDue(sid, item.id, e.target.value); setEditDate(false); }}
              className="border-b border-line bg-transparent px-1 py-0.5 text-[11px]"
            />
          ) : (
            <button
              onClick={() => setEditDate(true)}
              className={`underline underline-offset-4 tabular-nums ${overdue ? "text-gold" : "text-soft hover:text-ink"}`}
            >
              {item.dueDate ?? "+ 마감일"}
            </button>
          )}
        </div>
      </div>
      <button onClick={() => onDelete(sid, item.id)} aria-label={`${item.text} 삭제`} className="text-soft hover:text-ink text-base min-w-11 min-h-11">×</button>
    </li>
  );
}
