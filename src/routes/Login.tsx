// /login — 간편(hosted) 모드의 로그인 + 복구.
//
// 상태:
//   email    — 미로그인 → 이메일 입력 → 매직링크 발송
//   sent     — 메일 확인 안내
//   link     — 로그인됨 + 이 기기에 청첩장 있음 → 복구 비밀번호 정해 계정에 연결(백업)
//   recover  — 로그인됨 + 이 기기엔 없음 + 계정엔 연결됨 → 복구 비밀번호로 복원
//   none     — 로그인됨 + 연결된 청첩장 없음 → 안내
//   linked   — 연결 완료
//
// 로그인은 식별·복구·안심용. 내용 키는 passphrase 로 감싼 blob 으로만 풀리므로 운영자는 못 읽는다.

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { koBreak } from "../lib/typography";
import { clearLocalDeviceData, localStorageDriver } from "../lib/storage";
import { createHostedStorage } from "../lib/storage.hosted";
import {
  getHostedConfig, getOrCreateOwnerToken, hostedUserMatches, setHostedRecoveryCredentials,
} from "../lib/security";
import {
  authAvailable, currentEmail, currentUserId, sendMagicLink, signInWithProvider, linkAccount,
  recoverAccount, hasLinkedAccount, signOut,
} from "../lib/auth";
import { validateRecoveryPassphrase } from "../lib/account";

type Phase = "init" | "email" | "sent" | "link" | "recover" | "none" | "linked" | "foreign" | "error";
type LoginStep = { label: string; detail?: string; done?: boolean };

export default function Login() {
  const returnTo = (() => {
    const value = new URLSearchParams(window.location.search).get("next");
    return value === "/start-hosted" ? value : undefined;
  })();
  const [phase, setPhase] = useState<Phase>("init");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [existingLink, setExistingLink] = useState(false);
  const [allowReplace, setAllowReplace] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!authAvailable()) { setPhase("error"); return; }
      const em = await currentEmail(); // 매직링크 리다이렉트면 여기서 세션이 잡힘
      if (!em) { setPhase("email"); return; }
      const userId = await currentUserId();
      if (!userId) { setPhase("email"); return; }
      if (getHostedConfig() && !hostedUserMatches(userId)) { setEmail(em); setPhase("foreign"); return; }
      if (returnTo) { window.location.replace(returnTo); return; }
      setEmail(em);
      if (getHostedConfig()) {
        setExistingLink(await hasLinkedAccount());
        setPhase("link");
        return;
      }
      setPhase((await hasLinkedAccount()) ? "recover" : "none");
    })();
  }, []);

  const send = async () => {
    if (!email.trim()) { setMsg("이메일을 입력해주세요."); return; }
    setBusy(true); setMsg("");
    const r = await sendMagicLink(email, returnTo);
    setBusy(false);
    r.ok ? setPhase("sent") : setMsg(r.error ?? "전송에 실패했어요.");
  };

  const oauth = async (provider: "kakao" | "google") => {
    setBusy(true); setMsg("");
    const r = await signInWithProvider(provider, returnTo); // 성공 시 페이지가 리다이렉트됨
    if (!r.ok) { setBusy(false); setMsg(r.error ?? "로그인에 실패했어요."); }
  };

  const doLink = async () => {
    const passphraseError = validateRecoveryPassphrase(pass);
    if (passphraseError) { setMsg(passphraseError); return; }
    if (existingLink && !allowReplace) { setMsg("기존 복구 연결을 교체한다는 확인이 필요합니다."); return; }
    const cfg = getHostedConfig();
    if (!cfg) { setMsg("이 기기에 연결할 청첩장이 없어요."); return; }
    setBusy(true); setMsg("");
    const r = await linkAccount(
      { weddingId: cfg.weddingId, ownerToken: getOrCreateOwnerToken(), weddingKey: cfg.weddingKey },
      pass.trim(),
      { replaceExisting: allowReplace },
    );
    setBusy(false);
    r.ok ? setPhase("linked") : setMsg(r.error ?? "연결에 실패했어요.");
  };

  const doRecover = async () => {
    if (!pass.trim()) { setMsg("복구 비밀번호를 입력해주세요."); return; }
    setBusy(true); setMsg("");
    const r = await recoverAccount(pass.trim());
    if (!r.ok) { setBusy(false); setMsg(r.error); return; }
    const userId = await currentUserId();
    if (!userId) { setBusy(false); setMsg("로그인 세션이 만료되었습니다. 다시 로그인해주세요."); return; }
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url || !anonKey) { setBusy(false); setMsg("온라인 저장소 설정이 없습니다."); return; }

    const remote = await createHostedStorage(
      url, anonKey, r.bundle.weddingId, r.bundle.weddingKey, r.bundle.ownerToken,
    ).load();
    if (!remote) { setBusy(false); setMsg("연결된 데이터를 확인하지 못했어요. 기존 데이터는 그대로 유지했습니다."); return; }
    const restored = {
      ...remote.data,
      preferences: { ...remote.data.preferences, mode: "hosted" as const, isDemo: false },
    };
    const previous = await localStorageDriver.load();
    const saved = await localStorageDriver.save(restored);
    if (!saved.ok) { setBusy(false); setMsg("이 기기에 복구 데이터를 저장하지 못했어요. 기존 데이터는 그대로 유지했습니다."); return; }

    if (!setHostedRecoveryCredentials(
      { weddingId: r.bundle.weddingId, weddingKey: r.bundle.weddingKey },
      r.bundle.ownerToken,
      userId,
    )) {
      if (previous) await localStorageDriver.save(previous.data);
      else await clearLocalDeviceData().catch(() => undefined);
      setBusy(false);
      setMsg(previous ? "복구 권한을 저장하지 못했어요. 기존 데이터는 복원했습니다." : "복구 권한을 저장하지 못했어요. 이 기기에 남은 복구 흔적은 정리했습니다.");
      return;
    }
    window.history.replaceState(null, "", "/login");
    window.location.assign("/dashboard");
  };

  if (phase === "init") return (
    <div className="agent-canvas min-h-screen max-w-app mx-auto px-6 pt-12 pb-16">
      <div className="font-serif text-[20px] text-ink">Dearie</div>
      <p className="mt-4 text-[13px] text-soft leading-relaxed">로그인 상태를 확인하는 중이에요.</p>
    </div>
  );

  if (phase === "error") return (
    <Frame
      phase={phase}
      title="로그인 준비를 확인 중이에요"
      summary="아직 온라인 로그인 설정이 열리지 않았어요. 입력해둔 준비 내용은 이 기기에 그대로 남아 있습니다."
      msg={msg}
      steps={[
        { label: "현재 기기 데이터 유지", detail: "로그인 준비 여부만 확인하고 내용을 열지 않습니다.", done: true },
        { label: "설정이 열리면 계정으로 복구 연결", detail: "그 전까지는 복구 링크나 로컬 저장으로 계속 쓸 수 있어요." },
      ]}
    >
      <Link to="/" className="btn-primary w-full py-3.5 text-[13px]">처음으로 돌아가기</Link>
    </Frame>
  );

  if (phase === "email") return (
    <Frame
      phase={phase}
      title="신원 확인만 먼저 할게요"
      summary="청첩장 내용을 여는 단계가 아니에요. 기기를 바꾸거나 배우자와 함께 쓸 때 같은 사람인지 확인하는 단계입니다."
      msg={msg}
      steps={[
        { label: "카카오·구글 또는 이메일 링크로 확인", detail: "앱 비밀번호를 새로 만들 필요는 없어요." },
        { label: "이 기기에 준비판이 있으면 계정에 연결", detail: "연결할 때 복구 비밀번호로 한 번 더 잠급니다." },
        { label: "준비판이 없으면 계정 복구로 이어받기", detail: "복구 비밀번호 없이는 운영자도 내용을 열 수 없어요." },
      ]}
    >
      <button onClick={() => oauth("kakao")} disabled={busy}
        className="w-full py-3.5 text-[13px] font-medium bg-[#FEE500] text-[#191600] active:opacity-80 transition disabled:opacity-50">
        카카오로 계속
      </button>
      <button onClick={() => oauth("google")} disabled={busy}
        className="w-full py-3.5 text-[13px] border border-line text-ink hover:border-ink transition disabled:opacity-50">
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
        className="input-boxed"
      />
      <button onClick={send} disabled={busy} className="btn-primary w-full py-3.5 text-[13px] disabled:opacity-50">
        {busy ? "링크 보내는 중…" : "이메일 링크 받기 →"}
      </button>
      <p className="text-[11.5px] leading-relaxed text-soft">
        로그인 뒤에도 복구 비밀번호나 복구 링크 없이는 준비판 내용을 열 수 없어요.
      </p>
    </Frame>
  );

  if (phase === "sent") return (
    <Frame
      phase={phase}
      title="메일에서 한 번만 확인하면 돼요"
      summary={(
        <>
        <b className="text-ink">{email}</b> 으로 로그인 링크를 보냈어요. 메일의 링크를 누르면 이 화면으로 돌아와 이어집니다.
        (안 오면 스팸함도 확인해주세요.)
        </>
      )}
      msg={msg}
      steps={[
        { label: "메일함에서 로그인 링크 열기", detail: "링크는 본인 확인에만 쓰입니다." },
        { label: "돌아오면 다음 상태 확인", detail: "연결, 복구, 새 시작 중 맞는 흐름으로 이어집니다." },
      ]}
    >
      <button onClick={() => setPhase("email")} className="w-full min-h-11 text-[13px] text-ink underline underline-offset-4 hover:text-gold">
        다른 이메일로 다시 받기
      </button>
    </Frame>
  );

  if (phase === "foreign") return (
    <Frame
      phase={phase}
      title="이 기기에는 다른 준비판이 있어요"
      summary={(
        <>
          <b className="text-ink">{email}</b> 계정으로 계속하려면 이 기기의 기존 준비판을 먼저 정리해야 해요.
          중요한 내용이면 설정에서 복구 링크를 확인한 뒤 진행하세요.
        </>
      )}
      msg={msg}
      steps={[
        { label: "기존 준비판 확인", detail: "다른 계정 데이터라 바로 덮어쓰지 않습니다.", done: true },
        { label: "필요하면 설정에서 복구 링크 보관", detail: "지운 뒤에는 이 기기에서 바로 되돌리기 어렵습니다." },
        { label: "기기 데이터만 정리하고 다시 로그인", detail: "온라인 계정의 복구 연결은 별도로 유지됩니다." },
      ]}
    >
      <Link to="/settings" className="block w-full text-center min-h-11 text-[13px] text-ink underline underline-offset-4 hover:text-gold">
        먼저 설정에서 복구 링크 확인
      </Link>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true); setMsg("");
          try {
            await clearLocalDeviceData();
            await signOut();
            window.location.replace("/login");
          } catch {
            setBusy(false);
            setMsg("기기 데이터를 완전히 지우지 못했습니다. 다른 탭을 닫고 다시 시도해주세요.");
          }
        }}
        className="btn-primary w-full py-3.5 text-[13px] disabled:opacity-50"
      >
        {busy ? "안전하게 지우는 중…" : "기기 데이터 지우고 다시 로그인"}
      </button>
    </Frame>
  );

  if (phase === "link") return (
    <Frame
      phase={phase}
      title="이 준비판을 계정에 묶을까요?"
      summary={(
        <>
        <b className="text-ink">{email}</b> 에 이 청첩장을 연결해요. 새 기기에서 <b className="text-ink">로그인 + 복구 비밀번호</b>면 복구돼요.
        운영자는 복구 비밀번호를 몰라 내용을 못 봅니다.
        </>
      )}
      msg={msg}
      steps={[
        { label: "현재 기기의 준비판 확인", detail: "이 기기에 연결할 데이터가 있는지 확인했습니다.", done: true },
        { label: "복구 비밀번호로 계정 백업 잠금", detail: "16자 이상, 잊으면 로그인 복구는 할 수 없어요." },
        { label: "다른 기기에서 로그인 후 이어받기", detail: "복구 비밀번호가 맞아야 이 기기에 저장됩니다." },
      ]}
    >
      <label className="label" htmlFor="login-recovery-pass">복구 비밀번호</label>
      <input
        id="login-recovery-pass"
        type="password" value={pass} onChange={(e) => setPass(e.target.value)}
        placeholder="복구 비밀번호 (16자 이상)" autoComplete="new-password"
        className="input-boxed"
      />
      <p className="text-[11.5px] leading-relaxed text-soft">
        기억하기 쉬운 긴 문장으로 정하세요. 잊으면 운영자도 풀 수 없어요.
      </p>
      {existingLink && (
        <label className="flex items-start gap-3 border border-hair bg-cream/50 px-4 py-3 text-[12px] text-soft leading-relaxed">
          <input
            type="checkbox"
            checked={allowReplace}
            onChange={(e) => setAllowReplace(e.target.checked)}
            className="mt-0.5"
          />
          <span>이 계정의 기존 복구 연결을 현재 청첩장으로 교체합니다. 이전 연결은 이 계정으로 복구할 수 없게 됩니다.</span>
        </label>
      )}
      <button onClick={doLink} disabled={busy} className="btn-primary w-full py-3.5 text-[13px] disabled:opacity-50">
        {busy ? "계정에 연결하는 중…" : "계정에 연결 →"}
      </button>
    </Frame>
  );

  if (phase === "recover") return (
    <Frame
      phase={phase}
      title="계정에 묶인 준비판을 찾았어요"
      summary={(
        <>
        <b className="text-ink">{email}</b> 계정에 연결된 청첩장을 찾았어요. 연결할 때 정한 <b className="text-ink">복구 비밀번호</b>를 입력하면 그대로 이어받아요.
        </>
      )}
      msg={msg}
      steps={[
        { label: "계정 로그인 확인", detail: "이메일 또는 소셜 로그인으로 신원을 확인했습니다.", done: true },
        { label: "복구 비밀번호로 키 열기", detail: "비밀번호가 틀리면 이 기기 데이터는 건드리지 않습니다." },
        { label: "검증된 데이터만 이 기기에 저장", detail: "원격 데이터를 읽은 뒤 안전하게 교체합니다." },
      ]}
    >
      <label className="label" htmlFor="login-recover-pass">복구 비밀번호</label>
      <input
        id="login-recover-pass"
        type="password" value={pass} onChange={(e) => setPass(e.target.value)}
        placeholder="복구 비밀번호" autoComplete="current-password"
        className="input-boxed"
      />
      <button onClick={doRecover} disabled={busy} className="btn-primary w-full py-3.5 text-[13px] disabled:opacity-50">
        {busy ? "복구하는 중…" : "복구하기 →"}
      </button>
    </Frame>
  );

  if (phase === "none") return (
    <Frame
      phase={phase}
      title="연결된 준비판이 아직 없어요"
      summary={(
        <>
        <b className="text-ink">{email}</b> 에 연결된 청첩장이 아직 없어요. 기존 기기에서 [설정 → 로그인 연결]을 먼저 해주세요.
        </>
      )}
      msg={msg}
      steps={[
        { label: "계정 확인", detail: "로그인은 완료됐습니다.", done: true },
        { label: "기존 기기에서 로그인 연결", detail: "준비판이 있는 기기에서 복구 비밀번호를 정하면 여기서 이어받을 수 있어요." },
      ]}
    >
      <Link to="/start-hosted" className="btn-primary w-full py-3.5 text-[13px]">간편 모드로 시작 →</Link>
      <p className="text-[12.5px] leading-relaxed text-soft">
        기존 준비판이 있는 휴대폰에서는 설정의 로그인 연결에서 복구 비밀번호를 정하면 됩니다.
      </p>
    </Frame>
  );

  // linked
  return (
    <Frame
      phase={phase}
      title="복구 준비가 끝났어요"
      summary={(
        <>
        이제 기기를 바꿔도 <b className="text-ink">{email}</b> 로 로그인하고 복구 비밀번호를 넣으면 그대로 복구돼요.
        </>
      )}
      msg={msg}
      steps={[
        { label: "계정 연결 완료", detail: "이 계정으로 로그인 복구를 시작할 수 있어요.", done: true },
        { label: "복구 비밀번호 보관", detail: "비밀번호는 서버에 저장되지 않아서 꼭 기억해야 합니다." },
      ]}
    >
      <Link to="/dashboard" className="btn-primary w-full py-3.5 text-[13px]">대시보드로 →</Link>
    </Frame>
  );
}

// 모듈 레벨 — 컴포넌트 내부에 두면 매 렌더마다 새로 생성돼 입력 포커스가 풀린다.
function Frame({
  children,
  msg,
  phase,
  title,
  summary,
  steps = [],
}: {
  children?: ReactNode;
  msg?: string;
  phase: Phase;
  title: string;
  summary: ReactNode;
  steps?: LoginStep[];
}) {
  return (
    <div className="agent-canvas page max-w-app mx-auto pt-7 pb-16 space-y-5">
      <div className="border-b border-hair pb-4">
        <div className="font-serif text-[20px] leading-none text-ink">Dearie</div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-soft">로그인과 복구는 필요한 권한만 확인해요.</p>
      </div>

      <section className="border-y border-hair py-4">
        <div className="eyebrow-gold mb-3">로그인 복구</div>
        <h1 className="font-serif text-[1.9rem] leading-tight text-ink break-keep">{koBreak(title)}</h1>
        <p className="mt-3 text-[13px] text-soft leading-relaxed break-keep">{summary}</p>
      </section>

      {children && <div className="space-y-4">{children}</div>}

      {steps.length > 0 && (
        <details className="border-y border-hair py-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4">
            <span className="section-title">왜 필요한가요?</span>
            <span className="text-[12px] text-soft underline underline-offset-4">보기</span>
          </summary>
          {steps.length > 0 && (
            <ol className="mt-2 divide-y divide-hair border-t border-hair">
              {steps.map((step, index) => (
                <li key={`${step.label}-${index}`} className="flex gap-3 py-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border text-[11px] ${
                      step.done ? "border-ink bg-ink text-paper" : "border-gold text-gold"
                    }`}
                    aria-hidden="true"
                  >
                    {step.done ? "✓" : String(index + 1)}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[13.5px] leading-relaxed break-keep ${step.done ? "text-soft" : "text-ink"}`}>
                      {step.label}
                    </span>
                    {step.detail && <span className="block text-[12px] text-soft leading-relaxed break-keep">{step.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </details>
      )}

      {msg && (
        <p role="alert" className="border-t border-hair pt-4 text-[12px] text-gold leading-relaxed">
          <span className="font-semibold text-ink">Dearie</span> · {msg}
        </p>
      )}
    </div>
  );
}
