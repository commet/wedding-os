import { Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { useMemo } from "react";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Dashboard({ data }: Props) {
  const dday = useMemo(() => {
    if (!data.invitation.date) return null;
    const t = new Date(data.invitation.date).getTime();
    if (isNaN(t)) return null;
    const days = Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  }, [data.invitation.date]);

  const checklistTotal = data.checklist.reduce((n, s) => n + s.items.length, 0);
  const checklistDone = data.checklist.reduce((n, s) => n + s.items.filter(i => i.done).length, 0);
  const progress = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const urgentItems = data.checklist
    .flatMap(s => s.items.filter(i => !i.done && i.priority === "red").map(i => ({ section: s.title, item: i })))
    .slice(0, 3);

  const empty = !data.invitation.groomName && !data.invitation.brideName;

  return (
    <div className="px-5 py-6 space-y-5">
      {/* D-day / hero */}
      <div className="card text-center bg-gradient-to-br from-cream to-white">
        {empty ? (
          <>
            <p className="text-soft text-sm mb-3">아직 정보가 비어 있어요.</p>
            <Link to="/invitation" className="btn-primary inline-block">
              청첩장 정보부터 시작하기
            </Link>
          </>
        ) : (
          <>
            <p className="text-soft text-sm">
              {data.invitation.groomName} · {data.invitation.brideName}
            </p>
            {dday !== null && (
              <p className="font-serif text-4xl my-2 text-gold">
                {dday > 0 ? `D-${dday}` : dday === 0 ? "D-day" : `D+${Math.abs(dday)}`}
              </p>
            )}
            <p className="text-sm text-soft">{data.invitation.venue || "장소 미정"}</p>
          </>
        )}
      </div>

      {/* Urgent */}
      {urgentItems.length > 0 && (
        <div className="card border-red-200 bg-red-50/50">
          <h3 className="font-medium mb-3">🚨 급한 일</h3>
          <ul className="space-y-2 text-sm">
            {urgentItems.map((u, i) => (
              <li key={i}>
                <span className="text-soft">{u.section}</span> · {u.item.text}
              </li>
            ))}
          </ul>
          <Link to="/checklist" className="text-xs text-gold underline mt-3 inline-block">
            체크리스트로 →
          </Link>
        </div>
      )}

      {/* 진행도 */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">체크리스트</h3>
          <span className="text-sm text-soft">{checklistDone} / {checklistTotal}</span>
        </div>
        <div className="w-full h-2 bg-line rounded-full overflow-hidden">
          <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
        </div>
        <Link to="/checklist" className="text-sm text-gold underline mt-3 inline-block">
          전체 보기 →
        </Link>
      </div>

      {/* 메뉴 그리드 */}
      <div className="grid grid-cols-2 gap-3">
        <TileLink to="/invitation" icon="💌" label="청첩장" sub="모바일 청첩장" />
        <TileLink to="/video" icon="🎥" label="식전영상" sub="에디터" />
        <TileLink to="/rings" icon="💍" label="결혼반지" sub={`${data.rings.length}개 후보`} />
        <TileLink to="/hotel" icon="🏨" label="호텔" sub={`${data.hotels.length}곳 비교`} />
        <TileLink to="/flights" icon="✈️" label="항공권" sub={`${data.flights.length}개 옵션`} />
        <TileLink to="/honeymoon" icon="🏝️" label="신혼여행" sub={`${data.honeymoon.regions.length}곳`} />
      </div>
    </div>
  );
}

function TileLink({ to, icon, label, sub }: { to: string; icon: string; label: string; sub?: string; }) {
  return (
    <Link to={to} className="card flex flex-col items-start active:bg-cream transition">
      <span className="text-2xl mb-2">{icon}</span>
      <span className="font-medium">{label}</span>
      {sub && <span className="text-xs text-soft mt-0.5">{sub}</span>}
    </Link>
  );
}
