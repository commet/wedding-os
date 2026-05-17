import type { Ring } from "../lib/schema";

let n = 0;
const id = () => `ring-${++n}`;
const catalogLastVerified: string | undefined = undefined;

// 카탈로그는 사용자가 "내 후보로 가져오기" 누르면 자기 데이터로 복사됨.
// 가격은 상담 전 감을 잡는 추정치 — 사용자가 "지금 확인"으로 갱신해야 검증일을 표시함.
export const RING_CATALOG: Ring[] = [
  { id: id(), brand: "티파니", model: "투게더 4mm", material: "플래티넘", priceKRW: 1850000, hasDiamond: false, lastVerified: catalogLastVerified, source: "공식 매장 추정" },
  { id: id(), brand: "티파니", model: "T", material: "옐로우골드", priceKRW: 1450000, hasDiamond: false, lastVerified: catalogLastVerified },
  { id: id(), brand: "티파니", model: "포에버 2mm", material: "플래티넘", priceKRW: 1380000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "까르띠에", model: "1895 2.6mm", material: "플래티넘", priceKRW: 2050000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "까르띠에", model: "C 드 까르띠에 3mm", material: "플래티넘", priceKRW: 1980000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "까르띠에", model: "Love", material: "화이트골드", priceKRW: 1750000, hasDiamond: false, lastVerified: catalogLastVerified },
  { id: id(), brand: "까르띠에", model: "다무르 3.5mm", material: "플래티넘", priceKRW: 1620000, lastVerified: catalogLastVerified },
  { id: id(), brand: "샤넬", model: "COCO Crush", material: "옐로우골드", priceKRW: 3200000, lastVerified: catalogLastVerified },
  { id: id(), brand: "샤넬", model: "Camellia", material: "화이트골드", priceKRW: 2400000, lastVerified: catalogLastVerified },
  { id: id(), brand: "불가리", model: "로마 아모르", material: "화이트골드", priceKRW: 1980000, lastVerified: catalogLastVerified },
  { id: id(), brand: "불가리", model: "인피니토", material: "플래티넘", priceKRW: 2350000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "부쉐론", model: "퐁 드 파리", material: "플래티넘", priceKRW: 2280000, lastVerified: catalogLastVerified },
  { id: id(), brand: "부쉐론", model: "에퓨어", material: "플래티넘", priceKRW: 1850000, lastVerified: catalogLastVerified },
  { id: id(), brand: "부쉐론", model: "콰트로 블랙", material: "화이트골드", priceKRW: 3840000, lastVerified: catalogLastVerified },
  { id: id(), brand: "쇼메", model: "비 드 쇼메 2.5mm", material: "플래티넘", priceKRW: 1650000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "쇼메", model: "비 드 쇼메 4mm", material: "플래티넘", priceKRW: 2150000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "피아제", model: "Possession", material: "로즈골드", priceKRW: 2780000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "피아제", model: "Limelight", material: "로즈골드", priceKRW: 3120000, lastVerified: catalogLastVerified },
  { id: id(), brand: "반 클리프 아펠", model: "땅드레망 에또왈", material: "로즈골드", priceKRW: 2680000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "반 클리프 아펠", model: "뚜쥬르 에또왈", material: "플래티넘", priceKRW: 2980000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "드 비어스", model: "DB Classic", material: "플래티넘", priceKRW: 2150000, lastVerified: catalogLastVerified },
  { id: id(), brand: "드 비어스", model: "Promise", material: "화이트골드", priceKRW: 1850000, lastVerified: catalogLastVerified },
  { id: id(), brand: "드 비어스", model: "Channel", material: "화이트골드", priceKRW: 1950000, lastVerified: catalogLastVerified },
  { id: id(), brand: "드 비어스", model: "Infinity", material: "로즈골드", priceKRW: 2280000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "드 비어스", model: "Petal", material: "로즈골드", priceKRW: 2380000, lastVerified: catalogLastVerified },

  // ─── 국내 백화점 · 유통 브랜드 ─────────────────────────────────
  // 백화점·아웃렛에서 쉽게 접할 수 있는 한국 브랜드. 명품 대비 합리적 가격대.
  { id: id(), brand: "갤러리아 (Galleria)", model: "심플 커브드 밴드", material: "화이트골드", priceKRW: 850000, lastVerified: catalogLastVerified, source: "백화점 추정" },
  { id: id(), brand: "갤러리아 (Galleria)", model: "투톤 밴드", material: "옐로우골드", priceKRW: 980000, lastVerified: catalogLastVerified },
  { id: id(), brand: "로이드 (Lloyd)", model: "심플 라인 밴드", material: "화이트골드", priceKRW: 580000, lastVerified: catalogLastVerified, source: "백화점 추정" },
  { id: id(), brand: "로이드 (Lloyd)", model: "트위스트 밴드", material: "로즈골드", priceKRW: 720000, lastVerified: catalogLastVerified },
  { id: id(), brand: "스타일링 (Styling)", model: "베이직 솔리테어", material: "화이트골드", priceKRW: 1280000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "스타일링 (Styling)", model: "심플 페어", material: "플래티넘", priceKRW: 980000, lastVerified: catalogLastVerified },
  { id: id(), brand: "디디에두보 (Didier Dubot)", model: "엘레강스 라인", material: "로즈골드", priceKRW: 1450000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "디디에두보 (Didier Dubot)", model: "센터 다이아", material: "화이트골드", priceKRW: 1850000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "제이에스티나 (J.Estina)", model: "Bridal Classic", material: "화이트골드", priceKRW: 620000, lastVerified: catalogLastVerified },
  { id: id(), brand: "제이에스티나 (J.Estina)", model: "Bridal Crown", material: "옐로우골드", priceKRW: 780000, hasDiamond: true, lastVerified: catalogLastVerified },
  { id: id(), brand: "트리플다이아 (Triple Diamond)", model: "센터 0.3ct 솔리테어", material: "플래티넘", priceKRW: 2200000, hasDiamond: true, lastVerified: catalogLastVerified, source: "다이아 직판 추정" },
  { id: id(), brand: "트리플다이아 (Triple Diamond)", model: "심플 페어 밴드", material: "화이트골드", priceKRW: 780000, lastVerified: catalogLastVerified },
  { id: id(), brand: "제랑드 (Gerang)", model: "심플 페어", material: "플래티넘", priceKRW: 690000, lastVerified: catalogLastVerified, source: "종로 직판 추정" },
  { id: id(), brand: "제랑드 (Gerang)", model: "센터 0.2ct", material: "화이트골드", priceKRW: 1480000, hasDiamond: true, lastVerified: catalogLastVerified },
];
