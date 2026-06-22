type MarkProps = {
  compact?: boolean;
};

export function AgentIdentity({ compact = false }: MarkProps) {
  return (
    <div className="flex items-stretch gap-2.5">
      <span aria-hidden="true" className="w-px self-stretch bg-gold/70" />
      <div className="py-0.5">
        <div
          className={`${compact ? "text-[9px] tracking-[0.26em]" : "text-[10px] tracking-[0.28em]"} font-medium uppercase leading-none text-gold`}
        >
          Planning Agent
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
