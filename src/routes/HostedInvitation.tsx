// 호스팅 발행 청첩장 — 게스트가 /i/<code> 로 여는 화면.
// 코드는 URL 경로에서, 복호화 키는 URL '#' 프래그먼트에서 읽는다.
// '#' 는 서버로 전송되지 않으므로 운영자는 키도 청첩장 내용도 알 수 없다.

import { useEffect, useState } from "react";
import type { InvitationContent } from "../lib/schema";
import { openHostedInvitation, submitHostedRsvp } from "../lib/inviteHosting";
import { Preview, RsvpModal } from "./Invitation";

type State =
  | { phase: "loading" }
  | { phase: "error"; reason: string }
  | { phase: "ready"; invitation: InvitationContent };

export default function HostedInvitation() {
  const code = window.location.pathname.split("/")[2] ?? "";
  const fragment = (() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    return { keyRaw: params.get("k") ?? "", rsvpToken: params.get("r") ?? "" };
  })();
  const { keyRaw, rsvpToken } = fragment;

  const [state, setState] = useState<State>({ phase: "loading" });
  const [showRsvp, setShowRsvp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code || !keyRaw) {
        setState({
          phase: "error",
          reason: "청첩장 링크가 올바르지 않아요. 받은 링크 전체를 다시 열어주세요.",
        });
        return;
      }
      const r = await openHostedInvitation(code, keyRaw);
      if (cancelled) return;
      setState(
        r.ok
          ? { phase: "ready", invitation: r.invitation }
          : { phase: "error", reason: r.reason },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [code, keyRaw]);

  if (state.phase === "loading") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-soft text-[13px]">
        청첩장을 여는 중…
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <div className="eyebrow-gold mb-4">Wedding · Invitation</div>
          <h1 className="font-serif text-[1.75rem] text-ink leading-tight mb-3">
            청첩장을 열 수 없어요
          </h1>
          <p className="text-[13px] text-soft leading-relaxed">{state.reason}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-app mx-auto bg-paper min-h-screen">
      <Preview
        inv={state.invitation}
        locale="ko"
        rsvpEnabled={!!rsvpToken}
        onRsvpClick={() => setShowRsvp(true)}
        hideShareBox
      />
      {showRsvp && (
        <RsvpModal
          locale="ko"
          onClose={() => setShowRsvp(false)}
          onSubmit={(input) => submitHostedRsvp(code, keyRaw, rsvpToken, input)}
        />
      )}
    </div>
  );
}
