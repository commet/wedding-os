import { formatVerifiedDate, freshnessLevel } from "../lib/freshness";

type Props = {
  lastVerified?: string;
  onClickCheck?: () => void;
};

export default function FreshnessBadge({ lastVerified, onClickCheck }: Props) {
  const level = freshnessLevel(lastVerified);
  const colorMap = {
    fresh: "text-soft",
    stale: "text-gold",
    rotten: "text-gold font-medium",
    unknown: "text-soft",
  } as const;
  return (
    <div className="flex items-center gap-3 text-[11px] tracking-wide">
      <span className={colorMap[level]}>{formatVerifiedDate(lastVerified)}</span>
      {onClickCheck && (
        <button onClick={onClickCheck} className="text-ink underline underline-offset-4 hover:text-gold">
          지금 확인
        </button>
      )}
    </div>
  );
}
