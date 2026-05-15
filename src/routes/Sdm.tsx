import { useState, useMemo } from "react";
import type { WeddingData, SdmVendor, SdmCategory } from "../lib/schema";
import {
  SDM_GUIDE,
  SDM_CATALOG,
  SDM_PRICE_RANGE_NOTE,
  RESEARCH_CHANNELS,
  type SdmCatalogEntry,
} from "../data/sdmCatalog";
import Modal from "../components/Modal";

type Props = { data: WeddingData; update: (patch: any) => void };

const CAT_LABEL: Record<SdmCategory, string> = {
  studio: "📸 스튜디오",
  dress: "👗 드레스",
  makeup: "💄 메이크업",
  snap: "📷 본식 스냅",
};

const STATUS_OPTIONS: SdmVendor["status"][] = ["관심", "상담", "계약"];

const REGION_GROUPS: { key: string; label: string; match: (r?: string) => boolean }[] = [
  { key: "all",    label: "전체",      match: () => true },
  { key: "cheongdam", label: "청담",   match: (r) => !!r && r.includes("청담") },
  { key: "gangnam",   label: "강남",   match: (r) => !!r && (r.includes("강남") || r.includes("신사동") || r.includes("압구정") || r.includes("송파")) },
  { key: "north",     label: "강북·홍대", match: (r) => !!r && (r.includes("강북") || r.includes("홍대") || r.includes("이태원")) },
  { key: "etc",       label: "기타",   match: (r) => !!r && (r.includes("전국") || (!["청담","강남","신사동","압구정","송파","강북","홍대","이태원"].some((x) => r.includes(x)))) },
];

export default function Sdm({ data, update }: Props) {
  const [cat, setCat] = useState<SdmCategory>("studio");
  const [region, setRegion] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showChannels, setShowChannels] = useState(false);

  const inCat = data.sdm.filter((v) => v.category === cat);

  const filteredCatalog = useMemo(() => {
    const regionMatch = REGION_GROUPS.find((g) => g.key === region)?.match ?? (() => true);
    const q = query.trim().toLowerCase();
    return SDM_CATALOG
      .filter((e) => e.category === cat)
      .filter((e) => regionMatch(e.region))
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.vibe.toLowerCase().includes(q));
  }, [cat, region, query]);

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
          notes: entry.vibe,
          status: "관심",
        },
      ],
    }));
  };

  const addCustom = (v: Omit<SdmVendor, "id">) => {
    update((prev: WeddingData) => ({ ...prev, sdm: [...prev.sdm, { ...v, id: `sdm-${Date.now()}` }] }));
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

  return (
    <div className="px-5 py-6 space-y-4">
      <h1 className="font-serif text-2xl">스드메 · 스냅</h1>
      <p className="text-xs text-soft -mt-2">스튜디오 · 드레스 · 메이크업 · 본식 스냅</p>

      {/* 카테고리 탭 */}
      <div className="grid grid-cols-4 gap-1.5">
        {(["studio", "dress", "makeup", "snap"] as SdmCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`text-xs px-2 py-2 rounded-full ${cat === c ? "bg-ink text-white" : "bg-white border border-line text-soft"}`}
          >
            {CAT_LABEL[c]}
          </button>
        ))}
      </div>

      {/* 가이드 (접이식) */}
      <details className="card">
        <summary className="font-medium cursor-pointer text-sm flex items-center justify-between">
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
      {inCat.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">내 후보 ({inCat.length})</h2>
            <button onClick={() => setShowAdd(true)} className="btn-ghost text-xs">+ 직접 추가</button>
          </div>
          <div className="space-y-2">
            {inCat.map((v) => (
              <MyVendorCard
                key={v.id}
                v={v}
                onUpdate={(patch) => updateVendor(v.id, patch)}
                onRemove={() => remove(v.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 검색 + 지역 필터 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">✨ 자주 언급되는 곳들</h2>
          {inCat.length === 0 && (
            <button onClick={() => setShowAdd(true)} className="btn-ghost text-xs">+ 직접 추가</button>
          )}
        </div>

        <input
          className="input text-sm"
          placeholder="이름·컨셉으로 검색 (예: 자연광, 빈티지)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {REGION_GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => setRegion(g.key)}
              className={`text-xs px-3 py-1.5 rounded-full flex-shrink-0 ${region === g.key ? "bg-gold text-white" : "bg-white border border-line text-soft"}`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {filteredCatalog.length === 0 ? (
          <p className="text-center text-sm text-soft py-6">
            조건에 맞는 곳이 없어요. 다른 지역·검색어를 시도해보세요.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredCatalog.map((e) => {
              const added = data.sdm.some((v) => v.name === e.name && v.category === e.category);
              return <CatalogCard key={e.id} entry={e} added={added} onAdd={() => addFromCatalog(e)} />;
            })}
          </div>
        )}
        <p className="text-[11px] text-soft text-center">
          총 {filteredCatalog.length}곳 표시 (전체 {SDM_CATALOG.filter((e) => e.category === cat).length})
        </p>
      </section>

      {/* 가격대 + 면책 */}
      <div className="card bg-cream/50 text-xs text-soft leading-relaxed space-y-2">
        <p>{SDM_PRICE_RANGE_NOTE}</p>
        <p>
          ⚠️ 이 목록은 결혼 카페·후기에서 자주 언급되는 곳의 출발점이에요.
          완전한 리스트도, 순위도 아닙니다. 업체 이전·실장 이동·이름 변경이 잦으니
          최종 결정 전 직접 확인이 꼭 필요해요. <strong>어떤 업체와도 제휴 없음</strong>.
        </p>
      </div>

      {/* 더 알아보기 */}
      <button
        onClick={() => setShowChannels(true)}
        className="card w-full text-left hover:bg-cream/50"
      >
        <div className="font-medium text-sm">📚 더 자세히 알아보려면</div>
        <p className="text-xs text-soft mt-1">결혼 카페·인스타·유튜브 — 사람들이 실제 정보 얻는 곳</p>
      </button>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`${CAT_LABEL[cat]} 직접 추가`}>
        <CustomAdd category={cat} onAdd={addCustom} />
      </Modal>

      <Modal open={showChannels} onClose={() => setShowChannels(false)} title="실제 정보 얻는 곳">
        <p className="text-sm text-soft mb-4 leading-relaxed">
          사람들 대부분은 결혼 카페·인스타·유튜브에서 더 풍부한 후기를 봐요.
          후기는 단가·실장 이름·시즌별 패키지처럼 공식 사이트엔 안 나오는 정보가 많습니다.
        </p>
        <ul className="space-y-2">
          {RESEARCH_CHANNELS.map((c) => (
            <li key={c.name}>
              <a
                href={c.url}
                target="_blank"
                rel="noopener"
                className="block card hover:bg-cream/50 text-sm"
              >
                {c.name} ↗
              </a>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

/* ── 카드들 ── */

function CatalogCard({
  entry, added, onAdd,
}: {
  entry: SdmCatalogEntry;
  added: boolean;
  onAdd: () => void;
}) {
  const mapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(entry.name)}`;
  return (
    <div className={`card p-3 ${added ? "opacity-60" : ""}`}>
      <div className="font-medium text-sm">{entry.name}</div>
      <div className="text-xs text-soft mt-1 line-clamp-2">{entry.vibe}</div>
      {entry.region && (
        <span className="inline-block mt-2 text-[10px] text-soft border border-line rounded-full px-2 py-0.5">
          📍 {entry.region}
        </span>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onAdd}
          disabled={added}
          className={`flex-1 text-xs py-1.5 rounded-md ${added ? "bg-cream text-soft" : "bg-gold/10 text-gold border border-gold/30"}`}
        >
          {added ? "✓ 담음" : "+ 담기"}
        </button>
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener"
          className="text-xs py-1.5 px-2.5 rounded-md bg-white border border-line text-soft"
          onClick={(e) => e.stopPropagation()}
        >
          🗺️
        </a>
      </div>
    </div>
  );
}

function MyVendorCard({
  v, onUpdate, onRemove,
}: {
  v: SdmVendor;
  onUpdate: (patch: Partial<SdmVendor>) => void;
  onRemove: () => void;
}) {
  const mapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(v.name)}`;
  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium text-sm">{v.name}</div>
          {v.region && <div className="text-xs text-soft">📍 {v.region}</div>}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener"
            className="text-xs text-soft border border-line rounded-md px-2 py-1"
          >
            🗺️ 지도
          </a>
          <button onClick={onRemove} className="text-soft text-xs">×</button>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onUpdate({ status: s })}
            className={`text-xs px-2.5 py-1 rounded-full ${v.status === s ? "bg-gold text-white" : "bg-white border border-line text-soft"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <textarea
        className="input text-xs min-h-[50px]"
        placeholder="메모 (가격·실장 이름·인상 등)"
        value={v.notes ?? ""}
        onChange={(e) => onUpdate({ notes: e.target.value })}
      />
      <div className="flex gap-2">
        <input
          className="input text-xs flex-1"
          placeholder="가격 메모"
          value={v.priceRange ?? ""}
          onChange={(e) => onUpdate({ priceRange: e.target.value })}
        />
        <input
          className="input text-xs flex-1"
          placeholder="링크 (인스타·홈피)"
          value={v.link ?? ""}
          onChange={(e) => onUpdate({ link: e.target.value })}
        />
      </div>
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
      <input className="input text-sm" placeholder="지역 (예: 청담)" value={region} onChange={(e) => setRegion(e.target.value)} />
      <input className="input text-sm" placeholder="홈페이지·인스타 링크" value={link} onChange={(e) => setLink(e.target.value)} />
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
