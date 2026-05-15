// 식전영상 export — 브라우저에서 진짜 영상 파일로.
//
// 방법: `getDisplayMedia` 로 사용자가 현재 탭을 선택 → `MediaRecorder` 로 녹화 → WebM 파일.
// 한계:
//   - iOS Safari 는 `getDisplayMedia` 미지원 → 대신 OS 화면 녹화 가이드로 fallback.
//   - WebM 출력 (대부분 결혼식장은 MP4 받지만, VLC·QuickTime 등은 WebM 재생 가능;
//     고화질 MP4 가 꼭 필요하면 `npx remotion render` 안내).

export function canAutoRecord(): boolean {
  if (typeof navigator === "undefined") return false;
  return !!(navigator.mediaDevices && (navigator.mediaDevices as any).getDisplayMedia);
}

export type RecordOptions = {
  durationMs: number;
  fps?: number;
  onProgress?: (sec: number, totalSec: number) => void;
};

/** 사용자에게 화면 선택을 요청하고, 지정한 시간 동안 녹화. WebM Blob 반환. */
export async function recordCurrentTab(opts: RecordOptions): Promise<Blob> {
  const { durationMs, fps = 30, onProgress } = opts;
  if (!canAutoRecord()) throw new Error("이 브라우저는 자동 녹화를 지원하지 않아요. 화면 녹화 가이드를 따라주세요.");

  // 사용자 제스처에서 호출되어야 함 (button click 안에서).
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: fps } as MediaTrackConstraints,
    audio: true, // BGM 도 같이 캡처되도록 (사용자가 "탭 오디오 공유" 체크해야 함)
  });

  // 코덱 선택 — vp9 > vp8 순으로 시도, 마지막 webm
  const candidates = [
    "video/webm; codecs=vp9,opus",
    "video/webm; codecs=vp8,opus",
    "video/webm; codecs=vp9",
    "video/webm",
  ];
  const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const totalSec = Math.ceil(durationMs / 1000);
  let progressTimer: number | undefined;

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      if (progressTimer) clearInterval(progressTimer);
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
    };
    recorder.onerror = (e: any) => {
      stream.getTracks().forEach((t) => t.stop());
      reject(e?.error ?? new Error("녹화 실패"));
    };

    // 사용자가 직접 화면 공유를 중단하면 stop
    const [vt] = stream.getVideoTracks();
    if (vt) vt.onended = () => { try { recorder.stop(); } catch {} };

    recorder.start(100);
    const startTime = Date.now();
    if (onProgress) {
      progressTimer = window.setInterval(() => {
        const elapsedSec = Math.min(totalSec, Math.round((Date.now() - startTime) / 1000));
        onProgress(elapsedSec, totalSec);
      }, 500);
    }
    setTimeout(() => { try { recorder.stop(); } catch {} }, durationMs);
  });
}

/** Blob 다운로드 트리거 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
