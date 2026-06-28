// 전체 데이터 스키마 — 모드 1 / 모드 2 모두 같은 모양으로 직렬화된다.
// 모드 2 (Supabase) 에서는 이 객체 전체를 `wedding_data` 테이블의 `data` JSON 컬럼에 저장.

export const SCHEMA_VERSION = 1;

// local      — 이 기기에만 (오프라인)
// hosted     — 운영자 호스팅 + 종단간 암호화 (간편). 운영자 서버엔 암호문만.
// supabase   — 내 Supabase 직접 (독립)
// devOnly    — 개발자 모드 (코드 직접)
export type Mode = "local" | "hosted" | "supabase" | "devOnly";

export type Verifiable = {
  /** ISO date — 이 값을 마지막으로 확인/입력한 날짜 */
  lastVerified?: string;
  /** 확인 출처 (URL 또는 짧은 메모) */
  source?: string;
};

export type Ring = Verifiable & {
  id: string;
  brand: string;
  model: string;
  material?: string;        // 플래티넘 / 화이트골드 / 로즈골드 / 옐로우골드
  priceKRW?: number;
  hasDiamond?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  imageFit?:
    | "contain"
    | "top"
    | "center"
    | "product"
    | "centerProduct"
    | "flatProduct"
    | "smallProduct"
    | "cleanProduct"
    | "slightLeftProduct"
    | "slightLeftCenterProduct";
  notes?: string;
  starredBy?: ("groom" | "bride")[];   // ★ 즐겨찾기
  likedBy?: ("groom" | "bride")[];     // ♥ 좋아요
  link?: string;
  // 카탈로그 이미지가 카드형(반지+텍스트)일 때 정사각 크롭 위치 힌트.
  // top = 반지가 위쪽 → 위 기준 크롭 / center = 가운데 / contain = 전체 보기
  imgFit?: "top" | "center" | "contain";
};

export type Hotel = Verifiable & {
  id: string;
  name: string;
  location?: string;
  rooms?: { type: string; pricePerNight?: number; breakfast?: boolean; }[];
  otaPrices?: { ota: string; price?: number; url?: string; }[];
  notes?: string;
};

export type Flight = Verifiable & {
  id: string;
  airline?: string;
  flightNumber?: string;
  from?: string;
  to?: string;
  departAt?: string;
  arriveAt?: string;
  priceKRW?: number;
  notes?: string;
  link?: string;
};

export type HoneymoonRegion = {
  id: string;
  name: string;
  durationDays?: number;
  budgetKRW?: number;
  schedule?: string;
  notes?: string;
};

export type HoneymoonPlan = {
  regions: HoneymoonRegion[];
  startDate?: string;
  endDate?: string;
  notes?: string;
};

// ── 예식장(웨딩홀) ──
// hallType:
//   hotel       — 호텔 웨딩 (그랜드인터컨티넨탈, 신라 등)
//   house       — 하우스 웨딩 (라움, 더채플앳청담)
//   convention  — 컨벤션·홀 (코엑스, 킨텍스)
//   general     — 일반 결혼식장
//   outdoor     — 야외·이색 (가든, 채플)
export type VenueHallType = "hotel" | "house" | "convention" | "general" | "outdoor";
// foodType:
//   buffet      — 뷔페
//   course      — 코스 (양식·한정식)
//   plated      — 단품 한식·일품 정찬
export type VenueFoodType = "buffet" | "course" | "plated";

export type ContractCheck = {
  contact?: string;
  quote?: string;
  payment?: string;
  cancellation?: string;
  included?: string;
  extras?: string;
  evidence?: string;
};

export type WeddingVenue = Verifiable & {
  id: string;
  name: string;
  region?: string;          // "강남" / "서울 종로" / "분당" 등
  hallType?: VenueHallType;
  foodType?: VenueFoodType;
  capacityMin?: number;     // 최소 보증인원
  capacityMax?: number;     // 최대 수용 인원
  mealPriceMin?: number;    // 식대 시작가 (원)
  mealPriceMax?: number;    // 식대 상한가 (원)
  link?: string;
  notes?: string;
  status?: "관심" | "투어" | "계약";
  visitedAt?: string;       // 답사 날짜
  contact?: string;         // 담당자·업체 연락처
  depositKRW?: number;      // 계약금
  balanceKRW?: number;      // 잔금
  balanceDueAt?: string;    // 잔금 납부일 (ISO)
  contract?: ContractCheck;  // 계약 조건 확인 메모
};

// ── 예산 ──
export type BudgetItem = {
  id: string;
  category: string;           // "예식장 식대", "스튜디오" 등
  planned?: number;           // 예상 비용 (원)
  actual?: number;            // 실제 지출 (원)
  paid?: boolean;             // 결제 완료
  notes?: string;
  /** 참고 기준값. 사용자가 못 바꾸는 read-only 힌트. */
  avgKRW?: number;
};

// ── 하객 ──
export type GuestSide = "groom" | "bride" | "shared";
export type GuestStatus = "초대 예정" | "초대 완료" | "참석" | "불참" | "미정";

// 하객 분류 — 예상 인원 계산기와 명단을 같은 축으로 묶는다.
export type GuestCategory = "family" | "relative" | "work" | "school" | "friend" | "acquaintance";

export type Guest = {
  id: string;
  name: string;
  relation?: string;        // "회사 동료", "고등학교 친구" 등 자유
  group?: string;           // 테이블/좌석을 잡기 전 묶음 메모
  side: GuestSide;
  category?: GuestCategory;  // 가족·친척·직장·학교·친구·지인
  phone?: string;
  email?: string;
  status: GuestStatus;
  partyCount?: number;      // 본인 포함 인원 수
  giftKRW?: number;         // 축의금
  meal?: boolean;           // 식권 사용 여부
  notes?: string;
  invitedAt?: string;       // 청첩장 발송 일자
};

// 예상 인원 — 명단을 다 적기 전에도 측·분류별로 "몇 명 올지" 가늠하는 계산기.
// 계약 식장 보증인원·식대·양가 균형 경고가 이 추정치에서도 작동한다(명단이 비어도).
export type HeadcountEstimate = {
  side: "groom" | "bride";
  category: GuestCategory;
  expected: number;
};

// 스드메와 본식 스냅은 별도 메뉴로 보여주되 같은 vendor 모델을 공유한다.
// studio/dress/makeup = 스드메, snap = 본식 당일 스냅
export type SdmCategory = "studio" | "dress" | "makeup" | "snap";

export type SdmVendor = {
  id: string;
  category: SdmCategory;
  name: string;
  priceRange?: string;
  region?: string;
  notes?: string;
  link?: string;
  status?: "관심" | "상담" | "계약";
  contact?: string;         // 담당자·업체 연락처
  depositKRW?: number;      // 계약금
  balanceKRW?: number;      // 잔금
  balanceDueAt?: string;    // 잔금 납부일 (ISO)
  contract?: ContractCheck;  // 계약 조건 확인 메모
};

// ── 식순 (당일 진행표) ──
// 예식 당일 단계별 큐시트 — 시간·담당(사회/주례/축가)·구간 음악을 한 화면에서.
export type CeremonyStep = {
  id: string;
  time?: string;       // "13:00" 또는 자유 메모성 ("입장 직전")
  title: string;       // "신랑 입장"
  role?: string;       // 담당 — 사회 / 주례 / 축가자 등
  music?: string;      // 구간 음악·축가 곡
  notes?: string;
  done?: boolean;      // 리허설·당일 체크용
};

export type CheckItem = {
  id: string;
  text: string;
  done: boolean;
  source?: "ai" | "user" | "template";
  dueDate?: string;       // 절대 마감일 (ISO). ddayOffset이 있으면 결혼식 날짜 기준으로 자동 계산됨
  ddayOffset?: number;    // 결혼식 D-day 기준 상대 일수 (음수 = 그 전). 예: -90 = D-90
  priority?: "red" | "yellow" | "green";
  sub?: CheckItem[];
};

export type ChecklistSection = {
  id: string;
  icon: string;
  title: string;
  items: CheckItem[];
};

export type InvitationContent = {
  groomName: string;
  brideName: string;
  groomEnglishName?: string;
  brideEnglishName?: string;
  date: string;          // ISO
  time?: string;         // "오후 3시"
  venue: string;
  venueHall?: string;    // "3층 그랜드볼룸"
  venueAddress?: string;
  venueMapUrl?: string;
  heroImageUrl?: string; // 메인 대표 사진
  previewImageEnabled?: boolean; // 링크 미리보기 카드에 대표 사진 공개 썸네일 사용
  greeting: string;      // 모시는 글
  groomParents?: { father?: string; mother?: string; };
  brideParents?: { father?: string; mother?: string; };
  groomOrder?: string;   // "장남" / "차남" 등
  brideOrder?: string;
  groomPhone?: string;
  bridePhone?: string;
  groomAccount?: string;
  brideAccount?: string;
  gallery?: { url: string; caption?: string; }[];
  bgmUrl?: string;
  rsvpEnabled?: boolean;
  theme?: "cream" | "white" | "sage" | "rose" | "navy" | "sand" | "slate" | "blush"; // 청첩장 색상 팔레트
  fontStyle?: "serif" | "sans" | "handwriting"; // 이름·D-day 폰트 톤
  // 외국 하객을 위한 추가 언어. 빈 배열/undefined면 한국어만 — 다국어 칩 안 보임.
  enabledLocales?: ("en" | "zh")[];
  translations?: {
    en?: Partial<InvitationContent>;
    zh?: Partial<InvitationContent>;
  };
};

// ── 식전영상 ──────────────────────────────────
export type VideoEffect =
  | "kenBurnsIn"   // 천천히 확대
  | "kenBurnsOut"  // 천천히 축소
  | "panLeft"      // 왼쪽으로 이동
  | "panRight"     // 오른쪽으로 이동
  | "static";      // 고정

export type VideoTransition = "fade" | "slide" | "none";

export type VideoFilter = "none" | "warm" | "cool" | "bw" | "sepia" | "vintage";

export type VideoPhoto = {
  id: string;
  url: string;
  caption?: string;
  durationSec: number;       // 한 장이 보이는 시간 (기본 4)
  effect: VideoEffect;
  transition: VideoTransition;
  filter: VideoFilter;
  actId?: string;            // 어느 act(막)에 속하는지
};

export type VideoAct = {
  id: string;
  title: string;             // "각자의 자리에서"
  subtitle?: string;         // "어린 시절"
};

export type VideoConfig = {
  title?: string;
  /** 어떤 템플릿을 기반으로 만든 영상인지. 사용자가 직접 만들면 undefined. */
  templateId?: string;
  acts: VideoAct[];
  photos: VideoPhoto[];
  bgmUrl?: string;
  ending?: {
    message: string;
    date?: string;
    time?: string;       // "오후 3시"
    venue?: string;      // "그랜드볼룸, 더 채플"
  };
  titleCardSec?: number;     // act 타이틀 카드 길이 (기본 3)
  endingSec?: number;        // 엔딩 길이 (기본 6)
  fps?: number;              // 기본 30
};

export function defaultVideoConfig(): VideoConfig {
  return { acts: [], photos: [], titleCardSec: 3, endingSec: 6, fps: 30 };
}

/** 옛 형태(또는 비어있는) video 데이터를 안전하게 정규화 */
export function normalizeVideo(v: unknown): VideoConfig {
  const o = (v ?? {}) as Partial<VideoConfig>;
  return {
    ...defaultVideoConfig(),
    ...o,
    acts: Array.isArray(o.acts) ? o.acts : [],
    photos: Array.isArray(o.photos) ? o.photos : [],
  };
}

export type Preferences = {
  mode: Mode | null;            // null = 아직 모드 미선택
  locale: "ko" | "en" | "zh";
  isDemo?: boolean;             // true = 예시 데이터로 둘러보는 중
  supabase?: {                  // 모드 2일 때만
    url: string;
    anonKey: string;
    configId?: string;
    rsvpToken?: string;
  };
  lastBackupAt?: string;        // ISO date — 마지막 export 시점
  // aiKey 는 더 이상 여기 저장하지 않음 — 모드 2에선 공개 row 로 새어버리는 위험 때문에
  // lib/security.ts 의 getSecrets()/setSecrets() 가 별도 localStorage 키로 보관함.
  // 이전 버전 호환은 storage.ts 의 migrate() 가 발견 시 secrets 로 옮긴 뒤 제거.
};

// 발행(간편 호스팅) 자격증명. 백업·기기교체 복구를 위해 WeddingData 안에 보관한다.
// 주의: 반드시 top-level — invitation 밑에 두면 get_public_invitation RPC 로 게스트에게
// code·keyRaw 가 새어나간다. keyRaw 는 청첩장 복호화 키이므로 invitation 트리 밖에 둔다.
// (ownerToken 은 여기 두지 않는다 — 마스터 자격증명이라 secrets 저장소에만 보관, 백업 제외.)
export type PublishedInvite = {
  code: string;
  keyRaw: string;
  /** 하객 RSVP 제출 capability. 복호화 키와 분리되어 서버는 청첩장 본문을 읽을 수 없다. */
  rsvpToken?: string;
  publishedAt: string;
};

export type WeddingData = {
  schemaVersion: number;
  preferences: Preferences;
  ai?: {
    starterSummary?: string;
    today?: { title: string; reason?: string; targetPath?: string }[];
    dialogue?: { id: string; question: string; answer: string; answeredAt: string }[];
      updatedAt?: string;
      profile?: {
        priority?: "venue" | "invitation" | "rings" | "trip";
        budgetKRW?: number;
        region?: string;
        onboardedAt?: string;
      };
  };
  invitation: InvitationContent;
  rings: Ring[];
  sdm: SdmVendor[];
  hotels: Hotel[];         // "신혼여행 → 숙소" 탭에서 사용
  flights: Flight[];       // "신혼여행 → 항공" 탭에서 사용
  honeymoon: HoneymoonPlan;
  checklist: ChecklistSection[];
  video: VideoConfig;
  venues?: WeddingVenue[];
  budget?: BudgetItem[];
  guests?: Guest[];
  /**
   * 예상 인원 계산기 — 측·분류별 추정치. 명단(guests)과 함께 reconcile 된다.
   * giftAvg: 분류별 1인 평균 축의금 가정치(사용자 조정 가능, 없으면 기본값).
   */
  headcount?: { estimates: HeadcountEstimate[]; giftAvg?: { category: GuestCategory; krw: number }[] };
  ceremony?: CeremonyStep[];   // 당일 식순 진행표
  /** 발행한 청첩장의 code·keyRaw. 미발행이면 undefined. */
  publish?: PublishedInvite;
};

export function defaultData(): WeddingData {
  return {
    schemaVersion: SCHEMA_VERSION,
    preferences: {
      mode: null,
      locale: "ko",
    },
    ai: {},
    invitation: {
      groomName: "",
      brideName: "",
      date: "",
      venue: "",
      greeting:
        "서로의 가장 좋은 친구가 되어\n같은 방향을 바라보며 걸어가려 합니다.\n귀한 걸음으로 함께해 주시면\n더없는 기쁨으로 간직하겠습니다.",
    },
    rings: [],
    sdm: [],
    hotels: [],
    flights: [],
    honeymoon: { regions: [] },
    checklist: [],
    video: defaultVideoConfig(),
    venues: [],
    budget: [],
    guests: [],
  };
}
