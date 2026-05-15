import { useState, useRef, useEffect } from "react";
import type { WeddingData, InvitationContent } from "../lib/schema";
import Modal from "../components/Modal";
import { STOCK_HERO, STOCK_GALLERY } from "../data/stockPhotos";
import { PAPER_INVITATIONS, MOBILE_INVITATIONS } from "../data/invitationPlatforms";
import VendorActions from "../components/VendorActions";
import { safeMediaSrc, safeHref, safeTel, isOwner } from "../lib/security";
import { insertRsvp, type RsvpInput } from "../lib/storage.supabase";
import { compressImage, dataUrlSize, formatBytes } from "../lib/imageCompress";

type Props = { data: WeddingData; update: (patch: any) => void; };
type Tab = "edit" | "preview";
type Locale = "ko" | "en" | "zh";
type Theme = "cream" | "white" | "sage";

const THEME: Record<Theme, { heroGrad: string; accent: string; chip: string }> = {
  cream: { heroGrad: "from-cream to-taupe/30", accent: "text-gold", chip: "bg-gold" },
  white: { heroGrad: "from-gray-50 to-gray-200", accent: "text-soft", chip: "bg-ink" },
  sage:  { heroGrad: "from-sage/10 to-sage/30", accent: "text-sage", chip: "bg-sage" },
};

export default function Invitation({ data, update }: Props) {
  // 청첩장 페이지는 게스트도 접근. 게스트에겐 편집 탭을 노출하지 않음.
  // (모드 2에서 anon 키만으론 권한 분리가 안 되므로, 최소한의 UI 가드.)
  const guest = data.preferences.mode === "supabase" && !isOwner();
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

  const share = async () => {
    // 모드 2: 실제 청첩장 링크
    if (data.preferences.mode === "supabase") {
      const proceed = confirm(
        "⚠️ 청첩장 공유 전에 꼭 확인해주세요\n\n" +
        "현재 버전은 인증 없이 동작합니다. 링크를 받은 사람은 브라우저 개발자 도구로\n" +
        "데이터를 수정·삭제할 가능성이 있어요.\n\n" +
        "→ 가까운 가족·친한 친구에게만 공유하시고,\n" +
        "단톡방·SNS 공개 게시는 보안 업데이트 이전까지 권장하지 않습니다.\n\n" +
        "복사할까요?"
      );
      if (!proceed) return;
      const url = window.location.origin + "/invitation";
      try {
        await navigator.clipboard.writeText(url);
        alert("청첩장 링크가 복사되었어요.");
      } catch {
        prompt("아래 링크를 복사해주세요:", url);
      }
      return;
    }
    // 모드 1: 카톡 채팅에 그대로 붙여넣을 텍스트 (링크 없이도 즉시 공유 가능)
    const text = buildKakaoShareText(inv);
    try {
      await navigator.clipboard.writeText(text);
      alert("✓ 청첩장 내용이 복사되었어요.\n카톡 채팅에 그대로 붙여넣어 보내세요.");
    } catch {
      prompt("아래 내용을 복사해 카톡에 붙여넣으세요:", text);
    }
  };

  return (
    <div className="pb-6">
      <div className="sticky top-[57px] z-20 bg-cream border-b border-line">
        <div className="px-5 py-3 flex items-center justify-between">
          <h1 className="font-serif text-xl">모바일 청첩장</h1>
          <button onClick={share} className="btn-ghost text-sm">공유</button>
        </div>
        <div className="px-5 pb-3 flex gap-2 items-center">
          <TabBtn active={tab === "preview"} onClick={() => setTab("preview")}>미리보기</TabBtn>
          {!guest && (
            <TabBtn active={tab === "edit"} onClick={() => setTab("edit")}>편집</TabBtn>
          )}
          {tab === "preview" && (inv.enabledLocales?.length ?? 0) > 0 && (
            <div className="ml-auto flex gap-1">
              {(["ko", ...(inv.enabledLocales ?? [])] as Locale[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={`text-xs px-2.5 py-1 rounded-full ${locale === l ? "bg-gold text-white" : "bg-white border border-line text-soft"}`}
                >
                  {l === "ko" ? "한" : l === "en" ? "EN" : "中"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {tab === "edit" && !guest ? (
        <EditForm inv={inv} set={set} />
      ) : (
        <Preview
          inv={inv}
          locale={locale}
          rsvpEnabled={canRsvp}
          onRsvpClick={() => setShowRsvp(true)}
        />
      )}

      {showRsvp && (
        <RsvpModal
          locale={locale}
          supabase={data.preferences.supabase}
          onClose={() => setShowRsvp(false)}
        />
      )}
    </div>
  );
}

function RsvpModal({
  locale, supabase, onClose,
}: {
  locale: Locale;
  supabase?: { url: string; anonKey: string };
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
    } as RsvpInput);
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
          <div className="text-3xl">💌</div>
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
                  className={`flex-1 text-sm py-2 rounded-lg border ${side === s ? "border-gold bg-gold/5 text-gold" : "border-line text-soft"}`}
                >
                  {s === "groom" ? `🤵 ${t("신랑 측", locale)}` : `👰 ${t("신부 측", locale)}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{t("참석 여부", locale)}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAttending(true)}
                className={`flex-1 text-sm py-2 rounded-lg border ${attending === true ? "border-gold bg-gold/5 text-gold" : "border-line text-soft"}`}
              >
                ✓ {t("참석", locale)}
              </button>
              <button
                onClick={() => setAttending(false)}
                className={`flex-1 text-sm py-2 rounded-lg border ${attending === false ? "border-gold bg-gold/5 text-gold" : "border-line text-soft"}`}
              >
                ✗ {t("불참", locale)}
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
      className={`px-4 py-1.5 text-sm rounded-full ${active ? "bg-ink text-white" : "bg-white border border-line text-soft"}`}
    >
      {children}
    </button>
  );
}

/* ════════════ 미리보기 — 실제 청첩장 ════════════ */

function Preview({
  inv, locale, rsvpEnabled, onRsvpClick,
}: {
  inv: InvitationContent;
  locale: Locale;
  rsvpEnabled?: boolean;
  onRsvpClick?: () => void;
}) {
  const theme = THEME[(inv.theme as Theme) ?? "cream"];
  const dateObj = inv.date ? new Date(inv.date) : null;
  const validDate = dateObj && !isNaN(dateObj.getTime()) ? dateObj : null;
  const dday = validDate ? Math.ceil((validDate.getTime() - Date.now()) / 86400000) : null;

  const names = locale === "en"
    ? `${inv.groomEnglishName || inv.groomName || "Groom"} & ${inv.brideEnglishName || inv.brideName || "Bride"}`
    : `${inv.groomName || "신랑"} · ${inv.brideName || "신부"}`;

  return (
    <div className="px-5 py-4">
      <div className="bg-white rounded-3xl overflow-hidden border border-line shadow-sm">
        {/* 1. 히어로 */}
        <div className="relative">
          {safeMediaSrc(inv.heroImageUrl) ? (
            <img src={safeMediaSrc(inv.heroImageUrl)} alt="" className="w-full aspect-[3/4] object-cover" />
          ) : (
            <div className={`w-full aspect-[3/4] bg-gradient-to-b ${theme.heroGrad} flex items-center justify-center text-soft text-sm`}>
              대표 사진을 추가해보세요
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-6 text-white text-center">
            <div className="text-xs tracking-[0.2em] uppercase mb-2 opacity-90">{t("Wedding Invitation", locale)}</div>
            <div className="font-serif text-2xl">{names}</div>
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
                <div className={`font-serif text-3xl ${theme.accent}`}>
                  D+{Math.abs(dday)}
                </div>
                <p className="text-xs text-soft mt-2">
                  {locale === "ko" ? "함께해주셔서 감사합니다 💌" : locale === "en" ? "Thank you for being with us 💌" : "謝謝您的祝福 💌"}
                </p>
              </>
            ) : (
              <>
                <div className="text-soft text-xs mb-1">
                  {locale === "ko" ? "결혼식까지" : locale === "en" ? "Days to go" : "距婚禮"}
                </div>
                <div className={`font-serif text-3xl ${theme.accent}`}>
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
            <MiniCalendar date={validDate} chipClass={theme.chip} />
          </div>
        )}

        {/* 6. 갤러리 */}
        {inv.gallery && inv.gallery.length > 0 && (
          <div className="px-4 py-7 border-b border-line">
            <h3 className={`text-sm ${theme.accent} mb-4 text-center tracking-wide`}>{t("갤러리", locale)}</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {inv.gallery.map((g, i) => {
                const u = safeMediaSrc(g.url);
                return u ? (
                  <img key={i} src={u} alt={g.caption ?? ""} className="w-full aspect-square object-cover rounded-md" />
                ) : null;
              })}
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
                className="text-xs px-3 py-2 rounded-lg bg-cream border border-line"
              >
                카카오맵
              </a>
              <a
                href={`https://map.naver.com/v5/search/${encodeURIComponent(inv.venue)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-2 rounded-lg bg-cream border border-line"
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
                <a href={`tel:${safeTel(inv.groomPhone)}`} className="flex-1 text-center text-sm py-2.5 rounded-lg bg-cream border border-line">
                  🤵 {t("신랑", locale)}
                </a>
              )}
              {safeTel(inv.bridePhone) && (
                <a href={`tel:${safeTel(inv.bridePhone)}`} className="flex-1 text-center text-sm py-2.5 rounded-lg bg-cream border border-line">
                  👰 {t("신부", locale)}
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
            <p className="text-xs text-soft mb-2">🎵 {t("배경 음악", locale)}</p>
            <audio src={safeMediaSrc(inv.bgmUrl)} controls className="w-full" />
          </div>
        )}

        {/* 푸터 */}
        <div className="bg-cream py-6 text-center text-xs text-soft">
          {names}
          {validDate && <div className="mt-1">{formatDate(validDate, locale)}</div>}
        </div>
      </div>

      <button
        onClick={async () => {
          const text = buildKakaoShareText(inv);
          try {
            await navigator.clipboard.writeText(text);
            alert("✓ 청첩장 내용이 복사되었어요.\n카톡 채팅에 그대로 붙여넣어 보내세요.");
          } catch {
            prompt("아래 내용을 복사해 카톡에 붙여넣으세요:", text);
          }
        }}
        className="mt-4 btn-primary w-full py-3.5 shadow-md"
      >
        💬 카톡으로 보낼 텍스트 복사
      </button>
      <p className="text-xs text-center text-soft mt-3 leading-relaxed">
        모드 1에서도 청첩장을 카톡으로 보낼 수 있어요.<br />
        진짜 청첩장 링크(웹사이트)는 [내 사이트 만들기] 모드에서.
      </p>
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
            <div className="bg-cream rounded-lg py-2 px-3">
              <span className="text-soft text-xs">🤵 {inv.groomName}</span>
              <div>{inv.groomAccount}</div>
            </div>
          )}
          {inv.brideAccount && (
            <div className="bg-cream rounded-lg py-2 px-3">
              <span className="text-soft text-xs">👰 {inv.brideName}</span>
              <div>{inv.brideAccount}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniCalendar({ date, chipClass }: { date: Date; chipClass: string; }) {
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
      <div className="text-center font-serif text-lg mb-3">{year}.{String(month + 1).padStart(2, "0")}</div>
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

function EditForm({ inv, set }: { inv: InvitationContent; set: (k: any, v: any) => void; }) {
  const [picker, setPicker] = useState<null | "hero" | "gallery">(null);
  const theme = (inv.theme as Theme) ?? "cream";

  return (
    <div className="px-5 py-4 space-y-4">
      <Section title="대표 사진 & 색감">
        {safeMediaSrc(inv.heroImageUrl) && (
          <img src={safeMediaSrc(inv.heroImageUrl)} alt="" className="w-full aspect-[3/4] object-cover rounded-xl" />
        )}
        <HeroUploadButton
          onUploaded={(dataUrl) => set("heroImageUrl", dataUrl)}
        />
        <button onClick={() => setPicker("hero")} className="btn-secondary w-full text-sm">
          📷 추천 사진에서 고르기
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

        <label className="label mt-2">청첩장 색감</label>
        <div className="flex gap-2">
          {([
            { id: "cream", label: "크림", sw: "bg-gold" },
            { id: "white", label: "화이트", sw: "bg-ink" },
            { id: "sage", label: "세이지", sw: "bg-sage" },
          ] as const).map((th) => (
            <button
              key={th.id}
              onClick={() => set("theme", th.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg border ${theme === th.id ? "border-gold bg-gold/5" : "border-line"}`}
            >
              <span className={`w-3 h-3 rounded-full ${th.sw}`} />
              {th.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="신랑 · 신부">
        <div className="grid grid-cols-2 gap-2">
          <Field label="신랑 이름"><input className="input" value={inv.groomName} onChange={(e) => set("groomName", e.target.value)} placeholder="도현" /></Field>
          <Field label="신부 이름"><input className="input" value={inv.brideName} onChange={(e) => set("brideName", e.target.value)} placeholder="지윤" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="신랑 (영문)"><input className="input" value={inv.groomEnglishName ?? ""} onChange={(e) => set("groomEnglishName", e.target.value)} placeholder="Dohyun" /></Field>
          <Field label="신부 (영문)"><input className="input" value={inv.brideEnglishName ?? ""} onChange={(e) => set("brideEnglishName", e.target.value)} placeholder="Jiyoon" /></Field>
        </div>
      </Section>

      <Section title="예식 일정">
        <Field label="날짜"><input type="date" className="input" value={inv.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="시간"><input className="input" value={inv.time ?? ""} onChange={(e) => set("time", e.target.value)} placeholder="오후 3시" /></Field>
        <Field label="예식장"><input className="input" value={inv.venue} onChange={(e) => set("venue", e.target.value)} placeholder="서울대학교 교수회관" /></Field>
        <Field label="홀/층"><input className="input" value={inv.venueHall ?? ""} onChange={(e) => set("venueHall", e.target.value)} placeholder="3층 그랜드볼룸" /></Field>
        <Field label="주소"><input className="input" value={inv.venueAddress ?? ""} onChange={(e) => set("venueAddress", e.target.value)} placeholder="서울특별시 관악구..." /></Field>
      </Section>

      <Section title="모시는 글">
        <textarea className="input min-h-[140px]" value={inv.greeting} onChange={(e) => set("greeting", e.target.value)} />
      </Section>

      <Section title="혼주">
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

      <Section title="외국 하객 (선택)">
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
              className={`w-full text-sm py-2 rounded-lg border ${on ? "border-gold bg-gold/5 text-gold" : "border-line text-soft"}`}
            >
              {on ? "✓ " : ""}{opt.label}
            </button>
          );
        })}
      </Section>

      <Section title="배경 음악 (선택)">
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

      <Section title="갤러리">
        <GalleryUploadButton
          onUploaded={(urls) =>
            set("gallery", [...(inv.gallery ?? []), ...urls.map((u) => ({ url: u }))])
          }
        />
        <button onClick={() => setPicker("gallery")} className="btn-secondary w-full text-sm">
          📷 추천 사진에서 추가
        </button>
        <GalleryEditor gallery={inv.gallery ?? []} onChange={(g) => set("gallery", g)} />
      </Section>

      <Section title="연락처 / 마음 전하실 곳">
        <div className="grid grid-cols-2 gap-2">
          <Field label="신랑 연락처"><input className="input" value={inv.groomPhone ?? ""} onChange={(e) => set("groomPhone", e.target.value)} placeholder="010-..." /></Field>
          <Field label="신부 연락처"><input className="input" value={inv.bridePhone ?? ""} onChange={(e) => set("bridePhone", e.target.value)} placeholder="010-..." /></Field>
        </div>
        <Field label="신랑 계좌"><input className="input" value={inv.groomAccount ?? ""} onChange={(e) => set("groomAccount", e.target.value)} placeholder="OO은행 000-000" /></Field>
        <Field label="신부 계좌"><input className="input" value={inv.brideAccount ?? ""} onChange={(e) => set("brideAccount", e.target.value)} placeholder="OO은행 000-000" /></Field>
      </Section>

      <p className="text-xs text-soft text-center leading-relaxed">
        모드 1(휴대폰 저장)에서는 미리보기만 가능해요.<br />
        실제로 카톡으로 보내려면 [더보기 → 저장 방식]에서 [내 사이트 만들기]로 전환하세요.
      </p>

      {/* 다른 청첩장 서비스도 알아보기 */}
      <section className="card bg-cream/50 space-y-3">
        <h3 className="font-medium text-sm">📑 다른 청첩장 서비스도 알아보기</h3>
        <p className="text-xs text-soft leading-relaxed">
          여기서 직접 만드는 게 부담이면, 익숙한 청첩장 업체에서 비슷한 결과를 얻을 수 있어요.
          객관적으로 알아보세요.
        </p>
        <div>
          <div className="text-xs text-soft mb-2">🖨️ 종이 청첩장</div>
          <div className="space-y-2">
            {PAPER_INVITATIONS.map((p) => (
              <PlatformRow key={p.name} entry={p} />
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-soft mb-2">📱 모바일 청첩장</div>
          <div className="space-y-2">
            {MOBILE_INVITATIONS.map((p) => (
              <PlatformRow key={p.name} entry={p} />
            ))}
          </div>
        </div>
        <p className="text-[11px] text-soft pt-1 leading-relaxed">
          ⚠️ 가격·정책은 변동 잦음. 직접 확인 필요. 어느 업체와도 제휴·후원 관계 없습니다.
          표시 삭제·정정 요청은{" "}
          <a href="mailto:yclee913@gmail.com" rel="noopener noreferrer" className="underline">yclee913@gmail.com</a>
          {" "}으로 — 24시간 내 처리.
        </p>
      </section>

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
        사진 출처: Unsplash · 자유 이용 가능
      </p>
    </Modal>
  );
}

function HeroUploadButton({ onUploaded }: { onUploaded: (dataUrl: string) => void }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1400, maxHeight: 1800, quality: 0.85 });
      const size = dataUrlSize(compressed);
      if (size > 1.5 * 1024 * 1024) {
        // 1.5MB 넘으면 한 번 더 줄임
        const smaller = await compressImage(file, { maxWidth: 1000, maxHeight: 1400, quality: 0.78 });
        onUploaded(smaller);
      } else {
        onUploaded(compressed);
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
        {busy ? "압축 중…" : "📤 내 사진 업로드"}
      </button>
    </>
  );
}

function GalleryUploadButton({ onUploaded }: { onUploaded: (urls: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  const handle = async (files: FileList) => {
    setBusy(true);
    setProgress(0);
    const out: string[] = [];
    let totalSize = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const compressed = await compressImage(f, { maxWidth: 900, maxHeight: 1200, quality: 0.8 });
        out.push(compressed);
        totalSize += dataUrlSize(compressed);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      onUploaded(out);
      if (totalSize > 3 * 1024 * 1024) {
        alert(
          `사진 ${files.length}장을 추가했어요 (${formatBytes(totalSize)}).\n` +
          `브라우저 저장 한도(약 5MB) 가까워요. 더 추가하지 마세요.\n` +
          `더 많은 사진을 쓰려면 [내 사이트 만들기] 모드 추천.`
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
        {busy ? `압축 중… ${progress}%` : "📤 여러 장 업로드"}
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
    <div className="bg-white rounded-lg p-2.5 border border-line">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{entry.name}</div>
          <div className="text-[11px] text-soft mt-0.5">{entry.desc}</div>
        </div>
        {safeHref(entry.url) && (
          <a
            href={safeHref(entry.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gold border border-gold/30 rounded px-2 py-1 flex-shrink-0"
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

function Section({ title, children }: { title: string; children: React.ReactNode; }) {
  return (
    <section className="card space-y-3">
      <h3 className="font-medium">{title}</h3>
      {children}
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

// 카톡 채팅창에 그대로 붙여넣을 청첩장 텍스트
function buildKakaoShareText(inv: InvitationContent): string {
  const lines: string[] = [];
  const dateObj = inv.date ? new Date(inv.date) : null;
  const validDate = dateObj && !isNaN(dateObj.getTime()) ? dateObj : null;
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
