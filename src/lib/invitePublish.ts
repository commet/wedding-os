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
};

// idb: 사진을 self-contained data URL 로 인라인. data:/https: 는 그대로 둔다.
async function inlinePhoto(
  url: string | undefined,
  onDrop: () => void,
): Promise<string | undefined> {
  if (!url) return undefined;
  if (!isIdbUrl(url)) return url;
  const dataUrl = await idbToDataUrl(url);
  if (!dataUrl) {
    onDrop();
    return undefined;
  }
  return dataUrl;
}

/** WeddingData → 발행 가능한 청첩장 본문(사진 인라인) + OG 메타.
 *  data.invitation 외에는 아무것도 읽지 않는다 — 이것이 발행 안전 경계다. */
export async function buildPublishInvitation(data: WeddingData): Promise<{
  ogMeta: PublishOgMeta;
  invitation: InvitationContent;
  droppedPhotos: number;
}> {
  const inv = data.invitation;
  let dropped = 0;
  const drop = () => { dropped++; };

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
    ...(gallery ? { gallery } : {}),
  };

  return {
    ogMeta: { groomName: inv.groomName, brideName: inv.brideName, date: inv.date },
    invitation,
    droppedPhotos: dropped,
  };
}

/** 발행 봉투 만들기 — 네트워크 없음, 순수 변환.
 *  existingKeyRaw 를 주면 재발행(키·링크 유지), 없으면 새 키 생성. */
export async function sealInvitation(
  data: WeddingData,
  existingKeyRaw?: string,
): Promise<SealedInvitation> {
  const { ogMeta, invitation, droppedPhotos } = await buildPublishInvitation(data);
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
  return { ogMeta, ciphertext, keyRaw, droppedPhotos };
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
