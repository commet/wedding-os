import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import type { WeddingData } from "../lib/schema";
import { defaultData } from "../lib/schema";
import { markOwner } from "../lib/security";
import { defaultChecklist } from "../data/checklistTemplate";
import { demoData } from "../data/demoData";

type Props = {
  data: WeddingData;
  update: (patch: any) => void;
};

const FEATURES = [
  { num: "01", title: "모바일 청첩장", desc: "한·영·중 3개 언어, 카톡 공유까지" },
  { num: "02", title: "결혼반지 비교", desc: "25개 브랜드 카탈로그, 둘이 ★·♥ 표시" },
  { num: "03", title: "체크리스트 & D-day", desc: "뭘 언제까지 해야 하는지 한눈에" },
  { num: "04", title: "호텔·항공·신혼여행", desc: "가격 비교부터 일정까지 한 곳에" },
  { num: "05", title: "식전영상", desc: "5막 구조 + AI로 자연어 편집" },
];

const MODES = [
  {
    id: "local",
    title: "내 휴대폰에 저장",
    oneLiner: "가입 없이 바로 시작",
    difficulty: "가장 쉬움",
    highlight: true,
  },
  {
    id: "supabase",
    title: "우리만의 결혼식 사이트",
    oneLiner: "청첩장 링크 공유 · 함께 편집 · 하객 RSVP (베타)",
    difficulty: "15분 셋업",
    highlight: false,
  },
  {
    id: "devOnly",
    title: "코드 받아 직접 고치기",
    oneLiner: "디자인·기능 완전 자유 · 개발자용",
    difficulty: "개발 지식 필요",
    highlight: false,
  },
] as const;

export default function Welcome({ data, update }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<"landing" | "modeSelect">("landing");
  const [showCompare, setShowCompare] = useState(false);

  // goModeSelect 는 1회용 — 한 번 적용한 뒤 history state 에서 제거.
  // 안 그러면 뒤로가기로 이 entry 에 다시 돌아왔을 때 또 modeSelect 로 튐(랜딩 화면이 사라져 보이는 원인).
  useEffect(() => {
    if ((location.state as any)?.goModeSelect) {
      setStep("modeSelect");
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

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
        data.checklist.length
      );
      if (!hasContent) update(() => demoData());
    }
    navigate("/dashboard");
  };

  const startMine = () => setStep("modeSelect");

  const backToLanding = () => {
    setStep("landing");
    // URL state 의 goModeSelect 를 비워서, 이 화면에서 다른 곳으로 갔다 뒤로가기로 돌아와도 modeSelect 로 안 튀게.
    navigate("/", { replace: true, state: null });
  };

  const selectMode = (id: typeof MODES[number]["id"]) => {
    if (id === "devOnly") {
      window.open("https://github.com/commet/wedding-os", "_blank", "noopener,noreferrer");
      return;
    }
    update((prev: WeddingData) => {
      if (prev.preferences.isDemo) {
        const base = defaultData();
        return {
          ...base,
          checklist: defaultChecklist(),
          preferences: {
            ...base.preferences,
            mode: id === "local" ? "local" : null,
            isDemo: false,
          },
        };
      }
      return {
        ...prev,
        preferences: {
          ...prev.preferences,
          mode: id === "local" ? "local" : null,
          isDemo: false,
        },
      };
    });

    if (id === "local") markOwner();
    navigate(id === "local" ? "/dashboard" : "/setup");
  };

  /* ──────── 모드 선택 단계 ──────── */
  if (step === "modeSelect") {
    return (
      <div className="page max-w-app mx-auto pt-10 pb-16">
        <button onClick={backToLanding} className="eyebrow mb-12 inline-flex items-center gap-2">
          <span>←</span> 돌아가기
        </button>

        <div className="mb-12">
          <div className="eyebrow-gold mb-4">01 · 시작 방식</div>
          <h1 className="display-sm mb-3">
            어떻게 시작할까요?
          </h1>
          <p className="text-soft text-[13px] leading-relaxed">
            나중에 [더보기]에서 언제든 바꿀 수 있어요.
          </p>
        </div>

        <ul className="stack border-t border-hair border-b">
          {MODES.map((m, idx) => (
            <li key={m.id}>
              <button
                onClick={() => selectMode(m.id)}
                className="w-full text-left flex items-start gap-5 active:opacity-60 transition"
              >
                <div className="font-serif text-soft text-lg tabular-nums pt-0.5 w-6 flex-shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <h2 className="font-serif text-lg text-ink">{m.title}</h2>
                    {m.highlight && <span className="eyebrow-gold">추천</span>}
                  </div>
                  <p className="text-[13px] text-soft leading-relaxed mb-2">{m.oneLiner}</p>
                  <span className="eyebrow">{m.difficulty}</span>
                </div>
                <span className="text-soft pt-1 flex-shrink-0">→</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <button
            onClick={() => setShowCompare((v) => !v)}
            className="eyebrow flex items-center gap-2"
          >
            셋을 자세히 비교 {showCompare ? "−" : "+"}
          </button>
          {showCompare && (
            <div className="mt-5 pt-5 border-t border-hair">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-soft">
                    <th className="text-left py-2 font-normal eyebrow"></th>
                    <th className="text-center py-2 font-normal eyebrow">휴대폰</th>
                    <th className="text-center py-2 font-normal eyebrow">사이트</th>
                    <th className="text-center py-2 font-normal eyebrow">코드</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hair">
                  <tr><td className="py-3 text-soft">가입 필요</td><td className="text-center">·</td><td className="text-center">2곳</td><td className="text-center">GitHub</td></tr>
                  <tr><td className="py-3 text-soft">청첩장 공유</td><td className="text-center">·</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                  <tr><td className="py-3 text-soft">함께 편집</td><td className="text-center">·</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                  <tr><td className="py-3 text-soft">하객 RSVP</td><td className="text-center">·</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                  <tr><td className="py-3 text-soft">비용</td><td className="text-center">무료</td><td className="text-center">무료</td><td className="text-center">무료</td></tr>
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
    <div className="max-w-app mx-auto bg-paper min-h-screen">
      {/* 1. 히어로 — 큰 세리프, hairline */}
      <section className="page pt-20 pb-16">
        <div className="eyebrow-gold mb-6">Wedding · OS</div>
        <h1 className="font-serif text-[2.5rem] leading-[1.08] tracking-tight text-ink mb-6">
          결혼 준비,<br />
          우리 둘이서<br />
          <span className="italic font-light text-gold">충분해요.</span>
        </h1>
        <p className="text-[13.5px] text-soft leading-[1.7] max-w-[20rem]">
          청첩장 · 식전영상 · 체크리스트.<br />
          한 곳에서, 우리 식대로.
        </p>
      </section>

      {/* 2. 메인 CTA — 박스 없이 sharp 한 두 버튼 */}
      <section className="page pb-20">
        <button
          onClick={browseDemo}
          className="btn-primary w-full py-4 text-[13px]"
        >
          먼저 예시로 둘러보기 →
        </button>
        <div className="mt-4 text-center">
          <button onClick={startMine} className="text-[13px] text-soft underline underline-offset-4 hover:text-ink transition">
            아니면 바로 내 결혼식 시작
          </button>
        </div>
      </section>

      <div className="hairline" />

      {/* 3. What's inside — 번호 매겨진 hairline 리스트 */}
      <section className="page py-16">
        <div className="eyebrow-gold mb-8">What's inside</div>
        <ul className="stack">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-baseline gap-5">
              <span className="font-serif text-soft text-base tabular-nums w-6 flex-shrink-0">
                {f.num}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-serif text-base text-ink mb-1">{f.title}</div>
                <div className="text-[12.5px] text-soft leading-relaxed">{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="hairline" />

      {/* 4. 하단 반복 CTA — 가벼운 마무리 */}
      <section className="page py-14 text-center">
        <p className="font-serif text-xl text-ink leading-snug mb-6">
          시작은 30초면 충분합니다.
        </p>
        <button onClick={browseDemo} className="btn-primary px-10 py-4 text-[13px]">
          예시로 둘러보기 →
        </button>
      </section>

      {/* 5. 푸터 — 미니멀하게 */}
      <footer className="page py-10 border-t border-hair text-center">
        <p className="text-[11px] text-soft leading-relaxed">
          개인적으로 만든 도구라 오류가 있을 수 있어요.
        </p>
        <p className="text-[11px] text-soft mt-2">
          문의는{" "}
          <a href="mailto:yclee913@gmail.com" rel="noopener noreferrer" className="underline underline-offset-2 text-ink">
            yclee913@gmail.com
          </a>
        </p>
        <p className="text-[11px] text-soft mt-4">
          <a href="/privacy" className="underline underline-offset-2">개인정보 · 보안 안내</a>
        </p>
      </footer>
    </div>
  );
}
