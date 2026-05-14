import { useState } from "react";
import { useLocation } from "react-router-dom";
import type { WeddingData } from "../lib/schema";

type Props = { data: WeddingData; };

const CATEGORIES = [
  "버그 / 오류",
  "기능 요청",
  "셋업이 어려워요",
  "기타 문의",
] as const;

export default function Contact({ data }: Props) {
  const [category, setCategory] = useState<typeof CATEGORIES[number]>(CATEGORIES[0]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [sent, setSent] = useState(false);
  const location = useLocation();

  const compose = () => {
    const context = includeContext
      ? `\n\n---\n[자동 첨부]\n모드: ${data.preferences.mode ?? "(미선택)"}\n페이지: ${location.pathname}\n시간: ${new Date().toISOString()}\nUA: ${navigator.userAgent.slice(0, 80)}`
      : "";
    const subject = `[Wedding OS] ${category}`;
    const fullBody = `${name ? `안녕하세요, ${name}입니다.\n\n` : ""}${body}${context}`;
    return {
      subject,
      body: fullBody,
      mailto: `mailto:yclee913@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`,
    };
  };

  const send = () => {
    const { mailto, subject, body: fullBody } = compose();
    window.location.href = mailto;
    setTimeout(() => {
      setSent(true);
      // mailto: 가 안 열린 환경 대비
    }, 1000);
  };

  const copyAll = async () => {
    const { subject, body: fullBody } = compose();
    const text = `받는 사람: yclee913@gmail.com\n제목: ${subject}\n\n${fullBody}`;
    try { await navigator.clipboard.writeText(text); alert("내용이 복사됐어요. 메일에 붙여넣어 보내주세요."); }
    catch { alert("복사 실패. 아래 내용을 직접 복사해주세요."); }
  };

  return (
    <div className="px-5 py-6 space-y-4">
      <h1 className="font-serif text-2xl">문의 / 오류 신고</h1>

      <div className="card bg-cream/50">
        <p className="text-sm text-soft leading-relaxed">
          개인적으로 만든 도구라 오류가 있을 수 있어요. 편하게 알려주시면 가능한 한 빨리 살펴볼게요.
          하루 24시간 답변은 못 드릴 수 있지만, 며칠 안에는 꼭 답장드립니다.
        </p>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label">분류</label>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as any)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">성함 (선택)</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="익명도 괜찮아요" />
        </div>
        <div>
          <label className="label">내용</label>
          <textarea
            className="input min-h-[160px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="어떤 화면에서 무슨 일이 있었는지 짧게라도 적어주세요. 캡처 사진은 메일에 첨부 가능해요."
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeContext}
            onChange={(e) => setIncludeContext(e.target.checked)}
          />
          현재 모드/페이지 정보 자동 첨부 (디버깅에 도움)
        </label>

        <button onClick={send} className="btn-primary w-full" disabled={!body.trim()}>
          ✉️ 메일 앱으로 보내기
        </button>
        <button onClick={copyAll} className="btn-secondary w-full" disabled={!body.trim()}>
          📋 내용 복사 (메일 앱이 안 열릴 때)
        </button>
        {sent && (
          <p className="text-xs text-soft text-center">
            메일 앱이 안 열렸나요? 위 [내용 복사] 버튼으로 복사해서{" "}
            <a className="underline" href="mailto:yclee913@gmail.com">yclee913@gmail.com</a> 으로 보내주세요.
          </p>
        )}
      </div>

      <p className="text-center text-xs text-soft">
        직접 메일: <a className="underline" href="mailto:yclee913@gmail.com">yclee913@gmail.com</a>
      </p>
    </div>
  );
}
