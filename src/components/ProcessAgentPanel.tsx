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
  const openStepCount = steps.filter((step) => !step.done).length;
  const previewMetrics = metrics.slice(0, 3);
  const labelFor = (label: string) => label.replace(/\s*→\s*$/, "");

  return (
    <section className="border-y border-hair py-5 text-left">
      <div className="flex gap-3">
        <AgentIdentity compact mood={mood} />
        <div className="min-w-0 flex-1">
          <div className="eyebrow-gold mb-2">다음 결정</div>
          <h2 className="font-serif text-[21px] leading-snug text-ink break-keep">{title}</h2>
          <p className="mt-2 text-[13.5px] text-soft leading-relaxed break-keep">{summary}</p>
        </div>
      </div>

      {previewMetrics.length > 0 && (
        <div className="mt-5 grid grid-cols-3 border-y border-hair">
          {previewMetrics.map((metric) => (
            <div key={metric.label} className="min-w-0 border-r border-hair px-2 py-3 text-center last:border-r-0">
              <div className="text-[10.5px] font-medium tracking-eyebrow text-soft">{metric.label}</div>
              <div className={`mt-1 truncate text-[15px] font-semibold tabular-nums ${metric.tone === "warn" ? "text-gold" : metric.tone === "muted" ? "text-soft" : "text-ink"}`}>
                {metric.value}
              </div>
              {metric.hint && <div className="mt-1 truncate text-[10.5px] text-mute">{metric.hint}</div>}
            </div>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-5 space-y-3">
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
          {otherActions.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {otherActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="min-h-10 border border-hair px-3 py-2 text-left text-[12.5px] font-medium text-ink transition hover:border-gold hover:text-gold disabled:opacity-40"
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
