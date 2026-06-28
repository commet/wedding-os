// 예식장(웨딩홀) 카탈로그.
//
// ⚠️ 매우 중요한 알림:
//   - 가격(식대) 범위는 시즌·요일·메뉴·보증인원에 따라 크게 달라집니다. 여기 값은 상담 전 감을 잡는 추정치.
//   - 운영 정책·홀 구성·하객 수용은 자주 바뀌므로 최종 결정 전 직접 문의·답사 필수.
//   - 어느 식장과도 제휴·후원 관계 없음 — 한국에서 공개적으로 잘 알려진 곳만 정리.
//   - 표시 삭제·정정 요청은 yclee913@gmail.com 으로 24시간 내 처리.

import type { WeddingVenue, VenueHallType, VenueFoodType } from "../lib/schema";

export const HALL_TYPE_LABEL: Record<VenueHallType, string> = {
  hotel: "호텔",
  house: "하우스 / 채플",
  convention: "컨벤션 / 홀",
  general: "일반 결혼식장",
  outdoor: "야외 / 이색",
};

export const FOOD_TYPE_LABEL: Record<VenueFoodType, string> = {
  buffet: "뷔페",
  course: "코스 (양식·한정식)",
  plated: "단품 한식",
};

export type VenueGuide = {
  type: VenueHallType;
  pros: string[];
  cons: string[];
  tip: string;
};

export const VENUE_GUIDES: VenueGuide[] = [
  {
    type: "hotel",
    pros: ["격조 있는 분위기", "음식 퀄리티 안정적", "주차·편의 시설 우수"],
    cons: ["식대 7~20만원으로 가장 높음", "보증인원 200명 이상 많음", "단독홀이 적어 입장 동선 겹칠 수 있음"],
    tip: "총 비용의 절반 이상이 식대 × 인원수에서 나옵니다. 보증인원과 실제 예상 하객 수가 일치하는지 먼저 계산해보세요.",
  },
  {
    type: "house",
    pros: ["단독 사용 — 우리만의 공간", "사진이 잘 나옴", "스몰웨딩 친화"],
    cons: ["하객 수용 한정 (100~200명)", "주차 협소한 곳 많음", "식대가 호텔 수준이거나 더 높을 수 있음"],
    tip: "감성 있는 사진을 원하면 1순위. 단, 하객 100명 이상이면 동선·테이블 배치 미리 확인.",
  },
  {
    type: "convention",
    pros: ["넓은 공간 — 300명 이상 가능", "주차 편함", "동선 효율적"],
    cons: ["여러 홀 동시 운영 — 옆 홀 소음", "식대는 중간대 (5~10만원)", "특색 적음"],
    tip: "양가 합쳐 하객이 많을 때 안정적. 옆 홀 일정과 입장 동선 미리 확인.",
  },
  {
    type: "general",
    pros: ["가격대 다양 — 부담 적음", "지역마다 선택지 많음", "패키지(스드메 포함) 흔함"],
    cons: ["홀마다 분위기 천차만별", "음식 퀄리티 편차", "동시 진행 결혼식 많음"],
    tip: "예식장 패키지에 스드메가 포함된 경우, 개별 견적과 비교해 진짜 이득인지 따져보세요.",
  },
  {
    type: "outdoor",
    pros: ["사진·분위기 특별함", "한정된 자리 — 가까운 사람만 초대"],
    cons: ["날씨 리스크 (실내 백업 필요)", "초여름·늦가을이 주요 시즌", "음향·동선 직접 챙길 일 많음"],
    tip: "강풍·우천 대비 플랜 B 가 있는 곳 위주로. 야외는 5~6월 / 9~10월이 안전권.",
  },
];

let n = 0;
const id = () => `venue-${++n}`;
const catalogLastVerified: string | undefined = undefined;

// 공개적으로 잘 알려진 곳 위주. 가격은 공개 후기/상담가 기반 추정치 — 계약 전 직접 문의 필수.
export const VENUE_CATALOG: WeddingVenue[] = [
  // ─── 호텔 웨딩 (서울 5성) ───
  { id: id(), name: "그랜드 인터컨티넨탈 서울 파르나스", region: "삼성동", hallType: "hotel", foodType: "course",
    capacityMin: 200, capacityMax: 600, mealPriceMin: 130000, mealPriceMax: 200000, lastVerified: catalogLastVerified },
  { id: id(), name: "신라호텔 서울", region: "장충동", hallType: "hotel", foodType: "course",
    capacityMin: 200, capacityMax: 500, mealPriceMin: 140000, mealPriceMax: 210000, lastVerified: catalogLastVerified },
  { id: id(), name: "롯데호텔 서울", region: "소공동", hallType: "hotel", foodType: "course",
    capacityMin: 200, capacityMax: 500, mealPriceMin: 130000, mealPriceMax: 200000, lastVerified: catalogLastVerified },
  { id: id(), name: "그랜드 하얏트 서울", region: "한남동", hallType: "hotel", foodType: "course",
    capacityMin: 200, capacityMax: 500, mealPriceMin: 130000, mealPriceMax: 200000, lastVerified: catalogLastVerified },
  { id: id(), name: "콘래드 서울", region: "여의도", hallType: "hotel", foodType: "course",
    capacityMin: 150, capacityMax: 400, mealPriceMin: 120000, mealPriceMax: 180000, lastVerified: catalogLastVerified },
  { id: id(), name: "JW 메리어트 동대문 스퀘어", region: "동대문", hallType: "hotel", foodType: "course",
    capacityMin: 150, capacityMax: 350, mealPriceMin: 120000, mealPriceMax: 180000, lastVerified: catalogLastVerified },
  { id: id(), name: "포시즌스 호텔 서울", region: "광화문", hallType: "hotel", foodType: "course",
    capacityMin: 150, capacityMax: 350, mealPriceMin: 140000, mealPriceMax: 220000, lastVerified: catalogLastVerified },
  { id: id(), name: "노보텔 앰배서더 강남", region: "강남", hallType: "hotel", foodType: "buffet",
    capacityMin: 200, capacityMax: 500, mealPriceMin: 90000, mealPriceMax: 150000, lastVerified: catalogLastVerified },

  // ─── 하우스 / 채플 (단독 사용) ───
  { id: id(), name: "라움 (RAUM)", region: "청담", hallType: "house", foodType: "course",
    capacityMin: 100, capacityMax: 250, mealPriceMin: 100000, mealPriceMax: 170000, lastVerified: catalogLastVerified },
  { id: id(), name: "더채플앳청담", region: "청담", hallType: "house", foodType: "course",
    capacityMin: 100, capacityMax: 250, mealPriceMin: 100000, mealPriceMax: 170000, lastVerified: catalogLastVerified },
  { id: id(), name: "더베일리하우스", region: "신사동", hallType: "house", foodType: "course",
    capacityMin: 80, capacityMax: 200, mealPriceMin: 100000, mealPriceMax: 160000, lastVerified: catalogLastVerified },
  { id: id(), name: "더사운즈한남", region: "한남동", hallType: "house", foodType: "course",
    capacityMin: 80, capacityMax: 200, mealPriceMin: 110000, mealPriceMax: 170000, lastVerified: catalogLastVerified },
  { id: id(), name: "아펠가모 공덕", region: "공덕동", hallType: "house", foodType: "buffet",
    capacityMin: 150, capacityMax: 400, mealPriceMin: 70000, mealPriceMax: 110000, lastVerified: catalogLastVerified },
  { id: id(), name: "정동제일교회 (채플 웨딩)", region: "정동", hallType: "house", foodType: "buffet",
    capacityMin: 100, capacityMax: 300, lastVerified: catalogLastVerified, notes: "교회 채플 — 종교적 / 클래식한 분위기" },

  // ─── 컨벤션 / 대형 홀 ───
  { id: id(), name: "코엑스 컨벤션 & 인터컨티넨탈", region: "삼성동", hallType: "convention", foodType: "buffet",
    capacityMin: 200, capacityMax: 800, mealPriceMin: 80000, mealPriceMax: 130000, lastVerified: catalogLastVerified },
  { id: id(), name: "킨텍스 (KINTEX)", region: "일산", hallType: "convention", foodType: "buffet",
    capacityMin: 200, capacityMax: 600, mealPriceMin: 60000, mealPriceMax: 100000, lastVerified: catalogLastVerified },
  { id: id(), name: "aT센터", region: "양재동", hallType: "convention", foodType: "buffet",
    capacityMin: 200, capacityMax: 600, mealPriceMin: 60000, mealPriceMax: 100000, lastVerified: catalogLastVerified },
  { id: id(), name: "SETEC", region: "삼성동", hallType: "convention", foodType: "buffet",
    capacityMin: 200, capacityMax: 500, mealPriceMin: 60000, mealPriceMax: 100000, lastVerified: catalogLastVerified },

  // ─── 일반 결혼식장 ───
  { id: id(), name: "더채플 강남", region: "강남", hallType: "general", foodType: "buffet",
    capacityMin: 150, capacityMax: 350, mealPriceMin: 60000, mealPriceMax: 90000, lastVerified: catalogLastVerified },
  { id: id(), name: "강남구민회관", region: "강남", hallType: "general", foodType: "buffet",
    capacityMin: 100, capacityMax: 300, mealPriceMin: 50000, mealPriceMax: 80000, lastVerified: catalogLastVerified },
  { id: id(), name: "양재 더케이호텔 컨벤션센터", region: "양재", hallType: "general", foodType: "buffet",
    capacityMin: 150, capacityMax: 400, mealPriceMin: 70000, mealPriceMax: 110000, lastVerified: catalogLastVerified },
  { id: id(), name: "라마다 서울 호텔", region: "신사동", hallType: "general", foodType: "buffet",
    capacityMin: 150, capacityMax: 350, mealPriceMin: 70000, mealPriceMax: 110000, lastVerified: catalogLastVerified },
  { id: id(), name: "더리버사이드호텔", region: "잠원동", hallType: "general", foodType: "buffet",
    capacityMin: 150, capacityMax: 400, mealPriceMin: 70000, mealPriceMax: 110000, lastVerified: catalogLastVerified },

  // ─── 야외 / 이색 ───
  { id: id(), name: "워커힐 호텔 (야외 가든)", region: "광장동", hallType: "outdoor", foodType: "buffet",
    capacityMin: 100, capacityMax: 300, mealPriceMin: 100000, mealPriceMax: 160000, lastVerified: catalogLastVerified,
    notes: "한강뷰·야외 — 5~6월 / 9~10월 추천" },
  { id: id(), name: "포레스트가든", region: "성북", hallType: "outdoor", foodType: "buffet",
    capacityMin: 80, capacityMax: 200, lastVerified: catalogLastVerified, notes: "가든 웨딩 — 실내 백업 확인 필수" },
  { id: id(), name: "허밍그라스 (스몰 야외 웨딩)", region: "경기도", hallType: "outdoor", foodType: "buffet",
    capacityMin: 50, capacityMax: 150, lastVerified: catalogLastVerified, notes: "스몰웨딩 · 가든" },
];

export const VENUE_PRICE_NOTE =
  "식대는 지역·요일·시간대·메뉴·보증인원에 따라 크게 달라집니다. " +
  "상담 때는 식대뿐 아니라 부가세·봉사료·음주류·주차·셔틀·계약금 환불·취소 위약금까지 한 번에 확인하세요. " +
  "예식 장소, 식사 메뉴, 지불보증인원, 총액, 변경·해제 기준은 말로만 듣지 말고 계약서나 견적서에 남겨두세요.";
