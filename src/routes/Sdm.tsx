import { useState } from "react";
import type { WeddingData, SdmVendor, SdmCategory } from "../lib/schema";
import { SDM_GUIDE, SDM_CATALOG, SDM_PRICE_RANGE_NOTE, type SdmCatalogEntry } from "../data/sdmCatalog";
import Modal from "../components/Modal";

type Props = { data: WeddingData; update: (patch: any) => void };

const CAT_LABEL: Record<SdmCategory, string> = {
  studio: "📸 스튜디오",
  dress: "👗 드레스",
  makeup: "💄 메이크업",
};

const STATUS_OPTIONS: SdmVendor["status"][] = ["관심", "상담", "계약"];

export default function Sdm({ data, update }: Props) {
  const [cat, setCat] = useState<SdmCategory>("studio");
  const [showCatalog, setShowCatalog] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const inCat = data.sdm.filter((v) => v.category === cat);

  const addFromCatalog = (entry: SdmCatalogEntry) => {
    if (data.sdm.some((v) => v.name === entry.name && v.category === entry.category)) return;
    update((prev: WeddingData) => ({
      ...prev,
      sdm: [
        ...prev.sdm,
        {
          id: `sdm-${Date.now()}-${entry.id}`,
          category: entry.category,
          name: entry.name,
          region: entry.region,
          priceRange: entry.priceRange,
          notes: entry.vibe,
          status: "관심",
        },
      ],
    }));
  };

  const addCustom = (v: Omit<SdmVendor, "id">) => {
    update((prev: WeddingData) => ({
      ...prev,
      sdm: [...prev.sdm, { ...v, id: `sdm-${Date.now()}` }],
    }));
    setShowAdd(false);
  };

  const updateVendor = (id: string, patch: Partial<SdmVendor>) =>
    update((prev: WeddingData) => ({
      ...prev,
      sdm: prev.sdm.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));

  const remove = (id: string) =>
    update((prev: WeddingData) => ({ ...prev, sdm: prev.sdm.filter((v) => v.id !== id) }));

  const guide = SDM_GUIDE[cat];
  const catalogForCat = SDM_CATALOG.filter((e) => e.category === cat);

  return (
    <div className="px-5 py-6 space-y-4">
      <h1 className="font-serif text-2xl">스드메</h1>
      <p className="text-xs text-soft -mt-2">스튜디오 · 드레스 · 메이크업</p>

      {/* 카테고리 탭 */}
      <div className="flex gap-2">
        {(["studio", "dress", "makeup"] as SdmCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`flex-1 text-sm px-3 py-2 rounded-full ${
              cat === c ? "bg-ink text-white" : "bg-white border border-line text-soft"
            }`}
          >
            {CAT_LABEL[c]}
          </button>
        ))}
      </div>

      {/* 가이드 */}
      <details className="card">
        <summary className="font-medium cursor-pointer flex items-center justify-between">
          <span>{guide.title} — 고를 때 확인할 것</span>
          <span className="text-xs text-soft">▼</span>
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-relaxed text-soft">{guide.tip}</p>
          <div>
            <div className="text-xs text-soft mb-1.5">📋 체크포인트</div>
            <ul className="text-sm space-y-1">
              {guide.checklist.map((c, i) => (
                <li key={i}>· {c}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      {/* 내 후보 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">내 후보 ({inCat.length})</h2>
          <button onClick={() => setShowAdd(true)} className="btn-ghost text-xs">+ 직접 추가</button>
        </div>

        {inCat.length === 0 ? (
          <p className="text-sm text-soft text-center py-4">
            아래에서 후보를 골라 담아두세요.
          </p>
        ) : (
          <div className="space-y-2">
            {inCat.map((v) => (
              <div key={v.id} className="card space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{v.name}</div>
                    {v.region && <div className="text-xs text-soft">{v.region}</div>}
                  </div>
                  <button onClick={() => remove(v.id)} className="text-soft text-xs">×</button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateVendor(v.id, { status: s })}
                      className={`text-xs px-2.5 py-1 rounded-full ${
                        v.status === s ? "bg-gold text-white" : "bg-white border border-line text-soft"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input text-xs min-h-[60px]"
                  placeholder="메모"
                  value={v.notes ?? ""}
                  onChange={(e) => updateVendor(v.id, { notes: e.target.value })}
                />
                <div className="flex gap-2">
                  <input
                    className="input text-xs flex-1"
                    placeholder="가격대 메모"
                    value={v.priceRange ?? ""}
                    onChange={(e) => updateVendor(v.id, { priceRange: e.target.value })}
                  />
                  <input
                    className="input text-xs flex-1"
                    placeholder="링크"
                    value={v.link ?? ""}
                    onChange={(e) => updateVendor(v.id, { link: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 추천 카탈로그 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">✨ 자주 언급되는 곳들</h2>
          <span className="text-xs text-soft">{catalogForCat.length}곳</span>
        </div>
        <div className="space-y-2">
          {catalogForCat.map((e) => {
            const added = data.sdm.some((v) => v.name === e.name && v.category === e.category);
            return (
              <button
                key={e.id}
                onClick={() => addFromCatalog(e)}
                disabled={added}
                className="card w-full text-left active:bg-cream disabled:opacity-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{e.name}</div>
                    <div className="text-xs text-soft mt-0.5">{e.vibe}</div>
                    {e.region && <div className="text-[11px] text-soft mt-1">📍 {e.region}</div>}
                  </div>
                  <span className="text-xs text-gold flex-shrink-0">{added ? "✓ 담음" : "+ 담기"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 가격대 안내 + 면책 */}
      <div className="card bg-cream/50 text-xs text-soft leading-relaxed">
        <p>{SDM_PRICE_RANGE_NOTE}</p>
        <p className="mt-2">
          ⚠️ 업체·가격 정보는 변동이 잦아요. 위 목록은 "한국에서 자주 언급되는 곳"의 출발점일 뿐,
          최종 결정 전 본인 직접 방문·견적이 꼭 필요해요.
        </p>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`${CAT_LABEL[cat]} 직접 추가`}>
        <CustomAdd category={cat} onAdd={addCustom} />
      </Modal>

      {showCatalog && <div onClick={() => setShowCatalog(false)} />}
    </div>
  );
}

function CustomAdd({
  category,
  onAdd,
}: {
  category: SdmCategory;
  onAdd: (v: Omit<SdmVendor, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div className="space-y-3">
      <input className="input text-sm" placeholder="업체 이름" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input text-sm" placeholder="지역 (예: 청담동)" value={region} onChange={(e) => setRegion(e.target.value)} />
      <input className="input text-sm" placeholder="홈페이지/인스타 링크" value={link} onChange={(e) => setLink(e.target.value)} />
      <textarea className="input text-sm min-h-[80px]" placeholder="메모" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button
        className="btn-primary w-full"
        onClick={() => {
          if (!name.trim()) return;
          onAdd({
            category,
            name: name.trim(),
            region: region.trim() || undefined,
            link: link.trim() || undefined,
            notes: notes.trim() || undefined,
            status: "관심",
          });
        }}
      >
        추가
      </button>
    </div>
  );
}
