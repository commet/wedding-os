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

  if (phase === "intro") {
    return (
      <div className="page max-w-app mx-auto pt-12 pb-16">
        <div className="eyebrow-gold mb-3">간편 모드</div>
        <h1 className="font-serif text-[2rem] leading-[1.12] mb-5">
          쉽게, 함께.<br />운영자도 못 봐요.
        </h1>
        <ul className="space-y-3 text-[13px] text-soft leading-relaxed mb-8 border-y border-hair py-6">
          <li>· 가입 없이 시작 — 바로 링크 하나로 부부가 함께 편집해요.</li>
          <li>· 모든 내용은 <b className="text-ink">이 기기에서 암호화</b>되어 올라가요. 운영자 서버엔 암호문만.</li>
          <li>· 기기를 바꿔도 <b className="text-ink">복구 링크</b>로 그대로 이어받아요.</li>
        </ul>
        <button onClick={start} disabled={busy} className="btn-primary w-full py-4 text-[13px] disabled:opacity-50">
          {busy ? "준비 중…" : "간편 모드로 시작 →"}
        </button>
        <button onClick={() => navigate("/trust")} className="block w-full mt-4 text-center text-[12px] text-soft underline underline-offset-4 hover:text-ink">
          🔒 운영자가 정말 못 보나요? — 직접 확인
        </button>
      </div>
    );
  }

  // done — 복구 링크 저장 단계
  return (
    <div className="page max-w-app mx-auto pt-12 pb-16">
      <div className="eyebrow-gold mb-3">간편 모드 시작됨</div>
      <h1 className="font-serif text-[1.9rem] leading-[1.12] mb-4">
        이 링크가<br /><span className="text-gold">당신의 열쇠</span>예요.
      </h1>
      <p className="text-[13px] text-soft leading-relaxed mb-5">
        <b className="text-ink">꼭 저장하세요.</b> 기기를 바꾸면 이 링크로 복구하고, 배우자에게 보내면 함께 편집해요.
        운영자는 이 링크를 볼 수 없어, 잃어버리면 복구를 도와드릴 수 없어요.
      </p>

      <div className="border-y border-hair py-3 mb-4">
        <div className="eyebrow-gold mb-1.5">복구 링크</div>
        <div className="text-[11.5px] text-ink break-all leading-relaxed font-mono">{link}</div>
      </div>

      <button onClick={copy} className="btn-primary w-full py-3.5 text-[13px]">
        {copied ? "복사됨 ✓" : "복구 링크 복사"}
      </button>

      <div className="mt-5 paper-card px-4 py-3 bg-cream/40">
        <p className="text-[11.5px] text-soft leading-relaxed">
          ⚠️ 이 링크는 데이터 전체의 열쇠예요. <b className="text-ink">배우자에게만 1:1로</b> 보내고,
          단톡방·SNS·공개된 곳엔 올리지 마세요.
        </p>
      </div>

      <button onClick={() => navigate("/login")} className="block w-full mt-6 text-center text-[12.5px] text-ink underline underline-offset-4 hover:text-gold">
        ＋ 이메일로 로그인 연결 (링크 안 잃어도 복구 — 권장)
      </button>
      <button onClick={() => navigate("/dashboard")} className="block w-full mt-4 text-center text-[13px] text-soft underline underline-offset-4 hover:text-ink">
        저장했어요 — 대시보드로 →
      </button>
    </div>
  );
}
