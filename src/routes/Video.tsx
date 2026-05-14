import { useState } from "react";
import type { WeddingData } from "../lib/schema";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import { videoEditPrompt, BridgePrompt } from "../lib/chatbotBridge";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Video({ data, update }: Props) {
  const [bridge, setBridge] = useState<BridgePrompt | null>(null);
  const [aiRequest, setAiRequest] = useState("");

  const acts = data.video.acts ?? [];

  const initActs = () => {
    update((prev: WeddingData) => ({
      ...prev,
      video: {
        ...prev.video,
        title: prev.video.title ?? `${prev.invitation.groomName || "신랑"} · ${prev.invitation.brideName || "신부"}`,
        acts: [
          { id: "act-1", title: "각자의 자리에서", subtitle: "어린 시절" },
          { id: "act-2", title: "같은 곳에서, 함께", subtitle: "처음 만난 시간" },
          { id: "act-3", title: "우리의 시간", subtitle: "함께 보낸 날들" },
          { id: "act-4", title: "함께 걸어온 시간", subtitle: "지금까지" },
          { id: "act-5", title: "그리고, 오늘", subtitle: "결혼식" },
        ],
      },
    }));
  };

  const askAI = () => {
    if (!aiRequest.trim()) return;
    setBridge(videoEditPrompt(data.video, aiRequest.trim()));
  };

  const applyAI = (parsed: any) => {
    if (!parsed) return;
    update((prev: WeddingData) => ({ ...prev, video: { ...prev.video, ...parsed } }));
    setAiRequest("");
    setBridge(null);
  };

  return (
    <div className="px-5 py-6 space-y-4">
      <h1 className="font-serif text-2xl">식전영상</h1>

      <div className="card">
        <h3 className="font-medium mb-2">🎬 영상 구조 (5막)</h3>
        {acts.length === 0 ? (
          <>
            <p className="text-sm text-soft mb-3">
              결혼 준비 영상은 보통 5막 구조가 잘 어울려요. 기본 구조부터 시작해보세요.
            </p>
            <button onClick={initActs} className="btn-primary w-full">
              5막 기본 구조 가져오기
            </button>
          </>
        ) : (
          <ul className="space-y-2 text-sm">
            {acts.map((a, i) => (
              <li key={a.id} className="flex items-start gap-2">
                <span className="text-gold font-medium">{i + 1}.</span>
                <div>
                  <div className="font-medium">{a.title}</div>
                  {a.subtitle && <div className="text-xs text-soft">{a.subtitle}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 className="font-medium mb-2">🤖 AI에게 영상 수정 요청</h3>
        <p className="text-sm text-soft mb-3">
          한국어로 자유롭게 요청하세요. ChatGPT/Claude로 답변 받아오면 자동으로 반영돼요.
        </p>
        <textarea
          className="input min-h-[80px]"
          placeholder="예: 첫 번째 막 제목을 '시작'으로 바꿔주세요. 그리고 5막 부제를 더 따뜻하게."
          value={aiRequest}
          onChange={(e) => setAiRequest(e.target.value)}
        />
        <button onClick={askAI} className="btn-primary w-full mt-3" disabled={!aiRequest.trim()}>
          🤖 AI 프롬프트 생성
        </button>
      </div>

      <div className="card bg-cream">
        <h3 className="font-medium mb-2">🎞️ 풀 에디터</h3>
        <p className="text-sm text-soft mb-3">
          사진 업로드, 폴라로이드 페어, 카톡 말풍선, Journey Map 같은
          풀 영상 편집기는 별도 코드로 제공돼요. 곧 이 안에 통합될 예정이고,
          지금은 외부 레포로 받아 직접 쓰실 수 있어요.
        </p>
        <a
          href="https://github.com/commet/wedding-os/tree/main/letter-editor"
          target="_blank"
          className="btn-secondary w-full text-center"
        >
          깃허브에서 풀 에디터 받기
        </a>
      </div>

      <ChatbotBridgeModal
        open={!!bridge}
        onClose={() => setBridge(null)}
        prompt={bridge}
        onApply={applyAI}
      />
    </div>
  );
}
