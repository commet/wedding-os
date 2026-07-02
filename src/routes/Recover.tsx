// /recover#w=..&t=..&k=..  — 복구 링크로 간편(hosted) 모드 이어받기.
//
// 기기교체·부부공유 시 진입. 프래그먼트에서 weddingId·ownerToken·weddingKey 를 받아
// 시크릿에 심고, mode='hosted' 로 로컬을 seed 한 뒤 새로고침으로 진입한다.
// 새로고침 후 정상 로드 경로가 hosted 드라이버로 서버 암호문을 복호화해 가져온다.
// (in-memory 버전 동기화 race 를 피하려고 일부러 hard reload 한다.)

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AgentIdentity } from "../components/AgentIdentity";
import { koBreak } from "../lib/typography";
import {
  parseProtectedRecoveryFragment,
  parseRecoveryFragment,
  unwrapProtectedRecoveryBundle,
  type ProtectedRecoveryPayload,
  type RecoveryBundle,
} from "../lib/recovery";
import { setHostedRecoveryCredentials } from "../lib/security";
import { clearLocalDeviceData, localStorageDriver } from "../lib/storage";
import { createHostedStorage } from "../lib/storage.hosted";

type RecoverStatus = "working" | "password" | "error";
type RecoverStep = "link" | "password" | "remote" | "device";

const RECOVERY_STEPS: Array<{ id: RecoverStep; label: string; detail: string }> = [
  { id: "link", label: "복구 링크 확인", detail: "링크의 # 뒤 키까지 이 브라우저 안에서만 읽어요." },
  { id: "password", label: "공유 비밀번호 확인", detail: "링크와 따로 받은 비밀번호로 편집 권한을 엽니다." },
  { id: "remote", label: "온라인 암호문 검증", detail: "권한과 키가 실제 데이터와 맞는지 먼저 확인합니다." },
  { id: "device", label: "이 기기에 안전하게 연결", detail: "검증된 데이터만 저장하고 URL에서 키를 지웁니다." },
];

export default function Recover() {
  const location = useLocation();
  const [status, setStatus] = useState<RecoverStatus>("working");
  const [step, setStep] = useState<RecoverStep>("link");
  const [protectedFlow, setProtectedFlow] = useState(false);
  const [payload, setPayload] = useState<ProtectedRecoveryPayload | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [error, setError] = useState("복구 링크가 올바르지 않아요. 링크 전체를 다시 열어주세요.");
  const processedHash = useRef("");

  const fail = (message: string) => {
    setError(message);
    setStatus("error");
  };

  const recoverBundle = async (bundle: RecoveryBundle) => {
    setStatus("working");
    setPasswordError("");
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (!url || !anonKey) {
        fail("온라인 저장소 설정을 찾지 못했어요. 이 링크를 만든 Dearie 앱의 배포 설정을 확인해야 합니다.");
        return;
      }

      // 기존 기기 데이터를 건드리기 전에 원격 자격증명과 복호화 키를 실제 데이터로 검증한다.
      setStep("remote");
      const remote = await createHostedStorage(
        url, anonKey, bundle.weddingId, bundle.weddingKey, bundle.ownerToken,
      ).load();
      if (!remote) {
        fail("복구 링크의 권한이나 키가 데이터와 맞지 않아요. 기존 기기 데이터는 그대로 두었습니다.");
        return;
      }
      const restored = {
        ...remote.data,
        preferences: { ...remote.data.preferences, mode: "hosted" as const, isDemo: false },
      };
      setStep("device");
      const previous = await localStorageDriver.load();
      const saved = await localStorageDriver.save(restored);
      if (!saved.ok) {
        fail("이 기기에 복구 데이터를 저장하지 못했어요. 기존 기기 데이터는 그대로 두었습니다.");
        return;
      }

      if (!setHostedRecoveryCredentials(
        { weddingId: bundle.weddingId, weddingKey: bundle.weddingKey },
        bundle.ownerToken,
      )) {
        if (previous) await localStorageDriver.save(previous.data);
        else await clearLocalDeviceData().catch(() => undefined);
        fail(previous
          ? "복구 권한을 저장하지 못했어요. 기존 기기 데이터는 다시 복원했습니다."
          : "복구 권한을 저장하지 못했어요. 이 기기에 남은 복구 흔적은 정리했습니다.");
        return;
      }
      // URL/히스토리에서 키 제거 후 대시보드로 새로고침 진입.
      window.history.replaceState(null, "", "/recover");
      window.location.assign("/dashboard");
    } catch {
      fail("복구 처리 중 문제가 생겼어요. 기존 기기 데이터는 그대로 두었습니다.");
    }
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (processedHash.current === hash) return;
    processedHash.current = hash;
    setProtectedFlow(false);
    setPayload(null);
    setPassword("");
    setPasswordError("");
    setPasswordAttempts(0);
    setStep("link");
    setStatus("working");
    (async () => {
      const bundle = parseRecoveryFragment(hash);
      if (bundle) {
        await recoverBundle(bundle);
        return;
      }
      const protectedPayload = parseProtectedRecoveryFragment(hash);
      if (protectedPayload) {
        setProtectedFlow(true);
        setPayload(protectedPayload);
        setStep("password");
        setStatus("password");
        return;
      }
      fail("복구 링크 형식이 맞지 않아요. 공유받은 링크에서 # 뒤 내용까지 빠짐없이 열었는지 확인해주세요.");
    })();
  }, [location.hash]);

  const unlockProtectedLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!payload) {
      fail("복구 링크 정보를 다시 확인하지 못했어요. 링크를 새로 열어주세요.");
      return;
    }
    if (!password.trim()) {
      setPasswordError("배우자에게 받은 공유 비밀번호를 입력해주세요.");
      return;
    }
    setPasswordError("");
    setStep("password");
    setStatus("working");
    try {
      const bundle = await unwrapProtectedRecoveryBundle(payload, password);
      setPasswordAttempts(0);
      await recoverBundle(bundle);
    } catch {
      const nextAttempts = passwordAttempts + 1;
      setPasswordAttempts(nextAttempts);
      setStatus("password");
      setStep("password");
      setPasswordError(nextAttempts >= 3
        ? "공유 비밀번호가 계속 맞지 않아요. 링크를 보낸 사람에게 새 보호 링크와 비밀번호를 다시 받아주세요."
        : "공유 비밀번호가 맞지 않아요. 링크와 함께 받은 비밀번호를 다시 확인해주세요.");
    }
  };

  if (status === "password") {
    return (
      <RecoverFrame
        mood="ready"
        eyebrow="공유 비밀번호"
        title="이 링크는 비밀번호로 잠겨 있어요"
        summary="링크만으로는 준비판을 열 수 없게 보호되어 있습니다. 배우자에게 받은 공유 비밀번호를 입력하면 데이터를 확인합니다."
      >
        <RecoveryChecklist activeStep={step} passwordRequired={protectedFlow} />
        <form onSubmit={unlockProtectedLink} className="space-y-4">
          <label className="label" htmlFor="share-password">공유 비밀번호</label>
          <input
            id="share-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="링크와 따로 받은 비밀번호"
            className="input-boxed"
          />
          {passwordError && <p role="alert" className="text-[12px] leading-relaxed text-gold">{passwordError}</p>}
          <button type="submit" className="btn-primary w-full py-3.5 text-[13px]">
            비밀번호 확인하고 이어가기 →
          </button>
        </form>
        {passwordAttempts >= 3 && (
          <div className="border-y border-hair py-4 text-[12.5px] leading-relaxed text-soft">
            <p className="mb-3">
              비밀번호만 틀린 건지, 이전 링크가 무효화된 건지 여기서는 구분하기 어려워요. 새 링크를 받으면 이 화면을 다시 열면 됩니다.
            </p>
            <Link to="/" className="text-ink underline underline-offset-4 hover:text-gold">
              처음으로 돌아가기 →
            </Link>
          </div>
        )}
        <p className="text-[12px] leading-relaxed text-soft">
          비밀번호는 서버로 보내지지 않고, 이 브라우저 안에서 링크 속 편집 권한을 푸는 데만 씁니다.
        </p>
      </RecoverFrame>
    );
  }

  if (status === "error") {
    return (
      <RecoverFrame
        mood="watching"
        eyebrow="복구 실패"
        title="기존 데이터는 그대로 두었어요"
        summary={error}
      >
        <RecoveryChecklist activeStep={step} failed passwordRequired={protectedFlow} />
        <div className="border-y border-hair py-4 text-[12.5px] leading-relaxed text-soft">
          링크와 온라인 데이터를 먼저 검증한 뒤에만 이 기기를 바꿉니다. 실패한 경우 기존 준비판은 지우지 않아요.
        </div>
        <button onClick={() => window.location.reload()} className="btn-primary w-full py-3.5 text-[13px]">
          복구 링크 다시 확인
        </button>
        <Link to="/login" className="block w-full min-h-11 text-center text-[13px] text-ink underline underline-offset-4 hover:text-gold">
          로그인으로 복구하기
        </Link>
        <Link to="/" className="block w-full min-h-11 text-center text-[13px] text-soft underline underline-offset-4 hover:text-ink">
          처음으로 돌아가기
        </Link>
      </RecoverFrame>
    );
  }

  return (
    <RecoverFrame
      mood="thinking"
      eyebrow="복구 진행"
      title={step === "link" ? "복구 링크를 확인하고 있어요" : step === "password" ? "비밀번호를 확인하고 있어요" : step === "remote" ? "온라인 데이터를 맞춰보고 있어요" : "이 기기에 연결하고 있어요"}
      summary={(
        <>
          청첩장 준비 정보를 가져오는 중이에요. 검증이 끝나기 전에는 기존 기기 데이터를 바꾸지 않습니다.
        </>
      )}
    >
      <RecoveryChecklist activeStep={step} passwordRequired={protectedFlow} />
      <p className="text-[12.5px] leading-relaxed text-soft">
        잠깐만 기다려주세요. 완료되면 URL에서 복구 키를 지우고 대시보드로 이동합니다.
      </p>
    </RecoverFrame>
  );
}

function RecoverFrame({
  children,
  mood,
  eyebrow,
  title,
  summary,
}: {
  children: ReactNode;
  mood: "ready" | "thinking" | "watching";
  eyebrow: string;
  title: string;
  summary: ReactNode;
}) {
  return (
    <div className="agent-canvas page max-w-app mx-auto min-h-screen pt-12 pb-16 space-y-6">
      <AgentIdentity mood={mood} caption="복구 링크는 이 브라우저 안에서만 확인해요." />
      <section className="border-y border-hair py-5">
        <div className="eyebrow-gold mb-3">{eyebrow}</div>
        <h1 className="font-serif text-[1.9rem] leading-tight text-ink break-keep">{koBreak(title)}</h1>
        <p className="mt-3 text-[13px] text-soft leading-relaxed break-keep">{summary}</p>
      </section>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function RecoveryChecklist({
  activeStep,
  failed = false,
  passwordRequired = false,
}: {
  activeStep: RecoverStep;
  failed?: boolean;
  passwordRequired?: boolean;
}) {
  const steps = passwordRequired ? RECOVERY_STEPS : RECOVERY_STEPS.filter((item) => item.id !== "password");
  const activeIndex = steps.findIndex((item) => item.id === activeStep);

  return (
    <ol className="divide-y divide-hair border-y border-hair">
      {steps.map((item, index) => {
        const done = !failed && index < activeIndex;
        const active = index === activeIndex;
        return (
          <li key={item.id} className="flex gap-3 py-3">
            <span
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border text-[10px] ${
                failed && active ? "border-gold text-gold" : done ? "border-ink bg-ink text-paper" : "border-hair text-soft"
              }`}
              aria-hidden="true"
            >
              {done ? "✓" : String(index + 1)}
            </span>
            <span className="min-w-0">
              <span className={`block text-[13.5px] leading-relaxed break-keep ${active ? "text-ink" : "text-soft"}`}>
                {item.label}
              </span>
              <span className="block text-[12px] text-soft leading-relaxed break-keep">{item.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
