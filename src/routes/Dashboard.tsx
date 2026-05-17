import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { useMemo } from "react";
import { daysSince } from "../lib/freshness";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Dashboard({ data }: Props) {
  const dday = useMemo(() => {
    if (!data.invitation.date) return null;
    const t = new Date(data.invitation.date).getTime();
    if (isNaN(t)) return null;
    return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
  }, [data.invitation.date]);

  const checklistTotal = data.checklist.reduce((n, s) => n + s.items.length, 0);
  const checklistDone = data.checklist.reduce((n, s) => n + s.items.filter((i) => i.done).length, 0);
  const progress = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const upcoming = useMemo(() => {
    const items = data.checklist.flatMap((s) =>
      s.items
        .filter((i) => !i.done && i.dueDate)
        .map((i) => ({ section: s.title, icon: s.icon, item: i, d: daysSince(i.dueDate) }))
    );
    return items
      .filter((x) => x.d !== null && x.d >= -7)
      .sort((a, b) => (b.d ?? 0) - (a.d ?? 0))
      .slice(0, 5);
  }, [data.checklist]);

  const empty = !data.invitation.groomName && !data.invitation.brideName;

  const venueCount = (data.venues ?? []).length;
  const budgetCount = (data.budget ?? []).length;
  const guestCount = (data.guests ?? []).length;
  const guestAttending = (data.guests ?? []).filter((g) => g.status === "참석").length;

  const MENU_GROUPS: { title: string; items: { to: string; label: string; sub: string }[] }[] = [
    {
      title: "결정 · 예약",
      items: [
        { to: "/venues", label: "예식장", sub: venueCount > 0 ? `${venueCount}곳 담음` : "후보 비교 · 답사" },
        { to: "/sdm", label: "스드메 · 스냅", sub: `${data.sdm.length}곳 담음` },
        { to: "/rings", label: "결혼반지", sub: `${data.rings.length}개 후보` },
        { to: "/trip", label: "신혼여행", sub: `${data.honeymoon.regions.length}곳 · 항공 ${data.flights.length} · 숙소 ${data.hotels.length}` },
      ],
    },
    {
      title: "본식 준비",
      items: [
        { to: "/invitation", label: "모바일 청첩장", sub: "정보 입력 · 카톡 공유" },
        { to: "/video", label: "식전영상", sub: "사진 · BGM · 자연어 편집" },
        { to: "/guests", label: "하객 명단", sub: guestCount > 0 ? `${guestCount}명 · 참석 ${guestAttending}` : "이름 · 축의금 · 식수" },
      ],
    },
    {
      title: "관리",
      items: [
        { to: "/checklist", label: "체크리스트", sub: "일정 · 할 일" },
        { to: "/budget", label: "예산 · 비용", sub: budgetCount > 0 ? `${budgetCount}개 항목` : "한국 평균 대비 비교" },
      ],
    },
  ];

  return (
    <div className="pb-10">
      {/* ─── 히어로 — 박스 없이 풀폭 타이포 ─── */}
      <section className="page pt-12 pb-14 text-center">
        {empty ? (
          <>
            <div className="eyebrow-gold mb-6">Wedding · OS</div>
            <h1 className="display-sm mb-5">
              결혼 준비,<br />
              어디서부터 시작할까요?
            </h1>
            <p className="text-[13px] text-soft leading-relaxed mb-8">
              청첩장 정보부터 한 줄씩 채워보세요.
            </p>
            <Link to="/invitation" className="btn-primary px-8 py-3.5 text-[12.5px]">
              청첩장 정보 입력 →
            </Link>
          </>
        ) : (
          <>
            <div className="eyebrow-gold mb-6">Our Wedding</div>
            <p className="font-serif text-xl text-ink mb-8 tracking-wide">
              {data.invitation.groomName}
              <span className="mx-3 text-gold">·</span>
              {data.invitation.brideName}
            </p>

            {dday !== null && (
              <div className="mb-8">
                {dday > 0 ? (
                  <div className="font-serif text-[5rem] leading-none text-ink tracking-tight">
                    D<span className="text-gold">−</span>
                    <span className="tabular-nums">{dday}</span>
                  </div>
                ) : dday === 0 ? (
                  <div className="font-serif text-[3.5rem] leading-none text-gold tracking-tight">
                    D — DAY
                  </div>
                ) : (
                  <div className="font-serif text-3xl leading-none text-soft">
                    결혼 +<span className="tabular-nums">{Math.abs(dday)}</span>일
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[13px] text-ink tracking-wide">
                {formatWeddingDate(data.invitation.date) || "날짜 미정"}
                {data.invitation.time && ` · ${data.invitation.time}`}
              </p>
              <p className="eyebrow">
                {data.invitation.venue || "장소 미정"}
              </p>
            </div>
          </>
        )}
      </section>

      <div className="hairline" />

      {/* ─── 이번 주에 할 일 — hairline 리스트 ─── */}
      {upcoming.length > 0 && (
        <>
          <section className="page py-10">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="eyebrow-gold">이번 주에</h2>
              <Link to="/checklist" className="text-[11px] text-soft underline underline-offset-4 hover:text-ink">
                전체 보기
              </Link>
            </div>
            <ul className="stack">
              {upcoming.map((u, i) => {
                const overdue = (u.d ?? 0) > 0;
                const label = overdue ? `${u.d}일 지남` : u.d === 0 ? "오늘" : `${-(u.d ?? 0)}일 남음`;
                return (
                  <li key={i} className="flex items-baseline justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] text-ink truncate">{u.item.text}</div>
                      <div className="eyebrow mt-1.5">{u.section}</div>
                    </div>
                    <span className={`text-[12px] tabular-nums flex-shrink-0 ${overdue ? "text-gold" : "text-soft"}`}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          <div className="hairline" />
        </>
      )}

      {/* ─── 진행률 — 박스 없이 한 줄 ─── */}
      {checklistTotal > 0 && (
        <>
          <Link to="/checklist" className="block page py-8 hover:bg-cream/40 transition">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="eyebrow">전체 진행률</h2>
              <span className="font-serif text-xl text-ink tabular-nums">{progress}<span className="text-soft text-sm">%</span></span>
            </div>
            <div className="w-full h-px bg-line relative">
              <div
                className="absolute top-0 left-0 h-px bg-ink transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="eyebrow mt-3">
              {checklistDone} / {checklistTotal} 완료
            </p>
          </Link>
          <div className="hairline" />
        </>
      )}

      {/* ─── 메뉴 — 그룹별 hairline 리스트 ─── */}
      <section className="page py-10 space-y-10">
        {MENU_GROUPS.map((group, gi) => {
          const offset = MENU_GROUPS.slice(0, gi).reduce((s, g) => s + g.items.length, 0);
          return (
            <div key={group.title}>
              <h2 className="eyebrow-gold mb-5">{group.title}</h2>
              <ul className="stack">
                {group.items.map((item, idx) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="flex items-baseline gap-5 active:opacity-60 transition"
                    >
                      <span className="font-serif text-soft text-base tabular-nums w-6 flex-shrink-0">
                        {String(offset + idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-[17px] text-ink leading-tight mb-1">{item.label}</div>
                        <div className="eyebrow">{item.sub}</div>
                      </div>
                      <span className="text-soft flex-shrink-0">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function formatWeddingDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${days[d.getDay()]}`;
}
