import { useState, useEffect } from "react";
import { NavLink, useLocation, Link, useNavigate } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { daysSince } from "../lib/freshness";
import { useSaveStatus, useRealtimeStatus, useConflictStatus, clearConflict } from "../lib/storage";

type Props = {
  data: WeddingData;
  update: (patch: any) => void;
  children: React.ReactNode;
};

const NAV = [
  { to: "/dashboard", label: "홈" },
  { to: "/invitation", label: "청첩장" },
  { to: "/checklist", label: "체크리스트" },
  { to: "/video", label: "영상" },
  { to: "/settings", label: "더보기" },
];

// 데모 배너 dismiss 는 세션 단위 — 새 탭/새로고침 시 다시 보임(영영 안 보이는 사고 방지).
const DEMO_BANNER_DISMISSED_KEY = "wedding-os/demo-banner-dismissed/v1";

export default function AppShell({ data, children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const isWelcome = location.pathname === "/";
  const isSetup = location.pathname === "/setup";
  const isGuestInvitation = location.pathname === "/i";
  const isDashboard = location.pathname === "/dashboard";
  const isDemo = !!data.preferences.isDemo;
  const showNav = !isWelcome && !isSetup && !isGuestInvitation && (data.preferences.mode || isDemo);
  const showChrome = !isWelcome && !isGuestInvitation;
  // 서브 라우트엔 헤더에 ← 뒤로가기 — /dashboard(홈)·/setup(자체 흐름)·/(랜딩) 제외.
  const showBack = showChrome && !isDashboard;
  // 백업 알림 — 모드 1(localStorage 만 존재)인 사용자에게만, 의미 있는 데이터가 있을 때만.
  // 빈 상태 새 사용자에게 "백업하세요" 띄우는 건 노이즈.
  const hasMeaningfulData = !!(
    data.invitation.groomName ||
    data.invitation.brideName ||
    data.rings.length ||
    data.sdm.length ||
    data.checklist.length ||
    (data.venues ?? []).length ||
    (data.budget ?? []).length ||
    (data.guests ?? []).length
  );
  const backupStale =
    data.preferences.mode === "local" &&
    hasMeaningfulData &&
    isBackupStale(data.preferences.lastBackupAt);
  const saveStatus = useSaveStatus();
  const realtimeStatus = useRealtimeStatus();
  const conflictStatus = useConflictStatus();

  // 데모 배너 dismiss 상태 (세션 단위)
  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    try { setBannerDismissed(sessionStorage.getItem(DEMO_BANNER_DISMISSED_KEY) === "1"); }
    catch { /* noop */ }
  }, []);
  const dismissBanner = () => {
    setBannerDismissed(true);
    try { sessionStorage.setItem(DEMO_BANNER_DISMISSED_KEY, "1"); } catch { /* noop */ }
  };

  const goBack = () => {
    // 히스토리 stack 이 있으면 뒤로, 없으면 (새 탭 직접 진입 등) /dashboard.
    if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  };

  const startMine = () => navigate("/", { state: { goModeSelect: true } });

  return (
    <div className="min-h-screen max-w-app mx-auto flex flex-col bg-paper">
      {showChrome && (
        <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur">
          <div className="px-6 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {showBack && (
                <button
                  onClick={goBack}
                  aria-label="뒤로"
                  className="-ml-2 px-2 text-soft hover:text-ink transition text-lg leading-none"
                >
                  ←
                </button>
              )}
              <Link to="/dashboard" className="font-serif text-base tracking-tight text-ink truncate">
                Wedding<span className="text-gold">·</span>OS
              </Link>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <SaveBadge status={saveStatus} mode={data.preferences.mode ?? null} />
              {data.preferences.mode ? (
                <ModeBadge mode={data.preferences.mode} />
              ) : isDemo ? (
                <Link to="/settings" className="eyebrow">예시</Link>
              ) : null}
            </div>
          </div>
          <div className="hairline" />
        </header>
      )}

      {/* 데모 띠 — hairline 한 줄. 세션 단위로 닫기 가능 (× 버튼) */}
      {isDemo && !isWelcome && !isGuestInvitation && !bannerDismissed && (
        <div className="px-6 py-3 flex items-center justify-between gap-4 border-b border-hair">
          <div className="text-[12px] leading-tight flex-1 min-w-0">
            <div className="eyebrow-gold mb-1">예시 데이터</div>
            <div className="text-soft text-[12px]">마음에 들면 내 정보로 새로 시작</div>
          </div>
          <button onClick={startMine} className="text-[12px] underline underline-offset-4 decoration-ink text-ink whitespace-nowrap">
            내 결혼식 시작 →
          </button>
          <button
            onClick={dismissBanner}
            aria-label="배너 닫기"
            className="text-soft hover:text-ink text-lg leading-none -mr-1 px-1 flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* 실시간 끊김 알림 — 모드 2 동시 편집 깨진 신호 */}
      {realtimeStatus === "disconnected" && !isGuestInvitation && (
        <div className="px-6 py-3 border-b border-hair flex items-center justify-between gap-3">
          <span className="text-[12px] text-soft">
            동기화 연결이 끊어졌어요. 네트워크 확인 후 새로고침하세요.
          </span>
          <button
            onClick={() => window.location.reload()}
            className="text-[12px] underline underline-offset-4 text-ink"
          >
            새로고침
          </button>
        </div>
      )}

      {/* 동시 편집 충돌 — 다른 기기(신랑/신부 다른 폰)가 먼저 저장함. 사용자 동작 잃은 상태 */}
      {conflictStatus === "detected" && !isGuestInvitation && (
        <div className="px-6 py-3 border-b border-hair flex items-center justify-between gap-3 bg-gold/5">
          <span className="text-[12px] text-ink leading-relaxed">
            <strong>다른 기기에서 먼저 저장됐어요.</strong>
            <br />
            <span className="text-soft">방금 변경한 내용은 적용되지 않았어요. 새로고침해서 최신 데이터를 불러오세요.</span>
          </span>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => window.location.reload()}
              className="text-[12px] underline underline-offset-4 text-ink"
            >
              새로고침
            </button>
            <button onClick={clearConflict} className="text-[12px] text-soft">
              나중에
            </button>
          </div>
        </div>
      )}

      {/* 백업 알림 — 가는 띠 */}
      {backupStale && !isGuestInvitation && (
        <div className="px-6 py-3 border-b border-hair flex items-center justify-between gap-3">
          <span className="text-[12px] text-soft">오래 백업을 안 했어요</span>
          <Link to="/settings" className="text-[12px] underline underline-offset-4 text-ink">
            내려받기
          </Link>
        </div>
      )}

      <main className={`flex-1 page-enter ${showNav ? "pb-24" : ""}`}>{children}</main>

      {showNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app bg-paper/95 backdrop-blur z-30 border-t border-hair">
          <div className="grid grid-cols-5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex items-center justify-center py-4 text-[11px] tracking-wide transition ${
                    isActive ? "text-ink" : "text-soft"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px bg-ink" />
                    )}
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function ModeBadge({ mode }: { mode: "local" | "supabase" | "devOnly" }) {
  const label = mode === "local" ? "내 휴대폰" : mode === "supabase" ? "내 사이트" : "개발자";
  return (
    <Link to="/settings" className="eyebrow hover:text-ink transition">
      {label}
    </Link>
  );
}

// supabase 모드에서 네트워크 저장 상태를 작게 노출. local 모드는 즉시 저장이라 표시 안 함.
function SaveBadge({ status, mode }: { status: "idle" | "saving" | "saved" | "error"; mode: "local" | "supabase" | "devOnly" | null }) {
  if (mode !== "supabase") return null;
  if (status === "idle") return null;
  const map = {
    saving: { text: "저장 중", cls: "text-soft" },
    saved: { text: "✓ 저장됨", cls: "text-sage" },
    error: { text: "⚠ 저장 실패", cls: "text-gold" },
  } as const;
  const m = map[status as "saving" | "saved" | "error"];
  return <span className={`eyebrow ${m.cls}`}>{m.text}</span>;
}

function isBackupStale(lastBackupAt?: string): boolean {
  const d = daysSince(lastBackupAt);
  // lastBackupAt 없음 = 한 번도 백업한 적 없는 데이터. 그래도 즉시 알림은 노이즈 →
  // 호출부에서 "의미있는 데이터가 있을 때만" 조건으로 한 번 더 거른다.
  if (d === null) return true;
  return d >= 7;
}
