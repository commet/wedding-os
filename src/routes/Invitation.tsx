import { cloneElement, isValidElement, useId, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import type { WeddingData, WeddingUpdate, InvitationContent, Mode } from "../lib/schema";
import Modal from "../components/Modal";
import ChatbotBridgeModal from "../components/ChatbotBridgeModal";
import { STOCK_HERO, STOCK_GALLERY } from "../data/stockPhotos";
import { PAPER_INVITATIONS, MOBILE_INVITATIONS } from "../data/invitationPlatforms";
import VendorActions from "../components/VendorActions";
import { safeMediaSrc, safeHref, safeTel, isOwner } from "../lib/security";
import { insertRsvp, type RsvpInput } from "../lib/storage.supabase";
import { compressImage, dataUrlSize, formatBytes } from "../lib/imageCompress";
import { uploadImage } from "../lib/imageStore";
import SafeImg from "../components/SafeImg";
import { useSaveStatus } from "../lib/storage";
import { daysUntilISODate, parseISODateLocal } from "../lib/date";
import { publishInvitation, unpublishInvitation, fetchHostedRsvps, type HostedRsvp } from "../lib/inviteHosting";
import { type BridgePrompt, invitationGreetingPrompt } from "../lib/chatbotBridge";
import { koBreak } from "../lib/typography";
import { invitationReadiness, contractedVenue, mealTicketCount } from "../lib/derived";
import { consultationFacts, consultationChoice } from "../lib/sectionConsultation";
import MapEmbed from "../components/MapEmbed";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import SectionConsultationPanel from "../components/SectionConsultationPanel";
import { SectionDecisionLoop } from "../components/DecisionLoopPanel";
import DearieConfirmModal from "../components/DearieConfirmModal";

type Props = { data: WeddingData; update: (patch: WeddingUpdate) => void; };
type Tab = "edit" | "preview" | "guest";
type Locale = "ko";
type Theme = "cream" | "white" | "sage" | "rose" | "navy" | "sand" | "slate" | "blush";
type FontStyle = "serif" | "sans" | "handwriting";
type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  tone?: "normal" | "warn";
  onConfirm: () => void | Promise<void>;
};

// 큐레이션된 에디토리얼 팔레트 — 생짜 Tailwind 기본색(rose-500·blue-900 등)이 아니라
// 고급 청첩장 스테이셔너리에 어울리는 톤다운된 색만. accent=섹션 제목/D-day 글자색,
// chip=캘린더 당일 동그라미(흰 글자), swatch=테마 선택 점, heroGrad=사진 없을 때 배경.
const THEME: Record<Theme, { heroGrad: string; accent: string; chip: string; swatch: string; label: string }> = {
  cream: { heroGrad: "from-[#F7F1E6] to-[#E6D7BC]",  accent: "text-gold",         chip: "bg-gold",            swatch: "bg-gold",            label: "크림" },
  white: { heroGrad: "from-[#F6F4F0] to-[#E2DDD3]",  accent: "text-soft",         chip: "bg-ink",            swatch: "bg-ink",            label: "아이보리" },
  sage:  { heroGrad: "from-[#EDF1EA] to-[#CFD9C6]",  accent: "text-[#7E8C77]",    chip: "bg-[#8B9A82]",      swatch: "bg-[#8B9A82]",      label: "세이지" },
  rose:  { heroGrad: "from-[#F6ECE9] to-[#E6CCC6]",  accent: "text-[#A9756E]",    chip: "bg-[#BD8E88]",      swatch: "bg-[#C99C98]",      label: "더스티로즈" },
  navy:  { heroGrad: "from-[#EAEDF1] to-[#C5CDD8]",  accent: "text-[#3B4A5A]",    chip: "bg-[#3B4A5A]",      swatch: "bg-[#3B4A5A]",      label: "잉크블루" },
  sand:  { heroGrad: "from-[#F5EEE2] to-[#E2D2B9]",  accent: "text-[#9A7B4F]",    chip: "bg-[#A8895F]",      swatch: "bg-[#B89B6E]",      label: "카멜" },
  slate: { heroGrad: "from-[#EFEFEC] to-[#D0D2CC]",  accent: "text-[#6C736D]",    chip: "bg-[#6C736D]",      swatch: "bg-[#828983]",      label: "스톤" },
  blush: { heroGrad: "from-[#F7EEF0] to-[#E7CCD3]",  accent: "text-[#B07E8B]",    chip: "bg-[#C08495]",      swatch: "bg-[#D0A3B0]",      label: "블러시" },
};

const FONT: Record<FontStyle, { class: string; label: string; sample: string }> = {
  serif:       { class: "font-serif", label: "정통 (세리프)", sample: "도현 · 지윤" },
  sans:        { class: "font-sans",  label: "모던 (산세리프)", sample: "도현 · 지윤" },
  handwriting: { class: "font-hand",  label: "손글씨", sample: "도현 · 지윤" },
};

// 발행 전 빠진 항목 → 해당 입력 섹션 id 매핑 (invitationReadiness의 missing 라벨 기준).
// 라벨이 derived.ts 에서 바뀌면 여기도 맞춰야 하지만, 매핑이 없으면 조용히 무시되므로 깨지진 않음.
const MISSING_FIELD_TARGET: Record<string, string> = {
  "신랑 이름": "inv-names",
  "신부 이름": "inv-names",
  "예식 날짜": "inv-schedule",
  "예식 장소": "inv-schedule",
  "인사말": "inv-greeting",
};

function scrollToMissingField(label: string) {
  const id = MISSING_FIELD_TARGET[label];
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Invitation({ data, update }: Props) {
  const location = useLocation();
  // /i 경로 = 게스트 청첩장 라우트. 받는 사람용으로 헤더·편집·공유 다 숨김.
  const isGuestRoute = location.pathname === "/i";
  // 모드 2 청첩장이지만 오너 표시 없는 기기 — 게스트로 취급
  const guest = isGuestRoute || (data.preferences.mode === "supabase" && !isOwner());
  const canRsvp = data.preferences.mode === "supabase" && !!data.preferences.supabase;
  // 새 청첩장(이름 비어있고 오너)이면 빈 미리보기 대신 편집 탭(QuickStart)으로 시작.
  const [tab, setTab] = useState<Tab>(
    () => location.search.includes("edit=publish") || (!guest && !isGuestRoute && !data.invitation.groomName && !data.invitation.brideName) ? "edit" : "preview",
  );
  const [showRsvp, setShowRsvp] = useState(false);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  const inv = data.invitation;
  const locale: Locale = "ko";

  const set = <K extends keyof InvitationContent>(key: K, value: InvitationContent[K]) => {
    update((prev: WeddingData) => ({ ...prev, invitation: { ...prev.invitation, [key]: value } }));
  };

  // 최소 정보 누락 검사 — 빈 청첩장을 실수로 공유하지 않도록.
  const missingInvitationFields = (): string[] => {
    const m: string[] = [];
    if (!inv.groomName) m.push("신랑 이름");
    if (!inv.brideName) m.push("신부 이름");
    if (!inv.date) m.push("결혼식 날짜");
    if (!inv.venue) m.push("식장");
    return m;
  };

  const [shareText, setShareText] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [invitationNotice, setInvitationNotice] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const openPublishEditor = () => {
    setTab("edit");
    window.setTimeout(() => {
      document.getElementById("publish-invitation")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const markShareCopied = () => {
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 2400);
  };

  const share = async () => {
    // 신랑·신부 이름이 비어 있으면 공유 자체를 막는다 — 이름 없는 청첩장은
    // 의미가 없고, '신랑 ♥ 신부' 같은 자리표시자가 그대로 하객에게 나간다.
    if (!inv.groomName || !inv.brideName) {
      setInvitationNotice("공유 전에 신랑·신부 이름을 먼저 넣어주세요.");
      setTab("edit");
      return;
    }
    // 날짜·식장은 빠져도 '곧 청첩장 보낼게' 식으로 미리 공유할 수 있어 경고만 한다.
    const softMissing = missingInvitationFields().filter(
      (m) => m !== "신랑 이름" && m !== "신부 이름",
    );
    if (softMissing.length > 0) {
      setConfirmDialog({
        title: "빠진 정보가 있어요",
        body:
          `아직 ${softMissing.join(", ")}이 비어 있습니다.\n\n` +
          "하객에게 보내기 전에는 먼저 채우는 편이 안전해요. 그래도 지금 공유할 수는 있습니다.",
        confirmLabel: "그래도 공유",
        tone: "warn",
        onConfirm: shareReadyInvitation,
      });
      return;
    }
    await shareReadyInvitation();
  };

  const shareReadyInvitation = async () => {
    // 모드 2: 실제 청첩장 링크 — 게스트 전용 라우트 /i 공유
    if (data.preferences.mode === "supabase") {
      const rsvpToken = data.preferences.supabase?.rsvpToken;
      const url = window.location.origin + "/i" + (rsvpToken ? `#r=${encodeURIComponent(rsvpToken)}` : "");
      const title = `${inv.groomName || "신랑"} · ${inv.brideName || "신부"} 결혼합니다`;
      const text = inv.date || inv.venue
        ? [formatShareDate(inv), inv.venue].filter(Boolean).join(" · ")
        : "청첩장을 확인해주세요.";
      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (e: any) {
          if (e?.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        markShareCopied();
      } catch {
        prompt("아래 링크를 복사해주세요:", url);
      }
      return;
    }
    // 모드 1(로컬)·간편(hosted): 발행된 진짜 링크가 있으면 그걸 공유.
    if (data.publish) {
      const url = hostedInviteLink(data.publish);
      const title = `${inv.groomName || "신랑"} · ${inv.brideName || "신부"} 결혼합니다`;
      const text = inv.date || inv.venue
        ? [formatShareDate(inv), inv.venue].filter(Boolean).join(" · ")
        : "청첩장을 확인해주세요.";
      if (navigator.share) {
        try { await navigator.share({ title, text, url }); return; }
        catch (e: any) { if (e?.name === "AbortError") return; }
      }
      try { await navigator.clipboard.writeText(url); markShareCopied(); }
      catch { prompt("아래 링크를 복사해주세요:", url); }
      return;
    }
    // 아직 발행 전 — 진짜 링크를 만들도록 편집 탭의 발행 섹션으로 안내.
    setInvitationNotice("아직 하객용 링크를 만들지 않았어요. 발행 섹션에서 링크를 만들면 바로 공유할 수 있습니다.");
    openPublishEditor();
  };

  const copyShareText = async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setShareText(null);
      markShareCopied();
    } catch {
      prompt("아래 내용을 복사해 카톡에 붙여넣으세요:", shareText);
      setShareText(null);
    }
  };

  // 게스트 라우트(/i) 에서 청첩장이 아직 비어 있으면 데모 커플(도현·지윤) 노출 금지.
  // (mode 2 사용자의 supabase 가 빈 row 거나, 환경변수 없는 게스트가 들어왔을 때 demoData 가 새어나가는 걸 방지.)
  if (isGuestRoute && !inv.groomName && !inv.brideName) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <div className="eyebrow-gold mb-4">Wedding · Invitation</div>
          <h1 className="display-sm text-ink mb-3">
            {koBreak("아직 준비 중이에요")}
          </h1>
          <p className="text-[13px] text-soft leading-relaxed">
            청첩장이 곧 도착할 거예요.<br />
            잠시 후 다시 열어봐 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={isGuestRoute ? "" : "pb-6"}>
      {/* 헤더·탭 — 박스 없이 hairline 만 */}
      {!isGuestRoute && (
        <div className="sticky top-[57px] z-20 bg-paper/95 backdrop-blur border-b border-hair">
          <div className="page py-4 flex items-baseline justify-between">
            <div>
              <div className="eyebrow-gold mb-1">청첩장 만들기</div>
              <h1 className="font-serif text-xl text-ink">{koBreak("모바일 청첩장")}</h1>
            </div>
            <button onClick={() => { void share(); }} className="min-h-11 px-2 text-[12px] underline underline-offset-4 text-ink hover:text-gold transition">
              {shareCopied ? "복사됨" : data.publish || data.preferences.mode === "supabase" ? "공유 →" : "발행 →"}
            </button>
          </div>
          <div className="page pb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <TabBtn active={tab === "preview"} onClick={() => setTab("preview")}>미리보기</TabBtn>
              {!guest && (
                <TabBtn active={tab === "guest"} onClick={() => setTab("guest")}>하객 시점</TabBtn>
              )}
              {!guest && (
                <TabBtn active={tab === "edit"} onClick={() => setTab("edit")}>편집</TabBtn>
              )}
            </div>
            {!guest && (() => {
              const r = invitationReadiness(data);
              const done = r.filled === r.total;
              return (
                <span
                  className={`hidden text-[11px] tracking-wide break-keep sm:inline ${done ? "text-soft" : "text-gold font-medium"}`}
                  title={done ? undefined : `남은 항목: ${r.missing.join(", ")}`}
                >
                  {done ? "✓ 공유 준비 완료" : `공유 준비 ${r.filled}/${r.total}`}
                </span>
              );
            })()}
          </div>
        </div>
      )}

      {invitationNotice && !isGuestRoute && (
        <div className="page pt-3">
          <div className="anim-fade flex items-center justify-between gap-4 border-y border-hair py-3">
            <p className="text-[13px] leading-relaxed text-soft">
              <span className="font-semibold text-ink">Dearie</span> · {invitationNotice}
            </p>
            <button
              type="button"
              onClick={() => setInvitationNotice("")}
              className="min-h-11 min-w-11 text-soft hover:text-ink"
              aria-label="안내 닫기"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 게스트가 오너 기기인 경우 — 작은 안내 */}
      {isGuestRoute && isOwner() && (
        <div className="page pt-3 pb-1">
          <a href="/invitation" className="eyebrow underline underline-offset-2">
            ← 편집 화면으로 (오너만 보임)
          </a>
        </div>
      )}

      {tab === "edit" && !guest ? (
        <EditForm inv={inv} set={set} mode={data.preferences.mode} data={data} update={update} onPreview={() => setTab("preview")} />
      ) : (
        <>
          {tab === "guest" && !guest && !guestBannerDismissed && (
            <div className="page pt-4">
              <div className="flex items-baseline justify-between gap-3 border-l-2 border-gold pl-3 py-2 bg-cream/40">
                <p className="text-[12px] text-soft leading-relaxed break-keep">
                  {koBreak("하객에게는 이 화면이 그대로 보여요. 발행된 링크에서는 RSVP 버튼도 작동합니다.")}
                </p>
                <button
                  onClick={() => setGuestBannerDismissed(true)}
                  className="text-[11px] text-soft hover:text-ink flex-shrink-0 min-h-11 px-1"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
          {!isGuestRoute && !guest && (
            <div className="page pt-4">
              <InvitationPreviewAgent
                data={data}
                tab={tab}
                onEdit={() => setTab("edit")}
                onGuest={() => setTab("guest")}
                onPublish={openPublishEditor}
                onShare={() => { void share(); }}
              />
            </div>
          )}
          <Preview
            inv={inv}
            locale={locale}
            rsvpEnabled={canRsvp}
            onRsvpClick={() => setShowRsvp(true)}
            hideShareBox={tab === "guest" || !isGuestRoute}
            onShare={share}
            shareCopied={shareCopied}
            shareHint={
              data.preferences.mode === "supabase"
                ? "하객이 여는 청첩장 링크를 공유합니다. 편집 초대 링크는 공유 센터에서 따로 보내세요."
                : "카톡에 붙여넣을 문안을 만듭니다. 하객이 여는 웹 링크는 [편집] 탭의 [청첩장 링크 만들기]에서 만들 수 있어요."
            }
          />
        </>
      )}

      {showRsvp && (
        <RsvpModal
          locale={locale}
          onClose={() => setShowRsvp(false)}
          onSubmit={async (input) => {
            const sb = data.preferences.supabase;
            if (!sb) return { ok: false, reason: "아직 청첩장 셋업이 안 끝났어요" };
            const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("r") ?? sb.rsvpToken;
            return insertRsvp(sb.url, sb.anonKey, input, sb.configId, fragmentToken);
          }}
        />
      )}

      <Modal open={!!shareText} onClose={() => setShareText(null)} title="카톡으로 보낼 내용 미리보기">
        <pre className="bg-cream p-4 text-[12.5px] whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto font-sans border border-hair">
{shareText}
        </pre>
        <p className="text-[11.5px] text-soft mt-3 leading-relaxed">
          위 내용을 그대로 복사해서 카톡 채팅창에 붙여넣어요.<br />
          긴 글이지만 카톡 채팅엔 그대로 들어갑니다.
        </p>
        <div className="flex items-center justify-end gap-4 mt-4 pt-4 border-t border-hair">
          <button onClick={() => setShareText(null)} className="text-[12px] text-soft underline underline-offset-4">
            취소
          </button>
          <button onClick={copyShareText} className="btn-primary px-6 py-3 text-[12px]">
            복사하기 →
          </button>
        </div>
      </Modal>
      <DearieConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title ?? ""}
        body={confirmDialog?.body ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "확인"}
        tone={confirmDialog?.tone}
        onClose={() => setConfirmDialog(null)}
        onConfirm={async () => { await confirmDialog?.onConfirm(); }}
      />
    </div>
  );
}

export function RsvpModal({
  locale, onClose, onSubmit,
}: {
  locale: Locale;
  onClose: () => void;
  onSubmit: (input: RsvpInput) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [name, setName] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [side, setSide] = useState<"groom" | "bride">("groom");
  const [guests, setGuests] = useState(1);
  const [meal, setMeal] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [errMsg, setErrMsg] = useState("");

  const submit = async () => {
    if (!name.trim()) return setErrMsg("이름을 적어주세요");
    if (attending === null) return setErrMsg("참석 여부를 선택해주세요");
    setStatus("sending");
    setErrMsg("");
    const r = await onSubmit({
      name: name.trim(),
      attending,
      side,
      guests: attending ? guests : 0,
      meal: meal.trim() || undefined,
      message: message.trim() || undefined,
    });
    if (r.ok) setStatus("ok");
    else {
      setStatus("fail");
      setErrMsg(r.reason ?? "전송 실패");
    }
  };

  return (
    <Modal open onClose={onClose} title={t("참석 의사 전달", locale)}>
      {status === "ok" ? (
        <div className="text-center py-6 space-y-3">
          <div className="eyebrow-gold">RSVP</div>
          <p className="text-sm">{t("축하의 마음으로 참석해 주시는 분들을 위해", locale)}</p>
          <p className="text-base font-medium text-gold">{t("전송됐어요. 감사합니다.", locale)}</p>
          <button onClick={onClose} className="btn-primary mt-2">닫기</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-soft">신랑·신부가 따뜻한 마음으로 확인할게요.</p>
          <p className="text-[11px] text-soft leading-relaxed border border-line bg-cream/40 p-3">
            {t("이름·참석 여부·인원·식사 메모·축하 메시지는 예식 준비를 위해 신랑·신부만 확인합니다.", locale)}
          </p>

          <div>
            <label className="label">{t("성함", locale)}</label>
            <input aria-label={t("성함", locale)} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
          </div>

          <div>
            <label className="label">{t("어느 쪽", locale)}</label>
            <div className="flex gap-2">
              {(["groom", "bride"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`flex-1 text-sm py-2 border ${side === s ? "border-gold bg-gold/5 text-gold" : "border-line text-soft"}`}
                >
                  {s === "groom" ? t("신랑 측", locale) : t("신부 측", locale)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{t("참석 여부", locale)}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAttending(true)}
                className={`flex-1 text-sm py-2 border ${attending === true ? "border-gold bg-gold/5 text-gold" : "border-line text-soft"}`}
              >
                {t("참석", locale)}
              </button>
              <button
                onClick={() => setAttending(false)}
                className={`flex-1 text-sm py-2 border ${attending === false ? "border-gold bg-gold/5 text-gold" : "border-line text-soft"}`}
              >
                {t("불참", locale)}
              </button>
            </div>
          </div>

          {attending === true && (
            <div>
              <label className="label">{t("참석 인원 (본인 포함)", locale)}</label>
              <input
                aria-label={t("참석 인원 (본인 포함)", locale)}
                type="number"
                min={1}
                max={20}
                className="input"
                value={guests}
                onChange={(e) => setGuests(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              />
            </div>
          )}

          {attending === true && (
            <div>
              <label className="label">{t("식사 메모 (선택)", locale)}</label>
              <input
                aria-label={t("식사 메모 (선택)", locale)}
                className="input"
                value={meal}
                onChange={(e) => setMeal(e.target.value)}
                placeholder={t("예: 아동 1명, 채식, 알레르기", locale)}
              />
            </div>
          )}

          <div>
            <label className="label">{t("축하 메시지 (선택)", locale)}</label>
            <textarea
              aria-label={t("축하 메시지 (선택)", locale)}
              className="input min-h-[70px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="두 분의 결혼을 축하합니다…"
            />
          </div>

          {errMsg && <p className="text-ink text-sm">{errMsg}</p>}

          <button
            onClick={submit}
            disabled={status === "sending"}
            className="btn-primary w-full disabled:opacity-50"
          >
            {status === "sending" ? t("전송 중…", locale) : t("참석 의사 전하기", locale)}
          </button>
        </div>
      )}
    </Modal>
  );
}

function InvitationPreviewAgent({
  data,
  tab,
  onEdit,
  onGuest,
  onPublish,
  onShare,
}: {
  data: WeddingData;
  tab: Tab;
  onEdit: () => void;
  onGuest: () => void;
  onPublish: () => void;
  onShare: () => void;
}) {
  const inv = data.invitation;
  const readiness = invitationReadiness(data);
  const publishReady = !!inv.groomName && !!inv.brideName && !!inv.date && !!inv.venue;
  const hasStory = !!inv.greeting.trim() && !!inv.heroImageUrl;
  const contracted = contractedVenue(data);
  const missing = readiness.missing.join(", ") || "없음";
  const canUseContractedVenue = !inv.venue.trim() && !!contracted;

  return (
    <ProcessAgentPanel
      title={
        !publishReady
          ? "공유 전에 빠진 칸을 확인하는 중"
          : data.publish
            ? "하객 시점까지 마지막 점검 중"
            : "하객용 링크 발행만 남았어요"
      }
      summary={
        !publishReady
          ? `아직 ${readiness.total - readiness.filled}가지가 비어 있어요. 지금 빠진 항목은 ${missing}입니다.`
          : data.publish
            ? "기본 정보와 링크는 준비됐어요. 하객 시점으로 열어 RSVP와 지도 안내가 자연스러운지만 보면 됩니다."
            : "청첩장 핵심 정보는 채워졌어요. 사진, 모시는 글, 지도 안내를 확인한 뒤 링크를 만들면 됩니다."
      }
      mood={!publishReady ? "watching" : data.publish ? "ready" : "thinking"}
      metrics={[
        { label: "기본 정보", value: `${readiness.filled}/${readiness.total}`, tone: readiness.filled < readiness.total ? "warn" : "normal" },
        { label: "식장", value: inv.venue ? "있음" : canUseContractedVenue ? "후보 있음" : "없음", tone: inv.venue ? "normal" : "warn" },
        { label: "링크", value: data.publish ? "발행" : "전", tone: data.publish ? "normal" : publishReady ? "warn" : "muted" },
      ]}
      steps={[
        { label: "이름·날짜·식장 확인", detail: "하객이 가장 먼저 보는 정보라 비어 있으면 공유 전에 막습니다.", done: publishReady },
        { label: "모시는 글과 대표 사진 확인", detail: "초안 느낌이 남지 않도록 문장과 첫 사진을 같이 봅니다.", done: hasStory },
        { label: "하객 시점 확인", detail: "발행 전에는 실제 하객 화면처럼 한 번 열어 흐름을 봅니다.", done: tab === "guest" },
        { label: "하객용 링크 발행", detail: "내용이 준비되면 편집 초대 링크가 아니라 하객용 링크를 만듭니다.", done: !!data.publish },
      ]}
      actions={[
        ...(!publishReady ? [{ label: "빠진 정보 채우기 →", onClick: onEdit, tone: "primary" as const }] : []),
        ...(publishReady && !data.publish ? [{ label: "발행 준비하러 가기 →", onClick: onPublish, tone: "primary" as const }] : []),
        ...(tab !== "guest" ? [{ label: "하객 시점 보기", onClick: onGuest }] : []),
        ...(data.publish ? [{ label: "공유 실행", onClick: onShare }] : []),
      ]}
    />
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`min-h-11 px-2 tracking-wide ${active ? "seg-active" : "seg"}`}
    >
      {children}
    </button>
  );
}

/* ════════════ 미리보기 — 실제 청첩장 ════════════ */

export function Preview({
  inv, locale, rsvpEnabled, onRsvpClick, hideShareBox, onShare, shareCopied, shareHint,
}: {
  inv: InvitationContent;
  locale: Locale;
  rsvpEnabled?: boolean;
  onRsvpClick?: () => void;
  hideShareBox?: boolean;
  onShare?: () => void;
  shareCopied?: boolean;
  shareHint?: string;
}) {
  const theme = THEME[(inv.theme as Theme) ?? "cream"];
  const fontClass = FONT[(inv.fontStyle as FontStyle) ?? "serif"].class;
  const validDate = parseISODateLocal(inv.date);
  const dday = daysUntilISODate(inv.date);
  const [lightbox, setLightbox] = useState<number | null>(null); // 갤러리 확대 보기 인덱스
  // 길찾기 검색어 — 주소가 있으면 주소(정확), 없으면 식장 이름.
  const mapQuery = (inv.venueAddress?.trim() || inv.venue || "").trim();

  const names = `${inv.groomName || "신랑"} · ${inv.brideName || "신부"}`;

  return (
    <div className="px-5 py-4">
      <div className="bg-white overflow-hidden border border-line">
        {/* 1. 히어로 */}
        <div className="relative">
          {inv.heroImageUrl ? (
            <SafeImg src={inv.heroImageUrl} alt="" className="w-full aspect-[3/4] object-cover" />
          ) : (
            <div className={`w-full aspect-[3/4] bg-gradient-to-b ${theme.heroGrad} flex items-center justify-center text-soft text-sm`}>
              대표 사진을 추가해보세요
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-6 pt-20 pb-9 text-white text-center">
            <div className="text-[10.5px] tracking-[0.34em] uppercase mb-3.5 text-white/80">{t("우리 결혼합니다", locale)}</div>
            <div className="mx-auto w-7 h-px bg-white/45 mb-4" />
            <div className={`${fontClass} text-[2rem] leading-tight tracking-wide`}>{names}</div>
            {validDate && (
              <div className="text-[11.5px] mt-3.5 tracking-[0.18em] text-white/85">
                {formatDate(validDate, locale)}{inv.time && ` · ${inv.time}`}
              </div>
            )}
          </div>
        </div>

        {/* 2. 카운트다운 (본식 전) 또는 결혼 알림 (본식 후) */}
        {dday !== null && (
          <div className="py-5 text-center border-b border-line">
            {dday < 0 ? (
              <>
                <div className="text-soft text-xs mb-1">
                  결혼식이 끝났어요
                </div>
                <div className={`${fontClass} text-3xl ${theme.accent}`}>
                  D+{Math.abs(dday)}
                </div>
                <p className="text-xs text-soft mt-2">
                  함께해주셔서 감사합니다
                </p>
              </>
            ) : (
              <>
                <div className="text-soft text-xs mb-1">
                  결혼식까지
                </div>
                <div className={`${fontClass} text-3xl ${theme.accent}`}>
                  {dday > 0 ? `D-${dday}` : "D-DAY"}
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. 모시는 글 */}
        <Reveal>
          <div className="px-7 py-8 text-center border-b border-line">
            <SectionTitle accent={theme.accent}>{t("모시는 글", locale)}</SectionTitle>
            <p className="text-sm leading-loose whitespace-pre-line text-ink/90">{inv.greeting}</p>
          </div>
        </Reveal>

        {/* 4. 혼주 */}
        {(inv.groomParents?.father || inv.groomParents?.mother || inv.brideParents?.father || inv.brideParents?.mother) && (
          <div className="px-7 py-6 text-center border-b border-line text-sm space-y-1">
            {(inv.groomParents?.father || inv.groomParents?.mother) && (
              <div>
                <span className="text-soft">{[inv.groomParents?.father, inv.groomParents?.mother].filter(Boolean).join(" · ")}</span>
                <span className="text-soft text-xs"> 의 {inv.groomOrder || t("아들", locale)} </span>
                <b>{inv.groomName}</b>
              </div>
            )}
            {(inv.brideParents?.father || inv.brideParents?.mother) && (
              <div>
                <span className="text-soft">{[inv.brideParents?.father, inv.brideParents?.mother].filter(Boolean).join(" · ")}</span>
                <span className="text-soft text-xs"> 의 {inv.brideOrder || t("딸", locale)} </span>
                <b>{inv.brideName}</b>
              </div>
            )}
          </div>
        )}

        {/* 5. 캘린더 */}
        {validDate && (
          <Reveal>
            <div className="px-7 py-7 border-b border-line">
              <SectionTitle accent={theme.accent}>{t("예식일", locale)}</SectionTitle>
              <MiniCalendar date={validDate} chipClass={theme.chip} fontClass={fontClass} />
              <button
                onClick={() => downloadIcs(inv, validDate)}
                className="mt-5 mx-auto block text-[11.5px] border border-line bg-white px-3 py-1.5 hover:border-ink active:opacity-70 transition"
              >
                📅 {t("내 캘린더에 추가", locale)}
              </button>
            </div>
          </Reveal>
        )}

        {/* 6. 갤러리 — 탭하면 확대(라이트박스) */}
        {inv.gallery && inv.gallery.length > 0 && (
          <Reveal>
            <div className="px-4 py-7 border-b border-line">
              <SectionTitle accent={theme.accent}>{t("갤러리", locale)}</SectionTitle>
              <div className="grid grid-cols-3 gap-1.5">
                {inv.gallery.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setLightbox(i)}
                    className="block w-full aspect-square overflow-hidden active:opacity-80 transition"
                    aria-label={g.caption || `사진 ${i + 1} 크게 보기`}
                  >
                    <SafeImg src={g.url} alt={g.caption ?? ""} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        )}
        {inv.gallery && lightbox !== null && (
          <GalleryLightbox
            images={inv.gallery}
            index={lightbox}
            onClose={() => setLightbox(null)}
            onIndex={setLightbox}
          />
        )}

        {/* 7. 오시는 길 */}
        {inv.venue && (
          <Reveal>
            <div className="px-7 py-7 border-b border-line text-center">
              <SectionTitle accent={theme.accent}>{t("오시는 길", locale)}</SectionTitle>
              <div className="font-medium">{inv.venue}</div>
              {inv.venueHall && <div className="text-sm text-soft">{inv.venueHall}</div>}
              {inv.venueAddress && (
                <div className="mt-1.5 flex items-center justify-center gap-2 flex-wrap">
                  <span className="text-xs text-soft">{inv.venueAddress}</span>
                  <CopyChip
                    text={inv.venueAddress}
                    label={t("주소 복사", locale)}
                    className="text-[10.5px] border border-line bg-white px-1.5 py-0.5 hover:border-ink active:opacity-70 transition whitespace-nowrap"
                  />
                </div>
              )}
              {mapQuery && (
                <div className="mt-4">
                  <MapEmbed query={mapQuery} heightClass="h-48" label={`${inv.venue || "예식장"} 지도`} />
                </div>
              )}
              <div className="flex gap-2 justify-center mt-4 flex-wrap">
                <a
                  href={`https://map.kakao.com/link/search/${encodeURIComponent(mapQuery)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-2 bg-cream border border-line hover:border-ink transition"
                >
                  카카오맵
                </a>
                <a
                  href={`https://map.naver.com/v5/search/${encodeURIComponent(mapQuery)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-2 bg-cream border border-line hover:border-ink transition"
                >
                  네이버지도
                </a>
              </div>
            </div>
          </Reveal>
        )}

        {/* 8. 연락처 */}
        {(inv.groomPhone || inv.bridePhone) && (
          <div className="px-7 py-6 border-b border-line">
            <SectionTitle accent={theme.accent}>{t("연락하기", locale)}</SectionTitle>
            <div className="flex gap-2">
              {safeTel(inv.groomPhone) && (
                <a href={`tel:${safeTel(inv.groomPhone)}`} className="flex-1 text-center text-sm py-2.5 bg-cream border border-line">
                  {t("신랑", locale)}
                </a>
              )}
              {safeTel(inv.bridePhone) && (
                <a href={`tel:${safeTel(inv.bridePhone)}`} className="flex-1 text-center text-sm py-2.5 bg-cream border border-line">
                  {t("신부", locale)}
                </a>
              )}
            </div>
          </div>
        )}

        {/* 9. 마음 전하실 곳 */}
        {(inv.groomAccount || inv.brideAccount) && (
          <Reveal>
            <AccountSection inv={inv} locale={locale} accent={theme.accent} />
          </Reveal>
        )}

        {/* 10. RSVP (본식 전) 또는 감사 인사 (본식 후) */}
        {dday !== null && dday < 0 ? (
          <div className="px-7 py-8 text-center">
            <SectionTitle accent={theme.accent}>
              감사의 인사
            </SectionTitle>
            <p className="text-sm leading-relaxed text-ink/90 whitespace-pre-line">
              {"축하해주신 모든 분들께\n진심으로 감사드립니다.\n\n앞으로 더 행복하게 살아보겠습니다."}
            </p>
          </div>
        ) : (
          <div className="px-7 py-7 text-center">
            <SectionTitle accent={theme.accent}>{t("참석 의사 전달", locale)}</SectionTitle>
            <p className="text-xs text-soft mb-3">{t("축하의 마음으로 참석해 주시는 분들을 위해", locale)}</p>
            <button
              className="btn-primary text-sm w-full"
              onClick={onRsvpClick}
              disabled={!rsvpEnabled || !onRsvpClick}
            >
              {t("참석 여부 전하기", locale)}
            </button>
            {!rsvpEnabled && (
              <p className="text-[11px] text-soft mt-2">
                {t("RSVP는 발행된 하객용 링크에서 작동합니다", locale)}
              </p>
            )}
          </div>
        )}

        {/* BGM */}
        {safeMediaSrc(inv.bgmUrl) && (
          <div className="px-7 py-4 border-t border-line text-center">
            <p className="text-xs text-soft mb-2">{t("배경 음악", locale)}</p>
            <audio src={safeMediaSrc(inv.bgmUrl)} controls className="w-full" />
          </div>
        )}

        {/* 푸터 */}
        <div className="bg-cream py-6 text-center text-xs text-soft">
          {names}
          {validDate && <div className="mt-1">{formatDate(validDate, locale)}</div>}
        </div>
      </div>

      {!hideShareBox && onShare && (
        <>
          <button
            onClick={onShare}
            className="mt-4 btn-primary w-full py-3.5"
          >
            {shareCopied ? "복사됐어요" : "청첩장 공유하기"}
          </button>
          {shareHint && (
            <p className="text-xs text-center text-soft mt-3 leading-relaxed">
              {shareHint}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// 본문 섹션 제목 — 히어로의 에디토리얼 톤을 이어받는다: 자간 넓힌 라벨 + 가는 장식선.
// 장식선은 bg-current(=accent 색)로 — 동적 클래스 조합은 Tailwind JIT가 못 잡으므로 currentColor 사용.
function SectionTitle({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div className={`flex flex-col items-center mb-5 ${accent}`}>
      <h2 className="text-[12px] tracking-[0.2em] uppercase font-medium">{children}</h2>
      <span className="block w-6 h-px mt-3 bg-current opacity-30" />
    </div>
  );
}

function AccountSection({ inv, locale, accent }: { inv: InvitationContent; locale: Locale; accent: string; }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-7 py-6 border-b border-line text-center">
      <button onClick={() => setOpen((o) => !o)} className={`text-sm ${accent} tracking-wide`} aria-expanded={open}>
        {t("마음 전하실 곳", locale)} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-sm">
          {inv.groomAccount && (
            <AccountRow label={`${t("신랑", locale)} · ${inv.groomName}`} account={inv.groomAccount} locale={locale} />
          )}
          {inv.brideAccount && (
            <AccountRow label={`${t("신부", locale)} · ${inv.brideName}`} account={inv.brideAccount} locale={locale} />
          )}
        </div>
      )}
    </div>
  );
}

// 스크롤 등장 — 뷰포트에 들어오면 부드럽게 페이드+업. 모션 줄이기 설정·미지원 시 즉시 표시.
function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-[800ms] ease-out ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"} ${className}`}
    >
      {children}
    </div>
  );
}

// 작은 복사 칩 — 주소 등 한 값 클립보드 복사 + 피드백.
function CopyChip({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
        catch { window.prompt("복사하세요:", text); }
      }}
      className={className}
    >
      {copied ? "✓" : label}
    </button>
  );
}

// 갤러리 확대 보기 — 풀스크린 + 좌우 이동(화살표·스와이프·키보드) + 캡션.
function GalleryLightbox({ images, index, onClose, onIndex }: {
  images: { url: string; caption?: string }[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const touchX = useRef<number | null>(null);
  const go = (delta: number) => onIndex((index + delta + images.length) % images.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images.length]);

  const img = images[index];
  const many = images.length > 1;
  return (
    <div className="fixed inset-0 z-50 bg-black/92 flex flex-col" onClick={onClose}>
      <div className="flex justify-between items-center px-4 py-3 text-white/75 text-[12px]">
        <span className="tabular-nums">{index + 1} / {images.length}</span>
        <button onClick={onClose} className="text-white/75 hover:text-white text-xl leading-none px-2" aria-label="닫기">✕</button>
      </div>
      <div
        className="flex-1 flex items-center justify-center px-2 relative min-h-0"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (many && Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {many && (
          <button onClick={() => go(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl px-2 leading-none" aria-label="이전">‹</button>
        )}
        <SafeImg src={img.url} alt={img.caption ?? ""} className="max-h-full max-w-full object-contain" />
        {many && (
          <button onClick={() => go(1)} className="absolute right-1 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl px-2 leading-none" aria-label="다음">›</button>
        )}
      </div>
      {img.caption && (
        <div className="px-6 py-4 text-center text-white/85 text-[13px] leading-relaxed" onClick={(e) => e.stopPropagation()}>
          {img.caption}
        </div>
      )}
    </div>
  );
}

// 계좌 한 줄 + 복사 버튼 — 하객이 제일 많이 누르는 동작. 자유형식 계좌 문자열을 그대로 복사.
function AccountRow({ label, account, locale }: { label: string; account: string; locale: Locale }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(t("계좌번호를 복사하세요", locale), account);
    }
  };
  return (
    <div className="bg-cream py-2.5 px-3 flex items-center justify-between gap-3 text-left">
      <div className="min-w-0">
        <div className="text-soft text-xs">{label}</div>
        <div className="break-all">{account}</div>
      </div>
      <button
        onClick={copy}
        className="flex-shrink-0 text-[11px] border border-line bg-white px-2.5 py-1.5 hover:border-ink active:opacity-70 transition whitespace-nowrap"
      >
        {copied ? `✓ ${t("복사됨", locale)}` : t("복사", locale)}
      </button>
    </div>
  );
}

// 결혼식을 하객 캘린더에 추가 — .ics 다운로드 (모바일은 탭 시 '캘린더에 추가' 안내).
// 시간(inv.time)이 자유형식 텍스트라 종일 이벤트로 만들고, 시간·식장은 설명에 담는다.
function downloadIcs(inv: InvitationContent, date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const next = new Date(date.getTime() + 86400000);
  const summary = `${inv.groomName || "신랑"} ♥ ${inv.brideName || "신부"} 결혼식`;
  const loc = [inv.venue, inv.venueHall, inv.venueAddress].filter(Boolean).join(", ");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dearie//KR//", "BEGIN:VEVENT",
    `UID:dearie-${ymd(date)}@withdearie.com`,
    `DTSTART;VALUE=DATE:${ymd(date)}`,
    `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:${esc(summary)}`,
    loc ? `LOCATION:${esc(loc)}` : "",
    inv.time ? `DESCRIPTION:${esc(inv.time)}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  try {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wedding.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch { /* noop */ }
}

function MiniCalendar({ date, chipClass, fontClass = "font-serif" }: { date: Date; chipClass: string; fontClass?: string; }) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const WD = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div>
      <div className={`text-center ${fontClass} text-lg mb-3`}>{year}.{String(month + 1).padStart(2, "0")}</div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WD.map((w, i) => (
          <div key={w} className="py-1 text-soft">{w}</div>
        ))}
        {cells.map((c, i) => (
          <div key={i} className="py-1.5">
            {c === day ? (
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-none ${chipClass} text-white font-medium`}>{c}</span>
            ) : (
              <span className={`${i % 7 === 0 || i % 7 === 6 ? "text-soft" : "text-ink"}`}>{c}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════ 청첩장 발행 ════════════ */

const PUBLISHED_KEY = "wedding-os/published-invite";
type PublishedInvite = { code: string; keyRaw: string; rsvpToken?: string; publishedAt: string };

function hostedInviteLink(published: PublishedInvite): string {
  const rsvp = published.rsvpToken ? `&r=${encodeURIComponent(published.rsvpToken)}` : "";
  return `${window.location.origin}/i/${published.code}#k=${published.keyRaw}${rsvp}`;
}

function loadPublished(): PublishedInvite | null {
  try {
    const raw = localStorage.getItem(PUBLISHED_KEY);
    return raw ? (JSON.parse(raw) as PublishedInvite) : null;
  } catch {
    return null;
  }
}
function storePublished(p: PublishedInvite | null) {
  try {
    if (p) localStorage.setItem(PUBLISHED_KEY, JSON.stringify(p));
    else localStorage.removeItem(PUBLISHED_KEY);
  } catch {
    /* noop */
  }
}

// 청첩장 '간편 발행' — 운영자 호스팅으로 진짜 링크를 만든다.
// 본문은 암호화돼 올라가고 키는 링크 '#' 에만 — 운영자는 내용을 못 읽는다.
function PublishSection({ data, update }: { data: WeddingData; update: (patch: WeddingUpdate) => void }) {
  // 발행 자격증명의 진실은 WeddingData.publish (백업에 포함). 옛 사용자는 localStorage 에만
  // 있을 수 있으므로 그걸 폴백으로 읽고, 마운트 시 WeddingData 로 한 번 옮긴다.
  const [published, setPublished] = useState<PublishedInvite | null>(
    () => data.publish ?? loadPublished(),
  );
  const [busy, setBusy] = useState(false);
  const [unpubBusy, setUnpubBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rsvps, setRsvps] = useState<HostedRsvp[] | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [rsvpMsg, setRsvpMsg] = useState("");
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  // 옛 localStorage 발행 정보를 WeddingData(백업 대상)로 1회 이전.
  useEffect(() => {
    if (!data.publish) {
      const legacy = loadPublished();
      if (legacy) update((prev: WeddingData) => ({ ...prev, publish: legacy }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inv = data.invitation;
  const link = published
    ? hostedInviteLink(published)
    : "";

  const setPreviewImageEnabled = (enabled: boolean) => {
    update((prev: WeddingData) => ({
      ...prev,
      invitation: { ...prev.invitation, previewImageEnabled: enabled },
    }));
    if (published) {
      setIsError(false);
      setMessage("링크 미리보기 사진 설정을 바꿨어요. 재발행하면 공유 카드가 업데이트됩니다.");
    }
  };

  // 발행 정보를 세 곳 모두에 일관되게 반영: 컴포넌트 상태 · localStorage 미러 · WeddingData(백업).
  const persistPublished = (next: PublishedInvite | null) => {
    storePublished(next);
    setPublished(next);
    update((prev: WeddingData) => ({ ...prev, publish: next ?? undefined }));
  };

  const doPublish = async () => {
    if (!inv.groomName || !inv.brideName) {
      setIsError(true);
      setMessage("신랑·신부 이름을 먼저 입력해주세요.");
      return;
    }
    setBusy(true);
    setMessage("");
    setIsError(false);
    const r = await publishInvitation(
      data,
      published ? { code: published.code, keyRaw: published.keyRaw, rsvpToken: published.rsvpToken } : undefined,
    );
    setBusy(false);
    if (r.ok) {
      persistPublished({
        code: r.code,
        keyRaw: r.keyRaw,
        rsvpToken: r.rsvpToken,
        publishedAt: new Date().toISOString(),
      });
      setIsError(false);
      const notes: string[] = [];
      if (r.previewImageRequested && !r.previewImageIncluded) {
        notes.push("대표사진 썸네일은 만들지 못해 이름·날짜 카드로 발행됐어요.");
      }
      if (r.droppedPhotos > 0) {
        notes.push(`사진 ${r.droppedPhotos}장은 원본을 못 찾아 빠졌어요.`);
      }
      setMessage(notes.length > 0
        ? `발행 완료 — ${notes.join(" ")}`
        : r.previewImageIncluded
          ? "발행 완료! 링크 미리보기에 대표사진이 표시됩니다."
          : "발행 완료! 아래 링크를 하객에게 보내세요.",
      );
    } else {
      setIsError(true);
      setMessage(r.reason);
    }
  };

  const doUnpublish = async () => {
    if (!published) return;
    setConfirmUnpublish(true);
  };

  const confirmUnpublishNow = async () => {
    if (!published) return;
    setUnpubBusy(true);
    setMessage("");
    setIsError(false);
    const r = await unpublishInvitation(published.code);
    setUnpubBusy(false);
    if (r.ok) {
      persistPublished(null);
      setRsvps(null);
      setRsvpMsg("");
      setMessage("발행이 취소됐어요. 링크가 더 이상 열리지 않아요.");
    } else {
      setIsError(true);
      setMessage(r.reason);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt("아래 링크를 복사해 하객에게 보내세요:", link);
    }
  };

  const loadRsvps = async () => {
    if (!published) return;
    setRsvpBusy(true);
    setRsvpMsg("");
    const r = await fetchHostedRsvps(published.code, published.keyRaw);
    setRsvpBusy(false);
    if (r.ok) {
      setRsvps(r.rsvps);
      setRsvpMsg(r.rsvps.length === 0 ? "아직 받은 응답이 없어요." : "");
    } else {
      setRsvpMsg(r.reason);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-soft leading-relaxed">
        하객에게 보낼 <b className="text-ink">청첩장 웹 링크</b>를 만듭니다. 내용은 암호화되어 올라가며,
        운영자도 청첩장 본문을 읽을 수 없습니다. 이 링크는 편집 초대 링크와 다릅니다.
      </p>

      <PreviewImageOption
        inv={inv}
        enabled={!!inv.previewImageEnabled}
        published={!!published}
        onToggle={setPreviewImageEnabled}
      />

      {(() => {
        const readiness = invitationReadiness(data);
        if (readiness.missing.length === 0) return null;
        return (
          <div className="border border-hair bg-cream/40 px-4 py-3 space-y-2">
            <p className="text-[11.5px] text-soft leading-relaxed break-keep">
              {published ? "재발행 전에" : "발행 전에"} {readiness.missing.length}가지가 비어 있어요.
              누르면 해당 입력으로 이동합니다.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {readiness.missing.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => scrollToMissingField(label)}
                  className="seg break-keep"
                >
                  {label} 채우기 →
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {published ? (
        <div className="space-y-3">
          <div className="border-y border-hair py-3">
            <div className="eyebrow-gold mb-1.5">발행된 링크</div>
            <div className="text-[12px] text-ink break-all leading-relaxed">{link}</div>
          </div>
          <div className="flex gap-3">
            <button onClick={copyLink} className="btn-primary flex-1 py-3 text-[12px]">
              {copied ? "복사됨" : "링크 복사"}
            </button>
            <a
              href={hostedInviteLink(published)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center border border-hair py-3 text-[12px] text-ink hover:border-ink transition"
            >
              미리보기 ↗
            </a>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={doPublish}
              disabled={busy || unpubBusy}
              className="text-[12px] text-soft underline underline-offset-4 hover:text-ink disabled:opacity-40"
            >
              {busy ? "갱신 중…" : "수정 내용으로 재발행"}
            </button>
            <button
              onClick={doUnpublish}
              disabled={busy || unpubBusy}
              className="text-[12px] text-soft underline underline-offset-4 hover:text-gold disabled:opacity-40"
            >
              {unpubBusy ? "취소 중…" : "발행 취소"}
            </button>
          </div>

          <div className="border-t border-hair pt-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="eyebrow-gold">받은 RSVP{rsvps ? ` · ${rsvps.length}` : ""}</div>
              <button
                onClick={loadRsvps}
                disabled={rsvpBusy}
                className="text-[12px] underline underline-offset-4 text-ink hover:text-gold disabled:opacity-40"
              >
                {rsvpBusy ? "불러오는 중…" : rsvps ? "새로고침" : "응답 보기"}
              </button>
            </div>
            {rsvpMsg && <p className="text-[11.5px] text-soft">{rsvpMsg}</p>}
            {rsvps && rsvps.length > 0 && (
              <ul className="group-card px-4">
                {rsvps.map((r, i) => (
                  <li key={i} className="py-2.5 text-[12px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-ink font-medium">{r.name}</span>
                      <span className={r.attending ? "text-gold" : "text-soft"}>
                        {r.attending ? `참석 · ${r.guests ?? 1}명` : "불참"}
                      </span>
                    </div>
                    {(r.meal || r.message) && (
                      <div className="text-[11px] text-soft mt-1 leading-relaxed">
                        {r.meal && <div>식사: {r.meal}</div>}
                        {r.message && <div>{r.message}</div>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {rsvps && rsvps.length > 0 && (() => {
              const attending = rsvps.filter((r) => r.attending);
              const headcount = attending.reduce((s, r) => s + (r.guests ?? 1), 0);
              const mealNotes = attending.filter((r) => !!r.meal?.trim()).length;
              const listedMeals = mealTicketCount(data);
              return (
                <div className="border-t border-hair pt-2.5 space-y-1.5">
                  <p className="text-[12px] text-ink">
                    참석 {headcount}명{mealNotes > 0 ? ` · 식사 메모 ${mealNotes}건` : ""} (응답 {rsvps.length}건)
                  </p>
                  <p className="text-[11.5px] text-soft leading-relaxed break-keep">
                    이 숫자는 하객 명단·식수와 이어져요. 지금 명단 기준 식수는 {listedMeals}명이라,
                    응답을 명단에 옮겨 두면 보증인원 확정이 쉬워집니다.
                  </p>
                  <Link
                    to="/guests"
                    className="inline-block text-[12px] underline underline-offset-4 text-ink hover:text-gold"
                  >
                    하객 명단·식수에서 이어보기 →
                  </Link>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <button
          onClick={doPublish}
          disabled={busy}
          className="btn-primary w-full py-3.5 text-[12.5px] disabled:opacity-50"
        >
          {busy ? "발행 중…" : "청첩장 발행하기 →"}
        </button>
      )}

      {message && (
        <p className={`text-[11.5px] leading-relaxed ${isError ? "text-gold" : "text-soft"}`}>
          {message}
        </p>
      )}

      <p className="text-[11px] text-soft leading-relaxed border-t border-hair pt-3">
        발행 링크는 백업 파일에도 저장됩니다. 다른 기기에서 수정·발행 취소·RSVP 확인까지 하려면 편집 초대 링크도 필요해요.
        청첩장은 예식 6개월 뒤 자동 삭제됩니다.
      </p>
      <DearieConfirmModal
        open={confirmUnpublish}
        title="발행을 취소할까요?"
        body="하객이 받은 링크가 더 이상 열리지 않고, 올라간 청첩장과 받은 RSVP가 서버에서 삭제됩니다. 되돌릴 수 없어요."
        confirmLabel="발행 취소"
        tone="warn"
        onClose={() => setConfirmUnpublish(false)}
        onConfirm={confirmUnpublishNow}
      />
    </div>
  );
}

function PreviewImageOption({
  inv,
  enabled,
  published,
  onToggle,
}: {
  inv: InvitationContent;
  enabled: boolean;
  published: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const hasImage = !!inv.heroImageUrl;
  const active = hasImage && enabled;
  const actionWord = published ? "재발행하면" : "발행하면";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label="링크 미리보기 대표사진 사용"
      disabled={!hasImage}
      onClick={() => hasImage && onToggle(!enabled)}
      className={`w-full border border-hair px-3 py-3 text-left transition disabled:cursor-not-allowed ${
        active ? "bg-gold/5 border-gold/40" : "bg-white/50 hover:border-mute"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-md overflow-hidden bg-cream border border-hair flex-shrink-0">
          {hasImage ? (
            <SafeImg src={inv.heroImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-[10px] text-soft">사진 없음</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="eyebrow-gold">링크 미리보기 사진</div>
            <span className={`text-[11px] ${active ? "text-gold" : "text-soft"}`}>
              {active ? "켜짐" : "꺼짐"}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-soft leading-relaxed">
            {hasImage
              ? active
                ? `${actionWord} 대표사진 축소본이 카톡·문자 공유 카드에 공개 표시됩니다.`
                : "누르면 대표사진을 공유 카드 썸네일로 씁니다. 꺼두면 이름·날짜 카드만 보여요."
              : "대표사진을 넣으면 공유 카드 썸네일로 쓸 수 있어요."}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`relative w-10 h-6 rounded-full flex-shrink-0 transition ${
            active ? "bg-gold" : "bg-mute"
          }`}
        >
          <span
            className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition ${
              active ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </span>
      </div>
    </button>
  );
}

/* ════════════ 편집 폼 ════════════ */

// 30초 완성 — 새 청첩장의 마찰 제거. 이름·날짜·식장만 받으면 모시는 글·디자인은
// 이미 채워져 있어 즉시 완성된 청첩장이 된다. 필수가 채워지면 카드는 사라지고
// 상세 섹션만 남는다(편집은 같은 inv 를 가리키므로 중복 입력이 아님).
function QuickStart({ inv, set, onPreview, contractedVenueName }: {
  inv: InvitationContent;
  set: (k: any, v: any) => void;
  onPreview?: () => void;
  contractedVenueName?: string;
}) {
  // 미리보기는 이름만 있으면 열어준다 — 날짜·장소는 미리보기를 보며 더해도 되고,
  // 미리보기 자체가 '날짜 미정'도 정상 렌더한다. (예전엔 날짜까지 강제해 버튼이 막혔음)
  const ready = !!inv.groomName.trim() && !!inv.brideName.trim();
  const groomRef = useRef<HTMLInputElement>(null);
  const brideRef = useRef<HTMLInputElement>(null);
  const startOrPreview = () => {
    if (!ready) {
      (!inv.groomName.trim() ? groomRef : brideRef).current?.focus();
      return;
    }
    onPreview?.();
  };
  // 마운트 시점에 이미 필수가 있으면 노출 안 함. 채우는 중 완성돼도 카드는 유지해
  // CTA 버튼이 사라지지 않게 하고, 미리보기 다녀와 EditForm 이 재마운트되면 그때 사라진다.
  const [neededAtMount] = useState(!ready);
  if (!neededAtMount) return null;
  return (
    <div className="mb-5 border-y border-hair py-7">
      <h3 className="max-w-[20rem] font-serif text-[1.75rem] leading-[1.25] text-ink mb-3">
        {koBreak(ready ? "좋아요, 이제 화면으로 볼게요" : "두 분 이름부터 적어볼까요?")}
      </h3>
      <p className="max-w-[28rem] text-[13.5px] text-soft leading-[1.75] mb-5 break-keep">
        날짜와 장소는 비워도 괜찮아요. 이름을 넣으면 Dearie가 채워 둔 문안과 디자인을 바로 보여드릴게요.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-soft">신랑</span>
          <input ref={groomRef} aria-label="신랑 이름" className="input text-[17px] placeholder:text-mute" value={inv.groomName} onChange={(e) => set("groomName", e.target.value)} placeholder="이름" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-soft">신부</span>
          <input ref={brideRef} aria-label="신부 이름" className="input text-[17px] placeholder:text-mute" value={inv.brideName} onChange={(e) => set("brideName", e.target.value)} placeholder="이름" />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="mb-1 flex items-center justify-between gap-3 text-[12px] font-medium text-soft">
          <span>예식 날짜</span>
          <span className="text-[11px] font-normal text-mute">나중에</span>
        </span>
        <input
          aria-label="예식 날짜"
          type="date"
          className={`input text-[17px] ${inv.date ? "text-ink" : "text-soft"}`}
          value={inv.date}
          onChange={(e) => set("date", e.target.value)}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1 flex items-center justify-between gap-3 text-[12px] font-medium text-soft">
          <span>예식장</span>
          <span className="text-[11px] font-normal text-mute">나중에</span>
        </span>
        <input aria-label="예식장" className="input text-[17px] placeholder:text-mute" value={inv.venue} onChange={(e) => set("venue", e.target.value)} placeholder="예식장 이름" />
        {!inv.venue.trim() && contractedVenueName && (
          <button type="button" onClick={() => set("venue", contractedVenueName)} className="mt-2 text-[12px] text-gold underline underline-offset-4 break-keep">
            계약한 ‘{contractedVenueName}’ 불러오기 →
          </button>
        )}
      </label>
      <button
        type="button"
        onClick={startOrPreview}
        className={`mt-6 w-full min-h-12 px-5 py-3.5 text-[13px] font-medium transition active:scale-[0.99] ${ready ? "btn-primary" : "inline-flex items-center justify-center border border-ink bg-transparent text-ink hover:bg-cream/50"}`}
      >
        {ready ? "미리보기로 바로 보기 →" : "이름부터 채워볼게요 →"}
      </button>
      <p className="text-[11px] text-soft text-center mt-3 leading-relaxed">
        {ready
          ? "사진·색감은 미리보기를 본 뒤 천천히 더해도 돼요."
          : "두 분 이름만 채우면 완성된 청첩장을 볼 수 있어요."}
      </p>
    </div>
  );
}

// 편집 화면 상단의 '도우미' 띠 — 빈 폼이 한꺼번에 쏟아지는 느낌을 줄이고,
// 지금 무엇이 남았는지 + 다른 화면의 정보로 한 번에 채울 수 있는 것을 먼저 안내한다.
function EditAssist({ inv, set, data, onPreview }: {
  inv: InvitationContent;
  set: (k: any, v: any) => void;
  data: WeddingData;
  onPreview?: () => void;
}) {
  const r = invitationReadiness(data);
  const venueName = contractedVenue(data)?.name;
  const canFillVenue = !inv.venue.trim() && !!venueName;
  const done = r.filled >= r.total;
  return (
    <div className="border border-hair bg-cream/30 px-5 py-5 mb-7">
      <div className="flex items-stretch gap-2.5 mb-2.5">
        <span aria-hidden="true" className="w-px self-stretch bg-gold/70" />
        <span className="eyebrow-gold leading-none pt-0.5">청첩장 도우미</span>
      </div>
      <p className="text-[13px] text-soft leading-[1.7] break-keep">
        {done
          ? "기본 정보가 모두 준비됐어요. 사진·색감을 더하거나 바로 미리보기로 확인해 보세요."
          : koBreak(`공유까지 ${r.total - r.filled}가지만 더 채우면 돼요 — ${r.missing.join(", ")}.`)}
      </p>
      <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2.5">
        {canFillVenue && (
          <button type="button" onClick={() => set("venue", venueName)} className="seg break-keep">
            계약한 ‘{venueName}’ 넣기
          </button>
        )}
        {onPreview && (
          <button type="button" onClick={onPreview} className="seg">
            미리보기로 확인
          </button>
        )}
      </div>
    </div>
  );
}

function EditForm({ inv, set, mode, data, update, onPreview }: {
  inv: InvitationContent;
  set: (k: any, v: any) => void;
  mode: Mode | null;
  data: WeddingData;
  update: (patch: WeddingUpdate) => void;
  onPreview?: () => void;
}) {
  const [picker, setPicker] = useState<null | "hero" | "gallery">(null);
  const [bridgePrompt, setBridgePrompt] = useState<BridgePrompt | null>(null);
  const theme = (inv.theme as Theme) ?? "cream";
  // 새 청첩장 여부 — 이름·날짜가 비면 QuickStart(30초 완성)를 앞세우고 발행 섹션은 접어둔다.
  const hasEssentials = !!inv.groomName && !!inv.brideName && !!inv.date;
  const [showQuickStart] = useState(!hasEssentials);
  const saveStatus = useSaveStatus();
  const saveLabel =
    saveStatus === "saving" ? "저장 중" :
    saveStatus === "saved" ? "저장됨" :
    saveStatus === "error" ? "저장 실패" :
    mode === "local" ? "이 기기에 자동 저장" : "자동 저장";
  const readiness = invitationReadiness(data);
  const contracted = contractedVenue(data);
  const canFillVenue = !inv.venue.trim() && !!contracted;
  const publishReady = !!inv.groomName && !!inv.brideName && !!inv.date && !!inv.venue;
  const applyContractedVenue = () => {
    if (!contracted) return;
    set("venue", contracted.name);
    if (!inv.venueAddress && contracted.region) set("venueAddress", contracted.region);
  };
  const scrollToPublish = () => document.getElementById("publish-invitation")?.scrollIntoView({ behavior: "smooth", block: "start" });
  // 상담에서 정한 기준(문안 톤·사진·공개 범위)을 편집 화면 상단에 판단 재료로 되비춘다.
  const decidedFacts = consultationFacts(data, "invitation");
  const privacyLimited = consultationChoice(data, "invitation", "invitation-privacy").includes("limited");

  return (
    <div className={`page ${showQuickStart ? "pt-14" : "pt-2"} pb-6`}>
      {!showQuickStart && <div className="sticky top-[145px] z-10 -mx-6 px-6 py-2 bg-paper/95 backdrop-blur border-b border-hair">
        <div className={`eyebrow ${saveStatus === "error" ? "text-gold" : saveStatus === "saved" ? "text-sage" : "text-soft"}`}>
          {saveLabel} · 입력하면 바로 저장돼요
        </div>
      </div>}

      {showQuickStart && <QuickStart inv={inv} set={set} onPreview={onPreview} contractedVenueName={contractedVenue(data)?.name} />}

      {!showQuickStart && <>
      {decidedFacts.length > 0 && (
        <div className="mt-3 mb-4 border-l-2 border-gold pl-3 py-1.5">
          <div className="eyebrow-gold mb-1">정한 기준</div>
          <p className="text-[12px] text-soft leading-relaxed break-keep">
            {koBreak(decidedFacts.join(" · "))}
          </p>
        </div>
      )}
      <SectionDecisionLoop data={data} sectionId="invitation" />

      <ProcessAgentPanel
        title={publishReady ? "공유 전 마지막 점검 중" : "청첩장 빈칸을 채우는 중"}
        summary={
          publishReady
            ? "하객에게 보낼 기본 정보는 준비됐어요. 이제 대표 사진, 지도/주차 안내, 계좌 공개 범위를 확인하고 발행하면 됩니다."
            : `공유까지 ${readiness.total - readiness.filled}가지만 더 채우면 됩니다. 빠진 항목은 ${readiness.missing.join(", ") || "없음"}입니다.`
        }
        mood={publishReady ? "ready" : "thinking"}
        metrics={[
          { label: "기본 정보", value: `${readiness.filled}/${readiness.total}`, tone: readiness.filled < readiness.total ? "warn" : "normal" },
          { label: "사진", value: inv.heroImageUrl ? "있음" : "없음", tone: inv.heroImageUrl ? "normal" : "muted" },
          { label: "발행", value: data.publish ? "완료" : "전", tone: data.publish ? "normal" : publishReady ? "warn" : "muted" },
        ]}
        steps={[
          { label: "이름·날짜·식장 채우기", detail: "카톡 미리보기와 하객 문의에 가장 크게 영향을 줍니다.", done: publishReady },
          { label: "모시는 글 검수", detail: "AI 문안은 초안일 뿐이라, 이름·계좌·개인정보가 섞이지 않았는지 봅니다.", done: !!inv.greeting.trim() },
          { label: "대표 사진과 지도 확인", detail: "공개 링크에서 보이는 인상과 찾아오는 길을 마지막으로 봅니다.", done: !!inv.heroImageUrl && !!inv.venue },
          { label: "하객용 링크 발행", detail: "발행 후 수정한 내용은 재발행으로 업데이트합니다.", done: !!data.publish },
        ]}
        actions={[
          ...(canFillVenue ? [{ label: `계약한 ‘${contracted!.name}’ 넣기 →`, onClick: applyContractedVenue, tone: "primary" as const }] : []),
          { label: "모시는 글 다듬기 →", onClick: () => setBridgePrompt(invitationGreetingPrompt(inv, "담백하고 정중하게")), tone: "primary" },
          ...(onPreview ? [{ label: "미리보기로 확인", onClick: onPreview }] : []),
          ...(publishReady ? [{ label: "발행 섹션으로", onClick: scrollToPublish }] : []),
        ]}
      />

      <SectionConsultationPanel sectionId="invitation" data={data} update={update} />

      <div id="publish-invitation" className="scroll-mt-36">
        <Section title="하객용 링크 발행" defaultOpen={hasEssentials || location.search.includes("edit=publish")}>
          <PublishSection data={data} update={update} />
        </Section>
      </div>

      <Section title="대표 사진 & 색감" defaultOpen>
        {inv.heroImageUrl && (
          <SafeImg src={inv.heroImageUrl} alt="" className="w-full aspect-[3/4] object-cover rounded-xl" />
        )}
        <HeroUploadButton
          mode={mode}
          onUploaded={(dataUrl) => set("heroImageUrl", dataUrl)}
        />
        <button onClick={() => setPicker("hero")} className="btn-secondary w-full text-sm">
          추천 사진에서 고르기
        </button>
        <p className="text-[11px] text-soft leading-relaxed">
          하객의 접속 정보가 외부 서버로 전달되지 않도록 임의 사진 URL은 받지 않습니다. 내 사진 업로드를 이용해주세요.
        </p>

        <label className="label mt-3">청첩장 색감</label>
        <div className="grid grid-cols-4 gap-3">
          {(Object.keys(THEME) as Theme[]).map((id) => {
            const t = THEME[id];
            const isOn = theme === id;
            return (
              <button
                key={id}
                onClick={() => set("theme", id)}
                className={`flex flex-col items-center gap-2 py-2 transition ${isOn ? "" : "opacity-60 hover:opacity-100"}`}
              >
                <span className={`w-6 h-6 rounded-full ${t.swatch} ${isOn ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""}`} />
                <span className={`text-[10.5px] tracking-wide ${isOn ? "text-ink" : "text-soft"}`}>{t.label}</span>
              </button>
            );
          })}
        </div>

        <label className="label mt-4">폰트 톤</label>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(FONT) as FontStyle[]).map((id) => {
            const f = FONT[id];
            const isOn = ((inv.fontStyle as FontStyle) ?? "serif") === id;
            return (
              <button
                key={id}
                onClick={() => set("fontStyle", id)}
                className={`flex flex-col items-center gap-1 py-3 border-b-2 transition ${isOn ? "border-ink" : "border-hair hover:border-mute"}`}
              >
                <span className={`${f.class} text-base ${isOn ? "text-ink" : "text-soft"}`}>{f.sample}</span>
                <span className="eyebrow mt-1">{f.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {!showQuickStart && <div id="inv-names" className="scroll-mt-36"><Section title="신랑 · 신부" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Field label="신랑 이름"><input className="input" value={inv.groomName} onChange={(e) => set("groomName", e.target.value)} placeholder="도현" /></Field>
          <Field label="신부 이름"><input className="input" value={inv.brideName} onChange={(e) => set("brideName", e.target.value)} placeholder="지윤" /></Field>
        </div>
      </Section></div>}

      {!showQuickStart && <div id="inv-schedule" className="scroll-mt-36"><Section title="예식 일정" defaultOpen>
        <Field label="날짜"><input type="date" className={`input ${inv.date ? "text-ink" : "text-soft"}`} value={inv.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="시간"><input className="input" value={inv.time ?? ""} onChange={(e) => set("time", e.target.value)} placeholder="오후 3시" /></Field>
        <Field label="예식장"><input className="input" value={inv.venue} onChange={(e) => set("venue", e.target.value)} placeholder="서울대학교 교수회관" /></Field>
        <Field label="홀/층"><input className="input" value={inv.venueHall ?? ""} onChange={(e) => set("venueHall", e.target.value)} placeholder="3층 그랜드볼룸" /></Field>
        <Field label="주소"><input className="input" value={inv.venueAddress ?? ""} onChange={(e) => set("venueAddress", e.target.value)} placeholder="서울특별시 관악구..." /></Field>
        <p className="text-[11px] text-soft leading-relaxed">
          주차, 셔틀, 지하철 출구, 약도 이미지는 식장 안내를 받은 뒤 모시는 글이나 갤러리에 짧게 더하면 됩니다.
        </p>
      </Section></div>}

      <div id="inv-greeting" className="scroll-mt-36">
      <Section title="모시는 글" defaultOpen>
        <textarea aria-label="모시는 글" className="input min-h-[140px]" value={inv.greeting} onChange={(e) => set("greeting", e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "담백하게", tone: "담백하고 정중하게" },
            { label: "따뜻하게", tone: "조금 더 따뜻하지만 과하지 않게" },
            { label: "짧게", tone: "짧고 정중하게" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setBridgePrompt(invitationGreetingPrompt(inv, option.tone))}
              className="border border-hair py-2 text-[12px] text-ink hover:border-ink active:opacity-70"
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-soft leading-relaxed">
          이름·연락처·계좌는 보내지 않고, 현재 문안과 예식 정보 정도만 바탕으로 다듬습니다.
        </p>
      </Section>
      </div>

      <Section title="혼주" defaultOpen={false}>
        <div className="text-xs text-soft">신랑 측</div>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="신랑 측 아버지 성함" className="input" placeholder="아버지" value={inv.groomParents?.father ?? ""} onChange={(e) => set("groomParents", { ...inv.groomParents, father: e.target.value })} />
          <input aria-label="신랑 측 어머니 성함" className="input" placeholder="어머니" value={inv.groomParents?.mother ?? ""} onChange={(e) => set("groomParents", { ...inv.groomParents, mother: e.target.value })} />
        </div>
        <input aria-label="신랑 가족 관계" className="input" placeholder="관계 (예: 장남, 차남)" value={inv.groomOrder ?? ""} onChange={(e) => set("groomOrder", e.target.value)} />
        <div className="text-xs text-soft mt-2">신부 측</div>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="신부 측 아버지 성함" className="input" placeholder="아버지" value={inv.brideParents?.father ?? ""} onChange={(e) => set("brideParents", { ...inv.brideParents, father: e.target.value })} />
          <input aria-label="신부 측 어머니 성함" className="input" placeholder="어머니" value={inv.brideParents?.mother ?? ""} onChange={(e) => set("brideParents", { ...inv.brideParents, mother: e.target.value })} />
        </div>
        <input aria-label="신부 가족 관계" className="input" placeholder="관계 (예: 장녀, 외동딸)" value={inv.brideOrder ?? ""} onChange={(e) => set("brideOrder", e.target.value)} />
      </Section>

      <Section title="배경 음악 (선택)" defaultOpen={false}>
        <p className="text-xs text-soft leading-relaxed">
          외부 음원 URL은 하객 접속 정보를 제3자에게 노출할 수 있어 지원하지 않습니다. 기존 외부 음원도 하객 화면에서 불러오지 않습니다.
        </p>
      </Section>

      <Section title="갤러리" defaultOpen={false}>
        <GalleryUploadButton
          mode={mode}
          onUploaded={(urls) =>
            set("gallery", [...(inv.gallery ?? []), ...urls.map((u) => ({ url: u }))])
          }
        />
        <button onClick={() => setPicker("gallery")} className="btn-secondary w-full text-sm">
          추천 사진에서 추가
        </button>
        <GalleryEditor gallery={inv.gallery ?? []} onChange={(g) => set("gallery", g)} />
      </Section>

      <Section title="연락처 / 마음 전하실 곳" defaultOpen={false}>
        {privacyLimited && (
          <p className="text-[11.5px] text-soft leading-relaxed break-keep border-l-2 border-gold pl-3 py-1">
            {koBreak("공개 범위에서 ‘최소한만’을 골랐어요. 연락처·계좌는 비워 두거나 꼭 필요한 것만 넣어도 됩니다.")}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="신랑 연락처"><input className="input" value={inv.groomPhone ?? ""} onChange={(e) => set("groomPhone", e.target.value)} placeholder="010-..." /></Field>
          <Field label="신부 연락처"><input className="input" value={inv.bridePhone ?? ""} onChange={(e) => set("bridePhone", e.target.value)} placeholder="010-..." /></Field>
        </div>
        <Field label="신랑 계좌"><input className="input" value={inv.groomAccount ?? ""} onChange={(e) => set("groomAccount", e.target.value)} placeholder="OO은행 000-000" /></Field>
        <Field label="신부 계좌"><input className="input" value={inv.brideAccount ?? ""} onChange={(e) => set("brideAccount", e.target.value)} placeholder="OO은행 000-000" /></Field>
      </Section>

      <p className="text-[11px] text-soft text-center leading-relaxed pt-6">
        카톡 문안은 공유 센터에서 복사할 수 있어요.<br />하객용 웹 링크와 RSVP는 위에서 발행합니다.
      </p>

      <Section title="다른 청첩장 서비스도 알아보기" defaultOpen={false}>
        <p className="text-[12.5px] text-soft leading-relaxed">
          여기서 직접 만드는 게 부담이면, 익숙한 청첩장 업체에서 비슷한 결과를 얻을 수 있어요.
          객관적으로 알아보세요.
        </p>
        <div className="pt-2">
          <div className="eyebrow mb-3">종이 청첩장</div>
          <div className="divide-y divide-hair border-t border-b border-hair">
            {PAPER_INVITATIONS.map((p) => (
              <PlatformRow key={p.name} entry={p} />
            ))}
          </div>
        </div>
        <div className="pt-4">
          <div className="eyebrow mb-3">모바일 청첩장</div>
          <div className="divide-y divide-hair border-t border-b border-hair">
            {MOBILE_INVITATIONS.map((p) => (
              <PlatformRow key={p.name} entry={p} />
            ))}
          </div>
        </div>
        <p className="text-[10.5px] text-soft pt-3 leading-relaxed">
          가격·정책은 변동 잦음. 직접 확인 필요. 어느 업체와도 제휴·후원 관계 없습니다.
          표시 삭제·정정 요청은{" "}
          <a href="mailto:yclee913@gmail.com" rel="noopener noreferrer" className="underline">yclee913@gmail.com</a>
          {" "}으로 — 24시간 내 처리.
        </p>
      </Section>
      </>}

      {picker && (
        <PhotoPickerModal
          key={picker}
          mode={picker}
          onClose={() => setPicker(null)}
          onPickHero={(url) => { set("heroImageUrl", url); setPicker(null); }}
          onPickGallery={(urls) => {
            set("gallery", [...(inv.gallery ?? []), ...urls.map((u) => ({ url: u }))]);
            setPicker(null);
          }}
        />
      )}
      <ChatbotBridgeModal
        open={!!bridgePrompt}
        onClose={() => setBridgePrompt(null)}
        prompt={bridgePrompt}
        onApply={(text) => {
          if (typeof text === "string" && text.trim()) set("greeting", text.trim());
        }}
      />
    </div>
  );
}

function PhotoPickerModal({
  mode, onClose, onPickHero, onPickGallery,
}: {
  mode: "hero" | "gallery";
  onClose: () => void;
  onPickHero: (url: string) => void;
  onPickGallery: (urls: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const isHero = mode === "hero";
  const photos = isHero ? STOCK_HERO.map((h) => h.url) : STOCK_GALLERY;

  return (
    <Modal open onClose={onClose} title={isHero ? "대표 사진 고르기" : "갤러리 사진 고르기"}>
      <p className="text-sm text-soft mb-3">
        {isHero
          ? "마음에 드는 사진을 누르면 바로 적용돼요."
          : "여러 장 선택할 수 있어요. 본식 후 내 스냅 사진으로 교체하면 됩니다."}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((url) => {
          const on = selected.includes(url);
          return (
            <button
              key={url}
              onClick={() => {
                if (isHero) onPickHero(url);
                else setSelected((s) => (on ? s.filter((x) => x !== url) : [...s, url]));
              }}
              className={`relative overflow-hidden ${on ? "ring-2 ring-ink" : ""}`}
            >
              <img src={url} alt="" className="w-full aspect-square object-cover" />
              {!isHero && on && (
                <span className="absolute top-1 right-1 bg-ink text-paper rounded-none w-5 h-5 text-xs flex items-center justify-center">✓</span>
              )}
            </button>
          );
        })}
      </div>
      {!isHero && (
        <button
          onClick={() => onPickGallery(selected)}
          className="btn-primary w-full mt-4"
          disabled={selected.length === 0}
        >
          {selected.length > 0 ? `${selected.length}장 추가하기` : "사진을 선택하세요"}
        </button>
      )}
      <p className="text-xs text-soft mt-3 text-center">
        사진 출처: Unsplash · 배포 전 사진별 사용 조건 확인 권장
      </p>
    </Modal>
  );
}

function HeroUploadButton({ onUploaded, mode }: {
  onUploaded: (url: string) => void;
  mode: Mode | null;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setBusy(true);
    setMessage("");
    try {
      // 모드 1: IndexedDB(idb:<id>) — localStorage 5MB 한도 회피.
      // 모드 2: base64 data URL — Supabase JSONB 로 두 기기 동기화.
      // 모드 2 일 때만 dataUrlSize 검사(2단 압축) — 모드 1 은 IDB 라 큰 한도 없음.
      if (mode === "supabase") {
        const compressed = await compressImage(file, { maxWidth: 1400, maxHeight: 1800, quality: 0.85 });
        if (dataUrlSize(compressed) > 1.5 * 1024 * 1024) {
          const smaller = await compressImage(file, { maxWidth: 1000, maxHeight: 1400, quality: 0.78 });
          onUploaded(smaller);
        } else {
          onUploaded(compressed);
        }
      } else {
        const url = await uploadImage(file, { mode, maxWidth: 1400, maxHeight: 1800, quality: 0.85 });
        onUploaded(url);
      }
    } catch (e: any) {
      setMessage(e?.message ?? "사진을 불러올 수 없어요. 파일 형식을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="btn-primary w-full text-sm disabled:opacity-50"
      >
        {busy ? "압축 중…" : "내 사진 업로드"}
      </button>
      {message && <p className="mt-2 text-center text-[12px] leading-relaxed text-gold">{message}</p>}
    </>
  );
}

function GalleryUploadButton({ onUploaded, mode }: {
  onUploaded: (urls: string[]) => void;
  mode: Mode | null;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (files: FileList) => {
    setBusy(true);
    setProgress(0);
    setMessage("");
    const out: string[] = [];
    let totalDataSize = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const url = await uploadImage(f, { mode, maxWidth: 900, maxHeight: 1200, quality: 0.8 });
        out.push(url);
        // base64 (data:) 만 localStorage 한도 영향. idb: 는 IndexedDB 라 별개 한도.
        if (url.startsWith("data:")) totalDataSize += dataUrlSize(url);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      onUploaded(out);
      if (mode === "supabase" && totalDataSize > 3 * 1024 * 1024) {
        setMessage(`사진 ${files.length}장을 추가했어요 (${formatBytes(totalDataSize)}). 동기화가 느려질 수 있어 10장 이내를 권합니다.`);
      }
    } catch (e: any) {
      setMessage(e?.message ?? "일부 사진을 불러올 수 없었어요. 파일 형식을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setBusy(false);
      setProgress(0);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handle(e.target.files);
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="btn-primary w-full text-sm disabled:opacity-50"
      >
        {busy ? `압축 중… ${progress}%` : "여러 장 업로드"}
      </button>
      {message && <p className="mt-2 text-center text-[12px] leading-relaxed text-soft">{message}</p>}
    </>
  );
}

function GalleryEditor({ gallery, onChange }: { gallery: { url: string; caption?: string; }[]; onChange: (g: any[]) => void; }) {
  return (
    <div className="space-y-2">
      {gallery.length > 0 && (
        <div className="space-y-2">
          {gallery.map((g, i) => {
            const u = safeMediaSrc(g.url);
            return (
              <div key={i} className="flex items-center gap-2.5">
                {u ? (
                  <img src={u} alt="" className="w-14 h-14 object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 bg-cream border border-hair flex items-center justify-center text-[10px] text-soft text-center flex-shrink-0 leading-tight">잘못된<br />주소</div>
                )}
                <input
                  aria-label={`${i + 1}번째 사진 설명`}
                  className="input flex-1 text-sm"
                  value={g.caption ?? ""}
                  onChange={(e) => onChange(gallery.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
                  placeholder="사진 설명 (선택)"
                />
                <button
                  onClick={() => onChange(gallery.filter((_, j) => j !== i))}
                  className="flex-shrink-0 text-soft hover:text-gold text-lg px-1"
                  aria-label="삭제"
                >×</button>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-soft leading-relaxed">새 사진은 위의 내 사진 업로드 또는 추천 사진에서 추가할 수 있어요.</p>
    </div>
  );
}

function PlatformRow({ entry }: { entry: { name: string; desc: string; url?: string } }) {
  return (
    <div className="py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[14px] text-ink">{entry.name}</div>
          <div className="text-[11.5px] text-soft mt-0.5 leading-relaxed">{entry.desc}</div>
        </div>
        {safeHref(entry.url) && (
          <a
            href={safeHref(entry.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gold underline underline-offset-4 flex-shrink-0"
          >
            홈피 ↗
          </a>
        )}
      </div>
      <div className="mt-2">
        <VendorActions name={entry.name} />
      </div>
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-hair last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full py-5 flex items-baseline justify-between text-left"
      >
        <h2 className="section-title">{title}</h2>
        <span className="text-[12px] text-soft">{open ? "접기" : "열기"}</span>
      </button>
      {open && <div className="space-y-3 pb-8">{children}</div>}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode; }) {
  const id = useId();
  const control = isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, { id, ...(!children.props["aria-label"] ? { "aria-label": label } : {}) })
    : children;
  return <div><label htmlFor={id} className="label">{label}</label>{control}</div>;
}

/* ════════════ 한국어 문구 ════════════ */

function t(ko: string, locale: Locale): string {
  void locale;
  return ko;
}

function formatDate(d: Date, locale: Locale): string {
  void locale;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatShareDate(inv: InvitationContent): string {
  if (!inv.date) return "";
  const d = parseISODateLocal(inv.date);
  if (!d) return "";
  const dayKo = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${formatDate(d, "ko")} (${dayKo})${inv.time ? ` ${inv.time}` : ""}`;
}

// 카톡 채팅창에 그대로 붙여넣을 청첩장 텍스트
function buildKakaoShareText(inv: InvitationContent): string {
  const lines: string[] = [];
  const validDate = parseISODateLocal(inv.date);
  const dayKo = validDate ? `(${["일","월","화","수","목","금","토"][validDate.getDay()]})` : "";

  lines.push(`💌 ${inv.groomName || "신랑"} ♥ ${inv.brideName || "신부"} 결혼합니다`);
  lines.push("");
  if (validDate) lines.push(`📅 ${formatDate(validDate, "ko")} ${dayKo}${inv.time ? ` ${inv.time}` : ""}`);
  if (inv.venue) {
    lines.push(`📍 ${inv.venue}${inv.venueHall ? ` ${inv.venueHall}` : ""}`);
    if (inv.venueAddress) lines.push(`   ${inv.venueAddress}`);
  }

  if (inv.greeting) {
    lines.push("");
    lines.push("─ 모시는 글 ─");
    lines.push(inv.greeting);
  }

  const groomParents = [inv.groomParents?.father, inv.groomParents?.mother].filter(Boolean).join(" · ");
  const brideParents = [inv.brideParents?.father, inv.brideParents?.mother].filter(Boolean).join(" · ");
  if (groomParents || brideParents) {
    lines.push("");
    lines.push("─ 혼주 ─");
    if (groomParents) lines.push(`${groomParents} 의 ${inv.groomOrder || "아들"} ${inv.groomName}`);
    if (brideParents) lines.push(`${brideParents} 의 ${inv.brideOrder || "딸"} ${inv.brideName}`);
  }

  if (inv.groomPhone || inv.bridePhone) {
    lines.push("");
    lines.push("─ 연락처 ─");
    if (inv.groomPhone) lines.push(`🤵 신랑 ${inv.groomPhone}`);
    if (inv.bridePhone) lines.push(`👰 신부 ${inv.bridePhone}`);
  }

  if (inv.groomAccount || inv.brideAccount) {
    lines.push("");
    lines.push("─ 마음 전하실 곳 ─");
    if (inv.groomAccount) lines.push(`🤵 ${inv.groomAccount}`);
    if (inv.brideAccount) lines.push(`👰 ${inv.brideAccount}`);
  }

  if (inv.venue) {
    lines.push("");
    lines.push(`🗺️ 오시는 길: https://map.kakao.com/link/search/${encodeURIComponent(inv.venue)}`);
  }

  return lines.join("\n");
}
