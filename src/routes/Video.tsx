import { useState, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type {
  WeddingData,
  VideoConfig,
  VideoAct,
  VideoPhoto,
  VideoEffect,
  VideoFilter,
  VideoTransition,
} from "../lib/schema";
import { normalizeVideo } from "../lib/schema";
import { WeddingVideo, buildScenes, VIDEO_W, VIDEO_H } from "../video/WeddingVideo";
import Modal from "../components/Modal";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import DearieConfirmModal from "../components/DearieConfirmModal";
import { videoEditPrompt, restoreDataUrls, BridgePrompt } from "../lib/chatbotBridge";
import { STOCK_GALLERY } from "../data/stockPhotos";
import { safeMediaSrc } from "../lib/security";
import { canAutoRecord, recordCurrentTab, downloadBlob } from "../lib/videoExport";
import { compressImage } from "../lib/imageCompress";
import { parseISODateLocal } from "../lib/date";
import {
  VIDEO_TEMPLATES,
  findTemplate,
  fmtDuration,
  type VideoTemplate,
} from "../data/videoTemplates";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import SectionConsultationPanel from "../components/SectionConsultationPanel";

type Props = { data: WeddingData; update: (patch: any) => void; };

type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "normal" | "warn";
  onConfirm: () => void | Promise<void>;
};

type VideoNotice = {
  title: string;
  body: string;
  tone?: "normal" | "warn";
};

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
  const currentTemplate = useMemo(() => findTemplate(config.templateId), [config.templateId]);

  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [photoPickerChapter, setPhotoPickerChapter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bridge, setBridge] = useState<BridgePrompt | null>(null);
  const [aiRequest, setAiRequest] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const [videoNotice, setVideoNotice] = useState<VideoNotice | null>(null);
  const playerRef = useRef<PlayerRef>(null);

  const setVideo = (fn: (v: VideoConfig) => VideoConfig) => {
    update((prev: WeddingData) => ({ ...prev, video: fn(normalizeVideo(prev.video)) }));
  };

  const { total, fps } = useMemo(() => buildScenes(config), [config]);
  const durationSec = Math.round(total / fps);

  // ── 챕터 / 막 ──
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

  // ── 사진 ──
  const openPhotoPicker = (chapterId?: string) => {
    setPhotoPickerChapter(chapterId ?? null);
    setShowPhotoPicker(true);
  };

  const closePhotoPicker = () => {
    setShowPhotoPicker(false);
    setPhotoPickerChapter(null);
  };

  const addPhotos = (urls: string[]) => {
    const safe = urls.map((u) => safeMediaSrc(u)).filter((u): u is string => !!u);
    if (safe.length === 0) {
      setVideoNotice({
        title: "사진을 읽지 못했어요",
        body: "주소로 넣을 때는 https:// 로 시작하는 이미지 주소만 사용할 수 있어요. 휴대폰 사진은 파일로 추가하면 더 편합니다.",
        tone: "warn",
      });
      return;
    }
    const d = currentTemplate?.defaults;
    const targetChapter = photoPickerChapter ?? undefined;
    const newPhotos: VideoPhoto[] = safe.map((url, i) => ({
      id: `vp-${Date.now()}-${i}`,
      url,
      durationSec: d?.photoDurationSec ?? 4,
      effect: d?.effect ?? "kenBurnsIn",
      transition: d?.transition ?? "fade",
      filter: d?.filter ?? "none",
      actId: targetChapter,
    }));
    // 렌더는 챕터 순서대로 묶어서 그리므로 flat 배열에서는 그냥 끝에 붙여도 안전.
    setVideo((v) => ({ ...v, photos: [...v.photos, ...newPhotos] }));
    closePhotoPicker();
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

  // ── 템플릿 ──
  const applyTemplate = (template: VideoTemplate) => {
    const hasExisting = config.acts.length > 0 || !!config.templateId;
    const commit = () => {
      const newActs: VideoAct[] = template.chapters.map((ch, i) => ({
        id: `act-${Date.now()}-${i}`,
        title: ch.title,
        subtitle: ch.subtitle,
      }));
      setVideo((v) => ({
        ...v,
        templateId: template.id,
        acts: newActs,
        photos: v.photos.map((p) => ({ ...p, actId: undefined })),
      }));
    };
    if (!hasExisting) {
      commit();
      return;
    }
    setConfirmDialog({
      title: "템플릿을 바꿀까요?",
      body:
        `${template.name} 분위기로 챕터를 다시 짭니다.\n\n` +
        `기존 사진은 지우지 않고, 챕터 배정만 풀어둘게요. 사진별 효과·필터·길이는 그대로 둡니다.`,
      confirmLabel: "템플릿 바꾸기",
      onConfirm: commit,
    });
  };

  const clearTemplate = () => {
    setConfirmDialog({
      title: "템플릿 표시를 뺄까요?",
      body: "챕터와 사진은 그대로 두고, 선택한 템플릿 이름만 비워둘게요.",
      confirmLabel: "표시 빼기",
      onConfirm: () => setVideo((v) => ({ ...v, templateId: undefined })),
    });
  };

  const autoAssignPhotosToChapters = () => {
    if (!currentTemplate || config.acts.length === 0) return;
    setConfirmDialog({
      title: "사진을 챕터에 나눠둘까요?",
      body: "아직 챕터가 없는 사진만 템플릿 권장 수에 맞춰 순서대로 넣습니다. 이미 배정한 사진은 건드리지 않아요.",
      confirmLabel: "자동으로 나누기",
      onConfirm: () => {
        const validActIds = new Set(config.acts.map((a) => a.id));
        const newPhotos = config.photos.map((p) => ({ ...p }));
        // 챕터별로 권장량까지 미배정 사진을 흡수. flat 배열은 재정렬하지 않는다 — 렌더가 챕터별로 묶어 보여줘서 필요 없음.
        for (let i = 0; i < config.acts.length; i++) {
          const chapter = config.acts[i];
          const target = currentTemplate.chapters[i]?.photoCount ?? 0;
          const existing = newPhotos.filter((p) => p.actId === chapter.id).length;
          let need = Math.max(0, target - existing);
          for (let j = 0; j < newPhotos.length && need > 0; j++) {
            const p = newPhotos[j];
            if (!p.actId || !validActIds.has(p.actId)) {
              newPhotos[j] = { ...p, actId: chapter.id };
              need--;
            }
          }
        }
        setVideo((v) => ({ ...v, photos: newPhotos }));
      },
    });
  };

  // ── 엔딩 자동 채우기 ──
  const pullEndingFromInvitation = () => {
    const dateStr = formatWeddingDate(data.invitation.date);
    const venueStr = [data.invitation.venue, data.invitation.venueHall].filter(Boolean).join(" · ");
    setVideo((v) => ({
      ...v,
      ending: {
        ...(v.ending ?? { message: "" }),
        message: v.ending?.message?.trim() || "와주셔서 진심으로 감사드립니다",
        date: dateStr || v.ending?.date,
        time: data.invitation.time || v.ending?.time,
        venue: venueStr || v.ending?.venue,
      },
    }));
  };

  const setEnding = (patch: Partial<NonNullable<VideoConfig["ending"]>>) =>
    setVideo((v) => ({
      ...v,
      ending: { ...(v.ending ?? { message: "" }), ...patch },
    }));

  // ── AI / 녹화 / 내보내기 ──
  const askAI = () => {
    if (!aiRequest.trim()) return;
    setBridge(videoEditPrompt(config, aiRequest.trim(), currentTemplate?.name));
  };

  const handleAutoRecord = async () => {
    if (config.photos.length === 0) {
      setVideoNotice({
        title: "사진이 먼저 필요해요",
        body: "영상에 들어갈 사진을 추가하면 녹화와 저장을 이어갈 수 있어요.",
        tone: "warn",
      });
      return;
    }
    if (!canAutoRecord()) {
      setVideoNotice({
        title: "자동 녹화를 지원하지 않는 브라우저예요",
        body: "아래 화면 녹화 가이드를 따라 기기 기본 녹화로 저장해주세요.",
        tone: "warn",
      });
      return;
    }
    setConfirmDialog({
      title: "자동 녹화를 시작할까요?",
      body:
        "곧 화면 공유 창이 열립니다.\n\n" +
        "현재 탭을 고르고, 소리가 필요하면 탭 오디오 공유를 켜주세요. 처음부터 재생하고 끝나면 WebM 파일을 내려받습니다.\n\n" +
        `예상 길이는 약 ${durationSec}초예요.`,
      confirmLabel: "녹화 시작",
      onConfirm: startAutoRecord,
    });
  };

  const startAutoRecord = async () => {
    setRecording(true);
    setRecordProgress(0);
    try {
      playerRef.current?.seekTo(0);
      const playerEl = document.querySelector(".remotion-player") as HTMLElement | null;
      try { if (playerEl?.requestFullscreen) await playerEl.requestFullscreen(); } catch {}
      await new Promise((r) => setTimeout(r, 400));
      playerRef.current?.play();
      const blob = await recordCurrentTab({
        durationMs: durationSec * 1000 + 600,
        fps,
        onProgress: (sec, t) => setRecordProgress(Math.round((sec / t) * 100)),
      });
      downloadBlob(blob, `wedding-video-${Date.now()}.webm`);
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
      setVideoNotice({
        title: "영상이 다운로드됐어요",
        body: "WebM 파일은 VLC·QuickTime 등에서 재생할 수 있어요. 식장에서 MP4를 요구하면 변환 도구로 MP4로 바꿔 제출하세요.",
      });
    } catch (e: any) {
      const msg = e?.message ?? "알 수 없는 오류";
      if (e?.name === "NotAllowedError") {
        setVideoNotice({
          title: "녹화를 시작하지 않았어요",
          body: "화면 공유가 취소됐습니다. 다시 시도하거나 아래 기기 화면 녹화 가이드를 사용할 수 있어요.",
          tone: "warn",
        });
      } else {
        setVideoNotice({
          title: "녹화에 실패했어요",
          body: msg,
          tone: "warn",
        });
      }
    } finally {
      setRecording(false);
      setRecordProgress(0);
    }
  };

  const handleExportConfig = () => {
    const props = { config, coupleNames };
    const json = JSON.stringify(props, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    downloadBlob(blob, `wedding-video-props.json`);
  };

  const applyAI = (parsed: any) => {
    if (!parsed) return;
    // 1) data URL 토큰 복원
    const restored = restoreDataUrls(parsed, config);
    // 2) 정규화 + URL 안전 필터
    const normalized = normalizeVideo(restored);
    const safe: VideoConfig = {
      ...normalized,
      photos: normalized.photos.filter((p) => !!safeMediaSrc(p.url)),
      bgmUrl: safeMediaSrc(normalized.bgmUrl),
    };
    const commit = () => {
      setVideo(() => safe);
      setAiRequest("");
      setBridge(null);
    };
    // 3) 큰 변화 감지 — AI 가 실수로 사진/챕터를 통째로 날린 경우 사용자 확인
    if (config.photos.length > 0 && safe.photos.length < config.photos.length / 2) {
      setConfirmDialog({
        title: "사진 수가 많이 줄었어요",
        body:
          `Dearie 답변을 적용하면 사진이 ${config.photos.length}장에서 ${safe.photos.length}장으로 줄어듭니다.\n\n` +
          "의도한 수정이 아니라면 취소하고 다시 부탁하는 편이 안전해요.",
        confirmLabel: "그래도 반영",
        tone: "warn",
        onConfirm: commit,
      });
      return;
    }
    if (config.acts.length > 0 && safe.acts.length === 0) {
      setConfirmDialog({
        title: "챕터가 모두 사라져요",
        body: `지금 적용하면 챕터 ${config.acts.length}개가 0개로 바뀝니다. 정말 막 없이 이어지는 영상으로 바꿀까요?`,
        confirmLabel: "그래도 반영",
        tone: "warn",
        onConfirm: commit,
      });
      return;
    }
    commit();
  };

  // ── 사진 그룹화 ──
  const photoGroups = useMemo((): { chapter: VideoAct | null; photos: VideoPhoto[] }[] => {
    if (config.acts.length === 0) {
      return [{ chapter: null, photos: config.photos }];
    }
    const groups: { chapter: VideoAct | null; photos: VideoPhoto[] }[] = config.acts.map((ch) => ({
      chapter: ch,
      photos: config.photos.filter((p) => p.actId === ch.id),
    }));
    const unassigned = config.photos.filter(
      (p) => !p.actId || !config.acts.find((a) => a.id === p.actId)
    );
    if (unassigned.length > 0) groups.push({ chapter: null, photos: unassigned });
    return groups;
  }, [config]);

  const hasUnassigned = config.acts.length > 0 && photoGroups.some(
    (g) => g.chapter === null && g.photos.length > 0
  );

  const targetCount = currentTemplate?.photoCountTotal.ideal ?? 0;
  const photoProgress = targetCount
    ? Math.min(100, Math.round((config.photos.length / targetCount) * 100))
    : 0;
  const minPhotoCount = currentTemplate?.photoCountTotal.min ?? 12;
  const endingReady = !!config.ending?.message?.trim() && !!config.ending?.date && !!config.ending?.venue;
  const videoAgentSummary = !currentTemplate
    ? "식전영상은 빈 캔버스에서 시작하면 막막해요. 먼저 템플릿을 고르면 챕터·길이·효과가 한 번에 잡힙니다."
    : config.photos.length < minPhotoCount
      ? `${currentTemplate.name} 템플릿 기준으로 최소 ${minPhotoCount}장 정도가 필요해요. 지금은 사진을 채우는 단계입니다.`
      : hasUnassigned
        ? "사진은 충분히 들어왔고, 아직 챕터에 배정되지 않은 사진이 있어요. 자동 분배 후 흐름을 보면 됩니다."
        : endingReady
          ? "템플릿, 사진, 엔딩 정보가 준비됐어요. 이제 재생 확인과 파일 내보내기만 남았습니다."
          : "영상 본문은 잡혔고 엔딩 카드의 날짜·장소를 청첩장에서 가져오면 마무리가 쉬워집니다.";

  return (
    <div className="page pt-8 pb-10 space-y-8">
      <div>
        <div className="eyebrow-gold mb-2">영상 만들기</div>
        <h1 className="font-serif text-[2rem] leading-none">식전영상</h1>
      </div>

      <ProcessAgentPanel
        title={!currentTemplate ? "영상 구조를 먼저 고르는 중" : config.photos.length < minPhotoCount ? "사진 수를 채우는 중" : hasUnassigned ? "챕터 배정을 정리하는 중" : "상영 전 검수 단계"}
        summary={videoAgentSummary}
        mood={currentTemplate && config.photos.length >= minPhotoCount && !hasUnassigned && endingReady ? "ready" : "thinking"}
        metrics={[
          { label: "템플릿", value: currentTemplate ? "선택" : "없음", tone: currentTemplate ? "normal" : "warn" },
          { label: "사진", value: `${config.photos.length}/${targetCount || minPhotoCount}`, tone: config.photos.length < minPhotoCount ? "warn" : "normal" },
          { label: "엔딩", value: endingReady ? "완료" : "미정", tone: endingReady ? "normal" : "muted" },
        ]}
        steps={[
          { label: "템플릿으로 챕터 잡기", detail: "챕터와 사진 권장 수가 먼저 정해져야 편집 판단이 쉬워집니다.", done: !!currentTemplate },
          { label: "최소 사진 수 채우기", detail: currentTemplate ? `${currentTemplate.name} 최소 ${minPhotoCount}장.` : "템플릿 선택 후 권장 수가 보입니다.", done: config.photos.length >= minPhotoCount },
          { label: "미배정 사진을 챕터에 넣기", detail: "렌더링은 챕터 순서대로 묶여 보입니다.", done: !hasUnassigned },
          { label: "엔딩 카드 정보 채우기", detail: "청첩장 날짜·시간·장소를 그대로 가져올 수 있어요.", done: endingReady },
        ]}
        actions={[
          ...(!currentTemplate ? [{ label: "클래식 템플릿으로 시작", onClick: () => applyTemplate(VIDEO_TEMPLATES[0]), tone: "primary" as const }] : []),
          ...(currentTemplate && config.photos.length < minPhotoCount ? [{ label: "사진 추가하기", onClick: () => openPhotoPicker(), tone: "primary" as const }] : []),
          ...(hasUnassigned ? [{ label: "사진 자동 배정", onClick: autoAssignPhotosToChapters, tone: "primary" as const }] : []),
          ...(!endingReady ? [{ label: "엔딩을 청첩장에서 채우기", onClick: pullEndingFromInvitation }] : []),
        ]}
      />

      <SectionConsultationPanel sectionId="video" data={data} update={update} />

      {/* 인트로 */}
      <div className="py-4 border-y border-hair">
        <p className="text-[13px] leading-relaxed text-ink mb-3">사진과 음악을 더해 결혼식 입장 전에 트는 영상을 만들어요.</p>
        <ul className="text-[11.5px] text-soft space-y-1 leading-relaxed">
          <li>· 권장: 사진 30~60장, 길이 3~5분, 해상도 1920×1080</li>
          <li>· 사진은 자동으로 1080p JPEG로 압축됩니다</li>
          <li>· 배경음악 mp3 URL은 저작권 확인 후 사용하세요</li>
          <li>· 식장에 미리 파일 형식(MP4 1920×1080) 확인 필수</li>
        </ul>
      </div>

      {videoNotice && (
        <div className={`border-y py-4 ${videoNotice.tone === "warn" ? "border-gold/50 bg-gold/5" : "border-hair"}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow-gold mb-1">Dearie</div>
              <p className="text-[14px] font-semibold text-ink">{videoNotice.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-soft">{videoNotice.body}</p>
            </div>
            <button
              type="button"
              onClick={() => setVideoNotice(null)}
              className="min-h-11 min-w-11 text-soft hover:text-ink"
              aria-label="안내 닫기"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 미리보기 */}
      <div className="remotion-player overflow-hidden bg-ink">
        <Player
          ref={playerRef}
          component={WeddingVideo}
          inputProps={{ config, coupleNames }}
          durationInFrames={total}
          fps={fps}
          compositionWidth={VIDEO_W}
          compositionHeight={VIDEO_H}
          style={{ width: "100%", aspectRatio: "16 / 9" }}
          acknowledgeRemotionLicense
          controls
          loop
        />
      </div>
      <p className="text-center text-xs text-soft">
        {config.photos.length > 0
          ? `사진 ${config.photos.length}장 · 약 ${fmtDuration(durationSec)} · ▶ 눌러 재생`
          : currentTemplate
          ? `${currentTemplate.name} — ${currentTemplate.chapters.length || 0}개 챕터 준비됨. 아래에서 사진을 채워보세요.`
          : "아래에서 템플릿을 골라 시작해보세요"}
      </p>

      {/* 템플릿 — 없으면 갤러리, 있으면 현재 표시 */}
      {!currentTemplate ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="eyebrow-gold">어떤 영상을 만들까요?</h3>
            <span className="eyebrow tabular-nums">{VIDEO_TEMPLATES.length}종</span>
          </div>
          <p className="text-[12.5px] text-soft leading-relaxed">
            빈 캔버스에서 시작하면 막막해요. 분위기 하나 고르면
            챕터 · 사진 길이 · 효과 · 전환 까지 한 번에 세팅됩니다.
          </p>
          <div className="group-card px-4">
            {VIDEO_TEMPLATES.map((t) => (
              <TemplateCard key={t.id} template={t} onPick={() => applyTemplate(t)} />
            ))}
          </div>
          <div className="text-center pt-1">
            <button
              onClick={() => openPhotoPicker()}
              className="text-[12px] text-soft underline underline-offset-4 hover:text-ink"
            >
              또는 막(챕터) 없이 사진부터 추가하기 →
            </button>
          </div>
        </section>
      ) : (
        <section className="py-5 border-y border-hair">
          <div className="flex items-baseline gap-4">
            <div
              className="w-10 h-10 flex items-center justify-center text-xl flex-shrink-0"
              style={{ backgroundColor: currentTemplate.themeColor + "22" }}
            >
              {currentTemplate.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-[15px] text-ink truncate">{currentTemplate.name}</div>
              <div className="eyebrow mt-1 truncate">
                {fmtDuration(currentTemplate.totalDurationSec)} · 사진 {currentTemplate.photoCountTotal.ideal}장
                {currentTemplate.chapters.length > 0 && ` · ${currentTemplate.chapters.length}챕터`}
              </div>
            </div>
            <button onClick={clearTemplate} className="text-[11.5px] text-soft underline underline-offset-4 hover:text-ink whitespace-nowrap">
              변경 →
            </button>
          </div>
          {currentTemplate.photoCountTotal.ideal > 0 && (
            <div className="mt-4 pt-4 border-t border-hair">
              <div className="flex items-baseline justify-between mb-2">
                <span className="eyebrow">사진 진척도</span>
                <span className="text-[11.5px] text-soft tabular-nums">
                  {config.photos.length} / {currentTemplate.photoCountTotal.ideal}장
                </span>
              </div>
              <div className="w-full h-px bg-line relative">
                <div
                  className="absolute top-0 left-0 h-px transition-all"
                  style={{
                    width: `${photoProgress}%`,
                    backgroundColor: currentTemplate.themeColor,
                  }}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* 사진 — 챕터별 그룹 */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="eyebrow-gold">사진 · <span className="tabular-nums">{config.photos.length}</span></h3>
          {!currentTemplate && config.acts.length === 0 && (
            <button onClick={() => openPhotoPicker()} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
              + 사진 추가
            </button>
          )}
        </div>

        {config.photos.length === 0 && config.acts.length === 0 ? (
          <div className="py-10 text-center text-soft text-[13px] border-y border-hair">
            {currentTemplate
              ? "위 챕터들에 사진을 채워보세요."
              : "템플릿을 고르거나 사진을 추가해보세요."}
          </div>
        ) : config.acts.length > 0 ? (
          <div className="space-y-8">
            {photoGroups.map((g, gi) => {
              const tplCh = g.chapter && currentTemplate ? currentTemplate.chapters[gi] : undefined;
              const targetSlots = tplCh?.photoCount;
              const chapterId = g.chapter?.id;
              return (
                <div key={chapterId ?? "unassigned"} className="space-y-3">
                  <div className="flex items-baseline justify-between border-b border-hair pb-2">
                    <div className="min-w-0 flex items-baseline gap-3">
                      <span className="font-serif text-soft text-base tabular-nums">{String(gi + 1).padStart(2, "0")}</span>
                      <span className="font-serif text-[15px] text-ink">
                        {g.chapter ? g.chapter.title : "챕터 미배정"}
                      </span>
                      {g.chapter?.subtitle && (
                        <span className="eyebrow">
                          {g.chapter.subtitle}
                        </span>
                      )}
                    </div>
                    <span className="eyebrow tabular-nums whitespace-nowrap">
                      {g.photos.length}{targetSlots ? ` / ${targetSlots}` : ""}장
                    </span>
                  </div>
                  {g.photos.length === 0 ? (
                    <div className="py-6 text-center text-soft text-[12px] border-b border-hair">
                      이 챕터에 사진이 없어요.
                      {targetSlots ? ` 약 ${targetSlots}장 권장.` : ""}
                    </div>
                  ) : (
                    <div className="divide-y divide-hair border-b border-hair">
                      {g.photos.map((photo) => {
                        const flatIdx = config.photos.findIndex((p) => p.id === photo.id);
                        return (
                          <PhotoRow
                            key={photo.id}
                            photo={photo}
                            isFirst={flatIdx === 0}
                            isLast={flatIdx === config.photos.length - 1}
                            isExpanded={expandedId === photo.id}
                            onToggleExpand={() =>
                              setExpandedId(expandedId === photo.id ? null : photo.id)
                            }
                            onUpdate={(patch) => updatePhoto(photo.id, patch)}
                            onMove={(dir) => movePhoto(photo.id, dir)}
                            onRemove={() => removePhoto(photo.id)}
                            chapters={config.acts}
                          />
                        );
                      })}
                    </div>
                  )}
                  {g.chapter && (
                    <button
                      onClick={() => openPhotoPicker(chapterId)}
                      className="text-[12px] underline underline-offset-4 text-ink hover:text-gold"
                    >
                      + 이 챕터에 사진 추가
                    </button>
                  )}
                </div>
              );
            })}
            {hasUnassigned && currentTemplate && (
              <button
                onClick={autoAssignPhotosToChapters}
                className="text-[12px] underline underline-offset-4 text-ink hover:text-gold w-full text-left"
              >
                미배정 사진을 챕터에 자동 분배 (템플릿 권장량 기준) →
              </button>
            )}
          </div>
        ) : (
          <div className="group-card px-4">
            {config.photos.map((photo, i) => (
              <PhotoRow
                key={photo.id}
                photo={photo}
                isFirst={i === 0}
                isLast={i === config.photos.length - 1}
                isExpanded={expandedId === photo.id}
                onToggleExpand={() => setExpandedId(expandedId === photo.id ? null : photo.id)}
                onUpdate={(patch) => updatePhoto(photo.id, patch)}
                onMove={(dir) => movePhoto(photo.id, dir)}
                onRemove={() => removePhoto(photo.id)}
                chapters={config.acts}
              />
            ))}
          </div>
        )}
      </section>

      {/* BGM + 엔딩 */}
      <section className="space-y-4 py-8 border-y border-hair">
        <div className="flex items-baseline justify-between">
          <h3 className="eyebrow-gold">음악 · 엔딩</h3>
          <button
            onClick={pullEndingFromInvitation}
            className="text-[11.5px] text-soft underline underline-offset-4 hover:text-ink whitespace-nowrap"
            title="이름·날짜·시간·장소를 청첩장 데이터에서 가져오기"
          >
            ↻ 청첩장에서 가져오기
          </button>
        </div>
        {currentTemplate && (
          <p className="eyebrow">
            추천 BGM 무드 · {currentTemplate.bgmHint}
          </p>
        )}
        <div>
          <label className="label">배경음악 (mp3 URL)</label>
          <input
            className="input text-[13px]"
            value={config.bgmUrl ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setVideo((p) => ({ ...p, bgmUrl: v || undefined }));
            }}
            onBlur={(e) => {
              const v = e.target.value;
              if (v && !safeMediaSrc(v)) {
                setVideoNotice({
                  title: "배경음악 주소를 확인해주세요",
                  body: "외부 음악 주소는 https:// 로 시작해야 안전하게 미리보기와 저장에 사용할 수 있어요.",
                  tone: "warn",
                });
              }
            }}
            placeholder="https://...mp3"
          />
        </div>
        <div className="pt-4 border-t border-hair space-y-3">
          <p className="label">엔딩 카드 (마지막 화면)</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <label className="label">날짜</label>
              <input
                className="input text-[13px]"
                value={config.ending?.date ?? ""}
                onChange={(e) => setEnding({ date: e.target.value })}
                placeholder="2026.06.20 토"
              />
            </div>
            <div>
              <label className="label">시간</label>
              <input
                className="input text-[13px]"
                value={config.ending?.time ?? ""}
                onChange={(e) => setEnding({ time: e.target.value })}
                placeholder="오후 3시"
              />
            </div>
          </div>
          <div>
            <label className="label">장소</label>
            <input
              className="input text-[13px]"
              value={config.ending?.venue ?? ""}
              onChange={(e) => setEnding({ venue: e.target.value })}
              placeholder="더 채플 · 그랜드볼룸"
            />
          </div>
          <div>
            <label className="label">메시지</label>
            <textarea
              className="input-boxed text-[13px] min-h-[60px]"
              value={config.ending?.message ?? ""}
              onChange={(e) => setEnding({ message: e.target.value })}
              placeholder="와주셔서 진심으로 감사드립니다"
            />
          </div>
          <p className="text-[10.5px] text-soft mt-2 leading-relaxed">
            영상 끝 약 6초 동안 표시됩니다. 위 ↻ 버튼으로 청첩장 정보를 한 번에 가져올 수 있어요.
          </p>
        </div>
      </section>

      {/* 자연어 편집 */}
      <details className="py-4 border-b border-hair">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4">
          <span>
            <span className="eyebrow-gold block mb-1">영상 설정 고치기</span>
            <span className="text-[12px] text-soft">사진 길이·필터·순서를 말로 부탁하기</span>
          </span>
          <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-[13px] text-soft leading-relaxed">
            원하는 변화만 한 문장으로 적어주세요. 영상 설정을 바꾼 뒤,
            사진이 크게 줄거나 챕터가 사라질 때는 반영 전에 다시 물어봅니다.
          </p>
          <textarea
            className="input-boxed text-[14px] min-h-[88px]"
            placeholder="예: 모든 사진을 따뜻한 필터로 바꾸고, 첫 사진은 6초로"
            value={aiRequest}
            onChange={(e) => setAiRequest(e.target.value)}
          />
          <button onClick={askAI} className="btn-primary w-full text-[13px]" disabled={!aiRequest.trim()}>
            설정 고치기
          </button>
        </div>
      </details>

      {/* 챕터 세부 조정 — 접혀 있음 */}
      <details className="py-2 border-b border-hair">
        <summary className="cursor-pointer flex items-baseline justify-between py-3">
          <span className="font-serif text-[15px] text-ink">챕터 세부 조정 <span className="text-soft text-[12px]">— 제목 · 부제 바꾸기</span></span>
          <span className="eyebrow tabular-nums">
            {config.acts.length > 0 ? `${config.acts.length}개` : "없음"}
          </span>
        </summary>
        <div className="mt-3 space-y-3">
          {config.acts.length === 0 && (
            <p className="text-xs text-soft leading-relaxed">
              템플릿을 고르면 챕터가 자동으로 세팅돼요. 직접 만들고 싶으면 아래 + 버튼.
            </p>
          )}
          {config.acts.length > 0 && (
            <ul className="space-y-2 text-sm">
              {config.acts.map((a, i) => (
                <li key={a.id} className="flex gap-2 items-start">
                  <span className="text-gold font-medium mt-2 tabular-nums">{i + 1}</span>
                  <div className="flex-1">
                    <input
                      className="font-medium bg-transparent w-full outline-none border-b border-line py-1"
                      value={a.title}
                      placeholder="챕터 제목"
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
                    <span className="text-xs text-soft tabular-nums">
                      {config.photos.filter((p) => p.actId === a.id).length}장
                    </span>
                    <button onClick={() => removeAct(a.id)} className="text-xs text-soft">삭제</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button onClick={addAct} className="btn-secondary text-xs">+ 챕터 추가</button>
        </div>
      </details>

      {/* 영상 파일로 저장하기 */}
      <details className="py-4 border-y border-hair">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4">
          <span>
            <span className="eyebrow-gold block mb-1">영상 파일로 저장하기</span>
            <span className="text-[12px] text-soft">식장 제출용 MP4·녹화 방법</span>
          </span>
          <span className="text-[12px] text-soft underline underline-offset-4">열기</span>
        </summary>
        <div className="mt-5 space-y-6">
        <div className="pl-5 border-l-2 border-gold space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="eyebrow-gold">1순위</span>
            <p className="font-serif text-[15px] text-ink">개발자 모드로 진짜 MP4 받기</p>
          </div>
          <p className="text-[12px] text-soft leading-relaxed">
            Remotion 으로 1920×1080 / 30fps H.264 MP4 를 깔끔하게 출력합니다.
            화질·동기화 면에서 녹화보다 훨씬 좋아요. 식장에 그대로 제출 가능.
          </p>
          <button
            onClick={handleExportConfig}
            disabled={config.photos.length === 0}
            className="btn-primary text-[12px] disabled:opacity-40"
          >
            영상 설정 내보내기 (JSON) →
          </button>
          <details className="text-[12px]">
            <summary className="cursor-pointer text-ink underline underline-offset-4 hover:text-gold">렌더링 명령어 보기 ↓</summary>
            <ol className="mt-3 space-y-2 list-decimal list-inside text-soft leading-relaxed">
              <li>
                GitHub에서 코드 받기:{" "}
                <a
                  href="https://github.com/commet/wedding-os"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline underline-offset-2 hover:text-gold"
                >
                  github.com/commet/wedding-os ↗
                </a>
              </li>
              <li><code className="bg-cream px-1.5 py-0.5">npm install</code></li>
              <li>위에서 받은 <code className="bg-cream px-1.5 py-0.5">wedding-video-props.json</code> 을 프로젝트 폴더에 둬요</li>
              <li><code className="bg-cream px-1.5 py-0.5">npm run video:render</code> 를 실행해요 (props 파일은 명령어에 이미 연결돼 있어요)</li>
              <li><code className="bg-cream px-1.5 py-0.5">out/wedding-video.mp4</code> 가 생겨요</li>
            </ol>
            <p className="mt-3 text-soft">
              사진 URL이 외부 호스팅이면 그대로 가져와 렌더링합니다.
              직접 업로드한 사진(data URL)도 그대로 동작.
            </p>
            <p className="mt-1 text-soft">
              미리보기·세팅을 더 만지려면 <code className="bg-cream px-1.5 py-0.5">npm run video:studio</code> 로 Remotion Studio 도 열 수 있어요.
            </p>
          </details>
        </div>

        <div className="pl-5 border-l border-hair space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="eyebrow">2순위</span>
            <p className="font-serif text-[15px] text-ink">브라우저에서 자동 녹화</p>
          </div>
          <p className="text-[12px] text-soft leading-relaxed">
            클릭 한 번에 WebM 으로 저장. 코딩 없이 되지만 화질이 다소 낮고 (탭 화면을 직접 캡처)
            데스크탑 Chrome/Edge 에서만 동작합니다. MP4 가 필요하면 CloudConvert 같은 무료 변환기 사용.
          </p>
          <button
            onClick={handleAutoRecord}
            disabled={recording || config.photos.length === 0 || !canAutoRecord()}
            className="text-[12px] underline underline-offset-4 text-ink hover:text-gold disabled:opacity-40"
          >
            {recording
              ? `녹화 중… ${recordProgress}%`
              : canAutoRecord()
              ? "자동으로 녹화 시작 →"
              : "이 브라우저는 자동 녹화 미지원"}
          </button>
        </div>

        <details className="pl-5 border-l border-hair">
          <summary className="cursor-pointer flex items-baseline gap-3 py-1">
            <span className="eyebrow">3순위</span>
            <span className="font-serif text-[15px] text-ink">기기 화면 녹화 가이드</span>
          </summary>
          <div className="mt-3 space-y-3 text-[12px]">
            <button
              onClick={() => {
                const el = document.querySelector(".remotion-player") as HTMLElement | null;
                if (el && el.requestFullscreen) el.requestFullscreen();
              }}
              className="text-[12px] underline underline-offset-4 text-ink hover:text-gold"
            >
              먼저 풀스크린으로 보기 →
            </button>
            <details className="text-soft">
              <summary className="cursor-pointer text-ink">📱 아이폰</summary>
              <ol className="mt-2 space-y-1 list-decimal list-inside pl-2">
                <li>제어 센터에서 ⏺ 화면 기록 (3초 카운트)</li>
                <li>여기로 돌아와 ▶ 재생, 영상 끝나면 ⏹</li>
                <li>사진 앱에 저장됨</li>
              </ol>
            </details>
            <details className="text-soft">
              <summary className="cursor-pointer text-ink">💻 맥 (QuickTime)</summary>
              <ol className="mt-2 space-y-1 list-decimal list-inside pl-2">
                <li><b>Cmd + Shift + 5</b> → "선택 영역 기록"</li>
                <li>Player 영역 드래그 → "기록" → ▶ 재생</li>
                <li>완료 후 Cmd+Shift+5 → 정지</li>
              </ol>
            </details>
            <details className="text-soft">
              <summary className="cursor-pointer text-ink">🪟 윈도우 (Xbox Game Bar)</summary>
              <ol className="mt-2 space-y-1 list-decimal list-inside pl-2">
                <li><b>Win + G</b> → Game Bar</li>
                <li>캡처 위젯 ⏺ → ▶ 재생 → 정지</li>
              </ol>
            </details>
            <details className="text-soft">
              <summary className="cursor-pointer text-ink">📱 안드로이드</summary>
              <ol className="mt-2 space-y-1 list-decimal list-inside pl-2">
                <li>제어 센터에서 "화면 녹화"</li>
                <li>▶ 재생 → 완료 후 정지</li>
              </ol>
            </details>
          </div>
        </details>

          <p className="text-[11px] text-soft text-center pt-1">
            식장에 미리 영상 파일 + 형식(MP4 1920×1080)을 확인하세요.
          </p>
        </div>
      </details>

      {showPhotoPicker && (
        <Modal
          open
          onClose={closePhotoPicker}
          title={
            photoPickerChapter
              ? `사진 추가 — ${config.acts.find((a) => a.id === photoPickerChapter)?.title ?? "챕터"}`
              : "사진 추가"
          }
        >
          <PhotoAdd
            onAdd={addPhotos}
            onError={(body) =>
              setVideoNotice({
                title: "사진을 불러오지 못했어요",
                body,
                tone: "warn",
              })
            }
          />
        </Modal>
      )}

      <ChatbotBridgeModal
        open={!!bridge}
        onClose={() => setBridge(null)}
        prompt={bridge}
        onApply={applyAI}
      />
      <DearieConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title ?? ""}
        body={confirmDialog?.body ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "확인"}
        cancelLabel={confirmDialog?.cancelLabel}
        tone={confirmDialog?.tone}
        onClose={() => setConfirmDialog(null)}
        onConfirm={async () => { await confirmDialog?.onConfirm(); }}
      />
    </div>
  );
}

// ── 보조 컴포넌트 ─────────────────────────────────────────────────────

function TemplateCard({
  template,
  onPick,
}: {
  template: VideoTemplate;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className="w-full text-left py-4 transition active:opacity-60"
    >
      <div className="flex items-baseline gap-4">
        <div
          className="text-xl w-9 h-9 flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: template.themeColor + "26" }}
        >
          {template.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-serif text-[15px] text-ink leading-tight">{template.name}</span>
            <span className="eyebrow-gold">{template.mood}</span>
            {template.chapters.length === 0 && (
              <span className="text-[11px] tracking-wider uppercase text-sage border border-sage/40 px-1.5 py-0.5 rounded">
                막 없이
              </span>
            )}
          </div>
          <div className="text-[12px] text-soft mt-1 leading-relaxed">{template.tagline}</div>
          <div className="eyebrow mt-2 tabular-nums">
            {fmtDuration(template.totalDurationSec)} · 사진 {template.photoCountTotal.ideal}장
            {template.chapters.length > 0 && ` · ${template.chapters.length}챕터`}
          </div>
        </div>
        <span className="text-soft text-sm flex-shrink-0">→</span>
      </div>
    </button>
  );
}

function PhotoRow({
  photo,
  isFirst,
  isLast,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onMove,
  onRemove,
  chapters,
}: {
  photo: VideoPhoto;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<VideoPhoto>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  chapters: VideoAct[];
}) {
  const thumb = safeMediaSrc(photo.url);
  return (
    <div className="py-4">
      <div className="flex items-center gap-3">
        {thumb && (
          <img src={thumb} alt="" className="w-14 h-14 object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className={`text-[14px] leading-snug break-keep ${photo.caption ? "text-ink" : "text-soft"}`}>
            {photo.caption?.trim() || "자막 없음"}
          </div>
          <div className="eyebrow mt-1.5">
            {EFFECTS.find((e) => e.value === photo.effect)?.label} · {photo.durationSec}초
          </div>
        </div>
        <button onClick={onToggleExpand} className="text-[11.5px] text-ink underline underline-offset-4 hover:text-gold">
          {isExpanded ? "접기" : "편집"}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-hair space-y-4">
          <div>
            <label className="label">순서</label>
            <div className="flex gap-5">
              <button
                onClick={() => onMove(-1)}
                disabled={isFirst}
                className="min-h-11 text-[12px] text-ink underline underline-offset-4 hover:text-gold disabled:opacity-30"
              >
                위로
              </button>
              <button
                onClick={() => onMove(1)}
                disabled={isLast}
                className="min-h-11 text-[12px] text-ink underline underline-offset-4 hover:text-gold disabled:opacity-30"
              >
                아래로
              </button>
            </div>
          </div>
          <div>
            <label className="label">자막</label>
            <input
              className="input text-[13px]"
              placeholder="자막 (선택)"
              value={photo.caption ?? ""}
              onChange={(e) => onUpdate({ caption: e.target.value })}
            />
          </div>
          <PhotoChips
            label="효과"
            value={photo.effect}
            options={EFFECTS}
            onChange={(v) => onUpdate({ effect: v })}
          />
          <PhotoChips
            label="필터"
            value={photo.filter}
            options={FILTERS}
            onChange={(v) => onUpdate({ filter: v })}
          />
          <PhotoChips
            label="전환"
            value={photo.transition}
            options={TRANSITIONS}
            onChange={(v) => onUpdate({ transition: v })}
          />
          <div>
            <label className="label">길이 · {photo.durationSec}초</label>
            <input
              type="range"
              min={2}
              max={10}
              step={0.5}
              value={photo.durationSec}
              onChange={(e) => onUpdate({ durationSec: Number(e.target.value) })}
              className="w-full accent-ink"
            />
          </div>
          {chapters.length > 0 && (
            <div>
              <label className="label">소속 챕터</label>
              <select
                className="input-boxed text-[13px]"
                value={photo.actId ?? ""}
                onChange={(e) => onUpdate({ actId: e.target.value || undefined })}
              >
                <option value="">미배정</option>
                {chapters.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button onClick={onRemove} className="text-[12px] text-gold underline underline-offset-4 hover:text-ink">
            이 사진 삭제
          </button>
        </div>
      )}
    </div>
  );
}

function PhotoChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-5 flex-wrap">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`tracking-wide ${value === o.value ? "seg-active" : "seg"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PhotoAdd({ onAdd, onError }: { onAdd: (urls: string[]) => void; onError: (message: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    setProgress(0);
    const out: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i], {
          maxWidth: 1280,
          maxHeight: 1280,
          quality: 0.82,
        });
        out.push(compressed);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      onAdd(out);
    } catch (e: any) {
      onError(e?.message ?? "일부 사진을 읽는 중 문제가 생겼어요. 파일 형식을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleUpload(e.target.files);
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-primary w-full text-sm disabled:opacity-50"
        >
          {uploading ? `압축 중… ${progress}%` : "내 사진 여러 장 추가"}
        </button>
        <p className="text-[12px] text-soft text-center mt-2 leading-relaxed">
          영상용 크기로 자동 정리해서 휴대폰에서도 덜 무겁게 보관합니다.
        </p>
      </div>

      <div className="pt-3 border-t border-line">
        <label className="label">또는 사진 주소(URL) 한 장 추가</label>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://...jpg"
          />
          <button
            className="btn-secondary text-sm"
            onClick={() => {
              if (url.trim()) {
                onAdd([url.trim()]);
                setUrl("");
              }
            }}
          >
            추가
          </button>
        </div>
      </div>

      <div className="pt-3 border-t border-line">
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
                  <span className="absolute top-1 right-1 bg-gold text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                    ✓
                  </span>
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

function formatWeddingDate(iso?: string): string {
  const d = parseISODateLocal(iso);
  if (!d) return "";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")} (${days[d.getDay()]})`;
}
