import { useState } from "react";
import type { WeddingData, Hotel } from "../lib/schema";
import { OTA_LIST } from "../data/hotelOtaTemplate";
import FreshnessBadge from "../components/FreshnessBadge";
import Modal from "../components/Modal";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import { hotelPriceCheckPrompt, BridgePrompt } from "../lib/chatbotBridge";
import { todayISO } from "../lib/freshness";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function HotelPage({ data, update }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [bridge, setBridge] = useState<{ prompt: BridgePrompt; hotelId: string } | null>(null);

  const addHotel = (h: Omit<Hotel, "id">) => {
    update((prev: WeddingData) => ({
      ...prev,
      hotels: [...prev.hotels, { ...h, id: `hotel-${Date.now()}` }],
    }));
  };

  const removeHotel = (id: string) => {
    update((prev: WeddingData) => ({ ...prev, hotels: prev.hotels.filter(h => h.id !== id) }));
  };

  const updateOtaPrice = (hotelId: string, ota: string, price: number, url?: string) => {
    update((prev: WeddingData) => ({
      ...prev,
      hotels: prev.hotels.map(h => {
        if (h.id !== hotelId) return h;
        const otaPrices = h.otaPrices ?? [];
        const idx = otaPrices.findIndex(o => o.ota === ota);
        const next = idx >= 0
          ? otaPrices.map((o, i) => i === idx ? { ...o, price, url: url ?? o.url } : o)
          : [...otaPrices, { ota, price, url }];
        return { ...h, otaPrices: next, lastVerified: todayISO() };
      }),
    }));
  };

  const openPriceBridge = (hotel: Hotel) => {
    setBridge({
      prompt: hotelPriceCheckPrompt(hotel.name),
      hotelId: hotel.id,
    });
  };

  const applyBridge = (parsed: any) => {
    if (!bridge) return;
    const results = parsed?.results;
    if (!Array.isArray(results)) return;
    update((prev: WeddingData) => ({
      ...prev,
      hotels: prev.hotels.map(h => {
        if (h.id !== bridge.hotelId) return h;
        const existing = h.otaPrices ?? [];
        const merged = [...existing];
        for (const r of results) {
          if (!r.ota || typeof r.pricePerNight !== "number") continue;
          const idx = merged.findIndex(m => m.ota === r.ota);
          const entry = { ota: r.ota, price: r.pricePerNight, url: r.url };
          if (idx >= 0) merged[idx] = entry; else merged.push(entry);
        }
        return { ...h, otaPrices: merged, lastVerified: todayISO() };
      }),
    }));
    setBridge(null);
  };

  return (
    <div className="px-5 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">호텔</h1>
        <button onClick={() => setShowAdd(true)} className="btn-secondary text-sm">+ 호텔 추가</button>
      </div>

      {data.hotels.length === 0 ? (
        <div className="card text-center text-soft text-sm py-8">
          호텔 후보를 추가해 가격을 비교해보세요.
        </div>
      ) : (
        <div className="space-y-3">
          {data.hotels.map(hotel => (
            <div key={hotel.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">{hotel.name}</div>
                  {hotel.location && <div className="text-sm text-soft">{hotel.location}</div>}
                </div>
                <button onClick={() => removeHotel(hotel.id)} className="text-soft text-xs">×</button>
              </div>

              <div className="mt-2">
                <FreshnessBadge lastVerified={hotel.lastVerified} onClickCheck={() => openPriceBridge(hotel)} />
              </div>

              <button
                onClick={() => setEditing(hotel)}
                className="text-sm text-gold underline mt-3"
              >
                OTA 가격 보기/편집 ({hotel.otaPrices?.length ?? 0})
              </button>

              {hotel.otaPrices && hotel.otaPrices.length > 0 && (
                <div className="mt-3 space-y-1 text-sm">
                  {[...hotel.otaPrices]
                    .filter(o => typeof o.price === "number")
                    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
                    .slice(0, 3)
                    .map((o, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
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

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="호텔 추가">
        <HotelForm onSubmit={(h) => { addHotel(h); setShowAdd(false); }} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.name ?? ""}>
        {editing && (
          <OtaEditor
            hotel={editing}
            onUpdate={(ota, price, url) => updateOtaPrice(editing.id, ota, price, url)}
            onPriceBridge={() => { openPriceBridge(editing); setEditing(null); }}
          />
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

function HotelForm({ onSubmit }: { onSubmit: (h: Omit<Hotel, "id">) => void; }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  return (
    <div className="space-y-3">
      <div>
        <label className="label">호텔 이름</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="예: 그랜드 워커힐" />
      </div>
      <div>
        <label className="label">지역</label>
        <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="예: 서울 광진구" />
      </div>
      <button
        className="btn-primary w-full"
        onClick={() => name.trim() && onSubmit({ name: name.trim(), location: location.trim() || undefined })}
      >
        추가
      </button>
    </div>
  );
}

function OtaEditor({
  hotel, onUpdate, onPriceBridge,
}: {
  hotel: Hotel;
  onUpdate: (ota: string, price: number, url?: string) => void;
  onPriceBridge: () => void;
}) {
  return (
    <div className="space-y-3">
      <button onClick={onPriceBridge} className="btn-primary w-full">
        🤖 AI에게 가격 비교 부탁하기
      </button>
      <p className="text-xs text-soft">또는 직접 입력하세요. (1박 기준)</p>
      <div className="space-y-2">
        {OTA_LIST.map(ota => {
          const existing = hotel.otaPrices?.find(o => o.ota === ota);
          return (
            <OtaRow key={ota} ota={ota} initialPrice={existing?.price} onSave={(p) => onUpdate(ota, p)} />
          );
        })}
      </div>
    </div>
  );
}

function OtaRow({ ota, initialPrice, onSave }: { ota: string; initialPrice?: number; onSave: (p: number) => void; }) {
  const [val, setVal] = useState(initialPrice ? String(initialPrice) : "");
  const blur = () => {
    const n = Number(val.replace(/,/g, ""));
    if (!isNaN(n) && n > 0) onSave(n);
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-soft w-24 flex-shrink-0">{ota}</span>
      <input
        type="number"
        className="input flex-1 text-sm"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={blur}
        placeholder="가격"
      />
      <span className="text-xs text-soft">원/박</span>
    </div>
  );
}
