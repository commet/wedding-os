// 간편(hosted) 모드 시작 — 운영자 호스팅 + 종단간 암호화.
//
// 1) weddingId·weddingKey 생성 + ownerToken 확보 → 시크릿에 저장
// 2) mode='hosted' 로 전환 (현재 로컬/데모 데이터를 이어받아 첫 save 가 암호화 푸시)
// 3) 복구 링크를 보여주고 "저장하세요" — 이 링크가 기기교체 복구 + 부부 공유의 열쇠

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import { defaultData } from "../lib/schema";
import { defaultChecklist } from "../data/checklistTemplate";
import {
  bindHostedUser, clearHostedConfig, getHostedConfig, getOrCreateOwnerToken, getOwnerToken,
  hostedUserMatches, setHostedConfig, markOwner,
} from "../lib/security";
import {
  buildProtectedRecoveryLink,
  generateWeddingId,
  generateWeddingKeyRaw,
  suggestSharePassword,
  validateSharePassword,
  type RecoveryBundle,
} from "../lib/recovery";
import { authAvailable, currentAccessToken, currentUserId } from "../lib/auth";
import { createHostedStorage } from "../lib/storage.hosted";
import { migrateImagesIdbToDataUrl, stripUnresolvedIdb } from "../lib/imageStore";
import { koBreak } from "../lib/typography";

type Props = { data: WeddingData; update: (patch: any) => void };

export default function HostedStart({ data, update }: Props) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"intro" | "done">(
    data.preferences.mode === "hosted" && getHostedConfig() ? "done" : "intro",
  );
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [sharePasswordConfirm, setSharePasswordConfirm] = useState("");
  const [copied, setCopied] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [error, setError] = useState("");
  const portableItems =
    (data.venues?.length ?? 0) +
    (data.budget?.length ?? 0) +
    (data.guests?.length ?? 0) +
    data.rings.length +
    data.sdm.length +
    data.checklist.reduce((sum, section) => sum + section.items.length, 0) +
    data.honeymoon.regions.length +
    data.flights.length +
    data.hotels.length +
    (data.invitation.groomName || data.invitation.brideName || data.invitation.date || data.invitation.venue ? 1 : 0);

  const start = async () => {
    if (!authAvailable()) return; // 온라인 동기화 미설정 — 가장하지 않음
    const passwordError = validateSharePassword(sharePassword, sharePasswordConfirm);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setBusy(true);
    setError("");
    let stagedConfig = false;
    try {
      const accessToken = await currentAccessToken();
      if (!accessToken) {
        navigate(`/login?next=${encodeURIComponent("/start-hosted")}`);
        return;
      }
      const userId = await currentUserId();
      if (!userId) throw new Error("로그인 세션을 확인하지 못했습니다. 다시 로그인해주세요.");
      if (!hostedUserMatches(userId)) throw new Error("이 기기의 청첩장은 다른 로그인 계정에 연결되어 있습니다. 먼저 로그아웃 후 기기 데이터를 지워주세요.");

      // 새 전환은 항상 새 자격증명을 만든다. 로컬에 임시 저장해 저장 가능 여부를 먼저 확인하고,
      // 첫 원격 저장이 실패하면 catch 에서 제거한다.
      const cfg = data.preferences.mode === "hosted" ? getHostedConfig() : undefined;
      const nextConfig = cfg ?? { weddingId: generateWeddingId(), weddingKey: await generateWeddingKeyRaw() };
      if (!setHostedConfig(nextConfig)) throw new Error("이 기기에 복구 권한을 저장할 수 없습니다. 브라우저 저장 공간을 확인해주세요.");
      stagedConfig = !cfg;
      if (!bindHostedUser(userId)) throw new Error("이 기기에 계정 소유권을 안전하게 저장하지 못했습니다.");
      const ownerToken = getOrCreateOwnerToken();
      if (getOwnerToken() !== ownerToken) throw new Error("이 기기에 편집 권한을 저장할 수 없습니다. 브라우저 저장 공간을 확인해주세요.");

      // 2) mode='hosted' 로 전환 — 데모면 새로 시작, 아니면 기존 데이터 이어받음.
      const base = data.preferences.isDemo
        ? { ...defaultData(), checklist: defaultChecklist() }
        : { ...data, checklist: data.checklist.length ? data.checklist : defaultChecklist(data.invitation.date) };
      const portable = await migrateImagesIdbToDataUrl(base);
      const unresolved = stripUnresolvedIdb(portable);
      if (unresolved.removed > 0) {
        throw new Error(`사진 ${unresolved.removed}장을 온라인용으로 변환하지 못했습니다. 원본 사진을 확인한 뒤 다시 시도해주세요.`);
      }
      const next = { ...portable, preferences: { ...portable.preferences, mode: "hosted" as const, isDemo: false } };
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (!url || !anonKey) throw new Error("온라인 저장소 설정이 없습니다.");
      const firstSave = await createHostedStorage(
        url, anonKey, nextConfig.weddingId, nextConfig.weddingKey, ownerToken, accessToken,
      ).save(next);
      if (!firstSave.ok) throw new Error("온라인 저장소에 처음 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      markOwner();
      update(() => next);

      // 3) 복구 링크 — ownerToken+weddingKey 는 공유 비밀번호로 감싼다.
      setLink(await buildProtectedRecoveryLink(
        { weddingId: nextConfig.weddingId, ownerToken, weddingKey: nextConfig.weddingKey },
        sharePassword,
      ));
      setPhase("done");
    } catch (e: any) {
      if (stagedConfig) clearHostedConfig();
      setError(e?.message ?? "함께 편집 링크를 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const currentBundle = (): RecoveryBundle | null => {
    const cfg = getHostedConfig();
    if (!cfg) return null;
    return { weddingId: cfg.weddingId, ownerToken: getOrCreateOwnerToken(), weddingKey: cfg.weddingKey };
  };

  const makeProtectedLink = async () => {
    const passwordError = validateSharePassword(sharePassword, sharePasswordConfirm);
    if (passwordError) {
      setError(passwordError);
      return "";
    }
    const bundle = currentBundle();
    if (!bundle) {
      setError("복구 정보를 찾지 못했어요. 함께 편집 만들기를 다시 시작해주세요.");
      return "";
    }
    setBusy(true);
    setError("");
    try {
      const protectedLink = await buildProtectedRecoveryLink(bundle, sharePassword);
      setLink(protectedLink);
      return protectedLink;
    } catch (err: any) {
      setError(err?.message ?? "보호 링크를 만들지 못했어요.");
      return "";
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const protectedLink = link || await makeProtectedLink();
    if (!protectedLink) return;
    if (!confirm(
      "이 링크는 공유 비밀번호 없이는 열리지 않아요.\n\n" +
      "그래도 링크와 비밀번호를 함께 공개된 곳에 올리면 누구나 들어올 수 있어요.\n" +
      "배우자에게만 1:1로 보내고, 가능하면 비밀번호는 다른 메시지로 전달하세요.\n\n" +
      "복사할까요?",
    )) return;
    try {
      await navigator.clipboard.writeText(protectedLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt("아래 보호 복구 링크를 복사해 안전한 곳에 저장하세요:", protectedLink);
    }
  };

  const copyPassword = async () => {
    const passwordError = validateSharePassword(sharePassword, sharePasswordConfirm);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    try {
      await navigator.clipboard.writeText(sharePassword);
      setPasswordCopied(true);
      window.setTimeout(() => setPasswordCopied(false), 2400);
    } catch {
      window.prompt("배우자에게 따로 보낼 공유 비밀번호입니다:", sharePassword);
    }
  };

  const applySuggestedPassword = () => {
    const suggested = suggestSharePassword();
    setSharePassword(suggested);
    setSharePasswordConfirm(suggested);
    setLink("");
    setCopied(false);
    setPasswordCopied(false);
    setError("");
  };
  const changeSharePassword = (value: string) => {
    setSharePassword(value);
    setLink("");
    setCopied(false);
    setPasswordCopied(false);
  };
  const changeSharePasswordConfirm = (value: string) => {
    setSharePasswordConfirm(value);
    setLink("");
    setCopied(false);
    setPasswordCopied(false);
  };

  // 온라인 동기화(운영자 Supabase)가 아직 연결 안 됨 — 가장하지 않고 정직하게.
  if (!authAvailable() && phase === "intro") {
    return (
      <div className="page max-w-app mx-auto pt-16 pb-16 space-y-8">
        <div className="eyebrow-gold mb-3">함께 편집</div>
        <h1 className="font-serif text-[1.9rem] leading-tight">{koBreak("아직 준비 중이에요")}</h1>
        <ProcessAgentPanel
          title="온라인 함께 편집을 기다리는 중"
          summary="지금은 이 기기의 로컬 데이터가 안전하게 유지되고 있어요. 온라인 저장소가 열리면 같은 데이터를 이어받아 편집 링크를 만들 수 있습니다."
          mood="watching"
          metrics={[
            { label: "온라인", value: "대기", tone: "warn" },
            { label: "이 기기", value: "저장" },
            { label: "옮길 데이터", value: `${portableItems}개`, tone: portableItems > 0 ? "normal" : "muted" },
          ]}
          steps={[
            { label: "현재 데이터 유지", detail: "준비 내용은 이 기기에 계속 남아 있습니다.", done: true },
            { label: "함께 편집 가능 시 링크 생성", detail: "그때 복구 링크와 편집 링크를 한 번에 만들 수 있어요." },
          ]}
          actions={[
            { label: "대시보드로 돌아가기 →", onClick: () => navigate("/dashboard"), tone: "primary" },
            { label: "암호화 방식 확인 →", onClick: () => navigate("/trust") },
          ]}
        />
        <p className="text-[13px] text-soft leading-relaxed">
          온라인 함께 편집 기능은 곧 열려요. 지금까지 입력한 내용은 <b className="text-ink">이 기기에 안전하게 저장</b>돼 있어요 —
          그대로 계속 쓰시면 됩니다.
        </p>
        <button onClick={() => navigate("/dashboard")} className="btn-primary px-8 py-3.5 text-[13px]">
          대시보드로 →
        </button>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="page max-w-app mx-auto pt-12 pb-16">
        <div className="eyebrow-gold mb-3">함께 편집 · 다른 기기</div>
        <h1 className="font-serif text-[2rem] leading-[1.12] mb-5">
          {koBreak("배우자와 함께,")}<br />{koBreak("다른 기기에서도.")}
        </h1>
        <ProcessAgentPanel
          title="편집 링크를 만들 준비를 하고 있어요"
          summary="현재 데이터를 온라인용으로 옮길 수 있는지 확인한 뒤, 둘이 같이 쓰는 복구·편집 링크를 만듭니다."
          mood="thinking"
          metrics={[
            { label: "로그인", value: "필요", tone: "warn" },
            { label: "옮길 데이터", value: `${portableItems}개`, tone: portableItems > 0 ? "normal" : "muted" },
            { label: "보안", value: "암호화" },
          ]}
          steps={[
            { label: "로그인으로 소유자 확인", detail: "다른 기기 복구를 위해 먼저 계정을 확인합니다." },
            { label: "사진과 준비 데이터를 온라인용으로 변환", detail: "변환할 수 없는 사진이 있으면 중간에 멈추고 알려줍니다." },
            { label: "공유 비밀번호로 링크 잠금", detail: "링크만으로는 열리지 않게 편집 권한을 한 번 더 감쌉니다." },
            { label: "배우자에게 보낼 편집 링크 생성", detail: "하객용 청첩장 링크와 다른, 오너 권한 링크입니다." },
          ]}
          actions={[
            { label: "링크 생성 시작 →", onClick: start, disabled: busy, tone: "primary" },
            { label: "암호화 확인 →", onClick: () => navigate("/trust") },
            { label: "나중에 대시보드로 →", onClick: () => navigate("/dashboard") },
          ]}
        />
        <ul className="space-y-3 text-[13px] text-soft leading-relaxed mb-8 border-y border-hair py-6">
          <li>· 링크 하나로 <b className="text-ink">둘이 같이 편집</b>해요.</li>
          <li>· 폰을 바꿔도 그 링크로 <b className="text-ink">그대로 이어서</b> 써요.</li>
          <li>· 이제 링크는 <b className="text-ink">공유 비밀번호</b> 없이는 열리지 않아요.</li>
          <li>· 내용은 이 기기에서 <b className="text-ink">암호화</b>되어 올라가, 운영자도 못 봐요. <button onClick={() => navigate("/trust")} className="underline underline-offset-2 hover:text-ink">확인</button></li>
        </ul>
        <SharePasswordFields
          password={sharePassword}
          confirmPassword={sharePasswordConfirm}
          onPassword={changeSharePassword}
          onConfirmPassword={changeSharePasswordConfirm}
          onSuggest={applySuggestedPassword}
        />
        <button onClick={start} disabled={busy} className="btn-primary w-full py-4 text-[13px] disabled:opacity-50">
          {busy ? "준비 중…" : "비밀번호 잠그고 함께 시작 →"}
        </button>
        {error && <p className="mt-3 text-[12px] text-gold leading-relaxed">{error}</p>}
        <button onClick={() => navigate("/dashboard")} className="block w-full mt-4 text-center text-[12px] text-soft underline underline-offset-4 hover:text-ink">
          나중에
        </button>
      </div>
    );
  }

  // done — 초대/이어쓰기 링크
  const maskedLink = link ? `${window.location.origin}/recover#…${link.slice(-8)}` : "공유 비밀번호를 정하면 보호 링크가 만들어져요.";
  return (
    <div className="page max-w-app mx-auto pt-12 pb-16">
      <div className="eyebrow-gold mb-3">준비됐어요</div>
      <h1 className="font-serif text-[1.9rem] leading-[1.12] mb-4">
        {koBreak("이 링크를")}<br /><span className="text-gold">배우자에게</span> {koBreak("보내세요.")}
      </h1>
      <ProcessAgentPanel
        title={link ? "함께 편집 링크가 준비됐어요" : "공유 비밀번호를 먼저 정해주세요"}
        summary={link
          ? "이 링크는 복구와 편집 권한을 담지만, 공유 비밀번호 없이는 열리지 않아요. 배우자에게만 1:1로 보내고 하객용 청첩장 링크와 섞지 마세요."
          : "이미 온라인 준비판은 만들어졌어요. 이제 배우자에게 보낼 보호 링크를 만들 공유 비밀번호만 정하면 됩니다."}
        mood="ready"
        metrics={[
          { label: "편집 링크", value: link ? "잠금 완료" : "비밀번호 필요", tone: link ? "normal" : "warn" },
          { label: "옮긴 데이터", value: `${portableItems}개`, tone: portableItems > 0 ? "normal" : "muted" },
          { label: "공유 범위", value: "배우자" },
        ]}
        steps={[
          { label: "공유 비밀번호로 링크 잠금", detail: "링크만 받은 사람은 준비판을 열 수 없습니다.", done: !!link },
          { label: "복구·편집 링크 복사", detail: "기기를 바꿔도 같은 링크로 이어서 사용할 수 있습니다.", done: copied },
          { label: "비밀번호는 따로 전달", detail: "같은 단톡방이나 공개된 캡처에 같이 두지 않는 편이 안전합니다.", done: passwordCopied },
          { label: "하객용 청첩장 링크는 별도 발행", detail: "공개 링크는 청첩장 발행 화면에서 만듭니다." },
        ]}
        actions={[
          { label: copied ? "초대 링크 복사됨" : link ? "초대 링크 다시 복사 →" : "보호 링크 만들기 →", onClick: copy, disabled: busy, tone: "primary" },
          { label: passwordCopied ? "비밀번호 복사됨" : "비밀번호 따로 복사 →", onClick: copyPassword },
          { label: "하객 링크 발행 →", onClick: () => navigate("/invitation?edit=publish#publish-invitation") },
          { label: "홈으로 돌아가기 →", onClick: () => navigate("/dashboard") },
        ]}
      />
      <p className="text-[13px] text-soft leading-relaxed mb-5">
        이 링크로 <b className="text-ink">둘이 같이 편집</b>하고, 기기를 바꿔도 <b className="text-ink">이어서</b> 써요.
        링크와 공유 비밀번호를 모두 가진 사람만 열 수 있어요.
      </p>

      {!link && (
        <div className="mb-5">
          <SharePasswordFields
            password={sharePassword}
            confirmPassword={sharePasswordConfirm}
            onPassword={changeSharePassword}
            onConfirmPassword={changeSharePasswordConfirm}
            onSuggest={applySuggestedPassword}
          />
        </div>
      )}

      <div className="border-y border-hair py-3 mb-4">
        <div className="eyebrow-gold mb-1.5">비밀번호 보호 링크</div>
        <div className="text-[11.5px] text-ink break-all leading-relaxed font-mono">{maskedLink}</div>
        <p className="mt-2 text-[11px] leading-relaxed text-soft">
          링크에는 편집 권한이 암호문으로 들어갑니다. 공유 비밀번호 없이는 풀 수 없어요.
        </p>
      </div>

      <button onClick={copy} disabled={busy} className="btn-primary w-full py-3.5 text-[13px] disabled:opacity-50">
        {copied ? "복사됨 ✓ — 배우자에게 보내세요" : link ? "보호 링크 복사" : "보호 링크 만들고 복사"}
      </button>
      {link && (
        <button onClick={copyPassword} className="block w-full mt-3 text-center text-[12.5px] text-ink underline underline-offset-4 hover:text-gold">
          {passwordCopied ? "비밀번호 복사됨 ✓" : "공유 비밀번호 따로 복사"}
        </button>
      )}

      <div className="mt-5 paper-card px-4 py-3 bg-cream/40">
        <p className="text-[11.5px] text-soft leading-relaxed">
          링크와 비밀번호가 함께 노출되면 같은 권한을 가집니다. <b className="text-ink">배우자에게만</b> 보내고,
          단톡방·SNS엔 올리지 마세요.
        </p>
      </div>

      <button onClick={() => navigate("/login")} className="block w-full mt-6 text-center text-[12.5px] text-ink underline underline-offset-4 hover:text-gold">
        ＋ 카카오·이메일 로그인 — 링크 안 챙겨도 다른 기기서 복구
      </button>
      <button onClick={() => navigate("/dashboard")} className="block w-full mt-4 text-center text-[13px] text-soft underline underline-offset-4 hover:text-ink">
        완료 — 대시보드로 →
      </button>
    </div>
  );
}

function SharePasswordFields({
  password,
  confirmPassword,
  onPassword,
  onConfirmPassword,
  onSuggest,
}: {
  password: string;
  confirmPassword: string;
  onPassword: (value: string) => void;
  onConfirmPassword: (value: string) => void;
  onSuggest: () => void;
}) {
  return (
    <div className="border-y border-hair py-5 space-y-4">
      <div>
        <div className="eyebrow-gold mb-2">공유 비밀번호</div>
        <p className="text-[12.5px] leading-relaxed text-soft">
          배우자가 링크를 열 때 한 번 입력합니다. 6자 이상으로, 너무 흔한 말은 피해주세요.
        </p>
        <button
          type="button"
          onClick={onSuggest}
          className="mt-3 min-h-10 text-[12px] text-ink underline underline-offset-4 hover:text-gold"
        >
          Dearie 추천 비밀번호 넣기 →
        </button>
      </div>
      <input
        type="password"
        value={password}
        onChange={(event) => onPassword(event.target.value)}
        placeholder="예: 091391"
        autoComplete="new-password"
        className="input-boxed text-[13px]"
      />
      <input
        type="password"
        value={confirmPassword}
        onChange={(event) => onConfirmPassword(event.target.value)}
        placeholder="한 번 더 입력"
        autoComplete="new-password"
        className="input-boxed text-[13px]"
      />
      <p className="text-[11px] leading-relaxed text-soft">
        링크와 비밀번호는 가능하면 다른 메시지로 보내세요. 둘 다 가진 사람은 준비판을 볼 수 있습니다.
      </p>
    </div>
  );
}
