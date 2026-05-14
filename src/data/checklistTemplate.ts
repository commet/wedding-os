import type { ChecklistSection, CheckItem } from "../lib/schema";

// 표준 결혼 준비 타임라인.
// 각 항목에 ddayOffset(결혼식 D-day 기준 상대 일수)이 있어,
// 결혼식 날짜가 정해지면 마감일이 자동으로 계산된다.

let nextId = 0;
const id = () => `cl-${++nextId}-${Math.random().toString(36).slice(2, 6)}`;

type Tmpl = {
  icon: string;
  title: string;
  items: { text: string; dday: number; priority?: CheckItem["priority"] }[];
};

const TEMPLATE: Tmpl[] = [
  {
    icon: "🏛️", title: "예식장 · 업체",
    items: [
      { text: "예식 날짜·시간 확정", dday: -365 },
      { text: "예식장 예약 + 계약금", dday: -360, priority: "red" },
      { text: "스튜디오·드레스·메이크업(스드메) 계약", dday: -300 },
      { text: "예식장 식순·식사 메뉴 확정", dday: -60 },
      { text: "예식장 최종 미팅", dday: -14 },
    ],
  },
  {
    icon: "💍", title: "결혼반지",
    items: [
      { text: "브랜드 후보 비교", dday: -150 },
      { text: "신부와 함께 2~3개로 좁히기", dday: -135 },
      { text: "매장 방문 + 실물 착용", dday: -120 },
      { text: "최종 결정 및 주문", dday: -110, priority: "yellow" },
      { text: "각인 문구 결정", dday: -100 },
      { text: "반지 수령", dday: -30 },
    ],
  },
  {
    icon: "💌", title: "청첩장",
    items: [
      { text: "종이 vs 모바일 방향 결정", dday: -120 },
      { text: "모시는 글 문구 작성", dday: -100 },
      { text: "하객 명단 양가 취합", dday: -90, priority: "yellow" },
      { text: "종이 청첩장 업체 선정 + 시안", dday: -75 },
      { text: "종이 청첩장 인쇄", dday: -60 },
      { text: "모바일 청첩장 제작", dday: -45 },
      { text: "종이 청첩장 배부 시작", dday: -40 },
      { text: "모바일 청첩장 카톡 발송", dday: -30, priority: "red" },
    ],
  },
  {
    icon: "📸", title: "스냅 · 식전영상",
    items: [
      { text: "스냅 업체 리서치 + 포트폴리오 비교", dday: -150 },
      { text: "스냅 업체 선정 및 계약", dday: -120, priority: "yellow" },
      { text: "식전영상용 사진 양가 수집", dday: -60 },
      { text: "식전영상 편집", dday: -30 },
      { text: "식전영상 최종본 예식장 전달", dday: -7, priority: "red" },
    ],
  },
  {
    icon: "🏨", title: "하객 숙소",
    items: [
      { text: "예식장 근처 호텔 후보 가격 비교", dday: -90 },
      { text: "객실 플랜 수립 + 예약", dday: -45, priority: "yellow" },
    ],
  },
  {
    icon: "✈️", title: "신혼여행",
    items: [
      { text: "여행지 결정", dday: -120 },
      { text: "항공권 예약", dday: -100, priority: "red" },
      { text: "숙소 예약", dday: -90 },
      { text: "여행 일정 짜기", dday: -30 },
      { text: "여권 만료일 확인 / 환전", dday: -14 },
    ],
  },
  {
    icon: "🎯", title: "본식 준비",
    items: [
      { text: "축의금 계좌 정리", dday: -60 },
      { text: "혼주 한복/양복 준비", dday: -45 },
      { text: "답례품 결정 + 주문", dday: -30 },
      { text: "사회자 · 축가 섭외", dday: -30 },
      { text: "2차 장소 결정", dday: -21 },
      { text: "예식 당일 타임라인 정리", dday: -7 },
      { text: "준비물 체크 (예물·서류·소품)", dday: -2, priority: "red" },
    ],
  },
  {
    icon: "📋", title: "행정 · 신혼집",
    items: [
      { text: "신혼집 계약 / 입주 준비", dday: -120 },
      { text: "혼인신고 서류 준비", dday: -7 },
      { text: "혼인신고", dday: 1 },
      { text: "주소 이전 · 각종 명의 변경", dday: 14 },
    ],
  },
];

/** 결혼식 날짜(ISO)가 주어지면 각 항목의 dueDate를 자동 계산. 없으면 dueDate 비움. */
export function defaultChecklist(weddingDateISO?: string): ChecklistSection[] {
  const base = weddingDateISO ? new Date(weddingDateISO) : null;
  const validBase = base && !isNaN(base.getTime()) ? base : null;

  return TEMPLATE.map((sec) => ({
    id: id(),
    icon: sec.icon,
    title: sec.title,
    items: sec.items.map((it) => {
      let dueDate: string | undefined;
      if (validBase) {
        const d = new Date(validBase);
        d.setDate(d.getDate() + it.dday);
        dueDate = d.toISOString().split("T")[0];
      }
      return {
        id: id(),
        text: it.text,
        done: false,
        ddayOffset: it.dday,
        dueDate,
        priority: it.priority,
      } as CheckItem;
    }),
  }));
}

/** 결혼식 날짜가 바뀌었을 때 기존 체크리스트의 dueDate를 재계산. */
export function recalcDueDates(sections: ChecklistSection[], weddingDateISO?: string): ChecklistSection[] {
  const base = weddingDateISO ? new Date(weddingDateISO) : null;
  const validBase = base && !isNaN(base.getTime()) ? base : null;
  return sections.map((sec) => ({
    ...sec,
    items: sec.items.map((it) => {
      if (it.ddayOffset === undefined) return it;
      if (!validBase) return { ...it, dueDate: undefined };
      const d = new Date(validBase);
      d.setDate(d.getDate() + it.ddayOffset);
      return { ...it, dueDate: d.toISOString().split("T")[0] };
    }),
  }));
}
