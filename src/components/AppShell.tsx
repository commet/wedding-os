import { NavLink, useLocation, Link } from "react-router-dom";
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
  const isWelcome = location.pathname === "/";
  const isSetup = location.pathname === "/setup";
  const showNav = !isWelcome && !isSetup && data.preferences.mode;

  const backupStale = isBackupStale(data.preferences.lastBackupAt) && data.preferences.mode === "local";

  return (
    <div className="min-h-screen max-w-app mx-auto flex flex-col">
      {/* 상단 헤더 */}
      {!isWelcome && (
        <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur border-b border-line">
          <div className="px-4 py-3 flex items-center justify-between">
            <Link to="/dashboard" className="font-serif text-lg text-ink">
              Wedding OS
            </Link>
            {data.preferences.mode && (
              <ModeBadge mode={data.preferences.mode} />
            )}
          </div>
        </header>
      )}

      {/* 백업 알림 (모드 1, 7일 이상 안 함) */}
      {backupStale && (
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
