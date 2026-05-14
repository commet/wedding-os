// 사용자 입력(여행지·날짜·인원)을 반영한 실제 검색 사이트 딥링크 생성.
// 백엔드 없이도 "검색이 빠르게 되도록" — 입력값을 URL에 채워 바로 결과 페이지로 보낸다.

export type SearchLink = { name: string; url: string; };

function yymmdd(date: string): string {
  // "2026-10-17" → "261017"
  const clean = date.replace(/-/g, "");
  return clean.length >= 8 ? clean.slice(2) : "";
}
function yyyymmdd(date: string): string {
  return date.replace(/-/g, "");
}

/** 항공편 검색 — 출발/도착 공항코드, 날짜, 인원 */
export function flightSearchLinks(
  from: string,
  to: string,
  date: string,
  adults = 2
): SearchLink[] {
  const f = from.trim().toLowerCase();
  const t = to.trim().toLowerCase();
  const F = from.trim().toUpperCase();
  const T = to.trim().toUpperCase();
  const links: SearchLink[] = [];

  if (f && t && date) {
    links.push({
      name: "스카이스캐너",
      url: `https://www.skyscanner.co.kr/transport/flights/${f}/${t}/${yymmdd(date)}/?adultsv2=${adults}`,
    });
    links.push({
      name: "네이버항공권",
      url: `https://flight.naver.com/flights/international/${F}-${T}-${yyyymmdd(date)}?adult=${adults}`,
    });
  }
  if (F && T) {
    links.push({
      name: "구글 항공",
      url: `https://www.google.com/travel/flights?q=${encodeURIComponent(
        `flights from ${F} to ${T}${date ? ` on ${date}` : ""}`
      )}`,
    });
  }
  return links;
}

/** 호텔 검색 — 목적지, 체크인/아웃, 인원 */
export function hotelSearchLinks(
  dest: string,
  checkIn?: string,
  checkOut?: string,
  adults = 2
): SearchLink[] {
  const d = encodeURIComponent(dest.trim());
  if (!dest.trim()) return [];
  const ci = checkIn ? `&checkin=${checkIn}` : "";
  const co = checkOut ? `&checkout=${checkOut}` : "";
  return [
    { name: "호텔스닷컴", url: `https://kr.hotels.com/Hotel-Search?destination=${d}` },
    { name: "아고다", url: `https://www.agoda.com/ko-kr/search?textToSearch=${d}` },
    {
      name: "부킹닷컴",
      url: `https://www.booking.com/searchresults.ko.html?ss=${d}${ci}${co}&group_adults=${adults}`,
    },
    { name: "구글 호텔", url: `https://www.google.com/travel/search?q=${d}%20hotel` },
    { name: "네이버 호텔", url: `https://hotels.naver.com/list?query=${d}` },
  ];
}

/** 신혼여행 검색 — 여행지 기반 (항공·숙소·액티비티 종합) */
export function honeymoonSearchLinks(dest: string): SearchLink[] {
  const d = encodeURIComponent(dest.trim());
  if (!dest.trim()) return [];
  return [
    { name: "마이리얼트립", url: `https://www.myrealtrip.com/search?keyword=${d}` },
    { name: "클룩", url: `https://www.klook.com/ko/search/?query=${d}` },
    { name: "스카이스캐너", url: `https://www.skyscanner.co.kr/transport/flights-from/icn?destination=${d}` },
    { name: "구글 검색", url: `https://www.google.com/search?q=${d}+%EC%8B%A0%ED%98%BC%EC%97%AC%ED%96%89` },
  ];
}
