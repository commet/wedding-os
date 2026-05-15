import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import type { WeddingData } from "../lib/schema";
import { defaultData } from "../lib/schema";
import { defaultChecklist } from "../data/checklistTemplate";

type Props = {
  data: WeddingData;
  update: (patch: any) => void;
};

const FEATURES = [
  { icon: "💌", title: "모바일 청첩장", desc: "한·영·중 3개 언어, 카톡 공유까지" },
  { icon: "💍", title: "결혼반지 비교", desc: "25개 브랜드 카탈로그, 둘이 ★·♥ 표시" },
  { icon: "✅", title: "체크리스트 & D-day", desc: "뭘 언제까지 해야 하는지 한눈에" },
  { icon: "🏨", title: "호텔·항공·신혼여행", desc: "가격 비교부터 일정까지 한 곳에" },
  { icon: "🎥", title: "식전영상", desc: "5막 구조 + AI로 자연어 편집" },
];

const MODES = [
  {
    id: "local",
    icon: "📱",
    title: "내 휴대폰에 저장",
    oneLiner: "가입 없이 바로 시작",
    cta: "이걸로 시작",
    accent: "border-gold bg-gold/5",
    difficulty: "가장 쉬움",
    highlight: true,
  },
  {
    id: "supabase",
    icon: "🌐",
    title: "우리만의 결혼식 사이트",
    oneLiner: "청첩장 링크 공유 · 함께 편집 · 하객 RSVP",
    cta: "가이드 따라 시작",
    accent: "border-line",
    difficulty: "15분 셋업",
    highlight: false,
  },
  {
    id: "devOnly",
    icon: "💻",
    title: "코드 받아 직접 고치기",
    oneLiner: "디자인·기능 완전 자유 · 개발자용",
    cta: "GitHub에서 받기",
    accent: "border-line",
    difficulty: "개발 지식 필요",
    highlight: false,
  },
] as const;

export default function Welcome({ update }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<"landing" | "modeSelect">("landing");
  const [showCompare, setShowCompare] = useState(false);

  // 데모 배너의 "내 결혼식 시작하기"에서 넘어오면 바로 모드 선택으로
  useEffect(() => {
    if ((location.state as any)?.goModeSelect) setStep("modeSelect");
  }, [location.state]);

  const browseDemo = () => navigate("/dashboard");

  const startMine = () => setStep("modeSelect");

  const selectMode = (id: typeof MODES[number]["id"]) => {
    if (id === "devOnly") {
      window.open("https://github.com/commet/wedding-os", "_blank");
      return;
    }

    update((prev: WeddingData) => {
      // 데모 상태였으면 데이터 정리하되 "구조"(체크리스트 타임라인)는 자동 seed → 빈 화면 회피.
      // 이미 사용자 데이터가 있는 상태(Settings에서 모드 변경)는 데이터 유지.
      if (prev.preferences.isDemo) {
        const base = defaultData();
        return {
          ...base,
          // 결혼식 날짜 없어도 ddayOffset만 박혀있는 표준 타임라인 seed
          checklist: defaultChecklist(),
          preferences: {
            ...base.preferences,
            mode: id === "local" ? "local" : null,
            isDemo: false,
          },
        };
      }
      // 모드만 바꾸기 — 데이터 유지
      return {
        ...prev,
        preferences: {
          ...prev.preferences,
          mode: id === "local" ? "local" : null,
          isDemo: false,
        },
      };
    });

    navigate(id === "local" ? "/dashboard" : "/setup");
  };

  if (step === "modeSelect") {
    return (
      <div className="px-5 py-10 max-w-app mx-auto">
        <button onClick={() => setStep("landing")} className="text-sm text-soft mb-6">← 돌아가기</button>
        <h1 className="font-serif text-2xl mb-2">어떻게 시작할까요?</h1>
        <p className="text-sm text-soft mb-6">나중에 [더보기]에서 언제든 바꿀 수 있어요.</p>

        <div className="space-y-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => selectMode(m.id)}
              className={`card w-full text-left border-2 ${m.accent} active:opacity-90 transition`}
            >
              {m.highlight && (
                <div className="text-[11px] font-medium text-gold mb-2">👍 처음이라면 이걸로</div>
              )}
              <div className="flex items-center gap-3">
                <span className="text-3xl">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-base">{m.title}</h2>
                    <span className="text-[10px] text-soft border border-line rounded-full px-1.5 py-0.5 flex-shrink-0">
                      {m.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-soft mt-1">{m.oneLiner}</p>
                </div>
                <span className={`text-sm flex-shrink-0 ${m.highlight ? "text-gold font-medium" : "text-soft"}`}>→</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5">
          <button onClick={() => setShowCompare((v) => !v)} className="btn-ghost w-full text-sm">
            {showCompare ? "비교표 접기 ▲" : "셋을 자세히 비교하기 ▼"}
          </button>
          {showCompare && (
            <div className="mt-3 card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-soft">
                    <th className="text-left py-2 font-normal"></th>
                    <th className="text-center py-2 font-normal">📱</th>
                    <th className="text-center py-2 font-normal">🌐</th>
                    <th className="text-center py-2 font-normal">💻</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr><td className="py-2 text-soft">가입 필요</td><td className="text-center">✗</td><td className="text-center">2곳</td><td className="text-center">GitHub</td></tr>
                  <tr><td className="py-2 text-soft">청첩장 공유</td><td className="text-center">✗</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                  <tr><td className="py-2 text-soft">함께 편집</td><td className="text-center">✗</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                  <tr><td className="py-2 text-soft">하객 RSVP</td><td className="text-center">✗</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                  <tr><td className="py-2 text-soft">비용</td><td className="text-center">무료</td><td className="text-center">무료</td><td className="text-center">무료</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 감성 랜딩 ───
  return (
    <div className="max-w-app mx-auto bg-gradient-to-b from-cream via-white to-cream/50 min-h-screen">
      {/* 히어로 */}
      <div className="px-6 pt-20 pb-14 text-center relative">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-5xl mb-5 opacity-90">🤍</div>
          <div className="text-xs text-gold tracking-[0.3em] uppercase mb-3">Wedding OS</div>
          <h1 className="font-serif text-[2rem] leading-tight mb-4 text-ink">
            결혼 준비,<br />
            <span className="text-gold">우리 둘이서</span> 충분해요
          </h1>
          <p className="text-soft text-sm leading-relaxed">
            청첩장 · 식전영상 · 체크리스트까지<br />
            한 곳에서 함께 만들어요.
          </p>
        </div>
      </div>

      {/* 메인 CTA */}
      <div className="px-6 space-y-3">
        <button
          onClick={browseDemo}
          className="btn-primary w-full text-base py-4 shadow-lg shadow-gold/20"
        >
          ✨ 먼저 예시로 둘러보기
        </button>
        <p className="text-center text-xs text-soft">
          가상 커플의 완성된 결혼식을 미리 구경할 수 있어요
        </p>
        <button onClick={startMine} className="btn-secondary w-full">
          내 결혼식 바로 시작하기 →
        </button>
      </div>

      {/* 기능 미리보기 */}
      <div className="px-6 py-14">
        <p className="text-center text-xs text-gold mb-6 tracking-[0.2em] uppercase">What's inside</p>
        <div className="space-y-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card flex items-center gap-4 bg-white/80 backdrop-blur border border-line/60 hover:border-gold/40 transition"
            >
              <span className="text-3xl">{f.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-sm">{f.title}</div>
                <div className="text-xs text-soft mt-0.5 leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 반복 CTA */}
      <div className="px-6 pb-10">
        <button onClick={browseDemo} className="btn-primary w-full py-4 shadow-lg shadow-gold/20">
          ✨ 먼저 예시로 둘러보기
        </button>
      </div>

      <div className="px-6 pb-14 text-center text-xs text-soft leading-relaxed border-t border-line/50 pt-8 mt-4">
        <p>개인적으로 만든 도구라 오류가 있을 수 있어요.</p>
        <p className="mt-1">
          문제·제안은{" "}
          <a href="mailto:yclee913@gmail.com" className="underline text-gold">yclee913@gmail.com</a>
          {" "}으로 편하게.
        </p>
      </div>
    </div>
  );
}
