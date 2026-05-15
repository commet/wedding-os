// 스드메·스냅 가이드 + 업체 큐레이션.
//
// ⚠️ 매우 중요한 알림:
//   - 이 목록은 "한국 결혼 시장에서 자주 언급되는 곳"의 출발점일 뿐이며,
//     완전한 리스트가 아니고, 정확성도 보장되지 않습니다.
//   - 업체는 이전·폐업·이름 변경·실장 이동이 잦습니다.
//   - 가격·패키지는 시즌·플래너·딜에 따라 천차만별.
//   - 어느 업체와도 제휴·후원 관계 없음 — 객관적 정리 목적입니다.
//   - 최종 결정 전 직접 방문·견적·후기 확인 필수.

export type SdmGuide = {
  title: string;
  tip: string;
  checklist: string[];
};

export const SDM_GUIDE: Record<"studio" | "dress" | "makeup" | "snap", SdmGuide> = {
  studio: {
    title: "📸 스튜디오 (웨딩 화보)",
    tip:
      "스튜디오는 '정형화된 웨딩 화보'를 만드는 곳이에요. 톤이 가장 중요합니다 — 자연광·필름톤·블랙앤화이트·빈티지·시크·동화적 등. 갤러리를 충분히 보고 '우리 둘이 이 사진 안에 있어도 자연스러울까'를 떠올려보세요. 본식 당일 스냅(현장 촬영)과는 별개예요.",
    checklist: [
      "원본·수정본 매수와 보정 수준",
      "촬영 시간 (대개 4–6시간), 촬영 장소 수",
      "원본 제공 여부 (안 주는 곳도 있음)",
      "샘플 앨범 / 액자 / 액자 사이즈 포함 여부",
      "수정본 받는 데 걸리는 시간 (1~3개월)",
      "당일·세컨드샷·드론 등 옵션 비용",
      "헤어메이크업 동선 (스튜디오 출장? 따로?)",
    ],
  },
  dress: {
    title: "👗 드레스",
    tip:
      "드레스 투어는 2–3샵에서 각각 3–5벌 입어보는 게 보통이에요. 본식용·촬영용·2부용으로 나뉘고, 샵마다 보유 디자이너가 달라요. 청담동·강남·강북 권역별 가격대와 분위기가 다릅니다. 시착·예약은 빠를수록 좋아요.",
    checklist: [
      "본식 1벌 + 촬영 1벌 + 2부복 (또는 한복)",
      "투어 비용 (보통 1샵당 5–10만원, 환급 가능 여부)",
      "예약금/계약금 비율 + 환불 정책",
      "수선 비용 별도? 횟수 제한?",
      "리허설 드레스 포함 여부",
      "픽업·시착·반납 동선",
      "본식 당일 헬퍼 비용 + 동행 여부",
    ],
  },
  makeup: {
    title: "💄 메이크업 · 헤어",
    tip:
      "기본 패키지는 '리허설(촬영) + 본식'으로 2회. 원장님 직접 / 실장·팀장 등급별로 가격 차이가 큽니다. 신랑 메이크업 포함 여부, 본식 당일 출장·중간 리터치도 꼭 확인.",
    checklist: [
      "리허설(촬영) + 본식 = 기본 2회",
      "원장 / 실장 / 팀장 등급별 가격",
      "신랑 메이크업 포함 여부",
      "본식 당일 출장 가능? 추가 비용?",
      "예식장까지 동행 + 중간 리터치 횟수",
      "한복 메이크업·웨딩 헤어 변형 포함?",
      "혼주(어머님) 메이크업 별도 견적",
    ],
  },
  snap: {
    title: "📷 본식 스냅",
    tip:
      "스튜디오 촬영과는 별개로, '결혼식 당일 현장의 자연스러운 순간'을 담는 사진입니다. 신부대기실부터 본식·연회까지. 보통 실장 1인 또는 2인 촬영을 선택해요. 인생 사진은 의외로 본식 스냅에서 나옵니다.",
    checklist: [
      "촬영 범위 (신부대기실·본식·원판·연회·2부)",
      "실장 1인 vs 2인 (앵글이 많아짐)",
      "원본 매수 + 보정본 매수",
      "USB / DVD / 클라우드 전달",
      "앨범 제작 포함 여부 (신랑신부·부모님)",
      "원판(가족 단체) 별도 비용",
      "DVD 영상(움직이는 스냅) 옵션",
    ],
  },
};

export type SdmCatalogEntry = {
  id: string;
  category: "studio" | "dress" | "makeup" | "snap";
  name: string;
  vibe: string;
  region?: string;
};

// ─────────────────────────────────────────────────────────────────
// 한국에서 자주 언급되는 곳 — 결혼 카페·인스타·후기 기반 출발점 목록.
// 완전한 리스트도, 추천 순위도 아님. 본인 직접 확인 필수.
// ─────────────────────────────────────────────────────────────────

export const SDM_CATALOG: SdmCatalogEntry[] = [
  // ══════ 📸 스튜디오 ══════
  // 청담 / 강남 라인
  { id: "s-lamuse",     category: "studio", name: "라뮤즈 (Lamuse)",          vibe: "자연광·따뜻한 톤, 가장 자주 언급",   region: "청담" },
  { id: "s-eutteum",    category: "studio", name: "으뜸 스튜디오",             vibe: "전통적·고급 화보",                    region: "송파" },
  { id: "s-urbanchic",  category: "studio", name: "어반시크 (UrbanChic)",      vibe: "모던·시크 패션화보",                 region: "강남" },
  { id: "s-life",       category: "studio", name: "라이프 스튜디오",            vibe: "라이프스타일·일상 컨셉",              region: "강남" },
  { id: "s-edwa",       category: "studio", name: "이드와 (Ed Wa)",            vibe: "빈티지·필름톤",                       region: "강남" },
  { id: "s-merry",      category: "studio", name: "메리지",                     vibe: "정통 웨딩·로맨틱",                    region: "강남" },
  { id: "s-salt",       category: "studio", name: "솔트 (Salt)",                vibe: "미니멀·차분",                         region: "청담" },
  { id: "s-laon",       category: "studio", name: "라온 스튜디오",              vibe: "다양한 컨셉 보유",                    region: "강남" },
  { id: "s-songisul",   category: "studio", name: "송이슬 스튜디오",            vibe: "자연광·동화적",                       region: "강남" },
  { id: "s-donghaeng",  category: "studio", name: "동행",                       vibe: "북유럽·헬싱키 컨셉",                  region: "강남" },
  { id: "s-am",         category: "studio", name: "더에이엠 (The A.M.)",        vibe: "감각적·트렌디",                       region: "청담" },
  { id: "s-conto",      category: "studio", name: "콘토 (Conto)",               vibe: "모던·아트",                           region: "강남" },
  { id: "s-ohmyqq",     category: "studio", name: "옴마이꾸",                    vibe: "감성·로맨틱",                         region: "강남" },
  { id: "s-bo",         category: "studio", name: "보 (Bo)",                    vibe: "미니멀·세련",                         region: "청담" },
  { id: "s-papernote",  category: "studio", name: "페이퍼노트",                  vibe: "필름·내추럴",                         region: "청담" },
  { id: "s-mayb",       category: "studio", name: "오월의신부",                  vibe: "동화적·따뜻함",                       region: "강남" },
  { id: "s-jung",       category: "studio", name: "정 (Jung)",                  vibe: "심플·정제",                           region: "강남" },
  { id: "s-withyou",    category: "studio", name: "위드유 (With You)",          vibe: "내추럴 커플샷",                       region: "강남" },
  { id: "s-roserie",    category: "studio", name: "로제리 (Roserie)",            vibe: "로맨틱·플로럴",                       region: "강남" },
  { id: "s-thepick",    category: "studio", name: "더픽 (The Pick)",            vibe: "트렌디·SNS",                          region: "강남" },
  { id: "s-fabre",      category: "studio", name: "파브르 (Fabre)",              vibe: "유럽풍·우아",                         region: "강남" },
  { id: "s-daon",       category: "studio", name: "다온 스튜디오",                vibe: "심플·자연광",                         region: "강남" },
  { id: "s-glass",      category: "studio", name: "글라스 (Glass)",              vibe: "투명·미니멀",                         region: "강남" },
  { id: "s-vivid",      category: "studio", name: "비비드 (Vivid)",              vibe: "선명·컬러풀",                         region: "홍대" },
  { id: "s-iam",        category: "studio", name: "아이엠 (I AM)",               vibe: "다큐 같은 자연스러움",                 region: "이태원" },
  { id: "s-grape",      category: "studio", name: "그레이프 (Grape)",            vibe: "감성·필름",                           region: "강북" },
  { id: "s-victoria",   category: "studio", name: "빅토리아 스튜디오",            vibe: "클래식·전통",                         region: "강남" },
  { id: "s-archive",    category: "studio", name: "아카이브 (Archive)",          vibe: "기록·다큐",                           region: "강남" },
  { id: "s-cozy",       category: "studio", name: "코지 (Cozy)",                vibe: "포근·홈스타일",                       region: "홍대" },
  { id: "s-modf",       category: "studio", name: "모이브 (MOIVE)",              vibe: "차분·세련",                           region: "청담" },

  // ══════ 👗 드레스 ══════
  { id: "d-schoeber",   category: "dress", name: "슈벨 (Schoeber)",             vibe: "수입 디자이너 럭셔리",                region: "청담" },
  { id: "d-vera",       category: "dress", name: "베라왕 코리아",                 vibe: "Vera Wang 정식 컬렉션",              region: "청담" },
  { id: "d-bride",      category: "dress", name: "박은경 더브라이드",             vibe: "한국 디자이너 정통",                  region: "청담" },
  { id: "d-roche",      category: "dress", name: "브라이드 로체 (Bride Roche)",   vibe: "프렌치·우아",                         region: "청담" },
  { id: "d-kanghw",     category: "dress", name: "강혜원",                        vibe: "심플·우아",                           region: "청담" },
  { id: "d-avec",       category: "dress", name: "아베크블랑쉬",                  vibe: "프렌치 무드·가벼움",                  region: "청담" },
  { id: "d-diosi",      category: "dress", name: "디오시 (DiOSI)",                vibe: "모던·미니멀",                         region: "청담" },
  { id: "d-casadi",     category: "dress", name: "까사디서울 (Casa Di Seoul)",    vibe: "디자이너 편집샵",                     region: "청담" },
  { id: "d-marigold",   category: "dress", name: "메리골드",                       vibe: "자연스럽고 클래식",                   region: "강북" },
  { id: "d-yeonseon",   category: "dress", name: "김연선",                        vibe: "한국 전통 우아함",                    region: "청담" },
  { id: "d-jenny",      category: "dress", name: "제니바이제니김",                 vibe: "미니멀·모델 라인",                    region: "청담" },
  { id: "d-clio",       category: "dress", name: "끌리오 (Clio)",                vibe: "감각적·드레시",                       region: "청담" },
  { id: "d-madeleine",  category: "dress", name: "마들렌 (Madeleine)",            vibe: "로맨틱·동화",                         region: "청담" },
  { id: "d-deschans",   category: "dress", name: "디샹스",                         vibe: "트렌디·시크",                         region: "청담" },
  { id: "d-leporet",    category: "dress", name: "르포레 (Le Pore)",              vibe: "프렌치·고급스러움",                   region: "청담" },
  { id: "d-marshall",   category: "dress", name: "마샬 (Marshall)",                vibe: "모던·중성적",                         region: "청담" },
  { id: "d-baby",       category: "dress", name: "베이지바이김연실",                vibe: "베이지 톤·차분",                      region: "청담" },
  { id: "d-mellimello", category: "dress", name: "멜리메로 (MelliMello)",          vibe: "발랄·동화적",                         region: "청담" },
  { id: "d-lattel",     category: "dress", name: "라뜨엘",                          vibe: "프렌치 빈티지",                       region: "청담" },
  { id: "d-yellowmoon", category: "dress", name: "옐로우문 (Yellow Moon)",         vibe: "내추럴·소박",                         region: "강남" },
  { id: "d-yundo",      category: "dress", name: "윤도경 (Yundo)",                vibe: "디자이너 라인·심플",                  region: "청담" },
  { id: "d-mirabel",    category: "dress", name: "미라벨 (Mirabel)",              vibe: "프린세스·로맨틱",                     region: "청담" },
  { id: "d-danielkim",  category: "dress", name: "다니엘김",                        vibe: "디자이너 라인·우아",                  region: "청담" },
  { id: "d-fell",       category: "dress", name: "펠 (Fell)",                    vibe: "미니멀·디자이너",                     region: "청담" },
  { id: "d-odia",       category: "dress", name: "오디아 (Odia)",                 vibe: "유럽·내추럴",                         region: "청담" },
  { id: "d-castle",     category: "dress", name: "캐슬앤캐슬 (Castle & Castle)",   vibe: "고전·럭셔리",                         region: "청담" },
  { id: "d-dimanche",   category: "dress", name: "디망쉬 (Dimanche)",             vibe: "휴식 같은 분위기·내추럴",             region: "청담" },
  { id: "d-maisonbb",   category: "dress", name: "메종드비비",                     vibe: "프렌치·우아",                         region: "청담" },
  { id: "d-aisle",      category: "dress", name: "디아일 (The Aisle)",            vibe: "심플·신부 위주",                      region: "강남" },
  { id: "d-whitedh",    category: "dress", name: "화이트더홍 (White The Hong)",   vibe: "강북 라인·모던",                      region: "강북" },

  // ══════ 💄 메이크업 ══════
  { id: "m-jeong",      category: "makeup", name: "정샘물",                       vibe: "원장 클래식, 대표 브랜드",            region: "신사동" },
  { id: "m-jenny",      category: "makeup", name: "제니하우스",                    vibe: "체인, 안정적 품질",                   region: "전국" },
  { id: "m-claire",     category: "makeup", name: "클레어 (Claire)",              vibe: "내추럴·청순",                         region: "강남" },
  { id: "m-bymom",      category: "makeup", name: "에이바이봄 (Abyom)",            vibe: "스튜디오 협업 많음",                  region: "강남" },
  { id: "m-momostud",   category: "makeup", name: "모모스튜디오",                   vibe: "트렌디·SNS 인기",                     region: "강남" },
  { id: "m-minerva",    category: "makeup", name: "미네르바 (Minerva)",            vibe: "글로시·페미닌",                       region: "청담" },
  { id: "m-blanc",      category: "makeup", name: "블랑드제이 (Blanc de J)",       vibe: "자연광 화보 톤",                      region: "강남" },
  { id: "m-yune",       category: "makeup", name: "윤스타일",                       vibe: "단아·전통",                           region: "강남" },
  { id: "m-mufe",       category: "makeup", name: "메이크업포에버 아카데미",        vibe: "글로벌 브랜드 직영",                  region: "강남" },
  { id: "m-chahong",    category: "makeup", name: "차홍 (Cha Hong)",              vibe: "헤어+메이크업 토탈, 체인",            region: "전국" },
  { id: "m-chloe",      category: "makeup", name: "끌로에 (Chloe) — 김선진",      vibe: "차분·고급스러움",                     region: "청담" },
  { id: "m-light",      category: "makeup", name: "라이트 (Light)",                vibe: "은은·자연광",                         region: "강남" },
  { id: "m-lamusemu",   category: "makeup", name: "라뮤즈 메이크업",                vibe: "라뮤즈 자매 브랜드",                  region: "청담" },
  { id: "m-hanhw",      category: "makeup", name: "한혜원",                         vibe: "원장 메이크업 정통",                  region: "청담" },
  { id: "m-kimcg",      category: "makeup", name: "김청경 헤어페이스",               vibe: "헤어로 유명, 메이크업 병행",          region: "압구정" },
  { id: "m-leeg",       category: "makeup", name: "이가자 헤어비스",                vibe: "역사 깊은 헤어샵, 메이크업 포함",     region: "압구정" },
  { id: "m-leeyj",      category: "makeup", name: "이유진",                         vibe: "디자이너 매장",                       region: "청담" },
  { id: "m-yunhj",      category: "makeup", name: "윤혜정",                         vibe: "내추럴·세련",                         region: "강남" },
  { id: "m-yunwon",     category: "makeup", name: "윤원 (Yunwon)",                 vibe: "차분·정통",                           region: "강남" },
  { id: "m-jeonghy",    category: "makeup", name: "정혜영",                         vibe: "원장 메이크업",                       region: "강남" },
  { id: "m-parktw",     category: "makeup", name: "박태윤",                         vibe: "헤어·메이크업 토탈",                  region: "청담" },
  { id: "m-ksmug",      category: "makeup", name: "케이스맥업 (K.s makeup)",        vibe: "감각적·트렌디",                       region: "강남" },
  { id: "m-omimi",      category: "makeup", name: "오미아미 (Omiami)",             vibe: "신부 메이크업 전문",                  region: "청담" },
  { id: "m-mijang",     category: "makeup", name: "미장 (Mijang)",                vibe: "한국적 단아함",                       region: "강남" },
  { id: "m-glowup",     category: "makeup", name: "글로우업 (Glow Up)",             vibe: "글로시·생기",                         region: "강남" },
  { id: "m-grace",      category: "makeup", name: "그레이스 (Grace)",              vibe: "우아·정제",                           region: "강남" },
  { id: "m-thesharp",   category: "makeup", name: "더샵 (The Shop)",               vibe: "원장 + 팀장 라인 다양",                region: "강남" },
  { id: "m-rune",       category: "makeup", name: "룬 (Rune)",                    vibe: "차분·미니멀",                         region: "강남" },

  // ══════ 📷 본식 스냅 ══════
  { id: "n-greentea",   category: "snap", name: "그린티스냅 (Green Tea Snap)",     vibe: "본식 스냅 인기, 실장 2인 옵션",      region: "강남" },
  { id: "n-days",       category: "snap", name: "데이어스 (Days)",                vibe: "감성·다큐",                           region: "강남" },
  { id: "n-papernote",  category: "snap", name: "페이퍼노트 스냅",                  vibe: "필름톤·내추럴",                       region: "청담" },
  { id: "n-womans",     category: "snap", name: "위민스 (Womans)",                vibe: "여성 작가 위주",                      region: "강남" },
  { id: "n-yoondh",     category: "snap", name: "윤도현 스냅",                      vibe: "다큐·생생함",                         region: "강남" },
  { id: "n-kimjirung",  category: "snap", name: "김지룽",                          vibe: "개성·아트",                           region: "강남" },
  { id: "n-kimsy",      category: "snap", name: "김선영",                          vibe: "차분·기록 위주",                      region: "강남" },
  { id: "n-pdpd",       category: "snap", name: "빠담빠담 (Padampadam)",          vibe: "감성·내추럴",                         region: "강남" },
  { id: "n-lifesnap",   category: "snap", name: "라이프스냅",                       vibe: "라이프 시리즈, 안정적",                region: "강남" },
  { id: "n-mayb-snap",  category: "snap", name: "오월의신부 스냅",                  vibe: "동화적·따뜻함",                       region: "강남" },
  { id: "n-adayin",     category: "snap", name: "어 데이 인 (A Day In)",          vibe: "다큐·하루의 기록",                    region: "강남" },
  { id: "n-graphic",    category: "snap", name: "그래픽 (Graphic)",               vibe: "감각적 컷",                           region: "강남" },
  { id: "n-hellomoon",  category: "snap", name: "헬로우문",                         vibe: "내추럴·로맨틱",                       region: "강남" },
  { id: "n-theplace",   category: "snap", name: "더플레이스",                       vibe: "공간감 강조",                         region: "강남" },
  { id: "n-sinyoung",   category: "snap", name: "신영 스냅",                        vibe: "정통·안정",                           region: "강남" },
  { id: "n-woody",      category: "snap", name: "우디 (Woody)",                   vibe: "감성·필름",                           region: "강남" },
  { id: "n-handream",   category: "snap", name: "핸드림 (Handream)",               vibe: "꾸밈 없는 자연스러움",                 region: "강남" },
  { id: "n-marty",      category: "snap", name: "마티 (Marty)",                  vibe: "트렌디·SNS",                          region: "강남" },
  { id: "n-mryou",      category: "snap", name: "미스터유 (Mr. You)",             vibe: "남성 작가, 다큐 톤",                  region: "강남" },
  { id: "n-chelsea",    category: "snap", name: "첼시 (Chelsea)",                  vibe: "유럽풍·우아",                         region: "강남" },
  { id: "n-moment",     category: "snap", name: "모먼트 (Moment)",                 vibe: "순간 포착",                           region: "강남" },
  { id: "n-themovie",   category: "snap", name: "더무비 (The Movie)",              vibe: "영상 스냅(DVD) 위주",                 region: "강남" },
  { id: "n-cinema",     category: "snap", name: "시네마 스냅",                       vibe: "영화 같은 영상 결과물",                region: "강남" },
];

export const SDM_PRICE_RANGE_NOTE =
  "💰 시즌·플래너·패키지 구성에 따라 큰 차이. 전체 스드메 패키지 약 250–600만원이 일반적이며, 청담 럭셔리는 1000만원+ 도 흔합니다. 본식 스냅은 별도로 약 60–150만원.";

// 사람들이 추가 정보를 얻는 흔한 채널 — 객관적 안내
export const RESEARCH_CHANNELS = [
  { name: "다이렉트결혼준비 (네이버 카페)", url: "https://cafe.naver.com/directwedding" },
  { name: "결준위 (네이버 카페)", url: "https://cafe.naver.com/wprep" },
  { name: "레몬테라스 결혼 게시판", url: "https://cafe.naver.com/remonterrace" },
  { name: "인스타 #신부일기", url: "https://www.instagram.com/explore/tags/%EC%8B%A0%EB%B6%80%EC%9D%BC%EA%B8%B0/" },
  { name: "인스타 #드레스투어", url: "https://www.instagram.com/explore/tags/%EB%93%9C%EB%A0%88%EC%8A%A4%ED%88%AC%EC%96%B4/" },
  { name: "유튜브 '웨딩 vlog' 검색", url: "https://www.youtube.com/results?search_query=%EC%9B%A8%EB%94%A9+%EB%B8%94%EB%A1%9C%EA%B7%B8" },
];
