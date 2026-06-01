import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { pingSupabase, createSupabaseStorage } from "../lib/storage.supabase";
import { isSupabaseHost, markOwner } from "../lib/security";
import { migrateImagesIdbToDataUrl } from "../lib/imageStore";
import SchemaText from "../supabase-schema-text";

type Props = { data: WeddingData; update: (patch: any) => void; };

const STEPS = [
  { n: 1, label: "가입" },
  { n: 2, label: "프로젝트" },
  { n: 3, label: "SQL" },
  { n: 4, label: "키 입력" },
  { n: 5, label: "배포" },
];

// 셋업은 10분 이상 걸리는 흐름 — 새로고침/뒤로가기/탭 닫기로 입력이 사라지면 사용자 멘붕.
// localStorage 에 미러링해서 탭을 닫았다 다시 열어도 이어서 진행할 수 있도록.
// (완료 시 clearDraft 로 정리되므로 키가 영구히 남지는 않는다.)
const DRAFT_KEY = "wedding-os/setup-draft/v1";
type Draft = { step: number; url: string; anonKey: string };
function loadDraft(): Partial<Draft> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<Draft>) : {};
  } catch { return {}; }
}
function saveDraft(d: Draft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* noop */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
}

// 의미 있는 결혼식 데이터가 들어있는지 — 덮어쓰기 가드 판단용.
// 청첩장 기본 정보나 누적 리스트(하객·예산·예식장 등) 중 하나라도 채워져 있으면 true.
function hasContent(d: WeddingData): boolean {
  const inv = d.invitation;
  if (inv.groomName?.trim() || inv.brideName?.trim() || inv.venue?.trim() || inv.heroImageUrl) return true;
  const lists = [d.guests, d.budget, d.venues, d.rings, d.sdm, d.hotels, d.flights, d.checklist];
  if (lists.some((l) => Array.isArray(l) && l.length > 0)) return true;
  if (Array.isArray(inv.gallery) && inv.gallery.length > 0) return true;
  if (Array.isArray(d.video?.photos) && d.video.photos.length > 0) return true;
  return false;
}

export default function Setup({ data, update }: Props) {
  const draft = loadDraft();
  const [step, setStep] = useState<number>(draft.step ?? 1);
  const [url, setUrl] = useState(draft.url ?? data.preferences.supabase?.url ?? "");
  const [anonKey, setAnonKey] = useState(draft.anonKey ?? data.preferences.supabase?.anonKey ?? "");
  const [pingStatus, setPingStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [pingMsg, setPingMsg] = useState("");
  const [sqlCopied, setSqlCopied] = useState(false);
  const navigate = useNavigate();

  // 입력 바뀔 때마다 draft 갱신 — 새로고침/뒤로가기 후에도 복원
  useEffect(() => { saveDraft({ step, url, anonKey }); }, [step, url, anonKey]);

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

  const saveAndFinish = async () => {
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();
    if (!isSupabaseHost(cleanUrl)) {
      alert("Supabase URL 형식이 잘못됐어요. xxxx.supabase.co 형태여야 합니다.");
      return;
    }
    const supabaseConf = { url: cleanUrl, anonKey: cleanKey, configId: "default" };

    const finishWith = (next: WeddingData) => {
      update(() => next);
      // 이 기기를 "오너" 로 표시 — 청첩장 페이지의 편집 탭은 오너에게만 노출됨.
      // (게스트가 청첩장 URL 받고 들어와도 편집 폼이 안 뜨도록.)
      markOwner();
      clearDraft();
      navigate("/dashboard");
    };

    // ── 블라인드 덮어쓰기 가드 ──
    // 같은 owner token 을 공유한 배우자가 먼저 원격을 채워뒀을 수 있다. 확인 없이 전환하면
    // 첫 save 가 원격을 이 기기의 (거의 빈) 데이터로 통째로 덮어쓴다. 전환 전에 원격을 들여다본다.
    // (load 는 owner token 불일치 시 null 을 주므로, 데이터가 잡히면 '같은 token = 내 것' 인 경우다.)
    let remote: WeddingData | null = null;
    try {
      const probe = createSupabaseStorage(cleanUrl, cleanKey, "default");
      remote = (await probe.load())?.data ?? null;
    } catch { remote = null; }

    const localHasContent = hasContent(data);
    if (remote && hasContent(remote)) {
      const adoptRemote = () =>
        finishWith({
          ...remote!,
          preferences: { ...remote!.preferences, mode: "supabase", supabase: supabaseConf, isDemo: false },
        });
      if (!localHasContent) {
        // 이 기기는 비어 있고 원격엔 데이터가 있음 — 원격을 가져온다 (덮어쓰면 손실).
        adoptRemote();
        return;
      }
      const overwrite = confirm(
        "원격(내 사이트)에 이미 저장된 결혼식 데이터가 있어요.\n\n" +
        "확인 = 이 기기 데이터로 원격을 덮어씁니다 (원격 내용이 사라져요).\n" +
        "취소 = 원격 데이터를 이 기기로 가져옵니다 (이 기기 내용이 사라져요).",
      );
      if (!overwrite) {
        adoptRemote();
        return;
      }
      // 확인 → 아래로 떨어져 이 기기 데이터로 덮어쓴다.
    }

    // 모드 1 에서 IndexedDB 에 박힌 사진들은 다른 기기에서 못 푸므로,
    // supabase 로 전환할 때 base64 로 인라인해서 JSONB 동기화 가능한 형태로 변환.
    const migrated: WeddingData = await migrateImagesIdbToDataUrl(data);
    finishWith({
      ...migrated,
      preferences: {
        ...migrated.preferences,
        mode: "supabase",
        supabase: supabaseConf,
      },
    });
  };

  return (
    <div className="page pt-8 pb-10 space-y-8 max-w-app mx-auto">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="eyebrow-gold mb-2">Setup Guide</div>
          <h1 className="font-serif text-[2rem] leading-none">동기화 셋업</h1>
        </div>
        <a
          href={`mailto:yclee913@gmail.com?subject=${encodeURIComponent(`[Wedding OS] 셋업 ${step}단계 도움 요청`)}&body=${encodeURIComponent(`안녕하세요,\n\n셋업 ${step}단계에서 막혔어요. 다음 부분이 헷갈려요:\n\n[여기에 상황 적기]\n\n---\n현재 단계: ${step} / 5\n`)}`}
          className="text-[12px] text-soft underline underline-offset-4 hover:text-ink"
        >
          도움 받기 →
        </a>
      </div>

      <ProgressDots current={step} />

      <p className="text-[12.5px] text-soft leading-relaxed text-center">
        둘이 같이 편집하거나 청첩장 링크·RSVP를 쓰려면<br />
        내 Supabase/Vercel에 배포해 데이터가 오갈 공간을 만듭니다.
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
    <div className="flex items-center px-1">
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <div key={s.n} className="flex-1 flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 flex items-center justify-center text-[11px] font-medium tabular-nums transition ${
                  done ? "bg-ink text-paper" : active ? "border border-ink text-ink" : "border border-hair text-soft"
                }`}
              >
                {done ? "✓" : s.n}
              </div>
              <span className={`eyebrow mt-2 ${active ? "text-ink" : "text-soft"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px -mt-5 mx-2 ${done ? "bg-ink" : "bg-hair"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-baseline gap-3">
        <span className="font-serif text-soft text-base tabular-nums w-6">{icon}</span>
        <h2 className="font-serif text-xl text-ink">{title}</h2>
      </div>
      <div className="space-y-5 pl-9">{children}</div>
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
    <div className="flex items-center gap-6 pt-4 border-t border-hair mt-4">
      {onBack && (
        <button onClick={onBack} className="text-[12px] underline underline-offset-4 text-soft hover:text-ink">
          ← 이전
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="btn-primary px-6 py-3 text-[12px] disabled:opacity-40 ml-auto"
      >
        {nextLabel}
      </button>
    </div>
  );
}

// ─── Step 1: 가입 ───
function Step1({ onNext }: { onNext: () => void }) {
  return (
    <StepCard icon="01" title="Supabase 가입하기">
      <p className="text-sm text-soft leading-relaxed">
        결혼식 정보·청첩장·하객 RSVP를 저장하고 동기화할 데이터베이스예요.
        작은 개인 사이트는 보통 무료 플랜 범위에서 시작할 수 있지만,
        한도와 휴면 정책은 서비스 정책에 따라 바뀔 수 있습니다.
      </p>

      <div className="py-4 border-y border-hair text-[13px] space-y-2">
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
        rel="noopener noreferrer"
        className="btn-primary px-6 py-3 text-[12px]"
      >
        Supabase 가입하러 가기 ↗
      </a>

      <p className="text-[11.5px] text-soft">
        가입이 끝나면 [다음] 누르세요. 가입은 한 번만 하면 돼요.
      </p>

      <NavButtons onNext={onNext} />
    </StepCard>
  );
}

// ─── Step 2: 프로젝트 ───
function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <StepCard icon="02" title="새 프로젝트 만들기">
      <p className="text-sm text-soft leading-relaxed">
        Supabase 대시보드에서 결혼식 정보를 담을 빈 공간(프로젝트)을 만들어요.
      </p>

      <div className="py-4 border-y border-hair text-[13px] space-y-2">
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

      <div className="pl-4 border-l-2 border-gold/50 text-[12.5px] text-soft leading-relaxed">
        첫 화면이 영어라 부담스러울 수 있어요. <b className="text-ink">위 3가지만 채우면 끝.</b>
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
    <StepCard icon="03" title="테이블 만들기 (SQL 한 번)">
      <p className="text-sm text-soft leading-relaxed">
        결혼식 정보를 담을 표(테이블)를 만들어요. 직접 만들 필요 없이,
        준비해둔 명령어를 복사 → 붙여넣기 → 실행, 끝.
      </p>

      <div className="py-4 border-y border-hair text-[13px] space-y-2">
        <p className="font-medium">👉 따라하기</p>
        <ol className="space-y-1.5 list-decimal list-inside text-soft">
          <li>왼쪽 메뉴에서 <b className="text-ink">SQL Editor</b> 클릭 (🗂️ 모양 아이콘)</li>
          <li><b className="text-ink">[+ New query]</b> 클릭</li>
          <li>아래 [SQL 복사] 버튼 → 빈 영역에 <b className="text-ink">Cmd/Ctrl + V</b></li>
          <li>우하단 <b className="text-ink">[Run]</b> 버튼 클릭</li>
          <li>초록색 <b className="text-ink">"Success"</b> 메시지가 뜨면 OK</li>
        </ol>
      </div>

      <button onClick={onCopy} className="btn-primary px-6 py-3 text-[12px]">
        {copied ? "✓ 복사됨 — SQL Editor 에 붙여넣기" : "SQL 복사하기 →"}
      </button>

      <details className="text-[12px]">
        <summary className="text-soft cursor-pointer underline underline-offset-4 hover:text-ink">복사할 SQL 미리보기 (앞부분)</summary>
        <pre className="mt-2 bg-cream p-3 overflow-x-auto whitespace-pre-wrap text-[11px] max-h-32 overflow-y-auto">
{SchemaText.slice(0, 400)}…
        </pre>
        <p className="mt-2 text-soft">
          이 SQL 은 테이블 3개를 만들고, 보안 정책(RLS) 을 켜는 안전한 코드입니다.
        </p>
      </details>

      <div className="pl-4 border-l-2 border-gold/50 text-[12px] space-y-1 leading-relaxed text-soft">
        <p><b className="text-ink">"Success. No rows returned"</b> 또는 비슷한 초록 메시지가 떠야 정상.</p>
        <p>빨간 에러가 나면 → 위 [도움 받기] 버튼으로 알려주세요. 어떤 에러인지만 적어주시면 됩니다.</p>
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
    <StepCard icon="04" title="연결 키 가져오기">
      <p className="text-sm text-soft leading-relaxed">
        방금 만든 프로젝트의 "주소"와 "키"를 우리 도구에 알려주면,
        둘이 같은 데이터를 보고 편집할 수 있게 돼요.
      </p>

      <div className="py-4 border-y border-hair text-[13px] space-y-2">
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
          className="input text-[12px]"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://xxxxxxxxxxxx.supabase.co"
        />
      </div>
      <div>
        <label className="label">② anon (public) key</label>
        <input
          className="input text-[12px]"
          value={anonKey}
          onChange={(e) => setAnonKey(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        />
        <p className="text-[11px] text-soft mt-1">긴 문자열이에요 (eyJ 로 시작).</p>
      </div>

      <div className="pl-4 border-l-2 border-gold text-[12px] space-y-1 leading-relaxed">
        <p className="text-ink"><b>service_role 키는 절대 입력하지 마세요.</b></p>
        <p className="text-soft">service_role 은 모든 데이터에 접근할 수 있는 마스터 키예요.
          반드시 <b className="text-ink">anon (public)</b> 키만!</p>
      </div>

      <div className="pl-4 border-l-2 border-gold/50 text-[12px] leading-relaxed text-soft">
        <b className="text-ink">공개 링크 보호 —</b>
        청첩장 링크를 받은 사람은 청첩장에 필요한 정보만 볼 수 있어요.
        예산·하객 명단·체크리스트 같은 준비 데이터는 로컬 오너 토큰이 있는 기기에서만 읽고 저장합니다.
      </div>

      <button
        onClick={onCheck}
        disabled={!valid || status === "checking"}
        className="text-[12px] underline underline-offset-4 text-ink hover:text-gold disabled:opacity-40"
      >
        {status === "checking" ? "확인 중…" : "연결 확인 →"}
      </button>

      {status === "ok" && (
        <div className="pl-4 border-l-2 border-sage text-[12.5px] text-ink">
          연결 성공! 다음 단계로 넘어가세요.
        </div>
      )}
      {status === "fail" && (
        <div className="pl-4 border-l-2 border-gold text-[12.5px]">
          <p className="text-ink font-medium">연결 실패</p>
          <p className="text-[11.5px] text-soft mt-1">{msg}</p>
          <p className="text-[11.5px] text-soft mt-2 leading-relaxed">
            · 3단계 SQL 이 정말 실행됐는지 다시 확인<br />
            · 키를 정확히 복사했는지 확인 (공백·줄바꿈 X)<br />
            · service_role 이 아닌 <b className="text-ink">anon public</b> 키인지
          </p>
        </div>
      )}

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={status !== "ok"} />
    </StepCard>
  );
}

// ─── Step 5: 저장 + 배포 ───
function Step5({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  return (
    <StepCard icon="05" title="저장하고 링크 배포하기">
      <div className="pl-4 border-l-2 border-sage text-[13px] space-y-2">
        <p className="text-ink"><b>먼저 [완료]를 눌러 이 기기를 편집 기기로 등록하세요.</b></p>
        <p className="text-[12px] text-soft leading-relaxed">
          이후 Vercel 배포 링크를 열어 환경변수 두 개를 넣으면, 카톡에 보낼 수 있는 청첩장 주소가 생깁니다.
        </p>
      </div>

      <div className="py-4 border-y border-hair text-[13px] space-y-2">
        <p className="font-serif text-[15px] text-ink">청첩장 링크가 필요하면</p>
        <p className="text-soft text-[12px] leading-relaxed">
          Vercel 에 배포하세요. 배포된 주소의 <b className="text-ink">/i</b> 가 하객에게 보낼 공개 청첩장입니다.
          공개 링크는 청첩장 정보만 읽고, 예산·하객 명단은 노출하지 않습니다.
        </p>
      </div>

      <a
        href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcommet%2Fwedding-os"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] underline underline-offset-4 text-ink hover:text-gold inline-block"
      >
        Vercel 1-클릭 배포 열기 ↗
      </a>

      <p className="text-[11px] text-soft">
        Vercel 에 가입 후 환경변수 두 개만 넣으면 끝<br />
        <code className="bg-cream px-1">VITE_SUPABASE_URL</code> · <code className="bg-cream px-1">VITE_SUPABASE_ANON_KEY</code>
      </p>

      <NavButtons onBack={onBack} onNext={onFinish} nextLabel="완료 ✓" />
    </StepCard>
  );
}
