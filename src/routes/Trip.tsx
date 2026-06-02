import { useState } from "react";
import type { WeddingData, HoneymoonRegion, Flight, Hotel } from "../lib/schema";
import { HONEYMOON_CATALOG, type HoneymoonPick } from "../data/honeymoonCatalog";
import { OTA_LIST } from "../data/hotelOtaTemplate";
import {
  flightSearchLinks,
  hotelSearchLinks,
  honeymoonSearchLinks,
} from "../lib/searchLinks";
import SearchLinks from "../components/SearchLinks";
import FreshnessBadge from "../components/FreshnessBadge";
import Modal from "../components/Modal";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import {
  flightSearchPrompt,
  hotelPriceCheckPrompt,
  type BridgePrompt,
} from "../lib/chatbotBridge";
import { todayISO } from "../lib/freshness";

type Props = { data: WeddingData; update: (patch: any) => void };
type Tab = "destinations" | "flights" | "stays";

export default function Trip({ data, update }: Props) {
  const [tab, setTab] = useState<Tab>("destinations");

  return (
    <div className="page pt-8 pb-10 space-y-6">
      <div>
        <div className="eyebrow-gold mb-2">Honeymoon</div>
        <h1 className="font-serif text-[2rem] leading-none">신혼여행</h1>
      </div>

      <div className="flex items-center gap-6 border-b border-hair pb-3">
        <TabBtn active={tab === "destinations"} onClick={() => setTab("destinations")}>여행지</TabBtn>
        <TabBtn active={tab === "flights"} onClick={() => setTab("flights")}>항공</TabBtn>
        <TabBtn active={tab === "stays"} onClick={() => setTab("stays")}>숙소</TabBtn>
      </div>

      {tab === "destinations" && <Destinations data={data} update={update} />}
      {tab === "flights" && <Flights data={data} update={update} />}
      {tab === "stays" && <Stays data={data} update={update} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] tracking-wide transition pb-1 ${
        active ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ──────────── 여행지 탭 ──────────── */

function Destinations({ data, update }: Props) {
  const [showCatalog, setShowCatalog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const regions = data.honeymoon.regions;

  const addFromCatalog = (pick: HoneymoonPick) => {
    if (regions.some((r) => r.name === pick.region)) return;
    const nextId = `region-${Date.now()}-${pick.id}`;
    update((prev: WeddingData) => ({
      ...prev,
      honeymoon: {
        ...prev.honeymoon,
        regions: [
          ...prev.honeymoon.regions,
          {
            id: nextId,
            name: pick.region,
            notes: `${pick.vibe}\n\n[추천 시기] ${pick.bestSeason}\n[비행] ${pick.flightHours}\n[예산] ${pick.budgetKRWPerPerson}\n\n${pick.tip}`,
          },
        ],
      },
    }));
    setExpandedId(nextId);
  };

  const removeRegion = (id: string) => {
    update((prev: WeddingData) => ({
      ...prev,
      honeymoon: { ...prev.honeymoon, regions: prev.honeymoon.regions.filter((r) => r.id !== id) },
    }));
  };

  const updateRegion = (id: string, patch: Partial<HoneymoonRegion>) => {
    update((prev: WeddingData) => ({
      ...prev,
      honeymoon: {
        ...prev.honeymoon,
        regions: prev.honeymoon.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
    }));
  };

  return (
    <div className="space-y-10">
      {/* 내 후보 */}
      {regions.length > 0 && (
        <section>
          <h2 className="eyebrow-gold mb-4">내 후보 · <span className="tabular-nums">{regions.length}</span></h2>
          <div className="divide-y divide-hair border-y border-hair">
            {regions.map((r) => (
              <RegionCard
                key={r.id}
                region={r}
                open={expandedId === r.id}
                onToggle={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                onRemove={() => removeRegion(r.id)}
                onUpdate={(patch) => updateRegion(r.id, patch)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 추천 카탈로그 */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="eyebrow-gold">인기 신혼여행지</h2>
          <span className="eyebrow tabular-nums">{HONEYMOON_CATALOG.length}곳</span>
        </div>
        <p className="text-[12.5px] text-soft mb-5 leading-relaxed">
          가장 많이 가는 곳들을 미리 정리해뒀어요. 마음에 드는 곳을 후보로 담아두면 비교가 쉬워요.
        </p>
        <div className="divide-y divide-hair border-y border-hair">
          {HONEYMOON_CATALOG.map((p) => {
            const added = regions.some((r) => r.name === p.region);
            return (
              <button
                key={p.id}
                onClick={() => addFromCatalog(p)}
                className="w-full text-left py-4 active:opacity-60 transition disabled:opacity-50"
                disabled={added}
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-base flex-shrink-0">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-[15px] text-ink">{p.region}</div>
                    <div className="text-[12px] text-soft mt-0.5 leading-relaxed">{p.vibe}</div>
                    <div className="eyebrow mt-2 space-x-3">
                      <span>{p.bestSeason}</span>
                      <span>{p.flightHours}</span>
                      <span>{p.budgetKRWPerPerson}</span>
                    </div>
                  </div>
                  <span className="text-[11px] tracking-wide text-gold flex-shrink-0 whitespace-nowrap">
                    {added ? "✓ 담음" : "+ 후보로"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={() => setShowCatalog(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold mt-5">
          여행지 상세 안내 (시기 · 하이라이트 · 팁) →
        </button>
      </section>

      <Modal open={showCatalog} onClose={() => setShowCatalog(false)} title="신혼여행지 상세 안내">
        <div className="space-y-4">
          {HONEYMOON_CATALOG.map((p) => (
            <div key={p.id} className="border-b border-line pb-3 last:border-b-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{p.emoji}</span>
                <span className="font-medium">{p.region}</span>
                <span className="ml-auto text-xs">{"💰".repeat(p.budgetLevel)}</span>
              </div>
              <p className="text-sm text-soft mb-2">{p.vibe}</p>
              <div className="text-xs text-soft space-y-1 mb-2">
                <div>📅 {p.bestSeason}{p.avoidSeason && ` · 피할 시기: ${p.avoidSeason}`}</div>
                <div>✈️ {p.flightHours} · 💵 {p.budgetKRWPerPerson}</div>
              </div>
              <div className="text-xs">
                <div className="text-soft mb-1">하이라이트</div>
                <ul className="space-y-0.5">
                  {p.highlights.map((h, i) => (
                    <li key={i}>· {h}</li>
                  ))}
                </ul>
              </div>
              <div className="text-[11.5px] mt-3 pl-3 border-l-2 border-gold/50 text-soft leading-relaxed">{p.tip}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function RegionCard({
  region,
  open,
  onToggle,
  onRemove,
  onUpdate,
}: {
  region: HoneymoonRegion;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<HoneymoonRegion>) => void;
}) {
  const cleanName = region.name.replace(/\s*\(.+\)/, "");
  return (
    <div className="py-4">
      <div className="flex items-center gap-3">
        <button onClick={onToggle} className="flex-1 min-w-0 text-left py-1">
          <div className="flex items-center gap-2">
            <div className="font-serif text-[17px] text-ink truncate">{region.name}</div>
            <span className="text-[11px] text-soft">{open ? "접기" : "펼치기"}</span>
          </div>
          <div className="eyebrow mt-1">
            {region.durationDays ? `${region.durationDays}일` : "기간 미정"}
            <span className="mx-2">·</span>
            {region.budgetKRW ? `${Math.round(region.budgetKRW / 10000).toLocaleString()}만원` : "예산 미정"}
          </div>
        </button>
        <button
          onClick={onRemove}
          aria-label={`${region.name} 삭제`}
          className="w-10 h-10 border border-hair text-lg leading-none text-soft hover:text-ink hover:border-ink flex items-center justify-center flex-shrink-0"
        >
          ×
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-hair space-y-4">
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <label className="label">기간 · 비교용</label>
              <input
                className="input text-[13px]"
                type="number"
                placeholder="예: 7"
                value={region.durationDays ?? ""}
                onChange={(e) => onUpdate({ durationDays: Number(e.target.value) || undefined })}
              />
            </div>
            <div>
              <label className="label">총예산 · 비교용</label>
              <input
                className="input text-[13px]"
                type="number"
                placeholder="예: 8000000"
                value={region.budgetKRW ?? ""}
                onChange={(e) => onUpdate({ budgetKRW: Number(e.target.value) || undefined })}
              />
            </div>
          </div>

          <p className="text-[11.5px] text-soft leading-relaxed">
            기간·예산은 후보 비교용입니다. 마이리얼트립·클룩·구글 같은 외부 사이트 검색에는 자동 필터로 반영되지 않습니다.
          </p>

          <textarea
            className="input-boxed text-[13px] min-h-[92px]"
            placeholder="일정 메모, 후보 숙소, 항공권 조건, 꼭 하고 싶은 액티비티"
            value={region.notes ?? ""}
            onChange={(e) => onUpdate({ notes: e.target.value })}
          />

          <SearchLinks
            label="외부 사이트에서 다시 확인"
            links={honeymoonSearchLinks(cleanName)}
          />
        </div>
      )}
    </div>
  );
}

/* ──────────── 항공 탭 ──────────── */

function Flights({ data, update }: Props) {
  const [search, setSearch] = useState({ from: "ICN", to: "", date: "", adults: 2 });
  const [bridge, setBridge] = useState<BridgePrompt | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const onAISearch = () => {
    if (!search.date || !search.to) return;
    setBridge(flightSearchPrompt(search.from, search.to, search.date));
  };

  const applyResults = (parsed: any) => {
    const options = parsed?.options;
    if (!Array.isArray(options)) return;
    // 항공사명이 없는 옵션은 건너뛴다 — 복붙 응답이 불완전하면 'undefined' 빈 카드가 생기므로.
    const newFlights = options
      .filter((o: any) => o && typeof o.airline === "string" && o.airline.trim())
      .map((o: any, i: number): Flight => ({
        id: `flight-${Date.now()}-${i}`,
        airline: o.airline.trim(),
        flightNumber: o.flightNumber,
        from: search.from,
        to: search.to,
        departAt: o.departAt,
        arriveAt: o.arriveAt,
        priceKRW: typeof o.priceKRW === "number" ? o.priceKRW : undefined,
        // AI 추정값 — 실시간 검증이 아니므로 '오늘 확인됨' 신선도를 붙이지 않는다(정직성).
      }));
    if (newFlights.length === 0) return;
    update((prev: WeddingData) => ({ ...prev, flights: [...prev.flights, ...newFlights] }));
    setBridge(null);
  };

  const remove = (id: string) =>
    update((prev: WeddingData) => ({ ...prev, flights: prev.flights.filter((f) => f.id !== id) }));

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="eyebrow-gold">항공편 검색</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <label className="label">출발</label>
            <input className="input" placeholder="ICN" value={search.from} onChange={(e) => setSearch((s) => ({ ...s, from: e.target.value }))} />
          </div>
          <div>
            <label className="label">도착</label>
            <input className="input" placeholder="DPS (발리)" value={search.to} onChange={(e) => setSearch((s) => ({ ...s, to: e.target.value }))} />
          </div>
          <div>
            <label className="label">출발 날짜</label>
            <input type="date" className="input" value={search.date} onChange={(e) => setSearch((s) => ({ ...s, date: e.target.value }))} />
          </div>
          <div>
            <label className="label">인원</label>
            <input type="number" min={1} className="input" value={search.adults} onChange={(e) => setSearch((s) => ({ ...s, adults: Math.max(1, Number(e.target.value) || 1) }))} />
          </div>
        </div>
        <SearchLinks
          label="검색 사이트에서 바로 보기"
          links={flightSearchLinks(search.from, search.to, search.date, search.adults)}
        />
        <button onClick={onAISearch} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold disabled:opacity-40" disabled={!search.date || !search.to}>
          AI에게 추천 받아 목록에 담기 →
        </button>
      </section>

      {data.flights.length === 0 ? (
        <p className="text-center text-[12.5px] text-soft py-4">아직 담아둔 항공편이 없어요.</p>
      ) : (
        <section>
          <h2 className="eyebrow-gold mb-4">담아둔 옵션 · <span className="tabular-nums">{data.flights.length}</span></h2>
          <div className="divide-y divide-hair border-y border-hair">
            {data.flights.map((f) => (
              <div key={f.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-[15px] text-ink">{f.airline} <span className="text-soft">{f.flightNumber}</span></div>
                    <div className="eyebrow mt-1">{f.from} → {f.to}</div>
                    {f.departAt && <div className="text-[11px] text-soft mt-1 tabular-nums">{f.departAt} {f.arriveAt && `→ ${f.arriveAt}`}</div>}
                  </div>
                  <button onClick={() => remove(f.id)} className="text-soft hover:text-ink text-sm">×</button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-serif text-lg text-ink tabular-nums">{f.priceKRW ? `${f.priceKRW.toLocaleString()}원` : <span className="text-soft text-sm">가격 미정</span>}</span>
                  <FreshnessBadge lastVerified={f.lastVerified} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold w-full text-left">
        + 직접 추가
      </button>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="항공편 직접 추가">
        <FlightAddForm
          onAdd={(f) => {
            update((prev: WeddingData) => ({ ...prev, flights: [...prev.flights, f] }));
            setShowAdd(false);
          }}
        />
      </Modal>

      <ChatbotBridgeModal
        open={!!bridge}
        onClose={() => setBridge(null)}
        prompt={bridge}
        onApply={applyResults}
      />
    </div>
  );
}

function FlightAddForm({ onAdd }: { onAdd: (f: Flight) => void }) {
  const [form, setForm] = useState({ airline: "", flightNumber: "", from: "", to: "", departAt: "", priceKRW: "" });
  return (
    <div className="space-y-3">
      <input className="input text-sm" placeholder="항공사" value={form.airline} onChange={(e) => setForm({ ...form, airline: e.target.value })} />
      <input className="input text-sm" placeholder="편명" value={form.flightNumber} onChange={(e) => setForm({ ...form, flightNumber: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <input className="input text-sm" placeholder="출발 (ICN)" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
        <input className="input text-sm" placeholder="도착 (DPS)" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
      </div>
      <input className="input text-sm" type="date" aria-label="출발 날짜" value={form.departAt} onChange={(e) => setForm({ ...form, departAt: e.target.value })} />
      <input className="input text-sm" type="number" placeholder="가격 (원)" value={form.priceKRW} onChange={(e) => setForm({ ...form, priceKRW: e.target.value })} />
      <button
        className="btn-primary w-full"
        onClick={() => {
          if (!form.airline.trim()) return;
          onAdd({
            id: `flight-${Date.now()}`,
            ...form,
            priceKRW: form.priceKRW ? Number(form.priceKRW) : undefined,
            lastVerified: todayISO(),
          });
        }}
      >
        추가
      </button>
    </div>
  );
}

/* ──────────── 숙소 탭 ──────────── */

function Stays({ data, update }: Props) {
  const [search, setSearch] = useState({ dest: "", checkIn: "", checkOut: "", adults: 2 });
  const [bridge, setBridge] = useState<{ prompt: BridgePrompt; hotelId: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);

  const remove = (id: string) =>
    update((prev: WeddingData) => ({ ...prev, hotels: prev.hotels.filter((h) => h.id !== id) }));

  const openPriceBridge = (hotel: Hotel) => {
    setBridge({ prompt: hotelPriceCheckPrompt(hotel.name), hotelId: hotel.id });
  };

  const applyBridge = (parsed: any) => {
    if (!bridge) return;
    const results = parsed?.results;
    if (!Array.isArray(results)) return;
    update((prev: WeddingData) => ({
      ...prev,
      hotels: prev.hotels.map((h) => {
        if (h.id !== bridge.hotelId) return h;
        const existing = h.otaPrices ?? [];
        const merged = [...existing];
        for (const r of results) {
          if (!r.ota || typeof r.pricePerNight !== "number") continue;
          const idx = merged.findIndex((m) => m.ota === r.ota);
          const entry = { ota: r.ota, price: r.pricePerNight, url: r.url };
          if (idx >= 0) merged[idx] = entry;
          else merged.push(entry);
        }
        // AI 가격 비교는 추정이라 '오늘 확인됨' 신선도를 갱신하지 않는다(정직성). 사용자가 직접 확인하면 갱신됨.
        return { ...h, otaPrices: merged };
      }),
    }));
    setBridge(null);
  };

  const updateOta = (hotelId: string, ota: string, price: number) =>
    update((prev: WeddingData) => ({
      ...prev,
      hotels: prev.hotels.map((h) => {
        if (h.id !== hotelId) return h;
        const otaPrices = h.otaPrices ?? [];
        const idx = otaPrices.findIndex((o) => o.ota === ota);
        const next = idx >= 0
          ? otaPrices.map((o, i) => (i === idx ? { ...o, price } : o))
          : [...otaPrices, { ota, price }];
        return { ...h, otaPrices: next, lastVerified: todayISO() };
      }),
    }));

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="eyebrow-gold">숙소 검색</h2>
        <input
          className="input"
          placeholder="지역·호텔명 (예: 발리 우붓, 강남)"
          value={search.dest}
          onChange={(e) => setSearch((s) => ({ ...s, dest: e.target.value }))}
        />
        <div className="grid grid-cols-3 gap-x-4 gap-y-4">
          <div>
            <label className="label">체크인</label>
            <input type="date" className="input" value={search.checkIn} onChange={(e) => setSearch((s) => ({ ...s, checkIn: e.target.value }))} />
          </div>
          <div>
            <label className="label">체크아웃</label>
            <input type="date" className="input" value={search.checkOut} onChange={(e) => setSearch((s) => ({ ...s, checkOut: e.target.value }))} />
          </div>
          <div>
            <label className="label">인원</label>
            <input type="number" min={1} className="input" value={search.adults} onChange={(e) => setSearch((s) => ({ ...s, adults: Math.max(1, Number(e.target.value) || 1) }))} />
          </div>
        </div>
        <SearchLinks
          label="입력한 조건으로 예약 사이트에서 바로 검색"
          links={hotelSearchLinks(search.dest, search.checkIn, search.checkOut, search.adults)}
        />
      </section>

      {data.hotels.length === 0 ? (
        <p className="text-center text-[12.5px] text-soft py-4">아직 담아둔 숙소가 없어요.</p>
      ) : (
        <section>
          <h2 className="eyebrow-gold mb-4">담아둔 숙소 · <span className="tabular-nums">{data.hotels.length}</span></h2>
          <div className="divide-y divide-hair border-y border-hair">
            {data.hotels.map((hotel) => (
              <div key={hotel.id} className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-[15px] text-ink">{hotel.name}</div>
                    {hotel.location && <div className="eyebrow mt-1">{hotel.location}</div>}
                  </div>
                  <button onClick={() => remove(hotel.id)} className="text-soft hover:text-ink text-sm">×</button>
                </div>
                <div className="mt-2">
                  <FreshnessBadge lastVerified={hotel.lastVerified} onClickCheck={() => openPriceBridge(hotel)} />
                </div>
                <button onClick={() => setEditing(hotel)} className="text-[11.5px] text-ink underline underline-offset-4 hover:text-gold mt-3">
                  OTA 가격 보기/편집 ({hotel.otaPrices?.length ?? 0}) →
                </button>
                {hotel.otaPrices && hotel.otaPrices.length > 0 && (
                  <div className="mt-3 space-y-1.5 text-[11.5px]">
                    {[...hotel.otaPrices]
                      .filter((o) => typeof o.price === "number")
                      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
                      .slice(0, 3)
                      .map((o, i) => (
                        <div key={i} className="flex items-baseline justify-between">
                          <span className={i === 0 ? "text-gold" : "text-soft"}>
                            <span className="font-serif text-soft tabular-nums mr-2">{String(i + 1).padStart(2, "0")}</span>
                            {o.ota}
                          </span>
                          <span className="tabular-nums">{o.price?.toLocaleString()}원/박</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold text-left w-full">
        + 직접 추가
      </button>

      <p className="text-[11.5px] text-soft text-center leading-relaxed">
        본식 전후 부부 숙소, 하객 안내용 호텔도 여기에 함께 정리하면 좋아요.
      </p>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="숙소 추가">
        <HotelAddForm
          onAdd={(h) => {
            update((prev: WeddingData) => ({ ...prev, hotels: [...prev.hotels, h] }));
            setShowAdd(false);
          }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.name ?? ""}>
        {editing && (
          <div className="space-y-3">
            <button
              onClick={() => {
                openPriceBridge(editing);
                setEditing(null);
              }}
              className="btn-primary w-full"
            >
              🤖 AI에게 가격 비교 부탁
            </button>
            <p className="text-xs text-soft">또는 직접 입력 (1박 기준)</p>
            <div className="space-y-2">
              {OTA_LIST.map((ota) => {
                const existing = editing.otaPrices?.find((o) => o.ota === ota);
                return (
                  <OtaRow
                    key={ota}
                    ota={ota}
                    initialPrice={existing?.price}
                    onSave={(p) => updateOta(editing.id, ota, p)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      <ChatbotBridgeModal
        open={!!bridge}
        onClose={() => setBridge(null)}
        prompt={bridge?.prompt ?? null}
        onApply={applyBridge}
      />
    </div>
  );
}

function HotelAddForm({ onAdd }: { onAdd: (h: Hotel) => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  return (
    <div className="space-y-3">
      <input className="input text-sm" placeholder="호텔 이름" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input text-sm" placeholder="지역" value={location} onChange={(e) => setLocation(e.target.value)} />
      <button
        className="btn-primary w-full"
        onClick={() => name.trim() && onAdd({ id: `hotel-${Date.now()}`, name: name.trim(), location: location.trim() || undefined })}
      >
        추가
      </button>
    </div>
  );
}

function OtaRow({ ota, initialPrice, onSave }: { ota: string; initialPrice?: number; onSave: (p: number) => void }) {
  const [val, setVal] = useState(initialPrice ? String(initialPrice) : "");
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-soft w-24 flex-shrink-0">{ota}</span>
      <input
        type="number"
        className="input flex-1 text-sm"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          const n = Number(val.replace(/,/g, ""));
          if (!isNaN(n) && n > 0) onSave(n);
        }}
        placeholder="가격"
      />
      <span className="text-xs text-soft">원/박</span>
    </div>
  );
}
