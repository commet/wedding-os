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
        <div className="eyebrow-gold mb-2">링크와 파일</div>
        <h1 className="h-page">공유 센터</h1>
      </div>

      <p className="text-[15px] text-soft leading-[1.85] border-b border-hair pb-5">
        하객용 청첩장과 함께 편집할 초대 링크는 권한이 다릅니다. 받을 사람에 맞는 메뉴를 골라주세요.
      </p>

      {status !== "idle" && (
        <div className={`border-y border-hair py-3 text-[12px] ${status === "fail" ? "text-ink" : "text-soft"}`}>
          {message}
        </div>
      )}

      <Section
        num="01"
        title="하객에게 보내기"
        desc="하객이 보는 청첩장과 RSVP용 링크입니다. 준비 데이터 전체가 공개되는 링크가 아닙니다."
      >
        <Action
          title="청첩장 발행 화면 열기"
          desc="하객에게 보낼 웹 링크를 발행하거나 최신 내용으로 다시 반영합니다."
          onClick={() => { window.location.href = "/invitation?edit=publish#publish-invitation"; }}
          primary
        />
        <Action
          title="청첩장 텍스트 복사"
          desc="카톡·문자·DM에 바로 붙여넣을 수 있는 문장입니다."
          onClick={() => run("청첩장 텍스트 복사", copyInvite)}
        />
        <details className="px-1 py-2">
          <summary className="min-h-11 cursor-pointer text-[12px] text-soft underline underline-offset-4">다른 형식으로 보내기</summary>
          <div className="border-t border-hair">
            <Action title="청첩장 텍스트 파일" desc="부모님이나 플래너에게 문안 확인을 받을 때 좋습니다." onClick={() => run("청첩장 텍스트 파일", () => downloadInvitationText(data))} />
            <Action title="공유용 이미지 카드" desc="이름·날짜·장소·문구를 담은 PNG 카드를 만듭니다." onClick={() => run("공유용 이미지 카드", () => downloadInvitationImage(data.invitation))} />
            {canNativeShare && <Action title="휴대폰 공유 메뉴 열기" desc="휴대폰의 공유 메뉴로 문구를 보냅니다." onClick={() => run("휴대폰 공유", nativeShare)} />}
          </div>
        </details>
      </Section>

      <Section
        num="02"
        title="함께 관리하기"
        desc={
          data.preferences.mode === "supabase"
            ? "준비 데이터를 같이 수정할 수 있는 편집 링크입니다. 하객용 청첩장 링크와 다릅니다."
            : "배우자와 같이 편집하려면 링크를 만들면 됩니다. 혼자 시작한 데이터는 그대로 이어집니다."
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
            title="함께 편집할 링크 만들기"
            desc="같은 준비판을 두 기기에서 보고 편집할 수 있게 초대 링크를 만듭니다."
            onClick={() => { window.location.href = "/start-hosted"; }}
            primary
          />
        )}
      </Section>

      <details className="border-y border-hair py-2">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-2">
          <span>
            <span className="eyebrow block mb-1">필요할 때</span>
            <span className="font-serif text-lg text-ink">파일로 내보내기와 백업</span>
          </span>
          <span className="text-[12px] text-soft">펼쳐보기</span>
        </summary>
        <div className="space-y-9 pb-5 pt-6">
          <Section num="03" title="한 파일로 정리" desc="전체 준비 내용을 Excel이나 인쇄용 문서로 만듭니다.">
            <Action title="Excel 파일" desc="엑셀, Numbers, 구글시트에서 열 수 있어요." onClick={() => run("공유용 Excel 파일", () => downloadExcelWorkbook(data))} primary />
            <Action title="인쇄용 문서" desc="PDF로 저장하거나 종이로 출력할 때 사용합니다." onClick={() => run("인쇄용 HTML", () => downloadPrintableHtml(data))} />
          </Section>
          <Section num="04" title="항목별 표" desc="필요한 영역만 CSV 파일로 꺼냅니다.">
            <Action title="하객 명단 CSV" desc={`${data.guests?.length ?? 0}명`} onClick={() => run("하객 명단 CSV", () => downloadGuestCsv(data))} />
            <Action title="예산 CSV" desc={`${data.budget?.length ?? 0}개 항목`} onClick={() => run("예산 CSV", () => downloadBudgetCsv(data))} />
            <Action title="체크리스트 CSV" desc={`${data.checklist.reduce((n, s) => n + s.items.length, 0)}개 할 일`} onClick={() => run("체크리스트 CSV", () => downloadChecklistCsv(data))} />
          </Section>
          <Section num="05" title="데이터 백업" desc="다른 기기에서 복원할 수 있는 원본 파일입니다.">
            <Action title="백업 파일 내려받기" desc="사진은 가능한 한 포함하고 연결 키는 제외합니다." onClick={() => run("전체 데이터 백업", backup)} primary />
          </Section>
        </div>
      </details>
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
        <div className={`font-serif text-[16px] text-ink ${primary ? "font-medium" : ""}`}>{title}</div>
        <div className="text-[12px] text-soft leading-relaxed mt-1">{desc}</div>
      </div>
      <span className={primary ? "text-gold" : "text-soft"}>→</span>
    </button>
  );
}
