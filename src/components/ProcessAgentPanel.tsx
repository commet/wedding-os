import { useEffect, useMemo, useState } from "react";
import { AgentIdentity } from "./AgentIdentity";

export type ProcessAgentMetric = {
  label: string;
  value: string;
  hint?: string;
  tone?: "normal" | "warn" | "muted";
};

export type ProcessAgentStep = {
  label: string;
  detail?: string;
  done?: boolean;
};

export type ProcessAgentAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "quiet" | "warn";
};

type Props = {
  title: string;
  summary: string;
  mood?: "ready" | "thinking" | "watching" | "done";
  metrics?: ProcessAgentMetric[];
  steps?: ProcessAgentStep[];
  actions?: ProcessAgentAction[];
};

export default function ProcessAgentPanel({
  title,
  summary,
  mood = "thinking",
  metrics = [],
  steps = [],
  actions = [],
}: Props) {
  const nextAction =
    actions.find((action) => action.tone === "primary" && !action.disabled) ??
    actions.find((action) => action.tone === "warn" && !action.disabled) ??
    actions.find((action) => !action.disabled) ??
    actions[0];
  const otherActions = actions.filter((action) => action !== nextAction);
  const visibleOtherActions = otherActions.slice(0, 2);
  const tuckedOtherActions = otherActions.slice(2);
  const openStepCount = steps.filter((step) => !step.done).length;
  const previewMetrics = metrics.slice(0, 3);
  const visibleSteps = steps.slice(0, 3);
  const hiddenSteps = steps.slice(3);
  const labelFor = (label: string) => label.replace(/\s*→\s*$/, "");
  const brief = useMemo(() => compactBrief(summary), [summary]);
  const stageLabel = stageCopy(mood, openStepCount);

  return (
    <section className="border-y border-hair py-4 text-left md:py-5">
      <div className="flex items-start gap-3">
        <AgentIdentity compact mood={mood} />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="eyebrow-gold">Dearie 브리핑</span>
            <span className="text-[11px] font-medium text-soft">{stageLabel}</span>
          </div>
          <h2 className="font-serif text-[20px] leading-snug text-ink break-keep md:text-[22px]">{title}</h2>
          <TypingBrief text={brief} />
        </div>
      </div>

      {previewMetrics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Dearie 판단 근거">
          {previewMetrics.map((metric) => (
            <span
              key={metric.label}
              className={`inline-flex max-w-full items-baseline gap-1.5 border px-2.5 py-1.5 text-[11.5px] ${
                metric.tone === "warn"
                  ? "border-gold bg-gold/10 text-gold"
                  : metric.tone === "muted"
                    ? "border-hair bg-cream/35 text-soft"
                    : "border-hair text-ink"
              }`}
            >
              <span className="font-medium text-soft">{metric.label}</span>
              <span className="max-w-[9rem] truncate font-semibold tabular-nums">{metric.value}</span>
            </span>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-4 border-y border-hair py-3">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div className="eyebrow-gold">선택지</div>
            {nextAction && <span className="text-[11px] text-soft">누르면 바로 반영됩니다</span>}
          </div>
          {nextAction && (
            <button
              type="button"
              aria-label={labelFor(nextAction.label)}
              onClick={nextAction.onClick}
              disabled={nextAction.disabled}
              className={`group flex min-h-12 w-full items-center justify-between gap-4 px-4 py-3 text-left text-[14px] font-semibold transition active:scale-[0.99] disabled:opacity-40 ${
                nextAction.tone === "warn"
                  ? "border border-gold text-gold hover:bg-cream/50"
                  : "bg-ink text-paper hover:bg-ink/90"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold leading-snug break-keep">{labelFor(nextAction.label)}</span>
              </span>
              <span className={`flex-shrink-0 transition ${nextAction.tone === "warn" ? "text-gold" : "text-paper/80"}`}>→</span>
            </button>
          )}
          {visibleOtherActions.length > 0 && (
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {visibleOtherActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="min-h-11 border border-hair px-3 py-2 text-left text-[12.5px] font-medium text-ink transition hover:border-gold hover:text-gold disabled:opacity-40"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="break-keep">{labelFor(action.label)}</span>
                    <span className="text-soft">→</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {tuckedOtherActions.length > 0 && (
            <details className="mt-2">
              <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 text-[11.5px] font-medium text-soft underline underline-offset-4 hover:text-ink">
                <span className="eyebrow">보조 작업 {tuckedOtherActions.length}개</span>
                <span>보기</span>
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {tuckedOtherActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className="min-h-11 border border-hair px-3 py-2 text-left text-[12.5px] font-medium text-ink transition hover:border-gold hover:text-gold disabled:opacity-40"
                  >
                    {labelFor(action.label)}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <details className="mt-2 border-b border-hair pb-2">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-4">
            <span className="eyebrow">{openStepCount > 0 ? `판단 근거와 다음 순서 · ${openStepCount}개 남음` : "판단 근거와 정리된 순서"}</span>
            <span className="text-[12px] text-soft underline underline-offset-4">보기</span>
          </summary>
          <ol className="mt-2 divide-y divide-hair border-y border-hair">
            {visibleSteps.map((step, index) => (
              <AgentStepRow key={`${step.label}-${index}`} step={step} index={index} />
            ))}
          </ol>
          {hiddenSteps.length > 0 && (
            <details className="mt-2">
              <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 text-[11.5px] font-medium text-soft underline underline-offset-4 hover:text-ink">
                <span className="eyebrow">나머지 순서 {hiddenSteps.length}개</span>
                <span>보기</span>
              </summary>
              <ol className="mt-2 divide-y divide-hair border-y border-hair">
                {hiddenSteps.map((step, index) => (
                  <AgentStepRow key={`${step.label}-${index + visibleSteps.length}`} step={step} index={index + visibleSteps.length} />
                ))}
              </ol>
            </details>
          )}
        </details>
      )}
    </section>
  );
}

function TypingBrief({ text }: { text: string }) {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || text.length < 12) {
      setShown(text);
      return;
    }
    setShown("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 2;
      setShown(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 18);
    return () => window.clearInterval(timer);
  }, [text]);

  const typing = shown.length < text.length;
  return (
    <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-soft break-keep md:text-[13.5px]" aria-label={text}>
      <span aria-hidden="true">{shown}</span>
      {typing && <span aria-hidden="true" className="ml-0.5 text-gold">|</span>}
    </p>
  );
}

function AgentStepRow({ step, index }: { step: ProcessAgentStep; index: number }) {
  return (
    <li className="flex gap-3 py-3">
      <span
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border text-[10px] ${
          step.done ? "border-ink bg-ink text-paper" : "border-gold text-gold"
        }`}
        aria-hidden="true"
      >
        {step.done ? "✓" : String(index + 1)}
      </span>
      <span className="min-w-0">
        <span className={`block text-[14px] leading-relaxed break-keep ${step.done ? "text-soft line-through" : "text-ink"}`}>
          {step.label}
        </span>
        {step.detail && (
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-soft break-keep">
            {step.detail}
          </span>
        )}
      </span>
    </li>
  );
}

function stageCopy(mood: NonNullable<Props["mood"]>, openStepCount: number) {
  if (mood === "ready") return openStepCount > 0 ? `${openStepCount}개 남음` : "안정";
  if (mood === "watching") return openStepCount > 0 ? `${openStepCount}개 확인 중` : "주의";
  if (mood === "done") return "완료";
  return openStepCount > 0 ? `${openStepCount}개 정리 중` : "대기";
}

function compactBrief(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 92) return normalized;
  return `${normalized.slice(0, 90).trimEnd()}…`;
}
