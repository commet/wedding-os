import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { WeddingData, WeddingUpdate } from "../lib/schema";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import { exportData } from "../lib/storage";
import { createSupabaseStorage, pingSupabase } from "../lib/storage.supabase";
import { isSupabaseHost, markOwner, getOrCreateOwnerToken, getOrCreateDirectRsvpToken } from "../lib/security";
import { migrateImagesIdbToDataUrl } from "../lib/imageStore";
import { koBreak } from "../lib/typography";
import { todayISO } from "../lib/freshness";
import SchemaText from "../supabase-schema-text";

type Props = { data: WeddingData; update: (patch: WeddingUpdate) => void; };

const STEPS = [
  { n: 1, label: "계정" },
  { n: 2, label: "공간" },
  { n: 3, label: "SQL" },
  { n: 4, label: "키 입력" },
  { n: 5, label: "배포" },
];

// 셋업은 10분 이상 걸리는 흐름 — 새로고침/뒤로가기/탭 닫기로 입력이 사라지면 사용자 멘붕.
// localStorage 에 미러링해서 탭을 닫았다 다시 열어도 이어서 진행할 수 있도록.
// (완료 시 clearDraft 로 정리되므로 키가 영구히 남지는 않는다.)
const DRAFT_KEY = "wedding-os/setup-draft/v1";
type Draft = { step: number; url: string; anonKey: string; configId: string };
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

function createDirectConfigId(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (!c?.getRandomValues) throw new Error("Secure random generator unavailable");
  const bytes = new Uint8Array(18);
  c.getRandomValues(bytes);
  return `wos-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
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
  const [configId] = useState(() => draft.configId ?? data.preferences.supabase?.configId ?? createDirectConfigId());
  const [pingStatus, setPingStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [pingMsg, setPingMsg] = useState("");
  const [sqlCopied, setSqlCopied] = useState(false);
  const [finishStatus, setFinishStatus] = useState<"idle" | "working" | "fail">("idle");
  const [finishMsg, setFinishMsg] = useState("");
  const navigate = useNavigate();
  const counts = dataCounts(data);
  const transferableCount = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const connectionState =
    pingStatus === "ok" ? "확인" :
    pingStatus === "fail" ? "재확인" :
    pingStatus === "checking" ? "검사 중" : "대기";
  const continueSetup = () => setStep((current) => Math.min(5, current + 1));
  const setupAgentSummary = step < 4
    ? "직접 저장소는 고급 흐름이에요. 정말 필요한 경우에만 SQL과 키 입력 순서로 이어갑니다."
    : pingStatus === "ok"
      ? "저장소 연결이 확인됐어요. 이제 백업과 사진 변환 뒤 실제 데이터를 저장하면 됩니다."
      : "아직 저장소 연결이 확인되지 않았어요. URL과 anon key를 검사한 뒤 마지막 배포 단계로 넘어가세요.";

  // 입력 바뀔 때마다 draft 갱신 — 새로고침/뒤로가기 후에도 복원
  useEffect(() => { saveDraft({ step, url, anonKey, configId }); }, [step, url, anonKey, configId]);

  const copySQL = async () => {
    try {
      const sql = SchemaText
        .replaceAll("__WEDDING_OS_CONFIG_ID__", configId)
        .replaceAll("__WEDDING_OS_OWNER_TOKEN__", getOrCreateOwnerToken())
        .replaceAll("__WEDDING_OS_RSVP_TOKEN__", getOrCreateDirectRsvpToken());
      await navigator.clipboard.writeText(sql);
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
      setPingMsg("주소가 Supabase 형식과 달라요. ① Project URL 칸에 https://xxxx.supabase.co (또는 .supabase.in) 주소가 그대로 들어갔는지 확인해주세요.");
      return;
    }
    const r = await pingSupabase(cleanUrl, anonKey.trim(), configId);
    if (r.ok) {
      setPingStatus("ok");
    } else {
      setPingStatus("fail");
      setPingMsg(r.reason ?? "저장소에 연결되지 않았어요. 아래 순서대로 한 번씩만 확인해보세요.");
    }
  };

  const saveAndFinish = async () => {
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();
    if (!isSupabaseHost(cleanUrl)) {
      alert("저장소 주소를 다시 확인해주세요. 4단계 ① Project URL 칸에 https://xxxx.supabase.co 형태의 주소가 그대로 들어가야 해요.");
      return;
    }
    const supabaseConf = {
      url: cleanUrl,
      anonKey: cleanKey,
      configId,
      rsvpToken: getOrCreateDirectRsvpToken(),
    };
    setFinishStatus("working");
    setFinishMsg("같이 쓰는 저장소를 확인하는 중...");

    try {
      const driver = createSupabaseStorage(cleanUrl, cleanKey, configId);

      // ── 블라인드 덮어쓰기 가드 ──
      // 같은 owner token 을 공유한 배우자가 먼저 원격을 채워뒀을 수 있다. 확인 없이 전환하면
      // 첫 save 가 원격을 이 기기의 데이터로 통째로 덮어쓴다.
      let remoteVersion: number | undefined;
      let remote: WeddingData | null = null;
      try {
        const remoteSnapshot = await driver.load();
        remoteVersion = remoteSnapshot?.version;
        remote = remoteSnapshot?.data ?? null;
      } catch { remote = null; }

      const localHasContent = hasContent(data);
      if (remote && hasContent(remote)) {
        const remoteData: WeddingData = {
          ...remote,
          preferences: { ...remote.preferences, mode: "supabase", supabase: supabaseConf, isDemo: false },
        };
        if (!localHasContent) {
          update(() => remoteData);
          markOwner();
          clearDraft();
          navigate("/dashboard");
          return;
        }
        const overwrite = confirm(
          "원격(내 사이트)에 이미 저장된 결혼식 데이터가 있어요.\n\n" +
          "확인 = 이 기기 데이터로 원격을 덮어씁니다 (원격 내용이 사라져요).\n" +
          "취소 = 원격 데이터를 이 기기로 가져옵니다 (이 기기 내용이 사라져요).",
        );
        if (!overwrite) {
          update(() => remoteData);
          markOwner();
          clearDraft();
          navigate("/dashboard");
          return;
        }
      }

      setFinishMsg("전환 전 백업을 만드는 중...");
      if (hasTransferableData(data)) {
        const backupResult = await exportData(data);
        if (backupResult === "cancelled") {
          setFinishStatus("idle");
          setFinishMsg("백업 저장을 취소해서 전환을 멈췄어요.");
          return;
        }
      }
      setFinishMsg("사진을 둘이 같이 볼 수 있는 형태로 변환하는 중...");
      // 모드 1 에서 IndexedDB 에 박힌 사진들은 다른 기기에서 못 푸므로,
      // supabase 로 전환할 때 base64 로 인라인해서 JSONB 동기화 가능한 형태로 변환.
      const migrated: WeddingData = await migrateImagesIdbToDataUrl(data);
      const nextData: WeddingData = {
        ...migrated,
        preferences: {
          ...migrated.preferences,
          mode: "supabase",
          supabase: supabaseConf,
          lastBackupAt: hasTransferableData(data)
            ? todayISO()
            : migrated.preferences.lastBackupAt,
        },
      };

      setFinishMsg("같이 쓰는 저장소에 저장하는 중...");
      // 이 기기를 "오너" 로 표시 — 저장 RPC도 같은 owner token 으로 검증된다.
      markOwner();
      const saved = await driver.save(nextData, remoteVersion);
      if (!saved.ok) {
        throw new Error(saved.conflict
          ? "저장소에 이미 다른 편집 내용이 들어와 있어요. 화면을 새로고침해 최신 상태를 받은 뒤 다시 시도해주세요. 이 기기의 데이터는 그대로 있어요."
          : "저장소에 저장하지 못했어요. 인터넷 연결을 확인하고 잠시 뒤 다시 시도해주세요. 계속 안 되면 4단계의 주소·키가 맞는지 다시 확인해주세요. 이 기기의 데이터는 그대로 있어요.");
      }

      setFinishMsg("저장된 데이터를 다시 확인하는 중...");
      const loaded = await driver.load();
      if (!loaded?.data) {
        throw new Error("저장은 됐는데 다시 읽어오는 단계에서 막혔어요. 잠시 뒤 [백업 후 완료]를 한 번 더 눌러주세요. 계속 같은 메시지가 나오면 상단 [도움 받기]로 알려주세요. 기존 로컬 데이터는 그대로 남아 있어요.");
      }

      update(() => nextData);
      clearDraft();
      navigate("/dashboard");
    } catch (e: any) {
      setFinishStatus("fail");
      setFinishMsg(e?.message ?? "전환 중간에 멈췄어요. 잠시 뒤 다시 시도하고, 계속 같으면 상단 [도움 받기]로 알려주세요. 기존 로컬 데이터는 그대로 남아 있어요.");
    }
  };
  const setupPrimaryAction =
    step < 3
      ? { label: "이 셋업 계속하기 →", onClick: continueSetup, tone: "primary" as const }
      : step === 3
        ? { label: sqlCopied ? "SQL 다시 복사하기 →" : "SQL 복사하기 →", onClick: copySQL, tone: "primary" as const }
        : step === 4
          ? { label: "연결 검사 실행 →", onClick: checkConnection, disabled: pingStatus === "checking", tone: "primary" as const }
          : { label: "백업 후 저장 시작 →", onClick: saveAndFinish, disabled: finishStatus === "working", tone: "primary" as const };

  return (
    <div className="page pt-8 pb-10 space-y-8 max-w-app mx-auto">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="eyebrow-gold mb-2">직접 저장소</div>
          <h1 className="font-serif text-[2rem] leading-none">{koBreak("직접 저장소 셋업")}</h1>
        </div>
        <a
          href={`mailto:yclee913@gmail.com?subject=${encodeURIComponent(`[Dearie] 셋업 ${step}단계 도움 요청`)}&body=${encodeURIComponent(`안녕하세요,\n\n셋업 ${step}단계에서 막혔어요. 다음 부분이 헷갈려요:\n\n[여기에 상황 적기]\n\n---\n현재 단계: ${step} / 5\n`)}`}
          className="text-[12px] text-soft underline underline-offset-4 hover:text-ink"
        >
          도움 받기 →
        </a>
      </div>

      <ProgressDots current={step} />

      <p className="text-[12.5px] text-soft leading-relaxed text-center">
        대부분의 사용자는 이 단계가 필요 없습니다.<br />
        직접 운영하고 싶은 경우에만 백업 → 사진 변환 → 저장 → 다시 확인 순서로 진행해요.
      </p>

      <ProcessAgentPanel
        title={pingStatus === "ok" ? "직접 저장소 연결을 확인했어요" : "직접 운영이 필요한지 먼저 분기할게요"}
        summary={setupAgentSummary}
        mood={pingStatus === "fail" ? "watching" : pingStatus === "ok" ? "ready" : "thinking"}
        metrics={[
          { label: "단계", value: `${step}/5`, hint: STEPS[step - 1]?.label },
          { label: "옮길 데이터", value: `${transferableCount}개`, tone: transferableCount > 0 ? "normal" : "muted" },
          { label: "연결", value: connectionState, tone: pingStatus === "fail" ? "warn" : pingStatus === "ok" ? "normal" : "muted" },
        ]}
        steps={[
          { label: "간편 링크로 충분한지 확인", detail: "청첩장 발행과 배우자 편집은 이 셋업 없이도 가능합니다.", done: true },
          { label: "SQL을 복사해 내 저장소에 설치", detail: "오너 토큰과 RSVP 토큰은 복사 시점에 안전하게 삽입됩니다.", done: step > 3 },
          { label: "URL과 anon key 연결 검사", detail: "공식 Supabase 도메인만 허용하고, 저장 전에 실제 연결을 확인합니다.", done: pingStatus === "ok" },
          { label: "백업 후 데이터 저장", detail: "사진을 온라인용으로 변환하고 다시 읽어오는 것까지 확인합니다.", done: data.preferences.mode === "supabase" },
        ]}
        actions={[
          setupPrimaryAction,
          { label: "간편 링크로 전환 →", onClick: () => navigate("/start-hosted") },
          { label: "청첩장 발행으로 이동 →", onClick: () => navigate("/invitation?edit=publish#publish-invitation") },
        ]}
      />

      <SetupChoiceNote />

      <TransferSummary data={data} />

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
      {step === 5 && (
        <Step5
          data={data}
          finishStatus={finishStatus}
          finishMsg={finishMsg}
          onFinish={saveAndFinish}
          onBack={() => setStep(4)}
        />
      )}
    </div>
  );
}

function SetupChoiceNote() {
  return (
    <div className="border-y border-hair py-4 space-y-3">
      <div>
        <div className="eyebrow-gold mb-2">먼저 확인</div>
        <p className="text-[12.5px] text-soft leading-relaxed">
          하객에게 보낼 청첩장 링크나 배우자와 함께 편집할 링크는 이 셋업 없이도 만들 수 있습니다.
          이 화면은 본인이 직접 외부 저장소를 만들고 운영하고 싶을 때만 사용해요.
        </p>
      </div>
      <div className="border-t border-hair divide-y divide-hair text-[12.5px]">
        <Link to="/invitation" className="flex items-baseline justify-between gap-4 py-3 text-ink hover:text-gold">
          <span>청첩장 링크만 만들기</span>
          <span className="text-soft">청첩장에서 발행 →</span>
        </Link>
        <Link to="/start-hosted" className="flex items-baseline justify-between gap-4 py-3 text-ink hover:text-gold">
          <span>배우자와 같이 편집하기</span>
          <span className="text-soft">링크 만들기 →</span>
        </Link>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <span className="text-ink">내 저장소를 직접 만들기</span>
          <span className="text-soft">아래 5단계 진행</span>
        </div>
      </div>
    </div>
  );
}

function dataCounts(data: WeddingData) {
  const checklistItems = data.checklist.reduce((n, s) => n + s.items.length, 0);
  const gallery = data.invitation.gallery?.length ?? 0;
  const videoPhotos = data.video.photos.length;
  return {
    invitation: [
      data.invitation.groomName,
      data.invitation.brideName,
      data.invitation.date,
      data.invitation.venue,
      data.invitation.greeting,
    ].filter(Boolean).length,
    checklistItems,
    venues: data.venues?.length ?? 0,
    budget: data.budget?.length ?? 0,
    guests: data.guests?.length ?? 0,
    rings: data.rings.length,
    trip: data.honeymoon.regions.length + data.flights.length + data.hotels.length,
    sdm: data.sdm.length,
    photos: (data.invitation.heroImageUrl ? 1 : 0) + gallery + videoPhotos,
  };
}

function hasTransferableData(data: WeddingData): boolean {
  const c = dataCounts(data);
  return Object.values(c).some((n) => n > 0);
}

function TransferSummary({ data }: { data: WeddingData }) {
  const counts = dataCounts(data);
  const rows = [
    ["청첩장 정보", counts.invitation],
    ["체크리스트", counts.checklistItems],
    ["예식장 후보", counts.venues],
    ["예산 항목", counts.budget],
    ["하객", counts.guests],
    ["반지 후보", counts.rings],
    ["여행 후보", counts.trip],
    ["스드메·스냅", counts.sdm],
    ["사진", counts.photos],
  ] as const;

  return (
    <div className="border-y border-hair py-4">
      <div className="eyebrow-gold mb-3">옮겨갈 데이터</div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-3">
        {rows.map(([label, count]) => (
          <div key={label}>
            <div className="font-serif text-xl text-ink tabular-nums">{count}</div>
            <div className="text-[12px] text-soft leading-tight">{label}</div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-soft leading-relaxed mt-4">
          완료 전까지 기존 로컬 데이터는 지우지 않습니다. 사진은 둘이 같이 볼 수 있도록 변환하고,
        변환할 수 없는 사진이 있으면 백업 단계에서 알려줍니다.
      </p>
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
    <StepCard icon="01" title={koBreak("저장소 계정 만들기")}>
      <p className="text-sm text-soft leading-relaxed">
        Supabase라는 외부 서비스를 써서 결혼식 정보·청첩장·하객 RSVP를 저장하고 동기화합니다.
        작은 개인 사이트는 보통 무료 플랜 범위에서 시작할 수 있지만,
        한도와 휴면 정책은 서비스 정책에 따라 바뀔 수 있습니다.
      </p>

      <div className="py-4 border-y border-hair text-[13px] space-y-2">
        <p className="font-medium">👉 따라하기</p>
        <ol className="space-y-1.5 list-decimal list-inside text-soft">
          <li>아래 [저장소 계정 만들기] 버튼 클릭</li>
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
        저장소 계정 만들기 ↗
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
    <StepCard icon="02" title={koBreak("새 저장 공간 만들기")}>
      <p className="text-sm text-soft leading-relaxed">
        Supabase 대시보드에서 결혼식 정보를 담을 빈 공간을 만들어요.
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
    <StepCard icon="03" title={koBreak("테이블 만들기 (SQL 한 번)")}>
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
    <StepCard icon="04" title={koBreak("연결 정보 가져오기")}>
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
        <label className="label">② 공개 키 <span className="text-mute normal-case tracking-normal">(anon public)</span></label>
        <input
          className="input text-[12px]"
          value={anonKey}
          onChange={(e) => setAnonKey(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        />
        <p className="text-[11px] text-soft mt-1">긴 문자열이에요 (eyJ 로 시작).</p>
      </div>

      <div className="pl-4 border-l-2 border-sage/60 text-[12px] space-y-1 leading-relaxed">
        <p className="text-ink"><b>안심하세요 —</b> 위 화면의 <b>anon public</b> 키 하나만 쓰면 돼요.</p>
        <p className="text-soft">
          바로 아래 <b className="text-ink">service_role</b> 키는 쓰지 않아요. 모든 데이터에 접근하는
          관리자용이라, 공개되는 앱에는 넣지 않습니다.
        </p>
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
          <p className="text-ink font-medium">아직 연결되지 않았어요</p>
          <p className="text-[11.5px] text-soft mt-1">{msg}</p>
          <p className="text-[11.5px] text-soft mt-2 leading-relaxed">
            급한 문제는 아니에요. 아래를 위에서부터 하나씩 확인하면 대부분 풀려요.<br />
            <b className="text-ink">1.</b> ① 주소와 ② 키를 다시 붙여넣기 — 앞뒤 공백·줄바꿈이 섞이지 않게.<br />
            <b className="text-ink">2.</b> ② 키가 <b className="text-ink">anon public</b> 키가 맞는지 (service_role 아님, eyJ 로 시작).<br />
            <b className="text-ink">3.</b> 3단계 SQL 이 초록색 Success 로 끝났는지 — 안 됐으면 다시 실행.<br />
            <b className="text-ink">4.</b> 위 세 가지를 맞춘 뒤 [연결 확인]을 다시 눌러주세요.
          </p>
          <p className="text-[11.5px] text-soft mt-2 leading-relaxed">
            그래도 안 되면 화면 상단 <b className="text-ink">[도움 받기]</b> 로 어떤 메시지가 떴는지만 적어 보내주세요.
          </p>
        </div>
      )}

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={status !== "ok"} />
    </StepCard>
  );
}

// ─── Step 5: 저장 + 배포 ───
function Step5({
  data, finishStatus, finishMsg, onFinish, onBack,
}: {
  data: WeddingData;
  finishStatus: "idle" | "working" | "fail";
  finishMsg: string;
  onFinish: () => void;
  onBack: () => void;
}) {
  const hasData = hasTransferableData(data);
  return (
    <StepCard icon="05" title="백업하고 둘이 쓰기로 전환하기">
      <div className="pl-4 border-l-2 border-sage text-[13px] space-y-2">
        <p className="text-ink"><b>완료를 누르면 전환을 안전 순서로 진행합니다.</b></p>
        <p className="text-[12px] text-soft leading-relaxed">
          {hasData
            ? "백업 파일을 먼저 만들고, 같이 쓰는 저장소에 옮긴 뒤 다시 읽어서 확인합니다."
            : "아직 입력한 데이터가 거의 없어서 바로 같이 쓰는 저장을 시작합니다."}
        </p>
      </div>

      <div className="py-4 border-y border-hair text-[13px] space-y-2">
        <p className="font-serif text-[15px] text-ink">둘이 쓰기에서 가능해지는 것</p>
        <p className="text-soft text-[12px] leading-relaxed">
          신랑·신부가 각자 폰에서 같은 데이터를 보고, RSVP와 준비 현황을 함께 관리할 수 있습니다.
          공개 청첩장은 필요한 정보만 읽고 예산·하객 명단·체크리스트는 공개하지 않습니다.
        </p>
      </div>

      <div className="pl-4 border-l-2 border-gold/50 text-[12px] text-soft leading-relaxed">
        저장 후 다시 읽어서 확인될 때만 저장 방식이 바뀝니다.
        중간에 실패하면 이 기기의 기존 데이터는 그대로 남습니다.
      </div>

      <a
        href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcommet%2Fwedding-os"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] underline underline-offset-4 text-ink hover:text-gold inline-block"
      >
        Vercel 1-클릭 배포 열기 ↗
      </a>

      <p className="text-[11px] text-soft leading-relaxed">
        직접 배포할 때는 Vercel 환경변수를 확인해주세요.<br />
        <code className="bg-cream px-1">BLOB_READ_WRITE_TOKEN</code>은 간편 청첩장 발행·RSVP에 필요하고,<br />
        <code className="bg-cream px-1">VITE_SUPABASE_URL</code> · <code className="bg-cream px-1">VITE_SUPABASE_ANON_KEY</code>는 같이 쓰는 저장소 기본 연결에 씁니다.
      </p>

      {finishMsg && (
        <div className={`border-y border-hair py-3 text-[12px] leading-relaxed ${finishStatus === "fail" ? "text-gold" : "text-soft"}`}>
          {finishMsg}
        </div>
      )}

      <NavButtons
        onBack={onBack}
        onNext={onFinish}
        nextLabel={finishStatus === "working" ? "전환 중..." : "백업 후 완료 ✓"}
        nextDisabled={finishStatus === "working"}
      />
    </StepCard>
  );
}
