import { NavLink, useLocation, Link, useNavigate } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { daysSince } from "../lib/freshness";

type Props = {
  data: WeddingData;
  update: (patch: any) => void;
  children: React.ReactNode;
};

const NAV = [
  { to: "/dashboard", label: "홈", icon: "🏠" },
  { to: "/invitation", label: "청첩장", icon: "💌" },
  { to: "/checklist", label: "체크리스트", icon: "✅" },
  { to: "/video", label: "영상", icon: "🎥" },
  { to: "/settings", label: "더보기", icon: "⋯" },
];

export default function AppShell({ data, children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const isWelcome = location.pathname === "/";
  const isSetup = location.pathname === "/setup";
  const isGuestInvitation = location.pathname === "/i";
  const isDemo = !!data.preferences.isDemo;
  // 게스트 청첩장 페이지(/i)는 받는 사람용 — 헤더·탭·배너 다 숨김.
  const showNav = !isWelcome && !isSetup && !isGuestInvitation && (data.preferences.mode || isDemo);
  const showChrome = !isWelcome && !isGuestInvitation;

  const backupStale = isBackupStale(data.preferences.lastBackupAt) && data.preferences.mode === "local";

  const startMine = () => navigate("/", { state: { goModeSelect: true } });

  return (
    <div className="min-h-screen max-w-app mx-auto flex flex-col">
      {/* 상단 헤더 */}
      {showChrome && (
        <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur border-b border-line">
          <div className="px-4 py-3 flex items-center justify-between">
            <Link to="/dashboard" className="font-serif text-lg text-ink">
              Wedding OS
            </Link>
            {data.preferences.mode ? (
              <ModeBadge mode={data.preferences.mode} />
            ) : isDemo ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-taupe/20 text-soft">예시 보기</span>
            ) : null}
          </div>
        </header>
      )}

      {/* 데모 배너 — 게스트 청첩장 페이지에선 안 보임 */}
      {isDemo && !isWelcome && !isGuestInvitation && (
        <div className="mx-4 mt-3 p-3 bg-gold/10 border border-gold/30 rounded-xl flex items-center gap-3">
          <span className="text-sm flex-1">
            ✨ <strong>예시 데이터로 둘러보는 중</strong>
            <br />
            <span className="text-xs text-soft">마음에 들면 내 정보로 새로 시작하세요</span>
          </span>
          <button onClick={startMine} className="btn-primary text-xs px-3 py-2 flex-shrink-0">
            내 결혼식 시작
          </button>
        </div>
      )}

      {/* 백업 알림 (모드 1, 7일 이상 안 함) — 게스트 청첩장에선 안 보임 */}
      {backupStale && !isGuestInvitation && (
        <div className="mx-4 mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
          ⚠️ <strong>오래 백업을 안 했어요.</strong>{" "}
          <Link to="/settings" className="underline">
            지금 내려받기
          </Link>
        </div>
      )}

      {/* 본문 */}
      <main className={`flex-1 ${showNav ? "pb-20" : ""}`}>{children}</main>

      {/* 하단 탭 (모바일) */}
      {showNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app bg-white border-t border-line z-30">
          <div className="grid grid-cols-5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-2.5 text-xs ${
                    isActive ? "text-gold" : "text-soft"
                  }`
                }
              >
                <span className="text-xl leading-none mb-1">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function ModeBadge({ mode }: { mode: "local" | "supabase" | "devOnly" }) {
  const map = {
    local: { label: "내 휴대폰", color: "bg-sage/20 text-sage" },
    supabase: { label: "내 사이트", color: "bg-gold/20 text-gold" },
    devOnly: { label: "개발자 모드", color: "bg-taupe/20 text-soft" },
  } as const;
  const m = map[mode];
  return (
    <Link
      to="/settings"
      className={`text-xs px-2.5 py-1 rounded-full ${m.color}`}
    >
      {m.label}
    </Link>
  );
}

function isBackupStale(lastBackupAt?: string): boolean {
  const d = daysSince(lastBackupAt);
  if (d === null) return true;
  return d >= 7;
}
