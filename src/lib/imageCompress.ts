// 클라이언트 사진 압축 — 모드 1 (localStorage) 에서도 진짜 사진 업로드 가능하게.
//
// 원칙:
//   - 사용자가 폰에서 찍은 4-12MB 원본을 200-400KB 정도로 줄여 base64로.
//   - localStorage 한도 5-10MB 안에서 청첩장 사진 약 10장이 들어가도록.
//   - 화질 유지 — 가로 1200px 기본, JPEG quality 0.85.

export type CompressOptions = {
  maxWidth?: number;     // 가로 최대 (기본 1200)
  maxHeight?: number;    // 세로 최대 (기본 1600)
  quality?: number;      // JPEG quality 0~1 (기본 0.85)
  mime?: string;         // 출력 MIME (기본 image/jpeg)
};

/**
 * File → base64 데이터 URL (자동 압축).
 * 결과는 `data:image/jpeg;base64,...` 형태로 그대로 <img src=> 에 쓸 수 있음.
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<string> {
  const canvas = await compressToCanvas(file, opts);
  const { quality = 0.85, mime = "image/jpeg" } = opts;
  return canvas.toDataURL(mime, quality);
}

/** Canvas 까지만 압축 — 이후 toBlob / toDataURL 선택 가능 */
async function compressToCanvas(file: File, opts: CompressOptions = {}): Promise<HTMLCanvasElement> {
  const {
    maxWidth = 1200,
    maxHeight = 1600,
  } = opts;

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  const wRatio = maxWidth / width;
  const hRatio = maxHeight / height;
  const ratio = Math.min(wRatio, hRatio, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context 못 만듦");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

/** File → Blob (압축된 jpeg/webp). IndexedDB 저장용. */
export async function compressToBlob(file: File, opts: CompressOptions = {}): Promise<Blob> {
  const canvas = await compressToCanvas(file, opts);
  const { quality = 0.85, mime = "image/jpeg" } = opts;
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Blob 변환 실패")), mime, quality);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지 디코딩 실패"));
    img.src = src;
  });
}

/** 추정 byte 크기 (base64) — 한도 점검용 */
export function dataUrlSize(dataUrl: string): number {
  // base64 길이의 약 0.75배가 실제 byte
  const i = dataUrl.indexOf(",");
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.floor(b64.length * 0.75);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
