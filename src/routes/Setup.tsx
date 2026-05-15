import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { pingSupabase } from "../lib/storage.supabase";
import { isSupabaseHost, markOwner } from "../lib/security";
import SchemaText from "../supabase-schema-text";

type Props = { data: WeddingData; update: (patch: any) => void; };

const STEPS = [
  { n: 1, label: "가입" },
  { n: 2, label: "프로젝트" },
  { n: 3, label: "SQL" },
  { n: 4, label: "키 입력" },
  { n: 5, label: "배포" },
];

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
      setTimeout(() => setSqlCopied(false), 3000);
    } catch {
      // 클립보드 실패 시 textarea로 fallback — 모달 안 띄우고 alert만
      alert("자동 복사 실패. SQL 텍스트 영역을 직접 선택해 복사해주세요.");
    }
  };

  const checkConnection = async () => {
    setPingStatus("checking");
    setPingMsg("");
    const cleanUrl = url.trim();
    // 도메인 화이트리스트 — 공식 Supabase 호스트만 허용. 피싱 사이트 차단.
    if (!isSupabaseHost(cleanUrl)) {
      setPingStatus("fail");
      setPingMsg("Supabase 공식 URL 형식이 아니에요. https://xxxx.supabase.co 또는 .supabase.in 만 허용됩니다.");
      return;
    }
    const r = await pingSupabase(cleanUrl, anonKey.trim());
    if (r.ok) {
      setPingStatus("ok");
    } else {
      setPingStatus("fail");
      setPingMsg(r.reason ?? "연결 실패");
    }
  };

  const saveAndFinish = () => {
    const cleanUrl = url.trim();
    if (!isSupabaseHost(cleanUrl)) {
      alert("Supabase URL 형식이 잘못됐어요. xxxx.supabase.co 형태여야 합니다.");
      return;
    }
    update((prev: WeddingData) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        mode: "supabase",
        supabase: { url: cleanUrl, anonKey: anonKey.trim(), configId: "default" },
      },
    }));
    // 이 기기를 "오너" 로 표시 — 청첩장 페이지의 편집 탭은 오너에게만 노출됨.
    // (게스트가 청첩장 URL 받고 들어와도 편집 폼이 안 뜨도록.)
    markOwner();
    navigate("/dashboard");
  };

  return (
    <div className="px-5 py-6 space-y-5 max-w-app mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">셋업 가이드</h1>
        <a
          href={`mailto:yclee913@gmail.com?subject=${encodeURIComponent(`[Wedding OS] 셋업 ${step}단계 도움 요청`)}&body=${encodeURIComponent(`안녕하세요,\n\n셋업 ${step}단계에서 막혔어요. 다음 부분이 헷갈려요:\n\n[여기에 상황 적기]\n\n---\n현재 단계: ${step} / 5\n`)}`}
          className="text-xs text-soft underline"
        >
          ✉️ 도움 받기
        </a>
      </div>

      <ProgressDots current={step} />

      <p className="text-xs text-soft leading-relaxed text-center -mt-1">
        무료 서비스 두 곳(Supabase + Vercel) 가입해<br />
        우리 둘만의 결혼식 사이트를 만들어요. 약 15분.
      </p>

      {step === 1 && <Step1 onNext={() => setStep(2)} />}
      {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && (
        <Step3 onCopy={copySQL} copied={sqlCopied} onNext={() => setStep(4)} onBack={() => setStep(2)} />
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
      {step === 5 && <Step5 onFinish={saveAndFinish} onBack={() => setStep(4)} />}
    </div>
  );
}

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between px-2">
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <div key={s.n} className="flex-1 flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  done ? "bg-gold text-white" : active ? "bg-gold/20 text-gold border-2 border-gold" : "bg-cream text-soft border border-line"
                }`}
              >
                {done ? "✓" : s.n}
              </div>
              <span className={`text-[10px] mt-1 ${active ? "text-gold font-medium" : "text-soft"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 -mt-4 mx-1 ${done ? "bg-gold" : "bg-line"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-xl">
          {icon}
        </div>
        <h2 className="font-medium text-lg">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function NavButtons({
  onBack, onNext, nextLabel = "다음 →", nextDisabled = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex gap-2 pt-2">
      {onBack && <button onClick={onBack} className="btn-secondary flex-1">← 이전</button>}
      <button onClick={onNext} disabled={nextDisabled} className="btn-primary flex-1 disabled:opacity-40 disabled:bg-soft">
        {nextLabel}
      </button>
    </div>
  );
}

// ─── Step 1: 가입 ───
function Step1({ onNext }: { onNext: () => void }) {
  return (
    <StepCard icon="🪪" title="Supabase 가입하기">
      <p className="text-sm text-soft leading-relaxed">
        결혼식 정보·청첩장·하객 RSVP를 저장할 무료 데이터베이스예요.
        평생 무료 플랜으로 사용 가능합니다.
      </p>

      <div className="bg-cream rounded-xl p-4 text-sm space-y-2">
        <p className="font-medium">👉 따라하기</p>
        <ol className="space-y-1.5 list-decimal list-inside text-soft">
          <li>아래 [Supabase 가입] 버튼 클릭</li>
          <li><b className="text-ink">"Start your project"</b> 클릭</li>
          <li><b className="text-ink">GitHub 계정으로 가입</b> (가장 빠름)</li>
        </ol>
      </div>

      <a
        href="https://supabase.com/dashboard/sign-up"
        target="_blank"
        rel="noopener"
        className="btn-primary w-full text-center"
      >
        Supabase 가입하러 가기 ↗
      </a>

      <p className="text-xs text-soft">
        가입이 끝나면 [다음] 누르세요. 가입은 한 번만 하면 돼요.
      </p>

      <NavButtons onNext={onNext} />
    </StepCard>
  );
}

// ─── Step 2: 프로젝트 ───
function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <StepCard icon="📦" title="새 프로젝트 만들기">
      <p className="text-sm text-soft leading-relaxed">
        Supabase 대시보드에서 결혼식 정보를 담을 빈 공간(프로젝트)을 만들어요.
      </p>

      <div className="bg-cream rounded-xl p-4 text-sm space-y-2">
        <p className="font-medium">👉 따라하기</p>
        <ol className="space-y-2 list-decimal list-inside text-soft">
          <li>대시보드 우상단 <b className="text-ink">[New project]</b> 클릭</li>
          <li>
            아래 항목 입력:
            <ul className="ml-5 mt-1 space-y-1 list-disc">
              <li><b className="text-ink">Name</b>: 아무거나 (예: <code className="bg-white px-1 rounded">my-wedding</code>)</li>
              <li><b className="text-ink">Database Password</b>: 안전한 비밀번호 (어딘가 메모!)</li>
              <li><b className="text-ink">Region</b>: <code className="bg-white px-1 rounded">Northeast Asia (Seoul)</code></li>
            </ul>
          </li>
          <li><b className="text-ink">[Create new project]</b> 클릭 → 1~2분 대기 (커피 한 모금)</li>
        </ol>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm">
        💡 첫 화면이 영어라 부담스러울 수 있어요. <b>위 3가지만 채우면 끝.</b>
      </div>

      <NavButtons onBack={onBack} onNext={onNext} />
    </StepCard>
  );
}

// ─── Step 3: SQL ───
function Step3({
  onCopy, copied, onNext, onBack,
}: {
  onCopy: () => void;
  copied: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <StepCard icon="🧱" title="테이블 만들기 (SQL 한 번)">
      <p className="text-sm text-soft leading-relaxed">
        결혼식 정보를 담을 표(테이블)를 만들어요. 직접 만들 필요 없이,
        준비해둔 명령어를 복사 → 붙여넣기 → 실행, 끝.
      </p>

      <div className="bg-cream rounded-xl p-4 text-sm space-y-2">
        <p className="font-medium">👉 따라하기</p>
        <ol className="space-y-1.5 list-decimal list-inside text-soft">
          <li>왼쪽 메뉴에서 <b className="text-ink">SQL Editor</b> 클릭 (🗂️ 모양 아이콘)</li>
          <li><b className="text-ink">[+ New query]</b> 클릭</li>
          <li>아래 [SQL 복사] 버튼 → 빈 영역에 <b className="text-ink">Cmd/Ctrl + V</b></li>
          <li>우하단 <b className="text-ink">[Run]</b> 버튼 클릭</li>
          <li>초록색 <b className="text-ink">"Success"</b> 메시지가 뜨면 OK</li>
        </ol>
      </div>

      <button onClick={onCopy} className="btn-primary w-full">
        {copied ? "✓ 복사됐어요! 이제 SQL Editor에 붙여넣기" : "📋 SQL 복사하기"}
      </button>

      <details className="text-xs">
        <summary className="text-soft cursor-pointer">📄 복사할 SQL 미리보기 (앞부분)</summary>
        <pre className="mt-2 bg-cream rounded p-3 overflow-x-auto whitespace-pre-wrap text-xs max-h-32 overflow-y-auto">
{SchemaText.slice(0, 400)}…
        </pre>
        <p className="mt-2 text-soft">
          이 SQL은 테이블 3개를 만들고, 보안 정책(RLS)을 켜는 안전한 코드입니다.
        </p>
      </details>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs space-y-1">
        <p>💡 "Success. No rows returned" 또는 비슷한 초록 메시지가 떠야 정상.</p>
        <p>❓ 빨간 에러가 나면 → 위 [도움 받기] 버튼으로 알려주세요. 어떤 에러인지만 적어주시면 됩니다.</p>
      </div>

      <NavButtons onBack={onBack} onNext={onNext} />
    </StepCard>
  );
}

// ─── Step 4: 키 입력 ───
function Step4({
  url, anonKey, setUrl, setAnonKey, status, msg, onCheck, onNext, onBack,
}: any) {
  const valid = url.startsWith("https://") && anonKey.length > 20;

  return (
    <StepCard icon="🔑" title="연결 키 가져오기">
      <p className="text-sm text-soft leading-relaxed">
        방금 만든 프로젝트의 "주소"와 "키"를 우리 도구에 알려주면,
        둘이 같은 데이터를 보고 편집할 수 있게 돼요.
      </p>

      <div className="bg-cream rounded-xl p-4 text-sm space-y-2">
        <p className="font-medium">👉 어디서 찾나요?</p>
        <pre className="text-xs leading-relaxed text-soft whitespace-pre-wrap font-mono bg-white rounded p-3 border border-line">
{`Supabase 대시보드
└─ 왼쪽 메뉴 맨 아래
   └─ ⚙️ Project Settings
      └─ API 탭 클릭
         ├─ Project URL ──────► 복사 (1)
         └─ Project API keys
            ├─ anon public ───► 복사 (2)
            └─ service_role ──► ❌ 절대 안 됨!`}
        </pre>
      </div>

      <div>
        <label className="label">① Project URL</label>
        <input
          className="input text-xs"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://xxxxxxxxxxxx.supabase.co"
        />
      </div>
      <div>
        <label className="label">② anon (public) key</label>
        <input
          className="input text-xs"
          value={anonKey}
          onChange={(e) => setAnonKey(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        />
        <p className="text-[10px] text-soft mt-1">긴 문자열이에요 (eyJ로 시작).</p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs space-y-1">
        <p>❗ <b>service_role 키는 절대 입력하지 마세요.</b></p>
        <p>service_role은 모든 데이터에 접근할 수 있는 마스터 키예요.
          반드시 <b className="text-ink">anon (public)</b> 키만!</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 text-xs leading-relaxed">
        ⚠️ <b>중요 — 청첩장 공유 시 주의:</b><br />
        anon 키는 청첩장 페이지의 JavaScript 안에 그대로 들어가서 누구나 볼 수 있어요.
        현재 버전의 [내 사이트] 모드는 인증을 사용하지 않으므로, 청첩장 URL을 받은 사람이
        브라우저 개발자 도구로 데이터를 수정·삭제할 가능성이 있습니다.<br />
        → <b>가까운 가족·친구에게만</b> 공유하시고, 단톡방·SNS 공개 게시는
        보안 업데이트 이전까지 권장하지 않아요.
      </div>

      <button
        onClick={onCheck}
        disabled={!valid || status === "checking"}
        className="btn-secondary w-full disabled:opacity-50"
      >
        {status === "checking" ? "확인 중…" : "🔌 연결 확인"}
      </button>

      {status === "ok" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          ✓ 연결 성공! 다음 단계로 넘어가세요.
        </div>
      )}
      {status === "fail" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
          <p className="font-medium text-red-600">연결 실패</p>
          <p className="text-xs text-soft mt-1">{msg}</p>
          <p className="text-xs text-soft mt-2">
            ▸ 3단계 SQL이 정말 실행됐는지 다시 확인<br />
            ▸ 키를 정확히 복사했는지 확인 (공백·줄바꿈 X)<br />
            ▸ service_role이 아닌 <b>anon public</b> 키인지
          </p>
        </div>
      )}

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={status !== "ok"} />
    </StepCard>
  );
}

// ─── Step 5: 배포 ───
function Step5({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  return (
    <StepCard icon="🚀" title="끝! 배포는 선택">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
        ✓ <b>여기까지 오셨으면 데이터 저장 준비 완료.</b>
        <p className="text-xs text-soft mt-2 leading-relaxed">
          [완료] 누르면 지금 입력한 정보가 Supabase에 저장돼요.
          신부와 같이 편집하고, 어디서든 같은 데이터를 볼 수 있어요.
        </p>
      </div>

      <div className="bg-cream rounded-xl p-4 text-sm space-y-2">
        <p className="font-medium">🌐 청첩장 링크로 카톡 공유까지 하려면?</p>
        <p className="text-soft text-xs leading-relaxed">
          Vercel에 무료 배포하면 카톡으로 보낼 수 있는 진짜 청첩장 링크가 생겨요.
          지금 안 해도 [더보기]에서 언제든 가능.
        </p>
      </div>

      <a
        href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcommet%2Fwedding-os"
        target="_blank"
        rel="noopener"
        className="btn-secondary w-full text-center"
      >
        Vercel 1-클릭 배포 (나중에 해도 됨) ↗
      </a>

      <p className="text-[11px] text-soft text-center">
        Vercel에 가입 후 환경변수 두 개만 넣으면 끝<br />
        <code className="bg-cream px-1 rounded">VITE_SUPABASE_URL</code> · <code className="bg-cream px-1 rounded">VITE_SUPABASE_ANON_KEY</code>
      </p>

      <NavButtons onBack={onBack} onNext={onFinish} nextLabel="완료 ✓" />
    </StepCard>
  );
}
