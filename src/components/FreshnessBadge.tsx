import { formatVerifiedDate, freshnessLevel } from "../lib/freshness";

type Props = {
  lastVerified?: string;
  onClickCheck?: () => void;
};

export default function FreshnessBadge({ lastVerified, onClickCheck }: Props) {
  const level = freshnessLevel(lastVerified);
  const colorMap = {
    fresh: "text-soft",
    stale: "text-yellow-600",
    rotten: "text-red-500",
    unknown: "text-soft",
  } as const;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={colorMap[level]}>📅 {formatVerifiedDate(lastVerified)}</span>
      {onClickCheck && (
        <button onClick={onClickCheck} className="text-gold underline">
          지금 확인
        </button>
      )}
    </div>
  );
}
