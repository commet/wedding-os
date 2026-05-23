// 사용자별 동적 OG 이미지 — Vercel Edge Function.
//
// 흐름:
//   1) 카톡·페이스북 등이 청첩장 URL 로드 → HTML 의 og:image 메타 확인 → /api/og 호출
//   2) 이 함수가 Supabase 에서 청첩장 데이터 가져옴 (모드 2 사용자가 환경변수 등록한 경우)
//   3) 1200×630 PNG 즉석 합성 — 이름 · 날짜 · 장소 · (가능하면) 대표사진
//   4) 카톡 미리보기 카드에 그 이미지가 표시됨
//
// 환경변수:
//   - SUPABASE_URL 또는 VITE_SUPABASE_URL
//   - SUPABASE_ANON_KEY 또는 VITE_SUPABASE_ANON_KEY
//
// 사진:
//   - 청첩장 heroImageUrl 이 http(s) URL → 그대로 합성됨
//   - base64 (data URL) → fetch 불가 → 텍스트 카드만 (사진 자리에 그라데이션)
//   - Supabase 환경변수 없음 → wedding-os 기본 카드

import { ImageResponse } from "@vercel/og";
import { get as blobGet } from "@vercel/blob";

// Edge runtime 에 실제로 노출되는 환경변수만 declare — @types/node 를 끌고 오면
// fs / Buffer 같은 edge 에서 못 쓰는 API 가 타입에 잡혀 오히려 사고 위험.
declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: "edge" };

// Google Fonts 의 `text=` 파라미터를 이용해 *필요한 글리프만* 가져온다.
// Noto Sans KR 전체 TTF 는 수 MB — Edge function 으로는 너무 큼.
// 청첩장 이름·날짜·장소에 들어가는 문자만 가져오면 보통 < 30KB.
async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  if (!text.trim()) return null;
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`;
    const css = await fetch(url, {
      headers: {
        // User-Agent 가 있어야 Google 이 woff2 가 아닌 ttf URL 을 돌려줌 (@vercel/og 는 ttf 만 지원)
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }).then((r) => r.text());
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:opentype|truetype)['"]\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

type Invitation = {
  groomName?: string;
  brideName?: string;
  groomEnglishName?: string;
  brideEnglishName?: string;
  date?: string;
  time?: string;
  venue?: string;
  heroImageUrl?: string;
};

// '간편 발행' 청첩장 — Vercel Blob 의 meta.json 에서 ogMeta 만 읽는다 (이름·날짜).
// 본문은 암호문이라 어차피 읽을 수 없고, 카드에는 어차피 안 들어간다.
async function loadFromBlob(code: string): Promise<Invitation | null> {
  const token =
    (typeof process !== "undefined" && process.env.BLOB_READ_WRITE_TOKEN) || "";
  if (!token) return null;
  try {
    const res = await blobGet(`invite/${code}/meta.json`, { access: "private", token });
    if (!res || res.statusCode !== 200) return null;
    const stored = (await new Response(res.stream).json()) as {
      ogMeta?: { groomName?: string; brideName?: string; date?: string };
      expiresAt?: string;
    };
    if (stored.expiresAt && new Date(stored.expiresAt).getTime() < Date.now()) return null;
    const og = stored.ogMeta;
    if (!og) return null;
    return {
      groomName: og.groomName,
      brideName: og.brideName,
      date: og.date,
    };
  } catch {
    return null;
  }
}

async function loadInvitation(): Promise<Invitation | null> {
  const url =
    (typeof process !== "undefined" && (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) || "";
  const key =
    (typeof process !== "undefined" && (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)) || "";
  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/wedding_data?id=eq.default&select=data`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ data?: { invitation?: Invitation } }>;
    return rows[0]?.data?.invitation ?? null;
  } catch {
    return null;
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${days[d.getDay()]})`;
}

export default async function handler(req: Request) {
  // '간편 발행' 청첩장은 ?code=<code> 로 호출 → 해당 코드의 ogMeta 로 카드 합성.
  // 코드 없거나 못 찾으면 기존 동작(Supabase env 기반 또는 기본 카드).
  const code = new URL(req.url).searchParams.get("code") ?? "";
  let inv: Invitation | null = null;
  if (/^[a-z0-9]{6,16}$/.test(code)) {
    inv = await loadFromBlob(code);
  }
  if (!inv) inv = await loadInvitation();

  const groom = inv?.groomName || "Wedding";
  const bride = inv?.brideName || "OS";
  const dateStr = formatDate(inv?.date);
  const time = inv?.time ?? "";
  const venue = inv?.venue ?? "";
  const heroImage = inv?.heroImageUrl;
  const isHttpImage = !!heroImage && /^https?:\/\//.test(heroImage);

  // 카드에 들어가는 모든 글자를 모아 동적 subset 으로 받는다.
  //   - 한글: 이름/날짜/장소 (요일 한 글자까지)
  //   - 영문: "WEDDING INVITATION" 라벨
  //   - 기호: ♥, 가운뎃점·콜론 등
  // Google Fonts 의 text= 는 정확히 요청한 글리프만 돌려주므로 전부 모아 한 번에 요청.
  const labelText = "WEDDING INVITATION";
  const symbolText = "♥·:.()";
  const koreanText = [groom, bride, dateStr, time, venue, labelText, symbolText]
    .filter(Boolean)
    .join("");
  const koreanFont = await loadKoreanFont(koreanText);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #FAF8F5 0%, #F2E9D8 100%)",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
        }}
      >
        {/* 좌측: 사진 (있을 때) */}
        {isHttpImage && (
          <div
            style={{
              display: "flex",
              width: 360,
              height: 470,
              marginRight: 64,
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
            }}
          >
            <img
              src={heroImage}
              width={360}
              height={470}
              style={{ objectFit: "cover" }}
            />
          </div>
        )}

        {/* 우측: 텍스트 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: isHttpImage ? "flex-start" : "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: "#B8956A",
              letterSpacing: 8,
              marginBottom: 28,
            }}
          >
            WEDDING INVITATION
          </div>
          <div
            style={{
              display: "flex",
              fontSize: isHttpImage ? 64 : 86,
              color: "#3A3A3A",
              fontWeight: 700,
              marginBottom: 18,
              alignItems: "center",
            }}
          >
            <span>{groom}</span>
            <span style={{ color: "#B8956A", margin: "0 24px", fontSize: isHttpImage ? 48 : 64 }}>♥</span>
            <span>{bride}</span>
          </div>
          {dateStr && (
            <div style={{ fontSize: 28, color: "#6B6B6B", marginBottom: 6 }}>
              {dateStr}
              {time ? ` · ${time}` : ""}
            </div>
          )}
          {venue && (
            <div style={{ fontSize: 22, color: "#6B6B6B" }}>{venue}</div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: koreanFont
        ? [{ name: "Noto Sans KR", data: koreanFont, weight: 700, style: "normal" }]
        : undefined,
      headers: {
        // 1분 캐시 — 너무 길면 청첩장 갱신 반영이 늦고, 너무 짧으면 매번 합성 비용
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
      },
    }
  );
}
