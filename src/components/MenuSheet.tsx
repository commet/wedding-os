import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { buildMenuGroups } from "../lib/menu";
import { koBreak } from "../lib/typography";
import { PLANNING_STATE_LABEL, planningStatusReport } from "../lib/derived";

type Props = {
  open: boolean;
  onClose: () => void;
  data: WeddingData;
};

/**
 * "더보기" 전체 기능 시트 — 어느 화면에서든 모든 기능에 2탭으로 닿게 한다.
 * (탭 → 항목). 전역 메뉴는 buildMenuGroups 단일 소스를 따른다.
 */
export default function MenuSheet({ open, onClose, data }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => panelRef.current?.focus(), 0);
    const focusable = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ) ?? []);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // 시트 열린 동안 본문 스크롤 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const groups = buildMenuGroups(data);
  const statusReport = planningStatusReport(data);
  const nextStatus = statusReport.nextSections[0];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="전체 메뉴">
      <button
        aria-label="메뉴 닫기"
        onClick={onClose}
        className="anim-fade absolute inset-0 w-full bg-ink/25"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="anim-sheet absolute inset-x-0 bottom-0 mx-auto max-w-app bg-paper max-h-[88vh] flex flex-col outline-none"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <div className="eyebrow-gold mb-1">전체 메뉴</div>
            <div className="font-serif text-[20px] leading-none tracking-tight text-ink">{koBreak("준비 도구")}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 min-h-11 min-w-11 px-2 text-soft hover:text-ink transition text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="hairline" />
        <nav className="flex-1 overflow-y-auto px-6 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))] space-y-7">
          {nextStatus && (
            <Link
              to={nextStatus.to}
              onClick={onClose}
              className="row-tap block border-y border-hair py-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="eyebrow-gold mb-1">Dearie가 보는 다음 일</div>
                  <div className="font-serif text-[18px] leading-snug text-ink break-keep">{nextStatus.nextAction}</div>
                </div>
                <span className="font-serif text-[22px] leading-none text-gold tabular-nums">
                  {nextStatus.percent}<span className="ml-0.5 text-[10px] font-sans text-soft">%</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[12px] leading-relaxed">
                <span className="min-w-0 truncate text-soft">
                  {nextStatus.label} · {nextStatus.detail}
                </span>
                <span className="flex-shrink-0 text-ink">
                  {PLANNING_STATE_LABEL[nextStatus.state]} →
                </span>
              </div>
            </Link>
          )}
          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="eyebrow mb-3">{group.title}</h2>
              <ul className="border-y border-hair divide-y divide-hair">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onClose}
                      className="row-tap flex items-baseline justify-between gap-4 px-1 py-3.5"
                    >
                      <div className="min-w-0">
                        <div className="font-serif text-[15px] text-ink leading-tight break-keep">{item.label}</div>
                        <div className="text-[12px] text-soft mt-1 truncate">{item.sub}</div>
                      </div>
                      <span className="text-soft flex-shrink-0">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
