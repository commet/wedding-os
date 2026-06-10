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
import { getOrCreateOwnerToken } from "../lib/security";

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
  const editorInviteUrl = () => {
    const token = getOrCreateOwnerToken();
    return `${window.location.origin}/dashboard#ownerToken=${encodeURIComponent(token)}`;
  };
  const copyEditorInvite = async () => {
    const url = editorInviteUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("아래 편집 초대 링크를 복사해주세요:", url);
    }
  };
  const nativeShareEditorInvite = async () => {
    const url = editorInviteUrl();
    if (navigator.share) {
      await navigator.share({
        title: "Wedding OS 편집 초대",
        text: "같이 결혼 준비를 편집할 수 있는 링크입니다. 하객에게는 보내지 마세요.",
        url,
      });
      return;
    }
    await navigator.clipboard.writeText(url);
  };
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
        하객에게 보내는 청첩장, 함께 관리할 사람에게 보내는 편집 링크, 내가 보관할 백업을 나눠 둡니다.
        같은 링크처럼 보여도 권한이 다르니 여기서 구분해 주세요.
      </p>

      {status !== "idle" && (
        <div className={`border-y border-hair py-3 text-[12px] ${status === "fail" ? "text-gold" : "text-soft"}`}>
          {message}
        </div>
      )}

      <Section
        num="01"
        title="하객에게 보내기"
        desc="하객이 보는 청첩장과 RSVP용 링크입니다. 준비 데이터 전체가 공개되는 링크가 아닙니다."
      >
        <Action
          title="청첩장 링크 만들기"
          desc="하객에게 보낼 웹 링크를 발행하거나 최신 내용으로 다시 반영합니다."
          onClick={() => { window.location.href = "/invitation"; }}
          primary
        />
        <Action
          title="청첩장 텍스트 복사"
          desc="카톡·문자·DM에 바로 붙여넣을 수 있는 문장입니다."
          onClick={() => run("청첩장 텍스트 복사", copyInvite)}
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
        num="02"
        title="함께 관리하기"
        desc={
          data.preferences.mode === "supabase"
            ? "준비 데이터를 같이 수정할 수 있는 편집 링크입니다. 하객용 청첩장 링크와 다릅니다."
            : "둘이 각자 기기에서 편집하려면 같이 쓰는 저장소가 필요합니다. 혼자 시작한 데이터는 전환 때 그대로 옮깁니다."
        }
      >
        {data.preferences.mode === "supabase" ? (
          <>
            <Action
              title="편집 초대 링크 복사"
              desc="이 링크를 받은 사람은 같은 준비 데이터를 편집할 수 있어요. 하객 채팅방에는 보내지 마세요."
              onClick={() => run("편집 초대 링크", copyEditorInvite)}
              primary
            />
            {canNativeShare && (
              <Action
                title="휴대폰 공유 메뉴로 보내기"
                desc="카톡이나 문자 공유 시트로 편집 초대 링크를 보냅니다."
                onClick={() => run("편집 초대 링크 공유", nativeShareEditorInvite)}
              />
            )}
          </>
        ) : (
          <Action
            title="둘이 같이 쓰기 설정"
            desc="같은 준비판을 두 기기에서 보고 편집할 수 있게 연결합니다."
            onClick={() => { window.location.href = "/setup"; }}
            primary
          />
        )}
      </Section>

      <Section
        num="03"
        title="문서로 정리하기"
        desc="하객·예산·체크리스트·업체 후보를 한 파일로 묶거나, 인쇄용 요약으로 꺼냅니다."
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
        num="04"
        title="표로 내보내기"
        desc="각 영역만 따로 CSV로 빼서 엑셀, 구글시트, 카카오톡 파일 전송에 씁니다."
      >
        <Action title="하객 명단 CSV" desc={`${data.guests?.length ?? 0}명`} onClick={() => run("하객 명단 CSV", () => downloadGuestCsv(data))} />
        <Action title="예산 CSV" desc={`${data.budget?.length ?? 0}개 항목`} onClick={() => run("예산 CSV", () => downloadBudgetCsv(data))} />
        <Action title="체크리스트 CSV" desc={`${data.checklist.reduce((n, s) => n + s.items.length, 0)}개 할 일`} onClick={() => run("체크리스트 CSV", () => downloadChecklistCsv(data))} />
      </Section>

      <Section
        num="05"
        title="내가 보관할 백업"
        desc="다른 기기에서 이어서 쓰거나, 혹시 모를 데이터 손실에 대비하는 원본 파일입니다."
      >
        <Action
          title="전체 데이터 백업"
          desc="사진은 가능한 한 포함하고, 연결 키 같은 민감한 정보는 제외합니다."
          onClick={() => run("전체 데이터 백업", backup)}
          primary
        />
      </Section>
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
