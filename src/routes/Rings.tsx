import { useState, useEffect, useMemo } from "react";
import type { WeddingData, Ring } from "../lib/schema";
import { RING_CATALOG } from "../data/ringsTemplate";
import FreshnessBadge from "../components/FreshnessBadge";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import Modal from "../components/Modal";
import VendorActions from "../components/VendorActions";
import { ringPriceCheckPrompt, BridgePrompt } from "../lib/chatbotBridge";
import { todayISO } from "../lib/freshness";

// 브랜드별 공식 사이트 — 모델 페이지는 변동이 잦아 메인 도메인만.
// (curl 403도 실제 브라우저에서는 정상 동작)
const BRAND_SITES: Record<string, string> = {
  "티파니": "https://www.tiffany.com/",
  "까르띠에": "https://www.cartier.com/",
  "샤넬": "https://www.chanel.com/",
  "불가리": "https://www.bulgari.com/",
  "부쉐론": "https://www.boucheron.com/",
  "쇼메": "https://www.chaumet.com/",
  "피아제": "https://www.piaget.com/",
  "반 클리프 아펠": "https://www.vancleefarpels.com/",
  "드 비어스": "https://www.debeers.com/",
};

type Props = { data: WeddingData; update: (patch: any) => void; };
type Who = "groom" | "bride";

function ringScore(r: Ring): number {
  return (r.starredBy?.length ?? 0) + (r.likedBy?.length ?? 0);
}

export default function Rings({ data, update }: Props) {
  const [who, setWho] = useState<Who>("bride");
  const [bridgePrompt, setBridgePrompt] = useState<BridgePrompt | null>(null);
  const [bridgeTarget, setBridgeTarget] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("전체");

  // 처음 진입 시 카탈로그 25개 자동 노출
  useEffect(() => {
    if (data.rings.length === 0) {
      update((prev: WeddingData) =>
        prev.rings.length === 0
          ? { ...prev, rings: RING_CATALOG.map((r) => ({ ...r })) }
          : prev
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rings = data.rings;

  const top5 = useMemo(
    () =>
      [...rings]
        .filter((r) => ringScore(r) > 0)
        .sort((a, b) => ringScore(b) - ringScore(a))
        .slice(0, 5),
    [rings]
  );

  const brands = useMemo(
    () => ["전체", ...Array.from(new Set(rings.map((r) => r.brand)))],
    [rings]
  );

  const visible = brandFilter === "전체" ? rings : rings.filter((r) => r.brand === brandFilter);

  const toggle = (id: string, kind: "starred" | "liked") => {
    update((prev: WeddingData) => ({
      ...prev,
      rings: prev.rings.map((r) => {
        if (r.id !== id) return r;
        const key = kind === "starred" ? "starredBy" : "likedBy";
        const arr = r[key] ?? [];
        const has = arr.includes(who);
        return { ...r, [key]: has ? arr.filter((x) => x !== who) : [...arr, who] };
      }),
    }));
  };

  const removeRing = (id: string) => {
    update((prev: WeddingData) => ({ ...prev, rings: prev.rings.filter((r) => r.id !== id) }));
  };

  const resetCatalog = () => {
    if (!confirm("카탈로그를 처음 상태로 되돌릴까요? 직접 추가한 반지와 ★/♥ 표시가 사라져요.")) return;
    update((prev: WeddingData) => ({ ...prev, rings: RING_CATALOG.map((r) => ({ ...r })) }));
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
      rings: prev.rings.map((r) =>
        r.id !== bridgeTarget
          ? r
          : {
              ...r,
              priceKRW: typeof priceKRW === "number" ? priceKRW : r.priceKRW,
              source: source ?? r.source,
              lastVerified: todayISO(),
            }
      ),
    }));
    setBridgeTarget(null);
  };

  return (
    <div className="px-5 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">결혼반지</h1>
        <button onClick={() => setShowAdd(true)} className="btn-ghost text-sm">+ 직접 추가</button>
      </div>

      {/* 신랑/신부 토글 */}
      <div className="card flex items-center gap-2">
        <span className="text-sm text-soft flex-shrink-0">지금 고르는 사람</span>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setWho("bride")}
            className={`text-sm px-3 py-1.5 rounded-full ${who === "bride" ? "bg-gold text-white" : "bg-white border border-line text-soft"}`}
          >
            👰 신부
          </button>
          <button
            onClick={() => setWho("groom")}
            className={`text-sm px-3 py-1.5 rounded-full ${who === "groom" ? "bg-gold text-white" : "bg-white border border-line text-soft"}`}
          >
            🤵 신랑
          </button>
        </div>
      </div>

      {/* Top 5 */}
      {top5.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">⭐ 우리의 Top {top5.length}</h2>
          <div className="space-y-2">
            {top5.map((ring, i) => (
              <div key={ring.id} className="card flex items-center gap-3 border-gold/30">
                <span className="font-serif text-xl text-gold w-6 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{ring.brand} {ring.model}</div>
                  <div className="text-xs text-soft">
                    {ring.priceKRW ? `${ring.priceKRW.toLocaleString()}원` : "가격 미정"}
                  </div>
                </div>
                <div className="text-xs text-soft flex flex-col items-end gap-0.5">
                  {(ring.starredBy?.length ?? 0) > 0 && (
                    <span>★ {ring.starredBy!.map((w) => (w === "bride" ? "신부" : "신랑")).join("·")}</span>
                  )}
                  {(ring.likedBy?.length ?? 0) > 0 && (
                    <span>♥ {ring.likedBy!.map((w) => (w === "bride" ? "신부" : "신랑")).join("·")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 브랜드 필터 */}
      {brands.length > 2 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setBrandFilter(b)}
              className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 ${brandFilter === b ? "bg-ink text-white" : "bg-white border border-line text-soft"}`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {/* 전체 카탈로그 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">반지 카탈로그 ({visible.length})</h2>
          <button onClick={resetCatalog} className="text-xs text-soft underline">처음 상태로</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((ring) => (
            <RingCard
              key={ring.id}
              ring={ring}
              who={who}
              onToggle={toggle}
              onCheck={() => openPriceCheck(ring)}
              onRemove={() => removeRing(ring.id)}
            />
          ))}
        </div>
      </section>

      <AddRingModal open={showAdd} onClose={() => setShowAdd(false)} update={update} />

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
  ring, who, onToggle, onCheck, onRemove,
}: {
  ring: Ring;
  who: Who;
  onToggle: (id: string, kind: "starred" | "liked") => void;
  onCheck: () => void;
  onRemove: () => void;
}) {
  const starredByMe = (ring.starredBy ?? []).includes(who);
  const likedByMe = (ring.likedBy ?? []).includes(who);
  const other: Who = who === "bride" ? "groom" : "bride";
  const otherLabel = other === "bride" ? "신부" : "신랑";
  const starredByOther = (ring.starredBy ?? []).includes(other);
  const likedByOther = (ring.likedBy ?? []).includes(other);

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{ring.brand}</div>
          <div className="text-sm text-soft truncate">{ring.model}</div>
          {ring.material && <div className="text-xs text-soft mt-0.5">{ring.material}</div>}
        </div>
        <button onClick={onRemove} className="text-soft text-xs px-1">×</button>
      </div>

      <div className="mt-2 text-base font-medium">
        {ring.priceKRW ? `${ring.priceKRW.toLocaleString()}원` : "가격 미정"}
      </div>

      <div className="mt-1">
        <FreshnessBadge lastVerified={ring.lastVerified} onClickCheck={onCheck} />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onToggle(ring.id, "starred")}
          className={`flex-1 text-sm py-2 rounded-lg border ${starredByMe ? "bg-gold text-white border-gold" : "bg-white border-line text-soft"}`}
        >
          {starredByMe ? "★" : "☆"} 즐겨찾기
        </button>
        <button
          onClick={() => onToggle(ring.id, "liked")}
          className={`flex-1 text-sm py-2 rounded-lg border ${likedByMe ? "bg-gold text-white border-gold" : "bg-white border-line text-soft"}`}
        >
          {likedByMe ? "♥" : "♡"} 좋아요
        </button>
      </div>

      {(starredByOther || likedByOther) && (
        <div className="mt-2 text-xs text-soft">
          {otherLabel}: {starredByOther && "★"} {likedByOther && "♥"}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-line">
        <VendorActions
          name={ring.brand}
          query={ring.model}
          officialUrl={BRAND_SITES[ring.brand]}
        />
      </div>
    </div>
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
      rings: [
        {
          id: `ring-${Date.now()}`,
          brand: brand.trim(),
          model: model.trim(),
          material: material.trim() || undefined,
          priceKRW: priceKRW ? Number(priceKRW.replace(/,/g, "")) : undefined,
          lastVerified: todayISO(),
        },
        ...prev.rings,
      ],
    }));
    setBrand(""); setModel(""); setMaterial(""); setPriceKRW("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="반지 직접 추가">
      <div className="space-y-3">
        <div>
          <label className="label">브랜드</label>
          <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="예: 티파니" />
        </div>
        <div>
          <label className="label">모델명</label>
          <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="예: 투게더 4mm" />
        </div>
        <div>
          <label className="label">소재 (선택)</label>
          <input className="input" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="예: 플래티넘" />
        </div>
        <div>
          <label className="label">가격 (원, 선택)</label>
          <input className="input" type="number" value={priceKRW} onChange={(e) => setPriceKRW(e.target.value)} placeholder="1850000" />
        </div>
        <button onClick={submit} className="btn-primary w-full">추가하기</button>
      </div>
    </Modal>
  );
}
