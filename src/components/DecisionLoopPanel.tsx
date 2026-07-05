import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import {
  decisionMap,
  planningStatusReport,
  type DecisionItem,
  type DecisionSection,
  type PlanningSectionStatus,
} from "../lib/derived";
import {
  buildDecisionPacket,
  decisionCalendarIcs,
  firstDecisionForSection,
  sectionLabel,
} from "../lib/decisionPackets";
import DecisionReceipt from "./DecisionReceipt";
import { koBreak } from "../lib/typography";

type Props = {
  data: WeddingData;
  item?: DecisionItem;
  sectionId?: DecisionSection;
  heading?: string;
  compact?: boolean;
  className?: string;
  includeOpenLink?: boolean;
};

export default function DecisionLoopPanel({ data, item, sectionId, heading, compact = false, className = "", includeOpenLink = true }: Props) {
  const decision = useMemo(() => item ?? (sectionId ? firstDecisionForSection(data, sectionId) : undefined), [data, item, sectionId]);
  if (!decision) return null;

  const packet = buildDecisionPacket(decision, data, browserBaseUrl());

  if (compact) {
    return (
      <section className={`decision-loop decision-loop-compact ${className}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="home-kicker mb-1">{heading ?? "같이 볼 결정"}</div>
            <h2 className="text-[14.5px] font-semibold leading-snug text-ink break-keep">
              {koBreak(decision.title)}
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-soft break-keep">
              {decision.whyNow}
            </p>
          </div>
          {decision.risk && (
            <span className={`decision-risk decision-risk-${decision.risk.level}`}>
              {decision.risk.label}
            </span>
          )}
        </div>
        <DecisionLoopActions data={data} item={decision} compact includeOpenLink={includeOpenLink} />
      </section>
    );
  }

  return (
    <section className={`decision-loop ${compact ? "decision-loop-compact" : ""} ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="eyebrow-gold">{heading ?? "이 화면에서 같이 볼 결정"}</span>
            {!compact && <span className="text-[11px] font-medium text-soft">{packet.stageLabel}</span>}
          </div>
          <h2 className="text-[16px] font-semibold leading-snug text-ink break-keep md:text-[17px]">
            {koBreak(decision.title)}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-soft break-keep">
            {decision.whyNow}
          </p>
        </div>
        {decision.risk && (
          <span className={`decision-risk decision-risk-${decision.risk.level}`}>
            {decision.risk.label}
          </span>
        )}
      </div>

      {!compact && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <DecisionMiniBlock label="준비된 재료" values={decision.preparedFacts.slice(0, 3)} />
          <DecisionMiniBlock label="확인할 것" values={decision.missingInputs.slice(0, 3)} accent />
        </div>
      )}

      <p className="mt-3 border-t border-hair pt-3 text-[12.5px] leading-relaxed text-ink/80 break-keep">
        {packet.outcome}
      </p>

      <DecisionLoopActions data={data} item={decision} includeOpenLink={includeOpenLink} />
    </section>
  );
}

export function SectionDecisionLoop({ data, sectionId, heading }: { data: WeddingData; sectionId: DecisionSection; heading?: string }) {
  return <SectionJourneyPanel data={data} sectionId={sectionId} heading={heading} />;
}

export function DecisionLoopList({
  data,
  heading = "같이 볼 결정 보내기",
  limit = 3,
}: {
  data: WeddingData;
  heading?: string;
  limit?: number;
}) {
  const items = useMemo(() => decisionMap(data).items.slice(0, limit), [data, limit]);
  if (items.length === 0) return null;

  return (
    <section className="app-section px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <div className="eyebrow-gold mb-1">{heading}</div>
          <p className="text-[12px] leading-relaxed text-soft break-keep">같이 확인할 내용만 짧게 보낼 수 있어요.</p>
        </div>
        <span className="eyebrow tabular-nums">{items.length}개</span>
      </div>
      <div className="group-card">
        {items.map((item) => (
          <div key={item.id} className="py-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-gold">{item.risk?.label ?? sectionLabel(item.section)}</div>
                <div className="mt-0.5 text-[13.5px] font-semibold leading-snug text-ink break-keep">{item.title}</div>
              </div>
              <Link to={item.to} className="min-h-9 shrink-0 text-[12px] text-soft underline underline-offset-4 hover:text-ink">
                화면 보기
              </Link>
            </div>
            <DecisionLoopActions data={data} item={item} compact includeOpenLink={false} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function DecisionLoopActions({
  data,
  item,
  compact = false,
  includeOpenLink = true,
}: {
  data: WeddingData;
  item?: DecisionItem;
  compact?: boolean;
  includeOpenLink?: boolean;
}) {
  const [notice, setNotice] = useState("");
  const packet = useMemo(() => item ? buildDecisionPacket(item, data, browserBaseUrl()) : null, [data, item]);
  if (!item || !packet) return null;

  const showNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(packet.shareText);
      showNotice("같이 볼 내용을 복사했어요.");
    } catch {
      window.prompt("아래 내용을 복사해 보내세요:", packet.shareText);
      showNotice("복사 창을 열었어요.");
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) {
      await copyMessage();
      return;
    }
    try {
      await navigator.share({ title: item.title, text: packet.shareText });
      showNotice("공유 메뉴를 열었어요.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyMessage();
    }
  };

  const downloadCalendar = () => {
    if (!packet.calendar) return;
    const ics = decisionCalendarIcs(packet.calendar, browserBaseUrl() ? new URL(item.to, browserBaseUrl()).toString() : undefined);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = packet.calendar.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showNotice("캘린더 일정을 만들었어요.");
  };

  if (compact && !includeOpenLink) {
    return (
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hair pt-2">
          <button type="button" onClick={copyMessage} className="min-h-9 text-[12px] font-medium text-soft underline underline-offset-4 hover:text-ink">
            같이 볼 내용 복사
          </button>
          {packet.calendar ? (
            <button type="button" onClick={downloadCalendar} className="min-h-9 text-[12px] font-medium text-soft underline underline-offset-4 hover:text-ink">
              캘린더 일정 만들기
            </button>
          ) : (
            <button type="button" onClick={nativeShare} className="min-h-9 text-[12px] font-medium text-soft underline underline-offset-4 hover:text-ink">
              공유 메뉴 열기
            </button>
          )}
        </div>
        {notice && <p className="mt-1 text-[11.5px] leading-relaxed text-soft" role="status">{notice}</p>}
      </div>
    );
  }

  return (
    <div className={`${compact ? "mt-2" : "mt-4"}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {includeOpenLink && (
          <Link to={item.to} className="decision-loop-action">
            <span>{item.nextAction}</span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
        <button type="button" onClick={copyMessage} className="decision-loop-action">
          <span>같이 볼 내용 복사</span>
          <span aria-hidden="true">↗</span>
        </button>
        {packet.calendar ? (
          <button type="button" onClick={downloadCalendar} className="decision-loop-action col-span-2 sm:col-span-1">
            <span>캘린더 일정 만들기</span>
            <span aria-hidden="true">＋</span>
          </button>
        ) : (
          <button type="button" onClick={nativeShare} className="decision-loop-action col-span-2 sm:col-span-1">
            <span>공유 메뉴 열기</span>
            <span aria-hidden="true">↗</span>
          </button>
        )}
      </div>
      {notice && <p className="mt-2 text-[11.5px] leading-relaxed text-soft" role="status">{notice}</p>}
    </div>
  );
}

function DecisionMiniBlock({ label, values, accent = false }: { label: string; values: string[]; accent?: boolean }) {
  return (
    <div className={`border px-3 py-3 ${accent ? "border-gold/30 bg-gold/5" : "border-line bg-vellum/80"}`}>
      <div className={accent ? "eyebrow-gold" : "eyebrow"}>{label}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="border border-line bg-vellum/90 px-2 py-1 text-[11px] leading-none text-ink">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

type JourneyTone = "waiting" | "active" | "attention" | "done";

type SectionJourneyConfig = {
  eyebrow: string;
  steps: readonly string[];
  helper: string;
};

const SECTION_JOURNEYS: Record<DecisionSection, SectionJourneyConfig> = {
  venues: {
    eyebrow: "장소 결정",
    steps: ["기준", "후보", "질문", "상담", "비교", "계약"],
    helper: "예식장은 후보를 많이 보는 화면이 아니라, 계약 전 흔들릴 조건을 줄이는 화면입니다.",
  },
  budget: {
    eyebrow: "돈 결정",
    steps: ["기준", "예상", "계약", "초과", "지출", "확정"],
    helper: "예산은 총액보다 오늘 흔들리는 항목과 앞으로 빠질 돈을 먼저 봅니다.",
  },
  guests: {
    eyebrow: "하객 결정",
    steps: ["범위", "명단", "초대", "회신", "식수", "확정"],
    helper: "하객 관리는 이름을 모으는 일이 아니라 보증인원과 식대 리스크를 줄이는 일입니다.",
  },
  invitation: {
    eyebrow: "초대 결정",
    steps: ["정보", "문안", "디자인", "공개", "회신", "확정"],
    helper: "청첩장은 예쁜 화면보다 하객이 헷갈리지 않고 답할 수 있는 상태가 먼저입니다.",
  },
  sdm: {
    eyebrow: "업체 결정",
    steps: ["기준", "후보", "상담", "비교", "계약", "촬영"],
    helper: "스드메는 취향 후보와 계약 조건을 같은 기준으로 놓아야 비교가 됩니다.",
  },
  rings: {
    eyebrow: "반지 결정",
    steps: ["취향", "예산", "후보", "착용", "결정", "수령"],
    helper: "반지는 브랜드보다 오래 낄 기준, 예산, 수령 일정을 잠그는 화면입니다.",
  },
  trip: {
    eyebrow: "여행 결정",
    steps: ["톤", "지역", "항공", "숙소", "총액", "예약"],
    helper: "신혼여행은 로망과 실제 예약 조건을 한 화면에서 좁혀야 합니다.",
  },
  checklist: {
    eyebrow: "준비 리듬",
    steps: ["기준", "이번주", "마감", "처리", "확인", "완료"],
    helper: "체크리스트는 할 일을 많이 보이는 곳이 아니라 이번 주에 막힐 일을 줄이는 곳입니다.",
  },
  ceremony: {
    eyebrow: "본식 운영",
    steps: ["식순", "역할", "시간", "음악", "공유", "확정"],
    helper: "본식 진행표는 당일에 누가 무엇을 언제 하는지 헷갈리지 않게 잠그는 화면입니다.",
  },
  video: {
    eyebrow: "영상 결정",
    steps: ["톤", "사진", "순서", "음악", "미리보기", "파일"],
    helper: "식전영상은 분위기보다 사진, 음악, 파일 제출 상태가 맞아야 완성됩니다.",
  },
  share: {
    eyebrow: "공유 결정",
    steps: ["범위", "백업", "링크", "권한", "확인", "안심"],
    helper: "공유는 링크를 만드는 일이 아니라 부부와 하객에게 보여줄 범위를 정하는 일입니다.",
  },
};

function SectionJourneyPanel({
  data,
  sectionId,
  heading,
}: {
  data: WeddingData;
  sectionId: DecisionSection;
  heading?: string;
}) {
  const decision = useMemo(() => firstDecisionForSection(data, sectionId), [data, sectionId]);
  const status = useMemo(
    () => planningStatusReport(data).sections.find((section) => section.key === sectionId),
    [data, sectionId],
  );
  const config = SECTION_JOURNEYS[sectionId];
  if (!decision && !status) return null;

  const state = journeyState(decision, status, config.steps.length);
  const prepared = decision?.preparedFacts?.slice(0, 3) ?? compactStatusFacts(status);
  const missing = decision?.missingInputs?.slice(0, 3) ?? compactStatusMissing(status);
  const title = heading ?? decision?.title ?? status?.nextAction ?? sectionLabel(sectionId);
  const body = decision?.whyNow ?? status?.detail ?? config.helper;
  const metricRows = [
    { label: "흐름", value: shortJourneyLabel(state.label), warn: state.tone === "attention" },
    { label: "재료", value: `${prepared.length}개`, warn: false },
    { label: "확인", value: `${missing.length}개`, warn: missing.length > 0 },
  ];

  return (
    <section className="section-journey">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="home-kicker">{config.eyebrow}</span>
            <span className="hidden text-[11.5px] text-soft sm:inline">{config.steps[0]}에서 {config.steps[config.steps.length - 1]}까지</span>
          </div>
          <h2 className="section-journey-title">{koBreak(title)}</h2>
          <div className="mt-3">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className={`text-[12px] font-semibold ${state.tone === "attention" ? "text-gold" : "text-ink"}`}>{state.label}</span>
              {decision?.risk && <span className={`decision-risk decision-risk-${decision.risk.level}`}>{decision.risk.label}</span>}
            </div>
            <div className="journey-lock">
              <span>{missing[0] ?? config.helper}</span>
            </div>
            <details className="journey-details">
              <summary>전체 단계 보기</summary>
              <JourneyTrack steps={config.steps} stepIndex={state.stepIndex} tone={state.tone} />
            </details>
          </div>
          <p className="mt-3 max-w-[42rem] text-[13.5px] leading-relaxed text-soft break-keep">
            {body || config.helper}
          </p>
        </div>
        <div className="section-journey-metrics">
          {metricRows.map((row) => (
            <div key={row.label} className={`section-journey-metric ${row.warn ? "section-journey-metric-warn" : ""}`}>
              <div className="section-journey-metric-label">{row.label}</div>
              <div className="section-journey-metric-value">{row.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="journey-facts">
        <JourneyFactBlock label="준비된 재료" values={prepared} />
        <JourneyFactBlock label="물어볼 점" values={missing} accent />
      </div>

      {decision ? (
        <DecisionLoopActions data={data} item={decision} compact includeOpenLink={false} />
      ) : (
        <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-soft break-keep">{config.helper}</p>
      )}

      <DecisionReceipt data={data} sectionId={sectionId} className="mt-4" />
    </section>
  );
}

function JourneyTrack({
  steps,
  stepIndex,
  tone,
}: {
  steps: readonly string[];
  stepIndex: number;
  tone: JourneyTone;
}) {
  return (
    <ol className="journey-track" aria-label="결정 단계" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, index) => {
        const filled = stepIndex >= index;
        const current = stepIndex === index;
        return (
          <li
            key={step}
            className={[
              "journey-cell",
              filled ? "journey-cell-filled" : "journey-cell-empty",
              current ? "journey-cell-current" : "",
              filled ? `journey-cell-${tone}` : "",
            ].filter(Boolean).join(" ")}
            aria-current={current ? "step" : undefined}
          >
            <span>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

function JourneyFactBlock({ label, values, accent = false }: { label: string; values: string[]; accent?: boolean }) {
  return (
    <div className={`journey-fact ${accent ? "journey-fact-accent" : ""}`}>
      <div className="journey-fact-label">{label}</div>
      <p className="journey-fact-body">
        {values.length > 0 ? values.join(" · ") : accent ? "아직 확인할 질문이 정리되지 않았어요" : "아직 준비된 정보가 적어요"}
      </p>
    </div>
  );
}

function journeyState(decision: DecisionItem | undefined, status: PlanningSectionStatus | undefined, stepCount: number) {
  const text = `${decision?.title ?? ""} ${decision?.whyNow ?? ""} ${decision?.nextAction ?? ""} ${status?.nextAction ?? ""} ${status?.detail ?? ""}`;
  const tone: JourneyTone = status?.state === "done"
    ? "done"
    : status?.state === "attention" || decision?.risk?.level === "high"
      ? "attention"
      : status?.state === "empty"
        ? "waiting"
        : "active";

  if (status?.state === "done" || status?.percent === 100 || /완료|확정|발행 완료|저장 완료|계약됨/.test(text)) {
    return { label: "확정에 가까움", stepIndex: stepCount - 1, tone: status?.state === "attention" ? "attention" as JourneyTone : "done" as JourneyTone };
  }
  if (status?.state === "empty" && (status.percent ?? 0) === 0) {
    return { label: "기준 잡는 중", stepIndex: 0, tone };
  }
  if (/초과|마감|임박|빠진|미응답|손해|확인/.test(text)) {
    return { label: "확인할 것 남음", stepIndex: Math.min(stepCount - 2, 3), tone: tone === "waiting" ? "active" as JourneyTone : tone };
  }
  if (/비교|후보|나란히|고르기|담기/.test(text)) {
    return { label: "후보를 비교 중", stepIndex: Math.min(stepCount - 2, 2), tone: tone === "waiting" ? "active" as JourneyTone : tone };
  }
  if (/질문|기준|답하기|범위/.test(text)) {
    return { label: "기준을 묻는 중", stepIndex: 1, tone: tone === "waiting" ? "active" as JourneyTone : tone };
  }

  const percent = Math.max(0, Math.min(100, status?.percent ?? 0));
  const stepIndex = Math.max(0, Math.min(stepCount - 1, Math.round((percent / 100) * (stepCount - 1))));
  return { label: stepIndex >= stepCount - 2 ? "결정 정리 중" : "진행 중", stepIndex, tone };
}

function shortJourneyLabel(label: string): string {
  if (label.includes("확인")) return "확인 필요";
  if (label.includes("기준")) return "기준 잡기";
  if (label.includes("후보")) return "후보 비교";
  if (label.includes("확정")) return "확정 근접";
  if (label.includes("결정")) return "정리 중";
  return label;
}

function compactStatusFacts(status: PlanningSectionStatus | undefined): string[] {
  return [status?.detail].filter((value): value is string => !!value && value.trim().length > 0).slice(0, 3);
}

function compactStatusMissing(status: PlanningSectionStatus | undefined): string[] {
  return [status?.nextAction].filter((value): value is string => !!value && value.trim().length > 0).slice(0, 3);
}

function browserBaseUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}
