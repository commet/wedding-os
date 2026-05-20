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
import VendorActions from "../components/VendorActions";

type Props = { data: WeddingData; update: (patch: any) => void; initialCategory?: SdmCategory };

const CAT_LABEL: Record<SdmCategory, string> = {
  studio: "스튜디오",
  dress: "드레스",
  makeup: "메이크업",
  snap: "본식 스냅",
};

const STATUS_OPTIONS: SdmVendor["status"][] = ["관심", "상담", "계약"];

const SEOUL = ["청담","강남","신사동","압구정","송파","강북","홍대","이태원"];

const REGION_GROUPS: { key: string; label: string; match: (r?: string) => boolean }[] = [
  { key: "all",      label: "전체",      match: () => true },
  { key: "cheongdam",label: "청담",      match: (r) => !!r && r.includes("청담") },
  { key: "gangnam",  label: "강남",      match: (r) => !!r && (r.includes("강남") || r.includes("신사동") || r.includes("압구정") || r.includes("송파")) },
  { key: "north",    label: "강북·홍대", match: (r) => !!r && (r.includes("강북") || r.includes("홍대") || r.includes("이태원")) },
  { key: "bundang",  label: "분당·인천", match: (r) => !!r && (r.includes("분당") || r.includes("판교") || r.includes("인천") || r.includes("송도")) },
  { key: "busan",    label: "부산",      match: (r) => !!r && r.includes("부산") },
  { key: "daegu",    label: "대구",      match: (r) => !!r && r.includes("대구") },
  { key: "etc-local",label: "그 외 지방", match: (r) => !!r && (r.includes("광주") || r.includes("대전") || r.includes("제주") || r.includes("울산")) },
  { key: "nationwide",label: "전국 체인",match: (r) => !!r && r.includes("전국") },
];

export default function Sdm({ data, update, initialCategory = "studio" }: Props) {
  const snapOnly = initialCategory === "snap";
  const categories: SdmCategory[] = snapOnly ? ["snap"] : ["studio", "dress", "makeup"];
  const [cat, setCat] = useState<SdmCategory>(initialCategory);
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
    // 직접 추가도 중복 검사 — 같은 이름이 두 줄로 갈라져 메모가 쪼개지는 걸 막는다.
    const dup = data.sdm.some(
      (x) => x.category === v.category && x.name.trim().toLowerCase() === v.name.trim().toLowerCase(),
    );
    if (dup) {
      alert(`'${v.name}' 은(는) 이미 ${CAT_LABEL[v.category]} 후보에 있어요.`);
      return;
    }
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
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-2">{snapOnly ? "Wedding Day Snap" : "Studio · Dress · Makeup"}</div>
        <h1 className="font-serif text-[2rem] leading-none">{snapOnly ? "본식 스냅" : "스드메"}</h1>
      </div>

      {/* 카테고리 — underline 탭 */}
      {!snapOnly && (
      <div className="flex items-center gap-6 border-b border-hair pb-3 overflow-x-auto -mx-6 px-6">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`text-[12px] tracking-wide whitespace-nowrap pb-1 transition ${
              cat === c ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"
            }`}
          >
            {CAT_LABEL[c]}
          </button>
        ))}
      </div>
      )}

      {/* 가이드 (접이식) — hairline */}
      <details className="border-b border-hair pb-5">
        <summary className="cursor-pointer flex items-baseline justify-between py-2">
          <span className="font-serif text-[15px] text-ink">{guide.title} <span className="text-soft text-[12px]">— 고를 때 확인할 것</span></span>
          <span className="text-soft text-[12px] group-open:rotate-180 transition">▾</span>
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-[13px] leading-relaxed text-soft">{guide.tip}</p>
          <div>
            <div className="eyebrow mb-2">체크포인트</div>
            <ul className="text-[13px] space-y-1.5 text-ink/90">
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
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="eyebrow-gold">내 후보 · <span className="tabular-nums">{inCat.length}</span></h2>
            <button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">+ 직접 추가</button>
          </div>
          <div className="divide-y divide-hair border-y border-hair">
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
      <section className="space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow-gold">자주 언급되는 곳들</h2>
          {inCat.length === 0 && (
            <button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">+ 직접 추가</button>
          )}
        </div>

        <input
          className="input text-[13px]"
          placeholder="이름·컨셉으로 검색 (예: 자연광, 빈티지)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="flex gap-5 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
          {REGION_GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => setRegion(g.key)}
              className={`text-[11.5px] tracking-wide whitespace-nowrap pb-1 transition ${
                region === g.key ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {filteredCatalog.length === 0 ? (
          <p className="text-center text-[12.5px] text-soft py-8">
            조건에 맞는 곳이 없어요. 다른 지역·검색어를 시도해보세요.
          </p>
        ) : (
          <div className="divide-y divide-hair border-y border-hair">
            {filteredCatalog.map((e) => {
              const added = data.sdm.some((v) => v.name === e.name && v.category === e.category);
              return <CatalogCard key={e.id} entry={e} added={added} onAdd={() => addFromCatalog(e)} />;
            })}
          </div>
        )}
        <p className="eyebrow text-center">
          총 <span className="tabular-nums">{filteredCatalog.length}</span>곳 표시 · 전체 <span className="tabular-nums">{SDM_CATALOG.filter((e) => e.category === cat).length}</span>
        </p>
      </section>

      {/* 지방 안내 */}
      {!SEOUL.some((s) => region === s || region === "all") && region !== "all" && region !== "nationwide" && (
        <div className="py-5 border-t border-b border-hair text-[12px] text-soft leading-relaxed space-y-2">
          <p><b className="text-ink">지방은 이 목록보다 카카오맵 + 결혼 카페가 훨씬 정확해요.</b></p>
          <p>각 카드의 [지도] 버튼으로 지역명·후기를 함께 검색하시고,
            결혼 카페의 <b className="text-ink">지역 게시판</b>(다이렉트결혼준비 등)에서 실시간 후기를 보세요.</p>
        </div>
      )}

      {/* 가격대 + 면책 */}
      <div className="py-5 border-t border-hair text-[11.5px] text-soft leading-relaxed space-y-3">
        <p>{SDM_PRICE_RANGE_NOTE}</p>
        <p>
          이 목록은 결혼 준비 단계에서의 출발점일 뿐이에요. 완전한 리스트도, 순위도, 추천도 아닙니다.
          업체 이전·실장 이동·이름 변경이 잦으니 최종 결정 전 직접 확인이 꼭 필요해요.
          <strong className="text-ink"> 어떤 업체와도 제휴·후원·광고 관계 없음</strong>.
        </p>
        <p>
          표시 삭제·정정 요청은{" "}
          <a href="mailto:yclee913@gmail.com" rel="noopener noreferrer" className="underline underline-offset-2 text-ink">yclee913@gmail.com</a>
          {" "}으로 — 24시간 내 처리해드립니다.
        </p>
      </div>

      {/* 더 알아보기 */}
      <button
        onClick={() => setShowChannels(true)}
        className="block w-full text-left py-5 border-t border-b border-hair active:opacity-60 transition"
      >
        <div className="font-serif text-[15px] text-ink">더 자세히 알아보려면 →</div>
        <p className="text-[12px] text-soft mt-1">결혼 카페 · 인스타 · 유튜브 — 사람들이 실제 정보 얻는 곳</p>
      </button>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`${CAT_LABEL[cat]} 직접 추가`}>
        <CustomAdd category={cat} onAdd={addCustom} />
      </Modal>

      <Modal open={showChannels} onClose={() => setShowChannels(false)} title="실제 정보 얻는 곳">
        <p className="text-sm text-soft mb-4 leading-relaxed">
          사람들 대부분은 결혼 카페·인스타·유튜브에서 더 풍부한 후기를 봐요.
          후기는 단가·실장 이름·시즌별 패키지처럼 공식 사이트엔 안 나오는 정보가 많습니다.
        </p>
        <ul className="divide-y divide-hair border-y border-hair">
          {RESEARCH_CHANNELS.map((c) => (
            <li key={c.name}>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block py-3.5 text-[14px] text-ink hover:text-gold transition"
              >
                {c.name} <span className="text-soft">↗</span>
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
  return (
    <div className={`py-4 ${added ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[15px] text-ink">{entry.name}</div>
          <div className="text-[12px] text-soft mt-1 leading-relaxed line-clamp-2">{entry.vibe}</div>
          {entry.region && <div className="eyebrow mt-2">{entry.region}</div>}
        </div>
        <button
          onClick={onAdd}
          disabled={added}
          className={`text-[11.5px] tracking-wide whitespace-nowrap flex-shrink-0 underline underline-offset-4 ${
            added ? "text-soft" : "text-gold hover:text-ink"
          }`}
        >
          {added ? "✓ 담음" : "+ 담기"}
        </button>
      </div>
      <div className="mt-3">
        <VendorActions name={entry.name} region={entry.region} />
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
  return (
    <div className="py-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[15px] text-ink">{v.name}</div>
          {v.region && <div className="eyebrow mt-1">{v.region}</div>}
        </div>
        <button onClick={onRemove} className="text-soft hover:text-ink text-sm">×</button>
      </div>
      <VendorActions name={v.name} region={v.region} officialUrl={v.link} />

      <div className="flex items-baseline gap-5">
        <span className="eyebrow">상태</span>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onUpdate({ status: s })}
            className={`text-[12px] tracking-wide pb-1 transition ${
              v.status === s ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <textarea
        className="input-boxed text-[12.5px] min-h-[50px]"
        placeholder="메모 (가격·실장 이름·인상 등)"
        value={v.notes ?? ""}
        onChange={(e) => onUpdate({ notes: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-x-4">
        <input
          className="input text-[12.5px]"
          placeholder="가격 메모"
          value={v.priceRange ?? ""}
          onChange={(e) => onUpdate({ priceRange: e.target.value })}
        />
        <input
          className="input text-[12.5px]"
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
