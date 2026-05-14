import { useState } from "react";
import type { WeddingData, HoneymoonRegion } from "../lib/schema";
import Modal from "../components/Modal";
import { demoData } from "../data/demoData";
import { honeymoonSearchLinks } from "../lib/searchLinks";
import SearchLinks from "../components/SearchLinks";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Honeymoon({ data, update }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(data.honeymoon.regions[0]?.id ?? null);

  const addRegion = (r: Omit<HoneymoonRegion, "id">) => {
    const id = `region-${Date.now()}`;
    update((prev: WeddingData) => ({
      ...prev,
      honeymoon: { ...prev.honeymoon, regions: [...prev.honeymoon.regions, { ...r, id }] },
    }));
    setActiveId(id);
  };

  const removeRegion = (id: string) => {
    update((prev: WeddingData) => ({
      ...prev,
      honeymoon: { ...prev.honeymoon, regions: prev.honeymoon.regions.filter(r => r.id !== id) },
    }));
  };

  const updateRegion = (id: string, patch: Partial<HoneymoonRegion>) => {
    update((prev: WeddingData) => ({
      ...prev,
      honeymoon: {
        ...prev.honeymoon,
        regions: prev.honeymoon.regions.map(r => r.id === id ? { ...r, ...patch } : r),
      },
    }));
  };

  const active = data.honeymoon.regions.find(r => r.id === activeId) ?? data.honeymoon.regions[0];

  return (
    <div className="px-5 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">신혼여행</h1>
        <button onClick={() => setShowAdd(true)} className="btn-secondary text-sm">+ 후보지 추가</button>
      </div>

      {data.honeymoon.regions.length === 0 ? (
        <div className="card text-center py-8 space-y-4">
          <div className="text-3xl">🏝️</div>
          <p className="text-soft text-sm">
            후보 여행지를 모아 일정·예산을 비교해보세요.<br />(예: 발리, 몰디브, 오키나와…)
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                const demo = demoData().honeymoon;
                update((prev: WeddingData) => ({
                  ...prev,
                  honeymoon: {
                    ...demo,
                    regions: demo.regions.map((r, i) => ({ ...r, id: `region-${Date.now()}-${i}` })),
                  },
                }));
                setActiveId(null);
              }}
              className="btn-primary text-sm"
            >
              예시 불러오기
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-secondary text-sm">
              직접 추가
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {data.honeymoon.regions.map(r => (
              <button
                key={r.id}
                onClick={() => setActiveId(r.id)}
                className={`text-sm px-4 py-2 rounded-full flex-shrink-0 ${
                  active?.id === r.id ? "bg-gold text-white" : "bg-white border border-line text-soft"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>

          {active && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-lg">{active.name}</h2>
                <button onClick={() => removeRegion(active.id)} className="text-soft text-xs">삭제</button>
              </div>
              <div>
                <label className="label">기간 (일)</label>
                <input
                  type="number"
                  className="input"
                  value={active.durationDays ?? ""}
                  onChange={(e) => updateRegion(active.id, { durationDays: Number(e.target.value) || undefined })}
                  placeholder="7"
                />
              </div>
              <div>
                <label className="label">예산 (원)</label>
                <input
                  type="number"
                  className="input"
                  value={active.budgetKRW ?? ""}
                  onChange={(e) => updateRegion(active.id, { budgetKRW: Number(e.target.value) || undefined })}
                  placeholder="3000000"
                />
              </div>
              <div>
                <label className="label">일정</label>
                <textarea
                  className="input min-h-[120px]"
                  value={active.schedule ?? ""}
                  onChange={(e) => updateRegion(active.id, { schedule: e.target.value })}
                  placeholder="Day 1: 도착, 호텔 체크인&#10;Day 2: ..."
                />
              </div>
              <div>
                <label className="label">메모</label>
                <textarea
                  className="input min-h-[80px]"
                  value={active.notes ?? ""}
                  onChange={(e) => updateRegion(active.id, { notes: e.target.value })}
                />
              </div>
              <div className="pt-2 border-t border-line">
                <SearchLinks
                  label={`🔎 "${active.name}" 항공·숙소·투어 검색`}
                  links={honeymoonSearchLinks(active.name)}
                />
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="여행지 추가">
        <AddForm onSubmit={(r) => { addRegion(r); setShowAdd(false); }} />
      </Modal>
    </div>
  );
}

function AddForm({ onSubmit }: { onSubmit: (r: Omit<HoneymoonRegion, "id">) => void; }) {
  const [name, setName] = useState("");
  return (
    <div className="space-y-3">
      <div>
        <label className="label">여행지 이름</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="예: 알래스카" />
      </div>
      <button className="btn-primary w-full" onClick={() => name.trim() && onSubmit({ name: name.trim() })}>
        추가
      </button>
    </div>
  );
}
