// 다른 청첩장 플랫폼·업체 안내.
// wedding-os 와 비교/평가 목적이 아니라, 사용자가 시장의 다른 옵션을 알 수 있도록 정리한 목록.
// 평가성 표현은 피하고 사실 위주의 짧은 설명만 둠.
// 표시 삭제·정정 요청은 yclee913@gmail.com 으로 — 24시간 내 처리.
// URL은 메인 도메인 위주 (URL이 변하기 쉬워서).

export type PlatformEntry = {
  name: string;
  desc: string;
  url?: string;
};

export const PAPER_INVITATIONS: PlatformEntry[] = [
  { name: "바른손카드",   desc: "종이 청첩장 전문",                  url: "https://www.barunsoncard.com/" },
  { name: "카드마을",     desc: "온라인 주문 제작",                  url: "https://www.cardmaeul.com/" },
  { name: "잇츠카드",     desc: "종이·모바일 청첩장",                url: "https://www.itscard.co.kr/" },
  { name: "디얼디어",     desc: "종이 청첩장 제작",                  url: "https://www.deardear.co.kr/" },
  { name: "보자기카드",   desc: "종이 청첩장 제작",                  url: "https://www.bojagicard.co.kr/" },
  { name: "옵션더카드",   desc: "커스텀 디자인 청첩장" },
];

export const MOBILE_INVITATIONS: PlatformEntry[] = [
  { name: "더무드 (theMood)",   desc: "모바일 청첩장 제작",          url: "https://themood.co.kr/" },
  { name: "마음꽃",             desc: "모바일 청첩장 제작" },
  { name: "카드의정석",         desc: "모바일 청첩장 (RSVP·갤러리·BGM 지원)" },
  { name: "잇츠카드 모바일",     desc: "모바일 청첩장 제작",          url: "https://www.itscard.co.kr/" },
  { name: "바른손 모바일",       desc: "모바일 청첩장 제작",          url: "https://www.barunsoncard.com/" },
  { name: "카카오톡 청첩장",     desc: "카카오톡 내 청첩장 발송 (Kakao Corp.)", url: "https://moa.kakao.com/" },
];
