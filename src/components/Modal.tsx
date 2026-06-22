import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export default function Modal({ open, onClose, title, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { e.preventDefault(); panelRef.current?.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => (focusable()[0] ?? panelRef.current)?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="anim-fade absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "대화 상자"}
        tabIndex={-1}
        className="anim-sheet relative w-full max-w-app bg-paper p-6 max-h-[88vh] overflow-y-auto shadow-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {/* 모바일 스와이프 힌트 핸들 */}
        <div className="sm:hidden flex justify-center -mt-3 mb-4">
          <div className="w-10 h-0.5 bg-hair" />
        </div>
        <div className="flex items-baseline justify-between mb-5 pb-3 border-b border-hair">
          <h2 id={titleId} className="font-serif text-lg text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-soft hover:text-ink text-xl leading-none min-w-11 min-h-11"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
