type Props = {
  judgement: string;
  question: string;
  questionLabel?: string;
  tone?: "normal" | "warn";
  className?: string;
};

export default function DecisionNudge({ judgement, question, questionLabel = "물어볼 점", tone = "normal", className = "" }: Props) {
  return (
    <div data-decision-nudge className={`grid gap-2 sm:grid-cols-2 ${className}`}>
      <div className="inline-flex max-w-full items-center gap-2 border border-line bg-vellum/55 px-2.5 py-1.5">
        <span className="text-[10.5px] font-semibold text-soft">판단</span>
        <span className={`min-w-0 truncate text-[12px] font-semibold ${tone === "warn" ? "text-gold" : "text-ink"}`}>
          {judgement}
        </span>
      </div>
      <div className="min-w-0 border border-gold/35 bg-gold/5 px-3 py-1.5">
        <div className="text-[11px] font-semibold text-gold">{questionLabel}</div>
        <p className="mt-1 text-[12px] leading-relaxed text-ink/85 break-keep">{question}</p>
      </div>
    </div>
  );
}
