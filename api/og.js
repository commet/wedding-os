// Dynamic OG image for Dearie invitation links.
// Written without JSX so Vercel can load the Node function as an ES module.

import React from "react";
import { ImageResponse } from "@vercel/og";
import { get as blobGet } from "@vercel/blob";

export const config = { runtime: "nodejs" };

const h = React.createElement;

async function loadKoreanFont(text) {
  if (!text.trim()) return null;
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`;
    const css = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }).then((res) => res.text());
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:opentype|truetype)['"]\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

function isSupabaseHost(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && /^[A-Za-z0-9-]+\.supabase\.(co|in)$/.test(parsed.host);
  } catch {
    return false;
  }
}

async function loadFromBlob(code) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return null;
  try {
    const res = await blobGet(`invite/${code}/meta.json`, { access: "private", token });
    if (!res || res.statusCode !== 200) return null;
    const stored = await new Response(res.stream).json();
    if (stored.expiresAt && new Date(stored.expiresAt).getTime() < Date.now()) return null;
    const og = stored.ogMeta;
    if (!og) return null;
    return {
      groomName: og.groomName,
      brideName: og.brideName,
      date: og.date,
      heroImageUrl: og.heroImageUrl,
    };
  } catch {
    return null;
  }
}

async function loadInvitation() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key || !isSupabaseHost(url)) return null;

  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/get_public_invitation`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_id: "default" }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. (${days[date.getDay()]})`;
}

function getRequestUrl(req) {
  const hostHeader = req.headers?.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || "withdearie.com";
  return new URL(req.url || "/api/og", `https://${host}`);
}

function imageCard(heroImage) {
  if (!heroImage || !/^https?:\/\//.test(heroImage)) return null;
  return h(
    "div",
    {
      style: {
        display: "flex",
        width: 360,
        height: 470,
        marginRight: 64,
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
      },
    },
    h("img", {
      src: heroImage,
      width: 360,
      height: 470,
      style: { objectFit: "cover" },
    })
  );
}

function ogTree({ groom, bride, dateStr, time, venue, heroImage, labelText }) {
  const hasImage = !!heroImage && /^https?:\/\//.test(heroImage);
  return h(
    "div",
    {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #FAF8F5 0%, #F2E9D8 100%)",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      },
    },
    imageCard(heroImage),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: hasImage ? "flex-start" : "center",
          justifyContent: "center",
          flex: 1,
        },
      },
      h(
        "div",
        {
          style: {
            fontSize: 22,
            color: "#B8956A",
            letterSpacing: 8,
            marginBottom: 28,
          },
        },
        labelText
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            fontSize: hasImage ? 64 : 86,
            color: "#3A3A3A",
            fontWeight: 700,
            marginBottom: 18,
            alignItems: "center",
          },
        },
        h("span", null, groom),
        h(
          "span",
          {
            style: {
              color: "#B8956A",
              margin: "0 24px",
              fontSize: hasImage ? 48 : 64,
            },
          },
          "♥"
        ),
        h("span", null, bride)
      ),
      dateStr
        ? h(
            "div",
            { style: { fontSize: 28, color: "#6B6B6B", marginBottom: 6 } },
            `${dateStr}${time ? ` · ${time}` : ""}`
          )
        : null,
      venue ? h("div", { style: { fontSize: 22, color: "#6B6B6B" } }, venue) : null
    )
  );
}

export default async function handler(req) {
  const code = getRequestUrl(req).searchParams.get("code") || "";
  let invitation = null;
  if (/^[a-z0-9]{6,16}$/.test(code)) {
    invitation = await loadFromBlob(code);
  }
  if (!invitation) invitation = await loadInvitation();

  const hasInvitation = !!(
    invitation?.groomName ||
    invitation?.brideName ||
    invitation?.date ||
    invitation?.venue ||
    invitation?.heroImageUrl
  );
  const groom = hasInvitation ? invitation?.groomName || "신랑" : "Dearie";
  const bride = hasInvitation ? invitation?.brideName || "신부" : "결혼 준비";
  const dateStr = formatDate(invitation?.date);
  const time = invitation?.time || "";
  const venue = invitation?.venue || "";
  const heroImage = invitation?.heroImageUrl;
  const labelText = hasInvitation ? "WEDDING INVITATION" : "WITHDEARIE.COM";
  const koreanText = [groom, bride, dateStr, time, venue, labelText, "♥·()"]
    .filter(Boolean)
    .join("");
  const koreanFont = await loadKoreanFont(koreanText);

  return new ImageResponse(
    ogTree({ groom, bride, dateStr, time, venue, heroImage, labelText }),
    {
      width: 1200,
      height: 630,
      fonts: koreanFont
        ? [{ name: "Noto Sans KR", data: koreanFont, weight: 700, style: "normal" }]
        : undefined,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
