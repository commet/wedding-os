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
    <div className="px-5 py-6 space-y-4">
      <h1 className="font-serif text-2xl">신혼여행</h1>

      <div className="flex gap-2">
        <TabBtn active={tab === "destinations"} onClick={() => setTab("destinations")}>🗺️ 여행지</TabBtn>
        <TabBtn active={tab === "flights"} onClick={() => setTab("flights")}>✈️ 항공</TabBtn>
        <TabBtn active={tab === "stays"} onClick={() => setTab("stays")}>🏨 숙소</TabBtn>
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
      className={`flex-1 text-sm px-3 py-2 rounded-full ${
        active ? "bg-ink text-white" : "bg-white border border-line text-soft"
      }`}
    >
      {children}
    </button>
  );
}

/* ──────────── 여행지 탭 ──────────── */

function Destinations({ data, update }: Props) {
  const [showCatalog, setShowCatalog] = useState(false);
  const regions = data.honeymoon.regions;

  const addFromCatalog = (pick: HoneymoonPick) => {
    if (regions.some((r) => r.name === pick.region)) return;
    update((prev: WeddingData) => ({
      ...prev,
      honeymoon: {
        ...prev.honeymoon,
        regions: [
          ...prev.honeymoon.regions,
          {
            id: `region-${Date.now()}-${pick.id}`,
            name: pick.region,
            notes: `${pick.vibe}\n\n[추천 시기] ${pick.bestSeason}\n[비행] ${pick.flightHours}\n[예산] ${pick.budgetKRWPerPerson}\n\n${pick.tip}`,
          },
        ],
      },
    }));
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
    <div className="space-y-4">
      {/* 내 후보 */}
      {regions.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">내 후보 ({regions.length})</h2>
          <div className="space-y-3">
            {regions.map((r) => (
              <div key={r.id} className="card space-y-2">
                <div className="flex items-start justify-between">
                  <div className="font-medium">{r.name}</div>
                  <button onClick={() => removeRegion(r.id)} className="text-soft text-xs">×</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    className="input text-xs"
                    type="number"
                    placeholder="기간 (일)"
                    value={r.durationDays ?? ""}
                    onChange={(e) => updateRegion(r.id, { durationDays: Number(e.target.value) || undefined })}
                  />
                  <input
                    className="input text-xs"
                    type="number"
                    placeholder="예산 (원)"
                    value={r.budgetKRW ?? ""}
                    onChange={(e) => updateRegion(r.id, { budgetKRW: Number(e.target.value) || undefined })}
                  />
                </div>
                <textarea
                  className="input text-xs min-h-[80px]"
                  placeholder="메모 / 일정"
                  value={r.notes ?? ""}
                  onChange={(e) => updateRegion(r.id, { notes: e.target.value })}
                />
                <SearchLinks
                  label="이 여행지로 바로 검색"
                  links={honeymoonSearchLinks(r.name.replace(/\s*\(.+\)/, ""))}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 추천 카탈로그 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">✨ 인기 신혼여행지</h2>
          <span className="text-xs text-soft">{HONEYMOON_CATALOG.length}곳</span>
        </div>
        <p className="text-xs text-soft mb-3">
          가장 많이 가는 곳들을 미리 정리해뒀어요. 마음에 드는 곳을 [+ 후보로]로 담아두면 비교가 쉬워요.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {HONEYMOON_CATALOG.map((p) => {
            const added = regions.some((r) => r.name === p.region);
            return (
              <button
                key={p.id}
                onClick={() => addFromCatalog(p)}
                className="card text-left active:bg-cream transition relative"
                disabled={added}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">{p.emoji}</span>
                  <span className="font-medium text-sm">{p.region}</span>
                  <span className="ml-auto text-xs">{"💰".repeat(p.budgetLevel)}</span>
                </div>
                <p className="text-xs text-soft mb-2">{p.vibe}</p>
                <div className="text-[11px] text-soft space-y-0.5">
                  <div>📅 {p.bestSeason}</div>
                  <div>✈️ {p.flightHours}</div>
                  <div>💵 {p.budgetKRWPerPerson}</div>
                </div>
                <div className="mt-2 text-xs text-gold">
                  {added ? "✓ 후보로 담음" : "+ 후보로"}
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={() => setShowCatalog(true)} className="btn-ghost w-full text-xs mt-3">
          여행지 상세 안내 (시기·하이라이트·팁) 보기
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
              <div className="text-xs mt-2 bg-cream p-2 rounded-md">💡 {p.tip}</div>
            </div>
          ))}
        </div>
      </Modal>
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
    const newFlights = options.map((o: any, i: number): Flight => ({
      id: `flight-${Date.now()}-${i}`,
      airline: o.airline,
      flightNumber: o.flightNumber,
      from: search.from,
      to: search.to,
      departAt: o.departAt,
      arriveAt: o.arriveAt,
      priceKRW: typeof o.priceKRW === "number" ? o.priceKRW : undefined,
      lastVerified: todayISO(),
    }));
    update((prev: WeddingData) => ({ ...prev, flights: [...prev.flights, ...newFlights] }));
    setBridge(null);
  };

  const remove = (id: string) =>
    update((prev: WeddingData) => ({ ...prev, flights: prev.flights.filter((f) => f.id !== id) }));

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="text-sm font-medium">✈️ 항공편 검색</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">출발</label>
            <input className="input text-sm" placeholder="ICN" value={search.from} onChange={(e) => setSearch((s) => ({ ...s, from: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">도착</label>
            <input className="input text-sm" placeholder="DPS (발리)" value={search.to} onChange={(e) => setSearch((s) => ({ ...s, to: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">출발 날짜</label>
            <input type="date" className="input text-sm" value={search.date} onChange={(e) => setSearch((s) => ({ ...s, date: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">인원</label>
            <input type="number" min={1} className="input text-sm" value={search.adults} onChange={(e) => setSearch((s) => ({ ...s, adults: Math.max(1, Number(e.target.value) || 1) }))} />
          </div>
        </div>
        <SearchLinks
          label="🔎 검색 사이트에서 바로 보기"
          links={flightSearchLinks(search.from, search.to, search.date, search.adults)}
        />
        <button onClick={onAISearch} className="btn-secondary w-full text-sm" disabled={!search.date || !search.to}>
          🤖 AI에게 추천 받아 목록에 담기
        </button>
      </div>

      {data.flights.length === 0 ? (
        <p className="text-center text-sm text-soft py-4">아직 담아둔 항공편이 없어요.</p>
      ) : (
        <div className="space-y-2">
          <h2 className="font-medium">담아둔 옵션 ({data.flights.length})</h2>
          {data.flights.map((f) => (
            <div key={f.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-sm">{f.airline} {f.flightNumber}</div>
                  <div className="text-xs text-soft">{f.from} → {f.to}</div>
                  {f.departAt && <div className="text-xs text-soft mt-0.5">{f.departAt} {f.arriveAt && `→ ${f.arriveAt}`}</div>}
                </div>
                <button onClick={() => remove(f.id)} className="text-soft text-xs">×</button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-base font-medium">{f.priceKRW ? `${f.priceKRW.toLocaleString()}원` : "가격 미정"}</span>
                <FreshnessBadge lastVerified={f.lastVerified} />
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowAdd(true)} className="btn-ghost text-sm w-full">+ 직접 추가</button>
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
      <input className="input text-sm" placeholder="출발 일시" value={form.departAt} onChange={(e) => setForm({ ...form, departAt: e.target.value })} />
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
        return { ...h, otaPrices: merged, lastVerified: todayISO() };
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
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="text-sm font-medium">🔎 숙소 검색</div>
        <input
          className="input text-sm"
          placeholder="지역·호텔명 (예: 발리 우붓, 강남)"
          value={search.dest}
          onChange={(e) => setSearch((s) => ({ ...s, dest: e.target.value }))}
        />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label text-xs">체크인</label>
            <input type="date" className="input text-sm" value={search.checkIn} onChange={(e) => setSearch((s) => ({ ...s, checkIn: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">체크아웃</label>
            <input type="date" className="input text-sm" value={search.checkOut} onChange={(e) => setSearch((s) => ({ ...s, checkOut: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">인원</label>
            <input type="number" min={1} className="input text-sm" value={search.adults} onChange={(e) => setSearch((s) => ({ ...s, adults: Math.max(1, Number(e.target.value) || 1) }))} />
          </div>
        </div>
        <SearchLinks
          label="입력한 조건으로 예약 사이트에서 바로 검색"
          links={hotelSearchLinks(search.dest, search.checkIn, search.checkOut, search.adults)}
        />
      </div>

      {data.hotels.length === 0 ? (
        <p className="text-center text-sm text-soft py-4">아직 담아둔 숙소가 없어요.</p>
      ) : (
        <div className="space-y-3">
          <h2 className="font-medium">담아둔 숙소 ({data.hotels.length})</h2>
          {data.hotels.map((hotel) => (
            <div key={hotel.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{hotel.name}</div>
                  {hotel.location && <div className="text-xs text-soft">{hotel.location}</div>}
                </div>
                <button onClick={() => remove(hotel.id)} className="text-soft text-xs">×</button>
              </div>
              <div className="mt-2">
                <FreshnessBadge lastVerified={hotel.lastVerified} onClickCheck={() => openPriceBridge(hotel)} />
              </div>
              <button onClick={() => setEditing(hotel)} className="text-sm text-gold underline mt-3">
                OTA 가격 보기/편집 ({hotel.otaPrices?.length ?? 0})
              </button>
              {hotel.otaPrices && hotel.otaPrices.length > 0 && (
                <div className="mt-2 space-y-1 text-xs">
                  {[...hotel.otaPrices]
                    .filter((o) => typeof o.price === "number")
                    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
                    .slice(0, 3)
                    .map((o, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-soft">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {o.ota}</span>
                        <span>{o.price?.toLocaleString()}원/박</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowAdd(true)} className="btn-ghost text-sm w-full">+ 직접 추가</button>

      <p className="text-xs text-soft text-center">
        💡 본식 전후 부부 숙소, 하객 안내용 호텔도 여기에 함께 정리하면 좋아요.
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
