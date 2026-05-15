import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useWeddingData } from "./lib/storage";
import AppShell from "./components/AppShell";
import Welcome from "./routes/Welcome";
import Dashboard from "./routes/Dashboard";
import Rings from "./routes/Rings";
import Trip from "./routes/Trip";
import Sdm from "./routes/Sdm";
import Checklist from "./routes/Checklist";
import Invitation from "./routes/Invitation";
import Setup from "./routes/Setup";
import Settings from "./routes/Settings";
import Contact from "./routes/Contact";

// 식전영상 에디터는 Remotion(무거움)을 쓰므로 지연 로딩 — 초기 진입 속도 보호
const Video = lazy(() => import("./routes/Video"));

export default function App() {
  const { data, loading, update } = useWeddingData();
  const location = useLocation();

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

  // 모드가 정해진 사용자는 랜딩을 건너뛴다.
  if (mode && isWelcome) {
    return <Navigate to="/dashboard" replace />;
  }
  // 모드도 없고 데모도 아니면 (= 내 결혼식 시작 직후 빈 상태) 랜딩으로.
  if (!mode && !isDemo && !isWelcome && !isSetup) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell data={data!} update={update}>
      <Routes>
        <Route path="/" element={<Welcome data={data!} update={update} />} />
        <Route path="/setup" element={<Setup data={data!} update={update} />} />
        <Route path="/dashboard" element={<Dashboard data={data!} update={update} />} />
        <Route path="/rings" element={<Rings data={data!} update={update} />} />
        <Route path="/sdm" element={<Sdm data={data!} update={update} />} />
        <Route path="/trip" element={<Trip data={data!} update={update} />} />
        {/* 옛 경로 호환 — 신혼여행 페이지로 흡수 */}
        <Route path="/hotel" element={<Navigate to="/trip" replace />} />
        <Route path="/flights" element={<Navigate to="/trip" replace />} />
        <Route path="/honeymoon" element={<Navigate to="/trip" replace />} />
        <Route path="/checklist" element={<Checklist data={data!} update={update} />} />
        <Route path="/invitation" element={<Invitation data={data!} update={update} />} />
        <Route
          path="/video"
          element={
            <Suspense fallback={<div className="px-5 py-20 text-center text-soft">영상 편집기를 불러오는 중…</div>}>
              <Video data={data!} update={update} />
            </Suspense>
          }
        />
        <Route path="/settings" element={<Settings data={data!} update={update} />} />
        <Route path="/contact" element={<Contact data={data!} />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}
