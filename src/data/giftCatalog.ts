// 답례품 카탈로그 — 가격대별 표준 카테고리.
//
// ⚠️ 알림:
//   - 결혼식 답례품은 식대 외에 하객 인당 1만~5만원대로 준비하는 게 일반적.
//   - 1만원대(소품) / 3만원대(식품 박스) / 5만원대(고급) 가 주요 구간.
//   - 어느 업체와도 제휴 관계 없음 — 한국에서 결혼식 답례품으로 자주 쓰는 카테고리만 정리.
//   - 표시 삭제·정정 요청은 yclee913@gmail.com.

export type GiftTier = "low" | "mid" | "high";

export const GIFT_TIER_LABEL: Record<GiftTier, { range: string; ideal: string }> = {
  low:  { range: "1만원대 (8천~1.5만)",  ideal: "200명 이상 대규모 · 부담 적게" },
  mid:  { range: "3만원대 (2~4만)",      ideal: "중규모 · 친한 가족·친구 중심" },
  high: { range: "5만원대 이상 (4만+)",  ideal: "소규모 · 가까운 분들만" },
};

export type GiftIdea = {
  category: string;
  tier: GiftTier;
  examples: string[];
  pros: string;
  cons: string;
};

export const GIFT_IDEAS: GiftIdea[] = [
  // ─── 1만원대 ───
  {
    category: "한과·답례떡",
    tier: "low",
    examples: ["답례떡 (8~12pcs)", "한과세트", "약과·강정"],
    pros: "한국적 / 어르신 하객에 호평 / 대량 주문 쉬움",
    cons: "유통기한 짧음 / 본식 당일 보관 동선",
  },
  {
    category: "비누·향 소품",
    tier: "low",
    examples: ["디퓨저 미니", "수제비누 2~3pc", "캔들 미니"],
    pros: "보관 부담 X / 인테리어 소품으로 활용",
    cons: "취향 갈림 / 어르신에겐 덜 실용적",
  },
  {
    category: "커피·차 세트",
    tier: "low",
    examples: ["드립커피 백 세트", "티백 어소트", "꿀스틱"],
    pros: "남녀노소 무난 / 가볍고 휴대 편함",
    cons: "차별성 적음",
  },

  // ─── 3만원대 ───
  {
    category: "호텔·디저트 박스",
    tier: "mid",
    examples: ["호텔 피낭시에·마들렌 세트", "수제 마카롱 박스", "초콜릿 어소트"],
    pros: "포장이 고급스러움 / 사진 좋음",
    cons: "유통기한 짧음 / 더운 계절 보관 주의",
  },
  {
    category: "오일·잼·꿀",
    tier: "mid",
    examples: ["프리미엄 올리브오일", "수제잼 2pc", "프리미엄 꿀병"],
    pros: "고급감 / 실용성 좋음",
    cons: "무거움 / 종이 가방 찢어질 수 있음",
  },
  {
    category: "수건·홈 소품",
    tier: "mid",
    examples: ["고급 수건 세트", "프리미엄 행주·앞치마", "도자기 머그"],
    pros: "실용 / 오래 사용",
    cons: "취향·디자인 갈림",
  },

  // ─── 5만원대 ───
  {
    category: "프리미엄 식품 박스",
    tier: "high",
    examples: ["한우 가공식품", "프리미엄 김 세트", "굴비·곶감 등"],
    pros: "고급 / 가족 단위 하객에 호평",
    cons: "단가 부담 — 인원 적을 때만 권장",
  },
  {
    category: "백화점 상품권",
    tier: "high",
    examples: ["신세계·롯데·현대 상품권 5만원권"],
    pros: "100% 실용 / 취향 무관",
    cons: "성의 없어 보일 수 있음 / 어르신엔 부적합",
  },
  {
    category: "수제 가죽·라이프스타일",
    tier: "high",
    examples: ["가죽 키링", "에코백·텀블러", "프리미엄 노트"],
    pros: "특별함 / 오래 기억됨",
    cons: "취향 매우 갈림",
  },
];

export const GIFT_TIP =
  "💡 하객 수가 200명 이상이면 1만원대로 통일, 100명 이하면 3만원대도 무난. " +
  "양가 분위기가 달라 신랑·신부 측 답례품을 다르게 가는 커플도 많아요.";
