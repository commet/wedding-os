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
      <div className="relative w-full max-w-app bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[88vh] overflow-y-auto shadow-2xl">
        {/* 모바일 스와이프 힌트 핸들 */}
        <div className="sm:hidden flex justify-center -mt-2 mb-3">
          <div className="w-10 h-1 bg-line rounded-full" />
        </div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-lg">{title}</h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 rounded-full bg-cream flex items-center justify-center text-xl text-soft active:bg-line"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
