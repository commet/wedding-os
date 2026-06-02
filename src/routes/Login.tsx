// /login — 간편(hosted) 모드의 로그인 + 복구.
//
// 상태:
//   email    — 미로그인 → 이메일 입력 → 매직링크 발송
//   sent     — 메일 확인 안내
//   link     — 로그인됨 + 이 기기에 청첩장 있음 → 암호문구 정해 계정에 연결(백업)
//   recover  — 로그인됨 + 이 기기엔 없음 + 계정엔 연결됨 → 암호문구로 복원
//   none     — 로그인됨 + 연결된 청첩장 없음 → 안내
//   linked   — 연결 완료
//
// 로그인은 식별·복구·안심용. 내용 키는 passphrase 로 감싼 blob 으로만 풀리므로 운영자는 못 읽는다.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { defaultData } from "../lib/schema";
import { localStorageDriver } from "../lib/storage";
import {
  getHostedConfig, getOrCreateOwnerToken, setHostedConfig, setOwnerToken, markOwner,
} from "../lib/security";
import {
  authAvailable, currentEmail, sendMagicLink, signInWithProvider, linkAccount, recoverAccount, hasLinkedAccount,
} from "../lib/auth";

type Phase = "init" | "email" | "sent" | "link" | "recover" | "none" | "linked" | "error";

export default function Login() {
  const [phase, setPhase] = useState<Phase>("init");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!authAvailable()) { setPhase("error"); return; }
      const em = await currentEmail(); // 매직링크 리다이렉트면 여기서 세션이 잡힘
      if (!em) { setPhase("email"); return; }
      setEmail(em);
      if (getHostedConfig()) { setPhase("link"); return; }
      setPhase((await hasLinkedAccount()) ? "recover" : "none");
    })();
  }, []);

  const send = async () => {
    if (!email.trim()) { setMsg("이메일을 입력해주세요."); return; }
    setBusy(true); setMsg("");
    const r = await sendMagicLink(email);
    setBusy(false);
    r.ok ? setPhase("sent") : setMsg(r.error ?? "전송에 실패했어요.");
  };

  const oauth = async (provider: "kakao" | "google") => {
    setBusy(true); setMsg("");
    const r = await signInWithProvider(provider); // 성공 시 페이지가 리다이렉트됨
    if (!r.ok) { setBusy(false); setMsg(r.error ?? "로그인에 실패했어요."); }
  };

  const doLink = async () => {
    if (pass.trim().length < 6) { setMsg("암호문구는 6자 이상으로 정해주세요."); return; }
    const cfg = getHostedConfig();
    if (!cfg) { setMsg("이 기기에 연결할 청첩장이 없어요."); return; }
    setBusy(true); setMsg("");
    const r = await linkAccount(
      { weddingId: cfg.weddingId, ownerToken: getOrCreateOwnerToken(), weddingKey: cfg.weddingKey },
      pass.trim(),
    );
    setBusy(false);
    r.ok ? setPhase("linked") : setMsg(r.error ?? "연결에 실패했어요.");
  };

  const doRecover = async () => {
    if (!pass.trim()) { setMsg("암호문구를 입력해주세요."); return; }
    setBusy(true); setMsg("");
    const r = await recoverAccount(pass.trim());
    if (!r.ok) { setBusy(false); setMsg(r.error); return; }
    // 새 기기 복구 — 시크릿 심고 새로고침으로 진입 (Recover 와 동일 패턴).
    setOwnerToken(r.bundle.ownerToken);
    setHostedConfig({ weddingId: r.bundle.weddingId, weddingKey: r.bundle.weddingKey });
    markOwner();
    await localStorageDriver.save({ ...defaultData(), preferences: { ...defaultData().preferences, mode: "hosted" } });
    window.history.replaceState(null, "", "/login");
    window.location.assign("/dashboard");
  };

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <div className="page max-w-app mx-auto pt-14 pb-16">
      <div className="eyebrow-gold mb-3">로그인</div>
      {children}
      {msg && <p className="text-[12px] text-gold mt-4 leading-relaxed">{msg}</p>}
    </div>
  );

  if (phase === "init") return <div className="min-h-screen flex items-center justify-center text-soft">확인 중…</div>;

  if (phase === "error") return (
    <Frame>
      <h1 className="font-serif text-[1.8rem] mb-3">로그인 준비 중</h1>
      <p className="text-[13px] text-soft leading-relaxed">아직 로그인이 설정되지 않았어요. <Link to="/" className="underline underline-offset-4 text-ink">처음으로 →</Link></p>
    </Frame>
  );

  if (phase === "email") return (
    <Frame>
      <h1 className="font-serif text-[1.9rem] leading-tight mb-3">로그인</h1>
      <p className="text-[13px] text-soft leading-relaxed mb-6">
        비밀번호 없이 — 카카오·구글 또는 이메일 링크로. 기기를 바꿔도 로그인으로 이어받아요.
      </p>
      <button onClick={() => oauth("kakao")} disabled={busy}
        className="w-full py-3.5 text-[13px] font-medium bg-[#FEE500] text-[#191600] active:opacity-80 transition disabled:opacity-50">
        카카오로 계속
      </button>
      <button onClick={() => oauth("google")} disabled={busy}
        className="w-full mt-3 py-3.5 text-[13px] border border-line text-ink hover:border-ink transition disabled:opacity-50">
        구글로 계속
      </button>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px bg-hair flex-1" />
        <span className="eyebrow">또는 이메일</span>
        <div className="h-px bg-hair flex-1" />
      </div>

      <input
        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com" autoComplete="email"
        className="input-boxed mb-4"
      />
      <button onClick={send} disabled={busy} className="btn-primary w-full py-3.5 text-[13px] disabled:opacity-50">
        {busy ? "보내는 중…" : "이메일 링크 받기 →"}
      </button>
    </Frame>
  );

  if (phase === "sent") return (
    <Frame>
      <h1 className="font-serif text-[1.9rem] leading-tight mb-3">메일을 확인하세요</h1>
      <p className="text-[13px] text-soft leading-relaxed">
        <b className="text-ink">{email}</b> 으로 로그인 링크를 보냈어요. 메일의 링크를 누르면 이 화면으로 돌아와 이어집니다.
        (안 오면 스팸함도 확인해주세요.)
      </p>
    </Frame>
  );

  if (phase === "link") return (
    <Frame>
      <h1 className="font-serif text-[1.9rem] leading-tight mb-3">암호문구 정하기</h1>
      <p className="text-[13px] text-soft leading-relaxed mb-5">
        <b className="text-ink">{email}</b> 에 이 청첩장을 연결해요. 새 기기에서 <b className="text-ink">로그인 + 암호문구</b>면 복구돼요.
        운영자는 암호문구를 몰라 내용을 못 봐요. <b className="text-gold">잊으면 이 방법으론 복구가 안 되니</b> 기억하기 쉬운 걸로.
      </p>
      <input
        type="password" value={pass} onChange={(e) => setPass(e.target.value)}
        placeholder="암호문구 (6자 이상)" autoComplete="new-password"
        className="input-boxed mb-4"
      />
      <button onClick={doLink} disabled={busy} className="btn-primary w-full py-3.5 text-[13px] disabled:opacity-50">
        {busy ? "연결 중…" : "계정에 연결 →"}
      </button>
    </Frame>
  );

  if (phase === "recover") return (
    <Frame>
      <h1 className="font-serif text-[1.9rem] leading-tight mb-3">암호문구 입력</h1>
      <p className="text-[13px] text-soft leading-relaxed mb-5">
        <b className="text-ink">{email}</b> 계정에 연결된 청첩장을 찾았어요. 연결할 때 정한 <b className="text-ink">암호문구</b>를 입력하면 그대로 이어받아요.
      </p>
      <input
        type="password" value={pass} onChange={(e) => setPass(e.target.value)}
        placeholder="암호문구" autoComplete="current-password"
        className="input-boxed mb-4"
      />
      <button onClick={doRecover} disabled={busy} className="btn-primary w-full py-3.5 text-[13px] disabled:opacity-50">
        {busy ? "복구 중…" : "복구하기 →"}
      </button>
    </Frame>
  );

  if (phase === "none") return (
    <Frame>
      <h1 className="font-serif text-[1.9rem] leading-tight mb-3">연결된 청첩장이 없어요</h1>
      <p className="text-[13px] text-soft leading-relaxed">
        <b className="text-ink">{email}</b> 에 연결된 청첩장이 아직 없어요. 기존 기기에서 [더보기 → 로그인 연결]을 먼저 해주세요.
        처음이라면 <Link to="/start-hosted" className="underline underline-offset-4 text-ink">간편 모드로 시작 →</Link>
      </p>
    </Frame>
  );

  // linked
  return (
    <Frame>
      <h1 className="font-serif text-[1.9rem] leading-tight mb-3">연결됐어요 ✓</h1>
      <p className="text-[13px] text-soft leading-relaxed mb-6">
        이제 기기를 바꿔도 <b className="text-ink">{email}</b> 로 로그인하고 암호문구를 넣으면 그대로 복구돼요.
      </p>
      <Link to="/dashboard" className="btn-primary inline-flex px-8 py-3.5 text-[13px]">대시보드로 →</Link>
    </Frame>
  );
}
