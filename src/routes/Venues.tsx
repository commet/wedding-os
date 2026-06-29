import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ContractCheck, WeddingData, WeddingVenue, VenueHallType } from "../lib/schema";
import {
  VENUE_CATALOG,
  HALL_TYPE_LABEL,
  FOOD_TYPE_LABEL,
  VENUE_GUIDES,
  VENUE_PRICE_NOTE,
} from "../data/venueCatalog";
import VendorActions from "../components/VendorActions";
import MapEmbed from "../components/MapEmbed";
import Modal from "../components/Modal";
import FreshnessBadge from "../components/FreshnessBadge";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import ResearchInputPanel, { type ResearchSection } from "../components/ResearchInputPanel";
import { safeHref } from "../lib/security";
import {
  emptyVenueResearchDraft,
  parseVenueResearchText,
  venueResearchDraftToPatch,
  type VenueResearchDraft,
} from "../lib/researchCapture";
import {
  upcomingBalances,
  venueCapacityFit,
  expectedHeadcount,
  formatKRW,
  type BalanceDue,
} from "../lib/derived";

type Props = { data: WeddingData; update: (patch: any) => void };
type Tab = "mine" | "catalog";

const STATUS_OPTIONS: WeddingVenue["status"][] = ["관심", "투어", "계약"];
const CONTRACT_FIELDS: { key: keyof ContractCheck; label: string; placeholder: string }[] = [
  { key: "quote", label: "견적 기준", placeholder: "예: 토 12시, 보증 250명, 식대 13만원, 대관료 포함" },
  { key: "payment", label: "결제 일정", placeholder: "예: 계약금 100만원, 잔금 D-7, 카드 가능 여부" },
  { key: "cancellation", label: "취소·변경", placeholder: "예: D-90 전 전액 환불, 이후 위약금 단계별 적용" },
  { key: "included", label: "포함 항목", placeholder: "예: 생화 장식, 혼구용품, 음주류, 폐백실, 빔 사용" },
  { key: "extras", label: "별도 비용", placeholder: "예: 부가세, 봉사료, 주차권, 셔틀, 원판 추가" },
  { key: "evidence", label: "증빙 보관", placeholder: "예: 계약서 PDF는 드라이브 / 견적 캡처는 카톡방 고정" },
];

const VENUE_RESEARCH_SECTIONS: ResearchSection<VenueResearchDraft>[] = [
  {
    title: "근거",
    helper: "후기 원문이 아니라 확인 가능한 출처와 확인일만 남겨요.",
    fields: [
      { key: "source", label: "출처·근거", placeholder: "공식 페이지, 상담 링크, 전화 상담 등" },
      { key: "lastVerified", label: "확인일", kind: "date", span: "half" },
      { key: "region", label: "지역", span: "half", placeholder: "예: 청담" },
    ],
  },
  {
    title: "비교 기준",
    fields: [
      {
        key: "hallType",
        label: "홀 형식",
        kind: "select",
        span: "half",
        options: (Object.entries(HALL_TYPE_LABEL) as Array<[VenueHallType, string]>)
          .map(([value, label]) => ({ value, label })),
      },
      {
        key: "foodType",
        label: "음식",
        kind: "select",
        span: "half",
        options: Object.entries(FOOD_TYPE_LABEL).map(([value, label]) => ({ value, label })),
      },
      { key: "capacityMin", label: "보증 인원", kind: "number", span: "half", inputMode: "numeric", placeholder: "200" },
      { key: "capacityMax", label: "최대 인원", kind: "number", span: "half", inputMode: "numeric", placeholder: "500" },
      { key: "mealPriceMin", label: "식대 시작", kind: "number", span: "half", inputMode: "numeric", placeholder: "130000" },
      { key: "mealPriceMax", label: "식대 상한", kind: "number", span: "half", inputMode: "numeric", placeholder: "160000" },
      { key: "contact", label: "담당자·연락처", placeholder: "예: 김실장 010-0000-0000" },
      { key: "notes", label: "내 메모", kind: "textarea", placeholder: "교통, 주차, 음식 인상처럼 직접 확인한 사실" },
    ],
  },
  {
    title: "계약 조건",
    helper: "상담 후 흔들리기 쉬운 조건만 짧게 남기면 충분합니다.",
    fields: [
      { key: "quote", label: "견적 기준", kind: "textarea", placeholder: "요일·시간·보증·식대·대관료 기준" },
      { key: "payment", label: "결제 일정", kind: "textarea", placeholder: "계약금, 잔금일, 카드·현금영수증" },
      { key: "cancellation", label: "취소·변경", kind: "textarea", placeholder: "환불, 위약금, 일정 변경 조건" },
      { key: "included", label: "포함 항목", kind: "textarea", placeholder: "생화, 음주류, 폐백실, 주차 등" },
      { key: "extras", label: "별도 비용", kind: "textarea", placeholder: "부가세, 봉사료, 셔틀, 주차권 등" },
      { key: "evidence", label: "증빙 보관", kind: "textarea", placeholder: "계약서, 견적서, 캡처 위치" },
    ],
  },
];

const REGION_GROUPS: { key: string; label: string; match: (r?: string) => boolean }[] = [
  { key: "all",    label: "전체",        match: () => true },
  { key: "gangnam",label: "강남·청담",   match: (r) => !!r && (r.includes("강남") || r.includes("청담") || r.includes("신사") || r.includes("삼성") || r.includes("논현") || r.includes("역삼") || r.includes("반포") || r.includes("서초") || r.includes("선릉") || r.includes("대치")) },
  { key: "central",label: "광화문·중구", match: (r) => !!r && (r.includes("광화문") || r.includes("중구") || r.includes("정동") || r.includes("소공") || r.includes("장충") || r.includes("동대문") || r.includes("시청") || r.includes("서대문") || r.includes("남산") || r.includes("종로") || r.includes("삼청")) },
  { key: "han",    label: "한남·여의도", match: (r) => !!r && (r.includes("한남") || r.includes("여의도") || r.includes("영등포") || r.includes("용산") || r.includes("잠실") || r.includes("송파") || r.includes("문정") || r.includes("강변")) },
  { key: "etc",    label: "그 외 서울",  match: (r) => !!r && (r.includes("공덕") || r.includes("성북") || r.includes("잠원") || r.includes("양재") || r.includes("광장동") || r.includes("강북") || r.includes("마포") || r.includes("강서") || r.includes("마곡") || r.includes("천호") || r.includes("강동") || r.includes("신도림") || r.includes("구로") || r.includes("문래")) },
  { key: "gyeonggi", label: "경기·인천", match: (r) => !!r && (r.includes("일산") || r.includes("경기") || r.includes("분당") || r.includes("판교") || r.includes("인천") || r.includes("수원") || r.includes("송도") || r.includes("영종")) },
  { key: "busan", label: "부산·울산", match: (r) => !!r && (r.includes("부산") || r.includes("해운대") || r.includes("울산")) },
  { key: "daegu", label: "대구", match: (r) => !!r && r.includes("대구") },
  { key: "chungcheong", label: "대전·충청", match: (r) => !!r && (r.includes("대전") || r.includes("충청")) },
  { key: "honam", label: "광주·전라", match: (r) => !!r && (r.includes("광주") || r.includes("전라") || r.includes("여수")) },
  { key: "gangwon-jeju", label: "강원·제주", match: (r) => !!r && (r.includes("강원") || r.includes("속초") || r.includes("제주") || r.includes("서귀포")) },
];

export default function Venues({ data, update }: Props) {
  const [searchParams] = useSearchParams();
  const starterOpen = searchParams.get("starter") === "1";
  const [tab, setTab] = useState<Tab>(starterOpen ? "catalog" : "mine");
  const [mineView, setMineView] = useState<"list" | "compare">("list");
  const [region, setRegion] = useState<string>("all");
  const [hallFilter, setHallFilter] = useState<VenueHallType | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showGuide, setShowGuide] = useState<VenueHallType | null>(null);
  const [showStarter, setShowStarter] = useState(starterOpen);
  const [selectedMapVenueId, setSelectedMapVenueId] = useState<string | null>(null);

  const myVenues = data.venues ?? [];
  const haveStatusCount: Record<NonNullable<WeddingVenue["status"]>, number> = useMemo(() => {
    const r = { 관심: 0, 투어: 0, 계약: 0 };
    for (const v of myVenues) if (v.status) r[v.status]++;
    return r;
  }, [myVenues]);

  const venueBalances = useMemo(
    () => upcomingBalances(data).filter((b) => b.targetPath === "/venues"),
    [data]
  );
  const headcount = useMemo(() => expectedHeadcount(data), [data]);
  const contracted = useMemo(() => myVenues.find((v) => v.status === "계약"), [myVenues]);
  const tourCount = haveStatusCount["투어"] + haveStatusCount["계약"];
  const contractChecked = contracted ? contractFieldCount(contracted.contract) : 0;
  const venueAgentSummary = myVenues.length === 0
    ? "조건 몇 개만 정하면 상담해볼 후보를 바로 추릴 수 있어요. 먼저 후보를 담고, 그다음 투어와 계약 조건을 따라갑니다."
    : contracted
      ? `${contracted.name}을 계약 후보로 보고 있어요. 이제 청첩장 반영과 결제·취소 조건 기록을 같이 잠가두면 됩니다.`
      : tourCount > 0
        ? "답사/상담 단계까지 왔어요. 이제 견적 기준과 취소·변경 조건을 비교해야 계약 후 흔들리지 않습니다."
        : "후보는 담겼고 아직 상담 후보가 정해지지 않았어요. 한 곳만 투어 상태로 올리면 다음 질문이 훨씬 선명해집니다.";

  const promoteFirstVenueToTour = () => {
    const target = myVenues.find((v) => v.status !== "투어" && v.status !== "계약") ?? myVenues[0];
    if (!target) return;
    updateVenue(target.id, { status: "투어" });
  };

  const filteredCatalog = useMemo(() => {
    const rm = REGION_GROUPS.find((g) => g.key === region)?.match ?? (() => true);
    return VENUE_CATALOG
      .filter((v) => rm(v.region))
      .filter((v) => hallFilter === "all" || v.hallType === hallFilter);
  }, [region, hallFilter]);
  const selectedMapVenue = useMemo(
    () => filteredCatalog.find((v) => v.id === selectedMapVenueId) ?? filteredCatalog[0],
    [filteredCatalog, selectedMapVenueId],
  );

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
    // 직접 추가도 중복 검사 — 같은 식장이 두 줄로 갈라지는 걸 막는다.
    const dup = myVenues.some(
      (x) => x.name.trim().toLowerCase() === v.name.trim().toLowerCase(),
    );
    if (dup) {
      alert(`'${v.name}' 은(는) 이미 내 후보에 있어요.`);
      return;
    }
    update((prev: WeddingData) => ({
      ...prev,
      venues: [...(prev.venues ?? []), { ...v, id: `v-${Date.now()}` }],
    }));
    setShowAdd(false);
  };

  const applyVenueStarter = (picks: WeddingVenue[]) => {
    update((prev: WeddingData) => {
      const names = new Set((prev.venues ?? []).map((v) => v.name));
      const additions = picks
        .filter((v) => !names.has(v.name))
        .map((v) => ({ ...v, id: `v-${Date.now()}-${v.id}`, status: "관심" as const }));
      return { ...prev, venues: [...(prev.venues ?? []), ...additions] };
    });
    setTab("mine");
    setShowStarter(false);
  };

  return (
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-2">장소 찾기</div>
        <h1 className="h-page">예식장</h1>
      </div>

      <ProcessAgentPanel
        title={myVenues.length === 0 ? "후보를 먼저 좁히는 중" : contracted ? "계약 이후 빠질 조건을 확인 중" : "상담 순서를 잡는 중"}
        summary={venueAgentSummary}
        mood={contracted && contractChecked >= 3 ? "ready" : "thinking"}
        metrics={[
          { label: "후보", value: `${myVenues.length}곳`, hint: myVenues.length >= 3 ? "비교 가능" : "3곳 권장" },
          { label: "투어", value: `${tourCount}곳`, tone: tourCount === 0 && myVenues.length > 0 ? "warn" : "normal" },
          { label: "계약 체크", value: contracted ? `${contractChecked}/6` : "대기", tone: contracted && contractChecked < 3 ? "warn" : contracted ? "normal" : "muted" },
        ]}
        steps={[
          { label: "비교할 후보 3곳 담기", detail: "지역·식대·보증인원이 다른 후보를 섞으면 상담 기준이 또렷해져요.", done: myVenues.length >= 3 },
          { label: "첫 답사/상담 후보 정하기", detail: "상태를 ‘투어’로 바꾸면 다음 납부와 상담 메모가 따라옵니다.", done: tourCount > 0 },
          { label: "계약 전 핵심 조건 남기기", detail: "견적 기준, 결제 일정, 취소·변경, 별도 비용을 텍스트로 남겨요.", done: !!contracted && contractChecked >= 3 },
        ]}
        actions={[
          { label: "새 후보 조사해서 추가", onClick: () => setShowAdd(true), tone: myVenues.length === 0 ? "primary" : "quiet" },
          { label: "조건으로 후보 추리기", onClick: () => { setShowStarter(true); setTab("catalog"); }, tone: "primary" },
          ...(myVenues.length > 0 && tourCount === 0 ? [{ label: "첫 후보를 투어로 표시", onClick: promoteFirstVenueToTour }] : []),
          ...(contracted && !data.invitation.venue ? [{ label: "계약 식장을 청첩장에 넣기", onClick: () => applyToInvitation(contracted), tone: "primary" as const }] : []),
          { label: "카탈로그 열기", onClick: () => setTab("catalog") },
        ]}
      />

      {showStarter ? (
        <VenueStarter onApply={applyVenueStarter} onClose={() => setShowStarter(false)} />
      ) : (
        <>
          {/* 탭 */}
          <div className="flex items-center gap-6 border-b border-hair pb-3">
            <button
              onClick={() => setTab("mine")}
              className={`tracking-wide ${tab === "mine" ? "seg-active" : "seg"}`}
            >
              내 후보 · <span className="tabular-nums">{myVenues.length}</span>
            </button>
            <button
              onClick={() => setTab("catalog")}
              className={`tracking-wide ${tab === "catalog" ? "seg-active" : "seg"}`}
            >
              카탈로그 · <span className="tabular-nums">{VENUE_CATALOG.length}</span>
            </button>
          </div>

          <button
            onClick={() => setShowStarter(true)}
            className="w-full text-left border-y border-hair py-4 flex items-baseline justify-between gap-4"
          >
            <span>
              <span className="eyebrow block mb-1">기본 후보</span>
              <span className="font-serif text-[18px] text-ink break-keep">예식장 기준 잡기</span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
          </button>

          {tab === "mine" && (
            <>
              {/* 진척도 */}
              <div className="flex items-baseline gap-6 text-[12px] border-b border-hair pb-3">
                <span className="eyebrow">진척도</span>
                <span><span className="tabular-nums text-ink">{haveStatusCount["관심"]}</span> <span className="text-soft">관심</span></span>
                <span><span className="tabular-nums text-ink">{haveStatusCount["투어"]}</span> <span className="text-soft">투어</span></span>
                <span className="ml-auto"><span className="tabular-nums text-gold">{haveStatusCount["계약"]}</span> <span className="text-soft">계약</span></span>
              </div>

              {venueBalances.length > 0 && (
                <div className="border-y border-hair py-4">
                  <div className="eyebrow mb-3">다음 납부</div>
                  <ul className="space-y-2">
                    {venueBalances.slice(0, 3).map((b) => (
                      <li
                        key={b.name}
                        className="flex items-baseline justify-between gap-4 text-[13px]"
                      >
                        <span className="text-ink break-keep">
                          {b.name} <span className="text-soft">잔금</span>{" "}
                          <span className="tabular-nums">{formatKRW(b.amount)}</span>
                        </span>
                        <span
                          className={`tabular-nums whitespace-nowrap flex-shrink-0 ${
                            b.daysLeft <= 14 ? "text-gold" : "text-soft"
                          }`}
                        >
                          {dDayLabel(b.daysLeft)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-baseline justify-between">
                <h2 className="eyebrow">내 후보</h2>
                <button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
                  + 직접 추가
                </button>
              </div>

              {myVenues.length === 0 ? (
                <div className="py-10 text-center text-soft text-[13px] border-y border-hair">
                  아직 담아둔 식장이 없어요.<br />
                  <button onClick={() => setTab("catalog")} className="mt-3 text-ink underline underline-offset-4 hover:text-gold text-[13px]">
                    카탈로그에서 골라 담기 →
                  </button>
                </div>
              ) : (
                <>
                  {myVenues.length >= 2 && (
                    <div className="flex items-center gap-6 border-b border-hair pb-3">
                      <button
                        onClick={() => setMineView("list")}
                        className={`tracking-wide ${mineView === "list" ? "seg-active" : "seg"}`}
                      >
                        목록
                      </button>
                      <button
                        onClick={() => setMineView("compare")}
                        className={`tracking-wide ${mineView === "compare" ? "seg-active" : "seg"}`}
                      >
                        나란히 비교
                      </button>
                    </div>
                  )}
                  {mineView === "compare" && myVenues.length >= 2 ? (
                    <VenueCompare venues={myVenues} />
                  ) : (
                    <ul className="divide-y divide-hair border-y border-hair">
                      {myVenues.map((v) => (
                        <MyVenueRow
                          key={v.id}
                          v={v}
                          registered={!!v.name.trim() && v.name.trim() === (data.invitation.venue ?? "").trim()}
                          headcount={headcount}
                          balance={venueBalances.find((b) => b.name === v.name)}
                          onUpdate={(patch) => updateVenue(v.id, patch)}
                          onRemove={() => removeVenue(v.id)}
                          onApply={() => applyToInvitation(v)}
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}

          {tab === "catalog" && (
            <>
              {/* 골라 담기 안내 — 카탈로그가 '고르는 곳'임을 또렷이 */}
              <div className="border-y border-hair py-4">
                <div className="eyebrow-gold mb-1.5">골라 담기</div>
                <p className="font-serif text-[17px] text-ink leading-snug break-keep">
                  마음에 드는 곳을 담으면 <span className="text-gold">‘내 후보’</span>에서 비교돼요
                </p>
                <p className="mt-2 text-[12px] text-soft leading-relaxed">
                  {VENUE_PRICE_NOTE}<br />
                  최신 확인일이 없는 항목은 출발점으로만 보고, 공식 채널에서 다시 확인하세요. Dearie는 식장과 제휴·광고 관계가 없습니다.
                </p>
              </div>

              {/* 홀 형식 필터 */}
              <div className="flex gap-5 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
                <button
                  onClick={() => setHallFilter("all")}
                  className={`tracking-wide whitespace-nowrap ${hallFilter === "all" ? "seg-active" : "seg"}`}
                >
                  전체
                </button>
                {(Object.keys(HALL_TYPE_LABEL) as VenueHallType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setHallFilter(t)}
                    className={`tracking-wide whitespace-nowrap ${hallFilter === t ? "seg-active" : "seg"}`}
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
                    className={`tracking-wide whitespace-nowrap ${region === g.key ? "seg-active" : "seg"}`}
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

              {filteredCatalog.length > 0 && selectedMapVenue && (
                <VenueMapExplorer
                  venues={filteredCatalog}
                  selected={selectedMapVenue}
                  addedNames={new Set(myVenues.map((v) => v.name))}
                  onSelect={(v) => setSelectedMapVenueId(v.id)}
                  onAdd={addFromCatalog}
                />
              )}

              {/* 결과 */}
              {filteredCatalog.length === 0 ? (
                <p className="text-center text-[13px] text-soft py-8">
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

              <p className="text-[11px] text-soft text-center leading-relaxed pt-2">
                가격 범위는 공개 정보 추정치 — 시즌·요일·메뉴별 변동 큼. 최종 결정 전 직접 문의 필수.<br />
                표시 삭제·정정 요청은{" "}
                <a href="mailto:yclee913@gmail.com" rel="noopener noreferrer" className="underline underline-offset-2 text-ink">yclee913@gmail.com</a>
                {" "}으로.
              </p>
            </>
          )}
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
              <div className="pl-4 border-l-2 border-gold/50 text-[13px] text-soft leading-relaxed">
                {g.tip}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function VenueStarter({
  onApply,
  onClose,
}: {
  onApply: (picks: WeddingVenue[]) => void;
  onClose: () => void;
}) {
  const [area, setArea] = useState("gangnam");
  const [hallType, setHallType] = useState<VenueHallType | "all">("all");
  const [guestBand, setGuestBand] = useState<"small" | "medium" | "large">("medium");
  const [mealMax, setMealMax] = useState<"any" | "8" | "12" | "16">("12");

  const picks = useMemo(
    () => pickStarterVenues({ area, hallType, guestBand, mealMax }),
    [area, hallType, guestBand, mealMax]
  );

  return (
    <section className="border-y border-hair py-5 space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">기본 후보</div>
          <h2 className="font-serif text-[18px] text-ink break-keep">예식장 기준 잡기</h2>
        </div>
        <button onClick={onClose} className="text-[12px] text-soft underline underline-offset-4 hover:text-ink">
          닫기
        </button>
      </div>

      <p className="text-[12px] text-soft leading-relaxed">
        지역·하객 수·식대 기준으로 먼저 문의할 식장을 잡습니다. 식대·보증인원·대관 조건은 상담 때 다시 확인해야 합니다.
      </p>

      <StarterOption label="지역">
        {REGION_GROUPS.filter((g) => g.key !== "etc").map((g) => (
          <Segment key={g.key} active={area === g.key} onClick={() => setArea(g.key)}>
            {g.label}
          </Segment>
        ))}
      </StarterOption>

      <StarterOption label="홀 분위기">
        <Segment active={hallType === "all"} onClick={() => setHallType("all")}>상관없음</Segment>
        {(Object.keys(HALL_TYPE_LABEL) as VenueHallType[]).map((t) => (
          <Segment key={t} active={hallType === t} onClick={() => setHallType(t)}>
            {HALL_TYPE_LABEL[t]}
          </Segment>
        ))}
      </StarterOption>

      <StarterOption label="예상 하객">
        <Segment active={guestBand === "small"} onClick={() => setGuestBand("small")}>120명 이하</Segment>
        <Segment active={guestBand === "medium"} onClick={() => setGuestBand("medium")}>120~250명</Segment>
        <Segment active={guestBand === "large"} onClick={() => setGuestBand("large")}>250명 이상</Segment>
      </StarterOption>

      <StarterOption label="식대 상한">
        <Segment active={mealMax === "any"} onClick={() => setMealMax("any")}>상관없음</Segment>
        <Segment active={mealMax === "8"} onClick={() => setMealMax("8")}>8만원대</Segment>
        <Segment active={mealMax === "12"} onClick={() => setMealMax("12")}>12만원대</Segment>
        <Segment active={mealMax === "16"} onClick={() => setMealMax("16")}>16만원대</Segment>
      </StarterOption>

      <div className="border-y border-hair divide-y divide-hair">
        {picks.map((venue, idx) => (
          <div key={venue.id} className="py-3 flex items-start gap-3">
            <span className="font-serif text-soft text-base tabular-nums w-5 flex-shrink-0">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-[15px] text-ink">{venue.name}</div>
              <div className="text-[12px] text-soft leading-relaxed mt-1">
                {[venue.region, venue.hallType ? HALL_TYPE_LABEL[venue.hallType] : undefined, venue.foodType ? FOOD_TYPE_LABEL[venue.foodType] : undefined].filter(Boolean).join(" · ")}
              </div>
              <div className="eyebrow mt-2">
                하객 {formatCapacity(venue)}
                {(venue.mealPriceMin || venue.mealPriceMax) && (
                  <span> · 식대 {formatMealPrice(venue)}</span>
                )}
              </div>
              <div className="text-[11px] text-soft mt-1">{venueSourceLabel(venue)}</div>
            </div>
          </div>
        ))}
        {picks.length === 0 && (
          <p className="py-4 text-[12px] text-soft leading-relaxed">
            조건에 맞는 후보가 없습니다. 지역이나 식대 조건을 조금 넓혀보세요.
          </p>
        )}
      </div>

      <button
        onClick={() => onApply(picks)}
        disabled={picks.length === 0}
        className="btn-primary w-full py-3 text-[13px] disabled:opacity-40"
      >
        후보 {picks.length}곳 담기 →
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

function pickStarterVenues({
  area,
  hallType,
  guestBand,
  mealMax,
}: {
  area: string;
  hallType: VenueHallType | "all";
  guestBand: "small" | "medium" | "large";
  mealMax: "any" | "8" | "12" | "16";
}): WeddingVenue[] {
  const areaMatch = REGION_GROUPS.find((g) => g.key === area)?.match ?? (() => true);
  const maxMeal = mealMax === "any" ? Infinity : Number(mealMax) * 10_000;
  return VENUE_CATALOG.map((venue) => {
    let score = 0;
    if (areaMatch(venue.region)) score += 4;
    if (hallType === "all" || venue.hallType === hallType) score += 4;
    if (matchesGuestBand(venue, guestBand)) score += 3;
    if (!venue.mealPriceMin || venue.mealPriceMin <= maxMeal) score += 3;
    return { venue, score };
  })
    .filter(({ venue, score }) => {
      if (score < 7) return false;
      if (hallType !== "all" && venue.hallType !== hallType) return false;
      if (mealMax !== "any" && venue.mealPriceMin && venue.mealPriceMin > maxMeal + 20_000) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score || (a.venue.mealPriceMin ?? 0) - (b.venue.mealPriceMin ?? 0))
    .slice(0, 4)
    .map(({ venue }) => venue);
}

function matchesGuestBand(venue: WeddingVenue, band: "small" | "medium" | "large"): boolean {
  const min = venue.capacityMin ?? 0;
  const max = venue.capacityMax ?? 999;
  if (band === "small") return min <= 120 && max >= 80;
  if (band === "medium") return min <= 220 && max >= 150;
  return max >= 250;
}

function VenueMapExplorer({
  venues,
  selected,
  addedNames,
  onSelect,
  onAdd,
}: {
  venues: WeddingVenue[];
  selected: WeddingVenue;
  addedNames: Set<string>;
  onSelect: (venue: WeddingVenue) => void;
  onAdd: (venue: WeddingVenue) => void;
}) {
  const selectedQuery = [selected.name, selected.region].filter(Boolean).join(" ");
  const added = addedNames.has(selected.name);
  const previewVenues = venues.slice(0, 24);
  const selectedSourceUrl = safeHref(selected.source);

  return (
    <section className="border-y border-hair py-4 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow-gold mb-1.5">지도 훑기</div>
          <h2 className="font-serif text-[17px] text-ink break-keep">위치 감을 먼저 보고 후보를 담아요</h2>
        </div>
        <span className="eyebrow tabular-nums whitespace-nowrap">{venues.length}곳</span>
      </div>

      <MapEmbed query={selectedQuery} heightClass="h-56" label={`${selected.name} 지도`} />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="font-serif text-[15px] text-ink truncate">{selected.name}</div>
            <div className="eyebrow mt-1 space-x-2">
              {selected.region && <span>{selected.region}</span>}
              {selected.hallType && <span>· {HALL_TYPE_LABEL[selected.hallType]}</span>}
            </div>
            <div className="text-[11px] text-soft mt-1">{venueSourceLabel(selected)}</div>
          </div>
          <button
            onClick={() => onAdd(selected)}
            disabled={added}
            className={`min-h-9 px-3 text-[12px] tracking-wide whitespace-nowrap flex-shrink-0 border transition ${added ? "border-hair text-soft" : "border-gold text-gold hover:bg-gold hover:text-paper"}`}
          >
            {added ? "✓ 담음" : "+ 담기"}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <MapSearchLink label="카카오맵" url={kakaoMapSearchUrl(selectedQuery)} />
          <MapSearchLink label="네이버지도" url={naverMapSearchUrl(selectedQuery)} />
          <MapSearchLink label="구글지도" url={googleMapSearchUrl(selectedQuery)} />
          {selectedSourceUrl && <MapSearchLink label="출처" url={selectedSourceUrl} />}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-6 px-6 pb-1 scrollbar-hide">
        {previewVenues.map((venue) => {
          const active = venue.id === selected.id;
          return (
            <button
              key={venue.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(venue)}
              className={`min-w-[144px] max-w-[180px] flex-shrink-0 border px-3 py-2 text-left transition ${
                active ? "border-gold bg-gold/5" : "border-hair bg-paper hover:border-ink"
              }`}
            >
              <span className="block text-[12.5px] text-ink truncate">{venue.name}</span>
              <span className="mt-1 block eyebrow truncate">{venue.region ?? "지역 확인"}</span>
            </button>
          );
        })}
      </div>

      {venues.length > previewVenues.length && (
        <p className="text-[11.5px] text-soft leading-relaxed">
          먼저 {previewVenues.length}곳만 지도 선택지로 보여줘요. 지역이나 홀 형식을 좁히면 나머지도 바로 올라옵니다.
        </p>
      )}
    </section>
  );
}

function MapSearchLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center justify-center border border-hair bg-paper px-3 text-[11.5px] tracking-wide text-soft transition hover:border-ink hover:text-ink active:opacity-70"
    >
      {label}
    </a>
  );
}

function kakaoMapSearchUrl(query: string): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
}

function naverMapSearchUrl(query: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

function googleMapSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
          <div className="text-[12px] text-soft mt-1.5 tabular-nums">
            {(v.capacityMin || v.capacityMax) && (
              <>하객 {formatCapacity(v)} </>
            )}
            {(v.mealPriceMin || v.mealPriceMax) && (
              <span>· 식대 {formatMealPrice(v)}</span>
            )}
          </div>
          <div className="text-[11px] text-soft mt-1">{venueSourceLabel(v)}</div>
          {v.notes && (
            <div className="text-[12px] text-soft mt-1 italic leading-relaxed">{v.notes}</div>
          )}
          <div className="mt-2">
            <FreshnessBadge lastVerified={v.lastVerified} />
          </div>
        </div>
        <button
          onClick={onAdd}
          disabled={added}
          className={`min-h-9 px-3 text-[12px] tracking-wide whitespace-nowrap flex-shrink-0 border transition ${added ? "border-hair text-soft" : "border-gold text-gold hover:bg-gold hover:text-paper"}`}
        >
          {added ? "✓ 담음" : "+ 담기"}
        </button>
      </div>
      <div className="mt-2">
        <VendorActions name={v.name} region={v.region} officialUrl={v.link} sourceUrl={v.source} />
      </div>
    </li>
  );
}

function VenueResearchInput({
  venue,
  onUpdate,
  defaultOpen = false,
  applyLabel,
}: {
  venue: Partial<WeddingVenue>;
  onUpdate: (patch: Partial<WeddingVenue>) => void;
  defaultOpen?: boolean;
  applyLabel?: string;
}) {
  const [draft, setDraft] = useState<VenueResearchDraft>(() => emptyVenueResearchDraft(venue));
  return (
    <ResearchInputPanel
      title="조사 입력"
      subtitle="상담·홈페이지·직접 조사 내용을 구조화합니다."
      rawPlaceholder={
        "예: 보증 250명 / 최대 500명 / 식대 13~16만원 / 뷔페 / 계약금 100만원 / 잔금 D-7 / 별도 봉사료 있음 / 확인일 2026.06.29 / 출처 URL"
      }
      draft={draft}
      sections={VENUE_RESEARCH_SECTIONS}
      onDraftChange={setDraft}
      onParse={parseVenueResearchText}
      onApply={() => onUpdate(venueResearchDraftToPatch(draft))}
      applyLabel={applyLabel}
      defaultOpen={defaultOpen}
    />
  );
}

function MyVenueRow({
  v, registered, headcount, balance, onUpdate, onRemove, onApply,
}: {
  v: WeddingVenue;
  registered?: boolean;
  headcount: number;
  balance?: BalanceDue;
  onUpdate: (patch: Partial<WeddingVenue>) => void;
  onRemove: () => void;
  onApply: () => void;
}) {
  const [open, setOpen] = useState(false);
  const updateContract = (patch: Partial<ContractCheck>) => {
    onUpdate({ contract: cleanContract({ ...(v.contract ?? {}), ...patch }) });
  };
  const fit = venueCapacityFit(v, headcount);
  const showDDay =
    v.status === "계약" && (v.balanceKRW ?? 0) > 0 && !!v.balanceDueAt && !!balance;
  return (
    <li className="py-5">
      <div className="flex items-baseline justify-between gap-3">
        <button onClick={() => setOpen((o) => !o)} className="flex-1 min-w-0 text-left">
          <div className="font-serif text-[15px] text-ink">{v.name}</div>
          <div className="eyebrow mt-1 space-x-2">
            {v.region && <span>{v.region}</span>}
            {v.hallType && <span>· {HALL_TYPE_LABEL[v.hallType]}</span>}
            {v.status && <span className="text-gold">· {v.status}</span>}
            {registered && <span className="text-sage">· ✓ 청첩장 등록</span>}
            {fit !== "unknown" && (
              <span className={CAPACITY_FIT_TONE[fit]}>· {CAPACITY_FIT_LABEL[fit]}</span>
            )}
            {showDDay && (
              <span className="text-gold tabular-nums">· {dDayLabel(balance!.daysLeft)}</span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[11.5px] leading-relaxed text-soft tabular-nums">
            {(v.capacityMin || v.capacityMax) && <span>하객 {formatCapacity(v)}</span>}
            {(v.mealPriceMin || v.mealPriceMax) && <span>식대 {formatMealPrice(v)}</span>}
            <span>{venueSourceLabel(v)}</span>
          </div>
        </button>
        <button onClick={onRemove} aria-label={`${v.name} 삭제`} className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center text-soft hover:text-ink text-sm">×</button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-hair space-y-4">
          <div className="flex items-baseline gap-5">
            <span className="eyebrow">상태</span>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onUpdate({ status: s })}
                className={`tracking-wide ${v.status === s ? "seg-active" : "seg"}`}
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

          <VenueResearchInput venue={v} onUpdate={onUpdate} />

          <div>
            <label className="label">자유 메모</label>
            <textarea
              className="input-boxed text-[13px] min-h-[60px]"
              value={v.notes ?? ""}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="예: 토요일 12시 13만원, 보증 250명, 평일 12만원 가능"
            />
          </div>

          {/* 계약 관리 — 담당자 연락처·계약금·잔금 */}
          <div className="pt-4 border-t border-hair space-y-4">
            <div className="eyebrow-gold">계약 관리</div>

            {(v.depositKRW ?? 0) > 0 && (v.balanceKRW ?? 0) > 0 && v.balanceDueAt && (
              <div className="text-[13px] text-soft tabular-nums break-keep border-b border-hair pb-3">
                <span className="text-ink">선금 {formatKRW(v.depositKRW!)}</span>
                {" · "}
                <span className="text-ink">잔금 {formatKRW(v.balanceKRW!)}</span>
                {" · "}
                잔금일 {v.balanceDueAt.slice(0, 10)}
              </div>
            )}

            <div>
              <label className="label">담당자·업체 연락처</label>
              <input
                type="text"
                className="input text-[13px]"
                value={v.contact ?? ""}
                onChange={(e) => onUpdate({ contact: e.target.value || undefined })}
                placeholder="예: 김실장 010-0000-0000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">계약금 (원)</label>
                <input
                  type="number"
                  min={0}
                  className="input text-[13px] tabular-nums"
                  value={v.depositKRW ?? ""}
                  onChange={(e) => onUpdate({ depositKRW: parseWon(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="label">잔금 (원)</label>
                <input
                  type="number"
                  min={0}
                  className="input text-[13px] tabular-nums"
                  value={v.balanceKRW ?? ""}
                  onChange={(e) => onUpdate({ balanceKRW: parseWon(e.target.value) })}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="label">잔금 납부일</label>
              <input
                type="date"
                className="input text-[13px]"
                value={v.balanceDueAt ?? ""}
                onChange={(e) => onUpdate({ balanceDueAt: e.target.value || undefined })}
              />
            </div>
          </div>

          <ContractFields contract={v.contract} onUpdate={updateContract} />

          <MapEmbed query={[v.name, v.region].filter(Boolean).join(" ")} label={`${v.name} 지도`} />

          <VendorActions name={v.name} region={v.region} officialUrl={v.link} sourceUrl={v.source} />

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

function ContractFields({
  contract,
  onUpdate,
}: {
  contract?: ContractCheck;
  onUpdate: (patch: Partial<ContractCheck>) => void;
}) {
  return (
    <details className="border-y border-hair py-3">
      <summary className="cursor-pointer list-none flex items-baseline justify-between gap-4">
        <span>
          <span className="eyebrow-gold block mb-1">계약 체크</span>
          <span className="text-[12px] text-soft">{contractProgress(contract)} · 확인한 것만 적어두세요</span>
        </span>
        <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-[11.5px] text-soft leading-relaxed">
          모든 칸을 채울 필요는 없어요. 나중에 분쟁이 생기거나 가족과 공유할 때 헷갈리기 쉬운 조건만 남기면 충분합니다.
        </p>
        {CONTRACT_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="label">{field.label}</label>
            <textarea
              className="input-boxed text-[12.5px] min-h-[44px]"
              value={contract?.[field.key] ?? ""}
              onChange={(e) => onUpdate({ [field.key]: e.target.value } as Partial<ContractCheck>)}
              placeholder={field.placeholder}
            />
          </div>
        ))}
      </div>
    </details>
  );
}

function contractProgress(contract?: ContractCheck): string {
  const count = contractFieldCount(contract);
  return `확인 ${count}/${CONTRACT_FIELDS.length}`;
}

function contractFieldCount(contract?: ContractCheck): number {
  return CONTRACT_FIELDS.filter((field) => contract?.[field.key]?.trim()).length;
}

function cleanContract(contract: ContractCheck): ContractCheck | undefined {
  const next = Object.fromEntries(
    Object.entries(contract)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter(([, value]) => Boolean(value))
  ) as ContractCheck;
  return Object.keys(next).length > 0 ? next : undefined;
}

// 담아둔 식장 후보를 한눈에 — 식대·인원·상태를 나란히 놓고 비교한다.
// 모바일 폭(480px)에선 식장 수가 늘면 가로 스크롤, 항목 라벨 열은 고정.
function VenueCompare({ venues }: { venues: WeddingVenue[] }) {
  const rows: { label: string; get: (v: WeddingVenue) => string }[] = [
    { label: "지역", get: (v) => v.region || "—" },
    { label: "홀 형식", get: (v) => (v.hallType ? HALL_TYPE_LABEL[v.hallType] : "—") },
    { label: "음식", get: (v) => (v.foodType ? FOOD_TYPE_LABEL[v.foodType] : "—") },
    {
      label: "수용 인원",
      get: (v) =>
        v.capacityMin || v.capacityMax ? formatCapacity(v) : "—",
    },
    {
      label: "식대",
      get: (v) =>
        v.mealPriceMin || v.mealPriceMax ? formatMealPrice(v) : "—",
    },
    { label: "출처", get: venueSourceLabel },
    { label: "상태", get: (v) => v.status || "—" },
    { label: "답사일", get: (v) => v.visitedAt || "—" },
    { label: "계약 체크", get: (v) => contractProgress(v.contract) },
  ];
  // 위치 비교용 — 이름·지역이 있는 후보만 지도 노출. 멀리 떨어진 후보를 한 화면에서 가늠.
  const mappable = venues.filter((v) => [v.name, v.region].filter(Boolean).join(" ").trim());
  return (
    <div className="space-y-5">
    <div className="overflow-x-auto -mx-6 px-6 scrollbar-hide">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 bg-paper z-10 w-[64px]" />
            {venues.map((v) => (
              <th key={v.id} className="text-left align-bottom px-3 pb-3 min-w-[116px]">
                <span className="font-serif text-[14px] text-ink leading-tight">{v.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hair border-t border-hair">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="sticky left-0 bg-paper z-10 eyebrow py-3 pr-3 align-top whitespace-nowrap">
                {row.label}
              </td>
              {venues.map((v) => (
                <td
                  key={v.id}
                  className={`py-3 px-3 text-[13px] align-top whitespace-nowrap ${
                    row.label === "상태" && v.status === "계약" ? "text-gold" : "text-ink/90"
                  }`}
                >
                  {row.get(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {mappable.length > 0 && (
      <div>
        <div className="eyebrow mb-2">위치 비교</div>
        <div className="flex gap-3 overflow-x-auto -mx-6 px-6 scrollbar-hide">
          {mappable.map((v) => (
            <div key={v.id} className="w-[200px] flex-shrink-0">
              <div className="text-[12px] text-ink truncate mb-1.5 break-keep">{v.name}</div>
              <MapEmbed
                query={[v.name, v.region].filter(Boolean).join(" ")}
                heightClass="h-32"
                label={`${v.name} 지도`}
              />
            </div>
          ))}
        </div>
      </div>
    )}
    </div>
  );
}

function CustomAdd({ onAdd }: { onAdd: (v: Omit<WeddingVenue, "id">) => void }) {
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [draft, setDraft] = useState<VenueResearchDraft>(() => emptyVenueResearchDraft());
  const submit = () => {
    if (!name.trim()) return;
    const patch = venueResearchDraftToPatch(draft);
    onAdd({
      name: name.trim(),
      link: link.trim() || undefined,
      status: "관심",
      ...patch,
    });
    setName("");
    setLink("");
    setDraft(emptyVenueResearchDraft());
  };
  return (
    <div className="space-y-4">
      <input className="input text-[13px]" placeholder="식장 이름" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input text-[13px]" placeholder="홈페이지·예약 링크 (선택)" value={link} onChange={(e) => setLink(e.target.value)} />
      <ResearchInputPanel
        title="조사 입력"
        subtitle="알아낸 내용을 붙여넣으면 비교표와 계약 체크에 맞게 정리합니다."
        rawPlaceholder={
          "예: 청담 / 호텔 / 보증 250명 / 최대 500명 / 식대 13~16만원 / 계약금 100만원 / 포함 생화·주차 / 출처 URL"
        }
        draft={draft}
        sections={VENUE_RESEARCH_SECTIONS}
        onDraftChange={setDraft}
        onParse={parseVenueResearchText}
        onApply={submit}
        applyLabel="후보 추가 →"
        applyDisabled={!name.trim()}
        applyHint="식장 이름을 먼저 적어주세요."
        defaultOpen
      />
    </div>
  );
}

// 수용 여유도 칩 — venueCapacityFit 결과를 한 줄 라벨/톤으로. gold 는 초과·미달(주의)만.
const CAPACITY_FIT_LABEL: Record<Exclude<ReturnType<typeof venueCapacityFit>, "unknown">, string> = {
  under: "보증인원 미달",
  tight: "수용 근접",
  ok: "수용 여유",
  over: "인원 초과",
};
const CAPACITY_FIT_TONE: Record<Exclude<ReturnType<typeof venueCapacityFit>, "unknown">, string> = {
  under: "text-gold",
  tight: "text-soft",
  ok: "text-soft",
  over: "text-gold",
};

// 잔금일까지의 D-day 라벨 — daysLeft 는 upcomingBalances 가 계산한 값(음수=지남).
function dDayLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft}일 지남`;
  if (daysLeft === 0) return "오늘";
  return `D-${daysLeft}`;
}

function fmtMan(n?: number): string {
  if (!n) return "?";
  return Math.round(n / 10000).toString();
}

function formatCapacity(v: WeddingVenue): string {
  const min = v.capacityMin;
  const max = v.capacityMax;
  if (min && max) return min === max ? `${max}명` : `${min}~${max}명`;
  if (max) return `최대 ${max}명`;
  if (min) return `${min}명 이상`;
  return "직접 확인";
}

function formatMealPrice(v: WeddingVenue): string {
  const min = v.mealPriceMin;
  const max = v.mealPriceMax;
  if (min && max) return min === max ? `${fmtMan(min)}만원` : `${fmtMan(min)}~${fmtMan(max)}만원`;
  if (min) return `${fmtMan(min)}만원부터`;
  if (max) return `최대 ${fmtMan(max)}만원`;
  return "직접 확인";
}

function venueSourceLabel(v: WeddingVenue): string {
  const hasCapacity = Boolean(v.capacityMin || v.capacityMax);
  const capacity =
    v.capacitySource === "official" ? "수용 공식"
    : v.capacitySource === "public" ? "수용 공개정보"
    : v.capacitySource === "user" ? "수용 내 조사"
    : v.capacitySource === "mixed" ? "수용 일부 공식"
    : v.capacitySource === "estimate" ? "수용 추정"
    : hasCapacity ? "수용 추정"
    : "수용 직접 확인";
  const meal =
    v.mealPriceSource === "official" ? "식대 공식"
    : v.mealPriceSource === "public" ? "식대 공개정보"
    : v.mealPriceSource === "user" ? "식대 내 조사"
    : v.mealPriceSource === "estimate" || v.mealPriceMin || v.mealPriceMax ? "식대 추정"
    : "식대 직접 확인";
  return `${capacity} · ${meal}`;
}

// 금액 입력 파싱 (원 단위) — 빈 칸은 undefined, "0"은 0 유지, 음수·비정상값은 거부.
// Budget.tsx 의 parseAmount 와 동일한 규약: 입력값을 원(KRW) 그대로 저장.
function parseWon(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}
