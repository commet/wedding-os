import dearieDone from "../assets/dearie/done.png";
import dearieIcon from "../assets/dearie/icon.png";
import dearieReady from "../assets/dearie/ready.png";
import dearieThinking from "../assets/dearie/thinking.png";

type MarkProps = {
  compact?: boolean;
  mood?: "ready" | "thinking" | "watching" | "done";
  caption?: string;
};

const MOOD_LABEL = {
  ready: "대기 중",
  thinking: "정리 중",
  watching: "살피는 중",
  done: "완료",
};

const MOOD_IMAGE: Record<NonNullable<MarkProps["mood"]>, string> = {
  ready: dearieReady,
  thinking: dearieThinking,
  watching: dearieReady,
  done: dearieDone,
};

export function AgentIdentity({ compact = false, mood = "ready", caption }: MarkProps) {
  return (
    <div className="flex items-center gap-3">
      <AgentMark compact={compact} mood={mood} />
      <div className="py-0.5">
        <div
          className={`${compact ? "text-[11px] tracking-[0.14em]" : "text-[11.5px] tracking-[0.18em]"} font-medium leading-none text-gold`}
        >
          Dearie · {MOOD_LABEL[mood]}
        </div>
        <div
          className={`${compact ? "text-[15px] mt-1" : "text-[19px] mt-1.5"} font-serif leading-none tracking-[-0.01em] text-ink`}
        >
          Dearie
        </div>
        {caption && !compact && (
          <div className="mt-1 text-[12px] leading-snug text-soft">{caption}</div>
        )}
      </div>
    </div>
  );
}

function AgentMark({ compact, mood }: { compact: boolean; mood: NonNullable<MarkProps["mood"]> }) {
  const size = compact ? "h-9 w-9" : "h-11 w-11";
  const image = compact && mood === "ready" ? dearieIcon : MOOD_IMAGE[mood];
  return (
    <span
      aria-hidden="true"
      className={`agent-mark ${size} ${mood === "thinking" ? "agent-mark-thinking" : ""}`}
    >
      <span className="agent-mark-glow" />
      <img className="agent-mark-img" src={image} alt="" draggable={false} />
    </span>
  );
}
