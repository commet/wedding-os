import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import type { WeddingData, WeddingUpdate } from "../lib/schema";
import { defaultData } from "../lib/schema";
import { markOwner } from "../lib/security";
import { defaultChecklist } from "../data/checklistTemplate";
import { demoData } from "../data/demoData";
import { authAvailable } from "../lib/auth";
import { downloadCorruptLocalBackup, hasCorruptLocalBackup } from "../lib/storage";
import AgentOnboarding from "../components/AgentOnboarding";
import type { AgentAnswers } from "../lib/agentProfile";
import { koBreak } from "../lib/typography";

type Props = {
  data: WeddingData;
  update: (patch: WeddingUpdate) => void;
};

// 첫 관문은 "혼자 vs 같이"라는 사용자 언어의 결정 2개.
// 직접 운영(supabase/devOnly)은 개발자용 접이식으로 강등.
type ModeId = "hosted" | "local" | "supabase" | "devOnly";

const PRIMARY_MODES: ReadonlyArray<{ id: ModeId; title: string; oneLiner: string; difficulty: string }> = [
  {
    id: "hosted",
    title: "둘이 같이 볼게요",
    oneLiner: "링크 하나로 배우자와 같은 준비판을 함께 편집하고, 청첩장 RSVP까지 받아요.",
    difficulty: "링크 공유 · 추천",
  },
  {
    id: "local",
    title: "혼자 먼저 정리할게요",
    oneLiner: "가입 없이 이 기기에서 바로 시작해요. 나중에 링크로 같이 보기로 바꿀 수 있어요.",
    difficulty: "30초 · 이 기기",
  },
];

const ADVANCED_MODES: ReadonlyArray<{ id: ModeId; title: string; oneLiner: string; difficulty: string }> = [
  {
    id: "supabase",
    title: "내 저장소로 직접 운영",
    oneLiner: "직접 만든 저장 공간에 연결해 운영합니다. 기술 설정에 익숙한 분께 맞습니다.",
    difficulty: "고급 · 직접 설정",
  },
  {
    id: "devOnly",
    title: "코드로 직접 운영",
    oneLiner: "코드를 받아 내 서버·디자인·기능까지 직접 바꾸는 개발자용 선택지입니다.",
    difficulty: "GitHub",
  },
];

export default function Welcome({ data, update }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<"landing" | "modeSelect">("landing");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hostedReady = authAvailable();

  // 데모 배너 '내 결혼식 시작' 등에서 들어오면 저장 방식을 고르는 화면으로 보낸다.
  useEffect(() => {
    if ((location.state as any)?.goModeSelect) {
      navigate(location.pathname, { replace: true, state: null });
      setStep("modeSelect");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname]);

  const browseDemo = () => {
    // 모드 미선택 + 데모 아님 + 데이터 거의 없음 = 진짜 빈 상태
    // → App.tsx 가드(!mode && !isDemo)가 /dashboard 를 / 로 튕기므로 데모 데이터를 복원해야 진입 가능.
    // 사용자 데이터가 있으면 손대지 않는다(Settings.switchMode 직후 등 — 데이터 보호 우선).
    if (!data.preferences.mode && !data.preferences.isDemo) {
      const hasContent = !!(
        data.invitation.groomName ||
        data.invitation.brideName ||
        data.rings.length ||
        data.sdm.length ||
        data.checklist.length ||
        (data.venues ?? []).length ||
        (data.budget ?? []).length ||
        (data.guests ?? []).length
      );
      if (!hasContent) update(() => demoData());
    }
    navigate("/dashboard");
  };

  const backToLanding = () => {
    setStep("landing");
    // URL state 의 goModeSelect 를 비워서, 이 화면에서 다른 곳으로 갔다 뒤로가기로 돌아와도 modeSelect 로 안 튀게.
    navigate("/", { replace: true, state: null });
  };

  const selectMode = (id: ModeId) => {
    if (id === "devOnly") {
      window.open("https://github.com/commet/wedding-os", "_blank", "noopener,noreferrer");
      return;
    }
    // 간편(hosted)은 전용 시작 화면이 자격증명 생성·복구링크까지 처리한다.
    if (id === "hosted") {
      if (!hostedReady) return;
      navigate("/start-hosted");
      return;
    }
    const localMode = id === "local";
    update((prev: WeddingData) => {
      if (prev.preferences.isDemo) {
        const base = defaultData();
        return {
          ...base,
          checklist: defaultChecklist(),
          preferences: {
            ...base.preferences,
            mode: localMode ? "local" : null,
            isDemo: false,
          },
        };
      }
      return {
        ...prev,
        checklist: prev.checklist.length ? prev.checklist : defaultChecklist(prev.invitation.date),
        preferences: {
          ...prev.preferences,
          mode: localMode ? "local" : null,
          isDemo: false,
        },
      };
    });

    if (localMode) markOwner();
    navigate(id === "local" ? "/dashboard" : "/setup");
  };

  const completeAgent = async (answers: AgentAnswers) => {
    const { buildAgentDraft } = await import("../lib/agentDraft");
    update(() => buildAgentDraft(data, answers));
    markOwner();
    navigate(answers.storage === "hosted" ? "/start-hosted" : "/dashboard");
  };

  /* ──────── 모드 선택 단계 ──────── */
  if (step === "modeSelect") {
    return (
      <div className="page max-w-app mx-auto pt-10 pb-16">
        <button onClick={backToLanding} className="eyebrow mb-12 inline-flex items-center gap-2">
          <span>←</span> 돌아가기
        </button>

        <div className="mb-9">
          <div className="eyebrow-gold mb-4">어떻게 쓸까</div>
          <h1 className="display-sm mb-3">
            {koBreak("혼자 정리할까요,")}<br />
            {koBreak("둘이 같이 볼까요?")}
          </h1>
          <p className="text-soft text-[13px] leading-relaxed">
            이 선택이 준비 내용이 어디에 남을지도 정해줘요.
            혼자 먼저 시작해도 나중에 링크로 같이 볼 수 있어요.
          </p>
          <Link to="/trust" className="inline-block mt-4 text-[12px] text-ink underline underline-offset-4 hover:text-gold transition">
            저장 방식과 암호화 확인 →
          </Link>
        </div>

        <ul className="stack border-t border-hair border-b">
          {PRIMARY_MODES.map((m, idx) => {
            const recommended = hostedReady ? m.id === "hosted" : m.id === "local";
            const unavailable = m.id === "hosted" && !hostedReady;
            return (
            <li key={m.id}>
              <button
                onClick={() => selectMode(m.id)}
                disabled={unavailable}
                className="w-full text-left flex items-start gap-5 active:opacity-60 transition disabled:opacity-45"
              >
                <div className="font-serif text-soft text-lg tabular-nums pt-0.5 w-6 flex-shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <h2 className="font-serif text-lg text-ink">{m.title}</h2>
                    {recommended && <span className="eyebrow-gold">추천</span>}
                  </div>
                  <p className="text-[13px] text-soft leading-relaxed mb-2">{m.oneLiner}</p>
                  <span className="eyebrow">{unavailable ? "운영 준비 중" : m.difficulty.replace(" · 추천", "")}</span>
                </div>
                <span className="text-soft pt-1 flex-shrink-0">→</span>
              </button>
            </li>
          );})}
        </ul>

        <div className="mt-10">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="eyebrow flex items-center gap-2"
          >
            직접 운영할래요 (개발자) {showAdvanced ? "−" : "+"}
          </button>
          {showAdvanced && (
            <div className="mt-5 pt-5 border-t border-hair">
              <ul className="stack border-b border-hair pb-6 mb-6">
                {ADVANCED_MODES.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => selectMode(m.id)}
                      className="w-full text-left flex items-start gap-5 active:opacity-60 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <h2 className="font-serif text-lg text-ink mb-1.5">{m.title}</h2>
                        <p className="text-[13px] text-soft leading-relaxed mb-2">{m.oneLiner}</p>
                        <span className="eyebrow">{m.difficulty}</span>
                      </div>
                      <span className="text-soft pt-1 flex-shrink-0">→</span>
                    </button>
                  </li>
                ))}
              </ul>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-soft">
                    <th className="text-left py-2 font-normal eyebrow"></th>
                    <th className="text-center py-2 font-normal eyebrow">내 기기</th>
                    <th className="text-center py-2 font-normal eyebrow">링크</th>
                    <th className="text-center py-2 font-normal eyebrow">직접</th>
                    <th className="text-center py-2 font-normal eyebrow">코드로</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hair">
                  <tr><td className="py-3 text-soft">가입</td><td className="text-center">없음</td><td className="text-center">로그인</td><td className="text-center">외부 서비스</td><td className="text-center">GitHub</td></tr>
                  <tr><td className="py-3 text-soft">저장 위치</td><td className="text-center">이 기기</td><td className="text-center">암호화 저장</td><td className="text-center">내 저장소</td><td className="text-center">내가 정함</td></tr>
                  <tr><td className="py-3 text-soft">함께 편집</td><td className="text-center">전환 후</td><td className="text-center">바로</td><td className="text-center">바로</td><td className="text-center">구현 자유</td></tr>
                  <tr><td className="py-3 text-soft">청첩장 링크</td><td className="text-center">발행 가능</td><td className="text-center">가능</td><td className="text-center">가능</td><td className="text-center">구현 자유</td></tr>
                  <tr><td className="py-3 text-soft">데이터 이동</td><td className="text-center">백업 후 전환</td><td className="text-center">처음부터 같이</td><td className="text-center">처음부터 독립</td><td className="text-center">내가 관리</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ──────── 랜딩 ──────── */
  return (
    <div className="max-w-app mx-auto min-h-screen">
      {hasCorruptLocalBackup() && (
        <div role="alert" className="mx-6 mt-6 border border-gold/40 bg-paper p-4 relative z-10">
          <p className="text-[12px] text-ink leading-relaxed">이 기기의 이전 데이터가 손상되어 자동으로 열지 못했습니다. 원문은 덮어쓰지 않고 별도로 보존했습니다.</p>
          <button onClick={downloadCorruptLocalBackup} className="mt-2 min-h-11 text-[12px] underline underline-offset-4 text-ink">
            손상 원문 내려받기 →
          </button>
        </div>
      )}
      <AgentOnboarding
        data={data}
        hostedReady={hostedReady}
        onComplete={completeAgent}
        onAdvanced={() => setStep("modeSelect")}
        onDemo={browseDemo}
      />
    </div>
  );
}
