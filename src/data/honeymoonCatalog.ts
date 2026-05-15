// 인기 신혼여행지 큐레이션.
// 일반 상식 기반 정리 — 가격·시기는 시즌·환율에 따라 변하니
// "지금 검색"으로 갱신할 것.

export type HoneymoonPick = {
  id: string;
  region: string;        // "발리 (인도네시아)"
  emoji: string;
  flightHours: string;   // "약 7시간 직항"
  bestSeason: string;    // "5–9월 건기"
  avoidSeason?: string;
  budgetLevel: 1 | 2 | 3 | 4;   // 1 가성비 → 4 럭셔리
  budgetKRWPerPerson: string;   // "약 200~350만원"
  vibe: string;          // 한 문장
  highlights: string[];  // 명소·경험
  tip: string;           // 신혼여행 팁
  pairs?: string;        // 잘 어울리는 조합
};

export const HONEYMOON_CATALOG: HoneymoonPick[] = [
  {
    id: "bali",
    region: "발리 (인도네시아)",
    emoji: "🌴",
    flightHours: "약 7시간 직항",
    bestSeason: "5–9월 건기 (선선·맑음)",
    avoidSeason: "11–3월 우기",
    budgetLevel: 2,
    budgetKRWPerPerson: "약 200~350만원",
    vibe: "신혼여행 1순위로 가장 무난한 곳. 빌라·풀·스파의 정석.",
    highlights: [
      "우붓 — 라이스테라스, 요가, 정글 빌라",
      "스미냑 — 비치클럽, 카페, 쇼핑",
      "누사두아 — 안전한 비치, 가족 친화",
      "울루와뚜 — 절벽 선셋, 록바",
    ],
    tip: "우붓 2–3박 + 스미냑/누사두아 2–3박 거점 분리가 정석. 풀빌라 1박 끼우면 분위기 ↑",
    pairs: "처음 해외여행이거나 안전·편의 우선이면 1순위",
  },
  {
    id: "maldives",
    region: "몰디브",
    emoji: "🐠",
    flightHours: "약 9~10시간 (직항/경유)",
    bestSeason: "11–4월 건기",
    avoidSeason: "6–9월 우기",
    budgetLevel: 4,
    budgetKRWPerPerson: "약 500~1200만원+",
    vibe: "신혼여행의 끝판왕. 한 섬 = 한 리조트. 평생 한 번.",
    highlights: [
      "수상 빌라 (water villa) — 발코니에서 바로 바다로",
      "스노클링·만타레이·산호초",
      "선셋 크루즈, 스파",
    ],
    tip: "올인클루시브 패키지 비교 필수. 허니문 베네핏(룸 업그레이드·디너 등) 챙기기.",
    pairs: "예산이 되고 한 번에 럭셔리하게 가고 싶으면",
  },
  {
    id: "hawaii",
    region: "하와이",
    emoji: "🌺",
    flightHours: "약 8~9시간 직항",
    bestSeason: "4–10월",
    budgetLevel: 3,
    budgetKRWPerPerson: "약 400~700만원",
    vibe: "자연·도심·서핑·하이킹 다 있는 종합 신혼.",
    highlights: [
      "오아후 — 와이키키, 다이아몬드헤드, 하나우마베이",
      "마우이 — 하나로드, 할레아칼라 일출",
      "빅아일랜드 — 화산·천체관측",
    ],
    tip: "오아후+마우이 2섬이 일반적. 렌터카 필수. 비자(ESTA) 미리.",
    pairs: "활동적·미국 좋아하면",
  },
  {
    id: "phuket",
    region: "푸켓 (태국)",
    emoji: "🏝️",
    flightHours: "약 6시간 직항",
    bestSeason: "11–4월 건기",
    avoidSeason: "5–10월 우기",
    budgetLevel: 2,
    budgetKRWPerPerson: "약 180~300만원",
    vibe: "발리보다 한 단계 가성비. 비치 + 도심 둘 다.",
    highlights: [
      "피피섬, 제임스본드섬 보트투어",
      "파통 — 야시장·마사지·나이트",
      "라이트하우스 선셋, 빅 부다",
    ],
    tip: "푸켓 시내 + 라구나 리조트 분리 추천. 보트 투어는 멀미약 챙길 것.",
    pairs: "가성비·짧은 일정",
  },
  {
    id: "danang",
    region: "다낭/호이안 (베트남)",
    emoji: "🥥",
    flightHours: "약 5시간 직항",
    bestSeason: "2–5월",
    avoidSeason: "9–11월 우기",
    budgetLevel: 1,
    budgetKRWPerPerson: "약 130~250만원",
    vibe: "짧은 휴가형 신혼. 가격 대비 만족도 높음.",
    highlights: [
      "호이안 올드타운 야경",
      "바나힐 골든브릿지",
      "다낭 미케비치 리조트",
    ],
    tip: "다낭 리조트 + 호이안 당일치기 조합. 5박 6일이면 충분.",
    pairs: "휴가가 짧거나 첫 해외",
  },
  {
    id: "okinawa",
    region: "오키나와 (일본)",
    emoji: "🌊",
    flightHours: "약 2.5시간 직항",
    bestSeason: "4–6월, 10–11월",
    avoidSeason: "7–9월 태풍",
    budgetLevel: 2,
    budgetKRWPerPerson: "약 150~280만원",
    vibe: "가깝고 안전, 짧게 다녀오기 좋음.",
    highlights: [
      "추라우미 수족관",
      "고우리대교·오션뷰 드라이브",
      "이시가키섬·미야코섬 (더 한적)",
    ],
    tip: "렌터카 필수. 본섬 + 이시가키/미야코 분리하면 진짜 휴양.",
    pairs: "휴가 짧음·일본 좋아함",
  },
  {
    id: "europe",
    region: "유럽 (파리·이탈리아·스위스)",
    emoji: "🇫🇷",
    flightHours: "약 12~14시간",
    bestSeason: "5–6월, 9–10월",
    avoidSeason: "7–8월 성수기 인파",
    budgetLevel: 4,
    budgetKRWPerPerson: "약 500~900만원",
    vibe: "관광·문화·미식. 평생 한 번 큰 트립.",
    highlights: [
      "파리 — 에펠탑·루브르·세느강 디너크루즈",
      "이탈리아 — 로마·피렌체·아말피코스트",
      "스위스 — 인터라켄·체르마트 융프라우",
    ],
    tip: "9~10박 권장. 항공은 일찍 잡을수록 유리. 솅겐 + 영국·스위스 따로.",
    pairs: "휴가 길게 낼 수 있고 관광 좋아함",
  },
  {
    id: "santorini",
    region: "산토리니/그리스",
    emoji: "🇬🇷",
    flightHours: "약 14시간 (경유)",
    bestSeason: "5–6월, 9월",
    budgetLevel: 3,
    budgetKRWPerPerson: "약 400~700만원",
    vibe: "사진 한 장으로 끝나는 신혼. 인생샷 보장.",
    highlights: [
      "이아 마을 선셋",
      "동굴 호텔 (수영장+칼데라뷰)",
      "아테네 1–2일 추가",
    ],
    tip: "이아 vs 피라 숙소 위치 중요. 5–6월/9월이 골든. 7–8월은 너무 더움.",
    pairs: "사진·로맨틱",
  },
  {
    id: "cancun",
    region: "칸쿤 (멕시코)",
    emoji: "☀️",
    flightHours: "약 15시간 (경유)",
    bestSeason: "12–4월",
    avoidSeason: "6–11월 허리케인",
    budgetLevel: 3,
    budgetKRWPerPerson: "약 450~750만원",
    vibe: "올인클루시브 리조트의 천국.",
    highlights: [
      "리비에라 마야 리조트",
      "세노테 (지하 동굴 호수)",
      "치첸이트사 마야 유적",
    ],
    tip: "올인클루시브 패키지로 가는 게 정석. 한 리조트 5–7박 머무름.",
    pairs: "쉬고 먹고 마시기·여유로움",
  },
  {
    id: "dubai",
    region: "두바이/아부다비",
    emoji: "🕌",
    flightHours: "약 10시간 직항",
    bestSeason: "11–3월",
    avoidSeason: "6–9월 폭염",
    budgetLevel: 3,
    budgetKRWPerPerson: "약 350~650만원",
    vibe: "사막·럭셔리 호텔·쇼핑. 단기간 임팩트.",
    highlights: [
      "부르즈 칼리파, 버즈 알 아랍",
      "사막 사파리·낙타 라이드",
      "아부다비 그랜드 모스크",
    ],
    tip: "여름 직사광 피할 것. 라마단 기간 식당 운영 다름.",
    pairs: "도시+사막 둘 다 보고 싶음",
  },
];
