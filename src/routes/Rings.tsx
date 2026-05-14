import { useState } from "react";
import type { WeddingData, Ring } from "../lib/schema";
import { RING_CATALOG } from "../data/ringsTemplate";
import FreshnessBadge from "../components/FreshnessBadge";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import Modal from "../components/Modal";
import { ringPriceCheckPrompt, BridgePrompt } from "../lib/chatbotBridge";
import { todayISO } from "../lib/freshness";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Rings({ data, update }: Props) {
  const [bridgePrompt, setBridgePrompt] = useState<BridgePrompt | null>(null);
  const [bridgeTarget, setBridgeTarget] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [filter, setFilter] = useState<"all" | "starred" | "liked">("all");

  const rings = data.rings;

  const importFromCatalog = (catalogRing: Ring) => {
    if (rings.some(r => r.brand === catalogRing.brand && r.model === catalogRing.model)) return;
    update((prev: WeddingData) => ({
      ...prev,
      rings: [...prev.rings, { ...catalogRing, id: `ring-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` }],
    }));
  };

  const importAllCatalog = () => {
    update((prev: WeddingData) => {
      const existing = new Set(prev.rings.map(r => `${r.brand}::${r.model}`));
      const toAdd = RING_CATALOG
        .filter(r => !existing.has(`${r.brand}::${r.model}`))
        .map(r => ({ ...r, id: `ring-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` }));
      return { ...prev, rings: [...prev.rings, ...toAdd] };
    });
    setShowCatalog(false);
  };

  const toggle = (id: string, kind: "starred" | "liked", who: "groom" | "bride") => {
    update((prev: WeddingData) => ({
      ...prev,
      rings: prev.rings.map(r => {
        if (r.id !== id) return r;
        const key = kind === "starred" ? "starredBy" : "likedBy";
        const arr = r[key] ?? [];
        const has = arr.includes(who);
        return { ...r, [key]: has ? arr.filter(x => x !== who) : [...arr, who] };
      }),
    }));
  };

  const removeRing = (id: string) => {
    update((prev: WeddingData) => ({ ...prev, rings: prev.rings.filter(r => r.id !== id) }));
  };

  const openPriceCheck = (ring: Ring) => {
    setBridgePrompt(ringPriceCheckPrompt(ring.brand, ring.model, ring.material));
    setBridgeTarget(ring.id);
  };

  const applyPrice = (parsed: any) => {
    if (!bridgeTarget) return;
    const { priceKRW, source } = parsed ?? {};
    update((prev: WeddingData) => ({
      ...prev,
      rings: prev.rings.map(r =>
        r.id !== bridgeTarget ? r : {
          ...r,
          priceKRW: typeof priceKRW === "number" ? priceKRW : r.priceKRW,
          source: source ?? r.source,
          lastVerified: todayISO(),
        }
      ),
    }));
    setBridgeTarget(null);
  };

  const filtered = rings.filter(r => {
    if (filter === "starred") return (r.starredBy?.length ?? 0) > 0;
    if (filter === "liked") return (r.likedBy?.length ?? 0) > 0;
    return true;
  });

  return (
    <div className="px-5 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">결혼반지</h1>
        <button onClick={() => setShowAdd(true)} className="btn-secondary text-sm">+ 직접 추가</button>
      </div>

      {rings.length === 0 ? (
        <div className="card text-center">
          <p className="text-soft mb-4">아직 후보가 없어요.</p>
          <button onClick={() => setShowCatalog(true)} className="btn-primary">
            카탈로그에서 후보 가져오기
          </button>
          <p className="text-xs text-soft mt-3">
            (티파니 · 까르띠에 · 샤넬 등 25개 모델)
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {(["all", "starred", "liked"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-sm px-3 py-1.5 rounded-full ${
                  filter === f ? "bg-gold text-white" : "bg-white border border-line text-soft"
                }`}
              >
                {f === "all" ? "전체" : f === "starred" ? "★ 즐겨찾기" : "♥ 좋아요"}
              </button>
            ))}
            <button onClick={() => setShowCatalog(true)} className="text-sm text-gold underline ml-auto">
              카탈로그
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(ring => (
              <RingCard
                key={ring.id}
                ring={ring}
                onToggle={toggle}
                onCheck={() => openPriceCheck(ring)}
                onRemove={() => removeRing(ring.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* 카탈로그 모달 */}
      <Modal open={showCatalog} onClose={() => setShowCatalog(false)} title="반지 카탈로그">
        <p className="text-sm text-soft mb-3">
          관심 있는 후보를 골라 내 목록에 추가하세요. 한 번에 다 가져올 수도 있어요.
        </p>
        <button onClick={importAllCatalog} className="btn-primary w-full mb-4">
          전체 가져오기 ({RING_CATALOG.length}개)
        </button>
        <div className="space-y-2">
          {RING_CATALOG.map(r => (
            <button
              key={r.id}
              onClick={() => importFromCatalog(r)}
              className="w-full text-left card flex items-center justify-between hover:bg-cream"
            >
              <div>
                <div className="text-sm font-medium">{r.brand} {r.model}</div>
                <div className="text-xs text-soft">{r.material} · {r.priceKRW?.toLocaleString()}원</div>
              </div>
              <span className="text-gold text-sm">+ 추가</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* 직접 추가 모달 */}
      <AddRingModal open={showAdd} onClose={() => setShowAdd(false)} update={update} />

      {/* 챗봇 다리 */}
      <ChatbotBridgeModal
        open={!!bridgePrompt}
        onClose={() => { setBridgePrompt(null); setBridgeTarget(null); }}
        prompt={bridgePrompt}
        onApply={applyPrice}
      />
    </div>
  );
}

function RingCard({
  ring, onToggle, onCheck, onRemove,
}: {
  ring: Ring;
  onToggle: (id: string, kind: "starred" | "liked", who: "groom" | "bride") => void;
  onCheck: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium">{ring.brand}</div>
          <div className="text-sm text-soft">{ring.model}</div>
          {ring.material && <div className="text-xs text-soft mt-1">{ring.material}</div>}
        </div>
        <button onClick={onRemove} className="text-xs text-soft hover:text-red-500">×</button>
      </div>

      <div className="mt-3 text-lg font-medium">
        {ring.priceKRW ? `${ring.priceKRW.toLocaleString()}원` : "가격 미정"}
      </div>

      <div className="mt-2">
        <FreshnessBadge lastVerified={ring.lastVerified} onClickCheck={onCheck} />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div>
          <div className="text-xs text-soft mb-1">★ 즐겨찾기</div>
          <div className="flex gap-1">
            <ToggleChip on={(ring.starredBy ?? []).includes("groom")} onClick={() => onToggle(ring.id, "starred", "groom")} label="신랑" />
            <ToggleChip on={(ring.starredBy ?? []).includes("bride")} onClick={() => onToggle(ring.id, "starred", "bride")} label="신부" />
          </div>
        </div>
        <div>
          <div className="text-xs text-soft mb-1">♥ 좋아요</div>
          <div className="flex gap-1">
            <ToggleChip on={(ring.likedBy ?? []).includes("groom")} onClick={() => onToggle(ring.id, "liked", "groom")} label="신랑" />
            <ToggleChip on={(ring.likedBy ?? []).includes("bride")} onClick={() => onToggle(ring.id, "liked", "bride")} label="신부" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string; }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded-full ${
        on ? "bg-gold text-white" : "bg-white border border-line text-soft"
      }`}
    >
      {label}
    </button>
  );
}

function AddRingModal({ open, onClose, update }: { open: boolean; onClose: () => void; update: (patch: any) => void; }) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [material, setMaterial] = useState("");
  const [priceKRW, setPriceKRW] = useState("");

  const submit = () => {
    if (!brand.trim() || !model.trim()) return;
    update((prev: WeddingData) => ({
      ...prev,
      rings: [...prev.rings, {
        id: `ring-${Date.now()}`,
        brand: brand.trim(),
        model: model.trim(),
        material: material.trim() || undefined,
        priceKRW: priceKRW ? Number(priceKRW.replace(/,/g, "")) : undefined,
        lastVerified: todayISO(),
      }],
    }));
    setBrand(""); setModel(""); setMaterial(""); setPriceKRW("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="반지 직접 추가">
      <div className="space-y-3">
        <div>
          <label className="label">브랜드</label>
          <input className="input" value={brand} onChange={e => setBrand(e.target.value)} placeholder="예: 티파니" />
        </div>
        <div>
          <label className="label">모델명</label>
          <input className="input" value={model} onChange={e => setModel(e.target.value)} placeholder="예: 투게더 4mm" />
        </div>
        <div>
          <label className="label">소재 (선택)</label>
          <input className="input" value={material} onChange={e => setMaterial(e.target.value)} placeholder="예: 플래티넘" />
        </div>
        <div>
          <label className="label">가격 (원, 선택)</label>
          <input className="input" type="number" value={priceKRW} onChange={e => setPriceKRW(e.target.value)} placeholder="1850000" />
        </div>
        <button onClick={submit} className="btn-primary w-full">추가하기</button>
      </div>
    </Modal>
  );
}
