import { useState } from "react";
import type { WeddingData, Flight } from "../lib/schema";
import FreshnessBadge from "../components/FreshnessBadge";
import Modal from "../components/Modal";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import { flightSearchPrompt, BridgePrompt } from "../lib/chatbotBridge";
import { todayISO } from "../lib/freshness";
import { demoData } from "../data/demoData";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Flights({ data, update }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [bridge, setBridge] = useState<BridgePrompt | null>(null);
  const [search, setSearch] = useState({ from: "ICN", to: "JFK", date: "" });

  const addFlight = (f: Omit<Flight, "id">) => {
    update((prev: WeddingData) => ({ ...prev, flights: [...prev.flights, { ...f, id: `flight-${Date.now()}` }] }));
  };

  const remove = (id: string) => {
    update((prev: WeddingData) => ({ ...prev, flights: prev.flights.filter(f => f.id !== id) }));
  };

  const onSearch = () => {
    if (!search.date) return;
    setBridge(flightSearchPrompt(search.from, search.to, search.date));
  };

  const applyResults = (parsed: any) => {
    const options = parsed?.options;
    if (!Array.isArray(options)) return;
    const newFlights = options.map((o: any, i: number) => ({
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

  return (
    <div className="px-5 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">항공권</h1>
        <button onClick={() => setShowAdd(true)} className="btn-secondary text-sm">+ 옵션 추가</button>
      </div>

      <div className="card">
        <div className="text-sm font-medium mb-3">AI에게 항공편 찾아달라기</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input className="input text-sm" placeholder="ICN" value={search.from} onChange={e => setSearch(s => ({...s, from: e.target.value}))} />
          <input className="input text-sm" placeholder="JFK" value={search.to} onChange={e => setSearch(s => ({...s, to: e.target.value}))} />
          <input type="date" className="input text-sm col-span-2" value={search.date} onChange={e => setSearch(s => ({...s, date: e.target.value}))} />
        </div>
        <button onClick={onSearch} className="btn-primary w-full">🤖 항공편 추천 받기</button>
      </div>

      {data.flights.length === 0 ? (
        <div className="card text-center py-6 space-y-3">
          <p className="text-soft text-sm">아직 항공편 옵션이 없어요.</p>
          <button
            onClick={() => update((prev: WeddingData) => ({
              ...prev,
              flights: demoData().flights.map((f, i) => ({ ...f, id: `flight-${Date.now()}-${i}` })),
            }))}
            className="btn-secondary text-sm"
          >
            예시 불러오기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.flights.map(f => (
            <div key={f.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    {f.airline} {f.flightNumber}
                  </div>
                  <div className="text-sm text-soft">{f.from} → {f.to}</div>
                  {f.departAt && <div className="text-xs text-soft mt-1">{f.departAt} {f.arriveAt && `→ ${f.arriveAt}`}</div>}
                </div>
                <button onClick={() => remove(f.id)} className="text-soft text-xs">×</button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-lg font-medium">
                  {f.priceKRW ? `${f.priceKRW.toLocaleString()}원` : "가격 미정"}
                </span>
                <FreshnessBadge lastVerified={f.lastVerified} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="항공편 직접 추가">
        <FlightForm onSubmit={(f) => { addFlight(f); setShowAdd(false); }} />
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

function FlightForm({ onSubmit }: { onSubmit: (f: Omit<Flight, "id">) => void; }) {
  const [form, setForm] = useState({ airline: "", flightNumber: "", from: "", to: "", departAt: "", priceKRW: "" });
  return (
    <div className="space-y-3">
      <div><label className="label">항공사</label><input className="input" value={form.airline} onChange={e => setForm({...form, airline: e.target.value})} placeholder="대한항공" /></div>
      <div><label className="label">편명</label><input className="input" value={form.flightNumber} onChange={e => setForm({...form, flightNumber: e.target.value})} placeholder="KE001" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">출발</label><input className="input" value={form.from} onChange={e => setForm({...form, from: e.target.value})} placeholder="ICN" /></div>
        <div><label className="label">도착</label><input className="input" value={form.to} onChange={e => setForm({...form, to: e.target.value})} placeholder="JFK" /></div>
      </div>
      <div><label className="label">출발 일시</label><input className="input" value={form.departAt} onChange={e => setForm({...form, departAt: e.target.value})} placeholder="2026-09-12 10:30" /></div>
      <div><label className="label">가격 (원)</label><input className="input" type="number" value={form.priceKRW} onChange={e => setForm({...form, priceKRW: e.target.value})} /></div>
      <button
        className="btn-primary w-full"
        onClick={() => {
          if (!form.airline.trim()) return;
          onSubmit({
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
