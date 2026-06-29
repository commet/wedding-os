import type {
  ContractCheck,
  SdmVendor,
  VenueFoodType,
  VenueHallType,
  WeddingVenue,
} from "./schema";
import { todayISO } from "./freshness";

export type VenueResearchDraft = {
  source?: string;
  lastVerified?: string;
  region?: string;
  hallType?: VenueHallType;
  foodType?: VenueFoodType;
  capacityMin?: number;
  capacityMax?: number;
  mealPriceMin?: number;
  mealPriceMax?: number;
  contact?: string;
  notes?: string;
  quote?: string;
  payment?: string;
  cancellation?: string;
  included?: string;
  extras?: string;
  evidence?: string;
};

export type SdmResearchDraft = {
  source?: string;
  lastVerified?: string;
  priceRange?: string;
  contact?: string;
  notes?: string;
  quote?: string;
  payment?: string;
  cancellation?: string;
  included?: string;
  extras?: string;
  evidence?: string;
};

type Range = { min?: number; max?: number };

const URL_RE = /https?:\/\/[^\s"'<>]+/i;
const PHONE_RE = /(?:010|02|0[3-6]\d|070|0507)[-\s.)]?\d{3,4}[-\s.]?\d{4}/;

export function emptyVenueResearchDraft(venue?: Partial<WeddingVenue>): VenueResearchDraft {
  return {
    source: venue?.source,
    lastVerified: venue?.lastVerified,
    region: venue?.region,
    hallType: venue?.hallType,
    foodType: venue?.foodType,
    capacityMin: venue?.capacityMin,
    capacityMax: venue?.capacityMax,
    mealPriceMin: venue?.mealPriceMin,
    mealPriceMax: venue?.mealPriceMax,
    contact: venue?.contact,
    notes: venue?.notes,
    quote: venue?.contract?.quote,
    payment: venue?.contract?.payment,
    cancellation: venue?.contract?.cancellation,
    included: venue?.contract?.included,
    extras: venue?.contract?.extras,
    evidence: venue?.contract?.evidence,
  };
}

export function emptySdmResearchDraft(vendor?: Partial<SdmVendor>): SdmResearchDraft {
  return {
    source: vendor?.source,
    lastVerified: vendor?.lastVerified,
    priceRange: vendor?.priceRange,
    contact: vendor?.contact,
    notes: vendor?.notes,
    quote: vendor?.contract?.quote,
    payment: vendor?.contract?.payment,
    cancellation: vendor?.contract?.cancellation,
    included: vendor?.contract?.included,
    extras: vendor?.contract?.extras,
    evidence: vendor?.contract?.evidence,
  };
}

export function parseVenueResearchText(raw: string): Partial<VenueResearchDraft> {
  const source = extractFirstUrl(raw) ?? labeledValue(raw, ["출처", "근거", "링크", "홈페이지"]);
  const capacity = parsePeopleRange(raw);
  const meal = parseMealPriceRange(raw);
  return compactObject<VenueResearchDraft>({
    source,
    lastVerified: parseDate(raw),
    region: parseRegion(raw),
    hallType: parseHallType(raw),
    foodType: parseFoodType(raw),
    capacityMin: capacity.min,
    capacityMax: capacity.max,
    mealPriceMin: meal.min,
    mealPriceMax: meal.max,
    contact: parseContact(raw),
    quote: factLines(raw, ["견적", "견적서", "대관료", "보증", "식대", "메뉴", "타임", "요일"], 2),
    payment: factLines(raw, ["계약금", "잔금", "결제", "입금", "카드", "현금영수증"], 2),
    cancellation: factLines(raw, ["취소", "환불", "위약금", "변경"], 2),
    included: factLines(raw, ["포함", "제공", "생화", "음주류", "폐백", "혼구", "주차"], 2),
    extras: factLines(raw, ["별도", "추가", "부가세", "봉사료", "주차권", "셔틀"], 2),
    evidence: factLines(raw, ["계약서", "견적서", "캡처", "문자", "카톡", "메일", "증빙"], 2),
  });
}

export function parseSdmResearchText(raw: string): Partial<SdmResearchDraft> {
  const source = extractFirstUrl(raw) ?? labeledValue(raw, ["출처", "근거", "링크", "인스타", "홈페이지"]);
  return compactObject<SdmResearchDraft>({
    source,
    lastVerified: parseDate(raw),
    priceRange: parsePriceMemo(raw),
    contact: parseContact(raw),
    quote: factLines(raw, ["견적", "패키지", "촬영", "드레스", "원장", "실장", "대표", "작가"], 2),
    payment: factLines(raw, ["계약금", "잔금", "결제", "입금", "카드", "현금영수증"], 2),
    cancellation: factLines(raw, ["취소", "환불", "위약금", "변경", "일정"], 2),
    included: factLines(raw, ["포함", "제공", "원본", "보정", "피팅", "앨범", "액자", "헬퍼"], 2),
    extras: factLines(raw, ["별도", "추가", "헬퍼비", "출장비", "원본비", "수정", "부가세"], 2),
    evidence: factLines(raw, ["계약서", "견적서", "캡처", "문자", "카톡", "메일", "증빙"], 2),
  });
}

export function venueResearchDraftToPatch(draft: VenueResearchDraft): Partial<WeddingVenue> {
  const contract = cleanContract({
    quote: draft.quote,
    payment: draft.payment,
    cancellation: draft.cancellation,
    included: draft.included,
    extras: draft.extras,
    evidence: draft.evidence,
  });
  const hasCapacity = hasNumber(draft.capacityMin) || hasNumber(draft.capacityMax);
  const hasMeal = hasNumber(draft.mealPriceMin) || hasNumber(draft.mealPriceMax);
  const patch = compactObject<Partial<WeddingVenue>>({
    source: cleanText(draft.source),
    lastVerified: hasResearchFacts(draft) ? (draft.lastVerified || todayISO()) : undefined,
    region: cleanText(draft.region),
    hallType: draft.hallType,
    foodType: draft.foodType,
    capacityMin: draft.capacityMin,
    capacityMax: draft.capacityMax,
    capacitySource: hasCapacity ? "user" : undefined,
    mealPriceMin: draft.mealPriceMin,
    mealPriceMax: draft.mealPriceMax,
    mealPriceSource: hasMeal ? "user" : undefined,
    contact: cleanText(draft.contact),
    notes: cleanText(draft.notes),
    contract,
  });
  return patch;
}

export function sdmResearchDraftToPatch(draft: SdmResearchDraft): Partial<SdmVendor> {
  const contract = cleanContract({
    quote: draft.quote,
    payment: draft.payment,
    cancellation: draft.cancellation,
    included: draft.included,
    extras: draft.extras,
    evidence: draft.evidence,
  });
  return compactObject<Partial<SdmVendor>>({
    source: cleanText(draft.source),
    lastVerified: hasResearchFacts(draft) ? (draft.lastVerified || todayISO()) : undefined,
    priceRange: cleanText(draft.priceRange),
    contact: cleanText(draft.contact),
    notes: cleanText(draft.notes),
    contract,
  });
}

function cleanText(value?: string): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim();
  return text || undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null) return false;
      if (typeof entry === "string") return entry.trim().length > 0;
      if (typeof entry === "object" && !Array.isArray(entry)) return Object.keys(entry).length > 0;
      return true;
    }),
  ) as T;
}

function hasNumber(value?: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function hasResearchFacts(draft: Record<string, unknown>): boolean {
  return Object.entries(draft).some(([key, value]) => {
    if (key === "lastVerified") return false;
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
}

function cleanContract(contract: ContractCheck): ContractCheck | undefined {
  const next = compactObject<ContractCheck>({
    quote: cleanText(contract.quote),
    payment: cleanText(contract.payment),
    cancellation: cleanText(contract.cancellation),
    included: cleanText(contract.included),
    extras: cleanText(contract.extras),
    evidence: cleanText(contract.evidence),
  });
  return Object.keys(next).length > 0 ? next : undefined;
}

function extractFirstUrl(raw: string): string | undefined {
  return raw.match(URL_RE)?.[0]?.replace(/[).,]+$/, "");
}

function parseDate(raw: string): string | undefined {
  const labeled = labeledValue(raw, ["확인일", "상담일", "조사일", "방문일"]);
  const target = labeled ?? raw;
  const full = target.match(/(20\d{2})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  const short = target.match(/(?:^|\D)(\d{1,2})[./]\s*(\d{1,2})(?:\D|$)/);
  if (!short) return undefined;
  return `${new Date().getFullYear()}-${short[1].padStart(2, "0")}-${short[2].padStart(2, "0")}`;
}

function parseRegion(raw: string): string | undefined {
  const labeled = labeledValue(raw, ["지역", "위치", "주소"]);
  if (labeled) return labeled.slice(0, 60);
  const match = raw.match(/(서울\s*[가-힣구동]+|경기\s*[가-힣시군구]+|인천\s*[가-힣구동]+|부산\s*[가-힣구동]+|대구\s*[가-힣구동]+|대전\s*[가-힣구동]+|광주\s*[가-힣구동]+|울산\s*[가-힣구동]+|제주\s*[가-힣시]+|강남|청담|삼성|역삼|서초|반포|여의도|광화문|중구|종로|한남|용산|송파|잠실|분당|판교|일산|수원|송도)/);
  return match?.[1]?.replace(/\s+/g, " ").trim();
}

function parseHallType(raw: string): VenueHallType | undefined {
  if (/야외|가든|정원|루프탑/.test(raw)) return "outdoor";
  if (/호텔/.test(raw)) return "hotel";
  if (/하우스|채플|성당/.test(raw)) return "house";
  if (/컨벤션|센터|그랜드볼룸|연회장/.test(raw)) return "convention";
  if (/웨딩홀|예식장/.test(raw)) return "general";
  return undefined;
}

function parseFoodType(raw: string): VenueFoodType | undefined {
  if (/뷔페|부페/.test(raw)) return "buffet";
  if (/코스|한정식|양식|중식|오마카세/.test(raw)) return "course";
  if (/단품|일품|플레이팅|plated/i.test(raw)) return "plated";
  return undefined;
}

function parseContact(raw: string): string | undefined {
  const phone = raw.match(PHONE_RE)?.[0];
  const contactLine = factLines(raw, ["담당", "연락", "문의", "전화", "카톡", "카카오"], 1);
  if (contactLine && phone && !contactLine.includes(phone)) return `${contactLine} · ${phone}`;
  return contactLine ?? phone;
}

function parsePeopleRange(raw: string): Range {
  const lines = matchingLines(raw, ["보증", "최소", "최대", "수용", "인원", "하객", "명", "석"], 4);
  let min: number | undefined;
  let max: number | undefined;
  for (const line of lines) {
    const range = line.match(/(\d{2,4})\s*(?:~|-|–|—)\s*(\d{2,4})\s*(?:명|석)/);
    if (range) {
      min = min ?? clampPeople(Number(range[1]));
      max = max ?? clampPeople(Number(range[2]));
    }
    const reverseRange = line.match(/(\d{2,4})\s*(?:명|석)\s*(?:~|-|–|—)\s*(\d{2,4})\s*(?:명|석)?/);
    if (reverseRange) {
      min = min ?? clampPeople(Number(reverseRange[1]));
      max = max ?? clampPeople(Number(reverseRange[2]));
    }
    const guarantee = line.match(/(?:보증|최소)\D{0,10}(\d{2,4})\s*(?:명|석)/);
    if (guarantee) min = min ?? clampPeople(Number(guarantee[1]));
    const capacity = line.match(/(?:최대|수용)\D{0,10}(\d{2,4})\s*(?:명|석)/);
    if (capacity) max = max ?? clampPeople(Number(capacity[1]));
    const singles = [...line.matchAll(/(\d{2,4})\s*(?:명|석)/g)]
      .map((m) => clampPeople(Number(m[1])))
      .filter((n): n is number => n !== undefined);
    if (singles.length === 1) {
      if (/보증|최소/.test(line)) min = min ?? singles[0];
      else max = max ?? singles[0];
    } else if (singles.length > 1) {
      min = min ?? Math.min(...singles);
      max = max ?? Math.max(...singles);
    }
  }
  if (min && max && min > max) [min, max] = [max, min];
  return { min, max };
}

function clampPeople(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 20 || value > 3000) return undefined;
  return Math.round(value);
}

function parseMealPriceRange(raw: string): Range {
  const lines = matchingLines(raw, ["식대", "메뉴", "1인", "인당", "뷔페", "코스"], 4);
  return parseMoneyRange(lines, 30_000, 500_000);
}

function parsePriceMemo(raw: string): string | undefined {
  return factLines(raw, ["견적", "가격", "비용", "금액", "패키지", "원", "만원"], 2);
}

function parseMoneyRange(lines: string[], minAllowed: number, maxAllowed: number): Range {
  const amounts: number[] = [];
  for (const line of lines) {
    const rangeMatches = [...line.matchAll(/(\d+(?:\.\d+)?)\s*(?:~|-|–|—)\s*(\d+(?:\.\d+)?)\s*(만원|만|원)/g)];
    for (const match of rangeMatches) {
      const first = normalizeMoney(Number(match[1]), match[3]);
      const second = normalizeMoney(Number(match[2]), match[3]);
      for (const amount of [first, second]) {
        if (amount && amount >= minAllowed && amount <= maxAllowed) amounts.push(amount);
      }
    }
    const matches = [...line.matchAll(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(만원|만|원)?/g)];
    for (const match of matches) {
      const unit = match[2];
      const rawNumber = Number(match[1].replace(/,/g, ""));
      const after = line.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 2);
      if (!Number.isFinite(rawNumber) || /[시명석]/.test(after)) continue;
      let amount: number | undefined;
      if (unit) amount = normalizeMoney(rawNumber, unit);
      else if (match[1].includes(",")) amount = Math.round(rawNumber);
      if (amount && amount >= minAllowed && amount <= maxAllowed) amounts.push(amount);
    }
  }
  if (amounts.length === 0) return {};
  return { min: Math.min(...amounts), max: Math.max(...amounts) };
}

function normalizeMoney(value: number, unit: string): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  if (unit === "만원" || unit === "만") return Math.round(value * 10_000);
  if (unit === "원") return Math.round(value);
  return undefined;
}

function labeledValue(raw: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = raw.match(new RegExp(`(?:^|\\n)\\s*${escapeRegExp(label)}\\s*[:：]\\s*([^\\n]+)`, "i"));
    const value = cleanFactLine(match?.[1]);
    if (value) return value;
  }
  return undefined;
}

function factLines(raw: string, keywords: string[], limit: number): string | undefined {
  const lines = matchingLines(raw, keywords, limit).map(cleanFactLine).filter(Boolean) as string[];
  if (lines.length === 0) return undefined;
  return lines.join(" / ");
}

function matchingLines(raw: string, keywords: string[], limit: number): string[] {
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  return raw
    .split(/\n|•|·|;/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 2 && line.length <= 180)
    .filter((line) => {
      const lower = line.toLowerCase();
      return lowerKeywords.some((keyword) => lower.includes(keyword));
    })
    .slice(0, limit);
}

function cleanFactLine(line?: string): string | undefined {
  const cleaned = line
    ?.replace(URL_RE, "")
    .replace(/\s+/g, " ")
    .replace(/^[\-–—*·•\s]+/, "")
    .trim();
  return cleaned ? cleaned.slice(0, 180) : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
