import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import MapEmbed from "../components/MapEmbed";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import {
  flightSearchPrompt,
  hotelPriceCheckPrompt,
  type BridgePrompt,
} from "../lib/chatbotBridge";
import { todayISO } from "../lib/freshness";
import { koBreak } from "../lib/typography";

type Props = { data: WeddingData; update: (patch: any) => void };
type Tab = "destinations" | "flights" | "stays";
type TripMood = "rest" | "balanced" | "active" | "short";
type TripBudget = "value" | "mid" | "luxury";

export default function Trip({ data, update }: Props) {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("destinations");
  const [showStarter, setShowStarter] = useState(() => searchParams.get("starter") === "1");

  const applyTripStarter = (picks: HoneymoonPick[]) => {
    update((prev: WeddingData) => {
      const names = new Set(prev.honeymoon.regions.map((r) => r.name));
      const additions = picks
        .filter((pick) => !names.has(pick.region))
        .map((pick) => ({
          id: `region-${Date.now()}-${pick.id}`,
          name: pick.region,
          notes: starterTripNotes(pick),
        }));
      return {
        ...prev,
        honeymoon: {
          ...prev.honeymoon,
          regions: [...prev.honeymoon.regions, ...additions],
        },
      };
    });
    setTab("destinations");
    setShowStarter(false);
  };

  return (
    <div className="page pt-8 pb-10 space-y-6">
      <div>
        <div className="eyebrow-gold mb-2">여행 계획</div>
        <h1 className="h-page">{koBreak("신혼여행")}</h1>
      </div>

      {showStarter ? (
        <TripStarter onApply={applyTripStarter} onClose={() => setShowStarter(false)} />
      ) : (
        <>
          <div className="flex items-center gap-6 border-b border-hair pb-3">
            <TabBtn active={tab === "destinations"} onClick={() => setTab("destinations")}>여행지</TabBtn>
            <TabBtn active={tab === "flights"} onClick={() => setTab("flights")}>항공</TabBtn>
            <TabBtn active={tab === "stays"} onClick={() => setTab("stays")}>숙소</TabBtn>
          </div>

          <button
            onClick={() => setShowStarter(true)}
            className="w-full text-left border-y border-hair py-4 flex items-baseline justify-between gap-4"
          >
            <span>
              <span className="eyebrow block mb-1">기본 후보</span>
              <span className="font-serif text-[18px] text-ink">여행 기준 잡기</span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
          </button>

          {tab === "destinations" && <Destinations data={data} update={update} />}
          {tab === "flights" && <Flights data={data} update={update} />}
          {tab === "stays" && <Stays data={data} update={update} />}
        </>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button onClick={onClick} className={`tracking-wide ${active ? "seg-active" : "seg"}`}>
      {children}
    </button>
  );
}

function TripStarter({
  onApply,
  onClose,
}: {
  onApply: (picks: HoneymoonPick[]) => void;
  onClose: () => void;
}) {
  const [mood, setMood] = useState<TripMood>("balanced");
  const [budget, setBudget] = useState<TripBudget>("mid");
  const [days, setDays] = useState<"short" | "week" | "long">("week");

  const picks = useMemo(
    () => pickStarterTrips({ mood, budget, days }),
    [mood, budget, days]
  );

  return (
    <section className="border-y border-hair py-5 space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">기본 후보</div>
          <h2 className="font-serif text-xl text-ink">여행 기준 잡기</h2>
        </div>
        <button onClick={onClose} className="text-[12px] text-soft underline underline-offset-4 hover:text-ink">
          닫기
        </button>
      </div>

      <p className="text-[12px] text-soft leading-relaxed">
        여행 톤과 기간을 기준으로 먼저 비교할 지역을 잡습니다. 항공·숙소 가격과 시즌은 예약 전에 직접 다시 확인해야 합니다.
      </p>

      <StarterOption label="여행 톤">
        <Segment active={mood === "rest"} onClick={() => setMood("rest")}>휴양 중심</Segment>
        <Segment active={mood === "balanced"} onClick={() => setMood("balanced")}>휴양+관광</Segment>
        <Segment active={mood === "active"} onClick={() => setMood("active")}>관광 중심</Segment>
        <Segment active={mood === "short"} onClick={() => setMood("short")}>짧고 편하게</Segment>
      </StarterOption>

      <StarterOption label="예산감">
        <Segment active={budget === "value"} onClick={() => setBudget("value")}>가볍게</Segment>
        <Segment active={budget === "mid"} onClick={() => setBudget("mid")}>중간</Segment>
        <Segment active={budget === "luxury"} onClick={() => setBudget("luxury")}>크게</Segment>
      </StarterOption>

      <StarterOption label="기간">
        <Segment active={days === "short"} onClick={() => setDays("short")}>3~5일</Segment>
        <Segment active={days === "week"} onClick={() => setDays("week")}>5~7일</Segment>
        <Segment active={days === "long"} onClick={() => setDays("long")}>8일 이상</Segment>
      </StarterOption>

      <div className="border-y border-hair divide-y divide-hair">
        {picks.map((pick, idx) => (
          <div key={pick.id} className="py-3 flex items-start gap-3">
            <span className="font-serif text-soft text-base tabular-nums w-5 flex-shrink-0">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-[15px] text-ink">{pick.region}</div>
              <p className="text-[12px] text-soft leading-relaxed mt-1">{pick.vibe}</p>
              <div className="eyebrow mt-2 space-x-2">
                <span>{pick.bestSeason}</span>
                <span>· {pick.flightHours}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => onApply(picks)} className="btn-primary w-full py-3 text-[13px]">
        후보 3곳 담기 →
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

function pickStarterTrips({
  mood,
  budget,
  days,
}: {
  mood: TripMood;
  budget: TripBudget;
  days: "short" | "week" | "long";
}): HoneymoonPick[] {
  return HONEYMOON_CATALOG.map((pick) => {
    let score = 0;
    if (budget === "value" && pick.budgetLevel <= 2) score += 4;
    if (budget === "mid" && pick.budgetLevel >= 2 && pick.budgetLevel <= 3) score += 4;
    if (budget === "luxury" && pick.budgetLevel >= 3) score += 4;

    const text = `${pick.region} ${pick.vibe} ${pick.pairs ?? ""} ${pick.highlights.join(" ")}`;
    if (mood === "rest" && /휴양|리조트|빌라|스파|바다|풀/.test(text)) score += 4;
    if (mood === "balanced" && /발리|하와이|푸켓|오키나와|제주|다낭/.test(text)) score += 4;
    if (mood === "active" && /관광|문화|하이킹|도시|유럽|하와이|두바이|부산|스위스/.test(text)) score += 4;
    if (mood === "short" && /제주|강원|부산|오키나와|다낭/.test(text)) score += 5;

    if (days === "short" && /1시간|2.5시간|5시간|차로|기차/.test(pick.flightHours)) score += 3;
    if (days === "week" && /5시간|6시간|7시간|8~9시간/.test(pick.flightHours)) score += 3;
    if (days === "long" && /9|10|12|14|15/.test(pick.flightHours)) score += 3;

    return { pick, score };
  })
    .sort((a, b) => b.score - a.score || a.pick.budgetLevel - b.pick.budgetLevel)
    .slice(0, 3)
    .map(({ pick }) => pick);
}

function starterTripNotes(pick: HoneymoonPick): string {
  return [
    pick.vibe,
    "",
    `[추천 시기] ${pick.bestSeason}`,
    `[비행] ${pick.flightHours}`,
    `[예산] ${pick.budgetKRWPerPerson}`,
    "",
    `[일정 메모] ${pick.tip}`,
  ].join("\n");
}

/* ──────────── 여행지 탭 ──────────── */

function Destinations({ data, update }: Props) {
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(() => data.honeymoon.regions.length === 0);
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
          <h2 className="section-title mb-4">{koBreak("내 후보 ·")} <span className="tabular-nums">{regions.length}</span></h2>
          <div className="group-card px-4">
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
        <button onClick={() => setCatalogOpen((open) => !open)} className="flex w-full items-center justify-between gap-4 border-y border-hair py-4 text-left">
          <span>
            <span className="section-title block">여행지 후보 더 찾아보기</span>
            <span className="mt-1 block text-[12px] text-soft leading-relaxed">시기·비행시간·비용으로 {HONEYMOON_CATALOG.length}곳을 비교합니다.</span>
          </span>
          <span className="text-[12px] text-soft underline underline-offset-4">{catalogOpen ? "접기" : "열기"}</span>
        </button>
        {catalogOpen && <div className="pt-5">
        <div className="group-card px-4">
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
          여행지 상세 정보 보기 →
        </button>
        </div>}
      </section>

      <Modal open={showCatalog} onClose={() => setShowCatalog(false)} title="신혼여행지 상세 안내">
        <div className="space-y-4">
          {HONEYMOON_CATALOG.map((p) => (
            <div key={p.id} className="border-b border-hair pb-3 last:border-b-0">
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
              <div className="text-[12px] mt-3 pl-3 border-l border-gold text-soft leading-relaxed">{p.tip}</div>
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
            <div className="font-serif text-[18px] text-ink truncate">{koBreak(region.name)}</div>
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
          className="w-8 h-10 text-lg leading-none text-mute hover:text-ink flex items-center justify-center flex-shrink-0 transition"
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

          <MapEmbed query={region.name} heightClass="h-40" label={`${region.name} 지도`} />

          <p className="text-[12px] text-soft leading-relaxed">
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
        <h2 className="section-title">{koBreak("항공편 검색")}</h2>
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
          AI 참고용 후보 만들기 →
        </button>
      </section>

      {data.flights.length === 0 ? (
        <p className="text-center text-[13px] text-soft py-4">아직 담아둔 항공편이 없어요.</p>
      ) : (
        <section>
          <h2 className="section-title mb-4">{koBreak("담아둔 옵션 ·")} <span className="tabular-nums">{data.flights.length}</span></h2>
          <div className="group-card px-4">
            {data.flights.map((f) => (
              <div key={f.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-[15px] text-ink">{f.airline} <span className="text-soft">{f.flightNumber}</span></div>
                    <div className="eyebrow mt-1">{f.from} → {f.to}</div>
                    {f.departAt && <div className="text-[11px] text-soft mt-1 tabular-nums">{f.departAt} {f.arriveAt && `→ ${f.arriveAt}`}</div>}
                  </div>
                  <button onClick={() => remove(f.id)} aria-label={`${f.airline} ${f.flightNumber} 삭제`} className="flex min-h-11 min-w-11 items-center justify-center text-soft hover:text-ink text-sm">×</button>
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
        <h2 className="section-title">{koBreak("숙소 검색")}</h2>
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
        <p className="text-center text-[13px] text-soft py-4">아직 담아둔 숙소가 없어요.</p>
      ) : (
        <section>
          <h2 className="section-title mb-4">{koBreak("담아둔 숙소 ·")} <span className="tabular-nums">{data.hotels.length}</span></h2>
          <div className="group-card px-4">
            {data.hotels.map((hotel) => (
              <div key={hotel.id} className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-[15px] text-ink">{hotel.name}</div>
                    {hotel.location && <div className="eyebrow mt-1">{hotel.location}</div>}
                  </div>
                  <button onClick={() => remove(hotel.id)} aria-label={`${hotel.name} 삭제`} className="flex min-h-11 min-w-11 items-center justify-center text-soft hover:text-ink text-sm">×</button>
                </div>
                <div className="mt-2">
                  <FreshnessBadge lastVerified={hotel.lastVerified} onClickCheck={() => openPriceBridge(hotel)} />
                </div>
                <button onClick={() => setEditing(hotel)} className="text-[12px] text-ink underline underline-offset-4 hover:text-gold mt-3">
                  OTA 가격 보기/편집 ({hotel.otaPrices?.length ?? 0}) →
                </button>
                {hotel.otaPrices && hotel.otaPrices.length > 0 && (
                  <div className="mt-3 space-y-1.5 text-[12px]">
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

      <p className="text-[12px] text-soft text-center leading-relaxed">
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
              AI 참고용 가격 범위 추정
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
