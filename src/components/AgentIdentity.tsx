type MarkProps = {
  compact?: boolean;
};

export function AgentMark({ compact = false }: MarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`${compact ? "h-8 w-9" : "h-10 w-11"} agent-mark flex-shrink-0`}
    >
      <svg viewBox="0 0 44 40" fill="none" role="presentation">
        <path d="M7 5c0 12 5.5 22.5 15 29C31.5 27.5 37 17 37 5" />
        <path d="M22 34V11" />
        <circle cx="22" cy="5" r="2.25" />
      </svg>
    </span>
  );
}

export function AgentIdentity({ compact = false }: MarkProps) {
  return (
    <div className="flex items-center gap-3">
      <AgentMark compact={compact} />
      <div className="min-w-0">
        <div className={`${compact ? "text-[12.5px]" : "text-[13px]"} font-semibold tracking-[0.04em] text-ink`}>
          Wedding OS
        </div>
        <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-[0.2em] text-gold">
          Planning Agent
        </div>
      </div>
    </div>
  );
}
