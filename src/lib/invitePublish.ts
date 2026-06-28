// 발행(Publish) — 로컬 모드 사용자가 운영자 호스팅으로 청첩장 링크를 만들 때.
//
// ── 데이터 분류 안전 경계 ──
// 이 모듈은 오직 data.invitation 만 읽는다. budget·guests·checklist·video 등
// 준비 데이터에는 절대 접근하지 않는다 — 발행되는 건 청첩장 본문뿐이다.
// 청첩장 본문 전체(전화·계좌 포함)는 암호화되어 올라가므로 운영자는 못 읽는다.
// 단 ogMeta(이름·날짜)만 평문 — 카톡 링크 미리보기용, 가장 덜 민감한 조각.

import type { WeddingData, InvitationContent } from "./schema";
import { idbToDataUrl, isIdbUrl } from "./imageStore";
import {
  generateInviteKey,
  importInviteKey,
  encryptJSON,
  decryptJSON,
  type Bytes,
} from "./inviteCrypto";

/** 운영자에게 평문으로 가는 최소 메타 — 카톡 링크 미리보기(OG)용. */
export type PublishOgMeta = {
  groomName: string;
  brideName: string;
  date: string;
};

/** 암호화된 발행 봉투 — 업로드 직전 형태. */
export type SealedInvitation = {
  ogMeta: PublishOgMeta;
  /** 암호화된 InvitationContent (사진 인라인 포함) — 운영자엔 불투명 바이트 */
  ciphertext: Bytes;
  /** 공유 링크 '#' 에 들어갈 키 — 서버로는 절대 전송하지 않는다 */
  keyRaw: string;
  /** 원본을 못 찾아 발행에서 빠진 사진 수 */
  droppedPhotos: number;
  /** 사용자가 링크 미리보기 대표사진을 켰는지 */
  previewImageRequested: boolean;
  /** OG 카드용 공개 축소본. 본문 사진과 별도로 서버에 공개 저장된다. */
  previewImageBlob?: Blob;
};

const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PREVIEW_IMAGE_BYTES = 1024 * 1024;

async function readImageWithLimit(response: Response): Promise<Blob> {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) throw new Error("invalid image type");
  const declaredSize = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredSize) && declaredSize > MAX_REMOTE_IMAGE_BYTES) throw new Error("image too large");
  if (!response.body) throw new Error("empty image response");

  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REMOTE_IMAGE_BYTES) throw new Error("image too large");
      chunks.push(new Uint8Array(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  return new Blob(chunks, { type: contentType });
}

// idb: 사진을 self-contained data URL 로 인라인. data:/https: 는 그대로 둔다.
async function inlinePhoto(
  url: string | undefined,
  onDrop: () => void,
): Promise<string | undefined> {
  if (!url) return undefined;
  if (!isIdbUrl(url) && !/^https?:\/\//i.test(url)) return url;
  let dataUrl: string | null = null;
  if (isIdbUrl(url)) {
    dataUrl = await idbToDataUrl(url);
  } else {
    try {
      const response = await fetch(url, { referrerPolicy: "no-referrer", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("image fetch failed");
      const blob = await readImageWithLimit(response);
      dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch { dataUrl = null; }
  }
  if (!dataUrl) {
    onDrop();
    return undefined;
  }
  return dataUrl;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return blob.type.startsWith("image/") ? blob : null;
  } catch {
    return null;
  }
}

async function readSourceImageBlob(url: string | undefined): Promise<Blob | null> {
  if (!url) return null;
  if (isIdbUrl(url)) {
    const dataUrl = await idbToDataUrl(url);
    return dataUrl ? dataUrlToBlob(dataUrl) : null;
  }
  if (url.startsWith("data:")) return dataUrlToBlob(url);
  if (/^https?:\/\//i.test(url)) {
    try {
      const response = await fetch(url, { referrerPolicy: "no-referrer", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("image fetch failed");
      return await readImageWithLimit(response);
    } catch {
      return null;
    }
  }
  return null;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지 디코딩 실패"));
    img.src = src;
  });
}

async function makePreviewImageBlob(url: string | undefined): Promise<Blob | undefined> {
  if (typeof document === "undefined" || typeof URL === "undefined") return undefined;
  const source = await readSourceImageBlob(url);
  if (!source) return undefined;

  const objectUrl = URL.createObjectURL(source);
  try {
    const img = await loadImageElement(objectUrl);
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    if (!naturalWidth || !naturalHeight) return undefined;

    const maxSide = 900;
    const ratio = Math.min(maxSide / naturalWidth, maxSide / naturalHeight, 1);
    const width = Math.max(1, Math.round(naturalWidth * ratio));
    const height = Math.max(1, Math.round(naturalHeight * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size > MAX_PREVIEW_IMAGE_BYTES) return undefined;
    return blob;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** WeddingData → 발행 가능한 청첩장 본문(사진 인라인) + OG 메타.
 *  data.invitation 외에는 아무것도 읽지 않는다 — 이것이 발행 안전 경계다. */
export async function buildPublishInvitation(data: WeddingData): Promise<{
  ogMeta: PublishOgMeta;
  invitation: InvitationContent;
  droppedPhotos: number;
  previewImageRequested: boolean;
  previewImageBlob?: Blob;
}> {
  const inv = data.invitation;
  let dropped = 0;
  const drop = () => { dropped++; };

  const previewImageRequested = !!inv.previewImageEnabled;
  const previewImageBlob = previewImageRequested
    ? await makePreviewImageBlob(inv.heroImageUrl)
    : undefined;
  const heroImageUrl = await inlinePhoto(inv.heroImageUrl, drop);

  let gallery: InvitationContent["gallery"];
  if (Array.isArray(inv.gallery)) {
    gallery = [];
    for (const g of inv.gallery) {
      const u = await inlinePhoto(g.url, drop);
      if (u) gallery.push({ url: u, caption: g.caption });
    }
  }

  const invitation: InvitationContent = {
    ...inv,
    heroImageUrl,
    // 외부 음원은 하객 IP를 제3자에게 노출할 수 있어 hosted 발행본에는 포함하지 않는다.
    bgmUrl: inv.bgmUrl && !/^https?:\/\//i.test(inv.bgmUrl) ? inv.bgmUrl : undefined,
    ...(gallery ? { gallery } : {}),
  };

  return {
    ogMeta: { groomName: inv.groomName, brideName: inv.brideName, date: inv.date },
    invitation,
    droppedPhotos: dropped,
    previewImageRequested,
    previewImageBlob,
  };
}

/** 발행 봉투 만들기 — 네트워크 없음, 순수 변환.
 *  existingKeyRaw 를 주면 재발행(키·링크 유지), 없으면 새 키 생성. */
export async function sealInvitation(
  data: WeddingData,
  existingKeyRaw?: string,
): Promise<SealedInvitation> {
  const { ogMeta, invitation, droppedPhotos, previewImageRequested, previewImageBlob } = await buildPublishInvitation(data);
  let key: CryptoKey;
  let keyRaw: string;
  if (existingKeyRaw) {
    key = await importInviteKey(existingKeyRaw);
    keyRaw = existingKeyRaw;
  } else {
    const generated = await generateInviteKey();
    key = generated.key;
    keyRaw = generated.raw;
  }
  const ciphertext = await encryptJSON(invitation, key);
  return { ogMeta, ciphertext, keyRaw, droppedPhotos, previewImageRequested, previewImageBlob };
}

/** 게스트 측 — 암호문 + 링크 '#' 의 키 → 청첩장 본문.
 *  키가 틀리거나 암호문이 손상되면 throw 한다 (호출부에서 안내 처리). */
export async function openInvitation(
  ciphertext: Bytes,
  keyRaw: string,
): Promise<InvitationContent> {
  const key = await importInviteKey(keyRaw);
  return decryptJSON<InvitationContent>(ciphertext, key);
}
