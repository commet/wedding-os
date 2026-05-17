import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export default function Modal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-app bg-paper p-6 max-h-[88vh] overflow-y-auto shadow-2xl">
        {/* 모바일 스와이프 힌트 핸들 */}
        <div className="sm:hidden flex justify-center -mt-3 mb-4">
          <div className="w-10 h-0.5 bg-hair" />
        </div>
        <div className="flex items-baseline justify-between mb-5 pb-3 border-b border-hair">
          <h3 className="font-serif text-lg text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-soft hover:text-ink text-lg leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
