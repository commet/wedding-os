import { useState } from "react";
import type { ReactNode } from "react";
import type { WeddingData } from "../lib/schema";
import { exportData } from "../lib/storage";
import {
  copyInvitationText,
  downloadBudgetCsv,
  downloadChecklistCsv,
  downloadExcelWorkbook,
  downloadGuestCsv,
  downloadInvitationImage,
  downloadInvitationText,
  downloadPrintableHtml,
} from "../lib/exporters";

type Props = { data: WeddingData; update: (patch: any) => void };

type ActionStatus = "idle" | "working" | "done" | "fail";

export default function Share({ data, update }: Props) {
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [message, setMessage] = useState("");

  const run = async (label: string, fn: () => void | Promise<void>) => {
    setStatus("working");
    setMessage(`${label} 준비 중…`);
    try {
      await fn();
      setStatus("done");
      setMessage(`${label} 완료`);
      window.setTimeout(() => setStatus("idle"), 2400);
    } catch (e: any) {
      setStatus("fail");
      setMessage(e?.message ?? `${label} 실패`);
    }
  };

  const backup = async () => {
    await exportData(data);
    update((prev: WeddingData) => ({
      ...prev,
      preferences: { ...prev.preferences, lastBackupAt: new Date().toISOString().split("T")[0] },
    }));
  };

  const copyInvite = async () => {
    const ok = await copyInvitationText(data);
    if (!ok) throw new Error("클립보드 복사에 실패했어요");
  };

  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;
  const nativeShare = async () => {
    const inv = data.invitation;
    const text = [
      `${inv.groomName || "신랑"} · ${inv.brideName || "신부"} 결혼합니다`,
      [inv.date, inv.time].filter(Boolean).join(" · "),
      [inv.venue, inv.venueHall].filter(Boolean).join(" · "),
      inv.greeting,
    ].filter(Boolean).join("\n");
    await navigator.share?.({ title: "Wedding OS", text });
  };

  return (
    <div className="page pt-8 pb-10 space-y-9">
      <div>
        <div className="eyebrow-gold mb-2">Share Center</div>
        <h1 className="font-serif text-[2rem] leading-none">공유 센터</h1>
      </div>

      <p className="text-[13px] text-soft leading-relaxed border-b border-hair pb-5">
        기본은 내 기기에 안전하게 저장하고, 필요할 때만 파일이나 텍스트로 꺼내 전달합니다.
        링크 공유와 동시 편집은 [내 사이트] 모드에서만 필요해요.
      </p>

      {status !== "idle" && (
        <div className={`border-y border-hair py-3 text-[12px] ${status === "fail" ? "text-gold" : "text-soft"}`}>
          {message}
        </div>
      )}

      <Section
        num="01"
        title="한 번에 공유"
        desc="하객·예산·체크리스트·업체 후보를 Excel/Numbers에서 열 수 있는 한 파일로 묶습니다."
      >
        <Action
          title="공유용 Excel 파일"
          desc=".xls 형식의 HTML 워크북입니다. 엑셀, Numbers, 구글시트 가져오기로 열 수 있어요."
          onClick={() => run("공유용 Excel 파일", () => downloadExcelWorkbook(data))}
          primary
        />
        <Action
          title="인쇄용 HTML"
          desc="PDF로 저장하거나 가족에게 종이로 보여줄 때 쓰는 요약 문서입니다."
          onClick={() => run("인쇄용 HTML", () => downloadPrintableHtml(data))}
        />
      </Section>

      <Section
        num="02"
        title="청첩장 공유"
        desc="배포 없이도 카톡에 붙여넣거나 이미지 카드로 보낼 수 있게 만듭니다."
      >
        <Action
          title="청첩장 텍스트 복사"
          desc="카톡·문자·DM에 바로 붙여넣을 수 있는 문장입니다."
          onClick={() => run("청첩장 텍스트 복사", copyInvite)}
          primary
        />
        <Action
          title="청첩장 텍스트 파일"
          desc="부모님이나 플래너에게 문안 확인을 받을 때 좋습니다."
          onClick={() => run("청첩장 텍스트 파일", () => downloadInvitationText(data))}
        />
        <Action
          title="공유용 이미지 카드"
          desc="대표 사진 대신 이름·날짜·장소·문구를 담은 PNG 카드를 만듭니다."
          onClick={() => run("공유용 이미지 카드", () => downloadInvitationImage(data.invitation))}
        />
        {canNativeShare && (
          <Action
            title="휴대폰 공유 메뉴 열기"
            desc="iPhone/Android 공유 시트로 텍스트를 보냅니다."
            onClick={() => run("휴대폰 공유", nativeShare)}
          />
        )}
      </Section>

      <Section
        num="03"
        title="표로 내보내기"
        desc="각 영역만 따로 CSV로 빼서 엑셀, 구글시트, 카카오톡 파일 전송에 씁니다."
      >
        <Action title="하객 명단 CSV" desc={`${data.guests?.length ?? 0}명`} onClick={() => run("하객 명단 CSV", () => downloadGuestCsv(data))} />
        <Action title="예산 CSV" desc={`${data.budget?.length ?? 0}개 항목`} onClick={() => run("예산 CSV", () => downloadBudgetCsv(data))} />
        <Action title="체크리스트 CSV" desc={`${data.checklist.reduce((n, s) => n + s.items.length, 0)}개 할 일`} onClick={() => run("체크리스트 CSV", () => downloadChecklistCsv(data))} />
      </Section>

      <Section
        num="04"
        title="전체 백업"
        desc="다른 기기에서 이어서 쓰거나, 혹시 모를 데이터 손실에 대비하는 원본 파일입니다."
      >
        <Action
          title="전체 데이터 백업"
          desc="사진은 가능한 한 포함하고, Supabase 키 같은 연결 정보는 제외합니다."
          onClick={() => run("전체 데이터 백업", backup)}
          primary
        />
      </Section>

      {data.preferences.mode !== "supabase" && (
        <div className="pt-2 border-t border-hair">
          <div className="eyebrow-gold mb-2">Live sharing</div>
          <p className="text-[12.5px] text-soft leading-relaxed mb-4">
            신랑·신부가 동시에 편집하거나 하객 RSVP를 받으려면 클라우드 동기화가 필요합니다.
            제작자 서버가 아니라 본인의 Supabase/Vercel을 연결하는 방식이에요.
          </p>
          <a href="/setup" className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
            내 사이트/커플 동기화 설정하기 →
          </a>
        </div>
      )}
    </div>
  );
}

function Section({
  num,
  title,
  desc,
  children,
}: {
  num: string;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-4">
        <span className="font-serif text-soft text-base tabular-nums">{num}</span>
        <div>
          <h2 className="font-serif text-xl text-ink">{title}</h2>
          <p className="text-[12px] text-soft leading-relaxed mt-1">{desc}</p>
        </div>
      </div>
      <div className="border-y border-hair divide-y divide-hair">{children}</div>
    </section>
  );
}

function Action({
  title,
  desc,
  onClick,
  primary,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button onClick={onClick} className="w-full text-left py-4 flex items-baseline gap-4 active:opacity-70 transition">
      <div className="flex-1 min-w-0">
        <div className={`font-serif text-[16px] ${primary ? "text-ink" : "text-ink/90"}`}>{title}</div>
        <div className="text-[11.5px] text-soft leading-relaxed mt-1">{desc}</div>
      </div>
      <span className={primary ? "text-gold" : "text-soft"}>→</span>
    </button>
  );
}
