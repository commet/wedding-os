import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { WeddingData, Ring } from "../lib/schema";
import { RING_CATALOG } from "../data/ringsTemplate";
import FreshnessBadge from "../components/FreshnessBadge";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import Modal from "../components/Modal";
import VendorActions from "../components/VendorActions";
import SafeImg from "../components/SafeImg";
import { ringPriceCheckPrompt, BridgePrompt } from "../lib/chatbotBridge";
import { todayISO } from "../lib/freshness";
import { koBreak } from "../lib/typography";

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
  "타사키": "https://www.tasaki.co.kr/",
  "쇼파드": "https://www.chopard.com/",
};

type Props = { data: WeddingData; update: (patch: any) => void; };
type Who = "groom" | "bride";
type RingBudgetBand = "under100" | "100to200" | "200to300" | "over300";
type RingDiamondPref = "all" | "simple" | "diamond";
type StarterRingPick = { ring: Ring; reason: string };

// 카탈로그 자동 시드를 기기당 한 번만 — 사용자가 목록을 비운 뒤 재진입해도 되살아나지 않게.
const RINGS_SEEDED_KEY = "wedding-os/rings-seeded";
const RINGS_INTRO_DISMISSED_KEY = "wedding-os/rings-intro-dismissed/v1";
const CATALOG_BY_ID = new Map(RING_CATALOG.map((ring) => [ring.id, ring]));
const OLD_RING_CATALOG_ID_MAP: Record<string, string> = {
  "ring-1": "ring-3",
  "ring-2": "ring-4",
  "ring-3": "ring-2",
  "ring-4": "ring-7",
  "ring-5": "ring-8",
  "ring-6": "ring-6",
  "ring-7": "ring-9",
  "ring-8": "ring-16",
  "ring-9": "ring-17",
  "ring-10": "ring-23",
  "ring-11": "ring-21",
  "ring-12": "ring-62",
  "ring-13": "ring-61",
  "ring-14": "ring-35",
  "ring-15": "ring-41",
  "ring-16": "ring-42",
  "ring-17": "ring-36",
  "ring-18": "ring-63",
  "ring-19": "ring-25",
  "ring-20": "ring-43",
  "ring-21": "ring-27",
  "ring-22": "ring-55",
  "ring-23": "ring-48",
  "ring-24": "ring-45",
  "ring-25": "ring-47",
};

function ringScore(r: Ring): number {
  return (r.starredBy?.length ?? 0) + (r.likedBy?.length ?? 0);
}

export default function Rings({ data, update }: Props) {
  const [searchParams] = useSearchParams();
  const [who, setWho] = useState<Who>("bride");
  const [bridgePrompt, setBridgePrompt] = useState<BridgePrompt | null>(null);
  const [bridgeTarget, setBridgeTarget] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("전체");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [showStarter, setShowStarter] = useState(() => searchParams.get("starter") === "1");
  const [introDismissed, setIntroDismissed] = useState(() => {
    try { return !!localStorage.getItem(RINGS_INTRO_DISMISSED_KEY); } catch { return false; }
  });

  function dismissIntro() {
    setIntroDismissed(true);
    try { localStorage.setItem(RINGS_INTRO_DISMISSED_KEY, "1"); } catch { /* noop */ }
  }

  // 처음 진입 시 카탈로그 25개 자동 노출 — 단 '한 번만'.
  // 사용자가 반지를 모두 지운 뒤 다시 들어와도 카탈로그가 되살아나지 않도록
  // 기기 단위 시드 플래그로 막는다. (의도적으로 카탈로그를 다시 보려면 '처음 상태로' 버튼)
  useEffect(() => {
    if (data.rings.length > 0) return;
    try {
      if (localStorage.getItem(RINGS_SEEDED_KEY)) return;
    } catch { /* localStorage 접근 불가 — 그냥 시드 */ }
    update((prev: WeddingData) =>
      prev.rings.length === 0
        ? { ...prev, rings: RING_CATALOG.map((r) => ({ ...r })) }
        : prev
    );
    try { localStorage.setItem(RINGS_SEEDED_KEY, "1"); } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shouldRecoverImageCatalog(data.rings)) return;
    update((prev: WeddingData) =>
      shouldRecoverImageCatalog(prev.rings)
        ? { ...prev, rings: recoverImageCatalog(prev.rings) }
        : prev
    );
  }, [data.rings, update]);

  useEffect(() => {
    if (!shouldRefreshCatalogImages(data.rings)) return;
    update((prev: WeddingData) => ({
      ...prev,
      rings: prev.rings.map(refreshCatalogImageFields),
    }));
  }, [data.rings, update]);

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

  const updateRing = (id: string, patch: Partial<Ring>) => {
    update((prev: WeddingData) => ({
      ...prev,
      rings: prev.rings.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const resetCatalog = () => {
    if (!confirm("카탈로그를 처음 상태로 되돌릴까요? 직접 추가한 반지와 ★/♥ 표시가 사라져요.")) return;
    update((prev: WeddingData) => ({ ...prev, rings: RING_CATALOG.map((r) => ({ ...r })) }));
  };

  const applyStarter = (items: Ring[]) => {
    update((prev: WeddingData) => {
      const selectedIds = new Set(items.map((r) => r.id));
      const existingIds = new Set(prev.rings.map((r) => r.id));
      const marked = prev.rings.map((r) => {
        if (!selectedIds.has(r.id)) return r;
        const likedBy = r.likedBy ?? [];
        return likedBy.includes(who) ? r : { ...r, likedBy: [...likedBy, who] };
      });
      const additions = items
        .filter((r) => !existingIds.has(r.id))
        .map((r) => ({ ...r, likedBy: [who] }));
      return { ...prev, rings: [...additions, ...marked] };
    });
    setShowStarter(false);
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
              source: typeof source === "string" && source.trim()
                ? `AI 참고 추정 · ${source.trim()}`
                : "AI 참고 추정 · 공식 판매처에서 재확인 필요",
            }
      ),
    }));
    setBridgeTarget(null);
  };

  return (
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-3">반지 후보</div>
        <div className="flex items-baseline justify-between">
          <h1 className="h-page">{koBreak("결혼반지")}</h1>
          <button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
            + 직접 추가
          </button>
        </div>
      </div>

      {/* 첫 진입 안내 — 카탈로그가 미리 채워진 이유를 한 번만 설명 */}
      {!introDismissed && rings.length > 0 && (
        <div className="anim-drop border-y border-hair py-4 flex items-start gap-3">
          <p className="flex-1 text-[12.5px] leading-[1.85] text-soft break-keep">
            <span className="text-ink">둘러보기예요</span> — 마음에 드는 디자인은 <span className="text-gold">♥</span>, 아닌 건 넘기면 후보가 좁혀져요.
          </p>
          <button
            onClick={dismissIntro}
            className="text-[11px] tracking-wide text-mute hover:text-ink shrink-0 pt-0.5"
            aria-label="안내 닫기"
          >
            닫기
          </button>
        </div>
      )}

      {/* 신랑/신부 — underline 탭 */}
      <div className="flex items-baseline justify-between border-b border-hair pb-3">
        <span className="eyebrow">지금 고르는 사람</span>
        <div className="flex gap-5">
          <button
            onClick={() => setWho("bride")}
            className={who === "bride" ? "seg-active" : "seg"}
          >
            신부
          </button>
          <button
            onClick={() => setWho("groom")}
            className={who === "groom" ? "seg-active" : "seg"}
          >
            신랑
          </button>
        </div>
      </div>

      {showStarter ? (
        <RingStarter who={who} onApply={applyStarter} onClose={() => setShowStarter(false)} />
      ) : (
        <button
          onClick={() => setShowStarter(true)}
          className="w-full text-left border-y border-hair py-4 flex items-baseline justify-between gap-4"
        >
          <span>
            <span className="eyebrow block mb-1">기본 후보</span>
            <span className="font-serif text-[18px] text-ink break-keep">반지 기준 잡기</span>
          </span>
          <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
        </button>
      )}

      {/* Top — 번호 매겨진 hairline 리스트 */}
      {!showStarter && top5.length > 0 && (
        <section>
          <h2 className="eyebrow mb-4">우리의 Top {top5.length}</h2>
          <ul className="divide-y divide-hair border-y border-hair">
            {top5.map((ring, i) => (
              <li key={ring.id} className="flex items-center gap-4 py-4">
                <span className="font-serif text-soft text-base tabular-nums w-5 flex-shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <RingImage ring={ring} className="w-12 h-12" />
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
      {!showStarter && catalogOpen && brands.length > 2 && (
        <div className="flex gap-5 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setBrandFilter(b)}
              className={`tracking-wide whitespace-nowrap ${brandFilter === b ? "seg-active" : "seg"}`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {/* 전체 카탈로그 */}
      {!showStarter && (
      <section>
        <div className="border-y border-hair py-4">
          <button
            type="button"
            onClick={() => setCatalogOpen((v) => !v)}
            className="w-full text-left flex items-baseline justify-between gap-4"
          >
            <span>
              <span className="eyebrow block mb-1">
                반지 카탈로그 · <span className="tabular-nums">{catalogOpen ? visible.length : rings.length}</span>
              </span>
              <span className="text-[13px] text-soft leading-relaxed break-keep">
                전체 후보는 필요할 때만 펼쳐서 비교합니다.
              </span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4 flex-shrink-0">
              {catalogOpen ? "접기" : "열기"}
            </span>
          </button>
        </div>
        {catalogOpen && (
          <>
            <p className="pt-3 text-[11.5px] text-soft leading-relaxed break-keep">
              여기 담긴 건 흔히 찾는 브랜드 위주의 <b className="text-ink">대표 예시</b>예요. 실제 디자인·라인업은 훨씬 다양하니,
              마음에 드는 게 없으면 위의 <button type="button" onClick={() => setShowAdd(true)} className="underline underline-offset-2 text-ink hover:text-gold">직접 추가</button>로 담거나 매장·브랜드 사이트에서 더 찾아보세요.
            </p>
            <div className="flex justify-end pt-3">
              <button onClick={resetCatalog} className="text-[11px] text-soft underline underline-offset-4 hover:text-ink">
                처음 상태로
              </button>
            </div>
            <div className="grid grid-cols-1">
              {visible.map((ring) => (
                <RingCard
                  key={ring.id}
                  ring={ring}
                  who={who}
                  onToggle={toggle}
                  onCheck={() => openPriceCheck(ring)}
                  onRemove={() => removeRing(ring.id)}
                  onUpdate={(patch) => updateRing(ring.id, patch)}
                />
              ))}
            </div>
          </>
        )}
      </section>
      )}

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
  ring, who, onToggle, onCheck, onRemove, onUpdate,
}: {
  ring: Ring;
  who: Who;
  onToggle: (id: string, kind: "starred" | "liked") => void;
  onCheck: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<Ring>) => void;
}) {
  const starredByMe = (ring.starredBy ?? []).includes(who);
  const likedByMe = (ring.likedBy ?? []).includes(who);
  const other: Who = who === "bride" ? "groom" : "bride";
  const otherLabel = other === "bride" ? "신부" : "신랑";
  const starredByOther = (ring.starredBy ?? []).includes(other);
  const likedByOther = (ring.likedBy ?? []).includes(other);

  return (
    <div className="py-6 border-b border-hair">
      <div className="grid grid-cols-[124px_minmax(0,1fr)] gap-4">
        <RingImage ring={ring} className="w-[124px] h-[124px]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="eyebrow text-soft mb-1">{ring.brand}</div>
              <div className="font-serif text-[18px] text-ink truncate">{koBreak(ring.model)}</div>
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
        </div>
      </div>
      <RingThumbnails ring={ring} />

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
        <div className="mt-2 text-[11px] tracking-wide text-soft">
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

      {ring.notes && (
        <p className="mt-3 text-[12px] text-soft leading-relaxed whitespace-pre-line line-clamp-2 break-keep">
          {ring.notes}
        </p>
      )}

      <details className="mt-4 group">
        <summary className="cursor-pointer list-none text-[11px] text-soft underline underline-offset-4 hover:text-ink">
          메모 / 이미지 수정
        </summary>
        <input
          className="input text-[12px] mt-3"
          placeholder="이미지 URL (공식 사이트·직접 업로드한 이미지 링크)"
          value={ring.imageUrl ?? ""}
          onChange={(e) => onUpdate({ imageUrl: e.target.value.trim() || undefined })}
        />
        <textarea
          className="input-boxed text-[12px] mt-3 min-h-[44px]"
          placeholder="메모 (반지 호수·각인 문구·매장·견적 비교)"
          value={ring.notes ?? ""}
          onChange={(e) => onUpdate({ notes: e.target.value })}
        />
      </details>
    </div>
  );
}

function RingImage({ ring, className }: { ring: Ring; className: string }) {
  return <RingImageFrame ring={ring} src={getRingImageSrc(ring)} className={className} />;
}

function RingThumbnails({ ring }: { ring: Ring }) {
  const mainSrc = getRingImageSrc(ring);
  const extraImages = (ring.imageUrls ?? []).filter((src) => src !== mainSrc);
  if (extraImages.length === 0) return null;

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {extraImages.map((src, idx) => (
        <RingImageFrame
          key={src}
          ring={ring}
          src={src}
          className="w-14 h-14"
          altSuffix={` ${idx + 2}`}
        />
      ))}
    </div>
  );
}

function RingImageFrame({
  ring,
  src,
  className,
  altSuffix = "",
}: {
  ring: Ring;
  src: string | undefined;
  className: string;
  altSuffix?: string;
}) {
  return (
    <div className={`${className} bg-white border border-hair overflow-hidden flex items-center justify-center flex-shrink-0`}>
      <SafeImg
        src={src}
        alt={`${ring.brand} ${ring.model}${altSuffix}`}
        className={ringImageClass(ring)}
        fallback={
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cream via-white to-gold/10 text-center px-2">
            <span className="font-serif text-[16px] leading-none text-gold">{ring.brand.slice(0, 1)}</span>
            <span className="mt-1 text-[10px] leading-tight text-soft line-clamp-2">{ring.model}</span>
          </div>
        }
      />
    </div>
  );
}

function getRingImageSrc(ring: Ring): string | undefined {
  return ring.imageUrl ?? ring.imageUrls?.[0];
}

function ringImageClass(ring: Ring): string {
  if (ring.imageFit === "product") return "w-full h-full object-contain scale-[1.55] translate-y-[24%]";
  if (ring.imageFit === "centerProduct") return "w-full h-full object-contain scale-[1.55] translate-y-[8%]";
  if (ring.imageFit === "flatProduct") return "w-full h-full object-contain scale-[1.55] translate-y-[38%]";
  if (ring.imageFit === "smallProduct") return "w-full h-full object-contain scale-[1.85] translate-y-[8%]";
  if (ring.imageFit === "cleanProduct") return "w-full h-full object-contain scale-[1.35]";
  if (ring.imageFit === "slightLeftProduct") return "w-full h-full object-contain scale-[1.55] -translate-x-[6%] translate-y-[24%]";
  if (ring.imageFit === "slightLeftCenterProduct") return "w-full h-full object-contain scale-[1.55] -translate-x-[6%] translate-y-[8%]";
  if (ring.imageFit === "top") return "w-full h-[135%] object-cover object-top";
  if (ring.imageFit === "center") return "w-full h-[140%] object-cover object-center";
  return "w-full h-full object-contain p-2";
}

function shouldRecoverImageCatalog(rings: Ring[]): boolean {
  if (rings.length < 20) return false;
  if (rings.some((ring) => getRingImageSrc(ring))) return false;
  const oldDefaultIds = rings.filter((ring) => {
    const match = ring.id.match(/^ring-(\d+)$/);
    if (!match) return false;
    const id = Number(match[1]);
    return id >= 1 && id <= 39;
  }).length;
  return oldDefaultIds >= 20;
}

function shouldRefreshCatalogImages(rings: Ring[]): boolean {
  return rings.some((ring) => {
    const catalog = CATALOG_BY_ID.get(ring.id);
    if (!catalog) return false;
    return (
      ring.imageFit !== catalog.imageFit ||
      JSON.stringify(ring.imageUrls ?? []) !== JSON.stringify(catalog.imageUrls ?? [])
    );
  });
}

function refreshCatalogImageFields(ring: Ring): Ring {
  const catalog = CATALOG_BY_ID.get(ring.id);
  if (!catalog) return ring;
  return {
    ...ring,
    imageFit: catalog.imageFit,
    imageUrls: catalog.imageUrls,
    imageUrl: ring.imageUrl ?? catalog.imageUrl,
  };
}

function recoverImageCatalog(rings: Ring[]): Ring[] {
  const preserved = new Map<string, Pick<Ring, "starredBy" | "likedBy" | "notes">>();

  rings.forEach((ring) => {
    const nextId = OLD_RING_CATALOG_ID_MAP[ring.id];
    if (!nextId) return;
    const current = preserved.get(nextId) ?? {};
    preserved.set(nextId, {
      starredBy: mergeWho(current.starredBy, ring.starredBy),
      likedBy: mergeWho(current.likedBy, ring.likedBy),
      notes: mergeNotes(current.notes, ring.notes),
    });
  });

  const recovered = RING_CATALOG.map((ring) => {
    const patch = preserved.get(ring.id);
    if (!patch) return { ...ring };
    return {
      ...ring,
      starredBy: patch.starredBy,
      likedBy: patch.likedBy,
      notes: mergeNotes(ring.notes, patch.notes),
    };
  });

  const extras = rings.filter((ring) => !OLD_RING_CATALOG_ID_MAP[ring.id] && shouldKeepUnmappedRing(ring));
  return [...recovered, ...extras];
}

function mergeWho(a?: Who[], b?: Who[]): Who[] | undefined {
  const merged = Array.from(new Set([...(a ?? []), ...(b ?? [])]));
  return merged.length > 0 ? merged : undefined;
}

function mergeNotes(a?: string, b?: string): string | undefined {
  const notes = [a, b].map((note) => note?.trim()).filter(Boolean);
  return notes.length > 0 ? Array.from(new Set(notes)).join("\n") : undefined;
}

function shouldKeepUnmappedRing(ring: Ring): boolean {
  const match = ring.id.match(/^ring-(\d+)$/);
  if (!match) return true;
  const id = Number(match[1]);
  if (id > 64) return true;
  return Boolean(ring.starredBy?.length || ring.likedBy?.length || ring.notes?.trim() || getRingImageSrc(ring));
}

function RingStarter({
  who,
  onApply,
  onClose,
}: {
  who: Who;
  onApply: (items: Ring[]) => void;
  onClose: () => void;
}) {
  const [budget, setBudget] = useState<RingBudgetBand>("100to200");
  const [material, setMaterial] = useState<string>("전체");
  const [diamond, setDiamond] = useState<RingDiamondPref>("all");

  const picks = useMemo(
    () => pickStarterRings({ budget, material, diamond }),
    [budget, material, diamond]
  );
  const whoLabel = who === "bride" ? "신부" : "신랑";

  return (
    <section className="border-y border-hair py-5 space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">기본 후보</div>
          <h2 className="font-serif text-[18px] text-ink break-keep">반지 기준 잡기</h2>
        </div>
        <button onClick={onClose} className="text-[12px] text-soft underline underline-offset-4 hover:text-ink">
          닫기
        </button>
      </div>

      <p className="text-[15px] text-soft leading-relaxed break-keep">
        조건 몇 개만 골라 먼저 비교할 후보를 잡습니다. 가격은 상담 전 감을 잡는 기준이라,
        마음에 드는 후보는 {whoLabel}의 좋아요로 표시하고 매장 상담 전에 다시 확인하세요.
      </p>

      <StarterOption label="예산">
        <Segment active={budget === "under100"} onClick={() => setBudget("under100")}>100만 이하</Segment>
        <Segment active={budget === "100to200"} onClick={() => setBudget("100to200")}>100~200</Segment>
        <Segment active={budget === "200to300"} onClick={() => setBudget("200to300")}>200~300</Segment>
        <Segment active={budget === "over300"} onClick={() => setBudget("over300")}>300 이상</Segment>
      </StarterOption>

      <StarterOption label="소재">
        {["전체", "플래티넘", "화이트골드", "로즈골드", "옐로우골드"].map((m) => (
          <Segment key={m} active={material === m} onClick={() => setMaterial(m)}>{m}</Segment>
        ))}
      </StarterOption>

      <StarterOption label="디자인">
        <Segment active={diamond === "all"} onClick={() => setDiamond("all")}>상관없음</Segment>
        <Segment active={diamond === "simple"} onClick={() => setDiamond("simple")}>심플</Segment>
        <Segment active={diamond === "diamond"} onClick={() => setDiamond("diamond")}>다이아</Segment>
      </StarterOption>

      <div className="border-y border-hair divide-y divide-hair">
        {picks.map(({ ring, reason }, idx) => (
          <div key={ring.id} className="py-3 flex items-start gap-3">
            <span className="font-serif text-soft text-base tabular-nums w-5 flex-shrink-0">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-[15px] text-ink truncate">
                {ring.brand}<span className="text-soft"> · </span>{ring.model}
              </div>
              <div className="text-[11px] text-soft mt-1">
                {[ring.material, ring.hasDiamond ? "다이아" : "심플", ring.priceKRW ? `${Math.round(ring.priceKRW / 10000)}만원대` : undefined].filter(Boolean).join(" · ")}
              </div>
              <p className="text-[11px] text-soft leading-relaxed mt-1 break-keep">{reason}</p>
            </div>
          </div>
        ))}
        {picks.length === 0 && (
          <p className="py-4 text-[15px] text-soft leading-relaxed break-keep">
            조건에 맞는 후보가 없습니다. 예산이나 소재 조건을 조금 넓혀보세요.
          </p>
        )}
      </div>

      <button
        onClick={() => onApply(picks.map(({ ring }) => ring))}
        disabled={picks.length === 0}
        className="btn-primary w-full py-3 text-[13px] disabled:opacity-40"
      >
        후보 {picks.length}개 표시하기 →
      </button>
    </section>
  );
}

function StarterOption({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-3">{label}</div>
      <div className="flex flex-wrap gap-x-5 gap-y-3">{children}</div>
    </div>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`tracking-wide ${active ? "seg-active" : "seg"}`}>
      {children}
    </button>
  );
}

function pickStarterRings({
  budget,
  material,
  diamond,
}: {
  budget: RingBudgetBand;
  material: string;
  diamond: RingDiamondPref;
}): StarterRingPick[] {
  const scored = RING_CATALOG.map((ring) => {
    let score = 0;
    if (ring.priceKRW && isRingBudgetMatch(ring.priceKRW, budget)) score += 5;
    if (material === "전체" || ring.material === material) score += 3;
    if (diamond === "all") score += 1;
    else if (diamond === "diamond" && ring.hasDiamond) score += 2;
    else if (diamond === "simple" && !ring.hasDiamond) score += 2;
    if ((ring.source ?? "").includes("백화점") || (ring.source ?? "").includes("종로")) score += budget === "under100" ? 2 : 0;
    return { ring, score };
  });

  const byScore = (a: { ring: Ring; score: number }, b: { ring: Ring; score: number }) =>
    b.score - a.score || (a.ring.priceKRW ?? Number.MAX_SAFE_INTEGER) - (b.ring.priceKRW ?? Number.MAX_SAFE_INTEGER);

  const selected: { ring: Ring; score: number }[] = [];
  const add = (items: { ring: Ring; score: number }[]) => {
    for (const item of items.sort(byScore)) {
      if (selected.length >= 5) break;
      if (!selected.some(({ ring }) => ring.id === item.ring.id)) selected.push(item);
    }
  };

  add(scored.filter(({ ring, score }) =>
    score >= 6 && (!ring.priceKRW || isRingBudgetWithinLooseRange(ring.priceKRW, budget))
  ));

  if (selected.length < 5) {
    add(scored.filter(({ ring }) =>
      !ring.priceKRW || isRingBudgetWithinLooseRange(ring.priceKRW, budget)
    ));
  }

  if (selected.length < 3) {
    add(scored);
  }

  return selected.slice(0, 5).map(({ ring }) => ({
    ring,
    reason: ringStarterReason(ring, budget, material, diamond),
  }));
}

function ringStarterReason(ring: Ring, budget: RingBudgetBand, material: string, diamond: RingDiamondPref): string {
  const parts: string[] = [];
  if (ring.priceKRW && isRingBudgetMatch(ring.priceKRW, budget)) {
    parts.push("예산대에 맞는 후보");
  } else if (ring.priceKRW && isRingBudgetWithinLooseRange(ring.priceKRW, budget)) {
    parts.push("예산 근처에서 비교할 후보");
  } else {
    parts.push("취향 기준을 넓혀볼 후보");
  }
  if (material !== "전체" && ring.material === material) parts.push(`${material} 소재`);
  else if (ring.material) parts.push(ring.material);
  if (diamond === "diamond" && ring.hasDiamond) parts.push("다이아 디자인");
  if (diamond === "simple" && !ring.hasDiamond) parts.push("심플 디자인");
  return parts.slice(0, 3).join(" · ");
}

function isRingBudgetMatch(price: number, band: RingBudgetBand): boolean {
  if (band === "under100") return price <= 1_000_000;
  if (band === "100to200") return price > 1_000_000 && price <= 2_000_000;
  if (band === "200to300") return price > 2_000_000 && price <= 3_000_000;
  return price > 3_000_000;
}

function isRingBudgetWithinLooseRange(price: number, band: RingBudgetBand): boolean {
  if (band === "under100") return price <= 1_300_000;
  if (band === "100to200") return price >= 800_000 && price <= 2_300_000;
  if (band === "200to300") return price >= 1_700_000 && price <= 3_300_000;
  return price >= 2_600_000;
}

function AddRingModal({ open, onClose, update }: { open: boolean; onClose: () => void; update: (patch: any) => void; }) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [material, setMaterial] = useState("");
  const [priceKRW, setPriceKRW] = useState("");
  const [imageUrl, setImageUrl] = useState("");

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
          imageUrl: imageUrl.trim() || undefined,
          lastVerified: priceKRW ? todayISO() : undefined,
        },
        ...prev.rings,
      ],
    }));
    setBrand(""); setModel(""); setMaterial(""); setPriceKRW(""); setImageUrl("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="반지 직접 추가">
      <div className="space-y-3">
        <p className="text-[12px] text-soft leading-relaxed break-keep">
          매장 명함이나 화면 캡처에서 보이는 만큼만 옮겨 적으면 돼요. 나머지는 나중에 채워도 됩니다.
        </p>
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
        <div>
          <label className="label">이미지 링크 <span className="text-mute normal-case tracking-normal">· 선택</span></label>
          <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="매장·브랜드 사이트의 사진 주소" />
        </div>
        <button onClick={submit} className="btn-primary w-full">추가하기</button>
      </div>
    </Modal>
  );
}
