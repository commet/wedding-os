// 식전영상 템플릿 — "빈 캔버스" 문제를 없애기 위해 8가지 시나리오를 미리 짜둔다.
// pastelwediter 같은 서비스가 잘 되는 핵심은 "결정 피로 제거": 사용자는 채우기만 하면 된다.
//
// 각 템플릿은:
// - 권장 챕터(막) 구성 + 챕터별 사진 수
// - 기본 효과/필터/전환/사진 길이
// - 총 길이와 BGM 무드 가이드
// 를 제공한다. 사용자는 "이 템플릿으로 시작" 버튼 한 번 누른 뒤 사진만 채우면 된다.

import type { VideoEffect, VideoFilter, VideoTransition } from "../lib/schema";

export type TemplateChapter = {
  /** 챕터 제목, 예: "신랑" */
  title: string;
  /** 챕터 부제 (영문 보통), 예: "GROOM" */
  subtitle?: string;
  /** 이 챕터에 권장되는 사진 수 */
  photoCount: number;
};

export type VideoTemplate = {
  id: string;
  name: string;
  /** 카드 한 줄 요약 */
  tagline: string;
  /** 분위기 라벨, 예: "시네마틱", "모던" */
  mood: string;
  emoji: string;
  /** 카드 미리보기에서 쓰는 액센트 색 (hex) */
  themeColor: string;
  /** 권장 총 길이(초) — 타이틀·엔딩 카드 포함 */
  totalDurationSec: number;
  /** 권장 사진 수 (이상값, 최소값) */
  photoCountTotal: { ideal: number; min: number };
  /** 추천 BGM 무드 — 사용자가 직접 골라 mp3 URL 넣음 */
  bgmHint: string;
  /** 새 사진이 추가될 때 자동으로 붙는 기본 효과 묶음 */
  defaults: {
    filter: VideoFilter;
    transition: VideoTransition;
    effect: VideoEffect;
    photoDurationSec: number;
  };
  /** 챕터 구성. 빈 배열이면 막 없이 사진이 흐른다. */
  chapters: TemplateChapter[];
};

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: "classic",
    name: "클래식 정통",
    tagline: "신랑 · 신부 · 함께 — 가장 무난한 3막 구성",
    mood: "전통적",
    emoji: "🎼",
    themeColor: "#c4a373",
    totalDurationSec: 240,
    photoCountTotal: { ideal: 36, min: 24 },
    bgmHint: "잔잔한 피아노·어쿠스틱 발라드 (공연·영상 사용 가능한 음원)",
    defaults: {
      filter: "warm",
      transition: "fade",
      effect: "kenBurnsIn",
      photoDurationSec: 4,
    },
    chapters: [
      { title: "신랑", subtitle: "GROOM", photoCount: 10 },
      { title: "신부", subtitle: "BRIDE", photoCount: 10 },
      { title: "우리", subtitle: "TOGETHER", photoCount: 16 },
    ],
  },
  {
    id: "cinematic",
    name: "시네마틱 여정",
    tagline: "어린 시절부터 오늘까지 — 6막 풀스토리",
    mood: "시네마틱",
    emoji: "🎬",
    themeColor: "#1a1510",
    totalDurationSec: 300,
    photoCountTotal: { ideal: 50, min: 36 },
    bgmHint: "시네마틱 피아노·스트링 인스트루멘탈 (라이선스 확인 필수)",
    defaults: {
      filter: "none",
      transition: "fade",
      effect: "kenBurnsIn",
      photoDurationSec: 4,
    },
    chapters: [
      { title: "그가 자라온 길", subtitle: "HIS CHILDHOOD", photoCount: 6 },
      { title: "그녀가 자라온 길", subtitle: "HER CHILDHOOD", photoCount: 6 },
      { title: "첫 만남", subtitle: "FIRST ENCOUNTER", photoCount: 6 },
      { title: "함께한 시간", subtitle: "OUR DAYS", photoCount: 14 },
      { title: "프로포즈", subtitle: "THE PROPOSAL", photoCount: 6 },
      { title: "오늘 우리", subtitle: "TODAY", photoCount: 12 },
    ],
  },
  {
    id: "netflix",
    name: "넷플릭스 시리즈",
    tagline: "EPISODE 1-4 — 큰 타이포로 시리즈처럼",
    mood: "모던",
    emoji: "🎞️",
    themeColor: "#222222",
    totalDurationSec: 210,
    photoCountTotal: { ideal: 32, min: 24 },
    bgmHint: "시네마틱 인스트루멘탈 · 모던 클래식 (상업/공개 재생 가능 음원)",
    defaults: {
      filter: "bw",
      transition: "fade",
      effect: "static",
      photoDurationSec: 3,
    },
    chapters: [
      { title: "EPISODE 1", subtitle: "그가 자라온 길", photoCount: 6 },
      { title: "EPISODE 2", subtitle: "그녀가 자라온 길", photoCount: 6 },
      { title: "EPISODE 3", subtitle: "두 사람이 만나다", photoCount: 10 },
      { title: "FINALE", subtitle: "그리고 오늘", photoCount: 10 },
    ],
  },
  {
    id: "vintage",
    name: "빈티지 로맨스",
    tagline: "세피아 톤 · 추억의 앨범 느낌",
    mood: "감성적",
    emoji: "📜",
    themeColor: "#a88848",
    totalDurationSec: 240,
    photoCountTotal: { ideal: 36, min: 28 },
    bgmHint: "재즈 · 어쿠스틱 발라드 · 레트로 무드 (저작권 사용 범위 확인)",
    defaults: {
      filter: "sepia",
      transition: "slide",
      effect: "kenBurnsOut",
      photoDurationSec: 4.5,
    },
    chapters: [
      { title: "추억", subtitle: "MEMORIES", photoCount: 12 },
      { title: "사랑", subtitle: "OUR STORY", photoCount: 12 },
      { title: "오늘", subtitle: "TODAY", photoCount: 12 },
    ],
  },
  {
    id: "simple-flow",
    name: "심플 플로우",
    tagline: "막 없이 음악과 함께 자연스럽게",
    mood: "심플",
    emoji: "🌿",
    themeColor: "#a8b89a",
    totalDurationSec: 150,
    photoCountTotal: { ideal: 25, min: 18 },
    bgmHint: "잔잔한 어쿠스틱 · 피아노 솔로 (무료/유료 라이선스 확인)",
    defaults: {
      filter: "none",
      transition: "fade",
      effect: "kenBurnsIn",
      photoDurationSec: 4,
    },
    chapters: [],
  },
  {
    id: "family-album",
    name: "양가 가족 앨범",
    tagline: "부모님 · 형제자매까지 — 따뜻한 5막",
    mood: "따뜻함",
    emoji: "👨‍👩‍👧‍👦",
    totalDurationSec: 300,
    themeColor: "#d4a373",
    photoCountTotal: { ideal: 50, min: 40 },
    bgmHint: "감동적인 발라드 · 부모님께 전하는 무드 (공연장 재생 가능 여부 확인)",
    defaults: {
      filter: "warm",
      transition: "fade",
      effect: "kenBurnsIn",
      photoDurationSec: 4,
    },
    chapters: [
      { title: "신랑네", subtitle: "GROOM'S FAMILY", photoCount: 10 },
      { title: "신부네", subtitle: "BRIDE'S FAMILY", photoCount: 10 },
      { title: "두 사람", subtitle: "THE COUPLE", photoCount: 12 },
      { title: "가족이 되어", subtitle: "BECOMING FAMILY", photoCount: 10 },
      { title: "오늘 우리", subtitle: "TODAY", photoCount: 8 },
    ],
  },
  {
    id: "proposal",
    name: "프로포즈 스토리",
    tagline: "내가 본 너 · 네가 본 나 · 그리고 우리",
    mood: "로맨틱",
    emoji: "💍",
    themeColor: "#c97c5d",
    totalDurationSec: 240,
    photoCountTotal: { ideal: 40, min: 28 },
    bgmHint: "달콤한 발라드 · 영화 같은 사랑 테마 (라이선스 확인)",
    defaults: {
      filter: "cool",
      transition: "fade",
      effect: "kenBurnsIn",
      photoDurationSec: 4,
    },
    chapters: [
      { title: "내가 본 너", subtitle: "HER THROUGH MY EYES", photoCount: 10 },
      { title: "네가 본 나", subtitle: "HIM THROUGH HER EYES", photoCount: 10 },
      { title: "프로포즈", subtitle: "THE MOMENT", photoCount: 8 },
      { title: "그리고 우리", subtitle: "AND US", photoCount: 12 },
    ],
  },
  {
    id: "short-reel",
    name: "숏폼 (1분 30초)",
    tagline: "빠른 컷 — 결혼식 후 인스타 공유용",
    mood: "에너지",
    emoji: "⚡",
    themeColor: "#e07a5f",
    totalDurationSec: 90,
    photoCountTotal: { ideal: 18, min: 12 },
    bgmHint: "업비트 팝 · 미디엄 템포 발라드 (SNS 공개 가능 음원)",
    defaults: {
      filter: "none",
      transition: "fade",
      effect: "kenBurnsIn",
      photoDurationSec: 2.5,
    },
    chapters: [],
  },
];

export function findTemplate(id: string | undefined): VideoTemplate | undefined {
  if (!id) return undefined;
  return VIDEO_TEMPLATES.find((t) => t.id === id);
}

/** mm:ss 포맷 — "3분 24초" */
export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
}
