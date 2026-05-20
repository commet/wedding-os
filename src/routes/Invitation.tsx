import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { WeddingData, InvitationContent } from "../lib/schema";
import Modal from "../components/Modal";
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

type Props = { data: WeddingData; update: (patch: any) => void; };
type Tab = "edit" | "preview";
type Locale = "ko" | "en" | "zh";
type Theme = "cream" | "white" | "sage" | "rose" | "navy" | "sand" | "slate" | "blush";
type FontStyle = "serif" | "sans" | "handwriting";

const THEME: Record<Theme, { heroGrad: string; accent: string; chip: string; swatch: string; label: string }> = {
  cream: { heroGrad: "from-cream to-taupe/30",         accent: "text-gold",         chip: "bg-gold",         swatch: "bg-gold",         label: "크림" },
  white: { heroGrad: "from-gray-50 to-gray-200",        accent: "text-soft",         chip: "bg-ink",          swatch: "bg-ink",          label: "화이트" },
  sage:  { heroGrad: "from-sage/10 to-sage/30",         accent: "text-sage",         chip: "bg-sage",         swatch: "bg-sage",         label: "세이지" },
  rose:  { heroGrad: "from-rose-50 to-rose-200/60",     accent: "text-rose-600",     chip: "bg-rose-500",     swatch: "bg-rose-400",     label: "로즈" },
  navy:  { heroGrad: "from-slate-100 to-slate-300",     accent: "text-blue-900",     chip: "bg-blue-900",     swatch: "bg-blue-900",     label: "네이비" },
  sand:  { heroGrad: "from-orange-50 to-orange-200/60", accent: "text-orange-700",   chip: "bg-orange-700",   swatch: "bg-orange-400",   label: "샌드" },
  slate: { heroGrad: "from-slate-50 to-slate-200",      accent: "text-slate-700",    chip: "bg-slate-700",    swatch: "bg-slate-500",    label: "슬레이트" },
  blush: { heroGrad: "from-pink-50 to-pink-200/40",     accent: "text-pink-700",     chip: "bg-pink-500",     swatch: "bg-pink-300",     label: "블러시" },
};

const FONT: Record<FontStyle, { class: string; label: string; sample: string }> = {
  serif:       { class: "font-serif", label: "정통 (세리프)", sample: "도현 · 지윤" },
  sans:        { class: "font-sans",  label: "모던 (산세리프)", sample: "도현 · 지윤" },
  handwriting: { class: "font-hand",  label: "손글씨", sample: "도현 · 지윤" },
};

export default function Invitation({ data, update }: Props) {
  const location = useLocation();
  // /i 경로 = 게스트 청첩장 라우트. 받는 사람용으로 헤더·편집·공유 다 숨김.
  const isGuestRoute = location.pathname === "/i";
  // 모드 2 청첩장이지만 오너 표시 없는 기기 — 게스트로 취급
  const guest = isGuestRoute || (data.preferences.mode === "supabase" && !isOwner());
  const canRsvp = data.preferences.mode === "supabase" && !!data.preferences.supabase;
  const [tab, setTab] = useState<Tab>("preview");
  const [locale, setLocale] = useState<Locale>("ko");
  const [showRsvp, setShowRsvp] = useState(false);
  const inv = data.invitation;

  // 활성 언어가 바뀌어 현재 locale 이 더 이상 허용되지 않으면 한국어로 fallback.
  useEffect(() => {
    const allowed: Locale[] = ["ko", ...((inv.enabledLocales ?? []) as Locale[])];
    if (!allowed.includes(locale)) setLocale("ko");
  }, [inv.enabledLocales, locale]);

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

  const markShareCopied = () => {
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 2400);
  };

  const share = async () => {
    const missing = missingInvitationFields();
    if (missing.length > 0) {
      const proceed = confirm(
        `청첩장에 빠진 정보가 있어요:\n\n· ${missing.join("\n· ")}\n\n` +
        `[편집] 탭에서 먼저 채우는 걸 권해요.\n\n그래도 지금 공유할까요?`
      );
      if (!proceed) return;
    }
    // 모드 2: 실제 청첩장 링크 — 게스트 전용 라우트 /i 공유
    if (data.preferences.mode === "supabase") {
      const url = window.location.origin + "/i";
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
    // 모드 1: 카톡 채팅에 붙여넣을 텍스트 — 보내기 전 미리보기 모달로 확인 + 복사.
    setShareText(buildKakaoShareText(inv));
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
          <h1 className="font-serif text-[1.75rem] text-ink leading-tight mb-3">
            아직 준비 중이에요
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
              <div className="eyebrow-gold mb-1">Invitation</div>
              <h1 className="font-serif text-xl text-ink">모바일 청첩장</h1>
            </div>
            <button onClick={share} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold transition">
              {shareCopied ? "복사됨" : "공유 →"}
            </button>
          </div>
          <div className="page pb-3 flex items-center gap-6">
            <TabBtn active={tab === "preview"} onClick={() => setTab("preview")}>미리보기</TabBtn>
            {!guest && (
              <TabBtn active={tab === "edit"} onClick={() => setTab("edit")}>편집</TabBtn>
            )}
            {tab === "preview" && (inv.enabledLocales?.length ?? 0) > 0 && (
              <div className="ml-auto flex gap-3">
                {(["ko", ...(inv.enabledLocales ?? [])] as Locale[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className={`text-[11px] tracking-wide transition ${locale === l ? "text-ink underline underline-offset-4" : "text-soft"}`}
                  >
                    {l === "ko" ? "한" : l === "en" ? "EN" : "中"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 게스트 라우트 — 헤더 대신 부드러운 언어 전환만 (활성 언어 있을 때) */}
      {isGuestRoute && (inv.enabledLocales?.length ?? 0) > 0 && (
        <div className="flex justify-center gap-4 pt-4 pb-2">
          {(["ko", ...(inv.enabledLocales ?? [])] as Locale[]).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={`text-[11px] tracking-wide ${locale === l ? "text-ink underline underline-offset-4" : "text-soft"}`}
            >
              {l === "ko" ? "한" : l === "en" ? "EN" : "中"}
            </button>
          ))}
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
        <EditForm inv={inv} set={set} mode={data.preferences.mode} />
      ) : (
        <Preview
          inv={inv}
          locale={locale}
          rsvpEnabled={canRsvp}
          onRsvpClick={() => setShowRsvp(true)}
          hideShareBox={isGuestRoute}
          onShare={share}
          shareCopied={shareCopied}
        />
      )}

      {showRsvp && (
        <RsvpModal
          locale={locale}
          supabase={data.preferences.supabase}
          onClose={() => setShowRsvp(false)}
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
    </div>
  );
}

function RsvpModal({
  locale, supabase, onClose,
}: {
  locale: Locale;
  supabase?: { url: string; anonKey: string; configId?: string };
  onClose: () => void;
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
    if (!supabase) return setErrMsg("아직 청첩장 셋업이 안 끝났어요");
    setStatus("sending");
    setErrMsg("");
    const r = await insertRsvp(supabase.url, supabase.anonKey, {
      name: name.trim(),
      attending,
      side,
      guests: attending ? guests : 0,
      meal: meal.trim() || undefined,
      message: message.trim() || undefined,
    } as RsvpInput, supabase.configId);
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

          <div>
            <label className="label">{t("성함", locale)}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
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
              className="input min-h-[70px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="두 분의 결혼을 축하합니다…"
            />
          </div>

          {errMsg && <p className="text-red-500 text-sm">{errMsg}</p>}

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

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] tracking-wide pb-2 -mb-2 transition ${
        active ? "text-ink border-b border-ink font-medium" : "text-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ════════════ 미리보기 — 실제 청첩장 ════════════ */

function Preview({
  inv, locale, rsvpEnabled, onRsvpClick, hideShareBox, onShare, shareCopied,
}: {
  inv: InvitationContent;
  locale: Locale;
  rsvpEnabled?: boolean;
  onRsvpClick?: () => void;
  hideShareBox?: boolean;
  onShare?: () => void;
  shareCopied?: boolean;
}) {
  const theme = THEME[(inv.theme as Theme) ?? "cream"];
  const fontClass = FONT[(inv.fontStyle as FontStyle) ?? "serif"].class;
  const validDate = parseISODateLocal(inv.date);
  const dday = daysUntilISODate(inv.date);

  const names = locale === "en"
    ? `${inv.groomEnglishName || inv.groomName || "Groom"} & ${inv.brideEnglishName || inv.brideName || "Bride"}`
    : `${inv.groomName || "신랑"} · ${inv.brideName || "신부"}`;

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
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-6 text-white text-center">
            <div className="text-xs tracking-[0.2em] uppercase mb-2 opacity-90">{t("Wedding Invitation", locale)}</div>
            <div className={`${fontClass} text-2xl`}>{names}</div>
            {validDate && (
              <div className="text-sm mt-2 opacity-90">{formatDate(validDate, locale)}{inv.time && ` · ${inv.time}`}</div>
            )}
          </div>
        </div>

        {/* 2. 카운트다운 (본식 전) 또는 결혼 알림 (본식 후) */}
        {dday !== null && (
          <div className="py-5 text-center border-b border-line">
            {dday < 0 ? (
              <>
                <div className="text-soft text-xs mb-1">
                  {locale === "ko" ? "결혼식이 끝났어요" : locale === "en" ? "Just Married" : "已結婚"}
                </div>
                <div className={`${fontClass} text-3xl ${theme.accent}`}>
                  D+{Math.abs(dday)}
                </div>
                <p className="text-xs text-soft mt-2">
                  {locale === "ko" ? "함께해주셔서 감사합니다" : locale === "en" ? "Thank you for being with us" : "謝謝您的祝福"}
                </p>
              </>
            ) : (
              <>
                <div className="text-soft text-xs mb-1">
                  {locale === "ko" ? "결혼식까지" : locale === "en" ? "Days to go" : "距婚禮"}
                </div>
                <div className={`${fontClass} text-3xl ${theme.accent}`}>
                  {dday > 0 ? `D-${dday}` : "D-DAY"}
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. 모시는 글 */}
        <div className="px-7 py-8 text-center border-b border-line">
          <h3 className={`text-sm ${theme.accent} mb-4 tracking-wide`}>{t("모시는 글", locale)}</h3>
          <p className="text-sm leading-loose whitespace-pre-line text-ink/90">{inv.greeting}</p>
        </div>

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
          <div className="px-7 py-7 border-b border-line">
            <h3 className={`text-sm ${theme.accent} mb-4 text-center tracking-wide`}>{t("예식일", locale)}</h3>
            <MiniCalendar date={validDate} chipClass={theme.chip} fontClass={fontClass} />
          </div>
        )}

        {/* 6. 갤러리 */}
        {inv.gallery && inv.gallery.length > 0 && (
          <div className="px-4 py-7 border-b border-line">
            <h3 className={`text-sm ${theme.accent} mb-4 text-center tracking-wide`}>{t("갤러리", locale)}</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {inv.gallery.map((g, i) => (
                <SafeImg key={i} src={g.url} alt={g.caption ?? ""} className="w-full aspect-square object-cover rounded-md" />
              ))}
            </div>
          </div>
        )}

        {/* 7. 오시는 길 */}
        {inv.venue && (
          <div className="px-7 py-7 border-b border-line text-center">
            <h3 className={`text-sm ${theme.accent} mb-3 tracking-wide`}>{t("오시는 길", locale)}</h3>
            <div className="font-medium">{inv.venue}</div>
            {inv.venueHall && <div className="text-sm text-soft">{inv.venueHall}</div>}
            {inv.venueAddress && <div className="text-xs text-soft mt-1">{inv.venueAddress}</div>}
            <div className="flex gap-2 justify-center mt-4">
              <a
                href={`https://map.kakao.com/link/search/${encodeURIComponent(inv.venue)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-2 bg-cream border border-line"
              >
                카카오맵
              </a>
              <a
                href={`https://map.naver.com/v5/search/${encodeURIComponent(inv.venue)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-2 bg-cream border border-line"
              >
                네이버지도
              </a>
            </div>
          </div>
        )}

        {/* 8. 연락처 */}
        {(inv.groomPhone || inv.bridePhone) && (
          <div className="px-7 py-6 border-b border-line">
            <h3 className={`text-sm ${theme.accent} mb-3 text-center tracking-wide`}>{t("연락하기", locale)}</h3>
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
          <AccountSection inv={inv} locale={locale} accent={theme.accent} />
        )}

        {/* 10. RSVP (본식 전) 또는 감사 인사 (본식 후) */}
        {dday !== null && dday < 0 ? (
          <div className="px-7 py-8 text-center">
            <h3 className={`text-sm ${theme.accent} mb-3 tracking-wide`}>
              {locale === "ko" ? "감사의 인사" : locale === "en" ? "Thank You" : "感謝您"}
            </h3>
            <p className="text-sm leading-relaxed text-ink/90 whitespace-pre-line">
              {locale === "ko"
                ? "축하해주신 모든 분들께\n진심으로 감사드립니다.\n\n앞으로 더 행복하게 살아보겠습니다."
                : locale === "en"
                ? "Thank you to everyone who\ncelebrated with us.\n\nWe'll cherish your blessings."
                : "謝謝所有祝福我們的人。\n\n會幸福地生活下去。"}
            </p>
          </div>
        ) : (
          <div className="px-7 py-7 text-center">
            <h3 className={`text-sm ${theme.accent} mb-2 tracking-wide`}>{t("참석 의사 전달", locale)}</h3>
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
                {t("실제 RSVP는 [내 사이트] 모드에서 작동합니다", locale)}
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
          <p className="text-xs text-center text-soft mt-3 leading-relaxed">
            모드 1에서도 청첩장을 카톡으로 보낼 수 있어요.<br />
            진짜 청첩장 링크(웹사이트)는 [내 사이트 만들기] 모드에서.
          </p>
        </>
      )}
    </div>
  );
}

function AccountSection({ inv, locale, accent }: { inv: InvitationContent; locale: Locale; accent: string; }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-7 py-6 border-b border-line text-center">
      <button onClick={() => setOpen((o) => !o)} className={`text-sm ${accent} tracking-wide`}>
        {t("마음 전하실 곳", locale)} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-sm">
          {inv.groomAccount && (
            <div className="bg-cream py-2 px-3">
              <span className="text-soft text-xs">{t("신랑", locale)} · {inv.groomName}</span>
              <div>{inv.groomAccount}</div>
            </div>
          )}
          {inv.brideAccount && (
            <div className="bg-cream py-2 px-3">
              <span className="text-soft text-xs">{t("신부", locale)} · {inv.brideName}</span>
              <div>{inv.brideAccount}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
          <div key={w} className={`py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-soft"}`}>{w}</div>
        ))}
        {cells.map((c, i) => (
          <div key={i} className="py-1.5">
            {c === day ? (
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${chipClass} text-white font-medium`}>{c}</span>
            ) : (
              <span className={`${i % 7 === 0 ? "text-red-400" : i % 7 === 6 ? "text-blue-400" : "text-ink"}`}>{c}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════ 편집 폼 ════════════ */

function EditForm({ inv, set, mode }: {
  inv: InvitationContent;
  set: (k: any, v: any) => void;
  mode: "local" | "supabase" | "devOnly" | null;
}) {
  const [picker, setPicker] = useState<null | "hero" | "gallery">(null);
  const theme = (inv.theme as Theme) ?? "cream";
  const saveStatus = useSaveStatus();
  const saveLabel =
    saveStatus === "saving" ? "저장 중" :
    saveStatus === "saved" ? "저장됨" :
    saveStatus === "error" ? "저장 실패" :
    mode === "local" ? "이 기기에 자동 저장" : "자동 저장";

  return (
    <div className="page pt-2 pb-6">
      <div className="sticky top-[145px] z-10 -mx-6 px-6 py-2 bg-paper/95 backdrop-blur border-b border-hair">
        <div className={`eyebrow ${saveStatus === "error" ? "text-gold" : saveStatus === "saved" ? "text-sage" : "text-soft"}`}>
          {saveLabel} · 입력하면 바로 반영됩니다
        </div>
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
        <label className="label">또는 사진 주소(URL) 직접 입력</label>
        <input
          className="input text-sm"
          value={inv.heroImageUrl?.startsWith("data:") ? "" : (inv.heroImageUrl ?? "")}
          onChange={(e) => {
            const v = e.target.value;
            // 빈값은 그대로 허용 (지우기), 입력값은 sanitize 후 저장.
            if (!v) { set("heroImageUrl", ""); return; }
            const clean = safeMediaSrc(v);
            set("heroImageUrl", clean ?? v); // 잘못된 값도 일단 표시는 하되, 렌더 단계에서 걸러짐
          }}
          placeholder="https://...jpg (또는 위 [내 사진 업로드])"
        />

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

      <Section title="신랑 · 신부" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Field label="신랑 이름"><input className="input" value={inv.groomName} onChange={(e) => set("groomName", e.target.value)} placeholder="도현" /></Field>
          <Field label="신부 이름"><input className="input" value={inv.brideName} onChange={(e) => set("brideName", e.target.value)} placeholder="지윤" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="신랑 (영문)"><input className="input" value={inv.groomEnglishName ?? ""} onChange={(e) => set("groomEnglishName", e.target.value)} placeholder="Dohyun" /></Field>
          <Field label="신부 (영문)"><input className="input" value={inv.brideEnglishName ?? ""} onChange={(e) => set("brideEnglishName", e.target.value)} placeholder="Jiyoon" /></Field>
        </div>
      </Section>

      <Section title="예식 일정" defaultOpen>
        <Field label="날짜"><input type="date" className="input" value={inv.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="시간"><input className="input" value={inv.time ?? ""} onChange={(e) => set("time", e.target.value)} placeholder="오후 3시" /></Field>
        <Field label="예식장"><input className="input" value={inv.venue} onChange={(e) => set("venue", e.target.value)} placeholder="서울대학교 교수회관" /></Field>
        <Field label="홀/층"><input className="input" value={inv.venueHall ?? ""} onChange={(e) => set("venueHall", e.target.value)} placeholder="3층 그랜드볼룸" /></Field>
        <Field label="주소"><input className="input" value={inv.venueAddress ?? ""} onChange={(e) => set("venueAddress", e.target.value)} placeholder="서울특별시 관악구..." /></Field>
      </Section>

      <Section title="모시는 글" defaultOpen>
        <textarea className="input min-h-[140px]" value={inv.greeting} onChange={(e) => set("greeting", e.target.value)} />
      </Section>

      <Section title="혼주" defaultOpen={false}>
        <div className="text-xs text-soft">신랑 측</div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="아버지" value={inv.groomParents?.father ?? ""} onChange={(e) => set("groomParents", { ...inv.groomParents, father: e.target.value })} />
          <input className="input" placeholder="어머니" value={inv.groomParents?.mother ?? ""} onChange={(e) => set("groomParents", { ...inv.groomParents, mother: e.target.value })} />
        </div>
        <input className="input" placeholder="관계 (예: 장남, 차남)" value={inv.groomOrder ?? ""} onChange={(e) => set("groomOrder", e.target.value)} />
        <div className="text-xs text-soft mt-2">신부 측</div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="아버지" value={inv.brideParents?.father ?? ""} onChange={(e) => set("brideParents", { ...inv.brideParents, father: e.target.value })} />
          <input className="input" placeholder="어머니" value={inv.brideParents?.mother ?? ""} onChange={(e) => set("brideParents", { ...inv.brideParents, mother: e.target.value })} />
        </div>
        <input className="input" placeholder="관계 (예: 장녀, 외동딸)" value={inv.brideOrder ?? ""} onChange={(e) => set("brideOrder", e.target.value)} />
      </Section>

      <Section title="외국 하객 (선택)" defaultOpen={false}>
        <p className="text-xs text-soft leading-relaxed">
          외국에 사는 가족·친구가 있으면 영문·중문을 추가로 켤 수 있어요.
          체크하면 미리보기 상단에 언어 전환 버튼이 보입니다.
        </p>
        {([
          { id: "en" as const, label: "🇺🇸 영문 추가" },
          { id: "zh" as const, label: "🇨🇳 중문(번체) 추가" },
        ]).map((opt) => {
          const on = (inv.enabledLocales ?? []).includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => {
                const cur = inv.enabledLocales ?? [];
                set("enabledLocales", on ? cur.filter((x) => x !== opt.id) : [...cur, opt.id]);
              }}
              className={`w-full text-sm py-2 border ${on ? "border-gold bg-gold/5 text-gold" : "border-line text-soft"}`}
            >
              {on ? "✓ " : ""}{opt.label}
            </button>
          );
        })}
      </Section>

      <Section title="배경 음악 (선택)" defaultOpen={false}>
        <label className="label">음원 주소 (mp3 URL)</label>
        <input
          className="input text-sm"
          value={inv.bgmUrl ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) { set("bgmUrl", undefined); return; }
            const clean = safeMediaSrc(v);
            set("bgmUrl", clean ?? v);
          }}
          placeholder="https://...mp3"
        />
        <p className="text-xs text-soft leading-relaxed">
          저작권 무료 음원은 <a href="https://pixabay.com/music/" target="_blank" rel="noopener noreferrer" className="underline">Pixabay Music</a>·{" "}
          <a href="https://incompetech.com/" target="_blank" rel="noopener noreferrer" className="underline">Incompetech</a>{" "}에서 받을 수 있어요.
          파일 URL을 그대로 붙여넣으세요.
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
        <div className="grid grid-cols-2 gap-2">
          <Field label="신랑 연락처"><input className="input" value={inv.groomPhone ?? ""} onChange={(e) => set("groomPhone", e.target.value)} placeholder="010-..." /></Field>
          <Field label="신부 연락처"><input className="input" value={inv.bridePhone ?? ""} onChange={(e) => set("bridePhone", e.target.value)} placeholder="010-..." /></Field>
        </div>
        <Field label="신랑 계좌"><input className="input" value={inv.groomAccount ?? ""} onChange={(e) => set("groomAccount", e.target.value)} placeholder="OO은행 000-000" /></Field>
        <Field label="신부 계좌"><input className="input" value={inv.brideAccount ?? ""} onChange={(e) => set("brideAccount", e.target.value)} placeholder="OO은행 000-000" /></Field>
      </Section>

      <p className="text-[11px] text-soft text-center leading-relaxed pt-6">
        휴대폰 저장 모드는 카톡에 붙여넣을 초대 문구를 만들 수 있어요.<br />
        하객이 여는 청첩장 링크와 RSVP가 필요하면 [청첩장 링크 만들기]로 전환하세요.
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
              className={`relative rounded-lg overflow-hidden ${on ? "ring-2 ring-gold" : ""}`}
            >
              <img src={url} alt="" className="w-full aspect-square object-cover" />
              {!isHero && on && (
                <span className="absolute top-1 right-1 bg-gold text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✓</span>
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
  mode: "local" | "supabase" | "devOnly" | null;
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setBusy(true);
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
      alert("사진을 불러올 수 없어요: " + (e?.message ?? "알 수 없는 오류"));
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
    </>
  );
}

function GalleryUploadButton({ onUploaded, mode }: {
  onUploaded: (urls: string[]) => void;
  mode: "local" | "supabase" | "devOnly" | null;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (files: FileList) => {
    setBusy(true);
    setProgress(0);
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
        alert(
          `사진 ${files.length}장을 추가했어요 (${formatBytes(totalDataSize)}).\n` +
          `Supabase row 크기가 커지면 동기화가 느려져요. 사진은 10장 이내 권장.`
        );
      }
    } catch (e: any) {
      alert("일부 사진을 불러올 수 없었어요: " + (e?.message ?? "알 수 없는 오류"));
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
    </>
  );
}

function GalleryEditor({ gallery, onChange }: { gallery: { url: string; caption?: string; }[]; onChange: (g: any[]) => void; }) {
  const [url, setUrl] = useState("");
  return (
    <div className="space-y-2">
      {gallery.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {gallery.map((g, i) => {
            const u = safeMediaSrc(g.url);
            return (
              <div key={i} className="relative">
                {u ? (
                  <img src={u} alt="" className="w-full aspect-square object-cover rounded-md" />
                ) : (
                  <div className="w-full aspect-square rounded-md bg-cream border border-red-200 flex items-center justify-center text-[10px] text-red-500 text-center px-1">
                    잘못된<br />사진 주소
                  </div>
                )}
                <button
                  onClick={() => onChange(gallery.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs"
                >×</button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input className="input flex-1 text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="사진 주소(URL) 붙여넣기 (https://…)" />
        <button
          className="btn-secondary text-sm"
          onClick={() => {
            const clean = safeMediaSrc(url);
            if (!clean) { alert("https:// 로 시작하는 사진 주소만 추가할 수 있어요."); return; }
            onChange([...gallery, { url: clean }]);
            setUrl("");
          }}
        >추가</button>
      </div>
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
        <h3 className="eyebrow-gold">{title}</h3>
        <span className="text-[12px] text-soft">{open ? "접기" : "열기"}</span>
      </button>
      {open && <div className="space-y-3 pb-8">{children}</div>}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode; }) {
  return <div><label className="label">{label}</label>{children}</div>;
}

/* ════════════ i18n ════════════ */

function t(ko: string, locale: Locale): string {
  if (locale === "ko") return ko;
  const map: Record<string, { en: string; zh: string; }> = {
    "Wedding Invitation": { en: "WEDDING INVITATION", zh: "結婚請帖" },
    "모시는 글": { en: "Invitation", zh: "邀請函" },
    "예식일": { en: "The Day", zh: "婚禮日期" },
    "갤러리": { en: "Gallery", zh: "相冊" },
    "오시는 길": { en: "Location", zh: "交通指引" },
    "연락하기": { en: "Contact", zh: "聯絡方式" },
    "마음 전하실 곳": { en: "Gift Account", zh: "禮金帳號" },
    "참석 의사 전달": { en: "RSVP", zh: "出席回覆" },
    "참석 여부 전하기": { en: "Send RSVP", zh: "回覆出席" },
    "축하의 마음으로 참석해 주시는 분들을 위해": { en: "Please let us know if you can join us", zh: "請告知是否能出席" },
    "실제 RSVP는 [내 사이트] 모드에서 작동합니다": { en: "RSVP works in [My Site] mode", zh: "RSVP 功能於「我的網站」模式啟用" },
    "신랑": { en: "Groom", zh: "新郎" },
    "신부": { en: "Bride", zh: "新娘" },
    "아들": { en: "son", zh: "之子" },
    "딸": { en: "daughter", zh: "之女" },
    "결혼했습니다": { en: "Just Married", zh: "已結婚" },
    "배경 음악": { en: "Background Music", zh: "背景音樂" },
    // ── RSVP 모달 ──
    "성함": { en: "Name", zh: "姓名" },
    "어느 쪽": { en: "Side", zh: "誰的賓客" },
    "신랑 측": { en: "Groom's side", zh: "新郎方" },
    "신부 측": { en: "Bride's side", zh: "新娘方" },
    "참석 여부": { en: "Attending?", zh: "是否出席" },
    "참석": { en: "Yes", zh: "出席" },
    "불참": { en: "No", zh: "缺席" },
    "참석 인원 (본인 포함)": { en: "Guests (incl. you)", zh: "人數 (含本人)" },
    "식사 메모 (선택)": { en: "Meal note (optional)", zh: "用餐備註 (選填)" },
    "예: 아동 1명, 채식, 알레르기": { en: "e.g. 1 child, vegetarian, allergy", zh: "例：兒童1位、素食、過敏" },
    "축하 메시지 (선택)": { en: "Message (optional)", zh: "祝福訊息 (選填)" },
    "전송 중…": { en: "Sending…", zh: "發送中…" },
    "참석 의사 전하기": { en: "Send RSVP", zh: "送出回覆" },
    "전송됐어요. 감사합니다.": { en: "Sent. Thank you.", zh: "已送出。謝謝。" },
  };
  return map[ko]?.[locale] ?? ko;
}

function formatDate(d: Date, locale: Locale): string {
  if (locale === "ko") return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  if (locale === "en") return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
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
