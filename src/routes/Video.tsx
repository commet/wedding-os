import { useState, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type {
  WeddingData,
  VideoConfig,
  VideoPhoto,
  VideoEffect,
  VideoFilter,
  VideoTransition,
} from "../lib/schema";
import { normalizeVideo } from "../lib/schema";
import { WeddingVideo, buildScenes, VIDEO_W, VIDEO_H } from "../video/WeddingVideo";
import Modal from "../components/Modal";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import { videoEditPrompt, BridgePrompt } from "../lib/chatbotBridge";
import { STOCK_GALLERY } from "../data/stockPhotos";
import { safeMediaSrc } from "../lib/security";
import { canAutoRecord, recordCurrentTab, downloadBlob } from "../lib/videoExport";

type Props = { data: WeddingData; update: (patch: any) => void; };

const EFFECTS: { value: VideoEffect; label: string }[] = [
  { value: "kenBurnsIn", label: "확대" },
  { value: "kenBurnsOut", label: "축소" },
  { value: "panLeft", label: "← 이동" },
  { value: "panRight", label: "이동 →" },
  { value: "static", label: "고정" },
];
const FILTERS: { value: VideoFilter; label: string }[] = [
  { value: "none", label: "원본" },
  { value: "warm", label: "따뜻하게" },
  { value: "cool", label: "시원하게" },
  { value: "bw", label: "흑백" },
  { value: "sepia", label: "세피아" },
  { value: "vintage", label: "빈티지" },
];
const TRANSITIONS: { value: VideoTransition; label: string }[] = [
  { value: "fade", label: "페이드" },
  { value: "slide", label: "슬라이드" },
  { value: "none", label: "없음" },
];

export default function Video({ data, update }: Props) {
  const config = useMemo(() => normalizeVideo(data.video), [data.video]);
  const coupleNames = `${data.invitation.groomName || "신랑"} · ${data.invitation.brideName || "신부"}`;

  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bridge, setBridge] = useState<BridgePrompt | null>(null);
  const [aiRequest, setAiRequest] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const playerRef = useRef<PlayerRef>(null);

  const setVideo = (fn: (v: VideoConfig) => VideoConfig) => {
    update((prev: WeddingData) => ({ ...prev, video: fn(normalizeVideo(prev.video)) }));
  };

  const { total, fps } = useMemo(() => buildScenes(config), [config]);
  const durationSec = Math.round(total / fps);

  // ── 액션들 ──
  const addAct = () =>
    setVideo((v) => ({
      ...v,
      acts: [...v.acts, { id: `act-${Date.now()}`, title: `${v.acts.length + 1}부`, subtitle: "" }],
    }));

  const removeAct = (id: string) =>
    setVideo((v) => ({
      ...v,
      acts: v.acts.filter((a) => a.id !== id),
      photos: v.photos.map((p) => (p.actId === id ? { ...p, actId: undefined } : p)),
    }));

  const addPhotos = (urls: string[]) => {
    const safe = urls.map((u) => safeMediaSrc(u)).filter((u): u is string => !!u);
    if (safe.length === 0) {
      alert("https:// 로 시작하는 사진 주소만 추가할 수 있어요.");
      return;
    }
    setVideo((v) => ({
      ...v,
      photos: [
        ...v.photos,
        ...safe.map((url, i): VideoPhoto => ({
          id: `vp-${Date.now()}-${i}`,
          url,
          durationSec: 4,
          effect: "kenBurnsIn",
          transition: "fade",
          filter: "none",
          // 막은 선택 기능 — 새 사진은 막 없이 추가, 필요하면 아래에서 배정
          actId: undefined,
        })),
      ],
    }));
    setShowPhotoPicker(false);
  };

  const updatePhoto = (id: string, patch: Partial<VideoPhoto>) =>
    setVideo((v) => ({ ...v, photos: v.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const removePhoto = (id: string) =>
    setVideo((v) => ({ ...v, photos: v.photos.filter((p) => p.id !== id) }));

  const movePhoto = (id: string, dir: -1 | 1) =>
    setVideo((v) => {
      const idx = v.photos.findIndex((p) => p.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= v.photos.length) return v;
      const photos = [...v.photos];
      [photos[idx], photos[next]] = [photos[next], photos[idx]];
      return { ...v, photos };
    });

  const askAI = () => {
    if (!aiRequest.trim()) return;
    setBridge(videoEditPrompt(config, aiRequest.trim()));
  };

  const handleAutoRecord = async () => {
    if (config.photos.length === 0) {
      alert("사진을 먼저 추가해주세요.");
      return;
    }
    if (!canAutoRecord()) {
      alert("이 브라우저는 자동 녹화를 지원하지 않아요. 아래 [화면 녹화 가이드]를 따라주세요.");
      return;
    }
    if (!confirm(
      "🎬 자동 영상 녹화\n\n" +
      "1. 곧 '어떤 화면을 공유할까요?' 창이 떠요.\n" +
      "2. '현재 탭' (또는 wedding-os 탭) 선택 + '탭 오디오 공유' 체크\n" +
      "3. 자동으로 영상이 재생되고 녹화돼요.\n" +
      "4. 영상 끝나면 WebM 파일이 자동 다운로드됩니다.\n\n" +
      "총 약 " + durationSec + "초. 시작할까요?"
    )) return;

    setRecording(true);
    setRecordProgress(0);
    try {
      // 영상을 처음으로 되감고 풀스크린으로
      playerRef.current?.seekTo(0);
      const playerEl = document.querySelector(".remotion-player") as HTMLElement | null;
      try { if (playerEl?.requestFullscreen) await playerEl.requestFullscreen(); } catch {}
      // 약간 기다린 뒤 재생 + 녹화 시작
      await new Promise((r) => setTimeout(r, 400));
      playerRef.current?.play();
      const blob = await recordCurrentTab({
        durationMs: durationSec * 1000 + 600,
        fps,
        onProgress: (sec, t) => setRecordProgress(Math.round((sec / t) * 100)),
      });
      downloadBlob(blob, `wedding-video-${Date.now()}.webm`);
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
      alert(
        "✓ 영상이 다운로드됐어요.\n\n" +
        "WebM 파일은 VLC·QuickTime 등에서 재생되고,\n" +
        "MP4 변환이 필요하면 무료 도구(예: CloudConvert)에 올리시면 됩니다."
      );
    } catch (e: any) {
      const msg = e?.message ?? "알 수 없는 오류";
      if (e?.name === "NotAllowedError") {
        alert("화면 공유를 취소하셨어요.");
      } else {
        alert("녹화 실패: " + msg);
      }
    } finally {
      setRecording(false);
      setRecordProgress(0);
    }
  };

  const applyAI = (parsed: any) => {
    if (!parsed) return;
    // AI 답변은 신뢰할 수 없음 — URL/오디오 src 는 안전한 것만 통과.
    // (악의적·잘못된 URL로 외부 추적 픽셀이 박히지 않도록.)
    const normalized = normalizeVideo(parsed);
    const safe: VideoConfig = {
      ...normalized,
      photos: normalized.photos.filter((p) => !!safeMediaSrc(p.url)),
      bgmUrl: safeMediaSrc(normalized.bgmUrl),
    };
    setVideo(() => safe);
    setAiRequest("");
    setBridge(null);
  };

  return (
    <div className="px-5 py-6 space-y-5">
      <h1 className="font-serif text-2xl">식전영상</h1>

      {/* 미리보기 */}
      <div className="remotion-player rounded-2xl overflow-hidden border border-line bg-ink">
        <Player
          ref={playerRef}
          component={WeddingVideo}
          inputProps={{ config, coupleNames }}
          durationInFrames={total}
          fps={fps}
          compositionWidth={VIDEO_W}
          compositionHeight={VIDEO_H}
          style={{ width: "100%", aspectRatio: "16 / 9" }}
          controls
          loop
        />
      </div>
      <p className="text-center text-xs text-soft">
        {config.photos.length > 0
          ? `사진 ${config.photos.length}장 · 약 ${durationSec}초 · ▶ 눌러 재생`
          : "아래에서 사진을 추가하면 영상이 만들어져요"}
      </p>

      {/* 막(챕터) — 선택 기능 */}
      <section className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">🎬 막(챕터) 나누기 <span className="text-xs text-soft font-normal">— 선택</span></h3>
          <button onClick={addAct} className="btn-secondary text-xs">+ 막 추가</button>
        </div>
        {config.acts.length === 0 ? (
          <p className="text-sm text-soft leading-relaxed">
            막을 나누지 않아도 사진이 음악과 함께 자연스럽게 흘러가요.<br />
            "신랑 이야기 / 신부 이야기 / 함께", "어린 시절 / 만남 / 오늘"처럼
            나누고 싶을 때만 막을 추가하세요. 막마다 짧은 타이틀 화면이 들어갑니다.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {config.acts.map((a, i) => (
              <li key={a.id} className="flex gap-2 items-start">
                <span className="text-gold font-medium mt-2">{i + 1}</span>
                <div className="flex-1">
                  <input
                    className="font-medium bg-transparent w-full outline-none border-b border-line py-1"
                    value={a.title}
                    placeholder="막 제목"
                    onChange={(e) =>
                      setVideo((v) => ({
                        ...v,
                        acts: v.acts.map((x) => (x.id === a.id ? { ...x, title: e.target.value } : x)),
                      }))
                    }
                  />
                  <input
                    className="text-xs text-soft bg-transparent w-full outline-none py-1"
                    value={a.subtitle ?? ""}
                    placeholder="부제 (선택)"
                    onChange={(e) =>
                      setVideo((v) => ({
                        ...v,
                        acts: v.acts.map((x) => (x.id === a.id ? { ...x, subtitle: e.target.value } : x)),
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-soft">
                    {config.photos.filter((p) => p.actId === a.id).length}장
                  </span>
                  <button onClick={() => removeAct(a.id)} className="text-xs text-soft">삭제</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 사진 목록 */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">사진 ({config.photos.length})</h3>
          <button onClick={() => setShowPhotoPicker(true)} className="btn-secondary text-sm">
            + 사진 추가
          </button>
        </div>

        {config.photos.length === 0 ? (
          <div className="card text-center py-8 text-soft text-sm">
            사진을 추가해 영상을 만들어보세요.
          </div>
        ) : (
          <div className="space-y-2">
            {config.photos.map((photo, i) => (
              <div key={photo.id} className="card p-3">
                <div className="flex items-center gap-3">
                  {safeMediaSrc(photo.url) && (
                    <img src={safeMediaSrc(photo.url)} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <input
                      className="text-sm w-full bg-transparent outline-none"
                      placeholder="자막 (선택)"
                      value={photo.caption ?? ""}
                      onChange={(e) => updatePhoto(photo.id, { caption: e.target.value })}
                    />
                    <div className="text-xs text-soft mt-1">
                      {EFFECTS.find((e) => e.value === photo.effect)?.label} ·{" "}
                      {photo.durationSec}초
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => movePhoto(photo.id, -1)} disabled={i === 0} className="text-soft text-xs disabled:opacity-30">▲</button>
                    <button onClick={() => movePhoto(photo.id, 1)} disabled={i === config.photos.length - 1} className="text-soft text-xs disabled:opacity-30">▼</button>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === photo.id ? null : photo.id)}
                    className="text-gold text-xs"
                  >
                    {expandedId === photo.id ? "접기" : "편집"}
                  </button>
                </div>

                {expandedId === photo.id && (
                  <div className="mt-3 pt-3 border-t border-line space-y-3">
                    <PhotoChips label="효과" value={photo.effect} options={EFFECTS} onChange={(v) => updatePhoto(photo.id, { effect: v })} />
                    <PhotoChips label="필터" value={photo.filter} options={FILTERS} onChange={(v) => updatePhoto(photo.id, { filter: v })} />
                    <PhotoChips label="전환" value={photo.transition} options={TRANSITIONS} onChange={(v) => updatePhoto(photo.id, { transition: v })} />
                    <div>
                      <label className="label">길이: {photo.durationSec}초</label>
                      <input
                        type="range" min={2} max={10} step={0.5}
                        value={photo.durationSec}
                        onChange={(e) => updatePhoto(photo.id, { durationSec: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    {config.acts.length > 0 && (
                      <div>
                        <label className="label">소속 막</label>
                        <select
                          className="input text-sm"
                          value={photo.actId ?? ""}
                          onChange={(e) => updatePhoto(photo.id, { actId: e.target.value || undefined })}
                        >
                          <option value="">막 없음</option>
                          {config.acts.map((a) => (
                            <option key={a.id} value={a.id}>{a.title}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button onClick={() => removePhoto(photo.id)} className="text-red-500 text-sm">
                      이 사진 삭제
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* BGM + 엔딩 */}
      <section className="card space-y-3">
        <h3 className="font-medium">🎵 음악 & 엔딩</h3>
        <div>
          <label className="label">배경음악 주소 (mp3 URL, 선택)</label>
          <input
            className="input text-sm"
            value={config.bgmUrl ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setVideo((p) => ({ ...p, bgmUrl: v || undefined }));
            }}
            onBlur={(e) => {
              const v = e.target.value;
              if (v && !safeMediaSrc(v)) {
                alert("배경음악 주소는 https:// 로 시작해야 해요.");
              }
            }}
            placeholder="https://...mp3"
          />
        </div>
        <div>
          <label className="label">엔딩 메시지</label>
          <textarea
            className="input text-sm min-h-[70px]"
            value={config.ending?.message ?? ""}
            onChange={(e) =>
              setVideo((v) => ({
                ...v,
                ending: { message: e.target.value, date: v.ending?.date ?? data.invitation.date },
              }))
            }
            placeholder="와주셔서 감사합니다"
          />
        </div>
      </section>

      {/* 자연어 편집 */}
      <section className="card space-y-3">
        <h3 className="font-medium">🤖 말로 영상 고치기</h3>
        <p className="text-sm text-soft">
          "3번째 사진 더 길게", "전부 빈티지 필터로", "막 제목 바꿔줘" 처럼 한국어로 적으면
          ChatGPT·Claude가 영상 설정을 고쳐줘요.
        </p>
        <textarea
          className="input text-sm min-h-[70px]"
          placeholder="예: 모든 사진을 따뜻한 필터로 바꾸고, 첫 사진은 6초로"
          value={aiRequest}
          onChange={(e) => setAiRequest(e.target.value)}
        />
        <button onClick={askAI} className="btn-primary w-full" disabled={!aiRequest.trim()}>
          AI 프롬프트 만들기
        </button>
      </section>

      {/* MP4 내보내기 — 진짜 작동하는 가이드 */}
      <section className="card space-y-4">
        <h3 className="font-medium">📥 영상 파일로 저장하기</h3>

        {/* 자동 녹화 — 실험 */}
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 space-y-2">
          <p className="text-sm font-medium">🎬 자동 녹화 (실험)</p>
          <p className="text-xs text-soft leading-relaxed">
            한 번에 자동으로 영상 파일을 만들어요. 데스크탑 Chrome/Edge에서 가장 잘 작동.
            모바일은 아래 화면 녹화 가이드를 추천.
          </p>
          <button
            onClick={handleAutoRecord}
            disabled={recording || config.photos.length === 0}
            className="btn-primary w-full text-sm disabled:opacity-50"
          >
            {recording ? `🔴 녹화 중… ${recordProgress}%` : "🎬 자동으로 녹화 시작"}
          </button>
          <p className="text-[11px] text-soft">
            결과는 WebM 파일. VLC·QuickTime에서 재생 가능.
            MP4 필요하면 CloudConvert 같은 무료 변환 도구.
          </p>
        </div>

        <p className="text-sm text-soft leading-relaxed pt-2">
          또는 가장 안정적인 방법 — <b className="text-ink">기기 화면 녹화</b>:
        </p>

        <div className="bg-cream rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium">1️⃣ 먼저 영상을 풀스크린으로</p>
          <button
            onClick={() => {
              const el = document.querySelector(".remotion-player") as HTMLElement | null;
              if (el && el.requestFullscreen) el.requestFullscreen();
            }}
            className="btn-secondary text-xs w-full"
          >
            🖥️ 풀스크린으로 보기
          </button>
        </div>

        <div className="bg-cream rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium">2️⃣ 기기에서 화면 녹화 시작</p>
          <details className="text-xs text-soft">
            <summary className="cursor-pointer text-ink">📱 아이폰 (가장 쉬움)</summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside pl-2">
              <li>제어 센터 (오른쪽 위에서 아래로 스와이프)</li>
              <li>⏺ 화면 기록 버튼 누르기 (3초 카운트)</li>
              <li>여기로 돌아와 ▶ 재생</li>
              <li>영상 끝나면 다시 ⏹로 정지</li>
              <li>사진 앱에 저장됨</li>
            </ol>
          </details>
          <details className="text-xs text-soft">
            <summary className="cursor-pointer text-ink">💻 맥 (QuickTime)</summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside pl-2">
              <li><b>Cmd + Shift + 5</b> (화면 녹화 도구)</li>
              <li>"선택 영역 기록" 선택 → Player 영역 드래그</li>
              <li>"기록" 클릭 → 위 ▶ 재생</li>
              <li>완료 후 Cmd+Shift+5 → 정지</li>
            </ol>
          </details>
          <details className="text-xs text-soft">
            <summary className="cursor-pointer text-ink">🪟 윈도우 (Xbox Game Bar)</summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside pl-2">
              <li><b>Win + G</b> → Game Bar 열기</li>
              <li>캡처 위젯의 ⏺ 녹화 시작</li>
              <li>여기로 돌아와 ▶ 재생</li>
              <li>완료 후 정지 → 비디오 폴더에 저장</li>
            </ol>
          </details>
          <details className="text-xs text-soft">
            <summary className="cursor-pointer text-ink">📱 안드로이드</summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside pl-2">
              <li>제어 센터에서 "화면 녹화" 누르기</li>
              <li>여기로 돌아와 ▶ 재생</li>
              <li>완료 후 다시 정지</li>
            </ol>
          </details>
        </div>

        <div className="bg-cream rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium">3️⃣ (선택) 더 고화질로 — 개발자 모드</p>
          <p className="text-xs text-soft">
            화면 녹화 화질이 부족하면 GitHub에서 코드 받아서 <code className="bg-white px-1 rounded">npx remotion render</code> —
            1080p 60fps 깔끔한 MP4 출력.
          </p>
          <a
            href="https://github.com/commet/wedding-os"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gold underline"
          >
            GitHub에서 받기 ↗
          </a>
        </div>

        <p className="text-[11px] text-soft text-center pt-1">
          💡 결혼식장에 미리 영상 파일 + 형식 확인하세요. 보통 MP4 1920×1080.
        </p>
      </section>

      {/* 사진 추가 모달 */}
      {showPhotoPicker && (
        <Modal open onClose={() => setShowPhotoPicker(false)} title="사진 추가">
          <PhotoAdd onAdd={addPhotos} />
        </Modal>
      )}

      <ChatbotBridgeModal
        open={!!bridge}
        onClose={() => setBridge(null)}
        prompt={bridge}
        onApply={applyAI}
      />
    </div>
  );
}

function PhotoChips<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`text-xs px-2.5 py-1.5 rounded-full ${value === o.value ? "bg-gold text-white" : "bg-white border border-line text-soft"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PhotoAdd({ onAdd }: { onAdd: (urls: string[]) => void; }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [url, setUrl] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <label className="label">사진 주소(URL) 직접 추가</label>
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://...jpg" />
          <button
            className="btn-secondary text-sm"
            onClick={() => { if (url.trim()) { onAdd([url.trim()]); setUrl(""); } }}
          >
            추가
          </button>
        </div>
      </div>

      <div>
        <label className="label">또는 추천 사진에서 고르기 (여러 장 선택 가능)</label>
        <div className="grid grid-cols-3 gap-2">
          {STOCK_GALLERY.map((u) => {
            const on = selected.includes(u);
            return (
              <button
                key={u}
                onClick={() => setSelected((s) => (on ? s.filter((x) => x !== u) : [...s, u]))}
                className={`relative rounded-lg overflow-hidden ${on ? "ring-2 ring-gold" : ""}`}
              >
                <img src={u} alt="" className="w-full aspect-square object-cover" />
                {on && (
                  <span className="absolute top-1 right-1 bg-gold text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✓</span>
                )}
              </button>
            );
          })}
        </div>
        <button
          className="btn-primary w-full mt-3"
          disabled={selected.length === 0}
          onClick={() => onAdd(selected)}
        >
          {selected.length > 0 ? `${selected.length}장 추가하기` : "사진을 선택하세요"}
        </button>
      </div>
    </div>
  );
}
