// 식전영상 Remotion 컴포지션.
// letter-editor를 참고하되, wedding-specific 하드코딩 없이 깔끔하게 재구성.
// 씬: Act 타이틀 카드 → 사진(Ken Burns + 캡션 + 필터) → 엔딩.

import {
  AbsoluteFill,
  Sequence,
  Audio,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import type {
  VideoConfig,
  VideoPhoto,
  VideoAct,
  VideoEffect,
  VideoFilter,
} from "../lib/schema";

export const VIDEO_W = 1920;
export const VIDEO_H = 1080;
export const VIDEO_FPS = 30;

const VIDEO_FILTER_CSS: Record<VideoFilter, string> = {
  none: "none",
  warm: "saturate(1.25) brightness(1.05) sepia(0.12)",
  cool: "saturate(0.95) brightness(1.05) hue-rotate(12deg)",
  bw: "grayscale(1) contrast(1.05)",
  sepia: "sepia(0.7) saturate(1.2)",
  vintage: "sepia(0.32) contrast(1.1) brightness(0.96) saturate(0.85)",
};

function kenBurns(effect: VideoEffect, t: number): string {
  const z = 0.09; // 줌 진폭
  const p = 6;    // 팬 진폭 (%)
  switch (effect) {
    case "kenBurnsIn": return `scale(${1.02 + z * t})`;
    case "kenBurnsOut": return `scale(${1.02 + z - z * t})`;
    case "panLeft": return `scale(1.12) translateX(${-p * t}%)`;
    case "panRight": return `scale(1.12) translateX(${-p + p * t}%)`;
    case "static": return "scale(1.04)";
  }
}

type Scene =
  | { kind: "title"; act: VideoAct; frames: number }
  | { kind: "photo"; photo: VideoPhoto; frames: number }
  | { kind: "ending"; frames: number };

export function buildScenes(config: VideoConfig): { scenes: Scene[]; total: number; fps: number } {
  const fps = config.fps ?? VIDEO_FPS;
  const titleFrames = Math.round((config.titleCardSec ?? 3) * fps);
  const endingFrames = Math.round((config.endingSec ?? 5) * fps);
  const scenes: Scene[] = [];
  let lastActId: string | null = null;

  for (const photo of config.photos) {
    if (photo.actId && photo.actId !== lastActId) {
      const act = config.acts.find((a) => a.id === photo.actId);
      if (act) scenes.push({ kind: "title", act, frames: titleFrames });
      lastActId = photo.actId;
    }
    scenes.push({
      kind: "photo",
      photo,
      frames: Math.max(15, Math.round((photo.durationSec || 4) * fps)),
    });
  }
  if (config.ending && config.photos.length > 0) {
    scenes.push({ kind: "ending", frames: endingFrames });
  }

  const total = scenes.reduce((n, s) => n + s.frames, 0);
  return { scenes, total: Math.max(total, 30), fps };
}

// ── 씬 컴포넌트 ──────────────────────────────

const PhotoScene: React.FC<{ photo: VideoPhoto }> = ({ photo }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = durationInFrames > 0 ? frame / durationInFrames : 0;

  const fade = Math.min(12, Math.floor(durationInFrames / 5));
  const opacity =
    photo.transition === "none"
      ? 1
      : interpolate(
          frame,
          [0, fade, durationInFrames - fade, durationInFrames],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

  const slideX =
    photo.transition === "slide"
      ? interpolate(frame, [0, fade], [60, 0], { extrapolateRight: "clamp" })
      : 0;

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#1a1510" }}>
      <AbsoluteFill
        style={{
          transform: `${kenBurns(photo.effect, t)} translateX(${slideX}px)`,
          filter: VIDEO_FILTER_CSS[photo.filter],
        }}
      >
        <Img
          src={photo.url}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      {photo.caption && <Caption text={photo.caption} />}
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lift = interpolate(frame, [6, 22], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div
        style={{
          background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
          padding: "140px 80px 70px",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: 44,
            lineHeight: 1.45,
            textAlign: "center",
            fontFamily: "'Noto Serif KR', serif",
            opacity,
            transform: `translateY(${lift}px)`,
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
            whiteSpace: "pre-line",
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TitleScene: React.FC<{ act: VideoAct }> = ({ act }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, 14, durationInFrames - 14, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const lift = interpolate(frame, [0, 20], [14, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f5ecd7",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div style={{ textAlign: "center", transform: `translateY(${lift}px)` }}>
        {act.subtitle && (
          <div
            style={{
              fontSize: 30,
              color: "#a88848",
              letterSpacing: 6,
              marginBottom: 22,
            }}
          >
            {act.subtitle}
          </div>
        )}
        <div
          style={{
            fontSize: 78,
            color: "#1a1510",
            fontFamily: "'Noto Serif KR', serif",
            fontWeight: 600,
          }}
        >
          {act.title}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const EndingScene: React.FC<{ message: string; date?: string; names?: string }> = ({
  message,
  date,
  names,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, 24, durationInFrames - 18, durationInFrames],
    [0, 1, 1, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f5ecd7",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div style={{ textAlign: "center", padding: "0 120px" }}>
        {names && (
          <div
            style={{
              fontSize: 88,
              color: "#1a1510",
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 700,
              marginBottom: 28,
            }}
          >
            {names}
          </div>
        )}
        {date && (
          <div style={{ fontSize: 34, color: "#a88848", marginBottom: 36 }}>{date}</div>
        )}
        <div
          style={{
            fontSize: 40,
            color: "#1a1510",
            fontFamily: "'Noto Serif KR', serif",
            lineHeight: 1.6,
            whiteSpace: "pre-line",
          }}
        >
          {message}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const EmptyScene: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: "#1a1510",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <div style={{ color: "#a88848", fontSize: 40, fontFamily: "serif" }}>
      사진을 추가하면 영상이 만들어져요
    </div>
  </AbsoluteFill>
);

// ── 메인 컴포지션 ────────────────────────────

export const WeddingVideo: React.FC<{ config: VideoConfig; coupleNames?: string }> = ({
  config,
  coupleNames,
}) => {
  const { scenes } = buildScenes(config);

  if (scenes.length === 0) {
    return <EmptyScene />;
  }

  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1510" }}>
      {scenes.map((scene, i) => {
        const from = cursor;
        cursor += scene.frames;
        return (
          <Sequence key={i} from={from} durationInFrames={scene.frames}>
            {scene.kind === "title" && <TitleScene act={scene.act} />}
            {scene.kind === "photo" && <PhotoScene photo={scene.photo} />}
            {scene.kind === "ending" && (
              <EndingScene
                message={config.ending?.message ?? ""}
                date={config.ending?.date}
                names={coupleNames}
              />
            )}
          </Sequence>
        );
      })}
      {config.bgmUrl && <Audio src={config.bgmUrl} volume={0.8} />}
    </AbsoluteFill>
  );
};
