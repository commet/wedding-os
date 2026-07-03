import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { ContractCheck, WeddingData, WeddingUpdate, WeddingVenue, VenueHallType } from "../lib/schema";
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
import { SectionDecisionLoop } from "../components/DecisionLoopPanel";
import ResearchInputPanel, { type ResearchSection } from "../components/ResearchInputPanel";
import { safeHref } from "../lib/security";
import { koBreak } from "../lib/typography";
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
  todayISO,
  type BalanceDue,
} from "../lib/derived";
import { lossDeadlinesFor, lossDdayLabel } from "../lib/lossDeadlines";
import { answerConsultation, consultationChoice, consultationFacts } from "../lib/sectionConsultation";

type Props = { data: WeddingData; update: (patch: WeddingUpdate) => void };
type Tab = "mine" | "catalog";
type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

const STATUS_OPTIONS: WeddingVenue["status"][] = ["관심", "투어", "계약"];
const AGENT_STARTER_NOTE_MARKERS = [
  "기준으로 먼저 비교할 후보입니다.",
  "처음 비교해볼 후보입니다.",
  "Dearie가 조건 답변으로 추린 후보입니다.",
];
const LEGACY_AGENT_STARTER_NAMES = new Set(["호텔 인터불고 엑스코", "웨딩시티 신도림", "더베뉴지서울"]);
const CONTRACT_FIELDS: { key: keyof ContractCheck; label: string; placeholder: string }[] = [
  { key: "quote", label: "견적 기준", placeholder: "예: 토 12시, 보증 250명, 식대 13만원, 대관료 포함" },
  { key: "payment", label: "결제 일정", placeholder: "예: 계약금 100만원, 잔금 D-7, 카드 가능 여부" },
  { key: "cancellation", label: "취소·변경", placeholder: "예: D-90 전 전액 환불, 이후 위약금 단계별 적용" },
  { key: "included", label: "포함 항목", placeholder: "예: 생화 장식, 혼구용품, 음주류, 폐백실, 빔 사용" },
  { key: "extras", label: "별도 비용", placeholder: "예: 부가세, 봉사료, 주차권, 셔틀, 원판 추가" },
  { key: "evidence", label: "증빙 보관", placeholder: "예: 계약서 PDF는 드라이브 / 견적 캡처는 카톡방 고정" },
];

// 미루면 손해가 생기는 날짜 — 취소·변경 산문 메모에 묻히지 않게 구조화 date 필드로 받는다.
const LOSS_DATE_FIELDS: {
  key: "freeCancelUntil" | "holdExpiresAt" | "guaranteeDueAt";
  label: string;
  hint: string;
}[] = [
  { key: "freeCancelUntil", label: "무료취소 기한", hint: "지나면 취소 위약금이 생겨요" },
  { key: "holdExpiresAt", label: "가계약 만료일", hint: "지나면 잡아둔 날짜·홀이 풀려요" },
  { key: "guaranteeDueAt", label: "보증인원 확정 마감", hint: "지나면 미달 인원분도 식대를 내요" },
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
  const [showStarter, setShowStarter] = useState(
    () => starterOpen || (data.venues ?? []).length === 0 || (data.venues ?? []).every((venue) => isReplaceableAgentStarterVenue(venue, data.preferences.isDemo === true)),
  );
  const [scrollStarterOnOpen, setScrollStarterOnOpen] = useState(false);
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
  // 미루면 손해 — 무료취소 기한·가계약 만료·보증인원 확정·잔금을 한 스트립으로.
  const venueLossDeadlines = useMemo(
    () => lossDeadlinesFor(data, todayISO(), "/venues"),
    [data]
  );
  // 상담 답변을 "정한 기준" 판단 재료 문장으로 — 후보 비교 위에 노출.
  const venueFacts = useMemo(() => consultationFacts(data, "venues", 4), [data]);
  const timingFact = venueTimingLabel(data);
  const hasOnlyStarterVenues = useMemo(
    () => myVenues.length > 0 && myVenues.every((venue) => isReplaceableAgentStarterVenue(venue, data.preferences.isDemo === true)),
    [data.preferences.isDemo, myVenues],
  );
  const headcount = useMemo(() => expectedHeadcount(data), [data]);
  const contracted = useMemo(() => myVenues.find((v) => v.status === "계약"), [myVenues]);
  const tourCount = haveStatusCount["투어"] + haveStatusCount["계약"];
  const contractChecked = contracted ? contractFieldCount(contracted.contract) : 0;
  const venueAgentSummary = myVenues.length === 0
    ? "지역, 하객, 분위기, 우선순위만 답하면 Dearie가 공개 카탈로그에서 상담 후보를 먼저 좁혀둘게요. 제휴 추천이 아니라 출발점으로만 씁니다."
    : contracted
      ? `${contracted.name}을 계약 후보로 보고 있어요. 이제 청첩장에 넣을 정보와 결제·취소 조건을 같이 잠가두면 됩니다.`
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
    if (!showStarter || !scrollStarterOnOpen) return;
    window.requestAnimationFrame(() => {
      starterRef.current?.scrollIntoView({ block: "start" });
      setScrollStarterOnOpen(false);
    });
  }, [scrollStarterOnOpen, showStarter]);

  const openVenueStarter = () => {
    setScrollStarterOnOpen(true);
    setShowStarter(true);
    setTab("catalog");
  };

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
        setVenueNotice("청첩장에 예식장 정보를 넣었어요.");
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

  const applyVenueStarter = (picks: WeddingVenue[], answers: VenueAgentAnswers) => {
    update((prev: WeddingData) => {
      const baseVenues = (prev.venues ?? []).filter((venue) =>
        !isReplaceableAgentStarterVenue(venue, prev.preferences.isDemo === true)
      );
      const names = new Set(baseVenues.map((v) => v.name));
      const additions = picks
        .filter((v) => !names.has(v.name))
        .map((v, index) => ({
          ...v,
          id: `v-${Date.now()}-${index}-${v.id}`,
          status: "관심" as const,
          notes: [
            v.notes,
            "Dearie가 조건 답변으로 추린 후보입니다.",
            "상담 때 보증인원, 식대, 부가세·봉사료, 외부업체 반입료, 동시 예식 수를 확인하고 계약서에 남기세요.",
          ].filter(Boolean).join("\n"),
        }));
      // 스타터 답변을 버리지 않고 상담 답변으로 영속화 — "정한 기준"과 결정 카드에서 재사용된다.
      return persistVenueStarterAnswers({ ...prev, venues: [...baseVenues, ...additions] }, answers);
    });
    setVenueNotice(`후보 ${picks.length}곳을 내 목록에 남겼어요. 답한 기준은 '정한 기준'으로 남아 있어요.`);
    setTab("mine");
    setShowStarter(false);
  };

  return (
    <div className="page pt-6 pb-10 space-y-5 md:space-y-6">
      <div>
        <div className="eyebrow-gold mb-2">장소 찾기</div>
        <h1 className="h-page">예식장</h1>
      </div>

      <VenueFocusPanel
        myVenues={myVenues}
        tourCount={tourCount}
        contracted={contracted}
        contractChecked={contractChecked}
        headcount={headcount}
        summary={venueAgentSummary}
        onStart={openVenueStarter}
        onAdd={() => setShowAdd(true)}
        onCompare={() => { setTab("mine"); setMineView("compare"); window.setTimeout(() => document.getElementById("venue-mine-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}
        onPromote={myVenues.length > 0 && tourCount === 0 ? promoteFirstVenueToTour : undefined}
        onApplyContracted={contracted && !data.invitation.venue ? () => applyToInvitation(contracted) : undefined}
      />

      {/* 미루면 손해 — 돈이 걸린 날짜를 화면 최상단에서 먼저 보여준다 */}
      {venueLossDeadlines.length > 0 && (
        <div className="border-y border-hair py-4">
          <div className="eyebrow-gold mb-3">놓치면 손해</div>
          <ul className="space-y-2.5">
            {venueLossDeadlines.slice(0, 4).map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-4 text-[13px]">
                <span className="min-w-0 break-keep">
                  <span className="text-ink">{d.name}</span>{" "}
                  <span className="text-soft">{d.label}</span>
                  {d.amountKRW ? (
                    <span className="text-soft tabular-nums"> · {formatKRW(d.amountKRW)}</span>
                  ) : null}
                  <span className="block text-[11.5px] text-soft leading-relaxed">{d.lossHint}</span>
                </span>
                <span
                  className={`tabular-nums whitespace-nowrap flex-shrink-0 ${
                    d.daysLeft <= 14 ? "text-gold" : "text-soft"
                  }`}
                >
                  {lossDdayLabel(d.daysLeft)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details>
        <summary className="quiet-disclosure">
          <span>
            <span className="section-title block">기준과 마감 확인</span>
            <span className="mt-1 block text-[12.5px] text-soft">예식일, 상담 기준, 결정 이유는 필요할 때 펼쳐봅니다.</span>
          </span>
          <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
        </summary>
        <div className="pt-4 space-y-4">
          <VenueTimingBar data={data} update={update} />
          <SectionDecisionLoop data={data} sectionId="venues" />
        </div>
      </details>

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

          {tab === "mine" && (
            <section id="venue-mine-section" className="space-y-5 scroll-mt-20">
              {/* 진척도 */}
              <div className="flex items-baseline gap-6 text-[12px] border-b border-hair pb-3">
                <span className="eyebrow">진척도</span>
                <span><span className="tabular-nums text-ink">{haveStatusCount["관심"]}</span> <span className="text-soft">관심</span></span>
                <span><span className="tabular-nums text-ink">{haveStatusCount["투어"]}</span> <span className="text-soft">투어</span></span>
                <span className="ml-auto"><span className="tabular-nums text-gold">{haveStatusCount["계약"]}</span> <span className="text-soft">계약</span></span>
              </div>

              {/* 정한 기준 — 상담 답변·희망 시기를 후보 비교 위에서 다시 보여준다 */}
              {(timingFact || venueFacts.length > 0) && (
                <div className="border-b border-hair pb-3 text-[12.5px] leading-relaxed text-soft break-keep">
                  <span className="eyebrow mr-2">정한 기준</span>
                  {[timingFact, ...venueFacts].filter(Boolean).join(" · ")}
                </div>
              )}

              <div className="flex items-baseline justify-between">
                <h2 className="eyebrow">내 후보</h2>
                <button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
                  + 직접 추가
                </button>
              </div>

              {myVenues.length === 0 || hasOnlyStarterVenues ? (
                <div className="py-10 text-center text-soft text-[13px] border-y border-hair">
                  <span className="text-ink">아직 직접 남긴 후보가 없어요.</span><br />
                  지역과 하객부터 답하면 Dearie가 비교할 후보만 남겨둘게요.<br />
                  <button onClick={openVenueStarter} className="mt-3 text-ink underline underline-offset-4 hover:text-gold text-[13px]">
                    Dearie와 후보 좁히기 →
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
            </section>
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

function VenueFocusPanel({
  myVenues,
  tourCount,
  contracted,
  contractChecked,
  headcount,
  summary,
  onStart,
  onAdd,
  onCompare,
  onPromote,
  onApplyContracted,
}: {
  myVenues: WeddingVenue[];
  tourCount: number;
  contracted?: WeddingVenue;
  contractChecked: number;
  headcount: number;
  summary: string;
  onStart: () => void;
  onAdd: () => void;
  onCompare: () => void;
  onPromote?: () => void;
  onApplyContracted?: () => void;
}) {
  const nextTitle = contracted
    ? contractChecked >= 3
      ? "청첩장에 넣을 식장 정보를 확정하세요"
      : "계약서에서 빠지면 곤란한 조건을 잠그세요"
    : tourCount > 0
      ? "투어한 후보를 같은 기준으로 비교하세요"
      : myVenues.length > 0
        ? "첫 상담 후보 하나만 정하세요"
        : "조건 4개로 후보를 3곳만 남기세요";
  const needsFirstTour = !contracted && myVenues.length > 0 && tourCount === 0 && !!onPromote;
  const nextBody = contracted
    ? contracted.name
      ? `${contracted.name} 기준으로 결제, 취소, 포함 항목을 확인하면 다음 화면들이 안정됩니다.`
      : summary
    : summary;
  const primaryLabel = contracted
    ? onApplyContracted ? "청첩장에 식장 넣기" : "계약 조건 확인하기"
    : needsFirstTour
      ? "첫 후보를 투어로"
    : myVenues.length > 0
      ? "나란히 비교하기"
      : "Dearie와 후보 좁히기";
  const primaryAction = contracted
    ? onApplyContracted ?? (() => document.getElementById("venue-mine-section")?.scrollIntoView({ behavior: "smooth", block: "start" }))
    : needsFirstTour
      ? onPromote!
    : myVenues.length > 0
      ? onCompare
      : onStart;
  const fit = contracted ? venueCapacityFit(contracted, headcount) : "unknown";
  const fitLabel = fit === "unknown" ? "인원 미정" : CAPACITY_FIT_LABEL[fit];

  return (
    <section className="venue-focus">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div className="min-w-0">
          <div className="home-kicker mb-2">지금 볼 것</div>
          <h2 className="venue-focus-title">{koBreak(nextTitle)}</h2>
          <p className="mt-3 max-w-[42rem] text-[14px] leading-[1.75] text-soft break-keep">
            {nextBody}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          <VenueMetric label="후보" value={`${myVenues.length}곳`} detail={myVenues.length >= 3 ? "비교 가능" : "3곳 권장"} />
          <VenueMetric label="투어" value={`${tourCount}곳`} detail={tourCount > 0 ? "상담 중" : "미정"} warn={myVenues.length > 0 && tourCount === 0} />
          <VenueMetric label={contracted ? "계약" : "인원"} value={contracted ? `${contractChecked}/6` : headcount ? `${headcount}명` : "미정"} detail={contracted ? fitLabel : "예상 하객"} warn={contracted ? contractChecked < 3 || fit === "over" || fit === "under" : false} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" onClick={primaryAction} className="focus-primary-action w-full text-left sm:w-auto sm:min-w-[14rem]">
          <span>
            <span className="block text-[11.5px] font-semibold text-ink/55">다음 행동</span>
            <span className="mt-0.5 block text-[14px] font-semibold leading-snug">{primaryLabel}</span>
          </span>
          <span aria-hidden="true" className="text-gold">→</span>
        </button>
        {onPromote && !needsFirstTour && (
          <button type="button" onClick={onPromote} className="focus-secondary-action sm:w-auto sm:min-w-[11rem]">
            <span>첫 후보를 투어로</span>
            <span aria-hidden="true" className="text-gold">→</span>
          </button>
        )}
        <button type="button" onClick={onAdd} className="focus-secondary-action sm:w-auto sm:min-w-[9rem]">
          <span>직접 추가</span>
          <span aria-hidden="true" className="text-gold">+</span>
        </button>
      </div>
    </section>
  );
}

function VenueMetric({ label, value, detail, warn = false }: { label: string; value: string; detail: string; warn?: boolean }) {
  return (
    <div className="min-w-0 border border-line bg-vellum/70 px-3 py-2.5">
      <div className="text-[11px] font-semibold text-soft">{label}</div>
      <div className={`mt-0.5 font-serif text-[20px] leading-none tabular-nums ${warn ? "text-gold" : "text-ink"}`}>{value}</div>
      <div className="mt-1 truncate text-[11px] text-soft">{detail}</div>
    </div>
  );
}

type VenueAgentAnswerKey = "area" | "scale" | "mood" | "priority";
type VenueAgentArea = "seoul" | "gangnam" | "central" | "han" | "gyeonggi" | "local";
type VenueAgentScale = "small" | "medium" | "large" | "unknown";
type VenueAgentMood = "hotel" | "chapel" | "bright" | "convention" | "flexible";
type VenueAgentPriority = "meal" | "traffic" | "privacy" | "contract";
type VenueAgentAnswers = Partial<{
  area: VenueAgentArea[];
  scale: VenueAgentScale;
  mood: VenueAgentMood[];
  priority: VenueAgentPriority[];
}>;
type VenueAgentOption = { id: string; label: string; detail: string };
type VenueAgentQuestion = {
  id: VenueAgentAnswerKey;
  eyebrow: string;
  title: string;
  helper: string;
  multiple?: boolean;
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
    helper: "처음부터 모든 지역을 보면 비교가 흐려져요. 이동 동선이 맞는 권역만 먼저 골라도 됩니다.",
    multiple: true,
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
    helper: "분위기는 취향이지만, 투어 동선을 크게 좌우합니다. 끌리는 분위기를 여러 개 골라도 됩니다.",
    multiple: true,
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
    helper: "Dearie가 후보를 담을 때 확인 질문도 같이 붙여둘게요. 실제 상담에서 같이 확인할 조건을 모두 골라도 됩니다.",
    multiple: true,
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
  onApply: (picks: WeddingVenue[], answers: VenueAgentAnswers) => void;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<VenueAgentAnswers>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const answeredCount = countVenueAgentAnswers(answers);
  const currentQuestion = questionIndex < VENUE_AGENT_QUESTIONS.length ? VENUE_AGENT_QUESTIONS[questionIndex] : null;
  const complete = answeredCount === VENUE_AGENT_QUESTIONS.length;
  const remaining = VENUE_AGENT_QUESTIONS.length - answeredCount;
  const result = useMemo(() => pickAgentVenues(answers), [answers]);
  const impact = useMemo(() => buildVenueAgentImpact(answers, result), [answers, result]);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const previousAnsweredCountRef = useRef(answeredCount);

  useEffect(() => {
    const previous = previousAnsweredCountRef.current;
    previousAnsweredCountRef.current = answeredCount;
    if (answeredCount <= previous || !feedbackRef.current || !window.matchMedia("(max-width: 767px)").matches) return;
    window.setTimeout(() => feedbackRef.current?.scrollIntoView({ block: "start", behavior: "auto" }), 0);
  }, [answeredCount]);

  const answerQuestion = (question: VenueAgentQuestion, value: string) => {
    if (question.multiple) {
      setAnswers((prev) => toggleVenueAgentAnswer(prev, question, value));
      return;
    }
    setAnswers((prev) => ({ ...prev, [question.id]: value } as VenueAgentAnswers));
    setQuestionIndex((index) => Math.max(index, VENUE_AGENT_QUESTIONS.findIndex((item) => item.id === question.id) + 1));
  };

  const clearAnswer = (key: VenueAgentAnswerKey) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setQuestionIndex(VENUE_AGENT_QUESTIONS.findIndex((question) => question.id === key));
  };

  const goToQuestion = (index: number) => {
    if (index > answeredCount) return;
    setQuestionIndex(index);
  };

  const continueQuestion = () => {
    if (!currentQuestion || !isVenueAgentQuestionAnswered(currentQuestion, answers)) return;
    setQuestionIndex((index) => Math.min(index + 1, VENUE_AGENT_QUESTIONS.length));
  };

  return (
    <section className="panel space-y-4 px-4 py-4 md:px-5 md:py-5" data-testid="venue-agent-starter">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="home-kicker mb-1">후보 좁히기</div>
          <h2 className="text-[18px] font-semibold leading-snug text-ink break-keep md:text-[19px]">
            {complete ? "이 후보들로 상담 순서를 시작할 수 있어요" : "먼저 볼 조건을 골라주세요"}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-soft break-keep">
            답을 고르면 후보 초안이 바로 줄어듭니다. 여러 개를 골라도 괜찮아요.
          </p>
        </div>
        <button onClick={onClose} className="min-h-10 flex-shrink-0 self-end text-[12px] text-soft underline underline-offset-4 hover:text-ink md:self-start">
          닫기
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {VENUE_AGENT_QUESTIONS.map((question, index) => {
          const answered = isVenueAgentQuestionAnswered(question, answers);
          const current = questionIndex === index;
          const reachable = answered || index <= answeredCount;
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => goToQuestion(index)}
              disabled={!reachable}
              className={`min-h-[52px] rounded-[8px] border px-2.5 py-2 text-left transition ${
                answered ? "border-gold/45 bg-gold/5 text-ink hover:bg-cream/45" : current ? "border-gold text-gold" : "border-line text-soft"
              }`}
              aria-label={answered ? `${VENUE_AGENT_STEP_LABELS[question.id]} 답변 수정` : VENUE_AGENT_STEP_LABELS[question.id]}
            >
              <span className="block text-[10px] font-semibold text-soft">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="mt-0.5 block text-[12px] font-semibold">{VENUE_AGENT_STEP_LABELS[question.id]}</span>
              <span className="mt-0.5 hidden truncate text-[10.5px] text-soft sm:block">
                {answered ? selectedVenueAgentSummary(question, answers) : current ? "답 기다리는 중" : "대기"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {currentQuestion?.multiple && isVenueAgentQuestionAnswered(currentQuestion, answers) && (
          <div className="flex md:justify-end">
            <button
              type="button"
              onClick={continueQuestion}
              className="btn-primary min-h-12 w-full px-4 text-[13px] md:w-auto"
            >
              선택한 조건으로 다음 질문 →
            </button>
          </div>
        )}

        {currentQuestion ? (
          <div className="panel-muted px-4 py-4">
            <div className="home-kicker mb-1">{currentQuestion.eyebrow}</div>
            <h3 className="text-[17px] font-semibold leading-snug text-ink break-keep md:text-[18px]">{currentQuestion.title}</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-soft break-keep">{currentQuestion.helper}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {currentQuestion.options.map((option) => {
                const selected = isVenueAgentOptionSelected(currentQuestion, answers, option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => answerQuestion(currentQuestion, option.id)}
                    className={`group min-h-[62px] rounded-[8px] border px-3.5 py-3 text-left transition active:scale-[0.99] ${
                      selected ? "border-gold bg-gold/5 text-ink" : "border-hair hover:border-gold hover:bg-cream/45"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="block text-[14px] font-semibold text-ink break-keep">{option.label}</span>
                      <span className="text-[11px] text-soft">{selected ? "선택됨" : currentQuestion.multiple ? "추가" : "선택"}</span>
                    </span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-soft break-keep">{option.detail}</span>
                  </button>
                );
              })}
            </div>
            {currentQuestion.multiple && (
              <p className="mt-3 text-[12px] leading-relaxed text-soft">
                고를 때마다 아래 후보 초안이 다시 정리됩니다.
              </p>
            )}
          </div>
        ) : (
          <div className="panel-muted px-4 py-4">
            <div className="home-kicker mb-1">후보 정리 완료</div>
            <h3 className="text-[17px] font-semibold leading-snug text-ink break-keep md:text-[18px]">
              이 후보들로 상담 순서를 시작할 수 있어요
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-soft break-keep">
              정리하면 아래 후보만 내 목록에 남아요. 견적 기준·취소 조건·포함 항목은 공식 상담에서 다시 확인하세요.
            </p>
          </div>
        )}

        {answeredCount > 0 && (
          <div ref={feedbackRef} className="scroll-mt-20">
            <VenueAgentImpactPanel
              answeredCount={answeredCount}
              currentQuestion={currentQuestion}
              items={impact}
              currentQuestionAnswered={currentQuestion ? isVenueAgentQuestionAnswered(currentQuestion, answers) : false}
            />
          </div>
        )}

        {answeredCount > 0 && (
          <VenueCandidatePreview result={result} answers={answers} />
        )}

        {answeredCount > 0 && (
          <div className="flex flex-col gap-3 border-y border-hair py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="eyebrow mb-2">답한 조건</div>
              <div className="flex flex-wrap gap-2">
                {VENUE_AGENT_QUESTIONS.filter((question) => answers[question.id]).map((question) => {
                  const label = selectedVenueAgentSummary(question, answers);
                  if (!label) return null;
                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => clearAnswer(question.id)}
                      className="min-h-9 border border-hair px-3 py-1.5 text-[12px] text-ink hover:border-gold hover:text-gold"
                    >
                      {VENUE_AGENT_STEP_LABELS[question.id]} · {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setQuestionIndex(0);
              }}
              className="min-h-10 flex-shrink-0 text-[12px] text-soft underline underline-offset-4 hover:text-ink"
            >
              처음부터 다시 답하기
            </button>
          </div>
        )}
      </div>

      <div className="border-y border-hair py-4">
        {complete ? (
          <button
            onClick={() => onApply(result.picks, answers)}
            disabled={result.picks.length === 0}
            className="btn-primary min-h-12 w-full text-[13px] disabled:opacity-40"
          >
            후보 {result.picks.length}곳으로 내 후보 정리 →
          </button>
        ) : (
          <div className="flex items-center justify-between gap-4 text-[13px]">
            <span className="text-soft break-keep">답 {remaining}개만 더 고르면 상담 후보를 정리할 수 있어요.</span>
            <span className="eyebrow tabular-nums whitespace-nowrap">{answeredCount}/4</span>
          </div>
        )}
      </div>
    </section>
  );
}

function countVenueAgentAnswers(answers: VenueAgentAnswers): number {
  return VENUE_AGENT_QUESTIONS.filter((question) => isVenueAgentQuestionAnswered(question, answers)).length;
}

type VenueAgentImpactItem = {
  key: string;
  label: string;
  value: string;
  detail: string;
  done?: boolean;
};

function VenueAgentImpactPanel({
  answeredCount,
  currentQuestion,
  items,
  currentQuestionAnswered,
}: {
  answeredCount: number;
  currentQuestion: VenueAgentQuestion | null;
  items: VenueAgentImpactItem[];
  currentQuestionAnswered: boolean;
}) {
  const progress = Math.round((answeredCount / VENUE_AGENT_QUESTIONS.length) * 100);
  const latestItems = items.slice(-2);
  const activeLabel = currentQuestion
    ? currentQuestionAnswered
      ? `${VENUE_AGENT_STEP_LABELS[currentQuestion.id]} 기준을 골랐어요`
      : `${VENUE_AGENT_STEP_LABELS[currentQuestion.id]} 기준을 보는 중`
    : "후보 정리만 남았어요";
  return (
    <div className="panel-muted px-4 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
        <div>
          <div className="home-kicker mb-1">좁혀진 기준</div>
          <h3 className="text-[15px] font-semibold leading-snug text-ink break-keep md:text-[16px]">
            {answeredCount === 0 ? "답을 고르면 후보가 바로 좁혀져요" : activeLabel}
          </h3>
        </div>
        <span className="text-[11.5px] text-soft tabular-nums">{answeredCount}/4</span>
      </div>
      <div className="mt-3 h-[3px] bg-cream">
        <div className="h-full bg-gold transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {latestItems.map((item, index) => (
          <div
            key={item.key}
            className={`rounded-[8px] border px-3 py-2.5 ${
              index === latestItems.length - 1 ? "border-gold bg-gold/10" : "border-hair bg-cream/45"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className={index === latestItems.length - 1 ? "home-kicker" : "text-[11px] font-semibold text-soft"}>{item.label}</div>
              <div className="text-[13px] font-semibold leading-snug text-ink tabular-nums">{item.value}</div>
            </div>
            <p className={`mt-1 text-[12px] leading-relaxed break-keep ${index === latestItems.length - 1 ? "text-ink/75" : "text-soft"}`}>
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueCandidatePreview({
  result,
  answers,
}: {
  result: ReturnType<typeof pickAgentVenues>;
  answers: VenueAgentAnswers;
}) {
  if (result.picks.length === 0) return null;
  return (
    <div className="panel-muted px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <div className="home-kicker mb-1">후보 초안</div>
          <p className="text-[12px] leading-relaxed text-soft break-keep">
            {result.relaxed ? "일부 조건을 넓혀" : "답한 기준 그대로"} 먼저 볼 {result.picks.length}곳을 세웠어요.
          </p>
        </div>
        <span className="text-[12px] text-soft tabular-nums">상위 {Math.min(result.picks.length, 4)}곳</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {result.picks.slice(0, 4).map((venue, index) => (
          <div key={venue.id} className="rounded-[8px] border border-hair bg-vellum/70 px-3 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-6 flex-shrink-0 font-serif text-[15px] tabular-nums text-gold">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-serif text-[16px] leading-snug text-ink break-keep">{venue.name}</div>
                  <div className="flex-shrink-0 text-[11px] text-soft">{venueSourceLabel(venue)}</div>
                </div>
                <div className="mt-1 text-[12px] leading-relaxed text-soft">
                  {[venue.region, venue.hallType ? HALL_TYPE_LABEL[venue.hallType] : undefined, venue.foodType ? FOOD_TYPE_LABEL[venue.foodType] : undefined].filter(Boolean).join(" · ")}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {describeVenueAgentMatch(venue, answers).slice(0, 3).map((reason) => (
                    <span key={reason} className="border border-hair px-2 py-1 text-[11px] text-soft">
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-soft">
        제휴·후원 추천이 아니며, 가격·수용 인원은 공개 정보 기반의 비교 출발점입니다. 최종 계약 전 공식 채널에서 다시 확인하세요.
      </p>
    </div>
  );
}

function buildVenueAgentImpact(
  answers: VenueAgentAnswers,
  result: ReturnType<typeof pickAgentVenues>,
): VenueAgentImpactItem[] {
  const items: VenueAgentImpactItem[] = [];
  let pool = VENUE_CATALOG;

  if (answers.area?.length) {
    const next = VENUE_CATALOG.filter((venue) => matchesVenueAgentArea(venue, answers.area));
    items.push({
      key: "area",
      label: "지역 기준",
      value: `${VENUE_CATALOG.length}곳 → ${next.length}곳`,
      detail: `${formatVenueAgentAnswerLabels("area", answers)} 권역만 먼저 보게 바꿨어요.`,
      done: true,
    });
    pool = next;
  }

  if (answers.scale) {
    const before = pool.length;
    const next = pool.filter((venue) => matchesVenueAgentScale(venue, answers.scale));
    items.push({
      key: "scale",
      label: "하객 기준",
      value: `${before}곳 → ${next.length}곳`,
      detail: answers.scale === "unknown"
        ? "인원은 열어두고 다른 기준으로 먼저 좁혀요."
        : `${formatVenueAgentAnswerLabels("scale", answers)} 기준에 맞는 수용 범위를 우선했어요.`,
      done: true,
    });
    pool = next.length > 0 ? next : pool;
  }

  if (answers.mood?.length) {
    const before = pool.length;
    const next = pool.filter((venue) => matchesVenueAgentMood(venue, answers.mood));
    items.push({
      key: "mood",
      label: "분위기 기준",
      value: `${before}곳 → ${next.length}곳`,
      detail: `${formatVenueAgentAnswerLabels("mood", answers)} 쪽 후보를 앞에 두도록 계산했어요.`,
      done: true,
    });
    pool = next.length > 0 ? next : pool;
  }

  if (answers.priority?.length) {
    items.push({
      key: "priority",
      label: "상담 질문 준비",
      value: `${result.picks.length}곳 선별`,
      detail: `${formatVenueAgentAnswerLabels("priority", answers)} 기준으로 상담 때 물어볼 항목까지 붙였어요.`,
      done: true,
    });
  }

  if (items.length === 0) {
    return [
      {
        key: "waiting",
        label: "후보 준비 중",
        value: `${VENUE_CATALOG.length}곳`,
        detail: "첫 답을 고르면 후보 숫자와 상담 질문이 바로 바뀌고, 완료하면 고른 후보만 준비판에 남습니다.",
      },
    ];
  }

  return items;
}

function formatVenueAgentAnswerLabels(key: VenueAgentAnswerKey, answers: VenueAgentAnswers): string {
  const question = VENUE_AGENT_QUESTIONS.find((item) => item.id === key);
  if (!question) return "선택한 조건";
  return selectedVenueAgentOptions(question, answers).map((option) => option.label).join(", ") || "선택한 조건";
}

function isVenueAgentQuestionAnswered(question: VenueAgentQuestion, answers: VenueAgentAnswers): boolean {
  const value = answers[question.id];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function selectedVenueAgentOptions(question: VenueAgentQuestion, answers: VenueAgentAnswers): VenueAgentOption[] {
  const value = answers[question.id];
  const values: string[] = Array.isArray(value) ? value : value ? [value] : [];
  return question.options.filter((option) => values.includes(option.id));
}

function selectedVenueAgentSummary(question: VenueAgentQuestion, answers: VenueAgentAnswers): string {
  const labels = selectedVenueAgentOptions(question, answers).map((option) => option.label);
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} 외 ${labels.length - 2}`;
}

function isVenueAgentOptionSelected(question: VenueAgentQuestion, answers: VenueAgentAnswers, optionId: string): boolean {
  return selectedVenueAgentOptions(question, answers).some((option) => option.id === optionId);
}

function toggleVenueAgentAnswer(answers: VenueAgentAnswers, question: VenueAgentQuestion, value: string): VenueAgentAnswers {
  const current = selectedVenueAgentOptions(question, answers).map((option) => option.id);
  const exclusiveValues: Partial<Record<VenueAgentAnswerKey, string[]>> = {
    area: ["seoul"],
    mood: ["flexible"],
  };
  const exclusive = exclusiveValues[question.id] ?? [];
  const withoutExclusive = exclusive.includes(value)
    ? []
    : current.filter((item) => !exclusive.includes(item));
  const nextValues = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...withoutExclusive, value];
  const next = { ...answers };
  if (nextValues.length === 0) {
    delete next[question.id];
    return next;
  }
  return { ...next, [question.id]: nextValues } as VenueAgentAnswers;
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

  if (pool.length < 3 && answers.mood?.length && !answers.mood.includes("flexible")) {
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

function matchesVenueAgentArea(venue: WeddingVenue, areas?: VenueAgentArea[]): boolean {
  if (!areas?.length) return true;
  return areas.some((area) => {
    if (area === "seoul") return isSeoulVenueRegion(venue.region);
    if (area === "local") {
      return ["busan", "daegu", "chungcheong", "honam", "gangwon-jeju"]
        .some((key) => matchesRegionGroup(venue.region, key));
    }
    return matchesRegionGroup(venue.region, area);
  });
}

function matchesVenueAgentScale(venue: WeddingVenue, scale?: VenueAgentScale): boolean {
  if (!scale || scale === "unknown") return true;
  const min = venue.capacityMin ?? 0;
  const max = venue.capacityMax ?? 9999;
  if (scale === "small") return min <= 130 && max >= 60;
  if (scale === "medium") return min <= 260 && max >= 140;
  return max >= 300;
}

function matchesVenueAgentMood(venue: WeddingVenue, moods?: VenueAgentMood[]): boolean {
  if (!moods?.length || moods.includes("flexible")) return true;
  return moods.some((mood) => {
    const name = venue.name.toLowerCase();
    if (mood === "hotel") return venue.hallType === "hotel";
    if (mood === "chapel") return venue.hallType === "house" || name.includes("채플") || name.includes("chapel");
    if (mood === "bright") {
      return venue.hallType === "outdoor" || venue.hallType === "house" || /가든|포레스트|두가헌|채플/.test(venue.name);
    }
    return venue.hallType === "convention" || venue.hallType === "general";
  });
}

function scoreVenueForAgent(venue: WeddingVenue, answers: VenueAgentAnswers): number {
  let score = 0;
  if (matchesVenueAgentArea(venue, answers.area)) score += answers.area?.length ? 34 : 0;
  else score -= 18;
  if (matchesVenueAgentScale(venue, answers.scale)) score += answers.scale && answers.scale !== "unknown" ? 24 : 4;
  else score -= 8;
  if (matchesVenueAgentMood(venue, answers.mood)) score += answers.mood?.length && !answers.mood.includes("flexible") ? 22 : 5;
  else score -= 6;

  const priorities = answers.priority ?? [];
  if (priorities.includes("meal")) {
    if (!venue.mealPriceMin) score -= 3;
    else if (venue.mealPriceMin <= 90_000) score += 14;
    else if (venue.mealPriceMin <= 120_000) score += 11;
    else if (venue.mealPriceMin <= 150_000) score += 7;
    else score += 3;
  }
  if (priorities.includes("traffic")) {
    if (isSeoulVenueRegion(venue.region)) score += 8;
    if (matchesRegionGroup(venue.region, "central") || matchesRegionGroup(venue.region, "gangnam") || matchesRegionGroup(venue.region, "han")) score += 5;
  }
  if (priorities.includes("privacy")) {
    if (venue.hallType === "house" || venue.hallType === "outdoor") score += 12;
    else if (venue.hallType === "hotel") score += 4;
  }
  if (priorities.includes("contract")) {
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
  const matchingAreas = (answers.area ?? []).filter((area) => matchesVenueAgentArea(venue, [area]));
  reasons.push(...matchingAreas.slice(0, 2).map(getVenueAgentAreaLabel));
  if (answers.scale && answers.scale !== "unknown" && matchesVenueAgentScale(venue, answers.scale)) reasons.push(`하객 ${formatCapacity(venue)}`);
  if (answers.mood?.length && !answers.mood.includes("flexible") && matchesVenueAgentMood(venue, answers.mood)) {
    reasons.push(venue.hallType ? HALL_TYPE_LABEL[venue.hallType] : "분위기 후보");
  }
  const priorities = answers.priority ?? [];
  if (priorities.includes("meal") && (venue.mealPriceMin || venue.mealPriceMax)) reasons.push(`식대 ${formatMealPrice(venue)}`);
  if (priorities.includes("traffic") && venue.region) reasons.push(`${venue.region} 동선`);
  if (priorities.includes("privacy")) reasons.push(venue.hallType === "house" || venue.hallType === "outdoor" ? "단독감 확인" : "혼잡도 확인");
  if (priorities.includes("contract") && venue.source) reasons.push("출처 확인 가능");
  if (reasons.length === 0 && venue.hallType) reasons.push(HALL_TYPE_LABEL[venue.hallType]);
  if (reasons.length === 0 && venue.region) reasons.push(venue.region);
  return [...new Set(reasons)].slice(0, 4);
}

function isReplaceableAgentStarterVenue(venue: WeddingVenue, isDemo: boolean): boolean {
  if (venue.notes && AGENT_STARTER_NOTE_MARKERS.some((marker) => venue.notes?.includes(marker))) return true;
  return isDemo && LEGACY_AGENT_STARTER_NAMES.has(venue.name);
}

function getVenueAgentAreaLabel(area: VenueAgentArea): string {
  if (area === "seoul") return "서울권";
  if (area === "local") return "지방·리조트";
  return REGION_GROUPS.find((group) => group.key === area)?.label ?? "지역 조건";
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
      title="상담 메모 정리"
      subtitle="공식 페이지나 상담 내용을 붙이면 비교 기준과 계약 체크로 나눠 채웁니다."
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

            {/* 손해 날짜 — 상담 때 들은 취소·확정 기한을 날짜로 남기면 상단 '놓치면 손해'로 올라온다 */}
            <div className="pt-3 border-t border-hair space-y-3">
              <div>
                <span className="eyebrow-gold block">놓치면 손해 보는 날짜</span>
                <p className="mt-1 text-[11.5px] text-soft leading-relaxed break-keep">
                  상담에서 들은 기한을 날짜로 남기면 지나기 전에 위에서 먼저 알려드려요.
                </p>
              </div>
              {LOSS_DATE_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="label">
                    {field.label} <span className="normal-case text-soft">— {field.hint}</span>
                  </label>
                  <input
                    type="date"
                    className="input text-[13px]"
                    value={v[field.key] ?? ""}
                    onChange={(e) => onUpdate({ [field.key]: e.target.value || undefined })}
                  />
                </div>
              ))}
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
        title="상담 메모 정리"
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

// ── 스타터 답변 영속화 — VenueStarter의 답을 venues 상담 답변으로 저장해 재사용 ──
// 스타터 area/scale/mood/priority 는 sectionConsultation 의
// venues-region/venues-scale/venues-hall/venues-priority 와 같은 축이라 그 id 를 재사용한다.
function persistVenueStarterAnswers(data: WeddingData, answers: VenueAgentAnswers): WeddingData {
  let next = data;
  // answerConsultation 은 multiple 질문에서 토글 — 이미 저장된 값은 건드리지 않고 없는 값만 추가한다.
  const addMissing = (questionId: string, values: string[]) => {
    const current = new Set(consultationChoice(next, "venues", questionId));
    for (const value of values) {
      if (!current.has(value)) next = answerConsultation(next, "venues", questionId, value);
    }
  };
  if (answers.area?.length) {
    // 스타터의 "서울 전체"는 상담 질문의 강남·중구·한남 권역 합으로 매핑.
    const mapped = [...new Set(
      answers.area.flatMap((area) => (area === "seoul" ? ["gangnam", "central", "han"] : [area]))
    )];
    addMissing("venues-region", mapped);
  }
  if (answers.scale && consultationChoice(next, "venues", "venues-scale")[0] !== answers.scale) {
    next = answerConsultation(next, "venues", "venues-scale", answers.scale);
  }
  if (answers.mood?.length) {
    // "상담 가능성 우선(flexible)"은 분위기를 안 좁힌다는 뜻이라 저장할 축이 없다.
    addMissing("venues-hall", answers.mood.filter((mood) => mood !== "flexible"));
  }
  if (answers.priority?.length) {
    addMissing("venues-priority", answers.priority);
  }
  return next;
}

// ── 희망 시기 — 한국 예식장의 첫 제약(계절·요일·시간대)을 후보 좁히기 전에 잡는다 ──
const VENUE_TIMING_ID = "venues-timing";
type VenueTimingKey = "season" | "day" | "slot";
const TIMING_GROUPS: { key: VenueTimingKey; label: string; options: string[] }[] = [
  { key: "season", label: "계절", options: ["봄", "여름", "가을", "겨울"] },
  { key: "day", label: "요일", options: ["토요일", "일요일", "평일"] },
  { key: "slot", label: "시간대", options: ["낮", "저녁"] },
];
type VenueTimingParts = Partial<Record<VenueTimingKey, string>>;

function venueTimingParts(data: WeddingData): VenueTimingParts {
  const entry = (data.ai?.dialogue ?? []).find((item) => item.id === VENUE_TIMING_ID);
  if (!entry) return {};
  const tokens = entry.answer.split("·").map((token) => token.trim());
  const parts: VenueTimingParts = {};
  for (const group of TIMING_GROUPS) {
    const hit = tokens.find((token) => group.options.includes(token));
    if (hit) parts[group.key] = hit;
  }
  return parts;
}

function timingPartsLabel(parts: VenueTimingParts): string {
  return TIMING_GROUPS.map((group) => parts[group.key]).filter(Boolean).join(" · ");
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

// 청첩장에 예식일이 있으면 그 날짜가 곧 시기 — 별도 답 없이 그대로 판단 재료로 쓴다.
function venueTimingLabel(data: WeddingData): string {
  const dateISO = (data.invitation.date ?? "").slice(0, 10);
  if (dateISO) {
    const parsed = new Date(`${dateISO}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return `예식일 ${dateISO} (${WEEKDAY_KO[parsed.getDay()]})`;
    }
  }
  const label = timingPartsLabel(venueTimingParts(data));
  return label ? `희망 시기 ${label}` : "";
}

function VenueTimingBar({ data, update }: Props) {
  const dateISO = (data.invitation.date ?? "").slice(0, 10);
  const parts = venueTimingParts(data);
  const hasAny = Boolean(parts.season || parts.day || parts.slot);
  const [open, setOpen] = useState(false);

  // 예식일이 이미 정해졌으면 묻지 않고 그 날짜 기준으로 보여준다.
  if (dateISO) {
    const label = venueTimingLabel(data);
    if (!label) return null;
    return (
      <section className="border-y border-hair py-3">
        <span className="eyebrow-gold block mb-1">예식일 기준</span>
        <p className="text-[13px] text-ink break-keep">
          {label}로 후보를 비교해요.
          <span className="mt-1 block text-[11.5px] leading-relaxed text-soft">
            상담 때 이 날짜의 홀 가용 여부와 시즌 식대를 먼저 확인하세요.
          </span>
        </p>
      </section>
    );
  }

  const setPart = (key: VenueTimingKey, value: string) => {
    update((prev: WeddingData) => {
      const current = venueTimingParts(prev);
      const nextParts: VenueTimingParts = { ...current, [key]: current[key] === value ? undefined : value };
      const answer = timingPartsLabel(nextParts);
      const answeredAt = new Date().toISOString();
      const dialogue = (prev.ai?.dialogue ?? []).filter((item) => item.id !== VENUE_TIMING_ID);
      return {
        ...prev,
        ai: {
          ...(prev.ai ?? {}),
          dialogue: answer
            ? [...dialogue, { id: VENUE_TIMING_ID, question: "희망 시기(계절·요일·시간대)", answer, answeredAt }].slice(-80)
            : dialogue,
          updatedAt: answeredAt,
        },
      };
    });
  };

  return (
    <section className="border-y border-hair py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-baseline justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="eyebrow-gold block mb-1">희망 시기</span>
          <span className="block text-[13px] text-ink leading-relaxed break-keep">
            {hasAny
              ? timingPartsLabel(parts)
              : "계절·요일·시간대를 먼저 잡아야 후보와 식대가 진짜로 좁혀져요"}
          </span>
        </span>
        <span className="flex-shrink-0 text-[12px] text-soft underline underline-offset-4 whitespace-nowrap">
          {open ? "접기" : hasAny ? "수정" : "고르기"}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2.5">
          {TIMING_GROUPS.map((group) => (
            <div key={group.key} className="flex items-baseline gap-3">
              <span className="eyebrow w-[48px] flex-shrink-0">{group.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((option) => {
                  const selected = parts[group.key] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPart(group.key, option)}
                      className={`min-h-9 border px-3 py-1 text-[12px] transition ${
                        selected
                          ? "border-gold bg-gold/5 text-ink"
                          : "border-hair text-soft hover:border-gold hover:text-ink"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[11.5px] leading-relaxed text-soft break-keep">
            봄·가을 토요일 낮은 6개월 이상 먼저 마감되는 곳이 많아요. 시기를 정해두면 상담에서 가용일부터 확인할 수 있어요.
          </p>
        </div>
      )}
    </section>
  );
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
