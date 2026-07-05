import { useMemo } from "react";

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
    <section className="agent-panel process-panel md:px-5 md:py-4">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="home-kicker">다음 행동</span>
          <span className="text-[11.5px] font-medium text-soft">{stageLabel}</span>
        </div>
        <h2 className="text-[17px] font-semibold leading-snug text-ink break-keep md:text-[18px]">{title}</h2>
        <TypingBrief text={brief} />
      </div>

      {previewMetrics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Dearie가 본 기준">
          {previewMetrics.map((metric) => (
            <span
              key={metric.label}
              className={`inline-flex max-w-full items-baseline gap-1.5 border px-2.5 py-1.5 text-[11.5px] ${
                metric.tone === "warn"
                  ? "border-gold bg-gold/10 text-gold"
                  : metric.tone === "muted"
                    ? "border-line bg-shell text-soft"
                    : "border-line bg-vellum/85 text-ink"
              }`}
            >
              <span className="font-medium text-soft">{metric.label}</span>
              <span className="max-w-[9rem] truncate font-semibold tabular-nums">{metric.value}</span>
            </span>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <div className="text-[12px] font-semibold text-ink">먼저 할 일</div>
            {nextAction && <span className="text-[11.5px] text-soft">보조 작업은 접어둡니다</span>}
          </div>
          {nextAction && (
            <button
              type="button"
              aria-label={labelFor(nextAction.label)}
              onClick={nextAction.onClick}
              disabled={nextAction.disabled}
              className={`group focus-primary-action w-full text-left text-[14px] font-semibold disabled:opacity-40 ${
                nextAction.tone === "warn" ? "border-gold text-gold" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold leading-snug break-keep">{labelFor(nextAction.label)}</span>
              </span>
              <span className="flex-shrink-0 text-gold transition">→</span>
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
                  className="focus-secondary-action min-h-11 px-3 py-2 text-[12.5px] disabled:opacity-40"
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
                <span>다른 작업 {tuckedOtherActions.length}개 보기</span>
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {tuckedOtherActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className="home-mini-link min-h-11 text-left text-[12.5px] font-medium text-ink transition hover:text-gold disabled:opacity-40"
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
        <details className="mt-3 border-t border-line pt-2">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-4">
            <span className="text-[12px] font-semibold text-soft">{openStepCount > 0 ? `남은 확인 ${openStepCount}개` : "확인한 기준"}</span>
            <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
          </summary>
          <ol className="mt-2 group-card">
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
              <ol className="mt-2 group-card">
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
  return (
    <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-soft break-keep md:text-[13.5px]">
      {text}
    </p>
  );
}

function AgentStepRow({ step, index }: { step: ProcessAgentStep; index: number }) {
  return (
    <li className="flex gap-3 py-3">
      <span
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border text-[10px] ${
          step.done ? "border-plum bg-plum text-paper" : "border-gold text-gold"
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
