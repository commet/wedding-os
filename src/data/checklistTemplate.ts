import type { ChecklistSection } from "../lib/schema";

let nextId = 0;
const id = () => `cl-${++nextId}-${Math.random().toString(36).slice(2, 7)}`;

export function defaultChecklist(): ChecklistSection[] {
  return [
    {
      id: id(), icon: "💍", title: "결혼반지",
      items: [
        { id: id(), text: "브랜드 후보 비교", done: false, priority: "yellow" },
        { id: id(), text: "신부와 함께 좁히기", done: false },
        { id: id(), text: "매장 방문 예약 + 실물 착용", done: false },
        { id: id(), text: "최종 결정 및 주문", done: false },
        { id: id(), text: "각인 문구 결정", done: false },
        { id: id(), text: "수령", done: false },
      ],
    },
    {
      id: id(), icon: "💌", title: "청첩장",
      items: [
        { id: id(), text: "종이 vs 모바일 병행 방향 결정", done: false },
        { id: id(), text: "모시는 글 문구 작성", done: false },
        { id: id(), text: "하객 명단 양가 취합", done: false },
        { id: id(), text: "종이 청첩장 시안 확정", done: false },
        { id: id(), text: "종이 청첩장 인쇄", done: false },
        { id: id(), text: "종이 청첩장 배부 (D-45~30)", done: false, priority: "red" },
        { id: id(), text: "모바일 청첩장 카톡 발송 (D-30)", done: false, priority: "red" },
      ],
    },
    {
      id: id(), icon: "🏨", title: "하객 숙소 / 본식 호텔",
      items: [
        { id: id(), text: "호텔 후보 가격 비교", done: false },
        { id: id(), text: "객실 플랜 수립", done: false },
        { id: id(), text: "예약 + 결제", done: false, priority: "yellow" },
      ],
    },
    {
      id: id(), icon: "📸", title: "스냅 사진 / 식전영상",
      items: [
        { id: id(), text: "스냅 업체 후보 리서치", done: false },
        { id: id(), text: "포트폴리오 비교", done: false },
        { id: id(), text: "업체 선정 및 계약", done: false },
        { id: id(), text: "식전영상 사진 모으기", done: false },
        { id: id(), text: "식전영상 편집", done: false },
      ],
    },
    {
      id: id(), icon: "✈️", title: "신혼여행",
      items: [
        { id: id(), text: "여행지 결정", done: false },
        { id: id(), text: "항공권 예약", done: false, priority: "yellow" },
        { id: id(), text: "숙소 예약", done: false },
        { id: id(), text: "여행 일정 짜기", done: false },
      ],
    },
    {
      id: id(), icon: "🎯", title: "본식 준비",
      items: [
        { id: id(), text: "예식 장소 최종 세팅 확인", done: false },
        { id: id(), text: "축의금 계좌 정리", done: false },
        { id: id(), text: "혼주 한복/양복 준비", done: false },
        { id: id(), text: "폐백/이바지 준비", done: false },
        { id: id(), text: "답례품 결정", done: false },
        { id: id(), text: "사회자 섭외", done: false },
        { id: id(), text: "축가 섭외", done: false },
        { id: id(), text: "2차 장소 결정", done: false },
      ],
    },
    {
      id: id(), icon: "📋", title: "행정",
      items: [
        { id: id(), text: "혼인신고 준비", done: false },
        { id: id(), text: "주소 이전", done: false },
        { id: id(), text: "보험·은행 정보 변경", done: false },
      ],
    },
  ];
}
