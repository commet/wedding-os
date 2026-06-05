import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { useMemo } from "react";
import { daysSince } from "../lib/freshness";
import { recalcDueDates } from "../data/checklistTemplate";
import { daysUntilISODate, parseISODateLocal } from "../lib/date";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Dashboard({ data, update }: Props) {
  const dday = useMemo(() => {
    return daysUntilISODate(data.invitation.date);
  }, [data.invitation.date]);

  const checklistTotal = data.checklist.reduce((n, s) => n + s.items.length, 0);
  const checklistDone = data.checklist.reduce((n, s) => n + s.items.filter((i) => i.done).length, 0);
  const progress = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
  const remaining = Math.max(checklistTotal - checklistDone, 0);
  const firstPending = useMemo(() => {
    return data.checklist
      .flatMap((s) => s.items.map((i) => ({ section: s.title, item: i })))
      .filter((x) => !x.item.done)
      .sort((a, b) => {
        if (!a.item.dueDate && !b.item.dueDate) return 0;
        if (!a.item.dueDate) return 1;
        if (!b.item.dueDate) return -1;
        return a.item.dueDate.localeCompare(b.item.dueDate);
      })[0];
  }, [data.checklist]);

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
  const sdmCount = data.sdm.filter((v) => v.category !== "snap").length;
  const snapCount = data.sdm.filter((v) => v.category === "snap").length;

  const setWeddingDate = (date: string) => {
    update((prev: WeddingData) => {
      const next = {
        ...prev,
        invitation: { ...prev.invitation, date },
      };
      return {
        ...next,
        checklist: recalcDueDates(next.checklist, date),
      };
    });
  };

  // 메뉴 순서는 실제 결혼 준비 흐름을 따른다 — 먼저 큰 예약을 잡고(결정·예약),
  // 청첩장·영상을 만들고(함께 만들기), 그 뒤 꾸준히 관리. 공유·AI는 도구로 분리.
  const MENU_GROUPS: { title: string; items: { to: string; label: string; sub: string }[] }[] = [
    {
      title: "결정 · 예약",
      items: [
        { to: "/venues", label: "예식장", sub: venueCount > 0 ? `${venueCount}곳 담음` : "후보 비교 · 답사" },
        { to: "/sdm", label: "스드메", sub: sdmCount > 0 ? `${sdmCount}곳 담음` : "스튜디오 · 드레스 · 메이크업" },
        { to: "/snap", label: "본식 스냅", sub: snapCount > 0 ? `${snapCount}곳 담음` : "당일 촬영 · 원판 · 앨범" },
        { to: "/rings", label: "결혼반지", sub: `${data.rings.length}개 후보` },
        { to: "/trip", label: "신혼여행", sub: `${data.honeymoon.regions.length}곳 · 항공 ${data.flights.length} · 숙소 ${data.hotels.length}` },
      ],
    },
    {
      title: "함께 만들기",
      items: [
        { to: "/invitation", label: "모바일 청첩장", sub: "정보 입력 · 카톡 공유" },
        { to: "/video", label: "식전영상", sub: "사진 · BGM · 자연어 편집" },
      ],
    },
    {
      title: "꾸준히 관리",
      items: [
        { to: "/checklist", label: "체크리스트", sub: checklistTotal > 0 ? `${checklistDone}/${checklistTotal} 완료 · ${progress}%` : "일정 · 할 일" },
        { to: "/budget", label: "비용 관리", sub: budgetCount > 0 ? `${budgetCount}개 항목` : "예산 · 결제 · 초과 비용" },
        { to: "/guests", label: "하객 명단", sub: guestCount > 0 ? `${guestCount}명 · 참석 ${guestAttending}` : "이름 · 축의금 · 식수" },
      ],
    },
    {
      title: "도구",
      items: [
        { to: "/share", label: "공유 센터", sub: "Excel · PDF · 카톡 · 백업" },
        { to: "/ai", label: "AI 연결", sub: "복붙 모드 · API 키 · 로컬 LLM" },
      ],
    },
  ];

  return (
    <div className="pb-10">
      {/* ─── 히어로 — 박스 없이 풀폭 타이포 ─── */}
      <section className="page pt-10 pb-9 text-center">
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
            <div className="text-left border border-hair bg-cream/35 px-4 py-4 mb-6">
              <div className="eyebrow-gold mb-2">Wedding day</div>
              <label className="block">
                <span className="text-[12px] text-soft">예식 날짜를 먼저 넣어보세요</span>
                <input
                  type="date"
                  className="input mt-2 bg-paper"
                  value={data.invitation.date}
                  onChange={(e) => setWeddingDate(e.target.value)}
                />
              </label>
              <div className="mt-4 flex items-end justify-between border-t border-hair pt-4">
                <div>
                  <div className="eyebrow">오늘 기준</div>
                  <div className="text-[12px] text-soft mt-1">
                    날짜를 넣으면 체크리스트 마감일도 같이 맞춰집니다.
                  </div>
                </div>
                <DdayMark dday={dday} />
              </div>
            </div>
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
          <section className="page py-7">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="section-title">다가오는 일정</h2>
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

      {/* ─── 진행률 — 시각 카드 ─── */}
      {checklistTotal > 0 && (
        <>
          <Link to="/checklist" className="block page py-8 hover:bg-cream/40 transition">
            <div className="border border-hair bg-paper px-4 py-4 shadow-[0_18px_45px_rgba(45,35,25,0.06)]">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="section-title mb-1">현재 진행률</h2>
                  <p className="text-[12px] text-soft">
                    완료한 항목과 남은 일을 한 번에 봅니다.
                  </p>
                </div>
                <span className="font-serif text-[2.6rem] leading-none text-ink tabular-nums">
                  {progress}<span className="text-gold text-[1.35rem]">%</span>
                </span>
              </div>
              <div className="h-2.5 bg-line overflow-hidden">
                <div
                  className="h-full bg-ink transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-cream/50 px-3 py-3">
                  <div className="eyebrow">완료</div>
                  <div className="font-serif text-xl text-ink tabular-nums mt-1">
                    {checklistDone} / {checklistTotal}
                  </div>
                </div>
                <div className="bg-cream/50 px-3 py-3">
                  <div className="eyebrow">남은 일</div>
                  <div className="font-serif text-xl text-ink tabular-nums mt-1">
                    {remaining}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-[12px] text-soft leading-relaxed pr-3">
                  {firstPending ? (
                    <>
                      다음 체크 · <span className="text-ink">{firstPending.item.text}</span>
                    </>
                  ) : (
                    "체크리스트로 이동"
                  )}
                </p>
                <span className="text-soft">→</span>
              </div>
            </div>
          </Link>
          <div className="hairline" />
        </>
      )}

      {/* ─── 메뉴 — 그룹 컨테이너 + 밀집 리스트 (체계·위계 강화) ─── */}
      <section className="page py-7 space-y-6">
        {MENU_GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="section-title mb-2.5">{group.title}</h2>
            <div className="group-card">
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group-row active:bg-cream/70 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-ink font-medium leading-tight">{item.label}</div>
                    <div className="text-[11.5px] text-soft mt-0.5 truncate">{item.sub}</div>
                  </div>
                  <span className="text-mute text-sm flex-shrink-0">→</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function DdayMark({ dday }: { dday: number | null }) {
  if (dday === null) {
    return (
      <div className="text-right">
        <div className="font-serif text-2xl text-soft">D-?</div>
        <div className="eyebrow mt-1">날짜 대기</div>
      </div>
    );
  }
  if (dday === 0) {
    return (
      <div className="text-right">
        <div className="font-serif text-2xl text-gold">D-DAY</div>
        <div className="eyebrow mt-1">오늘</div>
      </div>
    );
  }
  if (dday < 0) {
    return (
      <div className="text-right">
        <div className="font-serif text-2xl text-soft tabular-nums">D+{Math.abs(dday)}</div>
        <div className="eyebrow mt-1">예식 후</div>
      </div>
    );
  }
  return (
    <div className="text-right">
      <div className="font-serif text-3xl text-ink tabular-nums">D-{dday}</div>
      <div className="eyebrow mt-1">남았습니다</div>
    </div>
  );
}

function formatWeddingDate(iso?: string): string {
  const d = parseISODateLocal(iso);
  if (!d) return "";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${days[d.getDay()]}`;
}
