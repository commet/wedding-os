import type { WeddingData } from "./schema";

export type ConsultationSectionId =
  | "venues"
  | "sdm"
  | "snap"
  | "trip"
  | "invitation"
  | "guests"
  | "budget"
  | "checklist"
  | "ceremony"
  | "video"
  | "share";

export type ConsultationOption = {
  value: string;
  label: string;
  detail: string;
};

export type ConsultationQuestion = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  options: ConsultationOption[];
};

export type ConsultationMeta = {
  label: string;
  route: string;
  title: string;
  closedTitle: string;
  summary: string;
};

export const CONSULTATION_META: Record<ConsultationSectionId, ConsultationMeta> = {
  venues: {
    label: "예식장",
    route: "/venues",
    title: "예식장 기준 잡기",
    closedTitle: "예식장 기준을 먼저 묻는 중",
    summary: "지역, 인원, 홀 분위기, 상담 우선순위를 먼저 잡으면 후보가 훨씬 빨리 줄어듭니다.",
  },
  sdm: {
    label: "스드메",
    route: "/sdm",
    title: "스드메 기준 잡기",
    closedTitle: "스드메 기준을 먼저 묻는 중",
    summary: "토탈/분리, 촬영 톤, 예산 상한을 먼저 정하면 상담할 업체가 선명해집니다.",
  },
  snap: {
    label: "본식 스냅",
    route: "/snap",
    title: "본식 스냅 기준 잡기",
    closedTitle: "스냅 기준을 먼저 묻는 중",
    summary: "사진 톤, 촬영 범위, 납품 방식만 정해도 비교해야 할 업체가 크게 줄어듭니다.",
  },
  trip: {
    label: "신혼여행",
    route: "/trip",
    title: "여행 기준 잡기",
    closedTitle: "여행 기준을 먼저 묻는 중",
    summary: "휴양/관광 비율, 예산, 항공 피로도, 숙소 기준을 잡고 지역을 좁힙니다.",
  },
  invitation: {
    label: "청첩장",
    route: "/invitation",
    title: "청첩장 기준 잡기",
    closedTitle: "청첩장 톤을 먼저 묻는 중",
    summary: "문안 톤, 사진 사용, RSVP와 공개 범위를 정하면 편집할 칸이 줄어듭니다.",
  },
  guests: {
    label: "하객",
    route: "/guests",
    title: "하객 정리 기준 잡기",
    closedTitle: "하객 정리 기준을 먼저 묻는 중",
    summary: "규모, 분류 방식, 회신 수집, 식수 기준을 정해야 명단이 운영표로 이어집니다.",
  },
  budget: {
    label: "예산",
    route: "/budget",
    title: "예산 기준 잡기",
    closedTitle: "예산 관리 기준을 먼저 묻는 중",
    summary: "상한, 관리 방식, 위험 항목, 결제 리듬을 정하면 숫자가 덜 흔들립니다.",
  },
  checklist: {
    label: "체크리스트",
    route: "/checklist",
    title: "체크리스트 기준 잡기",
    closedTitle: "준비 리듬을 먼저 묻는 중",
    summary: "누가, 어떤 속도로, 어떤 마감부터 볼지 정하면 할 일이 덜 무섭게 보입니다.",
  },
  ceremony: {
    label: "식순",
    route: "/ceremony",
    title: "본식 진행 기준 잡기",
    closedTitle: "본식 진행 기준을 먼저 묻는 중",
    summary: "식 분위기, 사회자, 가족 참여, 현장 운영 기준을 정하면 식순이 실제 진행표가 됩니다.",
  },
  video: {
    label: "식전영상",
    route: "/video",
    title: "영상 기준 잡기",
    closedTitle: "영상 톤을 먼저 묻는 중",
    summary: "영상 길이, 사진량, 음악 톤, 출력 방식을 정하면 편집 선택지가 줄어듭니다.",
  },
  share: {
    label: "공유/백업",
    route: "/share",
    title: "공유 기준 잡기",
    closedTitle: "공유와 백업 기준을 먼저 묻는 중",
    summary: "누가 편집하고, 무엇을 내보내고, 언제 백업할지 정해두면 마지막에 덜 불안합니다.",
  },
};

export const CONSULTATION_QUESTIONS: Record<ConsultationSectionId, ConsultationQuestion[]> = {
  venues: [
    q("venues-region", "01 · 지역", "가장 먼저 볼 지역은 어디에 가까워요?", "후보가 너무 많을 때는 지역을 먼저 좁히는 게 상담 피로도를 가장 크게 줄입니다.", [
      o("gangnam", "강남·청담", "접근성, 브랜드 홀, 호텔 후보를 넓게 보기"),
      o("central", "광화문·중구", "도심 호텔과 교통 중심 후보 보기"),
      o("han", "여의도·한남·잠실", "한강권, 호텔, 컨벤션을 함께 보기"),
      o("gyeonggi", "경기·인천", "주차와 대형 홀을 넓게 보기"),
      o("local", "지방 포함", "양가 지역과 이동 부담을 같이 보기"),
    ]),
    q("venues-scale", "02 · 인원", "예상 하객 규모는 어느 정도인가요?", "보증인원과 식대는 인원에서 바로 갈립니다. 대략만 잡아도 괜찮아요.", [
      o("small", "100명 안팎", "하우스·소규모·프라이빗 후보도 열어두기"),
      o("medium", "200명 안팎", "일반 예식장과 호텔 일부 비교"),
      o("large", "300명 이상", "컨벤션·대형 홀 위주로 보기"),
      o("unknown", "아직 몰라요", "하객 추정부터 오늘 할 일로 올리기"),
    ]),
    q("venues-hall", "03 · 분위기", "홀 분위기는 어느 쪽이 더 좋아요?", "사진 취향보다 실제로는 동시 예식 수, 천고, 조명, 동선이 같이 따라옵니다.", [
      o("hotel", "호텔/클래식", "서비스와 격식, 식사 안정감 우선"),
      o("chapel", "채플/어두운 홀", "입장 연출과 사진 분위기 우선"),
      o("bright", "밝은 홀/하우스", "자연광과 프라이빗한 느낌 우선"),
      o("convention", "컨벤션/대형", "수용 인원과 주차 안정성 우선"),
    ]),
    q("venues-priority", "04 · 우선순위", "상담에서 제일 먼저 확인할 조건은요?", "같은 견적이어도 무엇을 먼저 물을지 정해두면 상담 후 비교가 쉬워요.", [
      o("meal", "음식과 식대", "식대, 음주류, 봉사료, 시식 조건"),
      o("traffic", "교통과 주차", "대중교통, 셔틀, 주차권, 혼잡도"),
      o("privacy", "단독감", "동시 예식, 신부대기실, 로비 동선"),
      o("contract", "계약 리스크", "환불, 날짜 변경, 별도 비용"),
    ]),
  ],
  sdm: [
    q("sdm-scope", "01 · 방식", "스드메는 어떤 방식이 편할까요?", "토탈은 편하고, 분리는 취향과 가격을 더 세밀하게 조정할 수 있어요.", [
      o("total", "토탈 패키지", "상담과 일정 관리 피로도 줄이기"),
      o("split", "업체별로 분리", "취향·가격·작가 지정까지 따로 비교"),
      o("hybrid", "핵심만 분리", "드레스나 스튜디오만 따로 보는 절충안"),
    ]),
    q("sdm-tone", "02 · 촬영 톤", "사진 톤은 어디에 가까워요?", "스튜디오와 메이크업 기준이 같이 좁혀집니다.", [
      o("clean", "깔끔한 인물 중심", "유행을 덜 타는 기본기 우선"),
      o("natural", "자연광·야외 느낌", "밝고 편한 분위기 우선"),
      o("dramatic", "무드 있고 영화처럼", "조명, 색감, 연출력 우선"),
      o("classic", "정통 웨딩", "드레스와 포즈 완성도 우선"),
    ]),
    q("sdm-budget", "03 · 예산", "스드메 총액 상한은 어디쯤인가요?", "상한이 있어야 원본비, 헬퍼비, 출장비를 숨은 비용으로 볼 수 있어요.", [
      o("under250", "250만 이하", "실속형과 구성 단순화 우선"),
      o("250to400", "250~400만", "대표 패키지 비교 구간"),
      o("400plus", "400만 이상", "작가 지정과 드레스 선택 폭까지 보기"),
    ]),
    q("sdm-risk", "04 · 민감한 조건", "계약 전에 제일 걱정되는 건요?", "견적 메모와 상담 질문에서 이 항목을 먼저 보게 됩니다.", [
      o("extras", "추가금", "헬퍼비, 원본비, 출장비, 드레스 업차지"),
      o("schedule", "일정", "촬영일, 셀렉일, 본식 전 납품 여유"),
      o("quality", "결과물", "작가 지정, 보정 스타일, 샘플 일관성"),
    ]),
  ],
  snap: [
    q("snap-style", "01 · 사진 톤", "본식 스냅은 어떤 느낌이면 좋겠어요?", "본식 스냅은 예쁜 샘플보다 당일 순간 포착과 납품 안정성이 중요해요.", [
      o("documentary", "자연스러운 기록", "하객 표정과 순간 포착 우선"),
      o("editorial", "화보처럼", "인물, 조명, 구도 완성도 우선"),
      o("bright", "밝고 깨끗하게", "색감 안정성과 보정 톤 우선"),
    ]),
    q("snap-coverage", "02 · 범위", "어디부터 찍히면 좋을까요?", "촬영 범위에 따라 작가 수와 견적이 크게 달라집니다.", [
      o("ceremony", "본식 중심", "식 시작 전후 핵심 장면 위주"),
      o("prep", "메이크업부터", "준비 과정과 대기실까지 기록"),
      o("full", "폐백/피로연까지", "당일 전체 동선 기록"),
    ]),
    q("snap-delivery", "03 · 납품", "납품에서 제일 중요한 건요?", "후회가 많은 부분이라 계약서에 남길 기준을 먼저 정합니다.", [
      o("speed", "빠른 선보정", "SNS·감사 인사용 사진 빠르게 받기"),
      o("quantity", "충분한 컷 수", "원본과 보정본 수량 우선"),
      o("album", "앨범 완성도", "인화, 앨범, 보관 품질 우선"),
    ]),
  ],
  trip: [
    q("trip-pace", "01 · 분위기", "신혼여행은 어떤 리듬이 좋아요?", "지역보다 여행 리듬을 먼저 정하면 항공과 숙소 기준이 같이 잡힙니다.", [
      o("rest", "휴양 위주", "리조트, 수영장, 이동 적은 일정"),
      o("balanced", "휴양+관광 균형", "쉬는 날과 움직이는 날을 같이"),
      o("active", "관광·맛집 위주", "도시 이동과 예약 난이도까지 보기"),
      o("short", "짧고 편하게", "직항, 이동 피로도, 시차 우선"),
    ]),
    q("trip-budget", "02 · 예산", "항공+숙소 예산은 어떤 쪽인가요?", "예산대가 있어야 지역과 숙소 등급을 현실적으로 좁힐 수 있어요.", [
      o("value", "실속형", "항공 가격과 위치 좋은 숙소 우선"),
      o("mid", "중간형", "편안함과 경험 균형"),
      o("luxury", "한 번뿐인 럭셔리", "객실, 전망, 허니문 베네핏 우선"),
    ]),
    q("trip-flight", "03 · 항공", "비행 피로도는 어디까지 괜찮아요?", "직항 여부와 경유 시간을 먼저 정하면 후보 지역이 빠르게 줄어요.", [
      o("direct", "직항 우선", "조금 비싸도 피로도 낮추기"),
      o("one-stop", "1회 경유 가능", "가격과 지역 선택지 넓히기"),
      o("flexible", "상관없음", "숙소와 총액 중심으로 보기"),
    ]),
    q("trip-stay", "04 · 숙소", "숙소에서 제일 중요한 건요?", "같은 지역도 숙소 기준에 따라 동선과 총액이 달라집니다.", [
      o("pool", "풀빌라·리조트", "객실 안에서 쉬는 시간 우선"),
      o("location", "위치", "관광·식당·이동 편의 우선"),
      o("view", "전망·분위기", "허니문다운 기억 우선"),
    ]),
  ],
  invitation: [
    q("invitation-tone", "01 · 문안", "청첩장 문안은 어떤 톤이 좋아요?", "문안 톤이 정해지면 인사말과 전체 디자인 선택이 쉬워집니다.", [
      o("classic", "정중하고 단정하게", "부모님·어른 하객에게 안정적인 톤"),
      o("warm", "따뜻하고 자연스럽게", "두 사람의 말투가 느껴지는 톤"),
      o("short", "짧고 절제 있게", "모바일에서 부담 없이 읽히는 톤"),
    ]),
    q("invitation-photo", "02 · 사진", "사진은 어떻게 쓰고 싶어요?", "대표사진과 갤러리 양을 정하면 모바일 피로도가 줄어듭니다.", [
      o("hero", "대표사진 크게", "첫 화면에서 분위기를 보여주기"),
      o("gallery", "여러 장 갤러리", "두 사람의 이야기를 조금 더 보여주기"),
      o("minimal", "사진 적게", "정보와 문안 중심으로 깔끔하게"),
    ]),
    q("invitation-rsvp", "03 · 회신", "하객 회신은 어떻게 받을까요?", "회신 방식이 정해져야 하객 명단과 식수 계산이 이어집니다.", [
      o("simple", "참석 여부만", "하객 부담을 줄이는 최소 회신"),
      o("meal", "식사 여부까지", "식권과 식수 정산까지 연결"),
      o("manual", "직접 연락으로", "가까운 하객 중심으로 따로 취합"),
    ]),
    q("invitation-privacy", "04 · 공개 범위", "민감 정보는 어느 정도 공개할까요?", "계좌, 연락처, 지도 정보는 공유 전 기준이 필요합니다.", [
      o("full", "필요 정보 모두", "문의가 줄도록 상세히 공개"),
      o("limited", "최소한만", "연락처·계좌 노출 줄이기"),
      o("after", "나중에 추가", "기본 청첩장 먼저 만들기"),
    ]),
  ],
  guests: [
    q("guests-scale", "01 · 규모", "전체 하객은 어느 정도로 잡을까요?", "정확하지 않아도 보증인원과 식대 예산의 출발점이 됩니다.", [
      o("small", "150명 이하", "가까운 관계 중심으로 정리"),
      o("medium", "150~250명", "양가 균형과 직장/친구 분류 필요"),
      o("large", "250명 이상", "초대/회신/좌석 운영을 일찍 나누기"),
      o("unknown", "아직 몰라요", "양가 예상치부터 나눠 적기"),
    ]),
    q("guests-source", "02 · 작성 방식", "명단은 어디서부터 만들까요?", "처음부터 완벽한 명단보다 출처를 정해 단계적으로 채우는 게 편합니다.", [
      o("parents", "양가 부모님 명단", "친척과 어른 하객 먼저"),
      o("couple", "두 사람 연락처", "친구·직장·학교 중심"),
      o("groups", "그룹별 추정", "아직 이름이 없어도 규모부터"),
    ]),
    q("guests-rsvp", "03 · 회신", "회신은 어떻게 모을까요?", "초대 완료 표시와 RSVP 진행률이 여기서 이어집니다.", [
      o("invitation", "청첩장 링크로", "앱 안 RSVP와 바로 연결"),
      o("message", "카톡/문자로", "직접 확인하고 상태만 표시"),
      o("mixed", "섞어서", "어른 하객은 직접, 친구는 링크"),
    ]),
    q("guests-meal", "04 · 식수", "식사 인원은 얼마나 보수적으로 볼까요?", "식권과 식대 정산은 참석자보다 식사 여부가 더 중요합니다.", [
      o("safe", "넉넉하게", "부족 리스크 줄이기"),
      o("exact", "회신 기준", "확정된 사람 중심"),
      o("tight", "보수적으로", "노쇼와 불참 가능성 반영"),
    ]),
  ],
  budget: [
    q("budget-ceiling", "01 · 상한", "전체 예산 상한은 어떻게 잡을까요?", "상한이 있어야 초과 항목을 먼저 잡아낼 수 있어요.", [
      o("lean", "꼭 필요한 것만", "예식장·식대·필수 업체 중심"),
      o("balanced", "균형형", "중요 파트에는 쓰고 덜 중요한 곳은 줄이기"),
      o("generous", "만족도 우선", "사진·영상·여행 같은 기억 파트도 열어두기"),
    ]),
    q("budget-method", "02 · 관리 방식", "예산표는 어떻게 쓰는 게 편해요?", "관리 방식에 따라 보여줄 다음 행동이 달라집니다.", [
      o("planned", "예상 먼저", "계약 전 큰 금액을 먼저 잡기"),
      o("actual", "쓴 돈 중심", "결제한 금액부터 정확히"),
      o("cashflow", "잔금 일정 중심", "언제 얼마 나갈지 우선"),
    ]),
    q("budget-risk", "03 · 걱정", "제일 무서운 초과 항목은요?", "이 항목을 대시보드에서 먼저 보게 됩니다.", [
      o("meal", "식대", "하객 수와 계약 식대 연결"),
      o("vendors", "업체 추가금", "원본비, 헬퍼비, 출장비, 옵션"),
      o("trip", "신혼여행", "항공·숙소 변동성"),
    ]),
    q("budget-payment", "04 · 결제", "결제 관리는 무엇이 중요해요?", "계약금과 잔금일을 놓치지 않게 정리합니다.", [
      o("due", "잔금일", "다가오는 결제를 먼저 보기"),
      o("method", "결제수단", "카드, 현금영수증, 할부 확인"),
      o("proof", "증빙", "계약서와 영수증 위치 남기기"),
    ]),
  ],
  checklist: [
    q("checklist-mode", "01 · 보기", "체크리스트는 어떤 방식이 편해요?", "할 일이 많을수록 보기 방식을 먼저 정해야 덜 압도됩니다.", [
      o("timeline", "날짜순", "가까운 마감부터 처리"),
      o("category", "분야별", "예식장, 하객, 청첩장처럼 묶어서 보기"),
      o("weekly", "이번 주만", "지금 할 일만 작게 보기"),
    ]),
    q("checklist-owner", "02 · 담당", "할 일은 어떻게 나눌까요?", "담당 기준을 정하면 서로 미루는 일이 줄어듭니다.", [
      o("together", "같이 결정", "중요 결정은 함께"),
      o("split", "파트별 담당", "각자 맡은 분야를 나누기"),
      o("one-lead", "한 명이 정리", "한 사람이 보드 관리, 결정은 함께"),
    ]),
    q("checklist-pace", "03 · 속도", "준비 속도는 어느 쪽이 맞아요?", "마감 경고의 강도를 정하는 기준이 됩니다.", [
      o("early", "일찍 끝내기", "마감을 넉넉히 앞당겨 보기"),
      o("steady", "꾸준히", "매주 조금씩 처리"),
      o("last", "필요할 때 몰아서", "임박한 일만 강하게 보기"),
    ]),
  ],
  ceremony: [
    q("ceremony-style", "01 · 분위기", "본식은 어떤 분위기면 좋겠어요?", "식순의 길이와 멘트 톤이 여기서 갈립니다.", [
      o("classic", "정중하고 클래식", "부모님과 어른 하객을 배려한 진행"),
      o("warm", "따뜻하고 자연스럽게", "두 사람 이야기와 웃음이 있는 진행"),
      o("short", "짧고 담백하게", "하객 피로도와 시간 엄수 우선"),
    ]),
    q("ceremony-host", "02 · 사회", "사회자는 어떤 방식인가요?", "사회자용 시트에 들어갈 디테일이 달라집니다.", [
      o("professional", "전문 사회자", "큐시트와 시간표 중심"),
      o("friend", "지인 사회자", "멘트와 동선까지 자세히"),
      o("venue", "식장 진행", "식장 기본안 검수 중심"),
    ]),
    q("ceremony-family", "03 · 가족 참여", "가족 참여는 어느 정도 생각하세요?", "화촉점화, 덕담, 축사, 혼인서약 흐름이 달라집니다.", [
      o("minimal", "최소한만", "핵심 의식 위주"),
      o("speech", "덕담·축사 포함", "말하는 순서와 시간 관리 필요"),
      o("custom", "우리식으로", "개인화된 순서와 멘트 필요"),
    ]),
  ],
  video: [
    q("video-tone", "01 · 톤", "식전영상은 어떤 느낌이면 좋겠어요?", "사진 선택, 음악, 자막 길이가 같이 결정됩니다.", [
      o("warm", "따뜻하고 감성적으로", "가족·연애 사진 중심"),
      o("bright", "밝고 경쾌하게", "친구·여행·웃는 장면 중심"),
      o("cinematic", "영화처럼", "느린 전환과 분위기 있는 음악"),
      o("minimal", "짧고 깔끔하게", "하객 피로도를 줄이는 구성"),
    ]),
    q("video-length", "02 · 길이", "영상 길이는 어느 정도가 좋을까요?", "길이를 정하면 필요한 사진 수와 음악 길이가 바로 잡힙니다.", [
      o("short", "1분 안팎", "핵심 사진만 빠르게"),
      o("medium", "2~3분", "가장 무난한 식전영상 길이"),
      o("long", "4분 이상", "스토리와 챕터를 충분히"),
    ]),
    q("video-photos", "03 · 사진량", "사진은 어떤 기준으로 고를까요?", "사진을 많이 넣는 것보다 장면 역할을 정하는 게 중요합니다.", [
      o("couple", "두 사람 중심", "연애와 여행 사진 위주"),
      o("family", "가족도 함께", "부모님과 어린 시절 사진 포함"),
      o("mix", "친구·일상까지", "밝고 풍성한 분위기"),
    ]),
    q("video-output", "04 · 출력", "마지막 출력에서 제일 중요한 건요?", "완성 전 확인해야 할 기술 조건이 달라집니다.", [
      o("venue", "식장 재생 안정성", "해상도, 길이, 파일 형식 우선"),
      o("quality", "화질", "사진 크기와 압축 관리"),
      o("easy", "빠른 완성", "템플릿과 자동 배치 우선"),
    ]),
  ],
  share: [
    q("share-editor", "01 · 함께 쓰기", "준비판은 누가 같이 편집하나요?", "공유 방식과 복구 링크 관리 기준이 달라집니다.", [
      o("solo", "한 명이 관리", "백업과 내보내기 중심"),
      o("couple", "두 사람이 함께", "편집 초대와 충돌 방지 중심"),
      o("family", "가족도 일부 확인", "보기 전용과 공개 범위 분리"),
    ]),
    q("share-export", "02 · 내보내기", "가장 자주 내보낼 자료는요?", "공유 센터에서 어떤 버튼을 먼저 볼지 정합니다.", [
      o("invitation", "청첩장", "링크, 이미지, 문안 공유"),
      o("guests", "하객 명단", "CSV와 식수 확인"),
      o("budget", "예산표", "지출·잔금 공유"),
      o("all", "전체 백업", "기기 교체와 안전 보관"),
    ]),
    q("share-backup", "03 · 백업", "백업은 어떤 리듬이 편해요?", "로컬 저장 사용자는 이 기준이 안전망이 됩니다.", [
      o("weekly", "매주", "준비가 바쁠 때 안전하게"),
      o("milestone", "큰 결정 후", "계약·발행·명단 업데이트 뒤"),
      o("manual", "필요할 때만", "최소한의 알림"),
    ]),
  ],
};

function q(id: string, eyebrow: string, title: string, body: string, options: ConsultationOption[]): ConsultationQuestion {
  return { id, eyebrow, title, body, options };
}

function o(value: string, label: string, detail: string): ConsultationOption {
  return { value, label, detail };
}

export type ConsultationAnswers = Record<string, string | undefined>;

export function consultationQuestions(sectionId: ConsultationSectionId): ConsultationQuestion[] {
  return CONSULTATION_QUESTIONS[sectionId] ?? [];
}

export function consultationAnswers(data: WeddingData, sectionId: ConsultationSectionId): ConsultationAnswers {
  const questions = consultationQuestions(sectionId);
  const answers: ConsultationAnswers = {};
  for (const question of questions) {
    const item = (data.ai?.dialogue ?? []).find((entry) => entry.id === question.id);
    if (!item) continue;
    const matched = question.options.find((option) => option.value === item.answer || option.label === item.answer);
    if (matched) answers[question.id] = matched.value;
  }
  return answers;
}

export function consultationProgress(data: WeddingData, sectionId: ConsultationSectionId) {
  const questions = consultationQuestions(sectionId);
  const answers = consultationAnswers(data, sectionId);
  const answered = questions.filter((question) => answers[question.id]).length;
  return { answered, total: questions.length || 1, complete: questions.length > 0 && answered === questions.length };
}

export function nextConsultationQuestion(data: WeddingData, sectionId: ConsultationSectionId) {
  const answers = consultationAnswers(data, sectionId);
  return consultationQuestions(sectionId).find((question) => !answers[question.id]) ?? null;
}

export function answerConsultation(
  data: WeddingData,
  sectionId: ConsultationSectionId,
  questionId: string,
  value: string,
): WeddingData {
  const meta = CONSULTATION_META[sectionId];
  const question = consultationQuestions(sectionId).find((item) => item.id === questionId);
  if (!question) return data;
  const option = question.options.find((item) => item.value === value);
  if (!option) return data;
  const answeredAt = new Date().toISOString();
  return {
    ...data,
    ai: {
      ...(data.ai ?? {}),
      dialogue: [
        ...(data.ai?.dialogue ?? []).filter((item) => item.id !== question.id),
        {
          id: question.id,
          question: question.title,
          answer: option.label,
          answeredAt,
        },
      ].slice(-80),
      today: [
        {
          title: `${meta.label} 기준 이어가기`,
          reason: `${option.label} 기준을 반영했어요. 다음 결정도 같은 흐름으로 좁혀볼게요.`,
          targetPath: meta.route,
        },
        ...(data.ai?.today ?? []).filter((item) => item.targetPath !== meta.route),
      ].slice(0, 3),
      updatedAt: answeredAt,
    },
  };
}
