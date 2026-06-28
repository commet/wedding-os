import type { ChecklistSection, CheckItem } from "../lib/schema";
import { formatISODateLocal, parseISODateLocal } from "../lib/date";

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
      { text: "양가 상견례 / 결혼 준비 범위 합의", dday: -390, priority: "yellow" },
      { text: "예식 날짜·시간 확정", dday: -365 },
      { text: "웨딩홀 투어 기준표 만들기 (지역·하객 수·식대·주차·홀 분위기)", dday: -365, priority: "yellow" },
      { text: "예식장 예약 + 계약금", dday: -360, priority: "red" },
      { text: "계약 조건 확인 (취소·환불·보증인원·식대·주차·부가세)", dday: -355, priority: "red" },
      { text: "계약서에 예식 장소·식사 메뉴·지불보증인원·총액·환급 기준 남기기", dday: -355, priority: "red" },
      { text: "취소·변경 환불 기준 캡처/계약서 특약으로 보관", dday: -355, priority: "red" },
      { text: "외부 스냅·영상·사회자·플라워 반입 가능 여부와 반입료 확인", dday: -350, priority: "yellow" },
      { text: "예식 간격·동시 예식 수·신부대기실·하객 동선 확인", dday: -345, priority: "yellow" },
      { text: "스튜디오·드레스·메이크업(스드메) 계약", dday: -300 },
      { text: "본식 스냅·영상 촬영 여부 결정", dday: -180 },
      { text: "시식 일정 잡기 + 메뉴 등급·음주류 포함 여부 확인", dday: -90 },
      { text: "예식장 식순·식사 메뉴 확정", dday: -60 },
      { text: "주차·셔틀·혼주 동선 확인", dday: -30 },
      { text: "예식장 최종 미팅", dday: -14 },
      { text: "잔금·정산 방식 확인", dday: -7 },
    ],
  },
  {
    icon: "💍", title: "결혼반지",
    items: [
      { text: "브랜드 후보 비교", dday: -150 },
      { text: "둘이 함께 2~3개로 좁히기", dday: -135 },
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
      { text: "이름·날짜·주소·계좌 오탈자 검수", dday: -65, priority: "red" },
      { text: "종이 청첩장 인쇄", dday: -60 },
      { text: "모바일 청첩장 제작", dday: -45 },
      { text: "종이 청첩장 배부 시작", dday: -40 },
      { text: "모바일 청첩장 테스트 발송", dday: -35 },
      { text: "RSVP는 이름·측·참석 여부·인원·식사 메모처럼 필요한 정보만 받기", dday: -35, priority: "yellow" },
      { text: "공유 전 공개 정보 확인 (계좌·연락처·주소·사진 공개 범위)", dday: -32, priority: "red" },
      { text: "모바일 청첩장 카톡 발송", dday: -30, priority: "red" },
      { text: "참석 여부 1차 취합", dday: -14 },
    ],
  },
  {
    icon: "📸", title: "스냅 · 식전영상",
    items: [
      { text: "스냅 업체 리서치 + 포트폴리오 비교", dday: -150 },
      { text: "스냅 업체 선정 및 계약", dday: -120, priority: "yellow" },
      { text: "촬영 원본·보정본 제공 범위 확인", dday: -110 },
      { text: "식전영상용 사진 양가 수집", dday: -60 },
      { text: "식전영상 편집", dday: -30 },
      { text: "식전영상 예식장 재생 테스트", dday: -10, priority: "yellow" },
      { text: "식전영상 최종본 예식장 전달", dday: -7, priority: "red" },
    ],
  },
  {
    icon: "👗", title: "의상 · 뷰티",
    items: [
      { text: "드레스 투어 / 예복 상담 일정 잡기", dday: -180 },
      { text: "촬영 드레스·예복 결정", dday: -120 },
      { text: "본식 드레스·예복 결정", dday: -90, priority: "yellow" },
      { text: "헤어·메이크업 리허설", dday: -45 },
      { text: "본식 가봉 / 사이즈 최종 확인", dday: -21, priority: "red" },
      { text: "부케·부토니에 색감 확정", dday: -14 },
    ],
  },
  {
    icon: "🏨", title: "하객 숙소",
    items: [
      { text: "예식장 근처 호텔 후보 가격 비교", dday: -90 },
      { text: "객실 플랜 수립 + 예약", dday: -45, priority: "yellow" },
      { text: "지방/해외 하객 안내 메시지 정리", dday: -30 },
    ],
  },
  {
    icon: "✈️", title: "신혼여행",
    items: [
      { text: "여행지 결정", dday: -120 },
      { text: "항공권 예약", dday: -100, priority: "red" },
      { text: "숙소 예약", dday: -90 },
      { text: "여권·비자·입국 요건 확인", dday: -60, priority: "red" },
      { text: "여행 일정 짜기", dday: -30 },
      { text: "여행자보험 / 환전 / 로밍 준비", dday: -14 },
    ],
  },
  {
    icon: "🎯", title: "본식 준비",
    items: [
      { text: "축의금 계좌 정리", dday: -60 },
      { text: "혼주 한복/양복 준비", dday: -45 },
      { text: "답례품 결정 + 주문", dday: -30 },
      { text: "사회자 · 축가 섭외", dday: -30 },
      { text: "폐백 여부 결정 · 폐백실·방석·이바지·혼주 동선 확인", dday: -30 },
      { text: "주례·사회자·축가 큐시트 공유", dday: -14, priority: "yellow" },
      { text: "2차 장소 결정", dday: -21 },
      { text: "예식 당일 타임라인 정리", dday: -7 },
      { text: "음향·음악 최종 점검 (마이크·입장곡·축가 음량 + 백업 USB)", dday: -5, priority: "yellow" },
      { text: "신부·혼주 대기실 준비물 확인 (음료·응급약·슬리퍼·여분 스타킹)", dday: -3 },
      { text: "축의금·식권 수거 담당 정하기 (양가 1명씩, 입구)", dday: -3, priority: "yellow" },
      { text: "혼주·가족 촬영 순서 공유", dday: -5 },
      { text: "당일 담당자 연락망 정리", dday: -3, priority: "yellow" },
      { text: "준비물 체크 (예물·서류·소품)", dday: -2, priority: "red" },
      { text: "계약 업체 잔금 / 팁 / 사례비 봉투 준비", dday: -1, priority: "red" },
    ],
  },
  {
    icon: "📋", title: "행정 · 신혼집",
    items: [
      { text: "신혼집 계약 / 입주 준비", dday: -120 },
      { text: "임대차라면 등기부등본·선순위 권리·보증보험 가능 여부 확인", dday: -45, priority: "yellow" },
      { text: "전입신고·확정일자 처리 방법 확인", dday: -30, priority: "yellow" },
      { text: "관리비·공과금·인터넷·우편물 이전 신청", dday: -21 },
      { text: "혼인신고서·신분증·증인 2명 서명 확인", dday: -7 },
      { text: "혼인신고 방문/우편 제출 방법 확인", dday: -3 },
      { text: "혼인신고", dday: 1 },
      { text: "혼인관계증명서·가족관계증명서 발급 경로 확인", dday: 7 },
      { text: "주소 이전 · 각종 명의 변경", dday: 14 },
      { text: "예식 비용 최종 정산 / 영수증 정리", dday: 7 },
      { text: "임신 계획이 있다면 e보건소 임신 사전건강관리 지원 확인", dday: 30 },
    ],
  },
];

/** 결혼식 날짜(ISO)가 주어지면 각 항목의 dueDate를 자동 계산. 없으면 dueDate 비움. */
export function defaultChecklist(weddingDateISO?: string): ChecklistSection[] {
  const validBase = parseISODateLocal(weddingDateISO);

  return TEMPLATE.map((sec) => ({
    id: id(),
    icon: sec.icon,
    title: sec.title,
    items: sec.items.map((it) => {
      let dueDate: string | undefined;
      if (validBase) {
        const d = new Date(validBase);
        d.setDate(d.getDate() + it.dday);
        dueDate = formatISODateLocal(d);
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
  const validBase = parseISODateLocal(weddingDateISO);
  return sections.map((sec) => ({
    ...sec,
    items: sec.items.map((it) => {
      if (it.ddayOffset === undefined) return it;
      if (!validBase) return { ...it, dueDate: undefined };
      const d = new Date(validBase);
      d.setDate(d.getDate() + it.ddayOffset);
      return { ...it, dueDate: formatISODateLocal(d) };
    }),
  }));
}
