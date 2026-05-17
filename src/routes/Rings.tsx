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
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-2">Rings</div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-[2rem] leading-none">결혼반지</h1>
          <button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
            + 직접 추가
          </button>
        </div>
      </div>

      {/* 신랑/신부 — underline 탭 */}
      <div className="flex items-baseline justify-between border-b border-hair pb-3">
        <span className="eyebrow">지금 고르는 사람</span>
        <div className="flex gap-5">
          <button
            onClick={() => setWho("bride")}
            className={`text-[12px] transition pb-1 ${who === "bride" ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
          >
            신부
          </button>
          <button
            onClick={() => setWho("groom")}
            className={`text-[12px] transition pb-1 ${who === "groom" ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
          >
            신랑
          </button>
        </div>
      </div>

      {/* Top — 번호 매겨진 hairline 리스트 */}
      {top5.length > 0 && (
        <section>
          <h2 className="eyebrow-gold mb-4">우리의 Top {top5.length}</h2>
          <ul className="divide-y divide-hair border-y border-hair">
            {top5.map((ring, i) => (
              <li key={ring.id} className="flex items-baseline gap-5 py-4">
                <span className="font-serif text-soft text-base tabular-nums w-5 flex-shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-[15px] text-ink truncate">{ring.brand}<span className="text-soft"> · </span>{ring.model}</div>
                  <div className="eyebrow mt-1">
                    {ring.priceKRW ? `${ring.priceKRW.toLocaleString()}원` : "가격 미정"}
                  </div>
                </div>
                <div className="text-[10px] tracking-wide text-soft flex flex-col items-end gap-0.5 flex-shrink-0">
                  {(ring.starredBy?.length ?? 0) > 0 && (
                    <span>★ {ring.starredBy!.map((w) => (w === "bride" ? "신부" : "신랑")).join("·")}</span>
                  )}
                  {(ring.likedBy?.length ?? 0) > 0 && (
                    <span>♥ {ring.likedBy!.map((w) => (w === "bride" ? "신부" : "신랑")).join("·")}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 브랜드 필터 — 가로 스크롤 underline chips */}
      {brands.length > 2 && (
        <div className="flex gap-5 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setBrandFilter(b)}
              className={`text-[12px] tracking-wide whitespace-nowrap pb-1 transition ${
                brandFilter === b ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {/* 전체 카탈로그 */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="eyebrow-gold">반지 카탈로그 · <span className="tabular-nums">{visible.length}</span></h2>
          <button onClick={resetCatalog} className="text-[11px] text-soft underline underline-offset-4 hover:text-ink">
            처음 상태로
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
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
    <div className="py-6 border-b border-hair">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="eyebrow text-soft mb-1">{ring.brand}</div>
          <div className="font-serif text-[17px] text-ink truncate">{ring.model}</div>
          {ring.material && <div className="text-[11px] text-soft mt-1">{ring.material}</div>}
        </div>
        <button onClick={onRemove} className="text-soft hover:text-ink text-sm px-1">×</button>
      </div>

      <div className="mt-3 font-serif text-xl text-ink tabular-nums">
        {ring.priceKRW ? `${ring.priceKRW.toLocaleString()}원` : <span className="text-soft text-base">가격 미정</span>}
      </div>

      <div className="mt-2">
        <FreshnessBadge lastVerified={ring.lastVerified} onClickCheck={onCheck} />
      </div>

      <div className="mt-4 flex gap-6 text-[12px] tracking-wide">
        <button
          onClick={() => onToggle(ring.id, "starred")}
          className={`pb-1 transition ${starredByMe ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
        >
          {starredByMe ? "★" : "☆"} 즐겨찾기
        </button>
        <button
          onClick={() => onToggle(ring.id, "liked")}
          className={`pb-1 transition ${likedByMe ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
        >
          {likedByMe ? "♥" : "♡"} 좋아요
        </button>
      </div>

      {(starredByOther || likedByOther) && (
        <div className="mt-2 text-[10.5px] tracking-wide text-soft">
          {otherLabel}: {starredByOther && "★"} {likedByOther && "♥"}
        </div>
      )}

      <div className="mt-4">
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
