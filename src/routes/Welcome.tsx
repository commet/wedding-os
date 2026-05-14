import { useNavigate } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { useState } from "react";

type Props = {
  data: WeddingData;
  update: (patch: any) => void;
};

const MODES = [
  {
    id: "local",
    icon: "📱",
    title: "내 휴대폰에 저장",
    oneLiner: "가입 없이 바로 시작 · 혼자 둘러보기 좋음",
    cta: "바로 시작",
    accent: "border-sage/40",
    difficulty: "쉬움",
  },
  {
    id: "supabase",
    icon: "🌐",
    title: "우리만의 결혼식 사이트",
    oneLiner: "청첩장 링크 공유 · 함께 편집 · 15분 셋업",
    cta: "가이드 따라 시작",
    accent: "border-gold/50",
    difficulty: "보통",
  },
  {
    id: "devOnly",
    icon: "💻",
    title: "코드 받아 직접 고치기",
    oneLiner: "디자인·기능 완전 자유 · 개발자/AI 활용자용",
    cta: "GitHub에서 받기",
    accent: "border-taupe/40",
    difficulty: "어려움",
  },
] as const;

export default function Welcome({ update }: Props) {
  const navigate = useNavigate();
  const [showCompare, setShowCompare] = useState(false);

  const select = (id: typeof MODES[number]["id"]) => {
    if (id === "devOnly") {
      window.open("https://github.com/commet/wedding-os", "_blank");
      return;
    }
    update((prev: WeddingData) => ({
      ...prev,
      preferences: { ...prev.preferences, mode: id },
    }));
    navigate(id === "local" ? "/dashboard" : "/setup");
  };

  return (
    <div className="px-5 py-10">
      <div className="text-center mb-10">
        <h1 className="font-serif text-3xl mb-3">Wedding OS</h1>
        <p className="text-soft text-sm leading-relaxed">
          결혼 준비를 한 곳에서.
        </p>
      </div>

      <p className="text-xs text-soft mb-3 text-center">
        시작 방법을 골라주세요 · 나중에 바꿀 수 있어요
      </p>

      <div className="space-y-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => select(m.id)}
            className={`card w-full text-left border-2 ${m.accent} active:bg-cream transition`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{m.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-base">{m.title}</h2>
                  <span className="text-[10px] text-soft border border-line rounded-full px-1.5 py-0.5 flex-shrink-0">
                    {m.difficulty}
                  </span>
                </div>
                <p className="text-xs text-soft mt-1 leading-relaxed">{m.oneLiner}</p>
              </div>
              <span className="text-gold text-sm flex-shrink-0">{m.cta} →</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5">
        <button
          onClick={() => setShowCompare((v) => !v)}
          className="btn-ghost w-full text-center text-sm"
        >
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
                <tr><td className="py-2 text-soft">디자인 변경</td><td className="text-center">한정</td><td className="text-center">한정</td><td className="text-center">자유</td></tr>
                <tr><td className="py-2 text-soft">비용</td><td className="text-center">무료</td><td className="text-center">무료</td><td className="text-center">무료</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-soft leading-relaxed">
        개인적으로 만든 도구라 오류가 있을 수 있어요.<br />
        문제나 제안은{" "}
        <a href="mailto:yclee913@gmail.com" className="underline">
          yclee913@gmail.com
        </a>
        <br />
        으로 편하게 알려주세요.
      </p>
    </div>
  );
}
