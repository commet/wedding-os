import type { Ring } from "../lib/schema";

let n = 0;
const id = () => `ring-${++n}`;
const today = new Date().toISOString().split("T")[0];

// 카탈로그는 사용자가 "내 후보로 가져오기" 누르면 자기 데이터로 복사됨.
// 가격은 2026.05 기준 추정치 — 사용자는 "지금 확인"으로 갱신해야 함.
export const RING_CATALOG: Ring[] = [
  { id: id(), brand: "티파니", model: "투게더 4mm", material: "플래티넘", priceKRW: 1850000, hasDiamond: false, lastVerified: today, source: "공식 매장 추정" },
  { id: id(), brand: "티파니", model: "T", material: "옐로우골드", priceKRW: 1450000, hasDiamond: false, lastVerified: today },
  { id: id(), brand: "티파니", model: "포에버 2mm", material: "플래티넘", priceKRW: 1380000, hasDiamond: true, lastVerified: today },
  { id: id(), brand: "까르띠에", model: "1895 2.6mm", material: "플래티넘", priceKRW: 2050000, hasDiamond: true, lastVerified: today },
  { id: id(), brand: "까르띠에", model: "C 드 까르띠에 3mm", material: "플래티넘", priceKRW: 1980000, hasDiamond: true, lastVerified: today },
  { id: id(), brand: "까르띠에", model: "Love", material: "화이트골드", priceKRW: 1750000, hasDiamond: false, lastVerified: today },
  { id: id(), brand: "까르띠에", model: "다무르 3.5mm", material: "플래티넘", priceKRW: 1620000, lastVerified: today },
  { id: id(), brand: "샤넬", model: "COCO Crush", material: "옐로우골드", priceKRW: 3200000, lastVerified: today },
  { id: id(), brand: "샤넬", model: "Camellia", material: "화이트골드", priceKRW: 2400000, lastVerified: today },
  { id: id(), brand: "불가리", model: "로마 아모르", material: "화이트골드", priceKRW: 1980000, lastVerified: today },
  { id: id(), brand: "불가리", model: "인피니토", material: "플래티넘", priceKRW: 2350000, hasDiamond: true, lastVerified: today },
  { id: id(), brand: "부쉐론", model: "퐁 드 파리", material: "플래티넘", priceKRW: 2280000, lastVerified: today },
  { id: id(), brand: "부쉐론", model: "에퓨어", material: "플래티넘", priceKRW: 1850000, lastVerified: today },
  { id: id(), brand: "부쉐론", model: "콰트로 블랙", material: "화이트골드", priceKRW: 3840000, lastVerified: today },
  { id: id(), brand: "쇼메", model: "비 드 쇼메 2.5mm", material: "플래티넘", priceKRW: 1650000, hasDiamond: true, lastVerified: today },
  { id: id(), brand: "쇼메", model: "비 드 쇼메 4mm", material: "플래티넘", priceKRW: 2150000, hasDiamond: true, lastVerified: today },
  { id: id(), brand: "피아제", model: "Possession", material: "로즈골드", priceKRW: 2780000, hasDiamond: true, lastVerified: today },
  { id: id(), brand: "피아제", model: "Limelight", material: "로즈골드", priceKRW: 3120000, lastVerified: today },
  { id: id(), brand: "반 클리프 아펠", model: "땅드레망 에또왈", material: "로즈골드", priceKRW: 2680000, hasDiamond: true, lastVerified: today },
  { id: id(), brand: "반 클리프 아펠", model: "뚜쥬르 에또왈", material: "플래티넘", priceKRW: 2980000, hasDiamond: true, lastVerified: today },
  { id: id(), brand: "드 비어스", model: "DB Classic", material: "플래티넘", priceKRW: 2150000, lastVerified: today },
  { id: id(), brand: "드 비어스", model: "Promise", material: "화이트골드", priceKRW: 1850000, lastVerified: today },
  { id: id(), brand: "드 비어스", model: "Channel", material: "화이트골드", priceKRW: 1950000, lastVerified: today },
  { id: id(), brand: "드 비어스", model: "Infinity", material: "로즈골드", priceKRW: 2280000, hasDiamond: true, lastVerified: today },
  { id: id(), brand: "드 비어스", model: "Petal", material: "로즈골드", priceKRW: 2380000, lastVerified: today },
];
