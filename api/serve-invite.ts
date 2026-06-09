// /api/serve-invite?code=<code>
//
// /i/<code> 의 HTML 셸을 가져와 코드별 OG 태그(이름·날짜·이미지)를 주입해 돌려준다.
// 카톡·페이스북 등 링크 미리보기 크롤러는 HTML 의 OG 태그만 읽으므로(JS 실행 안 함)
// 개인화된 미리보기가 뜨려면 서버에서 HTML 을 만져야 한다.
//
// ── 안전 원칙 ──
// 무엇이 실패하든(blob 미연결, 코드 없음, 만료, 메타 손상…) 원본 index.html 을 그대로 반환한다.
// SPA 가 자체 에러 상태를 보여주므로 페이지 자체는 절대 깨지지 않는다 — 단지 일반 카드로 보일 뿐.

import { get } from "@vercel/blob";

declare const process: { env: Record<string, string | undefined> };

type OgMeta = { groomName?: string; brideName?: string; date?: string };

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateKo(iso?: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${y}년 ${parseInt(mo, 10)}월 ${parseInt(d, 10)}일`;
}

async function loadOgMeta(code: string): Promise<OgMeta | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  try {
    const res = await get(`invite/${code}/meta.json`, { access: "private", token });
    if (!res || res.statusCode !== 200) return null;
    const stored = (await new Response(res.stream).json()) as {
      ogMeta?: OgMeta;
      expiresAt?: string;
    };
    if (stored.expiresAt && new Date(stored.expiresAt).getTime() < Date.now()) return null;
    return stored.ogMeta ?? null;
  } catch {
    return null;
  }
}

function injectOg(html: string, code: string, og: OgMeta): string {
  const groom = og.groomName?.trim() || "신랑";
  const bride = og.brideName?.trim() || "신부";
  const dateStr = formatDateKo(og.date);
  const title = `${groom} ♥ ${bride} 결혼합니다`;
  const desc = dateStr ? `${dateStr} · 청첩장을 확인해주세요.` : "청첩장을 확인해주세요.";
  const image = `/api/og?code=${encodeURIComponent(code)}`;

  const titleAttr = escapeHtmlAttr(title);
  const descAttr = escapeHtmlAttr(desc);
  const imageAttr = escapeHtmlAttr(image);

  // 정확한 정적 태그만 대체. 패턴이 안 맞으면 해당 항목은 원본 유지 — 안전한 폴백.
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtmlAttr(title)}</title>`)
    .replace(
      /<meta property="og:title" content="[^"]*"/,
      `<meta property="og:title" content="${titleAttr}"`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*"/,
      `<meta property="og:description" content="${descAttr}"`,
    )
    .replace(
      /<meta property="og:image" content="[^"]*"/,
      `<meta property="og:image" content="${imageAttr}"`,
    )
    .replace(
      /<meta name="twitter:title" content="[^"]*"/,
      `<meta name="twitter:title" content="${titleAttr}"`,
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*"/,
      `<meta name="twitter:description" content="${descAttr}"`,
    )
    .replace(
      /<meta name="twitter:image" content="[^"]*"/,
      `<meta name="twitter:image" content="${imageAttr}"`,
    );
}

async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? "";

    // 원본 index.html 가져오기 — 같은 출처 정적 파일.
    let html: string;
    try {
      const indexUrl = new URL("/index.html", req.url).toString();
      const res = await fetch(indexUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("index.html fetch failed");
      html = await res.text();
    } catch {
      // self-fetch 실패는 매우 드물지만 깨지면 안 되므로 짧은 안내로 폴백.
      return new Response(
        "청첩장 페이지를 준비하는 데 실패했어요. 잠시 후 다시 열어주세요.",
        { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    // 코드가 유효하고 메타가 있으면 OG 주입. 아니면 원본 그대로 — 일반 카드로 표시됨.
    let injected = html;
    if (/^[a-z0-9]{6,16}$/.test(code)) {
      const og = await loadOgMeta(code);
      if (og) injected = injectOg(html, code, og);
    }

    return new Response(injected, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // 5분 CDN 캐시 + 1일 SWR — 청첩장은 자주 안 바뀜.
        "cache-control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch {
    // 마지막 안전망 — 어떤 예외든 페이지가 통째로 죽지 않도록.
    return new Response(
      "청첩장 페이지를 준비하는 데 실패했어요. 잠시 후 다시 열어주세요.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
}

export default { fetch: handler };
