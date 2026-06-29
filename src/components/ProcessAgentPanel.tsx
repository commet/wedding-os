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

  return (
    <section className="border-y border-hair py-4 text-left">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <div className="eyebrow-gold">WEDDY</div>
          {previewMetrics.length > 0 && (
            <div className="flex min-w-0 flex-wrap justify-end gap-x-3 gap-y-1 text-[12px] font-medium text-soft">
              {previewMetrics.map((metric) => (
                <span key={metric.label} className="whitespace-nowrap">
                  {metric.label} <span className={metric.tone === "warn" ? "text-gold" : "text-ink"}>{metric.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <h2 className="font-serif text-[20px] leading-snug text-ink break-keep">{title}</h2>
        <p className="text-[13.5px] text-soft leading-relaxed break-keep">{summary}</p>
      </div>

      {actions.length > 0 && (
        <div className="mt-4 space-y-2">
          {nextAction && (
            <button
              type="button"
              aria-label={labelFor(nextAction.label)}
              onClick={nextAction.onClick}
              disabled={nextAction.disabled}
              className={`group flex min-h-11 w-full items-center justify-between gap-4 border-t border-hair pt-3 text-left disabled:opacity-40 ${
                nextAction.tone === "warn" ? "text-gold hover:text-ink" : "text-ink hover:text-gold"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold leading-snug break-keep">{labelFor(nextAction.label)}</span>
              </span>
              <span className="flex-shrink-0 text-soft transition group-hover:text-ink">→</span>
            </button>
          )}
          {otherActions.length > 0 && (
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
          )}
        </div>
      )}

      {steps.length > 0 && (
        <details className="mt-3 border-t border-hair pt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[13px] font-medium text-soft hover:text-ink">
            <span className="eyebrow">{openStepCount > 0 ? `왜 이 순서인지 · ${openStepCount}` : "왜 이 순서인지"}</span>
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
