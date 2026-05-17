import { useState, useMemo } from "react";
import type { WeddingData, WeddingVenue, VenueHallType } from "../lib/schema";
import {
  VENUE_CATALOG,
  HALL_TYPE_LABEL,
  FOOD_TYPE_LABEL,
  VENUE_GUIDES,
  VENUE_PRICE_NOTE,
} from "../data/venueCatalog";
import VendorActions from "../components/VendorActions";
import Modal from "../components/Modal";

type Props = { data: WeddingData; update: (patch: any) => void };
type Tab = "mine" | "catalog";

const STATUS_OPTIONS: WeddingVenue["status"][] = ["관심", "투어", "계약"];

const REGION_GROUPS: { key: string; label: string; match: (r?: string) => boolean }[] = [
  { key: "all",    label: "전체",        match: () => true },
  { key: "gangnam",label: "강남·청담",   match: (r) => !!r && (r.includes("강남") || r.includes("청담") || r.includes("신사") || r.includes("삼성동") || r.includes("논현")) },
  { key: "central",label: "광화문·중구", match: (r) => !!r && (r.includes("광화문") || r.includes("중구") || r.includes("정동") || r.includes("소공") || r.includes("장충") || r.includes("동대문")) },
  { key: "han",    label: "한남·여의도", match: (r) => !!r && (r.includes("한남") || r.includes("여의도") || r.includes("용산")) },
  { key: "etc",    label: "그 외 서울",  match: (r) => !!r && (r.includes("공덕") || r.includes("성북") || r.includes("잠원") || r.includes("양재") || r.includes("광장동") || r.includes("강북") || r.includes("마포")) },
  { key: "gyeonggi", label: "경기·일산", match: (r) => !!r && (r.includes("일산") || r.includes("경기") || r.includes("분당") || r.includes("판교") || r.includes("인천")) },
];

export default function Venues({ data, update }: Props) {
  const [tab, setTab] = useState<Tab>("mine");
  const [region, setRegion] = useState<string>("all");
  const [hallFilter, setHallFilter] = useState<VenueHallType | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showGuide, setShowGuide] = useState<VenueHallType | null>(null);

  const myVenues = data.venues ?? [];
  const haveStatusCount: Record<NonNullable<WeddingVenue["status"]>, number> = useMemo(() => {
    const r = { 관심: 0, 투어: 0, 계약: 0 };
    for (const v of myVenues) if (v.status) r[v.status]++;
    return r;
  }, [myVenues]);

  const filteredCatalog = useMemo(() => {
    const rm = REGION_GROUPS.find((g) => g.key === region)?.match ?? (() => true);
    return VENUE_CATALOG
      .filter((v) => rm(v.region))
      .filter((v) => hallFilter === "all" || v.hallType === hallFilter);
  }, [region, hallFilter]);

  const addFromCatalog = (cat: WeddingVenue) => {
    if (myVenues.some((v) => v.name === cat.name)) return;
    update((prev: WeddingData) => ({
      ...prev,
      venues: [...(prev.venues ?? []), { ...cat, id: `v-${Date.now()}`, status: "관심" }],
    }));
  };

  const updateVenue = (id: string, patch: Partial<WeddingVenue>) => {
    update((prev: WeddingData) => ({
      ...prev,
      venues: (prev.venues ?? []).map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  };

  const removeVenue = (id: string) => {
    update((prev: WeddingData) => ({
      ...prev,
      venues: (prev.venues ?? []).filter((v) => v.id !== id),
    }));
  };

  const applyToInvitation = (v: WeddingVenue) => {
    if (!confirm(`'${v.name}' 을 청첩장의 예식장으로 설정할까요?\n\n주소·지역 정보도 함께 채워집니다.`)) return;
    update((prev: WeddingData) => ({
      ...prev,
      invitation: {
        ...prev.invitation,
        venue: v.name,
        venueAddress: prev.invitation.venueAddress || v.region,
      },
    }));
    alert("✓ 청첩장에 적용됐어요.");
  };

  const addCustom = (v: Omit<WeddingVenue, "id">) => {
    update((prev: WeddingData) => ({
      ...prev,
      venues: [...(prev.venues ?? []), { ...v, id: `v-${Date.now()}` }],
    }));
    setShowAdd(false);
  };

  return (
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-2">Venues</div>
        <h1 className="font-serif text-[2rem] leading-none">예식장</h1>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-6 border-b border-hair pb-3">
        <button
          onClick={() => setTab("mine")}
          className={`text-[12px] tracking-wide pb-1 transition ${tab === "mine" ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
        >
          내 후보 · <span className="tabular-nums">{myVenues.length}</span>
        </button>
        <button
          onClick={() => setTab("catalog")}
          className={`text-[12px] tracking-wide pb-1 transition ${tab === "catalog" ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
        >
          카탈로그 · <span className="tabular-nums">{VENUE_CATALOG.length}</span>
        </button>
      </div>

      {tab === "mine" && (
        <>
          {/* 진척도 */}
          <div className="flex items-baseline gap-6 text-[12px] border-b border-hair pb-3">
            <span className="eyebrow">진척도</span>
            <span><span className="tabular-nums text-ink">{haveStatusCount["관심"]}</span> <span className="text-soft">관심</span></span>
            <span><span className="tabular-nums text-ink">{haveStatusCount["투어"]}</span> <span className="text-soft">투어</span></span>
            <span className="ml-auto"><span className="tabular-nums text-gold">{haveStatusCount["계약"]}</span> <span className="text-soft">계약</span></span>
          </div>

          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow-gold">내 후보</h2>
            <button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
              + 직접 추가
            </button>
          </div>

          {myVenues.length === 0 ? (
            <div className="py-10 text-center text-soft text-[13px] border-y border-hair">
              아직 담아둔 식장이 없어요.<br />
              <button onClick={() => setTab("catalog")} className="mt-3 text-ink underline underline-offset-4 hover:text-gold text-[12px]">
                카탈로그에서 골라 담기 →
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-hair border-y border-hair">
              {myVenues.map((v) => (
                <MyVenueRow
                  key={v.id}
                  v={v}
                  onUpdate={(patch) => updateVenue(v.id, patch)}
                  onRemove={() => removeVenue(v.id)}
                  onApply={() => applyToInvitation(v)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "catalog" && (
        <>
          {/* 안내 */}
          <p className="text-[12px] text-soft leading-relaxed border-b border-hair pb-4">
            {VENUE_PRICE_NOTE}
          </p>

          {/* 홀 형식 필터 */}
          <div className="flex gap-5 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
            <button
              onClick={() => setHallFilter("all")}
              className={`text-[12px] tracking-wide whitespace-nowrap pb-1 transition ${hallFilter === "all" ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
            >
              전체
            </button>
            {(Object.keys(HALL_TYPE_LABEL) as VenueHallType[]).map((t) => (
              <button
                key={t}
                onClick={() => setHallFilter(t)}
                className={`text-[12px] tracking-wide whitespace-nowrap pb-1 transition ${hallFilter === t ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
              >
                {HALL_TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          {/* 지역 필터 */}
          <div className="flex gap-5 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
            {REGION_GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setRegion(g.key)}
                className={`text-[11.5px] tracking-wide whitespace-nowrap pb-1 transition ${region === g.key ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* 가이드 토글 */}
          {hallFilter !== "all" && (
            <button
              onClick={() => setShowGuide(hallFilter)}
              className="text-[12px] underline underline-offset-4 text-ink hover:text-gold"
            >
              {HALL_TYPE_LABEL[hallFilter]} 가이드 보기 →
            </button>
          )}

          {/* 결과 */}
          {filteredCatalog.length === 0 ? (
            <p className="text-center text-[12.5px] text-soft py-8">
              조건에 맞는 식장이 없어요.
            </p>
          ) : (
            <ul className="divide-y divide-hair border-y border-hair">
              {filteredCatalog.map((v) => {
                const added = myVenues.some((m) => m.name === v.name);
                return <CatalogRow key={v.id} v={v} added={added} onAdd={() => addFromCatalog(v)} />;
              })}
            </ul>
          )}

          <p className="text-[10.5px] text-soft text-center leading-relaxed pt-2">
            가격 범위는 공개 정보 추정치 — 시즌·요일·메뉴별 변동 큼. 최종 결정 전 직접 문의 필수.<br />
            표시 삭제·정정 요청은{" "}
            <a href="mailto:yclee913@gmail.com" rel="noopener noreferrer" className="underline underline-offset-2 text-ink">yclee913@gmail.com</a>
            {" "}으로.
          </p>
        </>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="예식장 직접 추가">
        <CustomAdd onAdd={addCustom} />
      </Modal>

      <Modal open={!!showGuide} onClose={() => setShowGuide(null)} title={showGuide ? `${HALL_TYPE_LABEL[showGuide]} 가이드` : ""}>
        {showGuide && (() => {
          const g = VENUE_GUIDES.find((x) => x.type === showGuide);
          if (!g) return null;
          return (
            <div className="space-y-5 text-[13px]">
              <div>
                <div className="eyebrow-gold mb-2">장점</div>
                <ul className="space-y-1.5 text-ink/90">
                  {g.pros.map((p, i) => <li key={i}>· {p}</li>)}
                </ul>
              </div>
              <div>
                <div className="eyebrow mb-2">아쉬운 점</div>
                <ul className="space-y-1.5 text-soft">
                  {g.cons.map((c, i) => <li key={i}>· {c}</li>)}
                </ul>
              </div>
              <div className="pl-4 border-l-2 border-gold/50 text-[12.5px] text-soft leading-relaxed">
                {g.tip}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function CatalogRow({ v, added, onAdd }: { v: WeddingVenue; added: boolean; onAdd: () => void }) {
  return (
    <li className={`py-4 ${added ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[15px] text-ink">{v.name}</div>
          <div className="eyebrow mt-1 space-x-2">
            {v.region && <span>{v.region}</span>}
            {v.hallType && <span>· {HALL_TYPE_LABEL[v.hallType]}</span>}
            {v.foodType && <span>· {FOOD_TYPE_LABEL[v.foodType]}</span>}
          </div>
          <div className="text-[11.5px] text-soft mt-1.5 tabular-nums">
            {(v.capacityMin || v.capacityMax) && (
              <>하객 {v.capacityMin ?? "?"}~{v.capacityMax ?? "?"}명 </>
            )}
            {(v.mealPriceMin || v.mealPriceMax) && (
              <span>· 식대 {fmtMan(v.mealPriceMin)}~{fmtMan(v.mealPriceMax)}만원</span>
            )}
          </div>
          {v.notes && (
            <div className="text-[11.5px] text-soft mt-1 italic leading-relaxed">{v.notes}</div>
          )}
        </div>
        <button
          onClick={onAdd}
          disabled={added}
          className={`text-[11.5px] tracking-wide whitespace-nowrap flex-shrink-0 underline underline-offset-4 ${added ? "text-soft" : "text-gold hover:text-ink"}`}
        >
          {added ? "✓ 담음" : "+ 담기"}
        </button>
      </div>
      <div className="mt-2">
        <VendorActions name={v.name} region={v.region} />
      </div>
    </li>
  );
}

function MyVenueRow({
  v, onUpdate, onRemove, onApply,
}: {
  v: WeddingVenue;
  onUpdate: (patch: Partial<WeddingVenue>) => void;
  onRemove: () => void;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-5">
      <div className="flex items-baseline justify-between gap-3">
        <button onClick={() => setOpen((o) => !o)} className="flex-1 min-w-0 text-left">
          <div className="font-serif text-[15px] text-ink">{v.name}</div>
          <div className="eyebrow mt-1 space-x-2">
            {v.region && <span>{v.region}</span>}
            {v.hallType && <span>· {HALL_TYPE_LABEL[v.hallType]}</span>}
            {v.status && <span className="text-gold">· {v.status}</span>}
          </div>
        </button>
        <button onClick={onRemove} className="text-soft hover:text-ink text-sm flex-shrink-0">×</button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-hair space-y-4">
          <div className="flex items-baseline gap-5">
            <span className="eyebrow">상태</span>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onUpdate({ status: s })}
                className={`text-[12px] tracking-wide pb-1 transition ${v.status === s ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div>
            <label className="label">답사 일자</label>
            <input
              type="date"
              className="input text-[13px]"
              value={v.visitedAt ?? ""}
              onChange={(e) => onUpdate({ visitedAt: e.target.value || undefined })}
            />
          </div>

          <div>
            <label className="label">메모 (식대 견적·실장 이름·인상)</label>
            <textarea
              className="input-boxed text-[12.5px] min-h-[60px]"
              value={v.notes ?? ""}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="예: 토요일 12시 13만원, 보증 250명, 평일 12만원 가능"
            />
          </div>

          <VendorActions name={v.name} region={v.region} officialUrl={v.link} />

          <div className="pt-2 flex items-center gap-6 border-t border-hair">
            <button onClick={onApply} className="text-[12px] underline underline-offset-4 text-gold hover:text-ink">
              청첩장에 적용 →
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function CustomAdd({ onAdd }: { onAdd: (v: Omit<WeddingVenue, "id">) => void }) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [hallType, setHallType] = useState<WeddingVenue["hallType"]>(undefined);
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div className="space-y-4">
      <input className="input text-[13px]" placeholder="식장 이름" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input text-[13px]" placeholder="지역 (예: 청담)" value={region} onChange={(e) => setRegion(e.target.value)} />
      <div>
        <label className="label">홀 형식</label>
        <div className="flex flex-wrap gap-5">
          <button
            onClick={() => setHallType(undefined)}
            className={`text-[12px] tracking-wide pb-1 ${!hallType ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
          >
            미정
          </button>
          {(Object.keys(HALL_TYPE_LABEL) as Array<keyof typeof HALL_TYPE_LABEL>).map((t) => (
            <button
              key={t}
              onClick={() => setHallType(t)}
              className={`text-[12px] tracking-wide pb-1 ${hallType === t ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"}`}
            >
              {HALL_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <input className="input text-[13px]" placeholder="홈페이지·예약 링크 (선택)" value={link} onChange={(e) => setLink(e.target.value)} />
      <textarea className="input-boxed text-[13px] min-h-[60px]" placeholder="메모" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button
        className="btn-primary w-full py-3 text-[12.5px]"
        onClick={() => {
          if (!name.trim()) return;
          onAdd({
            name: name.trim(),
            region: region.trim() || undefined,
            hallType,
            link: link.trim() || undefined,
            notes: notes.trim() || undefined,
            status: "관심",
          });
          setName(""); setRegion(""); setLink(""); setNotes("");
        }}
      >
        추가 →
      </button>
    </div>
  );
}

function fmtMan(n?: number): string {
  if (!n) return "?";
  return Math.round(n / 10000).toString();
}
