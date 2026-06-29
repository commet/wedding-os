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

  return (
    <section className="border-y border-hair py-5 space-y-5 text-left">
      <AgentIdentity compact mood={mood} />

      <div className="space-y-2">
        <div className="eyebrow-gold">WEDDY의 판단</div>
        <h2 className="font-serif text-[20px] leading-snug text-ink break-keep">{title}</h2>
        <p className="text-[12.5px] text-soft leading-relaxed break-keep">{summary}</p>
      </div>

      {metrics.length > 0 && (
        <div className="grid grid-cols-3 gap-3 border-y border-hair py-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <div className="eyebrow mb-1">{metric.label}</div>
              <div
                className={`font-serif text-[18px] leading-none tabular-nums ${
                  metric.tone === "warn" ? "text-gold" : metric.tone === "muted" ? "text-soft" : "text-ink"
                }`}
              >
                {metric.value}
              </div>
              {metric.hint && (
                <div className="mt-1 text-[10.5px] leading-snug text-soft break-keep">{metric.hint}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className="space-y-3">
          <div className="eyebrow">다음 한 걸음</div>
          {nextAction && (
            <button
              type="button"
              aria-label={nextAction.label}
              onClick={nextAction.onClick}
              disabled={nextAction.disabled}
              className={`group flex min-h-14 w-full items-center justify-between gap-4 border-y border-hair py-3 text-left disabled:opacity-40 ${
                nextAction.tone === "warn" ? "text-gold hover:text-ink" : "text-ink hover:text-gold"
              }`}
            >
              <span className="min-w-0">
                <span className="block font-serif text-[16px] leading-snug break-keep">{nextAction.label}</span>
                <span className="mt-1 block text-[10.5px] uppercase tracking-[0.18em] text-soft">WEDDY 추천 실행</span>
              </span>
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-hair text-[13px] transition group-hover:border-ink">
                →
              </span>
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
                  className="min-h-11 text-[12px] text-ink underline underline-offset-4 hover:text-gold disabled:opacity-40"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <details className="border-y border-hair py-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[12px] text-soft hover:text-ink">
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
                  <span className={`block text-[13px] leading-relaxed break-keep ${step.done ? "text-soft line-through" : "text-ink"}`}>
                    {step.label}
                  </span>
                  {step.detail && (
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-soft break-keep">
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
