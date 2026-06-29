// 식순·체크리스트를 사람이 읽는 텍스트로 만들어 공유/저장한다.
// 외부 서버를 거치지 않는다 — Blob + 다운로드, 또는 navigator.share(기기 공유 시트).
// 운영자 인프라로 데이터가 새지 않는다(설계 원칙 1).

import type { WeddingData } from "./schema";
import { parseISODateLocal } from "./date";

const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// "2026.11.07 토" — 요일은 로컬 타임존 기준
function fmtDate(iso?: string): string {
  const d = parseISODateLocal(iso);
  if (!d) return "";
  const ymd = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd} ${KO_WEEKDAYS[d.getDay()]}`;
}

function coupleLine(data: WeddingData): string {
  const inv = data.invitation;
  return [inv.groomName?.trim(), inv.brideName?.trim()].filter(Boolean).join(" · ");
}

function venueLine(data: WeddingData): string {
  const inv = data.invitation;
  return [inv.venue?.trim(), inv.venueHall?.trim()].filter(Boolean).join(" ");
}

/** 식순 큐시트 — 당일 사회자·주례에게 그대로 넘길 수 있는 진행표. */
export function buildCeremonySheet(data: WeddingData): string {
  const steps = data.ceremony ?? [];
  const inv = data.invitation;
  const couple = coupleLine(data);

  const head: string[] = [];
  head.push(`식순${couple ? ` — ${couple}` : ""}`);
  const ctx = [fmtDate(inv.date), inv.time?.trim(), venueLine(data)].filter(Boolean);
  if (ctx.length) head.push(ctx.join(" · "));

  const body = steps.map((s, i) => {
    const num = String(i + 1).padStart(2, "0");
    const title = s.title?.trim() || "(제목 없음)";
    const lead = [num, s.time?.trim(), title].filter(Boolean).join("  ");
    const meta = [
      s.role?.trim() ? `담당: ${s.role.trim()}` : "",
      s.music?.trim() ? `음악: ${s.music.trim()}` : "",
    ].filter(Boolean).join(" · ");
    const lines = [`${s.done ? "✓ " : ""}${lead}`];
    if (meta) lines.push(`     ${meta}`);
    if (s.notes?.trim()) lines.push(`     메모: ${s.notes.trim()}`);
    return lines.join("\n");
  });

  return [head.join("\n"), "", body.join("\n\n"), "", "— Dearie"].join("\n");
}

/** 체크리스트 — 섹션별로 묶어, 남은 일과 마감일을 한눈에. */
export function buildChecklistSheet(data: WeddingData): string {
  const sections = data.checklist ?? [];
  const couple = coupleLine(data);
  const all = sections.flatMap((s) => s.items);
  const done = all.filter((i) => i.done).length;

  const head = `체크리스트${couple ? ` — ${couple}` : ""}  (${done}/${all.length} 완료)`;

  const blocks = sections
    .filter((s) => s.items.length > 0)
    .map((s) => {
      const rows = s.items.map((i) => {
        const box = i.done ? "[x]" : "[ ]";
        const due = i.dueDate ? `  (~${fmtDate(i.dueDate)})` : "";
        return `  ${box} ${i.text}${due}`;
      });
      return [`■ ${s.title}`, ...rows].join("\n");
    });

  return [head, "", blocks.join("\n\n"), "", "— Dearie"].join("\n");
}

// 텍스트를 .txt 파일로 내려받기 — Blob + 임시 <a download>.
function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 일부 브라우저는 즉시 revoke 하면 다운로드가 취소됨 — 한 박자 뒤 해제
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ShareResult = "shared" | "downloaded" | "copied";

/**
 * 공유 우선, 안 되면 파일 저장 + 클립보드 복사.
 * 모바일에선 기기 공유 시트(카톡 등)로 바로 넘기고, 데스크톱에선 .txt 로 떨어진다.
 * 어떤 경로로 처리됐는지 돌려줘 호출부에서 토스트 문구를 정한다.
 */
export async function shareOrDownloadText(opts: {
  title: string;
  text: string;
  filename: string;
}): Promise<ShareResult> {
  const { title, text, filename } = opts;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;

  if (nav && typeof nav.share === "function") {
    try {
      await nav.share({ title, text });
      return "shared";
    } catch (e) {
      // 사용자가 공유를 취소한 경우(AbortError) 강제 다운로드하지 않는다.
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
      // 그 밖의 실패는 아래 폴백으로.
    }
  }

  downloadText(filename, text);
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    /* 클립보드 차단 — 다운로드만으로 충분 */
  }
  return "downloaded";
}
