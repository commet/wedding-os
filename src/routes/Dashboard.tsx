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

  // 이번 주 할 일 = 미완료 + 마감일이 지났거나 7일 이내
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

  return (
    <div className="pb-6">
      {/* 히어로 — D-day */}
      <div className="px-5 pt-6 pb-8">
        {empty ? (
          <div className="card text-center bg-gradient-to-br from-cream to-white py-8">
            <div className="text-4xl mb-3">💌</div>
            <p className="text-soft text-sm mb-5">
              결혼 준비, 어디서부터 시작할까요?<br />
              청첩장 정보부터 채워보세요.
            </p>
            <Link to="/invitation" className="btn-primary inline-flex">
              청첩장 정보부터 →
            </Link>
          </div>
        ) : (
          <div className="card bg-gradient-to-br from-cream via-white to-cream/50 text-center py-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gold/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-sage/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="text-xs text-gold tracking-[0.25em] uppercase mb-3">Our Wedding</div>
              <p className="font-serif text-xl text-ink">
                {data.invitation.groomName} <span className="text-gold">·</span> {data.invitation.brideName}
              </p>
              {dday !== null && (
                <p className="font-serif text-[3.5rem] leading-none my-4 text-gold">
                  {dday > 0 ? (
                    <>D<span className="text-3xl">-</span>{dday}</>
                  ) : dday === 0 ? (
                    "D-DAY"
                  ) : (
                    <span className="text-3xl">결혼 +{Math.abs(dday)}일</span>
                  )}
                </p>
              )}
              <p className="text-sm text-soft">
                {formatWeddingDate(data.invitation.date) || ""}
                {data.invitation.time && ` · ${data.invitation.time}`}
              </p>
              <p className="text-xs text-soft mt-1">{data.invitation.venue || "장소 미정"}</p>
            </div>
          </div>
        )}
      </div>

      {/* 이번 주 할 일 */}
      {upcoming.length > 0 && (
        <div className="px-5 pb-5">
          <Link to="/checklist" className="block card border-gold/30 bg-gold/5 hover:bg-gold/10 transition">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">⏰ 이번 주에 할 일</h3>
              <span className="text-xs text-gold">전체 보기 →</span>
            </div>
            <ul className="space-y-2 text-sm">
              {upcoming.map((u, i) => {
                const overdue = (u.d ?? 0) > 0;
                return (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-base">{u.icon}</span>
                    <span className="flex-1 truncate">{u.item.text}</span>
                    <span
                      className={`text-xs flex-shrink-0 font-medium ${
                        overdue ? "text-red-500" : "text-soft"
                      }`}
                    >
                      {overdue
                        ? `${u.d}일 지남`
                        : u.d === 0
                        ? "오늘"
                        : `${-(u.d ?? 0)}일 남음`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Link>
        </div>
      )}

      {/* 진행률 */}
      {checklistTotal > 0 && (
        <div className="px-5 pb-5">
          <Link to="/checklist" className="block card hover:bg-cream/50 transition">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">전체 진행률</h3>
              <span className="text-sm text-gold font-medium">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-line rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-gold/70 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-soft mt-2">
              {checklistDone} / {checklistTotal} 항목 완료
            </p>
          </Link>
        </div>
      )}

      {/* 메뉴 그리드 */}
      <div className="px-5">
        <h3 className="text-xs text-soft tracking-wider uppercase mb-3 px-1">결혼 준비</h3>
        <div className="grid grid-cols-2 gap-3">
          <TileLink to="/invitation" icon="💌" label="모바일 청첩장" sub="3개 국어 · 카톡 공유" />
          <TileLink to="/video" icon="🎥" label="식전영상" sub="사진·BGM·자연어 편집" />
          <TileLink to="/rings" icon="💍" label="결혼반지" sub={`${data.rings.length}개 후보`} />
          <TileLink to="/sdm" icon="📸" label="스드메·스냅" sub={`${data.sdm.length}곳 담음`} />
          <TileLink
            to="/trip"
            icon="🏝️"
            label="신혼여행"
            sub={`${data.honeymoon.regions.length}곳 · 항공 ${data.flights.length} · 숙소 ${data.hotels.length}`}
          />
          <TileLink to="/checklist" icon="✅" label="체크리스트" sub="일정·할 일" />
        </div>
      </div>
    </div>
  );
}

function TileLink({ to, icon, label, sub }: { to: string; icon: string; label: string; sub?: string; }) {
  return (
    <Link
      to={to}
      className="card flex flex-col items-start active:scale-[0.98] hover:border-gold/40 transition"
    >
      <span className="text-3xl mb-2">{icon}</span>
      <span className="font-medium text-sm">{label}</span>
      {sub && <span className="text-[11px] text-soft mt-0.5 leading-snug">{sub}</span>}
    </Link>
  );
}

function formatWeddingDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${days[d.getDay()]})`;
}
