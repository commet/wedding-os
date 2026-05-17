// 결혼 비용 카테고리 + 한국 평균치.
//
// ⚠️ 평균 비용은 듀오웨드 결혼 비용 보고서·한국소비자원·통계청 신혼부부 통계 등
//   공개 자료의 일반적 범위를 기준으로 한 "참고치"입니다. 개인 상황·지역·시즌에 따라 크게 달라요.
//   본 도구는 어떤 업체와도 제휴 관계 없음 — 객관적 가이드 목적.

import type { BudgetItem } from "../lib/schema";

export type BudgetGroup = {
  key: string;
  title: string;
  items: { category: string; avgKRW: number; notes?: string }[];
};

export const BUDGET_TEMPLATE: BudgetGroup[] = [
  {
    key: "venue",
    title: "예식장",
    items: [
      { category: "예식장 대관·홀비", avgKRW: 3_000_000, notes: "보증인원 외 별도 항목인 경우" },
      { category: "예식장 식대", avgKRW: 18_000_000, notes: "9만원 × 200명 기준 (호텔은 13~20만원)" },
    ],
  },
  {
    key: "sdm",
    title: "스드메 · 스냅",
    items: [
      { category: "스튜디오 (촬영)", avgKRW: 1_500_000 },
      { category: "드레스 (본식·촬영·2부)", avgKRW: 2_800_000 },
      { category: "메이크업 (리허설+본식)", avgKRW: 1_200_000 },
      { category: "본식 스냅", avgKRW: 1_200_000 },
      { category: "본식 영상 (DVD)", avgKRW: 800_000, notes: "선택 — 안 하는 커플도 많음" },
    ],
  },
  {
    key: "jewelry",
    title: "예물 · 반지",
    items: [
      { category: "결혼반지 (커플)", avgKRW: 4_000_000, notes: "브랜드별 100~500만원" },
      { category: "예물 (목걸이·귀걸이 등)", avgKRW: 3_000_000, notes: "간소화 추세 — 안 하는 커플도 많음" },
    ],
  },
  {
    key: "tradition",
    title: "예단 · 함 · 이바지",
    items: [
      { category: "예단", avgKRW: 5_000_000, notes: "전통: 신부→신랑댁 (현금예단 형태도 많음)" },
      { category: "함 (봉채)", avgKRW: 1_000_000, notes: "최근 생략하는 커플 많아짐" },
      { category: "이바지 / 폐백 음식", avgKRW: 500_000 },
      { category: "혼주 한복·정장", avgKRW: 1_500_000 },
    ],
  },
  {
    key: "invitation",
    title: "청첩장 · 답례품",
    items: [
      { category: "종이 청첩장", avgKRW: 500_000, notes: "200장 기준" },
      { category: "모바일 청첩장 (유료)", avgKRW: 100_000, notes: "직접 만들면 0원" },
      { category: "답례품 (식권·소품)", avgKRW: 1_500_000, notes: "1만원 × 150~200개" },
      { category: "부케 · 화환", avgKRW: 300_000 },
    ],
  },
  {
    key: "honeymoon",
    title: "신혼여행",
    items: [
      { category: "항공권 (2인)", avgKRW: 3_000_000, notes: "동남아 ~ 유럽까지 범위 큼" },
      { category: "숙소 (5~7박)", avgKRW: 3_000_000 },
      { category: "현지 경비 (식비·투어·쇼핑)", avgKRW: 2_000_000 },
      { category: "여행자보험·환전 수수료", avgKRW: 200_000 },
    ],
  },
  {
    key: "newhome",
    title: "신혼집 (별도 큰 비용)",
    items: [
      { category: "가전 (TV·세탁기·냉장고·에어컨 등)", avgKRW: 15_000_000 },
      { category: "가구 (침대·소파·식탁·옷장)", avgKRW: 8_000_000 },
      { category: "주방·생활용품", avgKRW: 2_000_000 },
      { category: "이사·인테리어", avgKRW: 3_000_000 },
    ],
  },
  {
    key: "etc",
    title: "기타",
    items: [
      { category: "사회자·축가 사례", avgKRW: 500_000 },
      { category: "본식 후 2차 모임", avgKRW: 1_000_000 },
      { category: "예비비 (예상 외 지출)", avgKRW: 2_000_000, notes: "총 비용의 5~10%" },
    ],
  },
];

let n = 0;
const id = () => `budget-${++n}-${Math.random().toString(36).slice(2, 6)}`;

export function defaultBudget(): BudgetItem[] {
  const out: BudgetItem[] = [];
  for (const g of BUDGET_TEMPLATE) {
    for (const it of g.items) {
      out.push({
        id: id(),
        category: `[${g.title}] ${it.category}`,
        avgKRW: it.avgKRW,
        notes: it.notes,
      });
    }
  }
  return out;
}

export const BUDGET_TOTAL_NOTE =
  "💡 한국 평균 결혼 비용은 약 3억 (신혼집 포함, 듀오웨드 2024 조사 기준). " +
  "이 중 결혼식 자체는 5천만~1억, 신혼집이 1.5억~2.5억 수준이에요. 우리만의 우선순위를 정하면 절반으로 줄일 수도, 더 늘릴 수도.";
