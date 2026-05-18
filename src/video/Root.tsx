// Remotion CLI 진입점 — `npx remotion render` / `npx remotion studio` 가 이 파일을 통해
// 영상 컴포지션을 찾는다. 브라우저 미리보기(@remotion/player)와는 별개의 경로다.

import { Composition } from "remotion";
import { WeddingVideo, buildScenes, VIDEO_W, VIDEO_H, VIDEO_FPS } from "./WeddingVideo";
import { normalizeVideo, type VideoConfig } from "../lib/schema";

const DEFAULT_CONFIG = normalizeVideo(undefined);

type WeddingVideoProps = { config: VideoConfig; coupleNames?: string };

export const RemotionRoot = () => {
  return (
    <Composition
      id="WeddingVideo"
      component={WeddingVideo}
      width={VIDEO_W}
      height={VIDEO_H}
      fps={VIDEO_FPS}
      durationInFrames={Math.max(60, buildScenes(DEFAULT_CONFIG).total)}
      defaultProps={{
        config: DEFAULT_CONFIG,
        coupleNames: "신랑 · 신부",
      }}
      // 사용자가 --props 로 넘긴 영상 설정에 맞춰 실제 길이를 계산
      calculateMetadata={({ props }: { props: WeddingVideoProps }) => {
        const cfg = normalizeVideo(props.config);
        const { total, fps } = buildScenes(cfg);
        return {
          durationInFrames: Math.max(60, total),
          fps,
          props: { ...props, config: cfg },
        };
      }}
    />
  );
};
