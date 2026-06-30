import { useState } from "react";
import type { ReactNode } from "react";
import type { WeddingData } from "../lib/schema";
import ProcessAgentPanel from "../components/ProcessAgentPanel";
import SectionConsultationPanel from "../components/SectionConsultationPanel";
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
import { getHostedConfig, getOrCreateOwnerToken } from "../lib/security";
import { buildRecoveryLink } from "../lib/recovery";
import { daysSince } from "../lib/freshness";
import { koBreak } from "../lib/typography";

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
  const hostedInviteUrl = () => {
    const cfg = getHostedConfig();
    if (!cfg) return "";
    return buildRecoveryLink({
      weddingId: cfg.weddingId,
      ownerToken: getOrCreateOwnerToken(),
      weddingKey: cfg.weddingKey,
    });
  };
  const copyHostedInvite = async () => {
    const url = hostedInviteUrl();
    if (!url) {
      window.location.href = "/start-hosted";
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("아래 편집·복구 링크를 복사해주세요:", url);
    }
  };
  const nativeShareEditorInvite = async () => {
    const url = editorInviteUrl();
    if (navigator.share) {
      await navigator.share({
        title: "Dearie 편집 초대",
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
    await navigator.share?.({ title: "Dearie", text });
  };
  const backupDays = daysSince(data.preferences.lastBackupAt);
  const hasPublished = !!data.publish;
  const hasHostedInvite = data.preferences.mode === "hosted" && !!getHostedConfig();
  const canShareEditor = data.preferences.mode === "supabase" || hasHostedInvite;
  const collaborateReady = data.preferences.mode === "hosted" || data.preferences.mode === "supabase";
  const backupState =
    backupDays === null ? "없음" : backupDays === 0 ? "오늘" : `${backupDays}일 전`;
  const shareAgentSummary = hasPublished
    ? "하객용 링크는 준비되어 있어요. 이제 최신 내용 재발행, 편집 초대, 백업을 분리해서 관리하면 됩니다."
    : "아직 하객용 링크가 없어요. 먼저 청첩장 발행 화면을 열고, 그 다음 편집 링크와 백업을 챙기는 순서가 좋아요.";

  return (
    <div className="page pt-8 pb-10 space-y-9">
      <div>
        <div className="eyebrow-gold mb-2">링크와 파일</div>
        <h1 className="h-page">{koBreak("공유 센터")}</h1>
      </div>

      <SectionConsultationPanel sectionId="share" data={data} update={update} />

      <ProcessAgentPanel
        title={hasPublished ? "공유 채널을 분리해 관리하는 중" : "하객용 링크 발행이 먼저예요"}
        summary={shareAgentSummary}
        mood={hasPublished ? "ready" : "thinking"}
        metrics={[
          { label: "하객 링크", value: hasPublished ? "발행" : "전", tone: hasPublished ? "normal" : "warn" },
          { label: "편집 공유", value: collaborateReady ? "가능" : "로컬", tone: collaborateReady ? "normal" : "muted" },
          { label: "백업", value: backupState, tone: backupDays === null || backupDays > 30 ? "warn" : "normal" },
        ]}
        steps={[
          { label: "하객에게 보낼 청첩장 링크 준비", detail: "하객용 링크는 준비 데이터 전체가 열리지 않는 별도 화면입니다.", done: hasPublished },
          { label: "함께 편집할 사람에게만 편집 권한 전달", detail: "편집 링크는 오너 권한이라 하객 채팅방에 보내면 안 됩니다.", done: collaborateReady },
          { label: "내보내기 전에 최신 백업 확보", detail: "기기 이동이나 실수 삭제에 대비해 JSON 백업을 남깁니다.", done: backupDays !== null && backupDays <= 30 },
        ]}
        actions={[
          {
            label: hasPublished ? "하객 링크 관리 →" : "하객 링크 발행 →",
            onClick: () => { window.location.href = "/invitation?edit=publish#publish-invitation"; },
            tone: "primary",
          },
          { label: "문자용 문안 복사 →", onClick: () => run("청첩장 텍스트 복사", copyInvite) },
          {
            label: canShareEditor ? "편집 링크 복사 →" : "함께 편집 준비 →",
            onClick: () => {
              if (hasHostedInvite) void run("편집·복구 링크", copyHostedInvite);
              else if (data.preferences.mode === "supabase") void run("편집 초대 링크", copyEditorInvite);
              else window.location.href = "/start-hosted";
            },
          },
          { label: "지금 백업 만들기 →", onClick: () => run("전체 데이터 백업", backup) },
        ]}
      />

      <div className="border-b border-hair pb-5 space-y-4">
        <p className="text-[15px] text-soft leading-[1.85]">
          준비한 내용을 밖으로 내보내는 곳이에요. 하객에게 보낼 청첩장 링크, 둘이 함께 편집할 초대 링크,
          그리고 데이터를 안전하게 보관할 백업까지 한자리에 모았습니다. 받을 사람에 맞는 메뉴를 골라주세요.
        </p>
        <ul className="space-y-2 text-[13px] text-soft leading-relaxed">
          <li className="flex gap-2.5">
            <span className="text-gold">·</span>
            <span><span className="text-ink">하객용 청첩장 링크</span> — 손님이 보는 화면. 준비 데이터 전체가 열리지 않습니다.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-gold">·</span>
            <span><span className="text-ink">함께 편집 링크</span> — 배우자와 같은 준비판을 같이 봅니다. 하객에게는 보내지 마세요.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-gold">·</span>
            <span><span className="text-ink">파일과 백업</span> — Excel·인쇄·CSV로 꺼내거나 다른 기기에서 복원할 원본을 받습니다.</span>
          </li>
        </ul>
      </div>

      {status !== "idle" && (
        <div className={`border-y border-hair py-3 text-[12px] ${status === "fail" ? "text-ink" : "text-soft"}`}>
          {message}
        </div>
      )}

      <Section
        num="01"
        title={koBreak("하객에게 보내기")}
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
        title={koBreak("함께 관리하기")}
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
        ) : hasHostedInvite ? (
          <Action
            title="편집·복구 링크 복사"
            desc="배우자와 같이 편집하고, 기기를 바꿔도 이어서 쓸 수 있는 오너 권한 링크입니다."
            onClick={() => run("편집·복구 링크", copyHostedInvite)}
            primary
          />
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
            <span className="font-serif text-lg text-ink">{koBreak("파일로 내보내기와 백업")}</span>
          </span>
          <span className="text-[12px] text-soft">펼쳐보기</span>
        </summary>
        <div className="space-y-9 pb-5 pt-6">
          <Section num="03" title={koBreak("한 파일로 정리")} desc="전체 준비 내용을 Excel이나 인쇄용 문서로 만듭니다.">
            <Action title="Excel 파일" desc="엑셀, Numbers, 구글시트에서 열 수 있어요." onClick={() => run("공유용 Excel 파일", () => downloadExcelWorkbook(data))} primary />
            <Action title="인쇄용 문서" desc="PDF로 저장하거나 종이로 출력할 때 사용합니다." onClick={() => run("인쇄용 HTML", () => downloadPrintableHtml(data))} />
          </Section>
          <Section num="04" title={koBreak("항목별 표")} desc="필요한 영역만 CSV 파일로 꺼냅니다.">
            <Action title="하객 명단 CSV" desc={`${data.guests?.length ?? 0}명`} onClick={() => run("하객 명단 CSV", () => downloadGuestCsv(data))} />
            <Action title="예산 CSV" desc={`${data.budget?.length ?? 0}개 항목`} onClick={() => run("예산 CSV", () => downloadBudgetCsv(data))} />
            <Action title="체크리스트 CSV" desc={`${data.checklist.reduce((n, s) => n + s.items.length, 0)}개 할 일`} onClick={() => run("체크리스트 CSV", () => downloadChecklistCsv(data))} />
          </Section>
          <Section num="05" title={koBreak("데이터 백업")} desc="다른 기기에서 복원할 수 있는 원본 파일입니다.">
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
