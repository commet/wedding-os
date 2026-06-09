// 데모 데이터 — 첫 진입 시 보여주는 "완성된 예시 결혼식".
// 가상의 커플. 실명·실제 장소·실제 사례 일절 없음.
// 사용자가 [내 결혼식 시작하기] 누르면 defaultData() 로 깨끗이 초기화된다.

import { WeddingData, SCHEMA_VERSION, Ring, ChecklistSection, VideoConfig, SdmVendor } from "../lib/schema";
import { RING_CATALOG } from "./ringsTemplate";
import { defaultChecklist } from "./checklistTemplate";
import { STOCK_GALLERY } from "./stockPhotos";

const today = new Date();
const iso = (d: Date) => d.toISOString().split("T")[0];
// 결혼식: 약 5개월 뒤 토요일
const wedding = new Date(today);
wedding.setDate(wedding.getDate() + 152);

// Unsplash — 자유 사용 가능한 결혼/커플 사진 (hotlink 허용)
const PHOTO = {
  hero: "https://images.unsplash.com/photo-1519741497674-611481863552?w=900&q=80",
  g1: "https://images.unsplash.com/photo-1606800052052-a08af7148866?w=600&q=80",
  g2: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=600&q=80",
  g3: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=600&q=80",
  g4: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=80",
  g5: "https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600&q=80",
  g6: "https://images.unsplash.com/photo-1525328437458-0c4d4db7cab4?w=600&q=80",
};

function demoChecklist(): ChecklistSection[] {
  // 표준 타임라인을 결혼식 날짜 기준으로 불러온 뒤,
  // 데모용으로 이미 지난 마감일 항목 위주로 일부를 완료 처리.
  const list = defaultChecklist(iso(wedding));
  list.forEach((sec) => {
    sec.items.forEach((it) => {
      const dd = it.ddayOffset ?? 0;
      // D-120 이전 항목은 대체로 완료된 것으로 (데모에 진행감 부여)
      if (dd <= -120 && Math.random() > 0.25) it.done = true;
    });
  });
  return list;
}

function demoSdm(): SdmVendor[] {
  return [
    { id: "demo-sdm-1",  category: "studio", name: "라뮤즈 (Lamuse)",          region: "청담", notes: "자연광 톤 / 가장 자주 언급",      status: "상담" },
    { id: "demo-sdm-2",  category: "studio", name: "어반시크 (UrbanChic)",     region: "강남", notes: "모던·시크 패션화보",              status: "관심" },
    { id: "demo-sdm-3",  category: "studio", name: "이드와 (Ed Wa)",           region: "강남", notes: "빈티지·필름톤",                    status: "관심" },
    { id: "demo-sdm-4",  category: "dress",  name: "박은경 더브라이드",         region: "청담", notes: "한국 디자이너 정통",                status: "상담" },
    { id: "demo-sdm-5",  category: "dress",  name: "아베크블랑쉬",              region: "청담", notes: "프렌치 무드·가벼움",                status: "관심" },
    { id: "demo-sdm-6",  category: "dress",  name: "브라이드 로체 (Bride Roche)", region: "청담", notes: "프렌치·우아",                       status: "관심" },
    { id: "demo-sdm-7",  category: "makeup", name: "정샘물",                    region: "신사동", notes: "원장 메이크업 클래식",              status: "관심" },
    { id: "demo-sdm-8",  category: "makeup", name: "모모스튜디오",               region: "강남", notes: "트렌디·SNS 인기",                  status: "관심" },
    { id: "demo-sdm-9",  category: "makeup", name: "끌로에 (Chloe) — 김선진",   region: "청담", notes: "차분·고급스러움",                  status: "관심" },
    { id: "demo-sdm-10", category: "snap",   name: "그린티스냅 (Green Tea Snap)", region: "강남", notes: "본식 스냅 인기 / 실장 2인 옵션",    status: "상담" },
    { id: "demo-sdm-11", category: "snap",   name: "데이어스 (Days)",            region: "강남", notes: "감성·다큐",                        status: "관심" },
    { id: "demo-sdm-12", category: "snap",   name: "페이퍼노트 스냅",            region: "청담", notes: "필름톤·내추럴",                    status: "관심" },
  ];
}

function demoRings(): Ring[] {
  // 카탈로그 전체 + 5개에 ★/♥ 표시 → Top 5 자동 생성
  const picks: Record<string, { starredBy?: ("groom"|"bride")[]; likedBy?: ("groom"|"bride")[] }> = {
    "ring-3":  { starredBy: ["bride", "groom"], likedBy: ["bride"] },         // 티파니 투게더
    "ring-8":  { starredBy: ["bride"], likedBy: ["bride", "groom"] },         // 까르띠에 C 드 까르띠에
    "ring-41": { starredBy: ["groom"], likedBy: ["groom"] },                  // 쇼메 비 드 쇼메
    "ring-23": { likedBy: ["bride"] },                                        // 불가리 로마 아모르
    "ring-27": { starredBy: ["groom"], likedBy: ["bride"] },                  // 드 비어스 DB Classic
  };
  return RING_CATALOG.map((r) => ({ ...r, ...(picks[r.id] ?? {}) }));
}

export function demoData(): WeddingData {
  return {
    schemaVersion: SCHEMA_VERSION,
    preferences: {
      mode: null,
      locale: "ko",
      isDemo: true,
    },
    invitation: {
      groomName: "도현",
      brideName: "지윤",
      groomEnglishName: "Dohyun",
      brideEnglishName: "Jiyoon",
      date: iso(wedding),
      time: "오후 1시",
      venue: "그랜드하우스 웨딩홀",
      venueHall: "5층 채플홀",
      venueAddress: "서울특별시 강남구 (예시 주소)",
      heroImageUrl: PHOTO.hero,
      greeting:
        "서로가 마주 보며 다져온 사랑을\n이제 함께 한 곳을 바라보며\n걸어가려 합니다.\n\n저희 두 사람이 새로운 시작을 하는 날,\n귀한 걸음으로 축복해 주시면\n더없는 기쁨으로 간직하겠습니다.",
      groomParents: { father: "김성호", mother: "박미경" },
      brideParents: { father: "이재민", mother: "최은영" },
      groomOrder: "장남",
      brideOrder: "장녀",
      groomPhone: "010-1234-5678",
      bridePhone: "010-8765-4321",
      groomAccount: "신한은행 110-123-456789 (김도현)",
      brideAccount: "국민은행 123-45-6789012 (이지윤)",
      gallery: [
        { url: PHOTO.g1 }, { url: PHOTO.g2 }, { url: PHOTO.g3 },
        { url: PHOTO.g4 }, { url: PHOTO.g5 }, { url: PHOTO.g6 },
      ],
      rsvpEnabled: true,
      theme: "cream",
      enabledLocales: [],
    },
    rings: demoRings(),
    sdm: demoSdm(),
    hotels: [
      {
        id: "demo-hotel-1",
        name: "더 그랜드 호텔",
        location: "서울 강남",
        lastVerified: iso(today),
        otaPrices: [
          { ota: "아고다", price: 178000 },
          { ota: "호텔스닷컴", price: 192000 },
          { ota: "익스피디아", price: 185000 },
          { ota: "공식 홈페이지", price: 210000 },
          { ota: "트립닷컴", price: 181000 },
        ],
        rooms: [
          { type: "디럭스 더블", pricePerNight: 178000, breakfast: false },
          { type: "이그제큐티브", pricePerNight: 245000, breakfast: true },
        ],
      },
      {
        id: "demo-hotel-2",
        name: "시티 비즈니스 호텔",
        location: "서울 강남 (예식장 도보 5분)",
        lastVerified: iso(today),
        otaPrices: [
          { ota: "야놀자", price: 98000 },
          { ota: "여기어때", price: 102000 },
          { ota: "아고다", price: 105000 },
        ],
        notes: "하객용 — 예식장에서 가까움",
      },
    ],
    flights: [
      {
        id: "demo-flight-1",
        airline: "대한항공",
        flightNumber: "KE629",
        from: "ICN", to: "DPS",
        departAt: "2026-XX-XX 00:05",
        arriveAt: "06:30 (+1)",
        priceKRW: 920000,
        lastVerified: iso(today),
        notes: "직항 · 신혼여행 발리행",
      },
      {
        id: "demo-flight-2",
        airline: "가루다 인도네시아",
        flightNumber: "GA817",
        from: "ICN", to: "DPS",
        departAt: "2026-XX-XX 23:40",
        arriveAt: "05:55 (+1)",
        priceKRW: 870000,
        lastVerified: iso(today),
        notes: "직항",
      },
      {
        id: "demo-flight-3",
        airline: "싱가포르항공",
        flightNumber: "SQ607 + SQ942",
        from: "ICN", to: "DPS",
        departAt: "2026-XX-XX 09:00",
        arriveAt: "19:10 (싱가포르 경유)",
        priceKRW: 760000,
        lastVerified: iso(today),
        notes: "경유 · 가장 저렴",
      },
    ],
    honeymoon: {
      regions: [
        {
          id: "demo-region-1",
          name: "발리",
          durationDays: 6,
          budgetKRW: 4500000,
          schedule:
            "Day 1 · 덴파사르 도착, 우붓 이동\nDay 2 · 우붓 — 라이스테라스, 원숭이숲\nDay 3 · 우붓 스파 + 요가\nDay 4 · 스미냑 이동, 비치클럽\nDay 5 · 누사두아 — 워터블로우, 스노클링\nDay 6 · 출국",
          notes: "우기 피해서 6~9월 추천. 우붓+스미냑 2거점.",
        },
        {
          id: "demo-region-2",
          name: "몰디브",
          durationDays: 5,
          budgetKRW: 7800000,
          schedule:
            "Day 1 · 말레 도착, 수상비행기로 리조트\nDay 2~4 · 리조트 — 스노클링, 스파, 선셋크루즈\nDay 5 · 출국",
          notes: "올인클루시브 리조트면 추가 비용 적음. 허니문 혜택 문의.",
        },
        {
          id: "demo-region-3",
          name: "오키나와",
          durationDays: 4,
          budgetKRW: 2600000,
          schedule:
            "Day 1 · 나하 도착, 국제거리\nDay 2 · 추라우미 수족관, 고우리대교\nDay 3 · 아메리칸빌리지, 렌터카 해안드라이브\nDay 4 · 출국",
          notes: "가깝고 저렴. 짧게 다녀오기 좋음.",
        },
      ],
      startDate: "",
      endDate: "",
      notes: "발리로 거의 결정 — 항공권 예약만 남음",
    },
    checklist: demoChecklist(),
    video: demoVideo(),
  };
}

function demoVideo(): VideoConfig {
  // 보통의 식전영상 — 사진이 음악과 함께 자연스럽게 흐르고, 군데군데 짧은 자막.
  // 막(챕터) 구분은 쓰지 않음 (원하면 에디터에서 추가 가능).
  const g = STOCK_GALLERY;
  const photos = [
    { id: "dvp-1", url: g[0], durationSec: 4, effect: "kenBurnsIn", transition: "fade", filter: "warm", caption: "두 사람이 만나기까지" },
    { id: "dvp-2", url: g[1], durationSec: 3.5, effect: "panRight", transition: "fade", filter: "vintage" },
    { id: "dvp-3", url: g[2], durationSec: 3.5, effect: "kenBurnsOut", transition: "fade", filter: "none" },
    { id: "dvp-4", url: g[3], durationSec: 4, effect: "kenBurnsIn", transition: "fade", filter: "warm", caption: "함께 보낸 시간들" },
    { id: "dvp-5", url: g[4], durationSec: 3.5, effect: "panLeft", transition: "fade", filter: "none" },
    { id: "dvp-6", url: g[5], durationSec: 3.5, effect: "kenBurnsIn", transition: "fade", filter: "vintage" },
    { id: "dvp-7", url: g[6], durationSec: 3.5, effect: "kenBurnsOut", transition: "fade", filter: "warm" },
    { id: "dvp-8", url: g[7], durationSec: 4, effect: "kenBurnsIn", transition: "fade", filter: "none", caption: "그리고, 오늘" },
    { id: "dvp-9", url: g[8], durationSec: 3.5, effect: "panRight", transition: "fade", filter: "warm" },
    { id: "dvp-10", url: g[9], durationSec: 4, effect: "kenBurnsIn", transition: "fade", filter: "none" },
  ] as VideoConfig["photos"];
  return {
    title: "도현 · 지윤",
    acts: [],
    photos,
    ending: { message: "와주셔서 감사합니다", date: iso(wedding) },
    titleCardSec: 3,
    endingSec: 5,
    fps: 30,
  };
}
