// 전체 데이터 스키마 — 모드 1 / 모드 2 모두 같은 모양으로 직렬화된다.
// 모드 2 (Supabase) 에서는 이 객체 전체를 `wedding_data` 테이블의 `data` JSON 컬럼에 저장.

export const SCHEMA_VERSION = 1;

export type Mode = "local" | "supabase" | "devOnly";

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
  notes?: string;
  starredBy?: ("groom" | "bride")[];   // ★ 즐겨찾기
  likedBy?: ("groom" | "bride")[];     // ♥ 좋아요
  link?: string;
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

// 스드메 — 스튜디오 / 드레스 / 메이크업
export type SdmCategory = "studio" | "dress" | "makeup";

export type SdmVendor = {
  id: string;
  category: SdmCategory;
  name: string;
  priceRange?: string;
  region?: string;
  notes?: string;
  link?: string;
  status?: "관심" | "상담" | "계약";
};

export type CheckItem = {
  id: string;
  text: string;
  done: boolean;
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
  theme?: "cream" | "white" | "sage"; // 청첩장 톤
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
  acts: VideoAct[];
  photos: VideoPhoto[];
  bgmUrl?: string;
  ending?: {
    message: string;
    date?: string;
  };
  titleCardSec?: number;     // act 타이틀 카드 길이 (기본 3)
  endingSec?: number;        // 엔딩 길이 (기본 5)
  fps?: number;              // 기본 30
};

export function defaultVideoConfig(): VideoConfig {
  return { acts: [], photos: [], titleCardSec: 3, endingSec: 5, fps: 30 };
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
  aiKey?: string;               // 선택, 본인 키 입력 시
  supabase?: {                  // 모드 2일 때만
    url: string;
    anonKey: string;
    configId?: string;
  };
  lastBackupAt?: string;        // ISO date — 마지막 export 시점
};

export type WeddingData = {
  schemaVersion: number;
  preferences: Preferences;
  invitation: InvitationContent;
  rings: Ring[];
  sdm: SdmVendor[];
  hotels: Hotel[];         // "신혼여행 → 숙소" 탭에서 사용
  flights: Flight[];       // "신혼여행 → 항공" 탭에서 사용
  honeymoon: HoneymoonPlan;
  checklist: ChecklistSection[];
  video: VideoConfig;
};

export function defaultData(): WeddingData {
  return {
    schemaVersion: SCHEMA_VERSION,
    preferences: {
      mode: null,
      locale: "ko",
    },
    invitation: {
      groomName: "",
      brideName: "",
      date: "",
      venue: "",
      greeting:
        "두 사람이 사랑으로 만나 하나가 되는 약속의 자리에 \n귀한 걸음으로 축복해 주시면 감사하겠습니다.",
    },
    rings: [],
    sdm: [],
    hotels: [],
    flights: [],
    honeymoon: { regions: [] },
    checklist: [],
    video: defaultVideoConfig(),
  };
}
