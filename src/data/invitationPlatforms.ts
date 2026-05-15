// 다른 청첩장 플랫폼·업체 안내.
// wedding-os 직접 비교가 아니라 "객관적으로 알아보기" 목적.
// URL은 메인 도메인 위주 (URL이 변하기 쉬워서).

export type PlatformEntry = {
  name: string;
  desc: string;
  url?: string;
};

export const PAPER_INVITATIONS: PlatformEntry[] = [
  { name: "바른손카드",   desc: "전통 강자, 디자인 종류 가장 많음",  url: "https://www.barunsoncard.com/" },
  { name: "카드마을",     desc: "온라인 가성비, 빠른 제작",          url: "https://www.cardmaeul.com/" },
  { name: "잇츠카드",     desc: "모바일·종이 번들 인기",             url: "https://www.itscard.co.kr/" },
  { name: "디얼디어",     desc: "감성 디자인",                       url: "https://www.deardear.co.kr/" },
  { name: "보자기카드",   desc: "한국적 정통",                       url: "https://www.bojagicard.co.kr/" },
  { name: "옵션더카드",   desc: "프리미엄 커스텀 디자인" },
];

export const MOBILE_INVITATIONS: PlatformEntry[] = [
  { name: "더무드 (theMood)",   desc: "감성·디자인 다양",            url: "https://themood.co.kr/" },
  { name: "마음꽃",             desc: "한국적·따뜻한 디자인" },
  { name: "카드의정석",         desc: "RSVP·갤러리·BGM 풍부" },
  { name: "잇츠카드 모바일",     desc: "심플·빠른 제작",              url: "https://www.itscard.co.kr/" },
  { name: "바른손 모바일",       desc: "종이와 디자인 연결",          url: "https://www.barunsoncard.com/" },
  { name: "카카오톡 청첩장",     desc: "카톡 내에서 바로 제작·발송",   url: "https://moa.kakao.com/" },
];
