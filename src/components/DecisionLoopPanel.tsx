import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { decisionMap, type DecisionItem, type DecisionSection } from "../lib/derived";
import {
  buildDecisionPacket,
  decisionCalendarIcs,
  firstDecisionForSection,
  sectionLabel,
} from "../lib/decisionPackets";
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

      <p className="mt-3 border-l border-gold/50 pl-3 text-[12.5px] leading-relaxed text-ink/80 break-keep">
        {packet.outcome}
      </p>

      <DecisionLoopActions data={data} item={decision} includeOpenLink={includeOpenLink} />
    </section>
  );
}

export function SectionDecisionLoop({ data, sectionId, heading }: { data: WeddingData; sectionId: DecisionSection; heading?: string }) {
  return (
    <DecisionLoopPanel
      data={data}
      sectionId={sectionId}
      heading={heading}
      compact
      className="mt-4"
      includeOpenLink={false}
    />
  );
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

function browserBaseUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}
