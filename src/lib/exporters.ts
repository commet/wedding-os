import type {
  BudgetItem,
  CheckItem,
  ChecklistSection,
  Guest,
  InvitationContent,
  Ring,
  SdmVendor,
  WeddingData,
  WeddingVenue,
} from "./schema";
import { parseISODateLocal } from "./date";

type Cell = string | number | boolean | null | undefined;
type Row = Record<string, Cell>;

const SIDE_LABEL: Record<string, string> = {
  groom: "신랑 측",
  bride: "신부 측",
  shared: "공통",
};

const SDM_LABEL: Record<string, string> = {
  studio: "스튜디오",
  dress: "드레스",
  makeup: "메이크업",
  snap: "본식 스냅",
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function formatWeddingDate(iso?: string): string {
  const date = parseISODateLocal(iso);
  if (!date) return "";
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}

function fileSafeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTextFile(text: string, filename: string, type = "text/plain;charset=utf-8") {
  downloadBlob(new Blob([text], { type }), filename);
}

function csvEscape(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ].join("\n");
}

function downloadCsv(rows: Row[], filename: string) {
  const csv = rows.length ? rowsToCsv(rows) : "내용\n아직 데이터가 없습니다.";
  // BOM: Excel/Numbers에서 한국어가 깨지지 않도록.
  downloadTextFile(`\uFEFF${csv}`, filename, "text/csv;charset=utf-8");
}

export function downloadGuestCsv(data: WeddingData) {
  downloadCsv(guestRows(data.guests ?? []), `wedding-os-guests-${today()}.csv`);
}

export function downloadBudgetCsv(data: WeddingData) {
  downloadCsv(budgetRows(data.budget ?? []), `wedding-os-budget-${today()}.csv`);
}

export function downloadChecklistCsv(data: WeddingData) {
  downloadCsv(checklistRows(data.checklist), `wedding-os-checklist-${today()}.csv`);
}

export function downloadInvitationText(data: WeddingData) {
  const inv = data.invitation;
  const title = `${inv.groomName || "신랑"} · ${inv.brideName || "신부"} 결혼합니다`;
  const lines = [
    title,
    "",
    [formatWeddingDate(inv.date), inv.time].filter(Boolean).join(" · "),
    [inv.venue, inv.venueHall].filter(Boolean).join(" · "),
    inv.venueAddress,
    "",
    inv.greeting,
    "",
    inv.groomPhone ? `신랑 연락처: ${inv.groomPhone}` : "",
    inv.bridePhone ? `신부 연락처: ${inv.bridePhone}` : "",
    inv.venueMapUrl ? `오시는 길: ${inv.venueMapUrl}` : "",
  ].filter((line) => line !== undefined).join("\n");
  downloadTextFile(lines, `wedding-invitation-text-${today()}.txt`);
}

export async function copyInvitationText(data: WeddingData): Promise<boolean> {
  try {
    const inv = data.invitation;
    const text = [
      `${inv.groomName || "신랑"} · ${inv.brideName || "신부"} 결혼합니다`,
      [formatWeddingDate(inv.date), inv.time].filter(Boolean).join(" · "),
      [inv.venue, inv.venueHall].filter(Boolean).join(" · "),
      inv.venueAddress,
      "",
      inv.greeting,
    ].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadExcelWorkbook(data: WeddingData) {
  const sections = [
    { title: "하객 명단", rows: guestRows(data.guests ?? []) },
    { title: "예산", rows: budgetRows(data.budget ?? []) },
    { title: "체크리스트", rows: checklistRows(data.checklist) },
    { title: "예식장", rows: venueRows(data.venues ?? []) },
    { title: "스드메·스냅", rows: sdmRows(data.sdm) },
    { title: "반지", rows: ringRows(data.rings) },
    { title: "신혼여행", rows: tripRows(data) },
  ];
  const title = `${data.invitation.groomName || "Wedding"}-${data.invitation.brideName || "OS"}`;
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1b1a17; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 28px 0 8px; color: #9c7a3d; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd6c7; padding: 7px 8px; font-size: 12px; vertical-align: top; }
    th { background: #f7f0e4; font-weight: 600; }
    .muted { color: #81766a; font-size: 12px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>Wedding OS 공유 파일</h1>
  <div class="muted">${escapeHtml(title)} · ${today()} 생성 · Excel/Numbers에서 열 수 있는 HTML 워크북입니다.</div>
  ${sections.map(sectionToHtml).join("\n")}
</body>
</html>`;
  downloadTextFile(html, `wedding-os-share-pack-${today()}.xls`, "application/vnd.ms-excel;charset=utf-8");
}

export function downloadPrintableHtml(data: WeddingData) {
  const inv = data.invitation;
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Wedding OS Print Pack</title>
  <style>
    @page { margin: 16mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1b1a17; line-height: 1.55; }
    h1 { font-family: Georgia, serif; font-size: 30px; margin: 0 0 8px; }
    h2 { font-size: 15px; margin: 28px 0 8px; color: #9c7a3d; letter-spacing: .08em; text-transform: uppercase; }
    table { border-collapse: collapse; width: 100%; page-break-inside: avoid; }
    th, td { border-bottom: 1px solid #ddd6c7; padding: 7px 4px; text-align: left; font-size: 12px; vertical-align: top; }
    th { color: #81766a; font-weight: 500; }
    .summary { border-top: 1px solid #ddd6c7; border-bottom: 1px solid #ddd6c7; padding: 14px 0; margin: 18px 0; }
    .muted { color: #81766a; }
  </style>
</head>
<body>
  <h1>${escapeHtml(inv.groomName || "신랑")} · ${escapeHtml(inv.brideName || "신부")}</h1>
  <div class="muted">${escapeHtml([formatWeddingDate(inv.date), inv.time, inv.venue].filter(Boolean).join(" · ") || "Wedding OS")}</div>
  <div class="summary">${escapeHtml(inv.greeting || "").replace(/\n/g, "<br />")}</div>
  ${sectionToHtml({ title: "이번 공유 요약", rows: summaryRows(data) })}
  ${sectionToHtml({ title: "하객 명단", rows: guestRows(data.guests ?? []).slice(0, 200) })}
  ${sectionToHtml({ title: "예산", rows: budgetRows(data.budget ?? []) })}
  ${sectionToHtml({ title: "체크리스트", rows: checklistRows(data.checklist) })}
</body>
</html>`;
  downloadTextFile(html, `wedding-os-print-pack-${today()}.html`, "text/html;charset=utf-8");
}

export async function downloadInvitationImage(inv: InvitationContent) {
  const width = 1080;
  const height = 1350;
  const names = `${inv.groomName || "신랑"} · ${inv.brideName || "신부"}`;
  const date = [formatWeddingDate(inv.date), inv.time].filter(Boolean).join(" · ");
  const venue = [inv.venue, inv.venueHall].filter(Boolean).join(" · ");
  const greeting = wrapLines(inv.greeting || "초대합니다", 18, 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="1080" height="1350" fill="#f8f2e8"/>
  <rect x="72" y="72" width="936" height="1206" fill="#fffdf8" stroke="#d8c6a6" stroke-width="2"/>
  <text x="540" y="190" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#9c7a3d" letter-spacing="8">WEDDING INVITATION</text>
  <text x="540" y="358" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="78" fill="#1b1a17">${escapeXml(names)}</text>
  <line x1="260" y1="430" x2="820" y2="430" stroke="#d8c6a6" stroke-width="2"/>
  <text x="540" y="515" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="34" fill="#403a32">${escapeXml(date || "날짜 미정")}</text>
  <text x="540" y="575" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="30" fill="#81766a">${escapeXml(venue || "장소 미정")}</text>
  ${greeting.map((line, i) => `<text x="540" y="${730 + i * 52}" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="32" fill="#403a32">${escapeXml(line)}</text>`).join("")}
  <text x="540" y="1170" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#9c7a3d">Wedding OS</text>
</svg>`;

  const image = new Image();
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("이미지를 만들 수 없어요"));
    image.src = svgUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없어요");
  ctx.drawImage(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  if (!blob) throw new Error("PNG를 만들 수 없어요");
  downloadBlob(blob, `wedding-invitation-card-${today()}.png`);
}

function sectionToHtml(section: { title: string; rows: Row[] }) {
  if (!section.rows.length) {
    return `<h2>${escapeHtml(section.title)}</h2><p class="muted">아직 데이터가 없습니다.</p>`;
  }
  const headers = Object.keys(section.rows[0]);
  return `<h2>${escapeHtml(section.title)}</h2>
<table>
  <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
  <tbody>
    ${section.rows.map((row) => `<tr>${headers.map((h) => `<td>${escapeHtml(row[h] ?? "")}</td>`).join("")}</tr>`).join("\n")}
  </tbody>
</table>`;
}

function summaryRows(data: WeddingData): Row[] {
  const guests = data.guests ?? [];
  const budget = data.budget ?? [];
  return [
    { 항목: "예식일", 값: [formatWeddingDate(data.invitation.date), data.invitation.time].filter(Boolean).join(" · ") || "미정" },
    { 항목: "예식장", 값: [data.invitation.venue, data.invitation.venueHall].filter(Boolean).join(" · ") || "미정" },
    { 항목: "하객 수", 값: guests.length },
    { 항목: "참석 확정", 값: guests.filter((g) => g.status === "참석").length },
    { 항목: "예산 항목", 값: budget.length },
    { 항목: "예상 비용", 값: budget.reduce((s, b) => s + (b.planned ?? 0), 0) },
    { 항목: "실제 지출", 값: budget.reduce((s, b) => s + (b.actual ?? 0), 0) },
  ];
}

function guestRows(guests: Guest[]): Row[] {
  return guests.map((g) => ({
    이름: g.name,
    구분: SIDE_LABEL[g.side] ?? g.side,
    관계: g.relation,
    묶음: g.group,
    상태: g.status,
    인원: g.partyCount ?? 1,
    식권: g.meal === false ? "미사용" : "사용",
    축의금: g.giftKRW,
    연락처: g.phone,
    이메일: g.email,
    초대일: g.invitedAt,
    메모: g.notes,
  }));
}

function budgetRows(items: BudgetItem[]): Row[] {
  return items.map((b) => ({
    항목: b.category,
    예상비용: b.planned,
    실제지출: b.actual,
    결제완료: b.paid ? "예" : "아니오",
    기준값: b.avgKRW,
    메모: b.notes,
  }));
}

function checklistRows(sections: ChecklistSection[]): Row[] {
  const rows: Row[] = [];
  const walk = (section: ChecklistSection, items: CheckItem[], depth: number) => {
    for (const item of items) {
      rows.push({
        섹션: section.title,
        항목: `${"  ".repeat(depth)}${item.text}`,
        완료: item.done ? "예" : "아니오",
        마감일: item.dueDate,
        우선순위: item.priority,
      });
      if (item.sub?.length) walk(section, item.sub, depth + 1);
    }
  };
  sections.forEach((section) => walk(section, section.items, 0));
  return rows;
}

function venueRows(items: WeddingVenue[]): Row[] {
  return items.map((v) => ({
    이름: v.name,
    지역: v.region,
    상태: v.status,
    홀타입: v.hallType,
    음식: v.foodType,
    최소인원: v.capacityMin,
    최대인원: v.capacityMax,
    수용출처: v.capacitySource,
    식대시작: v.mealPriceMin,
    식대상한: v.mealPriceMax,
    식대출처: v.mealPriceSource,
    답사일: v.visitedAt,
    담당자: v.contact,
    계약금: v.depositKRW,
    잔금: v.balanceKRW,
    잔금일: v.balanceDueAt,
    견적기준: v.contract?.quote,
    결제일정: v.contract?.payment,
    취소환불: v.contract?.cancellation,
    포함항목: v.contract?.included,
    별도비용: v.contract?.extras,
    증빙보관: v.contract?.evidence,
    링크: v.link,
    확인일: v.lastVerified,
    출처: v.source,
    메모: v.notes,
  }));
}

function sdmRows(items: SdmVendor[]): Row[] {
  return items.map((v) => ({
    구분: SDM_LABEL[v.category] ?? v.category,
    이름: v.name,
    지역: v.region,
    가격대: v.priceRange,
    상태: v.status,
    담당자: v.contact,
    계약금: v.depositKRW,
    잔금: v.balanceKRW,
    잔금일: v.balanceDueAt,
    견적기준: v.contract?.quote,
    결제일정: v.contract?.payment,
    취소환불: v.contract?.cancellation,
    포함항목: v.contract?.included,
    별도비용: v.contract?.extras,
    증빙보관: v.contract?.evidence,
    링크: v.link,
    확인일: v.lastVerified,
    출처: v.source,
    메모: v.notes,
  }));
}

function ringRows(items: Ring[]): Row[] {
  return items.map((r) => ({
    브랜드: r.brand,
    모델: r.model,
    소재: r.material,
    가격: r.priceKRW,
    다이아: r.hasDiamond ? "예" : "아니오",
    즐겨찾기: r.starredBy?.join(", "),
    좋아요: r.likedBy?.join(", "),
    확인일: r.lastVerified,
    출처: r.source,
    링크: r.link,
    메모: r.notes,
  }));
}

function tripRows(data: WeddingData): Row[] {
  return [
    ...(data.honeymoon.regions ?? []).map((r) => ({
      구분: "지역",
      이름: r.name,
      위치: "",
      일정: r.schedule,
      예산: r.budgetKRW,
      가격: "",
      메모: r.notes,
    })),
    ...data.flights.map((f) => ({
      구분: "항공",
      이름: [f.airline, f.flightNumber].filter(Boolean).join(" "),
      위치: `${f.from ?? ""} → ${f.to ?? ""}`,
      일정: `${f.departAt ?? ""} / ${f.arriveAt ?? ""}`,
      예산: "",
      가격: f.priceKRW,
      메모: f.notes,
    })),
    ...data.hotels.map((h) => ({
      구분: "숙소",
      이름: h.name,
      위치: h.location,
      일정: "",
      예산: "",
      가격: h.rooms?.[0]?.pricePerNight ?? h.otaPrices?.[0]?.price,
      메모: h.notes,
    })),
  ];
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.replace(/\n+/g, " / ").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = word === "/" ? "" : word;
      if (lines.length >= maxLines) break;
    } else if (word === "/") {
      if (cur) lines.push(cur);
      cur = "";
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

function escapeHtml(value: Cell): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value: Cell): string {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

export function sharePackName(data: WeddingData) {
  const names = [data.invitation.groomName, data.invitation.brideName].filter(Boolean).join("-");
  return fileSafeName(names || "wedding-os");
}
