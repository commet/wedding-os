// 발행 클라이언트 — 운영자 호스팅 API(api/invite-*.ts)를 호출한다.
//
// 발행: sealInvitation 으로 봉투를 만들어 암호문만 업로드. 키(keyRaw)는 링크 '#' 에만.
// 열람: 코드로 암호문을 받아 내려받고, 링크 '#' 의 키로 복호화.

import type { WeddingData, InvitationContent } from "./schema";
import { sealInvitation, openInvitation } from "./invitePublish";
import { importInviteKey, encryptJSON, decryptJSON } from "./inviteCrypto";
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

const UNPUBLISH_ENDPOINT = "/api/invite-unpublish";

/** 발행 취소 — 운영자 서버에서 청첩장 암호문·메타·RSVP 를 모두 삭제한다.
 *  ownerToken 으로 권한 검증(헤더로 전송 — 로그에 안 남도록). 발행한 본인만 내릴 수 있다. */
export async function unpublishInvitation(
  code: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${UNPUBLISH_ENDPOINT}?code=${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "x-owner-token": getOrCreateOwnerToken() },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, reason: body?.error ?? `발행 취소에 실패했어요 (${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "발행 취소 중 오류가 났어요." };
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

/* ──────────── RSVP (종단간 암호화) ──────────── */

const RSVP_ENDPOINT = "/api/invite-rsvp";

export type HostedRsvpInput = {
  name: string;
  attending: boolean;
  side?: "groom" | "bride";
  guests?: number;
  meal?: string;
  message?: string;
};
export type HostedRsvp = HostedRsvpInput & { submittedAt: string };

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 게스트 측 — RSVP 를 청첩장과 같은 키로 암호화해 제출. 운영자는 못 읽는다. */
export async function submitHostedRsvp(
  code: string,
  keyRaw: string,
  input: HostedRsvpInput,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const key = await importInviteKey(keyRaw);
    const rsvp: HostedRsvp = { ...input, submittedAt: new Date().toISOString() };
    const ciphertext = await encryptJSON(rsvp, key);
    const res = await fetch(`${RSVP_ENDPOINT}?code=${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: ciphertext,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, reason: body?.error ?? "응답 전송에 실패했어요." };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "응답을 보내는 중 오류가 났어요." };
  }
}

/** 오너 측 — 받은 RSVP 를 가져와 키로 복호화. ownerToken 으로 권한 검증된다.
 *  토큰은 쿼리스트링이 아니라 헤더로 보낸다 — 쿼리는 서버 액세스 로그에 평문으로 남기 때문. */
export async function fetchHostedRsvps(
  code: string,
  keyRaw: string,
): Promise<{ ok: true; rsvps: HostedRsvp[] } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${RSVP_ENDPOINT}?code=${encodeURIComponent(code)}`, {
      headers: { "x-owner-token": getOrCreateOwnerToken() },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(body?.rsvps)) {
      return { ok: false, reason: body?.error ?? "RSVP 를 불러오지 못했어요." };
    }
    const key = await importInviteKey(keyRaw);
    const rsvps: HostedRsvp[] = [];
    for (const b64 of body.rsvps as string[]) {
      try {
        rsvps.push(await decryptJSON<HostedRsvp>(base64ToBytes(b64), key));
      } catch {
        /* 손상된 항목은 건너뜀 */
      }
    }
    rsvps.sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
    return { ok: true, rsvps };
  } catch {
    return { ok: false, reason: "RSVP 를 불러오는 중 오류가 났어요." };
  }
}
