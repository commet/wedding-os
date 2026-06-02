// 간편(hosted) 모드 시작 — 운영자 호스팅 + 종단간 암호화.
//
// 1) weddingId·weddingKey 생성 + ownerToken 확보 → 시크릿에 저장
// 2) mode='hosted' 로 전환 (현재 로컬/데모 데이터를 이어받아 첫 save 가 암호화 푸시)
// 3) 복구 링크를 보여주고 "저장하세요" — 이 링크가 기기교체 복구 + 부부 공유의 열쇠

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { defaultData } from "../lib/schema";
import { defaultChecklist } from "../data/checklistTemplate";
import {
  getHostedConfig, setHostedConfig, getOrCreateOwnerToken, markOwner,
} from "../lib/security";
import { generateWeddingId, generateWeddingKeyRaw, buildRecoveryLink } from "../lib/recovery";
import { authAvailable } from "../lib/auth";

type Props = { data: WeddingData; update: (patch: any) => void };

export default function HostedStart({ data, update }: Props) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"intro" | "done">(getHostedConfig() ? "done" : "intro");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(() => {
    const cfg = getHostedConfig();
    return cfg ? buildRecoveryLink({ weddingId: cfg.weddingId, ownerToken: getOrCreateOwnerToken(), weddingKey: cfg.weddingKey }) : "";
  });
  const [copied, setCopied] = useState(false);

  const start = async () => {
    if (!authAvailable()) return; // 온라인 동기화 미설정 — 가장하지 않음
    setBusy(true);
    try {
      // 1) 자격증명 생성·저장 (update 전에 — selectDriver 가 즉시 hosted 로 붙도록)
      let cfg = getHostedConfig();
      if (!cfg) {
        const weddingId = generateWeddingId();
        const weddingKey = await generateWeddingKeyRaw();
        setHostedConfig({ weddingId, weddingKey });
        cfg = { weddingId, weddingKey };
      }
      const ownerToken = getOrCreateOwnerToken();
      markOwner();

      // 2) mode='hosted' 로 전환 — 데모면 새로 시작, 아니면 기존 데이터 이어받음.
      update((prev: WeddingData) => {
        const base = prev.preferences.isDemo
          ? { ...defaultData(), checklist: defaultChecklist() }
          : { ...prev, checklist: prev.checklist.length ? prev.checklist : defaultChecklist(prev.invitation.date) };
        return { ...base, preferences: { ...base.preferences, mode: "hosted", isDemo: false } };
      });

      // 3) 복구 링크
      setLink(buildRecoveryLink({ weddingId: cfg.weddingId, ownerToken, weddingKey: cfg.weddingKey }));
      setPhase("done");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt("아래 복구 링크를 복사해 안전한 곳에 저장하세요:", link);
    }
  };

  // 온라인 동기화(운영자 Supabase)가 아직 연결 안 됨 — 가장하지 않고 정직하게.
  if (!authAvailable() && phase === "intro") {
    return (
      <div className="page max-w-app mx-auto pt-16 pb-16 text-center">
        <div className="eyebrow-gold mb-3">함께 편집</div>
        <h1 className="font-serif text-[1.9rem] leading-tight mb-4">아직 준비 중이에요</h1>
        <p className="text-[13px] text-soft leading-relaxed mb-8">
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
          배우자와 함께,<br />다른 기기에서도.
        </h1>
        <ul className="space-y-3 text-[13px] text-soft leading-relaxed mb-8 border-y border-hair py-6">
          <li>· 링크 하나로 <b className="text-ink">둘이 같이 편집</b>해요.</li>
          <li>· 폰을 바꿔도 그 링크로 <b className="text-ink">그대로 이어서</b> 써요.</li>
          <li>· 내용은 이 기기에서 <b className="text-ink">암호화</b>되어 올라가, 운영자도 못 봐요. <button onClick={() => navigate("/trust")} className="underline underline-offset-2 hover:text-ink">확인</button></li>
        </ul>
        <button onClick={start} disabled={busy} className="btn-primary w-full py-4 text-[13px] disabled:opacity-50">
          {busy ? "준비 중…" : "함께 편집할 링크 만들기 →"}
        </button>
        <button onClick={() => navigate("/dashboard")} className="block w-full mt-4 text-center text-[12px] text-soft underline underline-offset-4 hover:text-ink">
          나중에
        </button>
      </div>
    );
  }

  // done — 초대/이어쓰기 링크
  return (
    <div className="page max-w-app mx-auto pt-12 pb-16">
      <div className="eyebrow-gold mb-3">준비됐어요</div>
      <h1 className="font-serif text-[1.9rem] leading-[1.12] mb-4">
        이 링크를<br /><span className="text-gold">배우자에게</span> 보내세요.
      </h1>
      <p className="text-[13px] text-soft leading-relaxed mb-5">
        이 링크로 <b className="text-ink">둘이 같이 편집</b>하고, 기기를 바꿔도 <b className="text-ink">이어서</b> 써요.
        안전한 곳에 보관하세요 — 운영자는 이 링크 없이는 내용을 못 봐요.
      </p>

      <div className="border-y border-hair py-3 mb-4">
        <div className="eyebrow-gold mb-1.5">초대 · 이어쓰기 링크</div>
        <div className="text-[11.5px] text-ink break-all leading-relaxed font-mono">{link}</div>
      </div>

      <button onClick={copy} className="btn-primary w-full py-3.5 text-[13px]">
        {copied ? "복사됨 ✓ — 배우자에게 보내세요" : "링크 복사"}
      </button>

      <div className="mt-5 paper-card px-4 py-3 bg-cream/40">
        <p className="text-[11.5px] text-soft leading-relaxed">
          이 링크를 가진 사람은 함께 편집할 수 있어요. <b className="text-ink">배우자에게만</b> 보내고,
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
