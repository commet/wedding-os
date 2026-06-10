import { useNavigate, useLocation, Link } from "react-router-dom";
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
  { num: "01", title: "오늘 할 일", desc: "지금 필요한 일만 먼저 보여주고, 나머지는 접어둡니다" },
  { num: "02", title: "후보 풀", desc: "반지·여행·예식장처럼 막막한 선택지를 비교 가능한 형태로 시작합니다" },
  { num: "03", title: "청첩장", desc: "기본 정보와 문안을 다듬고, 하객에게 보낼 링크까지 이어집니다" },
  { num: "04", title: "비용과 하객", desc: "예산·식수·응답을 한 데이터 위에서 조용히 관리합니다" },
  { num: "05", title: "공유와 백업", desc: "혼자 시작한 기록도 나중에 같이 쓰는 방식으로 옮길 수 있습니다" },
];

// 프라이버시 ↔ 편의 스펙트럼. 간편(hosted)이 기본 추천.
const MODES = [
  {
    id: "hosted",
    title: "링크로 같이 시작",
    oneLiner: "별도 셋업 없이 복구 링크와 편집 링크를 만들고, 청첩장 RSVP까지 받을 수 있어요.",
    difficulty: "가장 쉬움 · 추천",
    highlight: true,
  },
  {
    id: "local",
    title: "혼자 이 기기에 저장",
    oneLiner: "가입 없이 바로 시작합니다. 나중에 필요하면 기록을 그대로 옮겨 같이 쓸 수 있어요.",
    difficulty: "30초 · 내 기기",
    highlight: false,
  },
  {
    id: "supabase",
    title: "내 Supabase로 운영",
    oneLiner: "내 Supabase 프로젝트를 연결해 둘이 같은 준비판을 보고 편집합니다.",
    difficulty: "독립 운영",
    highlight: false,
  },
  {
    id: "devOnly",
    title: "코드로 직접 운영",
    oneLiner: "코드를 받아 내 서버·디자인·기능까지 직접 바꾸는 개발자용 선택지입니다.",
    difficulty: "GitHub",
    highlight: false,
  },
] as const;

export default function Welcome({ data, update }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<"landing" | "modeSelect">("landing");
  const [showCompare, setShowCompare] = useState(false);

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
    // 간편(hosted)은 전용 시작 화면이 자격증명 생성·복구링크까지 처리한다.
    if (id === "hosted") {
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

  /* ──────── 모드 선택 단계 ──────── */
  if (step === "modeSelect") {
    return (
      <div className="page max-w-app mx-auto pt-10 pb-16">
        <button onClick={backToLanding} className="eyebrow mb-12 inline-flex items-center gap-2">
          <span>←</span> 돌아가기
        </button>

        <div className="mb-9">
          <div className="eyebrow-gold mb-4">01 · 저장 방식</div>
          <h1 className="display-sm mb-3">
            어떻게 이어서 쓸지<br />
            먼저 정해둘게요.
          </h1>
          <p className="text-soft text-[13px] leading-relaxed">
            혼자 정리해도 되고, 처음부터 링크로 같이 써도 됩니다.
            전환 전에는 백업을 만들고 사진까지 옮길 수 있는지 확인합니다.
          </p>
          <Link to="/trust" className="inline-block mt-4 text-[12px] text-ink underline underline-offset-4 hover:text-gold transition">
            저장 방식과 암호화 확인 →
          </Link>
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
            저장 방식을 자세히 비교 {showCompare ? "−" : "+"}
          </button>
          {showCompare && (
            <div className="mt-5 pt-5 border-t border-hair">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-soft">
                    <th className="text-left py-2 font-normal eyebrow"></th>
                    <th className="text-center py-2 font-normal eyebrow">내 기기</th>
                    <th className="text-center py-2 font-normal eyebrow">링크</th>
                    <th className="text-center py-2 font-normal eyebrow">Supabase</th>
                    <th className="text-center py-2 font-normal eyebrow">코드로</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hair">
                  <tr><td className="py-3 text-soft">가입</td><td className="text-center">없음</td><td className="text-center">없음</td><td className="text-center">필요</td><td className="text-center">GitHub</td></tr>
                  <tr><td className="py-3 text-soft">저장 위치</td><td className="text-center">이 기기</td><td className="text-center">암호화 저장</td><td className="text-center">내 DB</td><td className="text-center">내가 정함</td></tr>
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
    <div className="max-w-app mx-auto bg-paper min-h-screen">
      {/* 1. 히어로 — 큰 세리프, hairline */}
      <section className="page pt-20 pb-16">
        <div className="eyebrow-gold mb-6">Wedding · OS</div>
        <h1 className="font-serif text-[2.5rem] leading-[1.08] tracking-tight text-ink mb-6">
          결혼 준비가<br />
          조금 더<br />
          <span className="italic font-light text-gold">선명해지도록.</span>
        </h1>
        <p className="text-[13.5px] text-soft leading-[1.7] max-w-[20rem]">
          체크리스트, 후보 비교, 예산, 청첩장까지.<br />
          흩어진 준비를 차분한 흐름으로 모읍니다.
        </p>
      </section>

      {/* 2. 메인 CTA — 바로 시작이 1순위, 데모는 보조 */}
      <section className="page pb-8">
        <button
          onClick={startMine}
          className="btn-primary w-full py-4 text-[13px]"
        >
          내 결혼식 준비 시작
        </button>
        <div className="mt-4 text-center">
          <button onClick={browseDemo} className="text-[13px] text-soft underline underline-offset-4 hover:text-ink transition">
            예시 먼저 보기
          </button>
        </div>
        <p className="mt-5 text-center text-[11.5px] text-soft leading-relaxed">
          혼자 기록하고, 같이 편집하고, 하객에게 공유하는 흐름까지 이어집니다.
        </p>
      </section>

      <div className="hairline" />

      {/* 3. What's inside — 번호 매겨진 hairline 리스트 */}
      <section className="page pt-8 pb-14">
        <div className="eyebrow-gold mb-6">What's inside</div>
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
          처음부터 완벽하지 않아도 됩니다.
        </p>
        <button onClick={startMine} className="btn-primary px-10 py-4 text-[13px]">
          저장 방식 고르기 →
        </button>
        <div className="mt-5">
          <button onClick={() => setStep("modeSelect")} className="text-[12px] text-soft underline underline-offset-4 hover:text-ink transition">
            저장·공유 방식 직접 고르기 (고급)
          </button>
        </div>
      </section>

      {/* 5. 푸터 — 미니멀하게 */}
      <footer className="page py-10 border-t border-hair text-center">
        <p className="text-[11px] text-soft leading-relaxed">
          문의 · 정정 요청은 아래 메일로 보내주세요.
        </p>
        <p className="text-[11px] text-soft mt-2">
          문의는{" "}
          <a href="mailto:yclee913@gmail.com" rel="noopener noreferrer" className="underline underline-offset-2 text-ink">
            yclee913@gmail.com
          </a>
        </p>
        <p className="text-[11px] text-soft mt-4 space-x-3">
          <Link to="/trust" className="underline underline-offset-2">운영자도 못 봐요</Link>
          <span>·</span>
          <a href="/privacy" className="underline underline-offset-2">개인정보 · 보안 안내</a>
        </p>
      </footer>
    </div>
  );
}
