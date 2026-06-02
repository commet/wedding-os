import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { exportData, importData, purgeServerData } from "../lib/storage";
import { todayISO } from "../lib/freshness";
import { clearSecrets, clearOwner, getOrCreateOwnerToken, getHostedConfig, isOwner } from "../lib/security";
import { buildRecoveryLink } from "../lib/recovery";
import { authAvailable, currentEmail, hasLinkedAccount, signOut, deleteLinkedAccount } from "../lib/auth";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Settings({ data, update }: Props) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const handleExport = async () => {
    // exportData 는 idb 사진을 base64 로 인라인하느라 async — 큰 갤러리면 잠깐 걸림.
    await exportData(data);
    update((prev: WeddingData) => ({
      ...prev,
      preferences: { ...prev.preferences, lastBackupAt: todayISO() },
    }));
  };

  const handleImport = async (file: File) => {
    try {
      const imported = await importData(file, data);
      if (confirm("현재 데이터를 덮어쓸까요?\n(연결 정보는 안전하게 그대로 둡니다)")) {
        // import 도 "백업 시점" 으로 인정 — 사용자가 파일을 손에 쥐고 있으니 같은 안전 수준.
        // 안 그러면 30일 전 백업 import 시 곧장 "오래 백업 안 함" 알림이 뜸.
        update(() => ({
          ...imported,
          preferences: { ...imported.preferences, lastBackupAt: todayISO() },
        }));
      }
    } catch (e) {
      alert("파일을 읽을 수 없어요. JSON 백업 파일이 맞는지 확인해주세요.");
    }
  };

  const copyEditorInvite = async () => {
    // 이 링크는 마스터 권한(모든 데이터 읽기·수정, 청첩장 변조, RSVP 열람)을 담고 있다.
    // 카톡 단톡방·캡처로 새면 계정 탈취와 같으므로, 복사 전에 한 번 더 경고한다.
    if (!confirm(
      "⚠️ 편집 초대 링크는 '내 계정 열쇠'예요.\n\n" +
      "이 링크를 가진 사람은 하객·축의금·예산 등 모든 데이터를 보고 고칠 수 있어요.\n" +
      "배우자처럼 함께 편집할 사람에게 1:1로만 보내고,\n" +
      "단톡방·SNS·캡처로 공유하지 마세요.\n\n" +
      "복사할까요?",
    )) return;
    const token = getOrCreateOwnerToken();
    const url = `${window.location.origin}/dashboard#ownerToken=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2400);
    } catch {
      prompt("아래 편집 초대 링크를 복사해주세요:", url);
    }
  };

  const [wiping, setWiping] = useState(false);
  const reset = async () => {
    if (!confirm(
      "정말 모든 데이터를 지울까요?\n\n" +
      "발행한 청첩장·받은 RSVP, 간편 모드 서버 데이터, 로그인 연결까지 함께 삭제되며 되돌릴 수 없어요.",
    )) return;
    setWiping(true);
    // 1. 운영자 서버에 남는 내 데이터 정리 (발행 청첩장 + 간편 호스팅 행)
    try { await purgeServerData(data); } catch { /* best-effort */ }
    // 2. 로그인 계정 복구 blob 삭제 + 로그아웃 (로그인 상태일 때)
    if (authAvailable()) {
      try { await deleteLinkedAccount(); } catch { /* best-effort */ }
      try { await signOut(); } catch { /* best-effort */ }
    }
    // 3. 로컬 정리
    localStorage.removeItem("wedding-os/v1");
    localStorage.removeItem("wedding-os/published-invite");
    clearSecrets();
    clearOwner();
    window.location.href = "/";
  };

  const switchMode = () => {
    if (!confirm("모드를 다시 선택하시겠어요? 현재 데이터는 그대로 유지됩니다.")) return;
    update((prev: WeddingData) => ({
      ...prev,
      preferences: { ...prev.preferences, mode: null },
    }));
    navigate("/");
  };

  const currentMode =
    data.preferences.mode === "local" ? "내 휴대폰에 저장" :
    data.preferences.mode === "hosted" ? "간편 (운영자 호스팅)" :
    data.preferences.mode === "supabase" ? "내 사이트로 배포" :
    data.preferences.mode === "devOnly" ? "코드 직접 수정" : "선택 안 됨";

  const copyRecoveryLink = async () => {
    const cfg = getHostedConfig();
    if (!cfg) { alert("복구 정보를 찾을 수 없어요."); return; }
    // 복구 링크 = 데이터 전체의 마스터 열쇠. 복사 전 한 번 더 경고.
    if (!confirm(
      "⚠️ 복구 링크는 '내 데이터 전체의 열쇠'예요.\n\n" +
      "기기를 바꾸면 이 링크로 복구하고, 배우자에게 보내면 함께 편집해요.\n" +
      "단, 이 링크를 가진 사람은 모든 내용을 보고 고칠 수 있어요.\n" +
      "배우자에게만 1:1로 보내고, 단톡방·SNS엔 올리지 마세요.\n\n" +
      "복사할까요?",
    )) return;
    const url = buildRecoveryLink({ weddingId: cfg.weddingId, ownerToken: getOrCreateOwnerToken(), weddingKey: cfg.weddingKey });
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2400);
    } catch {
      prompt("아래 복구 링크를 안전한 곳에 저장하세요:", url);
    }
  };

  return (
    <div className="page pt-8 pb-10 space-y-10">
      <div>
        <div className="eyebrow-gold mb-2">More</div>
        <h1 className="font-serif text-[2rem] leading-none">더보기</h1>
      </div>

      <Section title="저장 방식">
        <p className="text-[13px] text-soft">
          현재 · <b className="text-ink">{currentMode}</b>
        </p>
        {data.preferences.mode === "local" && authAvailable() && (
          <Link to="/start-hosted" className="block mt-3 text-[12.5px] text-ink underline underline-offset-4 hover:text-gold">
            👫 배우자와 함께 편집 · 다른 기기에서 이어서 →
          </Link>
        )}
        <button onClick={switchMode} className="block text-[12px] underline underline-offset-4 text-soft hover:text-ink mt-3">
          저장 방식 직접 고르기 (고급) →
        </button>
      </Section>

      <Section title="PDF로 저장 (인쇄)">
        <p className="text-[12.5px] text-soft leading-relaxed">
          청첩장이나 체크리스트를 PDF로 저장하고 싶을 때 —
          각 페이지에서 <b className="text-ink">Cmd/Ctrl + P</b> 로 인쇄 → <b className="text-ink">"PDF로 저장"</b> 을 선택하세요.
          인쇄 친화 스타일이 자동 적용됩니다.
        </p>
        <p className="text-[11px] text-soft mt-2">
          모바일은 일반적으로 브라우저 메뉴 → 공유 → 프린트 흐름.
        </p>
      </Section>

      <Section title="데이터 백업">
        <p className="text-[12.5px] text-soft mb-4 leading-relaxed">
          모든 데이터를 한 파일(JSON)로 내보내거나, 다시 불러올 수 있어요.
        </p>
        <div className="flex gap-6">
          <button onClick={handleExport} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
            내려받기 (백업) →
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          <button onClick={() => fileRef.current?.click()} className="text-[12px] underline underline-offset-4 text-soft hover:text-ink">
            백업에서 불러오기
          </button>
        </div>
        {data.preferences.lastBackupAt && (
          <p className="eyebrow mt-3">
            마지막 백업 · <span className="tabular-nums">{data.preferences.lastBackupAt}</span>
          </p>
        )}
      </Section>

      <Section title="공유 센터">
        <p className="text-[12.5px] text-soft mb-4 leading-relaxed">
          하객 명단, 예산, 체크리스트, 청첩장 문안을 Excel/CSV/이미지/인쇄용 파일로 꺼낼 수 있어요.
        </p>
        <Link to="/share" className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
          공유 센터 열기 →
        </Link>
      </Section>

      <Section title="AI 편집 방식">
        <p className="text-[12px] text-soft leading-relaxed">
          앱이 AI 비용을 대신 청구하거나 서버로 내용을 보내지 않도록,
          현재는 <b className="text-ink">챗봇 다리 방식</b>으로 동작합니다.
          프롬프트를 ChatGPT / Claude / Gemini에 붙여넣고, 답변을 다시 붙여넣으면 영상 · 정보가 갱신됩니다.
        </p>
        <Link to="/ai" className="text-[12px] underline underline-offset-4 text-ink hover:text-gold inline-block mt-3">
          AI 연결 설정 →
        </Link>
      </Section>

      {data.preferences.mode === "supabase" && (
        <Section title="Supabase 연결 정보">
          <div className="space-y-1.5 text-[11.5px] text-soft">
            <p className="break-all">URL · <span className="text-ink">{data.preferences.supabase?.url}</span></p>
            <p>anon key · <span className="text-ink">••••••{data.preferences.supabase?.anonKey.slice(-6)}</span></p>
          </div>
          <Link to="/setup" className="text-[12px] underline underline-offset-4 text-ink hover:text-gold inline-block mt-3">
            셋업 가이드 다시 보기 →
          </Link>
          <div className="pt-4 mt-4 border-t border-hair space-y-2">
            <p className="text-[11.5px] text-soft leading-relaxed">
              다른 기기에서 함께 편집하려면 편집 초대 링크를 보내세요. 이 링크는 하객에게 보내는 청첩장
              링크가 <b className="text-ink">아니라</b>, 모든 데이터를 보고 고칠 수 있는{" "}
              <b className="text-gold">오너 권한 링크</b>예요. 배우자에게 1:1로만 보내고,
              단톡방·SNS·캡처로 공유하지 마세요.
            </p>
            <button onClick={copyEditorInvite} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
              {inviteCopied ? "복사됨" : "편집 초대 링크 복사 →"}
            </button>
          </div>
          <OwnerToggle />
        </Section>
      )}

      {data.preferences.mode === "hosted" && (
        <Section title="복구 링크 · 배우자 초대">
          <p className="text-[12.5px] text-soft leading-relaxed mb-3">
            기기를 바꿔도 이 링크로 복구하고, 배우자에게 보내면 함께 편집해요.
            내용은 암호화돼 운영자도 못 보지만, <b className="text-ink">이 링크를 가진 사람은 전부 보고 고칠 수 있어요.</b>
          </p>
          <button onClick={copyRecoveryLink} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
            {inviteCopied ? "복사됨" : "복구 링크 복사 →"}
          </button>
          <p className="text-[11px] text-soft mt-3 leading-relaxed">
            배우자에게만 1:1로. 단톡방·SNS·공개된 곳엔 올리지 마세요.
          </p>
          <LoginStatus />
        </Section>
      )}

      <Section title="문의 / 오류 신고">
        <p className="text-[12.5px] text-soft mb-4 leading-relaxed">
          이상하거나 안 되는 흐름이 있으면 알려주세요.
          화면 이름과 상황을 같이 보내주시면 빠르게 확인할 수 있어요.
        </p>
        <Link to="/contact" className="btn-primary px-6 py-3 text-[12px]">
          문의하기 →
        </Link>
      </Section>

      <Section title="위험한 작업">
        <button onClick={reset} disabled={wiping} className="text-[12px] underline underline-offset-4 text-gold hover:text-ink disabled:opacity-50">
          {wiping ? "지우는 중…" : "모든 데이터 지우기 →"}
        </button>
        <p className="text-[11px] text-soft mt-2 leading-relaxed">
          발행한 청첩장·간편 모드 서버 데이터·로그인 연결까지 함께 삭제됩니다.
        </p>
      </Section>

      <p className="text-center text-[11px] text-soft pt-4 border-t border-hair space-x-3">
        <span>Wedding OS</span>
        <span>·</span>
        <Link to="/trust" className="underline underline-offset-2">운영자도 못 봐요</Link>
        <span>·</span>
        <Link to="/privacy" className="underline underline-offset-2">개인정보 · 보안 안내</Link>
        <span>·</span>
        <a href="https://github.com/commet/wedding-os" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">GitHub</a>
      </p>
    </div>
  );
}

// 간편 모드 로그인 상태 — 이메일 표시 + 로그아웃 / 연결 해제, 또는 로그인 연결 링크.
function LoginStatus() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!authAvailable()) { if (alive) setEmail(null); return; }
      const em = await currentEmail();
      if (!alive) return;
      setEmail(em);
      if (em) setLinked(await hasLinkedAccount());
    })();
    return () => { alive = false; };
  }, []);

  const doSignOut = async () => { await signOut(); window.location.reload(); };
  const doUnlink = async () => {
    if (!confirm("이 계정의 복구 정보를 삭제할까요?\n로그인으로는 더 이상 복구할 수 없게 돼요 (복구 링크는 그대로 사용 가능).")) return;
    await deleteLinkedAccount();
    await signOut();
    window.location.reload();
  };

  if (email === undefined) return null; // 로딩 중

  return (
    <div className="pt-4 mt-4 border-t border-hair">
      {email ? (
        <div className="space-y-2">
          <p className="text-[11.5px] text-soft">
            로그인됨 · <b className="text-ink">{email}</b>{linked ? " · 복구 연결됨" : ""}
          </p>
          <div className="flex gap-5">
            <button onClick={doSignOut} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
              로그아웃
            </button>
            {linked && (
              <button onClick={doUnlink} className="text-[12px] underline underline-offset-4 text-soft hover:text-gold">
                연결 해제
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[11.5px] text-soft leading-relaxed mb-2">
            링크를 따로 안 챙겨도, 로그인으로 연결해두면 기기를 바꿔도 복구돼요.
          </p>
          <Link to="/login" className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
            이메일·카카오로 로그인 연결 →
          </Link>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-2">
      <h3 className="eyebrow-gold mb-4">{title}</h3>
      {children}
      <div className="hairline mt-8" />
    </section>
  );
}

// 모드 2 편집 권한은 owner token 이 있는 기기에서만 유효하다.
// 두 번째 기기는 "편집 초대 링크"로 들어오면 hash 에서 token 을 받아 owner 상태가 된다.
function OwnerToggle() {
  const [owner, setOwner] = useState(isOwner());

  const becomeGuest = () => {
    if (!confirm("이 기기를 보기 전용으로 바꿀까요?\n청첩장 편집 탭이 숨겨집니다.")) return;
    clearOwner();
    setOwner(false);
  };

  return (
    <div className="pt-4 mt-4 border-t border-hair space-y-2">
      <p className="text-[11.5px] text-soft">
        이 기기는 현재{" "}
        <b className={owner ? "text-gold" : "text-soft"}>{owner ? "편집 가능" : "보기 전용"}</b>
        예요.
      </p>
      {owner ? (
        <button onClick={becomeGuest} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
          이 기기를 보기 전용으로 바꾸기 →
        </button>
      ) : (
        <p className="text-[11.5px] text-soft leading-relaxed">
          편집 권한이 필요하면 부부의 기존 편집 기기에서 [편집 초대 링크]를 받아 다시 열어주세요.
        </p>
      )}
    </div>
  );
}
