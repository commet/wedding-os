import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useWeddingData } from "./lib/storage";
import AppShell from "./components/AppShell";
import ErrorBoundary from "./components/ErrorBoundary";
// 첫 진입 셸 — 랜딩(/)만 즉시 떠야 하므로 eager.
// 홈과 나머지 화면은 라우트별 lazy 로 분할 — 초기 번들 ↓.
import Welcome from "./routes/Welcome";

const Dashboard = lazy(() => import("./routes/Dashboard"));
const Invitation = lazy(() => import("./routes/Invitation"));
const Rings = lazy(() => import("./routes/Rings"));
const Trip = lazy(() => import("./routes/Trip"));
const Sdm = lazy(() => import("./routes/Sdm"));
const Checklist = lazy(() => import("./routes/Checklist"));
const Ceremony = lazy(() => import("./routes/Ceremony"));
const Venues = lazy(() => import("./routes/Venues"));
const Budget = lazy(() => import("./routes/Budget"));
const Guests = lazy(() => import("./routes/Guests"));
const Share = lazy(() => import("./routes/Share"));
const AiSettings = lazy(() => import("./routes/AiSettings"));
const Setup = lazy(() => import("./routes/Setup"));
const Settings = lazy(() => import("./routes/Settings"));
const Contact = lazy(() => import("./routes/Contact"));
const Privacy = lazy(() => import("./routes/Privacy"));
const Terms = lazy(() => import("./routes/Terms"));
const Trust = lazy(() => import("./routes/Trust"));
const HostedStart = lazy(() => import("./routes/HostedStart"));
const Recover = lazy(() => import("./routes/Recover"));
const Login = lazy(() => import("./routes/Login"));
// 식전영상 에디터는 Remotion(무거움)을 쓰므로 별도 청크.
const Video = lazy(() => import("./routes/Video"));
// 호스팅 발행 청첩장 — 게스트가 /i/<code> 로 여는 단독 화면.
const HostedInvitation = lazy(() => import("./routes/HostedInvitation"));

export default function App() {
  const location = useLocation();

  // 옛 /i 공개 경로는 전체 WeddingData를 hydrate하지 않는다.
  // 실제 하객용 링크는 /i/<code>#k=... 이며 HostedInvitation 단독 화면에서만 열린다.
  if (location.pathname === "/i") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-6 text-center">
        <div className="max-w-[360px]">
          <div className="eyebrow-gold mb-3">Dearie</div>
          <h1 className="font-serif text-[1.8rem] leading-tight text-ink">청첩장 링크를 확인해주세요</h1>
          <p className="mt-4 text-[13px] leading-relaxed text-soft">
            하객용 링크는 <span className="text-ink">/i/초대코드</span> 형태로 열립니다.
            링크 전체를 다시 받아 열어주세요.
          </p>
        </div>
      </div>
    );
  }

  // 호스팅 발행 청첩장(/i/<code>) — 게스트 전용. 앱 셸·데이터 없이 단독 렌더.
  if (location.pathname.startsWith("/i/")) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-soft">청첩장을 여는 중…</div>}>
        <HostedInvitation />
      </Suspense>
    );
  }

  // 복구 링크 진입 — 셸·가드 없이 단독 렌더 (자체적으로 시크릿 심고 /dashboard 로 새로고침).
  if (location.pathname === "/recover") {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-soft">복구 중…</div>}>
        <Recover />
      </Suspense>
    );
  }

  // 로그인 — 매직링크 리다이렉트 착지점. 데이터·가드 전에 단독 렌더.
  if (location.pathname === "/login") {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-soft">확인 중…</div>}>
        <Login />
      </Suspense>
    );
  }

  return <WeddingAppRoutes location={location} />;
}

function WeddingAppRoutes({ location }: { location: ReturnType<typeof useLocation> }) {
  const { data, loading, update } = useWeddingData();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-soft">
        불러오는 중…
      </div>
    );
  }

  const mode = data?.preferences.mode ?? null;
  const isDemo = data?.preferences.isDemo ?? false;
  const isWelcome = location.pathname === "/";
  const isSetup = location.pathname === "/setup";
  // 투명성 페이지는 모드를 고르기 *전에* 봐야 하므로 빈 상태에서도 진입 허용.
  const isTrust = location.pathname === "/trust";
  // 법적 고지는 모드를 고르기 전에도 접근 가능해야 한다.
  const isPrivacy = location.pathname === "/privacy";
  const isTerms = location.pathname === "/terms";
  // 간편 모드 시작 화면도 모드 확정 전이라 빈 상태에서 진입 허용.
  const isHostedStart = location.pathname === "/start-hosted";
  // 사용자가 입력한 내용이 하나라도 있는지 — Settings.switchMode 직후처럼 mode/isDemo 둘 다 없어도
  // 데이터는 그대로 유지되는 케이스를 위해.
  const hasContent = !!(
    data &&
    (data.invitation.groomName ||
      data.invitation.brideName ||
      data.rings.length ||
      data.sdm.length ||
      data.checklist.length)
  );

  // 모드가 정해진 사용자는 랜딩을 건너뛴다.
  if (mode && isWelcome) {
    return <Navigate to="/dashboard" replace />;
  }
  // 모드·데모·데이터 셋 다 없으면 (= 내 결혼식 시작 직후 진짜 빈 상태) 랜딩으로.
  if (!mode && !isDemo && !hasContent && !isWelcome && !isSetup && !isTrust && !isPrivacy && !isTerms && !isHostedStart) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell data={data!} update={update}>
      <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<div className="px-5 py-20 text-center text-soft">불러오는 중…</div>}>
          <Routes>
          <Route path="/" element={<Welcome data={data!} update={update} />} />
          <Route path="/setup" element={<Setup data={data!} update={update} />} />
          <Route path="/dashboard" element={<Dashboard data={data!} update={update} />} />
          <Route path="/rings" element={<Rings data={data!} update={update} />} />
          <Route path="/sdm" element={<Sdm data={data!} update={update} initialCategory="studio" />} />
          <Route path="/snap" element={<Sdm data={data!} update={update} initialCategory="snap" />} />
          <Route path="/trip" element={<Trip data={data!} update={update} />} />
          {/* 옛 경로 호환 — 신혼여행 페이지로 흡수 */}
          <Route path="/hotel" element={<Navigate to="/trip" replace />} />
          <Route path="/flights" element={<Navigate to="/trip" replace />} />
          <Route path="/honeymoon" element={<Navigate to="/trip" replace />} />
          <Route path="/checklist" element={<Checklist data={data!} update={update} />} />
          <Route path="/ceremony" element={<Ceremony data={data!} update={update} />} />
          <Route path="/invitation" element={<Invitation data={data!} update={update} />} />
          <Route path="/venues" element={<Venues data={data!} update={update} />} />
          <Route path="/budget" element={<Budget data={data!} update={update} />} />
          <Route path="/guests" element={<Guests data={data!} update={update} />} />
          <Route path="/share" element={<Share data={data!} update={update} />} />
          <Route path="/ai" element={<AiSettings data={data!} />} />
          <Route path="/video" element={<Video data={data!} update={update} />} />
          <Route path="/settings" element={<Settings data={data!} update={update} />} />
          <Route path="/contact" element={<Contact data={data!} />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/trust" element={<Trust />} />
          <Route path="/start-hosted" element={<HostedStart data={data!} update={update} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
