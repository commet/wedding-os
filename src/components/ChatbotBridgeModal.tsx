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
  const [copyHint, setCopyHint] = useState("");

  useEffect(() => {
    if (!open) return;
    setReply("");
    setParseError(null);
    setAiStatus("idle");
    setAiError("");
    setPending(null);
    setCopyHint("");
  }, [open, prompt?.title]);

  useEffect(() => {
    if (!open || getAiConfig().provider !== "managed") { setManagedSignedIn(false); return; }
    let cancelled = false;
    void currentAccessToken().then((token) => { if (!cancelled) setManagedSignedIn(!!token); });
    return () => { cancelled = true; };
  }, [open, prompt?.title]);

  if (!prompt) return null;
  const aiConfig = getAiConfig();
  const directAiReady = hasDirectAi(aiConfig);
  const pendingPreview = previewPending(pending, prompt.expectedShape);
  const actionLabel = prompt.expectedShape === "text" ? "문장 다듬기" : "초안 만들기";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopyHint("요청 내용을 복사했어요.");
    } catch {
      setCopyHint("복사하지 못했어요. 아래 내용을 직접 선택해 복사해주세요.");
    }
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
      setCopyHint("다시 요청할 문장을 복사했어요.");
    } catch {
      setCopyHint("복사하지 못했어요. 문장을 직접 선택해 보내주세요.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={prompt.title}>
      <div className="space-y-5">
        <div className="border-y border-hair py-4">
          <div className="mb-4">
            <div className="eyebrow-gold mb-1.5">초안 만들기</div>
            <p className="text-[14px] font-medium leading-relaxed text-ink break-keep">
              지금 화면에서 바로 쓸 다음 행동만 뽑습니다.
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-soft break-keep">
              적용 전에는 한 번 더 확인할 수 있어요.
            </p>
          </div>
          {directAiReady ? (
            <>
              <button
                className="btn-primary w-full py-3 text-[13px] disabled:opacity-50"
                onClick={runDirect}
                disabled={aiStatus === "running"}
              >
                {aiStatus === "running" ? "초안 만드는 중…" : actionLabel}
              </button>
              <p className="text-[12px] text-soft text-center mt-3 leading-relaxed">
                {aiConfig.provider === "managed" && !managedSignedIn
                  ? "로그인 없이도 짧게 써볼 수 있어요. 자주 쓰게 되면 로그인하면 됩니다."
                  : "추천은 시작점이에요. 가격·일정·계약 조건은 직접 확인해 주세요."}
              </p>
              {aiConfig.provider === "managed" && (
                <p className="text-center mt-2">
                  <a href="/ai" className="inline-flex min-h-11 items-center text-[12px] underline underline-offset-4 text-soft hover:text-ink">
                    사용 방식 바꾸기
                  </a>
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11.5px] text-soft leading-relaxed">
                앱 안 실행을 켜면 복사 없이 바로 부탁할 수 있어요. 지금은 다른 AI 답변을 붙여넣어 반영할 수 있습니다.
              </p>
              <a href={aiConfig.provider === "managed" ? "/login" : "/ai"} className="inline-flex min-h-11 items-center px-2 text-[12px] underline underline-offset-4 text-ink hover:text-gold whitespace-nowrap">
                {aiConfig.provider === "managed" ? "로그인" : "설정"}
              </a>
            </div>
          )}
          {aiError && <p className="text-[11.5px] text-gold mt-2 whitespace-pre-line">{aiError}</p>}
        </div>

        <details open={!directAiReady} className="border-y border-hair py-4">
          <summary className="list-none cursor-pointer flex items-baseline justify-between gap-4">
            <span>
              <span className="eyebrow-gold block mb-1">{directAiReady ? "대체 방법" : "다른 AI로 이어가기"}</span>
              <span className="font-serif text-[15px] text-ink">
                {directAiReady ? "요청 내용 보기" : "요청을 복사해 답변 붙여넣기"}
              </span>
            </span>
            <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
          </summary>
          <div className="pt-4 space-y-4">
            <div className="bg-cream p-4 border-l-2 border-hair max-h-[34vh] overflow-y-auto">
              <pre className="text-[12px] whitespace-pre-wrap font-mono text-ink/80 leading-relaxed">{prompt.prompt}</pre>
            </div>

            <button className="min-h-11 text-[12px] underline underline-offset-4 text-ink hover:text-gold" onClick={copy}>
              다른 AI에 보낼 내용 복사
            </button>
            {copyHint && <p className="text-[12px] text-soft leading-relaxed">{copyHint}</p>}

            <div className="flex gap-3 flex-wrap pt-2 border-t border-hair">
              <a className="inline-flex min-h-11 items-center text-[12px] underline underline-offset-4 text-ink hover:text-gold" href={CHAT_LINKS.claude} target="_blank" rel="noopener noreferrer">Claude 열기 ↗</a>
              <a className="inline-flex min-h-11 items-center text-[12px] underline underline-offset-4 text-ink hover:text-gold" href={CHAT_LINKS.chatgpt} target="_blank" rel="noopener noreferrer">ChatGPT 열기 ↗</a>
              <a className="inline-flex min-h-11 items-center text-[12px] underline underline-offset-4 text-ink hover:text-gold" href={CHAT_LINKS.gemini} target="_blank" rel="noopener noreferrer">Gemini 열기 ↗</a>
            </div>

            {!directAiReady && (
              <div className="pt-4 border-t border-hair">
                <label className="label">답변 붙여넣기</label>
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
                <p className="text-[12px] text-soft text-center mt-4 mb-3 leading-relaxed">
                  답변을 먼저 읽어보고, 반영 가능한 초안만 따로 보여드릴게요.
                </p>
                <button className="btn-primary w-full py-3 text-[13px]" onClick={reviewReply}>
                  초안 확인하기 →
                </button>
              </div>
            )}
          </div>
        </details>

        {directAiReady && aiError && (
          <div className="border-y border-hair py-4">
            <p className="text-[13px] leading-relaxed text-soft">
              지금은 직접 실행이 막혔어요. 위 대체 방법을 열어 다른 AI 답변을 붙여넣으면 같은 방식으로 확인하고 반영할 수 있습니다.
            </p>
          </div>
        )}

        {!directAiReady && (
          <div className="pt-1">
            <p className="text-[12px] text-soft text-center leading-relaxed">
              앱 안 실행을 켜면 이 붙여넣기 단계가 사라집니다.
            </p>
          </div>
        )}

        {!directAiReady && parseError && prompt.expectedShape === "json" && copyHint && (
          <p className="text-[12px] text-soft leading-relaxed">{copyHint}</p>
        )}

        {!directAiReady && (
          <div className="sr-only" aria-live="polite">
            {copyHint}
          </div>
        )}

        {!directAiReady && false && (
          <div>
            {/* kept unreachable to prevent layout churn if future bridge-only review moves out of details */}
          </div>
        )}

        {directAiReady && (
          <details open className="border-b border-hair pb-4">
            <summary className="list-none cursor-pointer flex min-h-11 items-center justify-between gap-4">
              <span className="text-[13px] font-medium text-soft">답변을 직접 붙여넣어도 돼요</span>
              <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
            </summary>
            <div className="mt-3">
              <textarea
                className="input-boxed min-h-[104px] text-[13px]"
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
              <button className="btn-secondary mt-3 text-[12px]" onClick={reviewReply}>
                초안 확인하기 →
              </button>
            </div>
          </details>
        )}

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
