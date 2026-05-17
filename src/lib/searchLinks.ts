// 사용자 입력(여행지·날짜·인원)을 반영한 실제 검색 사이트 딥링크 생성.
// 백엔드 없이도 "검색이 빠르게 되도록" — 입력값을 URL에 채워 바로 결과 페이지로 보낸다.

export type SearchLink = { name: string; url: string; note?: string; };

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
      name: "스카이스캐너 검색",
      url: `https://www.skyscanner.co.kr/transport/flights/`,
      note: "스카이스캐너 딥링크는 자주 깨져서 검색 페이지로 엽니다. 출발·도착·날짜를 다시 확인하세요.",
    });
    links.push({
      name: "네이버항공권",
      url: `https://flight.naver.com/flights/international/${F}-${T}-${yyyymmdd(date)}?adult=${adults}`,
      note: "네이버가 URL 형식을 바꾸면 조건이 일부 초기화될 수 있습니다.",
    });
  }
  if (F && T) {
    links.push({
      name: "구글 항공",
      url: `https://www.google.com/travel/flights?q=${encodeURIComponent(
        `flights from ${F} to ${T}${date ? ` on ${date}` : ""}`
      )}`,
      note: "구글 항공 검색어로 열고, 최종 날짜·인원은 사이트에서 다시 확인하세요.",
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
    {
      name: "마이리얼트립 상품",
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:myrealtrip.com ${dest.trim()} 신혼여행 투어 숙소`)}`,
      note: "사이트 내부 검색 URL이 자주 바뀌어 구글 site 검색으로 엽니다.",
    },
    {
      name: "클룩 액티비티",
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:klook.com/ko ${dest.trim()} 액티비티 교통패스`)}`,
      note: "클룩 내부 검색이 목적지를 잘못 잡는 경우가 있어 site 검색으로 엽니다.",
    },
    {
      name: "구글 여행 검색",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${dest.trim()} 신혼여행 일정 예산 호텔 항공`)}`,
      note: "기간·예산은 자동 필터링되지 않습니다.",
    },
  ];
}
