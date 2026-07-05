import type { WeddingData, WeddingVenue } from "./schema";
import {
  budgetTotals,
  contractedVenue,
  decisionMap,
  formatKRW,
  invitationReadiness,
  mealBudgetCheck,
  mealTicketCount,
  planningHeadcount,
  rsvpReadiness,
  todayISO,
  tripCostEstimate,
  venueCapacityFit,
  type DecisionSection,
} from "./derived";
import { collectLossDeadlines } from "./lossDeadlines";

export type ReceiptTone = "ready" | "watch" | "blocked";
export type ReceiptPerspectiveKey = "couple" | "groom" | "bride" | "guest" | "family" | "vendor" | "outside";

export type ReceiptPerspective = {
  key: ReceiptPerspectiveKey;
  label: string;
  summary: string;
  tone?: ReceiptTone;
};

export type DecisionReceipt = {
  sectionId: DecisionSection;
  title: string;
  decision: string;
  reasons: string[];
  openQuestions: string[];
  nextAction: string;
  to: string;
  tone: ReceiptTone;
  stamp: string;
  perspectives: ReceiptPerspective[];
  facts?: string[];
  priority: number;
};

export type DecisionAgreement = {
  title: string;
  question: string;
  evidenceLabel: string;
  evidence: string;
  choices: string[];
  boundary: string;
  shareLine: string;
};

type AgreementTemplate = {
  title: string;
  question: string;
  evidenceLabel: string;
  choices: [string, string];
  boundary: string;
};

const AGREEMENT_TEMPLATES: Record<DecisionSection, AgreementTemplate> = {
  venues: {
    title: "계약 전 합의",
    question: "이 장소를 고르면 감수할 조건은 무엇인가요?",
    evidenceLabel: "판단 기준",
    choices: ["후보를 더 본다", "계약 조건을 잠근다"],
    boundary: "가격, 보증인원, 취소 조건 중 하나라도 비어 있으면 계약 확정으로 보지 않아요.",
  },
  budget: {
    title: "돈 합의",
    question: "지킬 수 있는 상한선은 어디까지인가요?",
    evidenceLabel: "예산 증거",
    choices: ["총액을 낮춘다", "우선순위를 바꾼다"],
    boundary: "초과 항목은 감정으로 미루지 않고 줄일 항목과 유지할 항목으로 나눠요.",
  },
  guests: {
    title: "초대 범위 합의",
    question: "누구까지 초대하면 납득 가능한 범위가 되나요?",
    evidenceLabel: "명단 상태",
    choices: ["범위를 좁힌다", "식수를 다시 잡는다"],
    boundary: "미응답과 식수는 분리해서 보고, 보증인원 결정 전에 마지막 확인 대상을 정해요.",
  },
  invitation: {
    title: "공개 전 합의",
    question: "하객이 이 청첩장만 보고 헷갈리지 않고 올 수 있나요?",
    evidenceLabel: "발행 근거",
    choices: ["정보를 보강한다", "링크를 발행한다"],
    boundary: "날짜, 장소, 교통, 연락처 중 하나라도 빠지면 공개보다 보강이 먼저예요.",
  },
  sdm: {
    title: "업체 선택 합의",
    question: "취향과 계약 조건 중 오늘 더 중요한 기준은 무엇인가요?",
    evidenceLabel: "비교 근거",
    choices: ["상담 후보를 줄인다", "계약 조건을 확인한다"],
    boundary: "상담 인상만으로 결정하지 않고 포함 항목, 추가금, 원본/수정본 조건을 같이 봐요.",
  },
  rings: {
    title: "취향 합의",
    question: "좋아 보이는 것과 오래 낄 수 있는 것은 같나요?",
    evidenceLabel: "공통 후보",
    choices: ["취향을 더 표시한다", "공통 후보를 비교한다"],
    boundary: "가격이 확인되지 않은 후보는 최종 후보가 아니라 관심 후보로만 둬요.",
  },
  trip: {
    title: "여행 기준 합의",
    question: "로망, 이동 피로, 총액 중 이번 여행의 1순위는 무엇인가요?",
    evidenceLabel: "예약 근거",
    choices: ["지역을 좁힌다", "총액을 비교한다"],
    boundary: "항공과 숙소 가격이 같이 보일 때만 총액 비교로 인정해요.",
  },
  checklist: {
    title: "이번 주 합의",
    question: "이번 주에 끝내지 않으면 실제로 막히는 일은 무엇인가요?",
    evidenceLabel: "마감 근거",
    choices: ["지난 마감을 처리한다", "날짜 없는 일을 배치한다"],
    boundary: "급한 일과 중요한 일을 섞지 않고, 오늘 처리할 일은 하나만 먼저 정해요.",
  },
  ceremony: {
    title: "당일 운영 합의",
    question: "당일에 직접 설명하지 않아도 진행될 만큼 명확한가요?",
    evidenceLabel: "진행 근거",
    choices: ["빈칸을 채운다", "공유본을 만든다"],
    boundary: "시간, 역할, 음악 중 하나라도 비어 있으면 사회자/업체 공유 전 상태로 봐요.",
  },
  video: {
    title: "영상 흐름 합의",
    question: "하객이 보기 좋은 흐름과 남기고 싶은 이야기가 맞나요?",
    evidenceLabel: "편집 근거",
    choices: ["사진을 고른다", "순서와 음악을 확정한다"],
    boundary: "사진 수보다 흐름이 먼저예요. 캡션 없는 사진은 의도 없는 장면으로 보여요.",
  },
  share: {
    title: "공유 범위 합의",
    question: "하객에게 보여줄 것과 내부용으로 둘 것을 분리했나요?",
    evidenceLabel: "공유 근거",
    choices: ["하객 링크를 정리한다", "편집 링크를 보호한다"],
    boundary: "예산, 명단, 계약 정보는 하객 공유 대상이 아니에요.",
  },
};

export function decisionAgreement(receipt: DecisionReceipt): DecisionAgreement {
  const template = AGREEMENT_TEMPLATES[receipt.sectionId];
  const evidence = receipt.reasons[0] ?? receipt.facts?.[0] ?? receipt.decision;
  const openQuestion = receipt.openQuestions[0];
  const choices = Array.from(new Set([
    ...template.choices,
    receipt.nextAction,
  ])).slice(0, 3);

  return {
    title: template.title,
    question: template.question,
    evidenceLabel: template.evidenceLabel,
    evidence,
    choices,
    boundary: openQuestion ? `${template.boundary} 지금은 '${openQuestion}' 확인이 먼저예요.` : template.boundary,
    shareLine: `${receipt.title}: ${receipt.decision} / 다음 행동: ${receipt.nextAction}`,
  };
}

const SECTION_TITLE: Record<DecisionSection, string> = {
  venues: "예식장 결정 기록",
  budget: "예산 결정 기록",
  guests: "하객 결정 기록",
  invitation: "청첩장 결정 기록",
  sdm: "업체 결정 기록",
  rings: "반지 결정 기록",
  trip: "여행 결정 기록",
  checklist: "준비 일정 기록",
  ceremony: "식순 결정 기록",
  video: "영상 편집 기록",
  share: "공유 범위 기록",
};

function compact(values: Array<string | undefined | false | null>, fallback?: string): string[] {
  const out = Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
  return out.length > 0 ? out : fallback ? [fallback] : [];
}

function contractMissing(venue: WeddingVenue | undefined): string[] {
  if (!venue) return [];
  const contract = venue.contract ?? {};
  return [
    ["quote", "견적 기준"],
    ["payment", "결제 일정"],
    ["cancellation", "취소·변경"],
    ["included", "포함 항목"],
    ["extras", "별도 비용"],
    ["evidence", "증빙 보관"],
  ].filter(([key]) => !contract[key as keyof NonNullable<WeddingVenue["contract"]>]?.trim()).map(([, label]) => label);
}

function toneFrom(openQuestions: string[], ready: boolean, urgent = false): ReceiptTone {
  if (urgent || openQuestions.length >= 3) return "blocked";
  if (!ready || openQuestions.length > 0) return "watch";
  return "ready";
}

function baseFromDecision(data: WeddingData, sectionId: DecisionSection) {
  return decisionMap(data).items.find((item) => item.section === sectionId);
}

export function decisionReceiptForSection(data: WeddingData, sectionId: DecisionSection, today: string = todayISO()): DecisionReceipt {
  const decision = baseFromDecision(data, sectionId);

  if (sectionId === "venues") {
    const venue = contractedVenue(data);
    const headcount = planningHeadcount(data);
    const fit = venueCapacityFit(venue, headcount);
    const missing = contractMissing(venue);
    const hasCandidates = (data.venues ?? []).length > 0;
    const openQuestions = venue ? missing : ["답사 1순위", "상담 가능한 날짜", "식대·보증인원"];
    return {
      sectionId,
      title: SECTION_TITLE[sectionId],
      decision: venue ? `${venue.name} 계약 조건을 잠그는 중` : hasCandidates ? "답사 순서를 정해야 하는 상태" : "후보 기준부터 잡아야 하는 상태",
      reasons: compact([
        venue ? `계약 식장: ${venue.name}` : hasCandidates ? `후보 ${(data.venues ?? []).length}곳` : "아직 담긴 후보 없음",
        headcount > 0 ? `예상 하객 ${headcount}명` : undefined,
        fit !== "unknown" ? `수용 판단 ${fit}` : undefined,
      ], decision?.whyNow),
      openQuestions,
      nextAction: venue ? "계약 조건 확인" : hasCandidates ? "후보 비교" : "예식장 기준 답하기",
      to: "/venues",
      tone: toneFrom(openQuestions, !!venue, missing.length >= 3),
      stamp: venue ? "계약 검토" : "후보 선택",
      facts: decision?.preparedFacts,
      priority: venue && missing.length >= 2 ? 96 : hasCandidates ? 78 : 58,
      perspectives: [
        { key: "couple", label: "우리", summary: venue ? "계약 유지 조건을 같이 확인" : "둘이 납득할 1순위 후보 선택" },
        { key: "family", label: "가족", summary: headcount > 0 ? `예상 인원 ${headcount}명 기준 공유` : "양가 예상 인원 필요", tone: headcount > 0 ? "ready" : "watch" },
        { key: "vendor", label: "식장", summary: openQuestions.slice(0, 2).join(" · ") || "계약 조건 확인" },
      ],
    };
  }

  if (sectionId === "budget") {
    const totals = budgetTotals(data);
    const due = collectLossDeadlines(data, today).filter((item) => item.targetPath === "/budget");
    const meal = mealBudgetCheck(data);
    const openQuestions = compact([
      totals.overCount > 0 ? `초과 항목 ${totals.overCount}건` : undefined,
      due[0] ? `${due[0].name} ${due[0].label}` : undefined,
      meal ? "식대 예산" : undefined,
      totals.actual === 0 ? "실제 지출" : undefined,
    ], "실제 지출과 결제 완료 여부");
    return {
      sectionId,
      title: SECTION_TITLE[sectionId],
      decision: totals.planned > 0 ? `예상 ${formatKRW(totals.planned)} 기준으로 지출 확인 중` : "총예산과 항목 기준이 필요",
      reasons: compact([
        totals.actual > 0 ? `실제 지출 ${formatKRW(totals.actual)}` : undefined,
        totals.overCount > 0 ? `초과 ${formatKRW(totals.overSum)}` : undefined,
        due.length > 0 ? `결제 마감 ${due.length}건` : undefined,
      ], "예산 항목을 넣으면 초과와 결제 마감이 보입니다"),
      openQuestions,
      nextAction: totals.planned > 0 ? "초과·마감 확인" : "예산표 시작",
      to: "/budget",
      tone: toneFrom(openQuestions, totals.planned > 0, totals.overCount > 0 || due.some((item) => item.daysLeft <= 7)),
      stamp: totals.overCount > 0 ? "초과 확인" : "돈 점검",
      facts: decision?.preparedFacts,
      priority: totals.overCount > 0 || due.length > 0 ? 95 : 64,
      perspectives: [
        { key: "couple", label: "우리", summary: "총액과 줄일 항목 합의" },
        { key: "groom", label: "신랑 측", summary: "부담·결제 담당 확인" },
        { key: "bride", label: "신부 측", summary: "부담·결제 담당 확인" },
      ],
    };
  }

  if (sectionId === "guests") {
    const guests = data.guests ?? [];
    const attending = guests.filter((guest) => guest.status === "참석").length;
    const pending = guests.filter((guest) => guest.status !== "참석" && guest.status !== "불참").length;
    const meal = mealTicketCount(data);
    const openQuestions = compact([
      pending > 0 ? `회신 대기 ${pending}명` : undefined,
      meal === 0 ? "식수 반영" : undefined,
      guests.some((guest) => !guest.category) ? "분류 없는 하객" : undefined,
    ], "최종 식수와 미응답 확인");
    return {
      sectionId,
      title: SECTION_TITLE[sectionId],
      decision: guests.length > 0 ? `${guests.length}명 명단에서 식수 ${meal}명 확인 중` : "하객 범위를 먼저 잡아야 하는 상태",
      reasons: compact([
        attending > 0 ? `참석 ${attending}명` : undefined,
        pending > 0 ? `미확정 ${pending}명` : undefined,
        meal > 0 ? `식권 예상 ${meal}장` : undefined,
      ], "하객을 넣으면 식수와 회신이 연결됩니다"),
      openQuestions,
      nextAction: guests.length > 0 ? "미응답·식수 확인" : "하객 명단 시작",
      to: "/guests",
      tone: toneFrom(openQuestions, guests.length > 0, pending >= 20),
      stamp: pending > 0 ? "회신 대기" : "식수 점검",
      facts: decision?.preparedFacts,
      priority: pending > 0 ? 88 : 60,
      perspectives: [
        { key: "groom", label: "신랑 측", summary: `${guests.filter((guest) => guest.side === "groom").length}명` },
        { key: "bride", label: "신부 측", summary: `${guests.filter((guest) => guest.side === "bride").length}명` },
        { key: "guest", label: "하객", summary: pending > 0 ? "회신 안내 필요" : "안내 상태 확인" },
      ],
    };
  }

  if (sectionId === "invitation") {
    const readiness = invitationReadiness(data);
    const openQuestions = readiness.missing.length > 0 ? readiness.missing : compact([
      data.publish ? undefined : "하객용 링크 발행",
      data.invitation.rsvpEnabled ? "RSVP 안내 문구" : undefined,
    ], "미리보기와 공개 범위");
    return {
      sectionId,
      title: SECTION_TITLE[sectionId],
      decision: readiness.missing.length === 0 ? data.publish ? "하객용 링크가 발행된 상태" : "발행 가능한 상태" : `${readiness.missing.length}가지가 발행을 막는 상태`,
      reasons: compact([
        `기본 정보 ${readiness.filled}/${readiness.total}`,
        data.invitation.heroImageUrl ? "대표 사진 있음" : "대표 사진 없음",
        data.publish ? "발행 링크 있음" : undefined,
      ]),
      openQuestions,
      nextAction: readiness.missing.length > 0 ? "빠진 항목 채우기" : data.publish ? "하객 시점 확인" : "하객용 링크 발행",
      to: "/invitation?edit=publish#publish-invitation",
      tone: toneFrom(openQuestions, readiness.missing.length === 0, readiness.missing.length >= 2),
      stamp: readiness.missing.length > 0 ? "발행 보류" : data.publish ? "발행 완료" : "발행 가능",
      facts: decision?.preparedFacts,
      priority: readiness.missing.length > 0 ? 90 : data.publish ? 45 : 76,
      perspectives: [
        { key: "couple", label: "우리", summary: "이름·날짜·문안 최종 확인" },
        { key: "guest", label: "하객", summary: data.publish ? "공개 링크 확인" : "받는 사람이 헷갈릴 정보 제거" },
        { key: "outside", label: "외부 공개", summary: data.invitation.rsvpEnabled ? "RSVP 켜짐" : "청첩장 정보만 공개" },
      ],
    };
  }

  if (sectionId === "sdm") {
    const vendors = data.sdm ?? [];
    const contracted = vendors.filter((vendor) => vendor.status === "계약").length;
    const consult = vendors.filter((vendor) => vendor.status === "상담").length;
    const missingContract = vendors.filter((vendor) => vendor.status === "계약" && (!vendor.contract || Object.values(vendor.contract).filter(Boolean).length < 3)).length;
    const openQuestions = compact([
      missingContract > 0 ? `계약 체크 부족 ${missingContract}곳` : undefined,
      contracted === 0 && consult > 0 ? "상담 비교 기준" : undefined,
      vendors.length === 0 ? "후보 업체" : undefined,
    ], "추가금·원본·잔금 조건");
    return {
      sectionId,
      title: SECTION_TITLE[sectionId],
      decision: contracted > 0 ? `계약 ${contracted}건의 조건을 확인 중` : vendors.length > 0 ? `후보 ${vendors.length}곳을 비교 중` : "업체 후보가 필요한 상태",
      reasons: compact([
        vendors.length > 0 ? `후보 ${vendors.length}곳` : undefined,
        consult > 0 ? `상담 ${consult}곳` : undefined,
        contracted > 0 ? `계약 ${contracted}곳` : undefined,
      ], "업체를 담으면 상담과 계약 조건이 이어집니다"),
      openQuestions,
      nextAction: vendors.length > 0 ? "상담·계약 조건 확인" : "업체 후보 담기",
      to: "/sdm",
      tone: toneFrom(openQuestions, vendors.length > 0, missingContract > 0),
      stamp: contracted > 0 ? "계약 점검" : "후보 비교",
      facts: decision?.preparedFacts,
      priority: missingContract > 0 ? 91 : vendors.length > 0 ? 72 : 50,
      perspectives: [
        { key: "couple", label: "우리", summary: "취향과 예산 합의" },
        { key: "vendor", label: "업체", summary: openQuestions.slice(0, 2).join(" · ") || "상담 조건 확인" },
      ],
    };
  }

  if (sectionId === "rings") {
    const groom = data.rings.filter((ring) => ring.likedBy?.includes("groom") || ring.starredBy?.includes("groom")).length;
    const bride = data.rings.filter((ring) => ring.likedBy?.includes("bride") || ring.starredBy?.includes("bride")).length;
    const mutual = data.rings.filter((ring) =>
      (ring.likedBy?.includes("groom") || ring.starredBy?.includes("groom")) &&
      (ring.likedBy?.includes("bride") || ring.starredBy?.includes("bride"))
    ).length;
    const missingPrice = data.rings.filter((ring) => (ring.starredBy?.length || ring.likedBy?.length) && (!ring.priceKRW || !ring.lastVerified)).length;
    const openQuestions = compact([
      groom === 0 ? "신랑 취향 표시" : undefined,
      bride === 0 ? "신부 취향 표시" : undefined,
      missingPrice > 0 ? `가격 확인 ${missingPrice}개` : undefined,
      mutual === 0 && groom > 0 && bride > 0 ? "겹치는 후보" : undefined,
    ], "착용감·수령일·세트 할인");
    return {
      sectionId,
      title: SECTION_TITLE[sectionId],
      decision: mutual > 0 ? `둘 다 고른 후보 ${mutual}개` : data.rings.length > 0 ? "각자 취향을 맞춰보는 중" : "반지 후보가 필요한 상태",
      reasons: compact([
        `신랑 표시 ${groom}개`,
        `신부 표시 ${bride}개`,
        mutual > 0 ? `겹친 후보 ${mutual}개` : undefined,
      ]),
      openQuestions,
      nextAction: mutual > 0 ? "가격·매장 확인" : "각자 마음 표시",
      to: "/rings",
      tone: toneFrom(openQuestions, mutual > 0, missingPrice >= 3),
      stamp: mutual > 0 ? "공통 후보" : "취향 조율",
      facts: decision?.preparedFacts,
      priority: mutual > 0 ? 82 : 66,
      perspectives: [
        { key: "groom", label: "신랑", summary: `${groom}개 표시` },
        { key: "bride", label: "신부", summary: `${bride}개 표시` },
        { key: "couple", label: "우리", summary: mutual > 0 ? `${mutual}개 겹침` : "겹치는 후보 찾기", tone: mutual > 0 ? "ready" : "watch" },
      ],
    };
  }

  if (sectionId === "trip") {
    const estimate = tripCostEstimate(data);
    const openQuestions = compact([
      data.honeymoon.regions.length === 0 ? "여행지 후보" : undefined,
      data.flights.length === 0 ? "항공권" : undefined,
      data.hotels.length === 0 ? "숙소" : undefined,
      estimate && !estimate.flightKRW ? "항공 가격" : undefined,
      estimate && !estimate.hotelKRW ? "숙소 가격" : undefined,
      data.honeymoon.startDate && data.honeymoon.endDate ? undefined : "여행 날짜",
    ], "항공·숙소·총액");
    return {
      sectionId,
      title: SECTION_TITLE[sectionId],
      decision: estimate?.total ? `현재 총액 약 ${formatKRW(estimate.total)} 기준으로 비교 중` : data.honeymoon.regions.length > 0 ? "여행지 후보를 현실 조건으로 좁히는 중" : "여행 톤과 지역이 필요한 상태",
      reasons: compact([
        data.honeymoon.regions.length > 0 ? `지역 ${data.honeymoon.regions.length}곳` : undefined,
        data.flights.length > 0 ? `항공 ${data.flights.length}개` : undefined,
        data.hotels.length > 0 ? `숙소 ${data.hotels.length}곳` : undefined,
      ], "지역, 항공, 숙소를 담으면 총액이 보입니다"),
      openQuestions,
      nextAction: "여행 총액 확인",
      to: "/trip",
      tone: toneFrom(openQuestions, !!estimate?.total, openQuestions.length >= 3),
      stamp: estimate?.total ? "총액 비교" : "예약 전",
      facts: decision?.preparedFacts,
      priority: openQuestions.length >= 3 ? 74 : 60,
      perspectives: [
        { key: "couple", label: "우리", summary: "로망과 예산 균형" },
        { key: "outside", label: "예약처", summary: "환불·수하물·조식 조건 확인" },
      ],
    };
  }

  if (sectionId === "checklist") {
    const total = data.checklist.reduce((sum, section) => sum + section.items.length, 0);
    const done = data.checklist.reduce((sum, section) => sum + section.items.filter((item) => item.done).length, 0);
    const overdue = data.checklist.reduce((sum, section) => sum + section.items.filter((item) => !item.done && item.dueDate && item.dueDate.slice(0, 10) < today).length, 0);
    const noDate = data.checklist.reduce((sum, section) => sum + section.items.filter((item) => !item.done && !item.dueDate).length, 0);
    const openQuestions = compact([
      overdue > 0 ? `지난 마감 ${overdue}개` : undefined,
      noDate > 0 ? `날짜 없음 ${noDate}개` : undefined,
      total === 0 ? "기본 타임라인" : undefined,
    ], "이번 주 할 일");
    return {
      sectionId,
      title: SECTION_TITLE[sectionId],
      decision: total > 0 ? `${done}/${total}개 완료, 마감 중심으로 정리 중` : "기본 타임라인이 필요한 상태",
      reasons: compact([
        total > 0 ? `전체 ${total}개` : undefined,
        overdue > 0 ? `지난 마감 ${overdue}개` : undefined,
        noDate > 0 ? `날짜 없음 ${noDate}개` : undefined,
      ], "타임라인을 불러오면 날짜 기준 운영이 시작됩니다"),
      openQuestions,
      nextAction: overdue > 0 ? "지난 마감 처리" : noDate > 0 ? "날짜 없는 항목 정리" : "이번 주 할 일 확인",
      to: "/checklist",
      tone: toneFrom(openQuestions, total > 0, overdue > 0),
      stamp: overdue > 0 ? "마감 경고" : "운영 리듬",
      facts: decision?.preparedFacts,
      priority: overdue > 0 ? 93 : noDate > 0 ? 72 : 52,
      perspectives: [
        { key: "couple", label: "우리", summary: "이번 주 같이 볼 일" },
        { key: "outside", label: "외부 일정", summary: "계약·결제·제출 마감 연결" },
      ],
    };
  }

  if (sectionId === "ceremony") {
    const steps = data.ceremony ?? [];
    const missingRole = steps.filter((step) => !step.role?.trim()).length;
    const missingMusic = steps.filter((step) => !step.music?.trim()).length;
    const missingTime = steps.filter((step) => !step.time?.trim()).length;
    const openQuestions = compact([
      missingTime > 0 ? `시간 ${missingTime}단계` : undefined,
      missingRole > 0 ? `담당 ${missingRole}단계` : undefined,
      missingMusic > 0 ? `음악 ${missingMusic}단계` : undefined,
      steps.length === 0 ? "기본 식순" : undefined,
    ], "사회자에게 넘길 큐");
    return {
      sectionId,
      title: SECTION_TITLE[sectionId],
      decision: steps.length > 0 ? `${steps.length}단계 식순을 당일 큐로 정리 중` : "식순 틀이 필요한 상태",
      reasons: compact([
        steps.length > 0 ? `단계 ${steps.length}개` : undefined,
        steps.filter((step) => step.done).length > 0 ? `확인 ${steps.filter((step) => step.done).length}개` : undefined,
      ], "기본 식순을 불러오면 시간·담당·음악을 채울 수 있습니다"),
      openQuestions,
      nextAction: steps.length > 0 ? "빈 큐 채우기" : "기본 식순 불러오기",
      to: "/ceremony",
      tone: toneFrom(openQuestions, steps.length > 0, missingRole + missingMusic + missingTime >= 5),
      stamp: "당일 큐",
      facts: decision?.preparedFacts,
      priority: missingRole + missingMusic + missingTime > 0 ? 80 : 48,
      perspectives: [
        { key: "couple", label: "우리", summary: "진행 순서 합의" },
        { key: "family", label: "가족", summary: "입장·화촉·인사 역할 확인" },
        { key: "vendor", label: "사회자", summary: openQuestions.slice(0, 2).join(" · ") || "큐시트 전달" },
      ],
    };
  }

  if (sectionId === "video") {
    const photos = data.video?.photos ?? [];
    const noCaption = photos.filter((photo) => !photo.caption?.trim()).length;
    const unassigned = data.video?.acts?.length ? photos.filter((photo) => !photo.actId).length : 0;
    const openQuestions = compact([
      photos.length === 0 ? "사진" : undefined,
      noCaption > 0 ? `자막 없음 ${noCaption}장` : undefined,
      unassigned > 0 ? `챕터 미배정 ${unassigned}장` : undefined,
      !data.video?.bgmUrl ? "BGM" : undefined,
    ], "미리보기와 제출 파일");
    return {
      sectionId,
      title: SECTION_TITLE[sectionId],
      decision: photos.length > 0 ? `사진 ${photos.length}장으로 흐름을 편집 중` : "영상에 넣을 사진이 필요한 상태",
      reasons: compact([
        photos.length > 0 ? `사진 ${photos.length}장` : undefined,
        data.video?.acts?.length ? `챕터 ${data.video.acts.length}개` : undefined,
        data.video?.bgmUrl ? "BGM 있음" : undefined,
      ], "사진을 넣으면 미리보기와 길이를 확인할 수 있습니다"),
      openQuestions,
      nextAction: photos.length > 0 ? "편집 빈칸 확인" : "사진 넣기",
      to: "/video",
      tone: toneFrom(openQuestions, photos.length > 0, photos.length === 0),
      stamp: photos.length > 0 ? "편집 중" : "소스 필요",
      facts: decision?.preparedFacts,
      priority: photos.length === 0 ? 70 : noCaption + unassigned > 0 ? 65 : 42,
      perspectives: [
        { key: "couple", label: "우리", summary: "둘의 이야기 흐름 확인" },
        { key: "guest", label: "하객", summary: "식전 대기 시간에 자연스러운 길이" },
        { key: "vendor", label: "업체", summary: "제출 파일과 음악 권리 확인" },
      ],
    };
  }

  const backupAge = data.preferences.lastBackupAt ? Math.round((Date.parse(today) - Date.parse(data.preferences.lastBackupAt)) / 86_400_000) : null;
  const openQuestions = compact([
    data.publish ? undefined : "하객용 링크",
    data.preferences.mode === "local" ? "함께 편집 링크" : undefined,
    backupAge === null || backupAge > 30 ? "최신 백업" : undefined,
  ], "보낼 대상별 링크 분리");
  return {
    sectionId: "share",
    title: SECTION_TITLE.share,
    decision: data.publish ? "하객용 링크와 편집 링크를 분리해 관리 중" : "공유 범위를 정해야 하는 상태",
    reasons: compact([
      data.publish ? "하객 링크 있음" : undefined,
      data.preferences.mode === "hosted" || data.preferences.mode === "supabase" ? "함께 편집 가능" : "로컬 저장 중",
      backupAge !== null ? `백업 ${backupAge === 0 ? "오늘" : `${backupAge}일 전`}` : undefined,
    ], "공유는 하객용과 편집용을 분리해야 안전합니다"),
    openQuestions,
    nextAction: data.publish ? "공유 센터 확인" : "하객 링크 발행",
    to: "/share",
    tone: toneFrom(openQuestions, !!data.publish, data.preferences.mode === "local" && backupAge === null),
    stamp: "공유 범위",
    facts: decision?.preparedFacts,
    priority: data.preferences.mode === "local" && backupAge === null ? 84 : 44,
    perspectives: [
      { key: "couple", label: "우리", summary: "편집·복구 링크" },
      { key: "guest", label: "하객", summary: data.publish ? "하객용 링크" : "아직 발행 전", tone: data.publish ? "ready" : "watch" },
      { key: "outside", label: "외부 공개", summary: "예산·하객 데이터는 공유하지 않음" },
    ],
  };
}

export function decisionReceipts(data: WeddingData, today: string = todayISO()): DecisionReceipt[] {
  const sections: DecisionSection[] = ["venues", "budget", "guests", "invitation", "sdm", "rings", "trip", "checklist", "ceremony", "video", "share"];
  return sections
    .map((sectionId) => decisionReceiptForSection(data, sectionId, today))
    .sort((a, b) => toneRank(a.tone) - toneRank(b.tone) || b.priority - a.priority);
}

function toneRank(tone: ReceiptTone): number {
  if (tone === "blocked") return 0;
  if (tone === "watch") return 1;
  return 2;
}

export type TodayDecision = DecisionReceipt & {
  todayReason: string;
};

export function todayDecisions(data: WeddingData, today: string = todayISO(), limit = 3): TodayDecision[] {
  return decisionReceipts(data, today)
    .filter((receipt) => receipt.tone !== "ready" || receipt.priority >= 70)
    .slice(0, limit)
    .map((receipt) => ({
      ...receipt,
      todayReason: receipt.openQuestions[0] ?? receipt.reasons[0] ?? receipt.nextAction,
    }));
}
