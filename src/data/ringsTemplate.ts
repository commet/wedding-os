import type { Ring } from "../lib/schema";
import { ringOptions } from "./ringsLegacy";

const catalogLastVerified: string | undefined = undefined;
const ringImageUrl = (filename: string) => `/rings/${filename}`;

export const RING_CATALOG: Ring[] = ringOptions
  .filter((option) => option.images?.length)
  .map((option) => {
    const imageUrls = option.images?.map(ringImageUrl) ?? [];
    return {
      id: `ring-${option.id}`,
      brand: normalizeBrand(option.brand),
      model: option.name,
      material: normalizeMaterial(option.material),
      priceKRW: parsePriceKRW(option.priceSet),
      hasDiamond: hasDiamond(option),
      imageUrl: imageUrls[0],
      imageUrls,
      imageFit: option.imgFit ?? "contain",
      notes: [option.note, option.priceSet ? `가격표기: ${option.priceSet}` : undefined].filter(Boolean).join("\n") || undefined,
      link: option.link,
      source: "mayrriage 이미지 카탈로그",
      lastVerified: catalogLastVerified,
    };
  });

function normalizeBrand(brand: string): string {
  const map: Record<string, string> = {
    "Tiffany & Co.": "티파니",
    Cartier: "까르띠에",
    Chaumet: "쇼메",
    Chanel: "샤넬",
    Bvlgari: "불가리",
    "Van Cleef & Arpels": "반 클리프 아펠",
    "De Beers": "드 비어스",
    Tasaki: "타사키",
    Boucheron: "부쉐론",
    Piaget: "피아제",
    Chopard: "쇼파드",
  };
  return map[brand] ?? brand;
}

function normalizeMaterial(material: string): string | undefined {
  if (/PT|플래티/i.test(material)) return "플래티넘";
  if (/WG|화이트/i.test(material)) return "화이트골드";
  if (/RG|PG|로즈|핑크|사쿠라/i.test(material)) return "로즈골드";
  if (/YG|옐로|골드/i.test(material)) return "옐로우골드";
  return material || undefined;
}

function hasDiamond(option: { name: string; note?: string; images?: string[] }): boolean {
  return /DI|다이아|이터니티|Pav[eé]|파베|diamond/i.test(`${option.name} ${option.note ?? ""} ${option.images?.join(" ") ?? ""}`);
}

function parsePriceKRW(priceSet: string): number | undefined {
  const clean = priceSet.replace(/,/g, "");
  const man = clean.match(/(\d+(?:\.\d+)?)\s*(?:~|-)?\s*\d*(?:\.\d+)?\s*만/);
  if (man) return Math.round(Number(man[1]) * 10_000);

  const won = clean.match(/₩\s*(\d{5,})/);
  if (won) return Number(won[1]);

  return undefined;
}
