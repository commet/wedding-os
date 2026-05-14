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
    subtitle: "가장 쉽고 빠른 시작",
    pros: [
      "가입·로그인 없이 바로 시작",
      "내 정보는 내 기기에만 저장 (안전)",
    ],
    cons: [
      "청첩장 링크로 공유 불가",
      "신랑·신부가 따로 편집 불가",
    ],
    recommend: "혼자 둘러보면서 어떤 건지 보고 싶을 때",
    cta: "이걸로 시작",
    accent: "bg-sage/10 border-sage/30",
  },
  {
    id: "supabase",
    icon: "🌐",
    title: "우리만의 결혼식 웹사이트 만들기",
    subtitle: "진짜 청첩장처럼 카톡으로 보낼 수 있어요",
    pros: [
      "청첩장 링크 (내가 정한 주소)",
      "신랑·신부가 같이 편집",
      "하객 RSVP(참석 여부) 받기",
    ],
    cons: [
      "무료 서비스 두 곳 가입 필요 (Vercel + Supabase)",
      "약 15분 따라하기 가이드 제공",
    ],
    recommend: "진짜 결혼식에 쓸 결심이 섰을 때",
    cta: "가이드 보고 시작",
    accent: "bg-gold/10 border-gold/30",
  },
  {
    id: "devOnly",
    icon: "💻",
    title: "코드 받아서 마음대로 고치기",
    subtitle: "디자인·기능·색깔까지 전부 내 식대로",
    pros: [
      "모든 코드를 GitHub에서 받음",
      "Claude·ChatGPT에게 시켜 손볼 수 있음",
    ],
    cons: [
      "코딩이나 GitHub 사용 경험 추천",
    ],
    recommend: "개발자거나 \"AI에게 시켜본 적 있다\" 하시는 분",
    cta: "GitHub에서 받기",
    accent: "bg-taupe/10 border-taupe/30",
  },
] as const;

export default function Welcome({ data, update }: Props) {
  const navigate = useNavigate();
  const [showCompare, setShowCompare] = useState(false);

  const select = (id: typeof MODES[number]["id"]) => {
    if (id === "devOnly") {
      window.open("https://github.com/commet/wedding-os", "_blank");
      return;
    }
    if (id === "local") {
      update((prev: WeddingData) => ({
        ...prev,
        preferences: { ...prev.preferences, mode: "local" },
      }));
      navigate("/dashboard");
      return;
    }
    if (id === "supabase") {
      update((prev: WeddingData) => ({
        ...prev,
        preferences: { ...prev.preferences, mode: "supabase" },
      }));
      navigate("/setup");
      return;
    }
  };

  return (
    <div className="px-5 py-8">
      <div className="text-center mb-8">
        <h1 className="font-serif text-3xl mb-2">Wedding OS</h1>
        <p className="text-soft text-sm">
          결혼 준비를 한 곳에서.<br />
          청첩장 · 식전영상 · 체크리스트까지.
        </p>
      </div>

      <p className="text-sm text-soft mb-4 text-center">
        저장 방식을 선택해주세요. 나중에 바꿀 수도 있어요.
      </p>

      <div className="space-y-4">
        {MODES.map((m) => (
          <div key={m.id} className={`card ${m.accent}`}>
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl">{m.icon}</span>
              <div className="flex-1">
                <h2 className="font-medium text-base">{m.title}</h2>
                <p className="text-sm text-soft mt-1">{m.subtitle}</p>
              </div>
            </div>

            <ul className="text-sm space-y-1 mb-3">
              {m.pros.map((p, i) => (
                <li key={i} className="text-ink">✓ {p}</li>
              ))}
              {m.cons.map((c, i) => (
                <li key={i} className="text-soft">· {c}</li>
              ))}
            </ul>

            <p className="text-xs text-soft mb-4 italic">
              추천: {m.recommend}
            </p>

            <button
              className="btn-primary w-full"
              onClick={() => select(m.id)}
            >
              {m.cta}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          onClick={() => setShowCompare((v) => !v)}
          className="btn-ghost w-full text-center"
        >
          {showCompare ? "비교표 접기 ▲" : "한 눈에 비교하기 ▼"}
        </button>

        {showCompare && (
          <div className="mt-3 card text-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-2 font-medium"></th>
                  <th className="text-center py-2 font-medium">📱 휴대폰</th>
                  <th className="text-center py-2 font-medium">🌐 내 사이트</th>
                  <th className="text-center py-2 font-medium">💻 코드</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr><td className="py-2 text-soft">가입 필요?</td><td className="text-center">✗</td><td className="text-center">2곳 무료</td><td className="text-center">GitHub</td></tr>
                <tr><td className="py-2 text-soft">청첩장 공유</td><td className="text-center">✗</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                <tr><td className="py-2 text-soft">함께 편집</td><td className="text-center">✗</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                <tr><td className="py-2 text-soft">하객 RSVP</td><td className="text-center">✗</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                <tr><td className="py-2 text-soft">디자인 변경</td><td className="text-center">한정</td><td className="text-center">한정</td><td className="text-center">자유</td></tr>
                <tr><td className="py-2 text-soft">비용</td><td className="text-center">무료</td><td className="text-center">무료</td><td className="text-center">무료</td></tr>
                <tr><td className="py-2 text-soft">어려움</td><td className="text-center">🟢</td><td className="text-center">🟡</td><td className="text-center">🔴</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-soft">
        개인적으로 만든 도구라 오류가 있을 수 있어요.<br />
        문제나 제안은 <a href="mailto:yclee913@gmail.com" className="underline">yclee913@gmail.com</a> 으로 편하게 알려주세요.
      </p>
    </div>
  );
}
