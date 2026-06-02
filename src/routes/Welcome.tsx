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
  { num: "01", title: "모바일 청첩장", desc: "한·영·중 3개 언어, 카톡 공유까지" },
  { num: "02", title: "결혼반지 비교", desc: "25개 브랜드 카탈로그, 둘이 ★·♥ 표시" },
  { num: "03", title: "체크리스트 & D-day", desc: "뭘 언제까지 해야 하는지 한눈에" },
  { num: "04", title: "호텔·항공·신혼여행", desc: "가격 비교부터 일정까지 한 곳에" },
  { num: "05", title: "식전영상", desc: "5막 구조 + AI로 자연어 편집" },
];

// 프라이버시 ↔ 편의 스펙트럼. 간편(hosted)이 기본 추천.
const MODES = [
  {
    id: "hosted",
    title: "간편 — 쉽게, 함께",
    oneLiner: "부부가 링크로 함께 편집 · 하객 RSVP · 운영자도 내용 못 봄(암호화)",
    difficulty: "가입 없음 · 추천",
    highlight: true,
  },
  {
    id: "local",
    title: "이 기기만",
    oneLiner: "아무 데도 안 올라가요 — 이 휴대폰에만",
    difficulty: "오프라인",
    highlight: false,
  },
  {
    id: "supabase",
    title: "독립 — 내 서버",
    oneLiner: "운영자를 아예 안 거침 · 내 Supabase 에 직접",
    difficulty: "기술 필요",
    highlight: false,
  },
  {
    id: "devOnly",
    title: "개발자 모드",
    oneLiner: "코드 받아 디자인·기능까지 수정",
    difficulty: "GitHub",
    highlight: false,
  },
] as const;

export default function Welcome({ data, update }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<"landing" | "modeSelect">("landing");
  const [showCompare, setShowCompare] = useState(false);

  // 데모 배너 '내 결혼식 시작' 등에서 goModeSelect 로 들어오면 — 선택지 없이 바로 로컬 시작.
  // (모드 선택은 '고급' 으로만 접근. 대부분은 그냥 시작하면 됨.)
  useEffect(() => {
    if ((location.state as any)?.goModeSelect) {
      navigate(location.pathname, { replace: true, state: null });
      selectMode("local");
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

  // 기본 시작 = 로컬, 즉시. 시트 열듯 바로 쓰기 시작. (함께 편집·발행 등은 앱 안에서 그때 등장.)
  const startLocal = () => selectMode("local");

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

        <div className="mb-12">
          <div className="eyebrow-gold mb-4">고급 · 저장·공유 방식</div>
          <h1 className="display-sm mb-3">
            어디에 저장할까요?
          </h1>
          <p className="text-soft text-[13px] leading-relaxed">
            대부분은 그냥 <b className="text-ink">바로 시작하기</b>면 충분해요. 여기선 저장 위치를 직접 고를 수 있어요.
          </p>
          <Link to="/trust" className="inline-block mt-4 text-[12px] text-ink underline underline-offset-4 hover:text-gold transition">
            🔒 어디에 저장하든 운영자는 내용을 못 읽어요 — 직접 확인 →
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
                  <tr><td className="py-3 text-soft">가입 필요</td><td className="text-center">없음</td><td className="text-center">2곳</td><td className="text-center">GitHub</td></tr>
                  <tr><td className="py-3 text-soft">청첩장 공유</td><td className="text-center">텍스트</td><td className="text-center">링크</td><td className="text-center">자유</td></tr>
                  <tr><td className="py-3 text-soft">함께 편집</td><td className="text-center">한 기기</td><td className="text-center">가능</td><td className="text-center">가능</td></tr>
                  <tr><td className="py-3 text-soft">하객 RSVP</td><td className="text-center">불가</td><td className="text-center">가능</td><td className="text-center">가능</td></tr>
                  <tr><td className="py-3 text-soft">배포 필요</td><td className="text-center">없음</td><td className="text-center">필요</td><td className="text-center">직접</td></tr>
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

      {/* 2. 메인 CTA — 바로 시작이 1순위, 데모는 보조 */}
      <section className="page pb-8">
        <button
          onClick={startLocal}
          className="btn-primary w-full py-4 text-[13px]"
        >
          바로 시작하기 →
        </button>
        <div className="mt-4 text-center">
          <button onClick={browseDemo} className="text-[13px] text-soft underline underline-offset-4 hover:text-ink transition">
            예시 먼저 보기
          </button>
        </div>
        <p className="mt-5 text-center text-[11.5px] text-soft leading-relaxed">
          가입·설치 없이 바로. 입력한 내용은 이 기기에 저장돼요.
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
          시작은 30초면 충분합니다.
        </p>
        <button onClick={startLocal} className="btn-primary px-10 py-4 text-[13px]">
          바로 시작하기 →
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
