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

export const config = { runtime: "edge" };

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

export default async function handler(_req: Request) {
  const inv = await loadInvitation();

  const groom = inv?.groomName || "Wedding";
  const bride = inv?.brideName || "OS";
  const dateStr = formatDate(inv?.date);
  const time = inv?.time ?? "";
  const venue = inv?.venue ?? "";
  const heroImage = inv?.heroImageUrl;
  const isHttpImage = !!heroImage && /^https?:\/\//.test(heroImage);

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
      headers: {
        // 1분 캐시 — 너무 길면 청첩장 갱신 반영이 늦고, 너무 짧으면 매번 합성 비용
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
      },
    }
  );
}
