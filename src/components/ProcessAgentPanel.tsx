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
  const openStepCount = steps.filter((step) => !step.done).length;
  const previewMetrics = metrics.slice(0, 3);
  const labelFor = (label: string) => label.replace(/\s*→\s*$/, "");
  const nextActionClass =
    nextAction?.tone === "warn"
      ? "border-gold bg-gold text-paper hover:opacity-90"
      : "border-ink bg-ink text-paper hover:opacity-90";

  return (
    <section className="border-y border-hair py-4 text-left">
      <div className="space-y-3">
        <div>
          <div className="eyebrow-gold mb-1.5">다음 할 일</div>
          <h2 className="font-serif text-[19px] leading-snug text-ink break-keep">{title}</h2>
        </div>

        {nextAction && (
          <button
            type="button"
            aria-label={labelFor(nextAction.label)}
            onClick={nextAction.onClick}
            disabled={nextAction.disabled}
            className={`group flex min-h-12 w-full items-center justify-between gap-4 border px-4 py-3 text-left font-semibold transition disabled:opacity-40 ${nextActionClass}`}
          >
            <span className="min-w-0 text-[14px] leading-snug break-keep">{labelFor(nextAction.label)}</span>
            <span className="flex-shrink-0 transition group-hover:translate-x-0.5">→</span>
          </button>
        )}

        <p className="text-[13px] text-soft leading-relaxed break-keep">{summary}</p>

        {previewMetrics.length > 0 && (
          <div className="flex min-w-0 flex-wrap gap-2 text-[12px] font-medium text-soft">
            {previewMetrics.map((metric) => (
              <span key={metric.label} className="border border-hair bg-cream/40 px-2.5 py-1.5 leading-none">
                {metric.label} <span className={metric.tone === "warn" ? "text-gold" : "text-ink"}>{metric.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {otherActions.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {otherActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className="min-h-11 text-[13px] font-medium text-ink underline underline-offset-4 hover:text-gold disabled:opacity-40"
              >
                {labelFor(action.label)}
              </button>
            ))}
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <details className="mt-3 border-t border-hair pt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[13px] font-medium text-soft hover:text-ink">
            <span className="eyebrow">{openStepCount > 0 ? `진행 이유 보기 · ${openStepCount}` : "진행 이유 보기"}</span>
            <span className="underline underline-offset-4">보기</span>
          </summary>
          <ol className="divide-y divide-hair border-t border-hair">
            {steps.map((step, index) => (
              <li key={`${step.label}-${index}`} className="flex gap-3 py-3">
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
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
