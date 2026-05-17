import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import type { WeddingData, CheckItem, ChecklistSection } from "../lib/schema";
import { defaultChecklist, recalcDueDates } from "../data/checklistTemplate";
import { daysSince } from "../lib/freshness";
import { GIFT_TIER_LABEL, GIFT_IDEAS, GIFT_TIP } from "../data/giftCatalog";

type Props = { data: WeddingData; update: (patch: any) => void; };
type View = "category" | "timeline";

export default function Checklist({ data, update }: Props) {
  const [view, setView] = useState<View>("timeline");
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

  const loadDefault = () => {
    update((prev: WeddingData) => ({ ...prev, checklist: defaultChecklist(prev.invitation.date) }));
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
      ...s, items: s.items.map((i) => i.id !== iid ? i : { ...i, dueDate: dueDate || undefined }),
    }));

  const addItem = (sid: string, text: string) => {
    if (!text.trim()) return;
    mutate((secs) => secs.map((s) => s.id !== sid ? s : {
      ...s, items: [...s.items, { id: `cl-${Date.now()}`, text: text.trim(), done: false }],
    }));
  };

  const deleteItem = (sid: string, iid: string) =>
    mutate((secs) => secs.map((s) => s.id !== sid ? s : { ...s, items: s.items.filter((i) => i.id !== iid) }));

  if (sections.length === 0) {
    return (
      <div className="page pt-20 pb-10 text-center space-y-8">
        <div>
          <div className="eyebrow-gold mb-4">Checklist</div>
          <h2 className="display-sm mb-4">
            놓치는 것 없이,<br />
            <span className="italic font-light text-gold">한눈에.</span>
          </h2>
          <p className="text-[13px] text-soft leading-relaxed">
            표준 타임라인을 불러오면 결혼식 날짜에 맞춰<br />
            할 일마다 마감일이 자동으로 잡혀요.
          </p>
        </div>
        {!weddingDate && (
          <p className="text-[11.5px] text-gold leading-relaxed">
            먼저 <Link to="/invitation" className="underline underline-offset-2">청첩장</Link>에서 결혼식 날짜를 입력하면 더 정확해요.
          </p>
        )}
        <button onClick={loadDefault} className="btn-primary px-8 py-3.5 text-[12.5px]">
          준비 타임라인 불러오기
        </button>
      </div>
    );
  }

  return (
    <div className="page pt-8 pb-6 space-y-6">
      <div>
        <div className="eyebrow-gold mb-2">Checklist</div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-[2rem] leading-none">체크리스트</h1>
          <span className="font-serif text-lg text-soft tabular-nums">{doneCount}<span className="text-soft/60"> / {allItems.length}</span></span>
        </div>
      </div>

      {/* 진행률 — hairline */}
      <div className="w-full h-px bg-line relative">
        <div className="absolute top-0 left-0 h-px bg-ink transition-all" style={{ width: `${allItems.length ? (doneCount / allItems.length) * 100 : 0}%` }} />
      </div>

      {/* 뷰 토글 — underline 탭 */}
      <div className="flex items-center gap-6 border-b border-hair pb-3">
        <button
          onClick={() => setView("timeline")}
          className={`text-[12px] tracking-wide transition pb-1 ${view === "timeline" ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
        >
          일정순
        </button>
        <button
          onClick={() => setView("category")}
          className={`text-[12px] tracking-wide transition pb-1 ${view === "category" ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
        >
          카테고리
        </button>
        {weddingDate && (
          <button onClick={recalc} className="ml-auto text-[11px] text-soft underline underline-offset-4 hover:text-ink">
            날짜 기준 재계산
          </button>
        )}
      </div>

      {view === "timeline" ? (
        <TimelineView items={allItems} onToggle={toggleItem} onSetDue={setDue} onDelete={deleteItem} />
      ) : (
        <CategoryView sections={sections} onToggle={toggleItem} onSetDue={setDue} onAdd={addItem} onDelete={deleteItem} />
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
            className={`text-[12px] tracking-wide pb-1 transition ${tier === t ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
          >
            {GIFT_TIER_LABEL[t].range.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="text-[12px] text-soft leading-relaxed">
        <span className="text-ink font-medium">{tierData.range}</span> · {tierData.ideal}
      </div>

      <ul className="divide-y divide-hair border-y border-hair">
        {ideas.map((g, i) => (
          <li key={i} className="py-4 space-y-2">
            <div className="font-serif text-[15px] text-ink">{g.category}</div>
            <div className="text-[12px] text-soft leading-relaxed">
              예 · {g.examples.join(" / ")}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
              <div>
                <div className="eyebrow-gold mb-0.5">장점</div>
                <div className="text-[11.5px] text-soft leading-relaxed">{g.pros}</div>
              </div>
              <div>
                <div className="eyebrow mb-0.5">아쉬운 점</div>
                <div className="text-[11.5px] text-soft leading-relaxed">{g.cons}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[10.5px] text-soft text-center pt-2">
        업체 추천이 아닌 카테고리 가이드. 표시 삭제·정정 요청은{" "}
        <a href="mailto:yclee913@gmail.com" rel="noopener noreferrer" className="underline underline-offset-2 text-ink">yclee913@gmail.com</a>.
      </p>
    </div>
  );
}

/* ─── 일정순 뷰 ─── */

type FlatItem = CheckItem & { sid: string; section: string; icon: string; };

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

function TimelineView({
  items, onToggle, onSetDue, onDelete,
}: {
  items: FlatItem[];
  onToggle: (sid: string, iid: string) => void;
  onSetDue: (sid: string, iid: string, d: string) => void;
  onDelete: (sid: string, iid: string) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<string, FlatItem[]> = {};
    for (const it of items) {
      const b = bucketOf(it);
      (g[b] ??= []).push(it);
    }
    for (const k in g) {
      g[k].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    }
    return g;
  }, [items]);

  return (
    <div className="space-y-10">
      {BUCKET_ORDER.map((bucket) => {
        const list = grouped[bucket];
        if (!list || list.length === 0) return null;
        const meta = BUCKET_META[bucket];
        return (
          <section key={bucket}>
            <div className="flex items-baseline justify-between mb-1 border-b border-hair pb-2">
              <h2 className={`eyebrow-gold ${meta.color === "text-soft" ? "!text-soft" : ""}`}>
                {meta.label}
              </h2>
              <span className="eyebrow tabular-nums">{list.length}</span>
            </div>
            <div className="divide-y divide-hair">
              {list.map((it) => (
                <TimelineRow key={it.id} item={it} onToggle={onToggle} onSetDue={onSetDue} onDelete={onDelete} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TimelineRow({
  item, onToggle, onSetDue, onDelete,
}: {
  item: FlatItem;
  onToggle: (sid: string, iid: string) => void;
  onSetDue: (sid: string, iid: string, d: string) => void;
  onDelete: (sid: string, iid: string) => void;
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
        className={`w-4 h-4 border flex-shrink-0 mt-0.5 transition ${item.done ? "bg-ink border-ink" : "border-mute hover:border-ink"}`}
        aria-label="완료 토글"
      >
        {item.done && <span className="block text-paper text-[10px] leading-4 text-center">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] ${item.done ? "line-through text-soft" : "text-ink"}`}>
          {item.priority === "red" && <span className="text-gold">● </span>}
          {item.text}
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
      </div>
      <button onClick={() => onDelete(sid, item.id)} className="text-soft hover:text-ink text-sm">×</button>
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
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          onToggle={onToggle}
          onSetDue={onSetDue}
          onAdd={onAdd}
          onDelete={onDelete}
        />
      ))}
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
  const [open, setOpen] = useState(true);
  const [newText, setNewText] = useState("");
  const doneCount = section.items.filter((i) => i.done).length;

  return (
    <section>
      <button className="w-full flex items-baseline justify-between border-b border-hair pb-2" onClick={() => setOpen((o) => !o)}>
        <span className="font-serif text-[17px] text-ink">{section.title}</span>
        <span className="eyebrow tabular-nums">
          {doneCount} / {section.items.length} <span className="ml-2 text-soft/70">{open ? "−" : "+"}</span>
        </span>
      </button>

      {open && (
        <>
          <ul className="divide-y divide-hair">
            {section.items.map((item) => {
              const d = item.dueDate ? daysSince(item.dueDate) : null;
              const overdue = !item.done && d !== null && d > 0;
              return (
                <li key={item.id} className="flex items-center gap-3 py-3.5 text-[14px]">
                  <button
                    onClick={() => onToggle(section.id, item.id)}
                    className={`w-4 h-4 border flex-shrink-0 transition ${item.done ? "bg-ink border-ink" : "border-mute hover:border-ink"}`}
                    aria-label="완료 토글"
                  >
                    {item.done && <span className="block text-paper text-[10px] leading-4 text-center">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={item.done ? "line-through text-soft" : "text-ink"}>
                      {item.priority === "red" && <span className="text-gold">● </span>}{item.text}
                    </span>
                    {item.dueDate && (
                      <span className={`ml-2 text-[11px] tabular-nums ${overdue ? "text-gold" : "text-soft"}`}>
                        {item.dueDate}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={item.dueDate ?? ""}
                    onChange={(e) => onSetDue(section.id, item.id, e.target.value)}
                    className="text-[11px] text-soft w-7 opacity-60 bg-transparent"
                    title="마감일"
                  />
                  <button onClick={() => onDelete(section.id, item.id)} className="text-soft hover:text-ink text-sm">×</button>
                </li>
              );
            })}
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
      )}
    </section>
  );
}
