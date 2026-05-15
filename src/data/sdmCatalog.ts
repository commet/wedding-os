// 스드메 — 스튜디오 / 드레스 / 메이크업 가이드 + 업체 큐레이션.
//
// ⚠️ 알림:
//   - 결혼 트렌드는 빠르게 바뀌고, 업체는 옮기거나 컨셉이 변합니다.
//   - 가격은 패키지 구성·시즌·플래너에 따라 큰 폭으로 달라요.
//   - 이 정보는 "이런 곳들이 자주 언급된다"는 출발점일 뿐, 최종 결정 전 직접 방문·견적 필수.

export type SdmGuide = {
  title: string;
  tip: string;
  checklist: string[];
};

export const SDM_GUIDE: Record<"studio" | "dress" | "makeup", SdmGuide> = {
  studio: {
    title: "📸 스튜디오 (웨딩 사진)",
    tip:
      "톤/컨셉이 가장 중요해요. 자연광·필름톤·블랙앤화이트·빈티지·시크 등 사이트 갤러리를 충분히 보고 \"우리 둘이 이 사진 안에 있어도 자연스러울까\"를 떠올려보세요.",
    checklist: [
      "원본·수정본 매수와 보정 수준 (몇 장? 인물보정 정도?)",
      "촬영 시간 (대개 4–6시간) · 촬영 장소 수",
      "원본 제공 여부 (안 주는 곳도 있음)",
      "샘플 앨범 / 액자 / 액자 사이즈 포함 여부",
      "수정본 받는 데 걸리는 시간 (1~3개월)",
      "당일·세컨드샷·드론 등 옵션 비용",
      "헤어메이크업 동선 (스튜디오에서 같이? 따로?)",
    ],
  },
  dress: {
    title: "👗 드레스 (본식 + 촬영)",
    tip:
      "드레스 투어는 2–3샵에서 각각 3–5벌 입어보는 게 보통이에요. 본식용·촬영용·2부용 셋으로 나뉘고, 샵마다 보유 디자이너가 달라요. 청담동·압구정·강북(이태원·홍대) 권역별 가격대가 다릅니다.",
    checklist: [
      "본식 1벌 + 촬영 1벌 + 2부복 (또는 한복)",
      "투어 비용 (보통 1샵당 5–10만원)",
      "예약금/계약금 비율 + 환불 정책",
      "수선 비용 별도? 횟수 제한?",
      "리허설 드레스 포함 여부",
      "픽업·시착·반납 동선 (촬영장까지 가져갈 수 있는지)",
      "본식 당일 헬퍼 비용",
    ],
  },
  makeup: {
    title: "💄 메이크업",
    tip:
      "메이크업은 \"본식 + 본식 전 리허설(촬영)\"이 기본 패키지. 원장님 직접 vs 실장님/팀장 가격 차이가 큽니다. 신랑 메이크업 포함인지도 확인.",
    checklist: [
      "리허설(촬영) + 본식 = 기본 2회",
      "원장 / 실장 / 팀장 등급별 가격 차이",
      "신랑 메이크업 포함 여부",
      "본식 당일 출장 가능? 추가 비용?",
      "예식장까지 동행 / 중간 리터치 횟수",
      "한복 메이크업·웨딩 헤어 변형 포함?",
      "혼주(어머님) 메이크업 별도 견적",
    ],
  },
};

export type SdmCatalogEntry = {
  id: string;
  category: "studio" | "dress" | "makeup";
  name: string;
  vibe: string;            // 한 문장 컨셉/특징
  region?: string;
  priceRange?: string;     // 대략적 패키지 비교용
};

// "한국에서 자주 언급되는 곳들" — 일반 상식 기준.
// 정확한 정보는 직접 확인이 필수. 가격·운영 상태는 시점에 따라 다릅니다.
export const SDM_CATALOG: SdmCatalogEntry[] = [
  // 스튜디오 ────────────────────────
  { id: "s-lamuse",    category: "studio", name: "라뮤즈 (Lamuse)",       vibe: "자연광·따뜻한 톤, 가장 인기", region: "강남" },
  { id: "s-eutteum",   category: "studio", name: "으뜸 스튜디오",          vibe: "전통적·고급 화보 톤",          region: "송파" },
  { id: "s-urbanchic", category: "studio", name: "어반시크 (UrbanChic)",   vibe: "모던·시크, 패션화보 느낌",     region: "강남" },
  { id: "s-life",      category: "studio", name: "라이프 스튜디오",         vibe: "라이프스타일·일상 컨셉",       region: "강남" },
  { id: "s-edwa",      category: "studio", name: "이드와 (Ed Wa)",         vibe: "빈티지·필름톤",                region: "강남" },
  { id: "s-merry",     category: "studio", name: "메리지",                  vibe: "로맨틱·웨딩 정통",             region: "강남" },
  { id: "s-salt",      category: "studio", name: "솔트 (Salt)",            vibe: "미니멀·차분한 톤",             region: "강남" },
  { id: "s-laon",      category: "studio", name: "라온 스튜디오",           vibe: "다양한 컨셉 보유",             region: "강남" },
  { id: "s-songisul",  category: "studio", name: "송이슬 스튜디오",         vibe: "자연광·동화적",                region: "강남" },
  { id: "s-donghaeng", category: "studio", name: "동행",                    vibe: "북유럽·헬싱키 컨셉",           region: "강남" },

  // 드레스 ────────────────────────
  { id: "d-schoeber",  category: "dress", name: "슈벨 (Schoeber)",        vibe: "수입 디자이너 위주, 럭셔리",    region: "청담동" },
  { id: "d-vera",      category: "dress", name: "베라왕 코리아",            vibe: "Vera Wang 정식 컬렉션",        region: "청담동" },
  { id: "d-bride",     category: "dress", name: "박은경 더브라이드",        vibe: "한국 디자이너 정통",            region: "청담동" },
  { id: "d-kanghw",    category: "dress", name: "강혜원 (디자이너)",        vibe: "심플·우아",                     region: "청담동" },
  { id: "d-avec",      category: "dress", name: "아베크블랑쉬",             vibe: "프렌치 무드, 가벼운 드레스",    region: "청담동" },
  { id: "d-diosi",     category: "dress", name: "디오시",                   vibe: "모던·미니멀",                   region: "청담동" },
  { id: "d-casadi",    category: "dress", name: "까사디서울",               vibe: "디자이너 셀렉 편집샵",          region: "청담동" },
  { id: "d-marigold",  category: "dress", name: "메리골드",                 vibe: "자연스럽고 클래식",             region: "강북" },
  { id: "d-yeonseon",  category: "dress", name: "김연선",                   vibe: "한국 전통 우아함",              region: "청담동" },
  { id: "d-jenny",     category: "dress", name: "제니바이제니김",            vibe: "심플·미니멀, 모델 라인",         region: "청담동" },

  // 메이크업 ────────────────────────
  { id: "m-jeong",     category: "makeup", name: "정샘물",                  vibe: "원장 메이크업 클래식, 대표 브랜드", region: "신사동" },
  { id: "m-jenny",     category: "makeup", name: "제니하우스",               vibe: "체인 헤어/메이크업, 안정적 품질",   region: "전국" },
  { id: "m-claire",    category: "makeup", name: "클레어",                  vibe: "내추럴·청순",                       region: "강남" },
  { id: "m-bymom",     category: "makeup", name: "에이바이봄",               vibe: "스튜디오 협업 많음",                 region: "강남" },
  { id: "m-momostud",  category: "makeup", name: "모모스튜디오",             vibe: "트렌디·SNS 인기",                   region: "강남" },
  { id: "m-minerva",   category: "makeup", name: "미네르바",                vibe: "글로시·페미닌",                     region: "청담동" },
  { id: "m-blanc",     category: "makeup", name: "블랑드제이",               vibe: "자연광 화보용 톤",                  region: "강남" },
  { id: "m-yune",      category: "makeup", name: "윤스타일",                 vibe: "단아·전통적",                       region: "강남" },
  { id: "m-momscw",    category: "makeup", name: "차홍",                    vibe: "헤어 + 메이크업 토탈, 체인",         region: "전국" },
  { id: "m-mufe",      category: "makeup", name: "메이크업포에버 아카데미",   vibe: "글로벌 브랜드 직영",                region: "강남" },
];

export const SDM_PRICE_RANGE_NOTE =
  "💰 시즌·플래너·패키지 구성에 따라 큰 차이. 전체 스드메 패키지 약 250–600만원이 일반적이며, 청담동 럭셔리 라인은 1000만원 이상도 흔합니다.";
