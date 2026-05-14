import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useWeddingData } from "./lib/storage";
import AppShell from "./components/AppShell";
import Welcome from "./routes/Welcome";
import Dashboard from "./routes/Dashboard";
import Rings from "./routes/Rings";
import Hotel from "./routes/Hotel";
import Flights from "./routes/Flights";
import Honeymoon from "./routes/Honeymoon";
import Checklist from "./routes/Checklist";
import Invitation from "./routes/Invitation";
import Video from "./routes/Video";
import Setup from "./routes/Setup";
import Settings from "./routes/Settings";
import Contact from "./routes/Contact";

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
  const isWelcome = location.pathname === "/";
  const isSetup = location.pathname === "/setup";

  // 모드가 정해지지 않았으면 Welcome으로 강제 (Welcome/Setup 빼고)
  if (!mode && !isWelcome && !isSetup) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell data={data!} update={update}>
      <Routes>
        <Route path="/" element={<Welcome data={data!} update={update} />} />
        <Route path="/setup" element={<Setup data={data!} update={update} />} />
        <Route path="/dashboard" element={<Dashboard data={data!} update={update} />} />
        <Route path="/rings" element={<Rings data={data!} update={update} />} />
        <Route path="/hotel" element={<Hotel data={data!} update={update} />} />
        <Route path="/flights" element={<Flights data={data!} update={update} />} />
        <Route path="/honeymoon" element={<Honeymoon data={data!} update={update} />} />
        <Route path="/checklist" element={<Checklist data={data!} update={update} />} />
        <Route path="/invitation" element={<Invitation data={data!} update={update} />} />
        <Route path="/video" element={<Video data={data!} update={update} />} />
        <Route path="/settings" element={<Settings data={data!} update={update} />} />
        <Route path="/contact" element={<Contact data={data!} />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}
