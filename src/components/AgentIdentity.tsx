type MarkProps = {
  compact?: boolean;
};

export function AgentIdentity({ compact = false }: MarkProps) {
  return (
    <div className="flex items-stretch gap-2.5">
      <span aria-hidden="true" className="w-px self-stretch bg-gold/70" />
      <div className="py-0.5">
        <div
          className={`${compact ? "text-[9px] tracking-[0.2em]" : "text-[10px] tracking-[0.22em]"} font-medium leading-none text-gold`}
        >
          준비 에이전트
        </div>
        <div
          className={`${compact ? "text-[15px] mt-1" : "text-[19px] mt-1.5"} font-serif leading-none tracking-[-0.01em] text-ink`}
        >
          Wedding OS
        </div>
      </div>
    </div>
  );
}
