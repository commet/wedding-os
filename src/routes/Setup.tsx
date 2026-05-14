import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { pingSupabase } from "../lib/storage.supabase";
import SchemaText from "../supabase-schema-text";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Setup({ data, update }: Props) {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState(data.preferences.supabase?.url ?? "");
  const [anonKey, setAnonKey] = useState(data.preferences.supabase?.anonKey ?? "");
  const [pingStatus, setPingStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [pingMsg, setPingMsg] = useState("");
  const [sqlCopied, setSqlCopied] = useState(false);
  const navigate = useNavigate();

  const copySQL = async () => {
    try {
      await navigator.clipboard.writeText(SchemaText);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    } catch {}
  };

  const checkConnection = async () => {
    setPingStatus("checking");
    setPingMsg("");
    const r = await pingSupabase(url.trim(), anonKey.trim());
    if (r.ok) {
      setPingStatus("ok");
    } else {
      setPingStatus("fail");
      setPingMsg(r.reason ?? "연결 실패");
    }
  };

  const saveAndFinish = () => {
    update((prev: WeddingData) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        mode: "supabase",
        supabase: { url: url.trim(), anonKey: anonKey.trim(), configId: "default" },
      },
    }));
    navigate("/dashboard");
  };

  return (
    <div className="px-5 py-6 space-y-5 max-w-app mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">셋업 가이드</h1>
        <span className="text-xs text-soft">{step} / 5</span>
      </div>

      <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
        <div className="h-full bg-gold transition-all" style={{ width: `${(step / 5) * 100}%` }} />
      </div>

      <p className="text-sm text-soft">
        무료 서비스 두 곳(Supabase + Vercel)에 가입해 우리 둘만의 결혼식 사이트를 만들어요.
        총 15분 정도 걸려요. 막히면 언제든{" "}
        <a className="underline" href="mailto:yclee913@gmail.com">메일로 물어보세요</a>.
      </p>

      {step === 1 && <Step1 onNext={() => setStep(2)} />}
      {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && (
        <Step3
          onCopy={copySQL}
          copied={sqlCopied}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && (
        <Step4
          url={url}
          anonKey={anonKey}
          setUrl={setUrl}
          setAnonKey={setAnonKey}
          status={pingStatus}
          msg={pingMsg}
          onCheck={checkConnection}
          onNext={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      )}
      {step === 5 && (
        <Step5 onFinish={saveAndFinish} onBack={() => setStep(4)} />
      )}
    </div>
  );
}

function Step1({ onNext }: { onNext: () => void; }) {
  return (
    <div className="card space-y-4">
      <h2 className="font-medium text-lg">1️⃣ Supabase 가입하기 (무료)</h2>
      <p className="text-sm text-soft">
        결혼식 정보·청첩장·하객 응답을 저장할 곳이에요. 무료 플랜으로 평생 사용 가능합니다.
      </p>
      <ol className="text-sm space-y-2 list-decimal list-inside">
        <li>아래 버튼으로 Supabase 사이트 열기</li>
        <li>"Start your project" 또는 "Sign up" 클릭</li>
        <li>GitHub 계정으로 가입하기 (가장 빠름)</li>
      </ol>
      <a
        href="https://supabase.com/dashboard/sign-up"
        target="_blank"
        rel="noopener"
        className="btn-primary w-full text-center"
      >
        Supabase 가입하러 가기
      </a>
      <p className="text-xs text-soft">
        가입 끝나면 아래 [다음] 누르세요.
      </p>
      <button onClick={onNext} className="btn-secondary w-full">다음 →</button>
    </div>
  );
}

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void; }) {
  return (
    <div className="card space-y-4">
      <h2 className="font-medium text-lg">2️⃣ 새 프로젝트 만들기</h2>
      <p className="text-sm text-soft">
        Supabase 대시보드에서 "New project" 버튼 클릭.
      </p>
      <ol className="text-sm space-y-2 list-decimal list-inside">
        <li><b>Name</b>: 아무거나 (예: <code className="bg-cream px-1 rounded">my-wedding</code>)</li>
        <li><b>Database Password</b>: 안전한 비밀번호 (어딘가 적어두세요)</li>
        <li><b>Region</b>: <code className="bg-cream px-1 rounded">Northeast Asia (Seoul)</code> 추천</li>
        <li>"Create new project" 클릭 → 약 1~2분 대기</li>
      </ol>
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm">
        ⚠️ 첫 화면이 좀 어려워 보일 수 있어요. 무서워하지 말고 위 4개만 따라하시면 됩니다.
      </div>
      <div className="flex gap-2">
        <button onClick={onBack} className="btn-secondary flex-1">← 이전</button>
        <button onClick={onNext} className="btn-primary flex-1">다음 →</button>
      </div>
    </div>
  );
}

function Step3({ onCopy, copied, onNext, onBack }: any) {
  return (
    <div className="card space-y-4">
      <h2 className="font-medium text-lg">3️⃣ 테이블 만들기 (SQL 한 번 실행)</h2>
      <p className="text-sm text-soft">
        프로젝트가 만들어졌으면, 왼쪽 메뉴에서 <b>SQL Editor</b> 클릭 → "New query" → 아래 SQL을 그대로 붙여넣고 "Run" 누르세요.
      </p>
      <button onClick={onCopy} className="btn-primary w-full">
        {copied ? "✓ 복사됨" : "📋 SQL 복사하기"}
      </button>
      <details className="text-xs">
        <summary className="text-soft cursor-pointer">SQL 내용 미리보기 (긴 텍스트)</summary>
        <pre className="mt-2 bg-cream rounded p-3 overflow-x-auto whitespace-pre-wrap text-xs">{SchemaText.slice(0, 600)}…</pre>
      </details>
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm">
        ⚠️ 실행 후 "Success. No rows returned" 또는 비슷한 초록색 메시지가 떠야 정상이에요.
      </div>
      <div className="flex gap-2">
        <button onClick={onBack} className="btn-secondary flex-1">← 이전</button>
        <button onClick={onNext} className="btn-primary flex-1">다음 →</button>
      </div>
    </div>
  );
}

function Step4({ url, anonKey, setUrl, setAnonKey, status, msg, onCheck, onNext, onBack }: any) {
  const valid = url.startsWith("https://") && anonKey.length > 20;
  return (
    <div className="card space-y-4">
      <h2 className="font-medium text-lg">4️⃣ 연결 키 입력</h2>
      <p className="text-sm text-soft">
        Supabase 프로젝트의 왼쪽 메뉴 <b>Project Settings</b> → <b>API</b> 탭에서 두 가지를 복사하세요.
      </p>
      <div>
        <label className="label">Project URL</label>
        <input className="input text-xs" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
      </div>
      <div>
        <label className="label">anon (public) key</label>
        <input className="input text-xs" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJhbGc..." />
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
        ❗ <b>service_role 키는 절대 입력하지 마세요.</b> 반드시 <b>anon (public) 키</b>만 사용하세요.
        service_role은 누구나 모든 데이터에 접근할 수 있는 마스터 키예요.
      </div>

      <button onClick={onCheck} className="btn-secondary w-full" disabled={!valid || status === "checking"}>
        {status === "checking" ? "확인 중..." : "🔌 연결 확인"}
      </button>

      {status === "ok" && <p className="text-green-600 text-sm">✓ 연결 성공! 다음 단계로 진행하세요.</p>}
      {status === "fail" && (
        <p className="text-red-500 text-sm">
          연결 실패: {msg}
          <br />
          <span className="text-xs text-soft">3단계 SQL이 실행됐는지 다시 확인해주세요.</span>
        </p>
      )}

      <div className="flex gap-2">
        <button onClick={onBack} className="btn-secondary flex-1">← 이전</button>
        <button onClick={onNext} className="btn-primary flex-1" disabled={status !== "ok"}>다음 →</button>
      </div>
    </div>
  );
}

function Step5({ onFinish, onBack }: { onFinish: () => void; onBack: () => void; }) {
  return (
    <div className="card space-y-4">
      <h2 className="font-medium text-lg">5️⃣ Vercel에 배포 (선택)</h2>
      <p className="text-sm text-soft">
        지금까지는 데이터가 Supabase에 저장돼요. 청첩장 링크로 공유하려면 Vercel로 배포해야 합니다.
        지금 바로 안 해도, 나중에 [더보기]에서 할 수 있어요.
      </p>
      <a
        href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcommet%2Fwedding-os"
        target="_blank"
        rel="noopener"
        className="btn-primary w-full text-center"
      >
        Vercel로 1-클릭 배포하기
      </a>
      <p className="text-xs text-soft">
        가입 후 환경변수 2개를 입력하시면 됩니다:
        <br /><code className="bg-cream px-1 rounded">VITE_SUPABASE_URL</code> 과 <code className="bg-cream px-1 rounded">VITE_SUPABASE_ANON_KEY</code>
      </p>
      <div className="flex gap-2">
        <button onClick={onBack} className="btn-secondary flex-1">← 이전</button>
        <button onClick={onFinish} className="btn-primary flex-1">완료 ✓</button>
      </div>
    </div>
  );
}
