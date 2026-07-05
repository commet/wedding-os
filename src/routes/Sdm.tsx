import { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import type { ContractCheck, WeddingData, WeddingUpdate, SdmVendor, SdmCategory } from "../lib/schema";
import {
  SDM_GUIDE,
  SDM_CATALOG,
  SDM_PRICE_RANGE_NOTE,
  RESEARCH_CHANNELS,
  type SdmCatalogEntry,
} from "../data/sdmCatalog";
import Modal from "../components/Modal";
import VendorActions from "../components/VendorActions";
import { koBreak } from "../lib/typography";
import { formatKRW, upcomingBalances, budgetSyncSuggestions, todayISO } from "../lib/derived";
import { lossDeadlinesFor, lossDdayLabel } from "../lib/lossDeadlines";
import ProcessAgentPanel, { type ProcessAgentAction } from "../components/ProcessAgentPanel";
import SectionConsultationPanel from "../components/SectionConsultationPanel";
import { SectionDecisionLoop } from "../components/DecisionLoopPanel";
import DecisionNudge from "../components/DecisionNudge";
import FreshnessBadge from "../components/FreshnessBadge";
import ResearchInputPanel, { type ResearchSection } from "../components/ResearchInputPanel";
import { consultationProgress, nextConsultationQuestion, consultationFacts } from "../lib/sectionConsultation";
import {
  emptySdmResearchDraft,
  parseSdmResearchText,
  sdmResearchDraftToPatch,
  type SdmResearchDraft,
} from "../lib/researchCapture";

// D-day 표기 — upcomingBalances 의 daysLeft 를 사람이 읽는 문구로. (음수=지남)
function dDayLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft}일 지남`;
  if (daysLeft === 0) return "오늘";
  return `D-${daysLeft}`;
}

type Props = { data: WeddingData; update: (patch: WeddingUpdate) => void; initialCategory?: SdmCategory };

const CAT_LABEL: Record<SdmCategory, string> = {
  studio: "스튜디오",
  dress: "드레스",
  makeup: "메이크업",
  snap: "본식 스냅",
};

const STATUS_OPTIONS: SdmVendor["status"][] = ["관심", "상담", "계약"];
const CONTRACT_FIELDS: { key: keyof ContractCheck; label: string; placeholder: string }[] = [
  { key: "quote", label: "견적 기준", placeholder: "예: 토탈 패키지, 원장/실장 지정, 촬영 컷 수, 드레스 피팅 횟수" },
  { key: "payment", label: "결제 일정", placeholder: "예: 계약금 30만원, 잔금 촬영 D-7, 현금영수증 가능" },
  { key: "cancellation", label: "취소·변경", placeholder: "예: 일정 변경 1회 가능, 취소 위약금은 계약서 3조 확인" },
  { key: "included", label: "포함 항목", placeholder: "예: 원본 파일, 보정본 20장, 헬퍼비 별도, 부케 대여 포함" },
  { key: "extras", label: "별도 비용", placeholder: "예: 헬퍼비, 출장비, 앨범 추가, 야외 촬영 추가금" },
  { key: "evidence", label: "증빙 보관", placeholder: "예: 계약서 PDF는 드라이브 / 카톡 견적 캡처 저장" },
];

// 상담 직후 머릿속 순서 — 가격·포함(방금 들은 것) → 계약 조건 → 출처·확인일(메타데이터)은 마지막.
const SDM_RESEARCH_SECTIONS: ResearchSection<SdmResearchDraft>[] = [
  {
    title: "상담 요약",
    helper: "방금 들은 가격·포함·별도 비용부터 적어두면 나중에 비교가 쉬워요.",
    fields: [
      { key: "priceRange", label: "가격·패키지", kind: "textarea", placeholder: "예: 토탈 250~320만원, 원본 포함, 헬퍼비 별도" },
      { key: "notes", label: "내 메모", kind: "textarea", placeholder: "컨셉, 응대, 촬영 톤처럼 직접 확인한 사실" },
    ],
  },
  {
    title: "계약 조건",
    fields: [
      { key: "quote", label: "견적 기준", kind: "textarea", placeholder: "패키지명, 작가·실장 지정, 촬영/피팅 횟수" },
      { key: "payment", label: "결제 일정", kind: "textarea", placeholder: "계약금, 잔금일, 카드·현금영수증" },
      { key: "cancellation", label: "취소·변경", kind: "textarea", placeholder: "일정 변경, 환불, 위약금 조건" },
      { key: "included", label: "포함 항목", kind: "textarea", placeholder: "원본, 보정본, 앨범, 액자, 피팅 등" },
      { key: "extras", label: "별도 비용", kind: "textarea", placeholder: "헬퍼비, 출장비, 원본비, 추가 보정 등" },
      { key: "evidence", label: "증빙 보관", kind: "textarea", placeholder: "계약서, 견적서, 캡처 위치" },
    ],
  },
  {
    title: "근거",
    helper: "업체 후기 원문은 보관하지 않고, 확인한 가격·조건·출처만 남겨요.",
    fields: [
      { key: "source", label: "출처·근거", placeholder: "공식 페이지, 인스타, 상담 링크, 전화 상담 등" },
      { key: "lastVerified", label: "확인일", kind: "date", span: "half" },
      { key: "contact", label: "담당자·연락처", span: "half", placeholder: "예: 김실장 010-0000-0000" },
    ],
  },
];

const LOCAL_REGION_KEYS = new Set(["bundang", "busan", "daegu", "etc-local"]);

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
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [notice, setNotice] = useState("");
  const [mineView, setMineView] = useState<"list" | "compare">("list");
  const criteriaRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLElement>(null);

  const inCat = data.sdm.filter((v) => v.category === cat);
  const sectionId = snapOnly ? "snap" : "sdm";
  const routePath = snapOnly ? "/snap" : "/sdm";

  // 다음 납부 — 스드메/스냅 잔금만, 잔금일 순. (읽기 전용)
  const sdmBalances = useMemo(
    () => upcomingBalances(data).filter((b) => b.targetPath === "/sdm" || b.targetPath === "/snap"),
    [data],
  );

  // 미루면 손해 — 무료취소 기한·잔금일을 한 스트립으로. (읽기 전용)
  const lossSignals = useMemo(
    () => lossDeadlinesFor(data, todayISO(), routePath),
    [data, routePath],
  );

  // 정한 기준 — 기준 질문 답변을 후보 비교 화면의 판단 재료로 승격.
  const decidedFacts = useMemo(() => consultationFacts(data, sectionId), [data, sectionId]);

  // 계약금+잔금 → 예산 흐름 알림 (제안이 있을 때만)
  // sdm 제안은 카테고리별(sdm-studio/dress/makeup)로 나뉘므로 가장 큰 것 하나를 대표로 보여준다.
  const budgetSuggestion = useMemo(() => {
    const all = budgetSyncSuggestions(data).filter((s) =>
      snapOnly ? s.key === "snap-contract" : s.key.startsWith("sdm-"),
    );
    return all.sort((a, b) => b.suggestedKRW - a.suggestedKRW)[0];
  }, [data, snapOnly]);

  const filteredCatalog = useMemo(() => {
    const regionMatch = REGION_GROUPS.find((g) => g.key === region)?.match ?? (() => true);
    const q = query.trim().toLowerCase();
    return SDM_CATALOG
      .filter((e) => e.category === cat)
      .filter((e) => regionMatch(e.region))
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.vibe.toLowerCase().includes(q));
  }, [cat, region, query]);
  const selectedRegionLabel = REGION_GROUPS.find((g) => g.key === region)?.label ?? "지역";
  const localRegionSelected = catalogOpen && LOCAL_REGION_KEYS.has(region);

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
          link: entry.link,
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
      setNotice(`${v.name}은 이미 ${CAT_LABEL[v.category]} 후보에 있어요.`);
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

  const consultCount = inCat.filter((v) => v.status === "상담" || v.status === "계약").length;
  const contractedCount = inCat.filter((v) => v.status === "계약").length;
  const contractGapCount = inCat.filter((v) => v.status === "계약" && contractFieldCount(v.contract) < 3).length;
  const criteriaProgress = consultationProgress(data, sectionId);
  const activeCriteriaQuestion = nextConsultationQuestion(data, sectionId);
  const sdmAgentSummary = inCat.length === 0
    ? `${CAT_LABEL[cat]} 후보가 아직 없어요. 먼저 2~3곳을 담고, 가격보다 포함 항목과 별도 비용을 같이 비교하면 됩니다.`
    : contractedCount > 0
      ? `계약한 ${CAT_LABEL[cat]} 업체가 ${contractedCount}곳 있어요. 잔금일과 포함/별도 비용을 남기면 예산과 체크리스트가 같이 맞춰집니다.`
      : consultCount > 0
        ? "상담 단계까지 왔어요. 패키지 이름보다 원본·보정·헬퍼비·출장비처럼 빠지기 쉬운 조건을 먼저 비교하세요."
        : "후보는 담겼고 아직 상담 후보가 정해지지 않았어요. 한 곳만 상담 상태로 올려두면 계약 체크 흐름이 열립니다.";

  const promoteFirstVendor = () => {
    const target = inCat.find((v) => v.status === "관심") ?? inCat[0];
    if (!target) return;
    updateVendor(target.id, { status: "상담" });
  };

  const openCriteria = () => {
    setCriteriaOpen(true);
    window.setTimeout(() => criteriaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const openCatalog = () => {
    setCatalogOpen(true);
    window.setTimeout(() => catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const agentTitle = activeCriteriaQuestion
    ? `${CAT_LABEL[cat]} 기준부터 좁힐게요`
    : inCat.length === 0
      ? `${CAT_LABEL[cat]} 후보를 담을 차례예요`
      : contractedCount > 0
        ? "계약 조건을 잠그는 중"
        : "상담 후보를 추리는 중";
  const agentSummary = activeCriteriaQuestion
    ? `${activeCriteriaQuestion.title} 이 답을 정하면 후보를 볼 때 무엇을 먼저 비교할지 선명해져요.`
    : sdmAgentSummary;
  const agentActions: ProcessAgentAction[] = [];
  if (activeCriteriaQuestion || criteriaProgress.answered > 0) {
    agentActions.push({
      label: activeCriteriaQuestion ? "기준 질문 답하기" : "답한 기준 보기",
      onClick: openCriteria,
      tone: activeCriteriaQuestion ? "primary" : "quiet",
    });
  }
  if (inCat.length > 0 && consultCount === 0) {
    agentActions.push({
      label: "첫 후보를 상담으로 표시",
      onClick: promoteFirstVendor,
      tone: activeCriteriaQuestion ? "quiet" : "primary",
    });
  }
  agentActions.push({
    label: catalogOpen ? "후보 목록으로 이동" : "업체 후보 열기",
    onClick: openCatalog,
    tone: activeCriteriaQuestion || (inCat.length > 0 && consultCount === 0) ? "quiet" : "primary",
  });
  agentActions.push({ label: "직접 추가", onClick: () => setShowAdd(true), tone: "quiet" });

  const guide = SDM_GUIDE[cat];

  return (
    <div className="page pt-6 pb-10 space-y-6">
      <div className="space-y-5">
        <div>
          <div className="eyebrow-gold mb-2">{snapOnly ? "본식 촬영" : "스튜디오 · 드레스 · 메이크업"}</div>
          <h1 className="font-serif text-[2rem] leading-none">{koBreak(snapOnly ? "본식 스냅" : "스드메")}</h1>
        </div>

        <SectionDecisionLoop data={data} sectionId="sdm" />

        {/* 카테고리 — underline 탭 */}
        {!snapOnly && (
        <div className="flex items-center gap-6 border-b border-hair pb-3 overflow-x-auto -mx-6 px-6">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => { setCat(c); setCatalogOpen(false); setCriteriaOpen(false); setMineView("list"); }}
              className={`tracking-wide whitespace-nowrap ${cat === c ? "seg-active" : "seg"}`}
            >
              {CAT_LABEL[c]}
            </button>
          ))}
        </div>
        )}

        {!criteriaOpen && (
          <ProcessAgentPanel
            title={agentTitle}
            summary={agentSummary}
            mood={contractGapCount > 0 || (inCat.length > 0 && consultCount === 0) ? "watching" : contractedCount > 0 ? "ready" : "thinking"}
            metrics={[
              { label: "기준", value: `${criteriaProgress.answered}/${criteriaProgress.total}`, tone: criteriaProgress.complete ? "normal" : "warn" },
              { label: "후보", value: `${inCat.length}곳` },
              { label: "계약", value: `${contractedCount}곳`, tone: contractGapCount > 0 ? "warn" : contractedCount ? "normal" : "muted" },
            ]}
            actions={agentActions}
          />
        )}
      </div>

      {criteriaOpen && (
        <div ref={criteriaRef}>
          <SectionConsultationPanel
            sectionId={sectionId}
            data={data}
            update={update}
            open={criteriaOpen}
            onOpenChange={setCriteriaOpen}
          />
        </div>
      )}

      {notice && (
        <div className="anim-fade border-y border-hair py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] leading-relaxed text-soft">
              <span className="font-semibold text-ink">Dearie</span> · {notice}
            </p>
            <button type="button" onClick={() => setNotice("")} className="min-h-11 min-w-11 text-soft hover:text-ink" aria-label="안내 닫기">
              ×
            </button>
          </div>
        </div>
      )}

      {/* 미루면 손해 — 무료취소 기한·잔금일 임박 순 (읽기 전용) */}
      {lossSignals.length > 0 && (
        <div className="border-y border-hair py-4">
          <div className="eyebrow mb-3">미루면 손해</div>
          <ul className="space-y-2.5">
            {lossSignals.slice(0, 4).map((d) => (
              <li key={d.id} className="text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ink break-keep min-w-0 truncate">
                    {d.name} {d.label}
                    {d.amountKRW ? <span className="tabular-nums"> · {formatKRW(d.amountKRW)}</span> : null}
                  </span>
                  <span
                    className={`tabular-nums whitespace-nowrap flex-shrink-0 ${
                      d.severity === "high" ? "text-gold" : d.severity === "medium" ? "text-gold/80" : "text-soft"
                    }`}
                  >
                    {lossDdayLabel(d.daysLeft)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-soft break-keep">{d.lossHint}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 내 후보 */}
      {inCat.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 className="section-title">{koBreak("내 후보 · ")}<span className="tabular-nums">{inCat.length}</span></h2>
            <button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">+ 직접 추가</button>
          </div>
          {inCat.length >= 2 && (
            <div className="mb-4 flex items-center gap-5 border-b border-hair pb-3 overflow-x-auto">
              <button
                onClick={() => setMineView("list")}
                className={`tracking-wide whitespace-nowrap ${mineView === "list" ? "seg-active" : "seg"}`}
              >
                목록
              </button>
              <button
                onClick={() => setMineView("compare")}
                className={`tracking-wide whitespace-nowrap ${mineView === "compare" ? "seg-active" : "seg"}`}
              >
                나란히 비교
              </button>
            </div>
          )}
          {/* 정한 기준 — 기준 질문의 답이 실제 비교 화면에 보이게 */}
          {decidedFacts.length > 0 && (
            <p className="mb-3 text-[12px] text-soft break-keep leading-relaxed">
              <span className="text-ink">정한 기준</span> · {decidedFacts.join(" · ")}
            </p>
          )}
          {mineView === "compare" && inCat.length >= 2 ? (
            <SdmCompare vendors={inCat} balances={sdmBalances} />
          ) : (
            <div className="group-card px-4">
              {inCat.map((v) => (
                <MyVendorCard
                  key={v.id}
                  v={v}
                  dueDaysLeft={sdmBalances.find((b) => b.name === v.name)?.daysLeft}
                  onUpdate={(patch) => updateVendor(v.id, patch)}
                  onRemove={() => remove(v.id)}
                />
              ))}
            </div>
          )}
          {/* 계약 합계 → 예산 흐름 — 같은 숫자를 두 번 치지 않게 */}
          {budgetSuggestion && (
            <p className="mt-3 text-[12px] text-soft break-keep leading-relaxed">
              계약 합계 <span className="text-ink tabular-nums">{formatKRW(budgetSuggestion.suggestedKRW)}</span>
              {"이 예산표로 이어질 준비가 됐어요. "}
              <Link to="/budget" className="underline underline-offset-4 text-ink hover:text-gold">예산에서 반영 →</Link>
            </p>
          )}
        </section>
      )}

      {/* 가이드 (접이식) — hairline */}
      <details className="border-y border-hair py-4">
        <summary className="cursor-pointer flex items-baseline justify-between gap-4">
          <span>
            <span className="section-title block">{guide.title}</span>
            <span className="mt-1 block text-[11.5px] text-soft">고를 때 헷갈리는 기준을 짧게 정리했어요.</span>
          </span>
          <span className="text-soft text-[12px] group-open:rotate-180 transition">보기</span>
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-[13px] leading-loose text-soft">{guide.tip}</p>
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

      {/* 검색 + 지역 필터 */}
      <section ref={catalogRef} className="space-y-5">
        <div className="border-y border-hair py-4">
          <button onClick={() => setCatalogOpen((open) => !open)} className="flex w-full items-center justify-between gap-4 text-left">
            <span>
              <span className="section-title block">업체 후보 더 찾아보기</span>
              <span className="mt-1 block text-[11.5px] text-soft">지역과 분위기로 목록을 검색합니다.</span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4">{catalogOpen ? "접기" : "열기"}</span>
          </button>
        </div>

        {catalogOpen && <>
        {inCat.length === 0 && (
          <div className="flex justify-end"><button onClick={() => setShowAdd(true)} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">+ 직접 추가</button></div>
        )}
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
              className={`tracking-wide whitespace-nowrap ${region === g.key ? "seg-active" : "seg"}`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {filteredCatalog.length === 0 ? (
          <p className="text-center text-[12.5px] text-soft py-8">
            {localRegionSelected
              ? `${selectedRegionLabel}은 검증된 업체명이 아직 부족해요. 지역명만 붙인 후보는 넣지 않았으니, 아래 검색 안내로 먼저 확인해보세요.`
              : "조건에 맞는 곳이 없어요. 다른 지역·검색어를 시도해보세요."}
          </p>
        ) : (
          <div className="group-card px-4">
            {filteredCatalog.map((e) => {
              const added = data.sdm.some((v) => v.name === e.name && v.category === e.category);
              return <CatalogCard key={e.id} entry={e} added={added} onAdd={() => addFromCatalog(e)} />;
            })}
          </div>
        )}
        <p className="eyebrow text-center">
          총 <span className="tabular-nums">{filteredCatalog.length}</span>곳 표시 · 전체 <span className="tabular-nums">{SDM_CATALOG.filter((e) => e.category === cat).length}</span>
        </p>
        </>}
      </section>

      {/* 지방 안내 */}
      {localRegionSelected && (
        <div className="py-5 border-t border-b border-hair text-[12px] text-soft leading-relaxed space-y-2">
          <p><b className="text-ink">지방 SDM은 실시간 후기와 담당자 확인이 더 중요해요.</b></p>
          <p>
            Dearie에는 공식·반복 언급이 확인된 이름만 담습니다. 먼저{" "}
            <b className="text-ink">{selectedRegionLabel} {CAT_LABEL[cat]} 후기</b>,{" "}
            <b className="text-ink">{selectedRegionLabel} 웨딩 {CAT_LABEL[cat]}</b>로 검색하고,
            결혼 카페의 지역 게시판에서 최근 6개월 후기를 확인하세요.
          </p>
          <p>마음에 드는 곳을 찾으면 [직접 추가]로 담아 상담·계약 체크리스트를 이어갈 수 있어요.</p>
        </div>
      )}

      {/* 가격대 + 면책 */}
      {catalogOpen && <div className="py-5 border-t border-hair text-[11.5px] text-soft leading-relaxed space-y-3">
        <p>{SDM_PRICE_RANGE_NOTE}</p>
        <p>
          이 목록은 결혼 준비 단계에서의 출발점일 뿐이에요. 완전한 리스트도, 순위도, 추천도 아닙니다.
          검증일이 따로 없는 목록이고, 업체 이전·실장 이동·이름 변경이 잦으니 최종 결정 전 직접 확인이 꼭 필요해요.
          <strong className="text-ink"> 어떤 업체와도 제휴·후원·광고 관계 없음</strong>.
        </p>
        <p>
          표시 삭제·정정 요청은{" "}
          <a href="mailto:yclee913@gmail.com" rel="noopener noreferrer" className="underline underline-offset-2 text-ink">yclee913@gmail.com</a>
          {" "}으로 — 24시간 내 처리해드립니다.
        </p>
      </div>}

      {/* 더 알아보기 */}
      {catalogOpen && <button
        onClick={() => setShowChannels(true)}
        className="block w-full text-left py-5 border-t border-b border-hair active:opacity-60 transition"
      >
        <div className="font-serif text-[15px] text-ink">더 자세히 알아보려면 →</div>
        <p className="text-[12px] text-soft mt-1">결혼 카페 · 인스타 · 유튜브 — 사람들이 실제 정보 얻는 곳</p>
      </button>}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`${CAT_LABEL[cat]} 직접 추가`}>
        <CustomAdd category={cat} onAdd={addCustom} />
      </Modal>

      <Modal open={showChannels} onClose={() => setShowChannels(false)} title="실제 정보 얻는 곳">
        <p className="text-sm text-soft mb-4 leading-relaxed">
          사람들 대부분은 결혼 카페·인스타·유튜브에서 더 풍부한 후기를 봐요.
          후기는 단가·실장 이름·시즌별 패키지처럼 공식 사이트엔 안 나오는 정보가 많습니다.
        </p>
        <ul className="group-card px-4">
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
          <div className="text-[12px] text-soft mt-1 leading-relaxed line-clamp-2 break-keep">{entry.vibe}</div>
          {entry.region && <div className="eyebrow mt-2">{entry.region}</div>}
        </div>
        <button
          onClick={onAdd}
          disabled={added}
          className={`text-[11.5px] tracking-wide whitespace-nowrap flex-shrink-0 underline underline-offset-4 ${
            added ? "text-ink" : "text-gold hover:text-ink"
          }`}
        >
          {added ? "✓ 담음" : "+ 담기"}
        </button>
      </div>
      <div className="mt-3">
        <VendorActions name={entry.name} region={entry.region} officialUrl={entry.link} />
      </div>
    </div>
  );
}

function SdmResearchInput({
  vendor,
  onUpdate,
  defaultOpen = false,
  applyLabel,
}: {
  vendor: Partial<SdmVendor>;
  onUpdate: (patch: Partial<SdmVendor>) => void;
  defaultOpen?: boolean;
  applyLabel?: string;
}) {
  const [draft, setDraft] = useState<SdmResearchDraft>(() => emptySdmResearchDraft(vendor));
  return (
    <ResearchInputPanel
      title="메모 정리"
      subtitle="가격·포함 항목·별도 비용을 상담 기준으로 정리합니다."
      rawPlaceholder={
        "예: 토탈 패키지 280만원 / 원본 포함 / 보정 20장 / 헬퍼비 별도 / 계약금 30만원 / 잔금 촬영 D-7 / 출처 URL"
      }
      draft={draft}
      sections={SDM_RESEARCH_SECTIONS}
      onDraftChange={setDraft}
      onParse={parseSdmResearchText}
      onApply={() => onUpdate(sdmResearchDraftToPatch(draft))}
      applyLabel={applyLabel}
      defaultOpen={defaultOpen}
    />
  );
}

// 담아둔 스드메/스냅 후보를 한눈에 — 가격·계약 조건·마감일을 나란히 놓고 비교한다.
// 모바일 폭에서는 후보 수가 늘면 가로 스크롤하고, 항목 라벨 열은 고정한다.
function SdmCompare({
  vendors,
  balances,
}: {
  vendors: SdmVendor[];
  balances: Array<{ name: string; daysLeft: number }>;
}) {
  const rows: { label: string; get: (v: SdmVendor) => string; warn?: (v: SdmVendor) => boolean }[] = [
    { label: "지역", get: (v) => v.region || "—" },
    { label: "상태", get: (v) => v.status || "관심", warn: (v) => v.status === "계약" && contractFieldCount(v.contract) < 3 },
    { label: "가격 메모", get: (v) => v.priceRange || "—" },
    { label: "계약금", get: (v) => moneyOrDash(v.depositKRW) },
    { label: "잔금", get: (v) => moneyOrDash(v.balanceKRW) },
    { label: "총액", get: (v) => moneyOrDash(totalContractKRW(v)) },
    {
      label: "잔금일",
      get: (v) => {
        const due = balances.find((item) => item.name === v.name);
        if (!v.balanceDueAt) return "—";
        return due ? `${v.balanceDueAt.slice(0, 10)} · ${dDayLabel(due.daysLeft)}` : v.balanceDueAt.slice(0, 10);
      },
      warn: (v) => {
        const due = balances.find((item) => item.name === v.name);
        return (due?.daysLeft ?? 999) <= 14;
      },
    },
    { label: "무료취소", get: (v) => v.freeCancelUntil?.slice(0, 10) || "—", warn: (v) => v.status === "계약" && !v.freeCancelUntil },
    { label: "계약 체크", get: (v) => `${contractFieldCount(v.contract)}/${CONTRACT_FIELDS.length}`, warn: (v) => v.status === "계약" && contractFieldCount(v.contract) < 3 },
    { label: "포함 항목", get: (v) => compactCell(v.contract?.included) },
    { label: "별도 비용", get: (v) => compactCell(v.contract?.extras), warn: (v) => v.status !== "관심" && !v.contract?.extras?.trim() },
    { label: "출처", get: (v) => v.source || v.link || "—" },
    { label: "확인일", get: (v) => v.lastVerified || "—" },
  ];

  return (
    <div className="overflow-x-auto -mx-6 px-6 scrollbar-hide">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 bg-paper z-10 w-[72px]" />
            {vendors.map((vendor) => (
              <th key={vendor.id} className="min-w-[136px] px-3 pb-3 text-left align-bottom">
                <span className="font-serif text-[14px] leading-tight text-ink break-keep">{vendor.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hair border-t border-hair">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="sticky left-0 z-10 bg-paper py-3 pr-3 align-top eyebrow whitespace-nowrap">
                {row.label}
              </td>
              {vendors.map((vendor) => (
                <td
                  key={vendor.id}
                  className={`max-w-[180px] px-3 py-3 align-top text-[12.5px] leading-relaxed ${
                    row.warn?.(vendor) ? "text-gold" : "text-ink/90"
                  }`}
                >
                  <span className="line-clamp-3 break-keep">{row.get(vendor)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MyVendorCard({
  v, dueDaysLeft, onUpdate, onRemove,
}: {
  v: SdmVendor;
  dueDaysLeft?: number;
  onUpdate: (patch: Partial<SdmVendor>) => void;
  onRemove: () => void;
}) {
  const updateContract = (patch: Partial<ContractCheck>) => {
    onUpdate({ contract: cleanContract({ ...(v.contract ?? {}), ...patch }) });
  };
  // 계약 + 잔금 남음 + 잔금일 있음 → 요약에 D-day 칩. daysLeft 는 upcomingBalances 가 계산한 값을 그대로 재사용.
  const showDueChip =
    v.status === "계약" &&
    (v.balanceKRW ?? 0) > 0 &&
    !!v.balanceDueAt &&
    dueDaysLeft !== undefined;
  const [open, setOpen] = useState(false);
  const contractCount = contractFieldCount(v.contract);
  const evidenceCount = [
    v.source,
    v.lastVerified,
    v.priceRange,
    v.contact,
    v.depositKRW,
    v.balanceKRW,
    v.balanceDueAt,
    contractCount > 0 ? String(contractCount) : undefined,
  ].filter(Boolean).length;
  const judgement = v.status === "계약"
    ? contractCount >= 3 ? "계약 조건 확인 중" : "계약 체크 부족"
    : v.status === "상담"
      ? "상담 내용 비교"
      : v.priceRange
        ? "전화 확인 후보"
        : "기본 조건 필요";
  const question = v.status === "계약"
    ? contractCount >= 3 ? "잔금일·취소 조건" : "포함 항목·추가금"
    : v.status === "상담"
      ? "원본·수정본·추가금"
      : v.priceRange
        ? "가능 일정과 견적 기준"
        : "가격과 촬영 가능일";
  return (
    <div className="py-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-serif text-[15px] text-ink break-keep">{v.name}</span>
            {showDueChip && (
              <span className="text-[10.5px] tracking-eyebrow uppercase text-gold tabular-nums whitespace-nowrap">
                {dDayLabel(dueDaysLeft!)}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {v.region && <div className="eyebrow">{v.region}</div>}
            {(v.lastVerified || v.source) && <FreshnessBadge lastVerified={v.lastVerified} />}
          </div>
        </div>
        <button onClick={onRemove} aria-label={`${v.name} 삭제`} className="flex min-h-11 min-w-11 items-center justify-center text-soft hover:text-ink text-sm">×</button>
      </div>

      <DecisionNudge
        judgement={judgement}
        question={question}
        tone={v.status === "계약" && contractCount < 3 ? "warn" : "normal"}
      />

      <div className="space-y-2 text-[12px] text-soft leading-relaxed">
        {v.notes && <p className="text-ink/85 break-keep line-clamp-2">{v.notes}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="eyebrow">상태 {v.status ?? "관심"}</span>
          {v.priceRange && <span className="tabular-nums">가격 {v.priceRange}</span>}
          {contractCount > 0 && <span>계약 체크 {contractCount}/6</span>}
          {evidenceCount > 0 && <span>조사칸 {evidenceCount}개</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-4 border-t border-hair pt-3 text-left text-[12px] text-ink hover:text-gold"
      >
        <span>{open ? "조사·계약 메모 접기" : "조사·계약 메모 열기"}</span>
        <span className="text-soft">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-hair pt-4">
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

          {/* 1. 가격·견적 — 상담 직후 머릿속 1순위 */}
          <input
            className="input text-[13px]"
            placeholder="가격 메모 (예: 토탈 280만원, 원본 포함)"
            value={v.priceRange ?? ""}
            onChange={(e) => onUpdate({ priceRange: e.target.value })}
          />
          {v.status !== "관심" && (
            <div className="space-y-3">
              {/* 읽기 전용 원장 한 줄 — 선금·잔금·잔금일이 모두 채워졌을 때만 */}
              {(v.depositKRW ?? 0) > 0 && (v.balanceKRW ?? 0) > 0 && v.balanceDueAt && (
                <div className="text-[12px] text-soft tabular-nums break-keep">
                  선금 {formatKRW(v.depositKRW!)} · 잔금 {formatKRW(v.balanceKRW!)} · 잔금일 {v.balanceDueAt.slice(0, 10)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4">
                <div>
                  <label className="label">계약금 (원)</label>
                  <input
                    type="number"
                    min={0}
                    className="input text-[13px] tabular-nums"
                    placeholder="0"
                    value={v.depositKRW ?? ""}
                    onChange={(e) => onUpdate({ depositKRW: parseAmount(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">잔금 (원)</label>
                  <input
                    type="number"
                    min={0}
                    className="input text-[13px] tabular-nums"
                    placeholder="0"
                    value={v.balanceKRW ?? ""}
                    onChange={(e) => onUpdate({ balanceKRW: parseAmount(e.target.value) })}
                  />
                </div>
              </div>
              {(v.depositKRW || v.balanceKRW) ? (
                <div className="eyebrow tabular-nums">
                  합계 {formatKRW((v.depositKRW ?? 0) + (v.balanceKRW ?? 0))}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-x-4">
                <div>
                  <label className="label">잔금 납부일</label>
                  <input
                    type="date"
                    className="input text-[13px] tabular-nums"
                    value={v.balanceDueAt ?? ""}
                    onChange={(e) => onUpdate({ balanceDueAt: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <label className={v.status === "계약" && !v.freeCancelUntil ? "label text-gold" : "label"}>
                    무료취소 기한
                  </label>
                  <input
                    type="date"
                    className="input text-[13px] tabular-nums"
                    value={v.freeCancelUntil ?? ""}
                    onChange={(e) => onUpdate({ freeCancelUntil: e.target.value || undefined })}
                  />
                </div>
              </div>
              {v.status === "계약" && !v.freeCancelUntil && (
                <p className="text-[11.5px] text-soft leading-relaxed break-keep">
                  무료취소 기한을 넣어두면 위약금이 생기기 전에 D-day로 챙겨드려요.
                </p>
              )}
            </div>
          )}

          {/* 2. 상담 요약 · 계약 조건 */}
          <SdmResearchInput vendor={v} onUpdate={onUpdate} />
          <textarea
            className="input-boxed text-[13px] min-h-[50px]"
            placeholder="메모 (실장 이름·인상·촬영 톤 등)"
            value={v.notes ?? ""}
            onChange={(e) => onUpdate({ notes: e.target.value })}
          />
          {v.status !== "관심" && (
            <div className="space-y-3">
              <input
                className="input text-[13px]"
                placeholder="담당자·업체 연락처"
                value={v.contact ?? ""}
                onChange={(e) => onUpdate({ contact: e.target.value })}
              />
              <ContractFields contract={v.contract} freeCancelUntil={v.freeCancelUntil} onUpdate={updateContract} />
            </div>
          )}

          {/* 3. 출처 — 마지막 */}
          <input
            className="input text-[13px]"
            placeholder="링크 (인스타·홈피)"
            value={v.link ?? ""}
            onChange={(e) => onUpdate({ link: e.target.value })}
          />
          <VendorActions name={v.name} region={v.region} officialUrl={v.link} sourceUrl={v.source} />
        </div>
      )}
    </div>
  );
}

function ContractFields({
  contract,
  freeCancelUntil,
  onUpdate,
}: {
  contract?: ContractCheck;
  freeCancelUntil?: string;
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
          모든 칸을 채울 필요는 없어요. 패키지에 포함되는 것과 별도 비용처럼 나중에 헷갈릴 조건만 남기면 충분합니다.
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
            {field.key === "cancellation" && (
              <p className="mt-1 text-[11px] text-soft leading-relaxed break-keep">
                {freeCancelUntil
                  ? `무료취소 기한 ${freeCancelUntil.slice(0, 10)} 기준으로 D-day를 챙겨드려요.`
                  : "무료취소 기한은 위의 날짜 칸에도 기록해두면 D-day로 챙겨드려요."}
              </p>
            )}
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

function totalContractKRW(vendor: SdmVendor): number | undefined {
  const total = (vendor.depositKRW ?? 0) + (vendor.balanceKRW ?? 0);
  return total > 0 ? total : undefined;
}

function moneyOrDash(value?: number): string {
  return value && value > 0 ? formatKRW(value) : "—";
}

function compactCell(value?: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  return trimmed;
}

// 금액 입력 파싱 — Budget.tsx 와 동일 규칙(원 단위 그대로 저장). 빈 칸 undefined, 음수 거부.
function parseAmount(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
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
  const [draft, setDraft] = useState<SdmResearchDraft>(() => emptySdmResearchDraft());
  const submit = () => {
    if (!name.trim()) return;
    const patch = sdmResearchDraftToPatch(draft);
    onAdd({
      category,
      name: name.trim(),
      region: region.trim() || undefined,
      link: link.trim() || undefined,
      status: "관심",
      ...patch,
    });
    setName("");
    setRegion("");
    setLink("");
    setDraft(emptySdmResearchDraft());
  };
  return (
    <div className="space-y-3">
      <input className="input text-[13px]" placeholder="업체 이름" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input text-[13px]" placeholder="지역 (예: 청담)" value={region} onChange={(e) => setRegion(e.target.value)} />
      <input className="input text-[13px]" placeholder="홈페이지·인스타 링크" value={link} onChange={(e) => setLink(e.target.value)} />
      <ResearchInputPanel
        title="메모 정리"
        subtitle="상담 메모를 붙여넣어 가격·포함·별도 비용을 정리합니다."
        rawPlaceholder={
          "예: 280만원 패키지 / 원본 포함 / 보정 20장 / 헬퍼비 별도 / 계약금 30만원 / 출처 URL"
        }
        draft={draft}
        sections={SDM_RESEARCH_SECTIONS}
        onDraftChange={setDraft}
        onParse={parseSdmResearchText}
        onApply={submit}
        applyLabel="업체 추가 →"
        applyDisabled={!name.trim()}
        applyHint="업체 이름을 먼저 적어주세요."
        defaultOpen
      />
    </div>
  );
}
