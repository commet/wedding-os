import { useState } from "react";
import type { WeddingData, CheckItem, ChecklistSection } from "../lib/schema";
import { defaultChecklist } from "../data/checklistTemplate";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Checklist({ data, update }: Props) {
  const sections = data.checklist;

  const loadDefault = () => {
    update((prev: WeddingData) => ({ ...prev, checklist: defaultChecklist() }));
  };

  const toggleItem = (sectionId: string, itemId: string) => {
    update((prev: WeddingData) => ({
      ...prev,
      checklist: prev.checklist.map(s =>
        s.id !== sectionId ? s : {
          ...s,
          items: s.items.map(i =>
            i.id !== itemId ? i : { ...i, done: !i.done }
          ),
        }
      ),
    }));
  };

  const addItem = (sectionId: string, text: string) => {
    if (!text.trim()) return;
    update((prev: WeddingData) => ({
      ...prev,
      checklist: prev.checklist.map(s =>
        s.id !== sectionId ? s : {
          ...s,
          items: [...s.items, { id: `cl-${Date.now()}`, text: text.trim(), done: false }],
        }
      ),
    }));
  };

  const deleteItem = (sectionId: string, itemId: string) => {
    update((prev: WeddingData) => ({
      ...prev,
      checklist: prev.checklist.map(s =>
        s.id !== sectionId ? s : { ...s, items: s.items.filter(i => i.id !== itemId) }
      ),
    }));
  };

  const cyclePriority = (sectionId: string, itemId: string) => {
    const order: (CheckItem["priority"] | undefined)[] = [undefined, "red", "yellow", "green"];
    update((prev: WeddingData) => ({
      ...prev,
      checklist: prev.checklist.map(s =>
        s.id !== sectionId ? s : {
          ...s,
          items: s.items.map(i => {
            if (i.id !== itemId) return i;
            const idx = order.indexOf(i.priority);
            return { ...i, priority: order[(idx + 1) % order.length] };
          }),
        }
      ),
    }));
  };

  if (sections.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-soft mb-4">아직 체크리스트가 없어요.</p>
        <button onClick={loadDefault} className="btn-primary">
          기본 체크리스트 가져오기 (8 카테고리)
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 space-y-4">
      <h1 className="font-serif text-2xl">체크리스트</h1>
      {sections.map(section => (
        <SectionCard
          key={section.id}
          section={section}
          onToggle={toggleItem}
          onAdd={addItem}
          onDelete={deleteItem}
          onCyclePriority={cyclePriority}
        />
      ))}
    </div>
  );
}

function SectionCard({
  section, onToggle, onAdd, onDelete, onCyclePriority,
}: {
  section: ChecklistSection;
  onToggle: (sid: string, iid: string) => void;
  onAdd: (sid: string, text: string) => void;
  onDelete: (sid: string, iid: string) => void;
  onCyclePriority: (sid: string, iid: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [newText, setNewText] = useState("");

  const doneCount = section.items.filter(i => i.done).length;

  return (
    <div className="card">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-medium">{section.icon} {section.title}</span>
        <span className="text-xs text-soft">{doneCount} / {section.items.length} {open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          <ul className="mt-3 space-y-2">
            {section.items.map(item => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => onToggle(section.id, item.id)}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                    item.done ? "bg-gold border-gold" : "border-line"
                  }`}
                />
                <button
                  onClick={() => onCyclePriority(section.id, item.id)}
                  className="text-base leading-none"
                  title="우선순위 토글"
                >
                  {item.priority === "red" ? "🔴" : item.priority === "yellow" ? "🟡" : item.priority === "green" ? "🟢" : "⚪"}
                </button>
                <span className={`flex-1 ${item.done ? "line-through text-soft" : ""}`}>
                  {item.text}
                </span>
                <button
                  onClick={() => onDelete(section.id, item.id)}
                  className="text-soft text-xs hover:text-red-500"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>

          <form
            onSubmit={(e) => { e.preventDefault(); onAdd(section.id, newText); setNewText(""); }}
            className="mt-3 flex gap-2"
          >
            <input
              className="input flex-1 text-sm"
              placeholder="새 항목 추가…"
              value={newText}
              onChange={e => setNewText(e.target.value)}
            />
            <button className="btn-secondary text-sm" type="submit">추가</button>
          </form>
        </>
      )}
    </div>
  );
}
