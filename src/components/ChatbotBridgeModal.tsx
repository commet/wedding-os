// 사용자가 본인 API 키 없이 AI 활용 — ChatGPT/Claude/Gemini 무료 버전에 복붙.
import { useState } from "react";
import Modal from "./Modal";
import { BridgePrompt, CHAT_LINKS, extractJSON } from "../lib/chatbotBridge";

type Props = {
  open: boolean;
  onClose: () => void;
  prompt: BridgePrompt | null;
  onApply?: (parsed: unknown) => void;
};

export default function ChatbotBridgeModal({ open, onClose, prompt, onApply }: Props) {
  const [reply, setReply] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  if (!prompt) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
    } catch {}
  };

  const apply = () => {
    if (!reply.trim()) return;
    if (prompt.expectedShape === "text") {
      onApply?.(reply.trim());
      onClose();
      return;
    }
    const parsed = extractJSON(reply);
    if (!parsed) {
      setParseError(
        "답변에서 JSON을 못 찾았어요.\n" +
        "→ 챗봇 답변에 { } 로 둘러싼 JSON 블록이 있는지 확인하세요.\n" +
        "→ 또는 답변을 보고 본인이 직접 카드에 정보를 입력해도 됩니다."
      );
      return;
    }
    setParseError(null);
    onApply?.(parsed);
    onClose();
  };

  const copyExpectedShape = async () => {
    if (!prompt.expectedShape || prompt.expectedShape === "text") return;
    const example = "위 프롬프트의 JSON 형식 부분만 그대로 답변해주세요.";
    try {
      await navigator.clipboard.writeText(example);
      alert("힌트가 복사됐어요. 챗봇에 이어서 보내주세요.");
    } catch {}
  };

  return (
    <Modal open={open} onClose={onClose} title={prompt.title}>
      <div className="space-y-5">
        <p className="text-[12.5px] text-soft leading-relaxed">
          API 키 없이 ChatGPT · Claude · Gemini 같은 챗봇에 아래 내용을 그대로 복사해서 붙여넣고, 답변을 받아오시면 돼요.
        </p>

        <div className="bg-cream p-4 border-l-2 border-hair">
          <pre className="text-[11px] whitespace-pre-wrap font-mono text-ink/80 leading-relaxed">{prompt.prompt}</pre>
        </div>

        <button className="text-[12px] underline underline-offset-4 text-ink hover:text-gold" onClick={copy}>
          프롬프트 복사 →
        </button>

        <div className="flex gap-5 flex-wrap pt-2 border-t border-hair">
          <a className="text-[12px] underline underline-offset-4 text-ink hover:text-gold" href={CHAT_LINKS.claude} target="_blank" rel="noopener noreferrer">Claude 열기 ↗</a>
          <a className="text-[12px] underline underline-offset-4 text-ink hover:text-gold" href={CHAT_LINKS.chatgpt} target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a>
          <a className="text-[12px] underline underline-offset-4 text-ink hover:text-gold" href={CHAT_LINKS.gemini} target="_blank" rel="noopener noreferrer">Gemini 열기 ↗</a>
        </div>

        <div className="pt-5 border-t border-hair">
          <label className="label">답변을 받아 여기에 붙여넣으세요</label>
          <textarea
            className="input-boxed min-h-[120px] text-[13px]"
            placeholder="챗봇이 준 답변을 그대로 복사해서 붙여넣기…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          {parseError && (
            <div className="mt-3 pl-4 border-l-2 border-gold/50 text-[12px] space-y-2">
              <p className="text-soft whitespace-pre-line">{parseError}</p>
              {prompt.expectedShape === "json" && (
                <button onClick={copyExpectedShape} className="text-ink underline underline-offset-4 hover:text-gold">
                  챗봇에게 다시 요청할 텍스트 복사
                </button>
              )}
            </div>
          )}
          <button className="btn-primary w-full mt-4 py-3 text-[12.5px]" onClick={apply}>
            적용하기 →
          </button>
          <p className="text-[11px] text-soft text-center mt-3 leading-relaxed">
            챗봇이 JSON 형식을 안 지키거나 안 따라줘도 괜찮아요.
            답변을 보고 본인이 직접 카드를 수정해도 OK.
          </p>
        </div>
      </div>
    </Modal>
  );
}
