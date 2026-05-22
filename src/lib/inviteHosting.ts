// 발행 클라이언트 — 운영자 호스팅 API(api/invite-*.ts)를 호출한다.
//
// 발행: sealInvitation 으로 봉투를 만들어 암호문만 업로드. 키(keyRaw)는 링크 '#' 에만.
// 열람: 코드로 암호문을 받아 내려받고, 링크 '#' 의 키로 복호화.

import type { WeddingData, InvitationContent } from "./schema";
import { sealInvitation, openInvitation } from "./invitePublish";
import { getOrCreateOwnerToken } from "./security";

const PUBLISH_ENDPOINT = "/api/invite-publish";
const PAYLOAD_ENDPOINT = "/api/invite-payload";

export type PublishResult =
  | { ok: true; code: string; keyRaw: string; link: string; droppedPhotos: number }
  | { ok: false; reason: string };

export type OpenResult =
  | { ok: true; invitation: InvitationContent }
  | { ok: false; reason: string };

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 청첩장 발행/재발행. existing 을 주면 같은 코드·키로 갱신(링크 유지). */
export async function publishInvitation(
  data: WeddingData,
  existing?: { code: string; keyRaw: string },
): Promise<PublishResult> {
  try {
    const sealed = await sealInvitation(data, existing?.keyRaw);
    const meta = {
      ogMeta: sealed.ogMeta,
      ownerToken: getOrCreateOwnerToken(),
      ...(existing?.code ? { code: existing.code } : {}),
    };
    const res = await fetch(`${PUBLISH_ENDPOINT}?meta=${toBase64Url(JSON.stringify(meta))}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: sealed.ciphertext,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || typeof body?.code !== "string") {
      return { ok: false, reason: body?.error ?? `발행에 실패했어요 (${res.status}).` };
    }
    const code: string = body.code;
    const link = `${location.origin}/i/${code}#k=${sealed.keyRaw}`;
    return { ok: true, code, keyRaw: sealed.keyRaw, link, droppedPhotos: sealed.droppedPhotos };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "발행 중 오류가 났어요." };
  }
}

/** 게스트 측 — 코드 + 링크 '#' 의 키로 호스팅된 청첩장 열기. */
export async function openHostedInvitation(code: string, keyRaw: string): Promise<OpenResult> {
  try {
    const res = await fetch(`${PAYLOAD_ENDPOINT}?code=${encodeURIComponent(code)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, reason: body?.error ?? "청첩장을 불러오지 못했어요." };
    }
    const ciphertext = new Uint8Array(await res.arrayBuffer());
    const invitation = await openInvitation(ciphertext, keyRaw);
    return { ok: true, invitation };
  } catch {
    return { ok: false, reason: "청첩장을 여는 데 실패했어요. 링크가 올바른지 확인해주세요." };
  }
}
