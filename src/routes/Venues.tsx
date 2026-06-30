import { useState, useMemo, useEffect, useRef } from "react";
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
import DearieConfirmModal from "../components/DearieConfirmModal";
import FreshnessBadge from "../components/FreshnessBadge";
import { AgentIdentity } from "../components/AgentIdentity";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import SectionConsultationPanel from "../components/SectionConsultationPanel";
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
type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const [venueNotice, setVenueNotice] = useState("");
  const starterRef = useRef<HTMLDivElement | null>(null);

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
    ? "지역, 하객, 분위기, 우선순위만 답하면 Dearie가 공개 카탈로그에서 상담 후보를 먼저 좁혀둘게요. 제휴 추천이 아니라 출발점으로만 씁니다."
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

  useEffect(() => {
    if (!showStarter) return;
    window.requestAnimationFrame(() => {
      starterRef.current?.scrollIntoView({ block: "start" });
    });
  }, [showStarter]);

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
    setConfirmDialog({
      title: "청첩장에 이 식장을 넣을까요?",
      body: `${v.name}을 청첩장 예식장으로 넣고, 주소가 비어 있으면 지역 정보도 함께 채웁니다.`,
      confirmLabel: "청첩장에 넣기",
      onConfirm: () => {
        update((prev: WeddingData) => ({
          ...prev,
          invitation: {
            ...prev.invitation,
            venue: v.name,
            venueAddress: prev.invitation.venueAddress || v.region,
          },
        }));
        setVenueNotice("청첩장에 예식장을 반영했어요.");
      },
    });
  };

  const addCustom = (v: Omit<WeddingVenue, "id">) => {
    // 직접 추가도 중복 검사 — 같은 식장이 두 줄로 갈라지는 걸 막는다.
    const dup = myVenues.some(
      (x) => x.name.trim().toLowerCase() === v.name.trim().toLowerCase(),
    );
    if (dup) {
      setVenueNotice(`${v.name}은 이미 내 후보에 있어요.`);
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
        title={myVenues.length === 0 ? "예식장 조건을 먼저 물어볼게요" : contracted ? "계약 이후 빠질 조건을 확인 중" : "상담 순서를 잡는 중"}
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
          { label: "Dearie와 후보 좁히기", onClick: () => { setShowStarter(true); setTab("catalog"); }, tone: "primary" },
          { label: "새 후보 직접 추가", onClick: () => setShowAdd(true), tone: "quiet" },
          ...(myVenues.length > 0 && tourCount === 0 ? [{ label: "첫 후보를 투어로 표시", onClick: promoteFirstVenueToTour }] : []),
          ...(contracted && !data.invitation.venue ? [{ label: "계약 식장을 청첩장에 넣기", onClick: () => applyToInvitation(contracted), tone: "primary" as const }] : []),
          { label: "카탈로그 열기", onClick: () => setTab("catalog") },
        ]}
      />

      {!showStarter && <SectionConsultationPanel sectionId="venues" data={data} update={update} />}

      {venueNotice && (
        <div className="anim-fade border-y border-hair py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] leading-relaxed text-soft">
              <span className="font-semibold text-ink">Dearie</span> · {venueNotice}
            </p>
            <button
              type="button"
              onClick={() => setVenueNotice("")}
              className="min-h-11 min-w-11 text-soft hover:text-ink"
              aria-label="안내 닫기"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showStarter ? (
        <div ref={starterRef}>
          <VenueStarter onApply={applyVenueStarter} onClose={() => setShowStarter(false)} />
        </div>
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
              <span className="eyebrow block mb-1">Dearie 질문</span>
              <span className="font-serif text-[18px] text-ink break-keep">조건 답하고 후보 좁히기</span>
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
      <DearieConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title ?? ""}
        body={confirmDialog?.body ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "확인"}
        onClose={() => setConfirmDialog(null)}
        onConfirm={async () => { await confirmDialog?.onConfirm(); }}
      />
    </div>
  );
}

type VenueAgentAnswerKey = "area" | "scale" | "mood" | "priority";
type VenueAgentArea = "seoul" | "gangnam" | "central" | "han" | "gyeonggi" | "local";
type VenueAgentScale = "small" | "medium" | "large" | "unknown";
type VenueAgentMood = "hotel" | "chapel" | "bright" | "convention" | "flexible";
type VenueAgentPriority = "meal" | "traffic" | "privacy" | "contract";
type VenueAgentAnswers = Partial<{
  area: VenueAgentArea;
  scale: VenueAgentScale;
  mood: VenueAgentMood;
  priority: VenueAgentPriority;
}>;
type VenueAgentOption = { id: string; label: string; detail: string };
type VenueAgentQuestion = {
  id: VenueAgentAnswerKey;
  eyebrow: string;
  title: string;
  helper: string;
  options: VenueAgentOption[];
};

const VENUE_AGENT_STEP_LABELS: Record<VenueAgentAnswerKey, string> = {
  area: "지역",
  scale: "하객",
  mood: "분위기",
  priority: "우선순위",
};

const VENUE_AGENT_QUESTIONS: VenueAgentQuestion[] = [
  {
    id: "area",
    eyebrow: "첫 질문",
    title: "가장 먼저 볼 지역은 어디에 가까울까요?",
    helper: "처음부터 전 지역을 펼치면 비교가 흐려져요. 이동 동선이 맞는 권역 하나를 먼저 잡겠습니다.",
    options: [
      { id: "seoul", label: "서울 전체", detail: "강남·중구·한남·기타 서울권을 넓게 보기" },
      { id: "gangnam", label: "강남·청담권", detail: "강남, 청담, 논현, 반포, 서초 주변" },
      { id: "central", label: "광화문·중구권", detail: "광화문, 시청, 소공, 장충, 종로 주변" },
      { id: "han", label: "한남·여의도·잠실권", detail: "용산, 여의도, 송파, 강변 동선" },
      { id: "gyeonggi", label: "경기·인천권", detail: "분당, 일산, 송도, 수원까지 넓히기" },
      { id: "local", label: "지방·리조트권", detail: "부산, 대구, 대전, 광주, 제주 등" },
    ],
  },
  {
    id: "scale",
    eyebrow: "두 번째",
    title: "예상 하객은 어느 정도로 잡을까요?",
    helper: "보증 인원이 맞지 않으면 상담이 길어져요. 대략값이어도 먼저 잡아두는 편이 좋습니다.",
    options: [
      { id: "small", label: "120명 이하", detail: "가족·가까운 지인 중심의 작은 예식" },
      { id: "medium", label: "120~250명", detail: "양가 친척과 친구·직장 일부까지" },
      { id: "large", label: "250명 이상", detail: "넓은 홀과 회전 운영을 먼저 확인" },
      { id: "unknown", label: "아직 모르겠어요", detail: "인원은 열어두고 다른 조건부터 좁히기" },
    ],
  },
  {
    id: "mood",
    eyebrow: "세 번째",
    title: "원하는 홀 분위기는 어느 쪽인가요?",
    helper: "분위기는 취향이지만, 투어 동선을 크게 좌우합니다. 상담 전에 한 축만 정해둘게요.",
    options: [
      { id: "hotel", label: "호텔", detail: "코스·서비스·격식 중심으로 비교" },
      { id: "chapel", label: "채플·하우스", detail: "채플감, 단독 홀, 하우스웨딩 위주" },
      { id: "bright", label: "밝은 홀·야외감", detail: "자연광, 가든, 밝은 분위기 우선" },
      { id: "convention", label: "컨벤션·일반홀", detail: "동선, 규모, 식대 균형을 먼저 보기" },
      { id: "flexible", label: "상담 가능성 우선", detail: "분위기는 넓게 두고 조건 맞는 곳부터" },
    ],
  },
  {
    id: "priority",
    eyebrow: "마지막",
    title: "상담에서 가장 먼저 확인할 조건은요?",
    helper: "Dearie가 후보를 담을 때 확인 질문도 같이 붙여둘게요. 계약 판단은 공식 상담 후에만 하세요.",
    options: [
      { id: "meal", label: "식대·총액", detail: "식대 범위가 보이는 후보를 앞에 두기" },
      { id: "traffic", label: "교통·동선", detail: "양가와 하객 이동을 먼저 보기" },
      { id: "privacy", label: "단독감", detail: "혼잡도와 프라이빗 운영 여부 확인" },
      { id: "contract", label: "계약 조건", detail: "출처·확인일이 있는 후보를 앞에 두기" },
    ],
  },
];

function VenueStarter({
  onApply,
  onClose,
}: {
  onApply: (picks: WeddingVenue[]) => void;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<VenueAgentAnswers>({});
  const answeredCount = countVenueAgentAnswers(answers);
  const currentQuestion = VENUE_AGENT_QUESTIONS.find((question) => !answers[question.id]) ?? null;
  const complete = answeredCount === VENUE_AGENT_QUESTIONS.length;
  const remaining = VENUE_AGENT_QUESTIONS.length - answeredCount;
  const result = useMemo(() => pickAgentVenues(answers), [answers]);

  const answerQuestion = (key: VenueAgentAnswerKey, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value } as VenueAgentAnswers));
  };

  const clearAnswer = (key: VenueAgentAnswerKey) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <section className="border-y border-hair py-5 space-y-5" data-testid="venue-agent-starter">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <AgentIdentity compact mood={complete ? "ready" : "thinking"} />
          <div className="min-w-0">
            <div className="eyebrow-gold mb-2">Dearie 후보 추리기</div>
            <h2 className="font-serif text-[21px] leading-snug text-ink break-keep">
              {complete ? "상담 후보를 담을 준비가 됐어요" : "제가 한 번에 하나씩 좁혀볼게요"}
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-soft break-keep">
              답을 고를 때마다 후보군을 다시 계산합니다. 공개 정보 기반 예비 후보라서 식대·보증·대관 조건은 상담 전 공식 채널로 재확인해야 합니다.
            </p>
          </div>
        </div>
        <button onClick={onClose} className="min-h-10 flex-shrink-0 text-[12px] text-soft underline underline-offset-4 hover:text-ink">
          닫기
        </button>
      </div>

      <div className="grid grid-cols-2 border-y border-hair md:grid-cols-4">
        {VENUE_AGENT_QUESTIONS.map((question, index) => {
          const answered = !!answers[question.id];
          const current = currentQuestion?.id === question.id;
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => answered && clearAnswer(question.id)}
              disabled={!answered}
              className={`min-h-[74px] border-r border-b border-hair px-3 py-3 text-left last:border-r-0 md:border-b-0 ${
                answered ? "text-ink hover:bg-cream/45" : current ? "text-gold" : "text-soft"
              }`}
              aria-label={answered ? `${VENUE_AGENT_STEP_LABELS[question.id]} 답변 수정` : VENUE_AGENT_STEP_LABELS[question.id]}
            >
              <span className="block text-[10.5px] font-semibold tracking-eyebrow text-soft">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="mt-1 block text-[13px] font-semibold">{VENUE_AGENT_STEP_LABELS[question.id]}</span>
              <span className="mt-1 block truncate text-[11px] text-soft">
                {answered ? selectedVenueAgentOption(question, answers)?.label : current ? "답 기다리는 중" : "대기"}
              </span>
            </button>
          );
        })}
      </div>

      {currentQuestion ? (
        <div className="border-y border-hair py-4">
          <div className="eyebrow-gold mb-2">{currentQuestion.eyebrow}</div>
          <h3 className="font-serif text-[19px] leading-snug text-ink break-keep">{currentQuestion.title}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-soft break-keep">{currentQuestion.helper}</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {currentQuestion.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => answerQuestion(currentQuestion.id, option.id)}
                className="group min-h-[72px] border border-hair px-4 py-3 text-left transition hover:border-gold hover:bg-cream/45 active:scale-[0.99]"
              >
                <span className="block text-[14px] font-semibold text-ink break-keep">{option.label}</span>
                <span className="mt-1 block text-[12px] leading-relaxed text-soft break-keep">{option.detail}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-y border-hair py-4">
          <div className="eyebrow-gold mb-2">Dearie 판단 완료</div>
          <h3 className="font-serif text-[19px] leading-snug text-ink break-keep">
            이제 이 후보들로 상담 순서를 시작해도 돼요
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-soft break-keep">
            담은 뒤에는 각 후보를 투어 상태로 올리고, 견적 기준·취소 조건·포함 항목을 공식 상담에서 확인하면 됩니다.
          </p>
        </div>
      )}

      {answeredCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {VENUE_AGENT_QUESTIONS.filter((question) => answers[question.id]).map((question) => {
            const option = selectedVenueAgentOption(question, answers);
            if (!option) return null;
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => clearAnswer(question.id)}
                className="min-h-9 border border-hair px-3 py-1.5 text-[12px] text-ink hover:border-gold hover:text-gold"
              >
                {VENUE_AGENT_STEP_LABELS[question.id]} · {option.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="border-y border-hair py-4 space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">Dearie 판단</div>
            <h3 className="font-serif text-[18px] leading-snug text-ink break-keep">
              {answeredCount === 0
                ? "첫 답을 고르면 후보가 바로 줄어요"
                : result.relaxed
                  ? "조건을 조금 넓혀 후보를 남겼어요"
                  : `후보 ${result.poolCount}곳에서 ${result.picks.length}곳을 골랐어요`}
            </h3>
          </div>
          <span className="eyebrow tabular-nums whitespace-nowrap">{answeredCount}/4</span>
        </div>

        {result.picks.length > 0 ? (
          <div className="grid border-y border-hair md:grid-cols-2">
            {result.picks.map((venue, index) => (
              <div key={venue.id} className="border-b border-r border-hair p-4 last:border-b-0 md:[&:nth-child(2n)]:border-r-0 md:[&:nth-last-child(-n+2)]:border-b-0">
                <div className="flex items-start gap-3">
                  <span className="w-6 flex-shrink-0 font-serif text-[16px] tabular-nums text-soft">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-[16px] leading-snug text-ink break-keep">{venue.name}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-soft">
                      {[venue.region, venue.hallType ? HALL_TYPE_LABEL[venue.hallType] : undefined, venue.foodType ? FOOD_TYPE_LABEL[venue.foodType] : undefined].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {describeVenueAgentMatch(venue, answers).map((reason) => (
                    <span key={reason} className="border border-hair px-2 py-1 text-[11px] text-soft">
                      {reason}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-[11px] leading-relaxed text-soft">{venueSourceLabel(venue)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="border-y border-hair py-4 text-[13px] leading-relaxed text-soft">
            아직 후보를 확정하지 않았어요. 지역을 먼저 고르면 Dearie가 상담 후보를 계산합니다.
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-soft">
          Dearie는 업체와 제휴·후원 관계가 없고, 화면의 가격·수용 인원은 공개 정보 기반의 비교 출발점입니다. 최종 계약 전에는 공식 채널에서 견적서와 취소·변경 조건을 확인하세요.
        </p>

        <div className="flex flex-col gap-2 md:flex-row">
          <button
            onClick={() => onApply(result.picks)}
            disabled={!complete || result.picks.length === 0}
            className="btn-primary min-h-12 flex-1 text-[13px] disabled:opacity-40"
          >
            {complete ? `후보 ${result.picks.length}곳 담기 →` : `답 ${remaining}개 더 하면 후보 담기`}
          </button>
          <button
            type="button"
            onClick={() => setAnswers({})}
            className="min-h-12 border border-hair px-4 text-[13px] font-medium text-ink hover:border-gold hover:text-gold"
          >
            처음부터 다시 답하기
          </button>
        </div>
      </div>
    </section>
  );
}

function countVenueAgentAnswers(answers: VenueAgentAnswers): number {
  return VENUE_AGENT_QUESTIONS.filter((question) => !!answers[question.id]).length;
}

function selectedVenueAgentOption(question: VenueAgentQuestion, answers: VenueAgentAnswers): VenueAgentOption | undefined {
  return question.options.find((option) => option.id === answers[question.id]);
}

function pickAgentVenues(answers: VenueAgentAnswers): { picks: WeddingVenue[]; poolCount: number; relaxed: boolean } {
  const answeredCount = countVenueAgentAnswers(answers);
  if (answeredCount === 0) return { picks: [], poolCount: VENUE_CATALOG.length, relaxed: false };

  const strictPool = VENUE_CATALOG.filter((venue) =>
    matchesVenueAgentArea(venue, answers.area) &&
    matchesVenueAgentScale(venue, answers.scale) &&
    matchesVenueAgentMood(venue, answers.mood)
  );
  let pool = strictPool;
  let relaxed = false;

  if (pool.length < 3 && answers.mood && answers.mood !== "flexible") {
    pool = VENUE_CATALOG.filter((venue) =>
      matchesVenueAgentArea(venue, answers.area) &&
      matchesVenueAgentMood(venue, answers.mood)
    );
    relaxed = true;
  }
  if (pool.length < 3 && answers.scale && answers.scale !== "unknown") {
    pool = VENUE_CATALOG.filter((venue) =>
      matchesVenueAgentArea(venue, answers.area) &&
      matchesVenueAgentScale(venue, answers.scale)
    );
    relaxed = true;
  }
  if (pool.length < 3) {
    pool = VENUE_CATALOG.filter((venue) => matchesVenueAgentArea(venue, answers.area));
    relaxed = true;
  }
  if (pool.length < 3) {
    pool = VENUE_CATALOG;
    relaxed = true;
  }

  const picks = pool
    .map((venue) => ({ venue, score: scoreVenueForAgent(venue, answers) }))
    .sort((a, b) =>
      b.score - a.score ||
      (a.venue.mealPriceMin ?? Number.MAX_SAFE_INTEGER) - (b.venue.mealPriceMin ?? Number.MAX_SAFE_INTEGER) ||
      a.venue.name.localeCompare(b.venue.name, "ko")
    )
    .slice(0, 4)
    .map(({ venue }) => venue);

  return { picks, poolCount: strictPool.length, relaxed };
}

function matchesVenueAgentArea(venue: WeddingVenue, area?: VenueAgentArea): boolean {
  if (!area) return true;
  if (area === "seoul") return isSeoulVenueRegion(venue.region);
  if (area === "local") {
    return ["busan", "daegu", "chungcheong", "honam", "gangwon-jeju"]
      .some((key) => matchesRegionGroup(venue.region, key));
  }
  return matchesRegionGroup(venue.region, area);
}

function matchesVenueAgentScale(venue: WeddingVenue, scale?: VenueAgentScale): boolean {
  if (!scale || scale === "unknown") return true;
  const min = venue.capacityMin ?? 0;
  const max = venue.capacityMax ?? 9999;
  if (scale === "small") return min <= 130 && max >= 60;
  if (scale === "medium") return min <= 260 && max >= 140;
  return max >= 300;
}

function matchesVenueAgentMood(venue: WeddingVenue, mood?: VenueAgentMood): boolean {
  if (!mood || mood === "flexible") return true;
  const name = venue.name.toLowerCase();
  if (mood === "hotel") return venue.hallType === "hotel";
  if (mood === "chapel") return venue.hallType === "house" || name.includes("채플") || name.includes("chapel");
  if (mood === "bright") {
    return venue.hallType === "outdoor" || venue.hallType === "house" || /가든|포레스트|두가헌|채플/.test(venue.name);
  }
  return venue.hallType === "convention" || venue.hallType === "general";
}

function scoreVenueForAgent(venue: WeddingVenue, answers: VenueAgentAnswers): number {
  let score = 0;
  if (matchesVenueAgentArea(venue, answers.area)) score += answers.area ? 34 : 0;
  else score -= 18;
  if (matchesVenueAgentScale(venue, answers.scale)) score += answers.scale && answers.scale !== "unknown" ? 24 : 4;
  else score -= 8;
  if (matchesVenueAgentMood(venue, answers.mood)) score += answers.mood && answers.mood !== "flexible" ? 22 : 5;
  else score -= 6;

  if (answers.priority === "meal") {
    if (!venue.mealPriceMin) score -= 3;
    else if (venue.mealPriceMin <= 90_000) score += 14;
    else if (venue.mealPriceMin <= 120_000) score += 11;
    else if (venue.mealPriceMin <= 150_000) score += 7;
    else score += 3;
  }
  if (answers.priority === "traffic") {
    if (isSeoulVenueRegion(venue.region)) score += 8;
    if (matchesRegionGroup(venue.region, "central") || matchesRegionGroup(venue.region, "gangnam") || matchesRegionGroup(venue.region, "han")) score += 5;
  }
  if (answers.priority === "privacy") {
    if (venue.hallType === "house" || venue.hallType === "outdoor") score += 12;
    else if (venue.hallType === "hotel") score += 4;
  }
  if (answers.priority === "contract") {
    if (venue.source) score += 5;
    if (venue.lastVerified) score += 5;
    if (venue.capacitySource === "official") score += 3;
    if (venue.mealPriceSource === "official") score += 3;
  }

  if (venue.source) score += 2;
  if (venue.lastVerified) score += 2;
  if (venue.capacityMin || venue.capacityMax) score += 1;
  if (venue.mealPriceMin || venue.mealPriceMax) score += 1;
  return score;
}

function describeVenueAgentMatch(venue: WeddingVenue, answers: VenueAgentAnswers): string[] {
  const reasons: string[] = [];
  if (answers.area && matchesVenueAgentArea(venue, answers.area)) reasons.push(getVenueAgentAreaLabel(answers.area));
  if (answers.scale && answers.scale !== "unknown" && matchesVenueAgentScale(venue, answers.scale)) reasons.push(`하객 ${formatCapacity(venue)}`);
  if (answers.mood && answers.mood !== "flexible" && matchesVenueAgentMood(venue, answers.mood)) {
    reasons.push(venue.hallType ? HALL_TYPE_LABEL[venue.hallType] : "분위기 후보");
  }
  if (answers.priority === "meal" && (venue.mealPriceMin || venue.mealPriceMax)) reasons.push(`식대 ${formatMealPrice(venue)}`);
  if (answers.priority === "traffic" && venue.region) reasons.push(`${venue.region} 동선`);
  if (answers.priority === "privacy") reasons.push(venue.hallType === "house" || venue.hallType === "outdoor" ? "단독감 확인" : "혼잡도 확인");
  if (answers.priority === "contract" && venue.source) reasons.push("출처 확인 가능");
  if (reasons.length === 0 && venue.hallType) reasons.push(HALL_TYPE_LABEL[venue.hallType]);
  if (reasons.length === 0 && venue.region) reasons.push(venue.region);
  return reasons.slice(0, 4);
}

function matchesRegionGroup(region: string | undefined, key: string): boolean {
  return REGION_GROUPS.find((group) => group.key === key)?.match(region) ?? false;
}

function isSeoulVenueRegion(region: string | undefined): boolean {
  if (!region) return false;
  return (
    region.includes("서울") ||
    ["gangnam", "central", "han", "etc"].some((key) => matchesRegionGroup(region, key))
  );
}

function getVenueAgentAreaLabel(area: VenueAgentArea): string {
  if (area === "seoul") return "서울권";
  if (area === "local") return "지방·리조트";
  return REGION_GROUPS.find((group) => group.key === area)?.label ?? "지역 조건";
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
