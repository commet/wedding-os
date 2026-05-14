import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import type { WeddingData, CheckItem, ChecklistSection } from "../lib/schema";
import { defaultChecklist, recalcDueDates } from "../data/checklistTemplate";
import { daysSince } from "../lib/freshness";

type Props = { data: WeddingData; update: (patch: any) => void; };
type View = "category" | "timeline";

export default function Checklist({ data, update }: Props) {
  const [view, setView] = useState<View>("timeline");
  const sections = data.checklist;
  const weddingDate = data.invitation.date;

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
      <div className="px-5 py-10 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <p className="text-soft text-sm leading-relaxed">
          결혼 준비, 놓치는 것 없이.<br />
          표준 타임라인을 불러오면 결혼식 날짜에 맞춰<br />
          할 일마다 마감일이 자동으로 잡혀요.
        </p>
        {!weddingDate && (
          <p className="text-xs text-yellow-600">
            먼저 <Link to="/invitation" className="underline">청첩장</Link>에서 결혼식 날짜를 입력하면 더 정확해요.
          </p>
        )}
        <button onClick={loadDefault} className="btn-primary">
          준비 타임라인 불러오기
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">체크리스트</h1>
        <span className="text-sm text-soft">{doneCount} / {allItems.length}</span>
      </div>

      {/* 진행률 */}
      <div className="w-full h-2 bg-line rounded-full overflow-hidden">
        <div className="h-full bg-gold transition-all" style={{ width: `${allItems.length ? (doneCount / allItems.length) * 100 : 0}%` }} />
      </div>

      {/* 뷰 토글 */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("timeline")}
          className={`text-sm px-3 py-1.5 rounded-full ${view === "timeline" ? "bg-ink text-white" : "bg-white border border-line text-soft"}`}
        >
          📅 일정순
        </button>
        <button
          onClick={() => setView("category")}
          className={`text-sm px-3 py-1.5 rounded-full ${view === "category" ? "bg-ink text-white" : "bg-white border border-line text-soft"}`}
        >
          📋 카테고리
        </button>
        {weddingDate && (
          <button onClick={recalc} className="text-xs text-gold underline ml-auto">
            날짜 기준 재계산
          </button>
        )}
      </div>

      {view === "timeline" ? (
        <TimelineView items={allItems} onToggle={toggleItem} onSetDue={setDue} onDelete={deleteItem} />
      ) : (
        <CategoryView sections={sections} onToggle={toggleItem} onSetDue={setDue} onAdd={addItem} onDelete={deleteItem} />
      )}
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
  overdue: { label: "🔴 마감 지났어요", color: "text-red-500" },
  week: { label: "⏰ 이번 주 안에", color: "text-orange-500" },
  month: { label: "📌 이번 달 안에", color: "text-gold" },
  later: { label: "🗓️ 다가오는 일정", color: "text-soft" },
  nodate: { label: "📭 날짜 미정", color: "text-soft" },
  done: { label: "✓ 완료", color: "text-soft" },
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
    <div className="space-y-5">
      {BUCKET_ORDER.map((bucket) => {
        const list = grouped[bucket];
        if (!list || list.length === 0) return null;
        const meta = BUCKET_META[bucket];
        return (
          <section key={bucket}>
            <h2 className={`text-sm font-medium mb-2 ${meta.color}`}>
              {meta.label} <span className="text-soft">({list.length})</span>
            </h2>
            <div className="space-y-2">
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
    <div className="card flex items-start gap-3 py-3">
      <button
        onClick={() => onToggle(sid, item.id)}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${item.done ? "bg-gold border-gold" : "border-line"}`}
      />
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${item.done ? "line-through text-soft" : ""}`}>
          {item.priority === "red" && "🔴 "}
          {item.text}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-soft">
          <span>{item.icon} {item.section}</span>
          {editDate ? (
            <input
              type="date"
              autoFocus
              defaultValue={item.dueDate ?? ""}
              onBlur={(e) => { onSetDue(sid, item.id, e.target.value); setEditDate(false); }}
              className="border border-line rounded px-1 py-0.5 text-xs"
            />
          ) : (
            <button onClick={() => setEditDate(true)} className="underline">
              {item.dueDate ? `${item.dueDate}${ddayLabel ? ` · ${ddayLabel}` : ""}` : "+ 마감일"}
            </button>
          )}
        </div>
      </div>
      <button onClick={() => onDelete(sid, item.id)} className="text-soft text-xs">×</button>
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
    <div className="space-y-3">
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
    <div className="card">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <span className="font-medium">{section.icon} {section.title}</span>
        <span className="text-xs text-soft">{doneCount} / {section.items.length} {open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          <ul className="mt-3 space-y-2">
            {section.items.map((item) => {
              const d = item.dueDate ? daysSince(item.dueDate) : null;
              const overdue = !item.done && d !== null && d > 0;
              return (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => onToggle(section.id, item.id)}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${item.done ? "bg-gold border-gold" : "border-line"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <span className={item.done ? "line-through text-soft" : ""}>
                      {item.priority === "red" && "🔴 "}{item.text}
                    </span>
                    {item.dueDate && (
                      <span className={`ml-2 text-xs ${overdue ? "text-red-500" : "text-soft"}`}>
                        {item.dueDate}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={item.dueDate ?? ""}
                    onChange={(e) => onSetDue(section.id, item.id, e.target.value)}
                    className="text-xs text-soft w-7 opacity-60"
                    title="마감일"
                  />
                  <button onClick={() => onDelete(section.id, item.id)} className="text-soft text-xs">×</button>
                </li>
              );
            })}
          </ul>

          <form
            onSubmit={(e) => { e.preventDefault(); onAdd(section.id, newText); setNewText(""); }}
            className="mt-3 flex gap-2"
          >
            <input
              className="input flex-1 text-sm"
              placeholder="새 항목 추가…"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
            />
            <button className="btn-secondary text-sm" type="submit">추가</button>
          </form>
        </>
      )}
    </div>
  );
}
