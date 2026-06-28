// 결혼 비용 카테고리 + 참고 기준값.
//
// ⚠️ 평균 비용은 공개 자료와 일반 견적 범위를 섞은 "참고치"입니다.
//   개인 상황·지역·시즌·보증인원·계약 조건에 따라 크게 달라요.
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
      { category: "예식장 식대", avgKRW: 18_000_000, notes: "9만원 × 200명 기준. 지역·시즌·요일에 따라 크게 달라짐" },
      { category: "부가세·봉사료·음주류", avgKRW: 1_500_000, notes: "견적서에 포함/별도 여부 확인" },
      { category: "주차·셔틀·버스", avgKRW: 500_000, notes: "지방 하객·혼주 이동이 있으면 별도 확인" },
      { category: "폐백실·혼주대기실 등 부대비", avgKRW: 500_000 },
      { category: "외부업체 반입료", avgKRW: 500_000, notes: "스냅·영상·사회자·플라워·답례품 반입 가능 여부와 함께 확인" },
      { category: "메뉴 업그레이드·음주류 추가", avgKRW: 800_000, notes: "시식 후 변경 시 1인 단가가 달라질 수 있음" },
      { category: "계약금·취소 위약금", avgKRW: 0, notes: "비용보다 조건 확인용 항목" },
    ],
  },
  {
    key: "sdm",
    title: "스드메",
    items: [
      { category: "스튜디오 (촬영)", avgKRW: 1_500_000 },
      { category: "드레스 (본식·촬영·2부)", avgKRW: 2_800_000 },
      { category: "메이크업 (리허설+본식)", avgKRW: 1_200_000 },
      { category: "원본·보정본 추가 비용", avgKRW: 300_000, notes: "앨범·액자·원본 구매 조건 확인" },
      { category: "스드메 추가금·출장비", avgKRW: 500_000, notes: "헬퍼비·피팅비·얼리/야간·지역 이동비 확인" },
    ],
  },
  {
    key: "snap",
    title: "본식 스냅 · 영상",
    items: [
      { category: "본식 스냅", avgKRW: 1_200_000, notes: "스튜디오 촬영과 별도" },
      { category: "본식 영상 (DVD)", avgKRW: 800_000, notes: "선택 — 안 하는 커플도 많음" },
      { category: "원판·가족사진 앨범 추가", avgKRW: 400_000 },
      { category: "2인 촬영·대표 지정 추가금", avgKRW: 500_000 },
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
      { category: "혼주 헤어·메이크업", avgKRW: 500_000 },
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
      { category: "우편 발송·봉투·스티커", avgKRW: 100_000 },
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
      { category: "공항 이동·로밍·유심", avgKRW: 300_000 },
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
      { category: "주례·사회자·축가 식사/교통", avgKRW: 300_000 },
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
  "참고 금액은 실제 견적을 넣기 전 감을 잡기 위한 기준값입니다. " +
  "신혼집 포함 여부, 지역, 시즌, 보증인원, 부모님 지원 범위에 따라 총액이 크게 달라지므로 " +
  "예식장·스드메·신혼여행·신혼집을 따로 나눠 보는 것을 권장합니다.";
