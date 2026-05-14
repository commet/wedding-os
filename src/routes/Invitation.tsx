import { useState } from "react";
import type { WeddingData, InvitationContent } from "../lib/schema";

type Props = { data: WeddingData; update: (patch: any) => void; };

type Tab = "edit" | "preview";

export default function Invitation({ data, update }: Props) {
  const [tab, setTab] = useState<Tab>("edit");
  const [locale, setLocale] = useState<"ko" | "en" | "zh">("ko");
  const inv = data.invitation;

  const set = <K extends keyof InvitationContent>(key: K, value: InvitationContent[K]) => {
    update((prev: WeddingData) => ({ ...prev, invitation: { ...prev.invitation, [key]: value } }));
  };

  const share = async () => {
    if (data.preferences.mode !== "supabase") {
      alert("청첩장 링크를 공유하려면 [내 사이트 만들기] 모드로 전환해주세요.");
      return;
    }
    const url = window.location.origin + "/invitation/view";
    try {
      await navigator.clipboard.writeText(url);
      alert("청첩장 링크가 복사되었어요.");
    } catch {
      prompt("아래 링크를 복사해주세요:", url);
    }
  };

  return (
    <div className="pb-6">
      <div className="sticky top-[57px] z-20 bg-cream border-b border-line">
        <div className="px-5 py-3 flex items-center justify-between">
          <h1 className="font-serif text-xl">모바일 청첩장</h1>
          <button onClick={share} className="btn-ghost text-sm">공유</button>
        </div>
        <div className="px-5 pb-3 flex gap-2">
          <TabBtn active={tab === "edit"} onClick={() => setTab("edit")}>편집</TabBtn>
          <TabBtn active={tab === "preview"} onClick={() => setTab("preview")}>미리보기</TabBtn>
        </div>
      </div>

      {tab === "edit" ? (
        <EditForm inv={inv} set={set} />
      ) : (
        <Preview inv={inv} locale={locale} setLocale={setLocale} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-sm rounded-full ${
        active ? "bg-gold text-white" : "bg-white border border-line text-soft"
      }`}
    >
      {children}
    </button>
  );
}

function EditForm({ inv, set }: { inv: InvitationContent; set: (k: any, v: any) => void; }) {
  return (
    <div className="px-5 py-4 space-y-4">
      <section className="card space-y-3">
        <h3 className="font-medium">신랑·신부</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">신랑 이름</label>
            <input className="input" value={inv.groomName} onChange={(e) => set("groomName", e.target.value)} placeholder="예: 도현" />
          </div>
          <div>
            <label className="label">신부 이름</label>
            <input className="input" value={inv.brideName} onChange={(e) => set("brideName", e.target.value)} placeholder="예: 지윤" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">신랑 (영문)</label>
            <input className="input" value={inv.groomEnglishName ?? ""} onChange={(e) => set("groomEnglishName", e.target.value)} placeholder="Dohyun" />
          </div>
          <div>
            <label className="label">신부 (영문)</label>
            <input className="input" value={inv.brideEnglishName ?? ""} onChange={(e) => set("brideEnglishName", e.target.value)} placeholder="Jiyoon" />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h3 className="font-medium">예식 일정</h3>
        <div>
          <label className="label">날짜</label>
          <input type="date" className="input" value={inv.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div>
          <label className="label">시간</label>
          <input className="input" value={inv.time ?? ""} onChange={(e) => set("time", e.target.value)} placeholder="오후 3시" />
        </div>
        <div>
          <label className="label">예식 장소</label>
          <input className="input" value={inv.venue} onChange={(e) => set("venue", e.target.value)} placeholder="예: 서울대학교 교수회관" />
        </div>
        <div>
          <label className="label">주소</label>
          <input className="input" value={inv.venueAddress ?? ""} onChange={(e) => set("venueAddress", e.target.value)} placeholder="서울특별시 관악구..." />
        </div>
      </section>

      <section className="card space-y-3">
        <h3 className="font-medium">모시는 글</h3>
        <textarea
          className="input min-h-[120px]"
          value={inv.greeting}
          onChange={(e) => set("greeting", e.target.value)}
        />
      </section>

      <section className="card space-y-3">
        <h3 className="font-medium">혼주</h3>
        <div className="text-xs text-soft mb-2">신랑 측</div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="아버지" value={inv.groomParents?.father ?? ""} onChange={(e) => set("groomParents", { ...inv.groomParents, father: e.target.value })} />
          <input className="input" placeholder="어머니" value={inv.groomParents?.mother ?? ""} onChange={(e) => set("groomParents", { ...inv.groomParents, mother: e.target.value })} />
        </div>
        <div className="text-xs text-soft mb-2 mt-3">신부 측</div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="아버지" value={inv.brideParents?.father ?? ""} onChange={(e) => set("brideParents", { ...inv.brideParents, father: e.target.value })} />
          <input className="input" placeholder="어머니" value={inv.brideParents?.mother ?? ""} onChange={(e) => set("brideParents", { ...inv.brideParents, mother: e.target.value })} />
        </div>
      </section>

      <section className="card space-y-3">
        <h3 className="font-medium">연락처 / 계좌</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">신랑 연락처</label>
            <input className="input" value={inv.groomPhone ?? ""} onChange={(e) => set("groomPhone", e.target.value)} placeholder="010-..." />
          </div>
          <div>
            <label className="label">신부 연락처</label>
            <input className="input" value={inv.bridePhone ?? ""} onChange={(e) => set("bridePhone", e.target.value)} placeholder="010-..." />
          </div>
        </div>
        <div>
          <label className="label">신랑 계좌</label>
          <input className="input" value={inv.groomAccount ?? ""} onChange={(e) => set("groomAccount", e.target.value)} placeholder="OO은행 ..." />
        </div>
        <div>
          <label className="label">신부 계좌</label>
          <input className="input" value={inv.brideAccount ?? ""} onChange={(e) => set("brideAccount", e.target.value)} placeholder="OO은행 ..." />
        </div>
      </section>

      <p className="text-xs text-soft text-center">
        모드 1 (휴대폰 저장)에서는 미리보기만 가능해요.<br />
        실제로 카톡으로 보내려면 [내 사이트 만들기] 모드로 전환하세요.
      </p>
    </div>
  );
}

function Preview({ inv, locale, setLocale }: { inv: InvitationContent; locale: "ko"|"en"|"zh"; setLocale: (l: any) => void; }) {
  const dateStr = inv.date ? formatDate(inv.date, locale) : "";

  return (
    <div className="px-5 py-4">
      <div className="flex justify-center gap-1 mb-4">
        {(["ko","en","zh"] as const).map(l => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={`text-xs px-3 py-1 rounded-full ${locale === l ? "bg-gold text-white" : "bg-white border border-line text-soft"}`}
          >
            {l === "ko" ? "한" : l === "en" ? "EN" : "中"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-line shadow-sm">
        <div className="bg-gradient-to-b from-cream to-white p-8 text-center">
          <div className="text-xs text-soft mb-4 tracking-widest uppercase">{t("Wedding Invitation", locale)}</div>
          <div className="font-serif text-2xl mb-2">
            {locale === "ko" ? `${inv.groomName || "_"} · ${inv.brideName || "_"}` :
             locale === "en" ? `${inv.groomEnglishName || inv.groomName || "_"} & ${inv.brideEnglishName || inv.brideName || "_"}` :
             `${inv.groomName || "_"} · ${inv.brideName || "_"}`}
          </div>
          <div className="text-sm text-soft mt-4">{dateStr}</div>
          {inv.time && <div className="text-sm text-soft">{inv.time}</div>}
          <div className="text-sm text-soft mt-1">{inv.venue || "_"}</div>
        </div>

        <div className="p-6">
          <h3 className="text-center text-sm font-medium mb-3 text-soft">{t("모시는 글", locale)}</h3>
          <p className="text-sm text-center leading-relaxed whitespace-pre-line">{inv.greeting}</p>
        </div>

        {(inv.groomParents?.father || inv.brideParents?.father) && (
          <div className="px-6 py-4 text-center text-sm border-t border-line">
            <div className="text-xs text-soft mb-2">{t("혼주", locale)}</div>
            {inv.groomParents?.father && (
              <div>{inv.groomParents.father}{inv.groomParents.mother && ` · ${inv.groomParents.mother}`} {t("의 아들", locale)} <b>{inv.groomName}</b></div>
            )}
            {inv.brideParents?.father && (
              <div className="mt-1">{inv.brideParents.father}{inv.brideParents.mother && ` · ${inv.brideParents.mother}`} {t("의 딸", locale)} <b>{inv.brideName}</b></div>
            )}
          </div>
        )}

        {inv.venueAddress && (
          <div className="px-6 py-4 border-t border-line text-center text-sm">
            <div className="text-xs text-soft mb-1">📍 {t("오시는 길", locale)}</div>
            <div>{inv.venue}</div>
            <div className="text-soft text-xs mt-1">{inv.venueAddress}</div>
          </div>
        )}

        {(inv.groomAccount || inv.brideAccount) && (
          <div className="px-6 py-4 border-t border-line text-center text-xs text-soft">
            <div className="mb-1">💐 {t("축의 계좌", locale)}</div>
            {inv.groomAccount && <div>{inv.groomName}: {inv.groomAccount}</div>}
            {inv.brideAccount && <div>{inv.brideName}: {inv.brideAccount}</div>}
          </div>
        )}
      </div>

      <p className="text-xs text-center text-soft mt-4">
        ※ 이 미리보기는 실제 청첩장 화면과 가까운 모습이에요. <br />
        실제 공유는 [내 사이트 만들기] 모드에서 가능합니다.
      </p>
    </div>
  );
}

function t(ko: string, locale: "ko"|"en"|"zh"): string {
  const map: Record<string, { en: string; zh: string; }> = {
    "모시는 글": { en: "Invitation", zh: "邀請" },
    "혼주": { en: "Parents", zh: "雙親" },
    "의 아들": { en: "'s son", zh: "之子" },
    "의 딸": { en: "'s daughter", zh: "之女" },
    "오시는 길": { en: "Venue", zh: "地點" },
    "축의 계좌": { en: "Gift Account", zh: "禮金帳號" },
    "Wedding Invitation": { en: "WEDDING INVITATION", zh: "結婚邀請" },
  };
  if (locale === "ko") return ko;
  return map[ko]?.[locale] ?? ko;
}

function formatDate(iso: string, locale: "ko"|"en"|"zh"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  if (locale === "ko") return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
  if (locale === "en") return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}
