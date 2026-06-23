import { useState } from "react";
import { useLocation } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { koBreak } from "../lib/typography";

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
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-2">도움 요청</div>
        <h1 className="font-serif text-[2rem] leading-none">{koBreak("문의 · 오류 신고")}</h1>
      </div>

      <p className="text-[13px] text-soft leading-relaxed border-b border-hair pb-6">
        화면 이름, 눌렀던 버튼, 기대했던 결과를 적어주시면 빠르게 확인할 수 있어요.
        캡처가 있으면 메일 앱에서 함께 첨부해주세요.
      </p>

      <div className="space-y-5">
        <div>
          <label className="label">분류</label>
          <select aria-label="문의 분류" className="input-boxed text-[13px]" value={category} onChange={(e) => setCategory(e.target.value as any)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">성함 (선택)</label>
          <input aria-label="성함 (선택)" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="익명도 괜찮아요" />
        </div>
        <div>
          <label className="label">내용</label>
          <textarea
            aria-label="문의 내용"
            className="input-boxed min-h-[160px] text-[13px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="어떤 화면에서 무슨 일이 있었는지 짧게라도 적어주세요. 캡처 사진은 메일에 첨부 가능해요."
          />
        </div>

        <label className="flex items-center gap-2 text-[12.5px] text-soft">
          <input
            type="checkbox"
            checked={includeContext}
            onChange={(e) => setIncludeContext(e.target.checked)}
            className="accent-ink"
          />
          현재 모드 / 페이지 정보 자동 첨부 (디버깅에 도움)
        </label>

        <div className="pt-2 space-y-3">
          <button onClick={send} className="btn-primary w-full py-3.5 text-[12.5px]" disabled={!body.trim()}>
            메일 앱으로 보내기 →
          </button>
          <button onClick={copyAll} className="block w-full text-center text-[12px] underline underline-offset-4 text-soft hover:text-ink disabled:opacity-40" disabled={!body.trim()}>
            내용 복사 (메일 앱이 안 열릴 때)
          </button>
        </div>
        {sent && (
          <p className="text-[11.5px] text-soft text-center leading-relaxed">
            메일 앱이 안 열렸나요? 위 [내용 복사] 버튼으로 복사해서{" "}
            <a className="underline underline-offset-2 text-ink" href="mailto:yclee913@gmail.com">yclee913@gmail.com</a> 으로 보내주세요.
          </p>
        )}
      </div>

      <p className="text-center text-[11px] text-soft pt-6 border-t border-hair">
        직접 메일 · <a className="underline underline-offset-2 text-ink" href="mailto:yclee913@gmail.com">yclee913@gmail.com</a>
      </p>
    </div>
  );
}
