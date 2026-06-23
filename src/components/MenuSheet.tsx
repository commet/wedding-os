import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { buildMenuGroups } from "../lib/menu";
import { koBreak } from "../lib/typography";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    // 시트 열린 동안 본문 스크롤 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const groups = buildMenuGroups(data);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="전체 메뉴">
      <button
        aria-label="메뉴 닫기"
        onClick={onClose}
        className="anim-fade absolute inset-0 w-full bg-ink/25"
      />
      <div className="anim-sheet absolute inset-x-0 bottom-0 mx-auto max-w-app bg-paper max-h-[88vh] flex flex-col">
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
