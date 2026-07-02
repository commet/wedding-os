import { useState, useEffect } from "react";
import { NavLink, useLocation, Link, useNavigate } from "react-router-dom";
import type { WeddingData, Mode } from "../lib/schema";
import { daysSince } from "../lib/freshness";
import { useSaveStatus, useConflictStatus, clearConflict } from "../lib/storage";
import MenuSheet from "./MenuSheet";

type Props = {
  data: WeddingData;
  update: (patch: any) => void;
  children: React.ReactNode;
};

// 하단 탭 — 4개 핵심 라우트 + 5번째 "더보기"는 전체 기능 시트를 여는 버튼.
const NAV = [
  { to: "/dashboard", label: "홈" },
  { to: "/invitation", label: "청첩장" },
  { to: "/checklist", label: "체크리스트" },
  { to: "/budget", label: "예산" },
];
// 4개 탭에 해당하지 않는 경로 — 이때 "더보기"를 현재 위치로 강조.
const TAB_PATHS = NAV.map((n) => n.to);

// 데모 배너 dismiss 는 세션 단위 — 새 탭/새로고침 시 다시 보임(영영 안 보이는 사고 방지).
const DEMO_BANNER_DISMISSED_KEY = "wedding-os/demo-banner-dismissed/v1";

export default function AppShell({ data, children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const isWelcome = location.pathname === "/";
  const isSetup = location.pathname === "/setup";
  const isGuestInvitation = location.pathname === "/i";
  const isDashboard = location.pathname === "/dashboard";
  const wideWorkspace = ["/dashboard", "/checklist", "/budget", "/guests", "/venues", "/rings", "/sdm", "/snap", "/trip"].some(
    (path) => location.pathname.startsWith(path),
  );
  const isDemo = !!data.preferences.isDemo;
  const showNav = !isWelcome && !isSetup && !isGuestInvitation && (data.preferences.mode || isDemo);
  const showChrome = !isWelcome && !isGuestInvitation;
  // 서브 라우트엔 헤더에 ← 뒤로가기 — /dashboard(홈)·/setup(자체 흐름)·/(랜딩) 제외.
  const showBack = showChrome && !isDashboard;
  // 백업 알림 — 모드 1(localStorage 만 존재)인 사용자에게만, 챙길 게 쌓였을 때만.
  // 첫날 이름만 적은 사용자에게 "백업하세요"는 노이즈 →
  // 이름 + 실제 준비 항목(반지·스드메·예식장·예산·하객) 하나 이상이 있을 때만 알린다.
  const hasNames = !!(data.invitation.groomName || data.invitation.brideName);
  const hasCategory = !!(
    data.rings.length ||
    data.sdm.length ||
    (data.venues ?? []).length ||
    (data.budget ?? []).length ||
    (data.guests ?? []).length
  );
  const hasMeaningfulData = hasNames && hasCategory;
  const backupStale =
    data.preferences.mode === "local" &&
    hasMeaningfulData &&
    isBackupStale(data.preferences.lastBackupAt);
  const saveStatus = useSaveStatus();
  const conflictStatus = useConflictStatus();

  // "더보기" 전체 기능 시트 — 라우트가 바뀌면 닫는다.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  const isMoreActive = !TAB_PATHS.includes(location.pathname);
  const actionDenseRoute = ["/venues", "/rings", "/sdm", "/trip", "/video"].some((path) => location.pathname.startsWith(path));

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
    <div className={`min-h-screen w-full mx-auto flex flex-col bg-paper ${wideWorkspace ? "lg:max-w-6xl" : "max-w-app"}`}>
      {showChrome && (
        <header className="sticky top-0 z-30 bg-paper">
          <div className="px-6 h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {showBack && (
                <button
                  onClick={goBack}
                  aria-label="뒤로"
                  className="-ml-2 px-2 min-w-11 min-h-11 text-soft hover:text-ink transition text-lg leading-none"
                >
                  ←
                </button>
              )}
              <Link to="/dashboard" className="font-serif text-base tracking-[-0.01em] text-ink truncate min-h-11 flex items-center">
                Dearie
              </Link>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <SaveBadge status={saveStatus} mode={data.preferences.mode ?? null} />
              {data.preferences.mode ? (
                <ModeBadge mode={data.preferences.mode} />
              ) : isDemo ? (
                <Link to="/settings" className="eyebrow flex min-h-11 items-center">예시</Link>
              ) : null}
            </div>
          </div>
          <div className="hairline" />
        </header>
      )}

      {/* 데모 띠 — 작은 안내. 세션 단위로 닫기 가능 (× 버튼) */}
      {isDemo && !isWelcome && !isGuestInvitation && !bannerDismissed && (
        <div className="anim-drop flex min-h-10 items-center justify-between gap-3 border-b border-hair px-6 py-1.5">
          <div className="flex min-w-0 flex-1 items-baseline gap-2 text-[12px] leading-tight">
            <span className="font-semibold text-gold">예시</span>
            <span className="truncate text-soft">내 정보로 바꿔 시작할 수 있어요</span>
          </div>
          <button onClick={startMine} className="min-h-9 whitespace-nowrap px-2 text-[12.5px] font-semibold text-ink underline underline-offset-4 decoration-ink">
            시작 →
          </button>
          <button
            onClick={dismissBanner}
            aria-label="배너 닫기"
            className="-mr-2 flex min-h-9 min-w-9 flex-shrink-0 items-center justify-center text-lg leading-none text-soft hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      {/* 동시 편집 충돌 — 다른 기기(신랑/신부 다른 폰)가 먼저 저장함. 사용자 동작 잃은 상태 */}
      {conflictStatus === "detected" && !isGuestInvitation && (
        <div className="anim-drop px-6 py-3 border-b border-hair flex items-center justify-between gap-3 bg-gold/5">
          <span className="text-[12px] text-ink leading-relaxed">
            <strong>다른 기기에서 먼저 저장했어요.</strong>
            <br />
            <span className="text-soft">신랑·신부가 같은 정보를 동시에 고치면 이런 일이 생겨요. 방금 변경한 내용이 덮어쓰이지 않도록 잠시 멈춰뒀어요. <strong className="text-ink font-normal">새로고침</strong>하면 최신 내용을 불러오고, <strong className="text-ink font-normal">나중에</strong>를 누르면 이 알림만 닫아요.</span>
          </span>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => window.location.reload()}
              className="min-h-11 px-2 text-[12px] underline underline-offset-4 text-ink"
            >
              새로고침
            </button>
            <button onClick={clearConflict} className="min-h-11 px-2 text-[12px] text-soft">
              나중에
            </button>
          </div>
        </div>
      )}

      {/* 백업 알림 — 가는 띠 */}
      {backupStale && !isGuestInvitation && !actionDenseRoute && (
        <div className="anim-drop px-6 py-3 border-b border-hair flex items-center justify-between gap-3">
          <span className="text-[12px] text-soft leading-relaxed">
            준비 내용이 이 휴대폰에만 있어요. 한 번 내려받아 두면 기기를 바꿔도 안심이에요.
          </span>
          <Link to="/settings#data-backup" className="text-[12px] underline underline-offset-4 text-ink min-h-11 flex items-center flex-shrink-0">
            내려받기
          </Link>
        </div>
      )}

      {showNav && (
        <nav className="hidden border-b border-hair bg-paper lg:block">
          <div className="flex h-12 items-center justify-center gap-8 px-6">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex h-12 items-center text-[14px] font-semibold transition ${
                    isActive ? "text-ink" : "text-soft hover:text-ink"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="anim-fade absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-ink" />
                    )}
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
            <button
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className={`relative flex h-12 items-center text-[14px] font-semibold transition ${
                isMoreActive || menuOpen ? "text-ink" : "text-soft hover:text-ink"
              }`}
            >
              {(isMoreActive || menuOpen) && (
                <span className="anim-fade absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-ink" />
              )}
              더보기
            </button>
          </div>
        </nav>
      )}

      <main className={`flex-1 page-enter ${showNav ? "pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-0" : ""}`}>{children}</main>

      {showNav && (
        <nav className={`fixed bottom-0 left-1/2 z-30 w-full -translate-x-1/2 border-t border-hair bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden ${wideWorkspace ? "lg:max-w-6xl" : "max-w-app"}`}>
          <div className="grid grid-cols-5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative min-h-12 flex items-center justify-center py-2 text-[13px] font-medium tracking-wide transition ${
                    isActive ? "text-ink" : "text-soft"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="anim-fade absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px bg-ink" />
                    )}
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
            <button
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className={`relative min-h-12 flex items-center justify-center py-2 text-[13px] font-medium tracking-wide transition ${
                isMoreActive || menuOpen ? "text-ink" : "text-soft"
              }`}
            >
              {isMoreActive && (
                <span className="anim-fade absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px bg-ink" />
              )}
              더보기
            </button>
          </div>
        </nav>
      )}

      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} data={data} />
    </div>
  );
}

function ModeBadge({ mode }: { mode: Mode }) {
  const label =
    mode === "local" ? "내 휴대폰" :
    mode === "hosted" ? "간편" :
    mode === "supabase" ? "내 사이트" : "개발자";
  return (
    <Link to="/settings" className="eyebrow hover:text-ink transition">
      {label}
    </Link>
  );
}

// 네트워크 저장 모드(supabase/hosted)에서 저장 상태를 작게 노출. local 은 즉시 저장이라 표시 안 함.
function SaveBadge({ status, mode }: { status: "idle" | "saving" | "saved" | "error"; mode: Mode | null }) {
  if (mode !== "supabase" && mode !== "hosted") return null;
  if (status === "idle") return null;
  const map = {
    saving: { text: "저장 중", cls: "text-soft" },
    saved: { text: "✓ 저장됨", cls: "text-sage" },
    error: { text: "⚠ 저장 실패", cls: "text-gold" },
  } as const;
  const m = map[status as "saving" | "saved" | "error"];
  return <span className={`anim-pop eyebrow ${m.cls}`}>{m.text}</span>;
}

function isBackupStale(lastBackupAt?: string): boolean {
  const d = daysSince(lastBackupAt);
  // lastBackupAt 없음 = 한 번도 백업한 적 없는 데이터. 그래도 즉시 알림은 노이즈 →
  // 호출부에서 "의미있는 데이터가 있을 때만" 조건으로 한 번 더 거른다.
  if (d === null) return true;
  return d >= 14;
}
