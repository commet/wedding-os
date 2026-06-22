// 사용자가 본인 API 키 없이 AI 활용 — ChatGPT/Claude/Gemini 무료 버전에 복붙.
import { useEffect, useState } from "react";
import Modal from "./Modal";
import { BridgePrompt, CHAT_LINKS, extractJSON } from "../lib/chatbotBridge";
import { hasDirectAi, runAiPrompt } from "../lib/aiClient";
import { getAiConfig } from "../lib/security";
import { currentAccessToken } from "../lib/auth";

type Props = {
  open: boolean;
  onClose: () => void;
  prompt: BridgePrompt | null;
  onApply?: (parsed: unknown) => void;
};

export default function ChatbotBridgeModal({ open, onClose, prompt, onApply }: Props) {
  const [reply, setReply] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "running" | "fail">("idle");
  const [aiError, setAiError] = useState("");
  const [pending, setPending] = useState<unknown | null>(null);
  const [managedSignedIn, setManagedSignedIn] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReply("");
    setParseError(null);
    setAiStatus("idle");
    setAiError("");
    setPending(null);
  }, [open, prompt?.title]);

  useEffect(() => {
    if (!open || getAiConfig().provider !== "managed") { setManagedSignedIn(false); return; }
    let cancelled = false;
    void currentAccessToken().then((token) => { if (!cancelled) setManagedSignedIn(!!token); });
    return () => { cancelled = true; };
  }, [open, prompt?.title]);

  if (!prompt) return null;
  const aiConfig = getAiConfig();
  const directAiReady = aiConfig.provider === "managed" ? managedSignedIn : hasDirectAi(aiConfig);
  const pendingPreview = previewPending(pending, prompt.expectedShape);
  const actionLabel = prompt.expectedShape === "text" ? "문안 다듬기 →" : "초안 만들기 →";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
    } catch {}
  };

  const reviewReply = () => {
    if (!reply.trim()) return;
    if (prompt.expectedShape === "text") {
      setPending(reply.trim());
      return;
    }
    const parsed = extractJSON(reply);
    if (!parsed) {
      setParseError(
        "답변을 바로 읽어오지 못했어요.\n" +
        "챗봇이 준 답변 전체를 다시 붙여넣거나, 필요한 내용만 직접 입력해도 됩니다."
      );
      return;
    }
    setParseError(null);
    setPending(parsed);
  };

  const applyPending = () => {
    if (pending === null) return;
    onApply?.(pending);
    onClose();
  };

  const runDirect = async () => {
    setAiStatus("running");
    setAiError("");
    const r = await runAiPrompt(prompt, aiConfig);
    if (!r.ok || !r.text) {
      setAiStatus("fail");
      setAiError(r.reason ?? "AI 실행에 실패했어요.");
      return;
    }
    setAiStatus("idle");
    setReply(r.text);
    if (prompt.expectedShape === "text") {
      setPending(r.text.trim());
      return;
    }
    const parsed = extractJSON(r.text);
    if (!parsed) {
      setParseError("AI 답변을 바로 읽어오지 못했어요. 답변을 확인한 뒤 필요한 내용만 직접 입력해도 됩니다.");
      return;
    }
    setParseError(null);
    setPending(parsed);
  };

  const copyExpectedShape = async () => {
    if (!prompt.expectedShape || prompt.expectedShape === "text") return;
    const example = "위 요청에 맞춰 앱이 읽을 수 있는 형식으로 다시 정리해주세요.";
    try {
      await navigator.clipboard.writeText(example);
      alert("힌트가 복사됐어요. 챗봇에 이어서 보내주세요.");
    } catch {}
  };

  return (
    <Modal open={open} onClose={onClose} title={prompt.title}>
      <div className="space-y-5">
        <p className="text-[12.5px] text-soft leading-relaxed">
          {directAiReady
            ? "현재 입력된 정보만 바탕으로 초안을 만들고, 적용 전 한 번 더 확인합니다."
            : "아래 요청을 평소 쓰는 AI에 보내고, 답변을 다시 붙여넣으면 적용 전 확인할 수 있어요."}
        </p>

        <div className="border-y border-hair py-4">
          {directAiReady ? (
            <>
              <button
                className="btn-primary w-full py-3 text-[12px] disabled:opacity-50"
                onClick={runDirect}
                disabled={aiStatus === "running"}
              >
                {aiStatus === "running" ? "정리하는 중…" : actionLabel}
              </button>
              <p className="text-[11px] text-soft text-center mt-2">
                추천은 시작점이에요. 가격·일정·계약 조건은 직접 확인해 주세요.
              </p>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11.5px] text-soft leading-relaxed">
                AI 연결을 켜면 이 단계를 앱 안에서 바로 실행할 수 있어요.
              </p>
              <a href={aiConfig.provider === "managed" ? "/login" : "/ai"} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold whitespace-nowrap">
                {aiConfig.provider === "managed" ? "로그인 →" : "설정 →"}
              </a>
            </div>
          )}
          {aiError && <p className="text-[11.5px] text-gold mt-2 whitespace-pre-line">{aiError}</p>}
        </div>

        <details open={!directAiReady} className="border-y border-hair py-4">
          <summary className="list-none cursor-pointer flex items-baseline justify-between gap-4">
            <span>
              <span className="eyebrow-gold block mb-1">{directAiReady ? "직접 확인" : "다른 AI로 사용"}</span>
              <span className="font-serif text-[15px] text-ink">
                {directAiReady ? "요청 내용 보기 · 다른 AI에 보내기" : "요청을 복사해 챗봇에 보내기"}
              </span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
          </summary>
          <div className="pt-4 space-y-4">
            <div className="bg-cream p-4 border-l-2 border-hair max-h-[34vh] overflow-y-auto">
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
          </div>
        </details>

        <div className="pt-5 border-t border-hair">
          <label className="label">다른 AI 답변 붙여넣기</label>
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
                  다시 요청할 문장 복사
                </button>
              )}
            </div>
          )}
          <button className="btn-primary w-full mt-4 py-3 text-[12.5px]" onClick={reviewReply}>
            검토하기 →
          </button>
          <p className="text-[11px] text-soft text-center mt-3 leading-relaxed">
            답변이 완벽하지 않아도 괜찮아요. 필요한 부분만 직접 고쳐 쓸 수 있습니다.
          </p>
        </div>

        {pending !== null && (
          <div className="border-y border-hair py-4 space-y-4">
            <div>
              <div className="eyebrow-gold mb-2">적용 전 확인</div>
              <div className="bg-cream p-4 text-[12.5px] text-ink/85 leading-relaxed whitespace-pre-line">
                {pendingPreview}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="btn-secondary py-3 text-[12px]"
                onClick={() => setPending(null)}
              >
                다시 보기
              </button>
              <button
                type="button"
                className="btn-primary py-3 text-[12px]"
                onClick={applyPending}
              >
                이대로 반영 →
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function previewPending(value: unknown, shape: BridgePrompt["expectedShape"]): string {
  if (value === null || value === undefined) return "";
  if (shape === "text") return String(value).trim();
  if (typeof value !== "object") return String(value);
  const data = value as any;
  const lines: string[] = [];
  if (typeof data.summary === "string" && data.summary.trim()) {
    lines.push(`요약\n${data.summary.trim()}`);
  }
  if (Array.isArray(data.today) && data.today.length > 0) {
    lines.push(`오늘 할 일\n${data.today.slice(0, 3).map((item: any) => `- ${item?.title ?? ""}`).join("\n")}`);
  }
  if (Array.isArray(data.checklistItems) && data.checklistItems.length > 0) {
    lines.push(`체크리스트 ${data.checklistItems.length}개 추가`);
  }
  if (Array.isArray(data.budgetItems) && data.budgetItems.length > 0) {
    lines.push(`예산 항목 ${data.budgetItems.length}개 추가`);
  }
  if (Array.isArray(data.honeymoonRegions) && data.honeymoonRegions.length > 0) {
    lines.push(`여행 후보 ${data.honeymoonRegions.length}개 추가`);
  }
  if (typeof data.invitationGreeting === "string" && data.invitationGreeting.trim()) {
    lines.push(`청첩장 문안 초안\n${data.invitationGreeting.trim()}`);
  }
  return lines.length > 0 ? lines.join("\n\n") : "추가할 내용을 찾았습니다. 반영한 뒤 각 화면에서 다시 수정할 수 있어요.";
}
