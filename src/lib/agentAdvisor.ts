import type { BudgetItem, WeddingData } from "./schema";
import { daysSince } from "./freshness";
import { daysUntilISODate } from "./date";

export type AgentSeverity = "danger" | "warn" | "info" | "good";

export type AgentFinding = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  severity: AgentSeverity;
  category: "legal" | "privacy" | "money" | "schedule" | "content" | "security" | "data";
  to?: string;
  action?: string;
  count?: number;
};

export type AgentReport = {
  score: number;
  danger: number;
  warn: number;
  good: number;
  findings: AgentFinding[];
};

const STALE_DAYS = 90;
const BACKUP_STALE_DAYS = 7;

export const AGENT_REFERENCE_LINKS = [
  {
    label: "개인정보 처리방침 작성지침",
    href: "https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=20885",
  },
  {
    label: "개인정보 국외이전 제도",
    href: "https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=367",
  },
  {
    label: "공유마당 자유이용 저작물",
    href: "https://gongu.copyright.or.kr/",
  },
  {
    label: "한국저작권위원회 상담",
    href: "https://www.copyright.or.kr/",
  },
];

export function buildAgentReport(data: WeddingData): AgentReport {
  const findings: AgentFinding[] = [
    invitationReadiness(data),
    weddingDateWindow(data),
    ceremonyTimeCompleteness(data),
    venueDirectionsCompleteness(data),
    publicContactExposure(data),
    accountFormatRisk(data),
    greetingSensitiveText(data),
    recoveryLinkRisk(data),
    guestPrivacy(data),
    guestHeadcountReadiness(data),
    mealHeadcountReadiness(data),
    rsvpScope(data),
    bgmCopyright(data),
    photoRights(data),
    imageVolumeRisk(data),
    videoReadiness(data),
    vendorFreshness(data),
    vendorDecisionProgress(data),
    venueCapacityFit(data),
    budgetOverrun(data),
    unpaidBudgetItems(data),
    overdueChecklist(data),
    honeymoonDocumentReadiness(data),
    backupHealth(data),
    aiPromptPrivacy(data),
    translationCompleteness(data),
    externalLinkSafety(data),
    publishFreshness(data),
    internationalTransferNotice(data),
    contractEvidence(data),
  ];
  const danger = findings.filter((f) => f.severity === "danger").length;
  const warn = findings.filter((f) => f.severity === "warn").length;
  const good = findings.filter((f) => f.severity === "good").length;
  const score = Math.max(0, Math.min(100, 100 - danger * 14 - warn * 6));
  return { score, danger, warn, good, findings };
}

function invitationReadiness(data: WeddingData): AgentFinding {
  const missing = [
    ["신랑 이름", data.invitation.groomName],
    ["신부 이름", data.invitation.brideName],
    ["예식 날짜", data.invitation.date],
    ["예식 장소", data.invitation.venue],
    ["인사말", data.invitation.greeting],
  ].filter(([, value]) => !String(value ?? "").trim());
  if (missing.length === 0) {
    return good("content", "청첩장 기본 정보", "필수 공개 정보가 채워져 있어요.", "공유 전에는 실제 식장 표기와 시간을 한 번 더 대조하세요.", "/invitation");
  }
  return {
    id: "invitation-readiness",
    category: "content",
    severity: "warn",
    title: "청첩장 필수 정보 누락",
    summary: `${missing.length}개 항목이 비어 있어요.`,
    detail: `비어 있는 항목: ${missing.map(([label]) => label).join(", ")}. 링크를 보내기 전에 기본 정보를 채워야 오해와 재문의가 줄어듭니다.`,
    to: "/invitation",
    action: "청첩장 수정",
    count: missing.length,
  };
}

function publicContactExposure(data: WeddingData): AgentFinding {
  const exposed = [
    data.invitation.groomPhone && "신랑 연락처",
    data.invitation.bridePhone && "신부 연락처",
    data.invitation.groomAccount && "신랑 계좌",
    data.invitation.brideAccount && "신부 계좌",
    data.invitation.venueAddress && "예식장 주소",
  ].filter(Boolean) as string[];
  if (exposed.length === 0) {
    return good("privacy", "공개 개인정보", "청첩장에 연락처·계좌가 아직 노출되지 않았어요.", "필요할 때만 최소한으로 공개하는 현재 상태가 안전합니다.", "/invitation");
  }
  return {
    id: "public-contact-exposure",
    category: "privacy",
    severity: "warn",
    title: "공개 링크 개인정보 점검",
    summary: `${exposed.length}개 공개 항목이 있어요.`,
    detail: `${exposed.join(", ")}가 청첩장에 표시될 수 있습니다. 하객용 공개 링크에 올릴 항목인지, 배우자·혼주 동의가 있는지 확인하세요.`,
    to: "/invitation",
    action: "공개 항목 확인",
    count: exposed.length,
  };
}

function weddingDateWindow(data: WeddingData): AgentFinding {
  const dday = daysUntilISODate(data.invitation.date);
  if (dday === null) {
    return {
      id: "wedding-date-window",
      category: "schedule",
      severity: "warn",
      title: "예식일 기준 일정 없음",
      summary: "예식 날짜가 없어 자동 일정 점검이 약해져요.",
      detail: "예식일을 넣으면 체크리스트 마감, 청첩장 발송, RSVP 회수, 영상 제출 시점을 더 정확히 볼 수 있습니다.",
      to: "/invitation",
      action: "예식일 입력",
    };
  }
  if (dday < 0) {
    return {
      id: "wedding-date-window",
      category: "schedule",
      severity: "info",
      title: "예식일이 지난 상태",
      summary: `예식일이 ${Math.abs(dday)}일 지났어요.`,
      detail: "공개 청첩장, RSVP, 계좌, 하객 개인정보를 계속 보관할 필요가 있는지 정리하세요.",
      to: "/settings",
      action: "데이터 정리",
    };
  }
  if (dday <= 14) {
    return {
      id: "wedding-date-window",
      category: "schedule",
      severity: "danger",
      title: "예식 2주 전 최종 점검",
      summary: `예식까지 ${dday}일 남았어요.`,
      detail: "식순, 식대 보증 인원, 영상 파일, 혼주 연락망, 잔금, 청첩장 오탈자를 오늘 기준으로 확정해야 합니다.",
      to: "/checklist",
      action: "최종 체크",
    };
  }
  if (dday <= 60) {
    return {
      id: "wedding-date-window",
      category: "schedule",
      severity: "warn",
      title: "예식 60일 이내",
      summary: `예식까지 ${dday}일 남았어요.`,
      detail: "청첩장 발송, RSVP 회수, 식전영상 제출, 식수 확정, 잔금 일정을 빠르게 잠가야 합니다.",
      to: "/checklist",
      action: "마감 일정 확인",
    };
  }
  return good("schedule", "예식일 여유", `예식까지 ${dday}일 남았어요.`, "큰 예약과 계약 조건부터 확정하면 이후 일정이 안정됩니다.", "/checklist");
}

function ceremonyTimeCompleteness(data: WeddingData): AgentFinding {
  if (!data.invitation.date) {
    return {
      id: "ceremony-time-completeness",
      category: "content",
      severity: "info",
      title: "예식 시간 점검 대기",
      summary: "예식 날짜가 먼저 필요해요.",
      detail: "날짜와 시간을 같이 입력해야 청첩장·캘린더·식전영상 엔딩의 오해를 줄일 수 있습니다.",
      to: "/invitation",
      action: "날짜 입력",
    };
  }
  if (!data.invitation.time?.trim()) {
    return {
      id: "ceremony-time-completeness",
      category: "content",
      severity: "warn",
      title: "예식 시간 누락",
      summary: "청첩장에 시간이 빠져 있어요.",
      detail: "오후/오전, 본식 시작 시간, 하객 도착 권장 시간을 식장 계약서와 맞춰 입력하세요.",
      to: "/invitation",
      action: "시간 입력",
    };
  }
  return good("content", "예식 시간", "예식 시간이 입력돼 있어요.", "공유 전에는 식장 계약서와 분 단위까지 다시 확인하세요.", "/invitation");
}

function venueDirectionsCompleteness(data: WeddingData): AgentFinding {
  const hasVenue = !!data.invitation.venue?.trim();
  if (!hasVenue) {
    return {
      id: "venue-directions",
      category: "content",
      severity: "info",
      title: "오시는 길 점검 대기",
      summary: "예식장이 아직 비어 있어요.",
      detail: "장소가 정해지면 주소, 층/홀명, 지도 링크까지 같이 넣어야 하객 문의가 줄어듭니다.",
      to: "/venues",
      action: "예식장 정리",
    };
  }
  const missing = [
    !data.invitation.venueAddress?.trim() && "주소",
    !data.invitation.venueHall?.trim() && "홀명/층",
    !data.invitation.venueMapUrl?.trim() && "지도 링크",
  ].filter(Boolean) as string[];
  if (missing.length === 0) {
    return good("content", "오시는 길", "주소·홀명·지도 링크가 준비돼 있어요.", "주차, 셔틀, 지하철 출구는 인사말 아래 안내 문구로 보강하면 좋습니다.", "/invitation");
  }
  return {
    id: "venue-directions",
    category: "content",
    severity: "warn",
    title: "오시는 길 정보 부족",
    summary: `${missing.join(", ")}가 비어 있어요.`,
    detail: "주소만으로는 같은 건물의 홀·층·입구가 헷갈릴 수 있습니다. 지도 링크와 홀명을 같이 넣으세요.",
    to: "/invitation",
    action: "오시는 길 보완",
    count: missing.length,
  };
}

function accountFormatRisk(data: WeddingData): AgentFinding {
  const accounts = [
    ["신랑 계좌", data.invitation.groomAccount],
    ["신부 계좌", data.invitation.brideAccount],
  ].filter(([, value]) => String(value ?? "").trim());
  if (accounts.length === 0) {
    return good("privacy", "계좌 공개", "공개 계좌가 아직 없습니다.", "계좌를 공개할 때는 예금주·은행·번호 오탈자를 별도로 검수하세요.", "/invitation");
  }
  const weak = accounts.filter(([, value]) => {
    const text = String(value ?? "");
    const digits = text.replace(/\D/g, "");
    return digits.length < 8 || !/(은행|뱅크|Bank|bank|카카오|토스|국민|신한|우리|하나|농협|기업|SC|씨티|새마을|수협|대구|부산|경남|광주|전북|제주)/.test(text);
  });
  if (weak.length === 0) {
    return good("privacy", "계좌 형식", "공개 계좌에 은행명과 번호가 들어 있어요.", "실제 송금 테스트나 가족 교차 확인으로 오탈자를 한 번 더 잡으세요.", "/invitation");
  }
  return {
    id: "account-format-risk",
    category: "privacy",
    severity: "warn",
    title: "계좌 표기 형식 확인",
    summary: `${weak.map(([label]) => label).join(", ")} 표기가 불완전해 보여요.`,
    detail: "하객 송금 오류를 줄이려면 은행명, 계좌번호, 예금주를 한 줄에 명확히 적고 공개 동의를 확인하세요.",
    to: "/invitation",
    action: "계좌 표기 확인",
    count: weak.length,
  };
}

function greetingSensitiveText(data: WeddingData): AgentFinding {
  const greeting = data.invitation.greeting ?? "";
  const hasPhone = /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/.test(greeting);
  const hasAccount = /(계좌|은행|입금|축의금).{0,20}\d{6,}/.test(greeting);
  const tooLong = greeting.length > 900;
  const flags = [
    hasPhone && "전화번호",
    hasAccount && "계좌/입금 정보",
    tooLong && "긴 문안",
  ].filter(Boolean) as string[];
  if (flags.length === 0) {
    return good("content", "청첩장 문안 안전성", "인사말에 민감 정보나 과도하게 긴 문안이 보이지 않아요.", "문학 작품, 노래 가사, 상업 문구를 그대로 쓰지 않는지만 최종 확인하세요.", "/invitation");
  }
  return {
    id: "greeting-sensitive-text",
    category: "content",
    severity: "warn",
    title: "인사말 민감 정보 확인",
    summary: `${flags.join(", ")}가 인사말에 섞였을 수 있어요.`,
    detail: "인사말은 공개 범위가 넓습니다. 연락처·계좌는 전용 영역에 두고, 저작권 있는 문구를 긴 분량으로 붙여넣지 마세요.",
    to: "/invitation",
    action: "문안 정리",
    count: flags.length,
  };
}

function recoveryLinkRisk(data: WeddingData): AgentFinding {
  if (data.preferences.mode === "hosted") {
    return {
      id: "recovery-link-risk",
      category: "security",
      severity: "warn",
      title: "복구 링크 보안",
      summary: "간편 모드 복구 링크는 마스터 권한입니다.",
      detail: "복구 링크를 받은 사람은 전체 준비 데이터를 읽고 고칠 수 있습니다. 배우자에게 1:1로만 보내고 단톡방·SNS·캡처 공유는 피하세요.",
      to: "/settings",
      action: "복구 링크 관리",
    };
  }
  if (data.preferences.mode === "supabase") {
    return {
      id: "editor-link-risk",
      category: "security",
      severity: "warn",
      title: "편집 초대 링크 보안",
      summary: "편집 링크는 오너 권한입니다.",
      detail: "하객용 청첩장 링크와 편집 초대 링크를 분리해서 공유하세요. 편집 링크가 공개되면 예산·하객·계좌까지 수정될 수 있습니다.",
      to: "/share",
      action: "공유 링크 확인",
    };
  }
  return good("security", "공유 권한", "현재 외부 편집 링크가 기본값은 아니에요.", "로컬 모드는 기기 밖으로 전체 데이터가 나가지 않습니다.", "/settings");
}

function guestPrivacy(data: WeddingData): AgentFinding {
  const guests = data.guests ?? [];
  const pii = guests.filter((g) => g.phone || g.email || g.giftKRW || g.notes);
  if (pii.length === 0) {
    return good("privacy", "하객 개인정보", "민감할 수 있는 하객 정보가 거의 없어요.", "하객 명단을 만들 때도 필요한 항목만 입력하세요.", "/guests");
  }
  return {
    id: "guest-privacy",
    category: "privacy",
    severity: "warn",
    title: "하객 명단 최소수집",
    summary: `${pii.length}명에게 연락처·축의금·메모가 있어요.`,
    detail: "하객 정보는 제3자 개인정보입니다. 초대·식수·정산에 필요한 범위만 적고, 백업 파일이나 편집 링크를 넓게 공유하지 마세요.",
    to: "/guests",
    action: "하객 정보 정리",
    count: pii.length,
  };
}

function guestHeadcountReadiness(data: WeddingData): AgentFinding {
  const guests = data.guests ?? [];
  if (guests.length === 0) {
    return {
      id: "guest-headcount-readiness",
      category: "schedule",
      severity: "warn",
      title: "하객 명단 없음",
      summary: "식수와 좌석을 계산할 기준이 없어요.",
      detail: "최소한 가족·친척·친구·회사 그룹별 예상 인원이라도 넣어야 보증 인원과 예산을 잡을 수 있습니다.",
      to: "/guests",
      action: "하객 명단 시작",
    };
  }
  const attending = guests.filter((g) => g.status === "참석");
  const pending = guests.filter((g) => g.status !== "참석" && g.status !== "불참");
  if (attending.length === 0) {
    return {
      id: "guest-headcount-readiness",
      category: "schedule",
      severity: "warn",
      title: "참석 확정 인원 없음",
      summary: `${guests.length}명 중 참석 확정이 없어요.`,
      detail: "보증 인원과 식대는 참석 확정 기준으로 움직입니다. 초대 예정과 미정을 참석/불참으로 빨리 분류하세요.",
      to: "/guests",
      action: "참석 상태 정리",
      count: guests.length,
    };
  }
  if (pending.length > Math.max(5, guests.length * 0.3)) {
    return {
      id: "guest-headcount-readiness",
      category: "schedule",
      severity: "warn",
      title: "미정 하객이 많음",
      summary: `${pending.length}명이 아직 확정 전입니다.`,
      detail: "식수 확정일 전에 미정 인원을 줄여야 식대와 좌석 오차가 줄어듭니다.",
      to: "/guests",
      action: "미정 정리",
      count: pending.length,
    };
  }
  return good("schedule", "하객 참석 상태", "참석 확정 기준이 잡혀 있어요.", "식장 보증 인원 확정일 전에는 한 번 더 RSVP를 회수하세요.", "/guests");
}

function mealHeadcountReadiness(data: WeddingData): AgentFinding {
  const attending = (data.guests ?? []).filter((g) => g.status === "참석");
  if (attending.length === 0) {
    return {
      id: "meal-headcount-readiness",
      category: "money",
      severity: "info",
      title: "식수 계산 대기",
      summary: "참석 확정 하객이 아직 없어요.",
      detail: "참석 상태가 정리되면 식사 여부와 동반 인원 기준으로 식수 리스크를 계산합니다.",
      to: "/guests",
      action: "참석 확정",
    };
  }
  const unclear = attending.filter((g) => g.meal === undefined || !g.partyCount || g.partyCount < 1);
  if (unclear.length === 0) {
    return good("money", "식수 계산", "참석 하객의 식사 여부와 인원이 정리돼 있어요.", "어린이·답례품만 수령하는 하객은 별도 메모로 표시하세요.", "/guests");
  }
  return {
    id: "meal-headcount-readiness",
    category: "money",
    severity: "warn",
    title: "식수 계산 정보 부족",
    summary: `${unclear.length}명의 식사 여부 또는 동반 인원이 애매해요.`,
    detail: "식대는 인원 오차가 바로 비용으로 이어집니다. 참석자별 식사 여부와 본인 포함 인원을 확정하세요.",
    to: "/guests",
    action: "식수 정보 정리",
    count: unclear.length,
  };
}

function rsvpScope(data: WeddingData): AgentFinding {
  if (!data.invitation.rsvpEnabled) {
    return {
      id: "rsvp-scope",
      category: "privacy",
      severity: "info",
      title: "RSVP 수집 범위",
      summary: "RSVP가 꺼져 있어요.",
      detail: "RSVP를 켜면 하객 이름·참석 여부·식사 메모가 들어올 수 있습니다. 공개 전 수집 목적과 삭제 계획을 안내하세요.",
      to: "/invitation",
      action: "RSVP 설정",
    };
  }
  return {
    id: "rsvp-scope",
    category: "privacy",
    severity: "warn",
    title: "RSVP 개인정보 고지",
    summary: "하객 응답을 받을 준비가 필요해요.",
    detail: "RSVP 입력 화면에는 참석 확인 목적, 확인 가능한 사람, 예식 후 삭제 시점을 짧게 안내하는 것이 좋습니다.",
    to: "/invitation",
    action: "RSVP 문구 확인",
  };
}

function bgmCopyright(data: WeddingData): AgentFinding {
  const hasBgm = !!data.video?.bgmUrl || !!data.invitation.bgmUrl;
  if (!hasBgm) {
    return good("legal", "BGM 저작권", "배경음악 URL이 아직 없어요.", "음악을 넣을 때는 사용 허락, 공유저작물, 식장 제출 범위를 먼저 확인하세요.", "/video");
  }
  return {
    id: "bgm-copyright",
    category: "legal",
    severity: "danger",
    title: "BGM 사용권 확인 필요",
    summary: "청첩장 또는 식전영상에 음악 URL이 있어요.",
    detail: "상용 음원은 결혼식 영상·온라인 청첩장·SNS 공유에서 각각 권리 처리가 달라질 수 있습니다. 사용 허락 문서나 공유저작물 조건을 확인하고 기록해두세요.",
    to: "/video",
    action: "음악 교체/확인",
  };
}

function photoRights(data: WeddingData): AgentFinding {
  const count =
    (data.invitation.heroImageUrl ? 1 : 0) +
    (data.invitation.gallery?.length ?? 0) +
    (data.video?.photos?.length ?? 0);
  if (count === 0) {
    return good("legal", "사진 사용권", "공개될 사진이 아직 없어요.", "스튜디오 사진을 올릴 때는 계약서의 온라인 게시 범위를 확인하세요.", "/invitation");
  }
  return {
    id: "photo-rights",
    category: "legal",
    severity: "warn",
    title: "사진·스튜디오 컷 사용권",
    summary: `${count}개 사진 자산이 있어요.`,
    detail: "직접 촬영 사진은 인물 동의, 스튜디오·스냅 사진은 계약서의 청첩장·식전영상·SNS 사용 허용 범위를 확인하세요.",
    to: "/invitation",
    action: "사진 확인",
    count,
  };
}

function imageVolumeRisk(data: WeddingData): AgentFinding {
  const count =
    (data.invitation.heroImageUrl ? 1 : 0) +
    (data.invitation.gallery?.length ?? 0) +
    (data.video?.photos?.length ?? 0);
  if (count < 30) {
    return good("security", "사진 저장량", `사진 자산 ${count}개로 관리 가능한 수준입니다.`, "스튜디오 원본처럼 큰 파일은 별도 드라이브에도 보관하세요.", "/settings#data-backup");
  }
  const severity: AgentSeverity = data.preferences.mode === "local" ? "warn" : "info";
  return {
    id: "image-volume-risk",
    category: "security",
    severity,
    title: "사진 백업 용량 점검",
    summary: `사진 자산이 ${count}개입니다.`,
    detail: data.preferences.mode === "local"
      ? "로컬 브라우저 저장소는 용량 제한이 있습니다. 사진을 많이 넣었다면 JSON 백업과 원본 사진 백업을 따로 챙기세요."
      : "사진이 많으면 발행·백업·렌더링 시간이 늘어납니다. 원본은 앱 밖에도 따로 보관하세요.",
    to: "/settings#data-backup",
    action: "백업 확인",
    count,
  };
}

function videoReadiness(data: WeddingData): AgentFinding {
  const photos = data.video?.photos?.length ?? 0;
  const acts = data.video?.acts?.length ?? 0;
  if (photos === 0 && acts === 0) {
    return {
      id: "video-readiness",
      category: "content",
      severity: "info",
      title: "식전영상 준비 전",
      summary: "영상 사진과 챕터가 아직 없습니다.",
      detail: "식장 제출 마감이 가까워지기 전에 사진 30~60장, BGM 권리, MP4 제출 형식을 먼저 확인하세요.",
      to: "/video",
      action: "영상 시작",
    };
  }
  if (photos > 0 && photos < 20) {
    return {
      id: "video-readiness",
      category: "content",
      severity: "warn",
      title: "식전영상 사진 부족",
      summary: `현재 사진 ${photos}장입니다.`,
      detail: "3~5분 식전영상은 보통 30장 이상이 안정적입니다. 어린 시절, 연애, 가족, 친구 사진을 균형 있게 채우세요.",
      to: "/video",
      action: "사진 추가",
      count: photos,
    };
  }
  if (photos > 80) {
    return {
      id: "video-readiness",
      category: "content",
      severity: "warn",
      title: "식전영상 사진 과다",
      summary: `현재 사진 ${photos}장입니다.`,
      detail: "사진이 너무 많으면 영상이 길어지고 하객 집중도가 떨어집니다. 식장 제출 길이와 템포를 확인하세요.",
      to: "/video",
      action: "사진 줄이기",
      count: photos,
    };
  }
  return good("content", "식전영상 분량", `사진 ${photos}장으로 기본 분량이 잡혀 있어요.`, "BGM 권리와 식장 제출 파일 형식만 별도로 확인하세요.", "/video");
}

function vendorFreshness(data: WeddingData): AgentFinding {
  const items = [
    ...data.rings.map((x) => ({ label: `${x.brand} ${x.model}`, verified: x.lastVerified })),
    ...data.hotels.map((x) => ({ label: x.name, verified: x.lastVerified })),
    ...data.flights.map((x) => ({ label: x.flightNumber || x.airline || "항공 후보", verified: x.lastVerified })),
    ...(data.venues ?? []).map((x) => ({ label: x.name, verified: x.lastVerified })),
  ];
  const stale = items.filter((item) => {
    const age = daysSince(item.verified);
    return age === null || age >= STALE_DAYS;
  });
  if (items.length === 0) {
    return {
      id: "vendor-freshness",
      category: "data",
      severity: "info",
      title: "가격·일정 신선도",
      summary: "검증할 후보가 아직 없어요.",
      detail: "반지·식장·숙소·항공 후보를 담으면 마지막 확인일 기준으로 오래된 정보를 잡아냅니다.",
      to: "/venues",
      action: "후보 추가",
    };
  }
  if (stale.length === 0) {
    return good("data", "가격·일정 신선도", "후보 정보가 최근 확인 상태입니다.", "계약 직전에는 공식 채널에서 한 번 더 확인하세요.", "/venues");
  }
  return {
    id: "vendor-freshness",
    category: "data",
    severity: "warn",
    title: "오래된 가격·일정 정보",
    summary: `${stale.length}/${items.length}개 후보가 90일 이상 오래됐거나 출처가 없어요.`,
    detail: `먼저 확인할 항목: ${stale.slice(0, 3).map((x) => x.label).join(", ")}${stale.length > 3 ? " 등" : ""}. 가격·가능 일정·계약 조건은 변동될 수 있습니다.`,
    to: "/venues",
    action: "후보 재확인",
    count: stale.length,
  };
}

function vendorDecisionProgress(data: WeddingData): AgentFinding {
  const dday = daysUntilISODate(data.invitation.date);
  const venues = data.venues ?? [];
  const venueContract = venues.some((v) => v.status === "계약") || !!data.invitation.venue?.trim();
  const sdmContracts = {
    studio: data.sdm.some((v) => v.category === "studio" && v.status === "계약"),
    dress: data.sdm.some((v) => v.category === "dress" && v.status === "계약"),
    makeup: data.sdm.some((v) => v.category === "makeup" && v.status === "계약"),
    snap: data.sdm.some((v) => v.category === "snap" && v.status === "계약"),
  };
  const missing = [
    !venueContract && "예식장",
    !sdmContracts.studio && "스튜디오",
    !sdmContracts.dress && "드레스",
    !sdmContracts.makeup && "메이크업",
    !sdmContracts.snap && "본식 스냅",
  ].filter(Boolean) as string[];
  if (missing.length === 0) {
    return good("schedule", "주요 업체 결정", "예식장·스드메·스냅 결정 흐름이 잡혀 있어요.", "계약 조건과 잔금일은 예산/메모에 따로 남기세요.", "/venues");
  }
  const severity: AgentSeverity = dday !== null && dday <= 120 ? "warn" : "info";
  return {
    id: "vendor-decision-progress",
    category: "schedule",
    severity,
    title: "주요 업체 결정 공백",
    summary: `${missing.join(", ")} 결정 상태가 비어 있어요.`,
    detail: "예식 3~4개월 전에는 큰 업체가 대부분 잠겨 있어야 이후 청첩장, 촬영, 드레스 투어 일정이 밀리지 않습니다.",
    to: "/venues",
    action: "업체 결정 확인",
    count: missing.length,
  };
}

function venueCapacityFit(data: WeddingData): AgentFinding {
  const attending = (data.guests ?? [])
    .filter((g) => g.status === "참석")
    .reduce((sum, g) => sum + Math.max(1, g.partyCount ?? 1), 0);
  const contracted = (data.venues ?? []).find((v) => v.status === "계약") ?? (data.venues ?? [])[0];
  if (!contracted || attending === 0) {
    return {
      id: "venue-capacity-fit",
      category: "money",
      severity: "info",
      title: "식장 수용 인원 점검 대기",
      summary: "계약 식장 또는 참석 인원이 부족해요.",
      detail: "계약 식장과 참석 인원이 정리되면 최소 보증 인원·최대 수용 인원 초과를 자동으로 잡습니다.",
      to: "/venues",
      action: "식장/하객 정리",
    };
  }
  if (contracted.capacityMax && attending > contracted.capacityMax) {
    return {
      id: "venue-capacity-fit",
      category: "money",
      severity: "danger",
      title: "식장 최대 인원 초과",
      summary: `참석 예상 ${attending}명이 최대 ${contracted.capacityMax}명을 넘습니다.`,
      detail: "좌석·식사·소방법 기준 문제가 생길 수 있습니다. 식장 담당자에게 증원 가능 여부를 확인하세요.",
      to: "/venues",
      action: "수용 인원 확인",
    };
  }
  if (contracted.capacityMin && attending < contracted.capacityMin) {
    return {
      id: "venue-capacity-fit",
      category: "money",
      severity: "warn",
      title: "보증 인원 미달 가능성",
      summary: `참석 예상 ${attending}명이 최소 ${contracted.capacityMin}명보다 적습니다.`,
      detail: "보증 인원보다 실제 식수가 낮으면 비용 손실이 생길 수 있습니다. 보증 조정 가능일을 확인하세요.",
      to: "/guests",
      action: "식수 조정",
    };
  }
  return good("money", "식장 수용 인원", `참석 예상 ${attending}명이 식장 범위 안에 있어요.`, "최종 식수 확정일 전에 불참·동반 인원을 다시 정리하세요.", "/guests");
}

function budgetOverrun(data: WeddingData): AgentFinding {
  const items = data.budget ?? [];
  const over = items.filter((item) => isBudgetOver(item));
  if (items.length === 0) {
    return {
      id: "budget-overrun",
      category: "money",
      severity: "info",
      title: "예산 초과 감시",
      summary: "예산 항목이 아직 없어요.",
      detail: "예상·실제 비용을 함께 입력하면 초과 항목을 자동으로 잡아냅니다.",
      to: "/budget",
      action: "예산표 시작",
    };
  }
  if (over.length === 0) {
    return good("money", "예산 초과", "현재 실제 비용이 예상 비용을 넘긴 항목은 없어요.", "계약금·잔금·봉사료를 따로 적으면 더 정확합니다.", "/budget");
  }
  return {
    id: "budget-overrun",
    category: "money",
    severity: "danger",
    title: "예산 초과 항목",
    summary: `${over.length}개 항목이 예상보다 커졌어요.`,
    detail: `초과 항목: ${over.slice(0, 4).map((x) => x.category).join(", ")}${over.length > 4 ? " 등" : ""}. 계약 변경, 추가 옵션, 잔금 일정을 확인하세요.`,
    to: "/budget",
    action: "비용 확인",
    count: over.length,
  };
}

function unpaidBudgetItems(data: WeddingData): AgentFinding {
  const items = data.budget ?? [];
  const unpaid = items.filter((item) => ((item.actual ?? item.planned ?? 0) > 0) && !item.paid);
  if (items.length === 0) {
    return {
      id: "unpaid-budget-items",
      category: "money",
      severity: "info",
      title: "잔금 점검 대기",
      summary: "예산 항목이 없어 결제 상태를 볼 수 없어요.",
      detail: "계약금·중도금·잔금 항목을 나눠두면 예식 직전 누락 결제를 줄일 수 있습니다.",
      to: "/budget",
      action: "예산 항목 추가",
    };
  }
  if (unpaid.length === 0) {
    return good("money", "미결제 항목", "금액이 있는 항목은 모두 결제 완료로 표시돼 있어요.", "영수증과 계약서는 앱 밖에도 따로 보관하세요.", "/budget");
  }
  return {
    id: "unpaid-budget-items",
    category: "money",
    severity: "warn",
    title: "미결제 항목",
    summary: `${unpaid.length}개 비용 항목이 결제 완료 전입니다.`,
    detail: `미결제: ${unpaid.slice(0, 4).map((x) => x.category).join(", ")}${unpaid.length > 4 ? " 등" : ""}. 잔금일과 이체 한도를 미리 확인하세요.`,
    to: "/budget",
    action: "결제 상태 확인",
    count: unpaid.length,
  };
}

function overdueChecklist(data: WeddingData): AgentFinding {
  const overdue = data.checklist.flatMap((section) =>
    section.items.filter((item) => !item.done && item.dueDate && (daysUntilISODate(item.dueDate) ?? 1) < 0),
  );
  if (overdue.length === 0) {
    return good("schedule", "마감 지난 할 일", "기한이 지난 미완료 항목은 없어요.", "예식일을 바꾸면 체크리스트 날짜도 다시 계산하세요.", "/checklist");
  }
  return {
    id: "overdue-checklist",
    category: "schedule",
    severity: "danger",
    title: "기한 지난 할 일",
    summary: `${overdue.length}개가 마감일을 넘겼어요.`,
    detail: `먼저 볼 일: ${overdue.slice(0, 3).map((x) => x.text).join(", ")}${overdue.length > 3 ? " 등" : ""}.`,
    to: "/checklist",
    action: "체크리스트 확인",
    count: overdue.length,
  };
}

function backupHealth(data: WeddingData): AgentFinding {
  const hasData = !!(
    data.invitation.groomName ||
    data.invitation.brideName ||
    data.rings.length ||
    (data.guests ?? []).length ||
    (data.budget ?? []).length ||
    data.video.photos.length
  );
  const age = daysSince(data.preferences.lastBackupAt);
  if (!hasData) {
    return {
      id: "backup-health",
      category: "security",
      severity: "info",
      title: "백업 상태",
      summary: "아직 백업할 데이터가 많지 않아요.",
      detail: "의미 있는 입력이 생기면 더보기에서 JSON 백업을 내려받으세요.",
      to: "/settings#data-backup",
      action: "백업 보기",
    };
  }
  if (data.preferences.mode !== "local" || (age !== null && age < BACKUP_STALE_DAYS)) {
    return good("security", "백업 상태", "최근 백업 또는 서버 저장 모드입니다.", "그래도 계약 직전·청첩장 발행 전에는 JSON 백업을 따로 보관하세요.", "/settings#data-backup");
  }
  return {
    id: "backup-health",
    category: "security",
    severity: "warn",
    title: "로컬 데이터 백업 필요",
    summary: age === null ? "아직 백업 기록이 없어요." : `${age}일 동안 백업하지 않았어요.`,
    detail: "로컬 모드는 브라우저 데이터가 지워지면 복구가 어렵습니다. 큰 입력을 마친 뒤에는 백업 파일을 내려받으세요.",
    to: "/settings#data-backup",
    action: "백업 내려받기",
  };
}

function honeymoonDocumentReadiness(data: WeddingData): AgentFinding {
  const hasTrip = data.honeymoon.regions.length > 0 || data.flights.length > 0 || data.hotels.length > 0;
  if (!hasTrip) {
    return {
      id: "honeymoon-document-readiness",
      category: "schedule",
      severity: "info",
      title: "여행 서류 점검 대기",
      summary: "신혼여행 후보가 아직 없어요.",
      detail: "해외 여행지가 정해지면 여권, 비자, 보험, 환전, 로밍 항목을 체크리스트에 남겨두세요.",
      to: "/trip",
      action: "여행 후보 정리",
    };
  }
  const checklistText = data.checklist.flatMap((s) => s.items).map((i) => i.text).join(" ");
  const missing = [
    !/여권|passport/i.test(checklistText) && "여권",
    !/비자|visa/i.test(checklistText) && "비자",
    !/보험|insurance/i.test(checklistText) && "여행자보험",
    !/환전|로밍|eSIM|유심/i.test(checklistText) && "환전/로밍",
  ].filter(Boolean) as string[];
  if (missing.length === 0) {
    return good("schedule", "여행 서류", "여권·비자·보험·환전/로밍 항목이 체크리스트에 있어요.", "항공권 영문명과 여권 영문명 일치 여부를 최종 확인하세요.", "/checklist");
  }
  return {
    id: "honeymoon-document-readiness",
    category: "schedule",
    severity: "warn",
    title: "신혼여행 서류 항목 부족",
    summary: `${missing.join(", ")} 확인 항목이 약해요.`,
    detail: "해외 여행은 서류 누락이 가장 치명적입니다. 여행지가 확정되면 체크리스트에 별도 항목으로 넣으세요.",
    to: "/checklist",
    action: "여행 체크 추가",
    count: missing.length,
  };
}

function translationCompleteness(data: WeddingData): AgentFinding {
  const locales = data.invitation.enabledLocales ?? [];
  if (locales.length === 0) {
    return good("content", "외국어 청첩장", "외국어 청첩장이 꺼져 있어요.", "외국인 하객이 있으면 영어/중국어 이름·장소·인사말을 별도 검수하세요.", "/invitation");
  }
  const missing = locales.flatMap((locale) => {
    const t = data.invitation.translations?.[locale];
    const label = locale === "en" ? "영어" : "중국어";
    return [
      !t?.greeting?.trim() && `${label} 인사말`,
      !t?.venue?.trim() && `${label} 장소`,
      !t?.venueAddress?.trim() && `${label} 주소`,
    ].filter(Boolean) as string[];
  });
  if (missing.length === 0) {
    return good("content", "외국어 번역", "켜진 외국어 청첩장의 핵심 문구가 채워져 있어요.", "고유명사와 교통 안내는 원어민 또는 실제 하객에게 한 번 더 검수받으세요.", "/invitation");
  }
  return {
    id: "translation-completeness",
    category: "content",
    severity: "warn",
    title: "외국어 청첩장 번역 누락",
    summary: `${missing.slice(0, 3).join(", ")}${missing.length > 3 ? " 등" : ""}이 비어 있어요.`,
    detail: "외국어 탭을 켜면 한국어 문구와 별도로 장소, 주소, 인사말을 확인해야 합니다. 자동 번역은 고유명사 오류가 잦습니다.",
    to: "/invitation",
    action: "번역 보완",
    count: missing.length,
  };
}

function externalLinkSafety(data: WeddingData): AgentFinding {
  const links = collectExternalLinks(data);
  if (links.length === 0) {
    return good("security", "외부 링크", "사용자 입력 외부 링크가 거의 없습니다.", "지도·업체·사진 URL을 넣을 때는 https 링크를 우선 사용하세요.", "/invitation");
  }
  const risky = links.filter((item) => !isSafeExternalHref(item.href));
  if (risky.length === 0) {
    return good("security", "외부 링크", `${links.length}개 링크가 기본 안전 형식입니다.`, "공식 사이트가 아닌 링크는 계약 전 한 번 더 출처를 확인하세요.", "/share");
  }
  return {
    id: "external-link-safety",
    category: "security",
    severity: "danger",
    title: "외부 링크 형식 위험",
    summary: `${risky.length}개 링크가 https/http/mail/tel 형식이 아닙니다.`,
    detail: `먼저 확인: ${risky.slice(0, 3).map((x) => x.label).join(", ")}. 사용자 입력 링크에는 javascript:, data: 같은 스킴을 쓰지 마세요.`,
    to: "/invitation",
    action: "링크 정리",
    count: risky.length,
  };
}

function publishFreshness(data: WeddingData): AgentFinding {
  if (!data.publish) {
    return {
      id: "publish-freshness",
      category: "content",
      severity: "info",
      title: "청첩장 발행 전",
      summary: "간편 발행된 청첩장이 없습니다.",
      detail: "공개 전에 이름, 날짜, 시간, 장소, 계좌, 사진 권리, RSVP 수집 범위를 점검하세요.",
      to: "/invitation",
      action: "발행 준비",
    };
  }
  const age = daysSince(data.publish.publishedAt);
  if (age !== null && age > 30) {
    return {
      id: "publish-freshness",
      category: "content",
      severity: "warn",
      title: "발행된 청첩장 재검수",
      summary: `발행 후 ${age}일이 지났어요.`,
      detail: "발행 이후 날짜, 시간, 홀명, 계좌, 사진이 바뀌었을 수 있습니다. 공유 링크를 다시 열어 실제 화면을 확인하세요.",
      to: "/invitation",
      action: "공개 링크 확인",
    };
  }
  return good("content", "청첩장 발행 상태", "최근 발행된 청첩장 정보가 있습니다.", "하객에게 보내기 전 실제 링크를 본인 휴대폰에서 다시 열어보세요.", "/invitation");
}

function aiPromptPrivacy(data: WeddingData): AgentFinding {
  const hasSensitive =
    !!data.invitation.groomPhone ||
    !!data.invitation.bridePhone ||
    !!data.invitation.groomAccount ||
    !!data.invitation.brideAccount ||
    (data.guests ?? []).some((g) => g.phone || g.email || g.giftKRW);
  if (!hasSensitive) {
    return good("privacy", "AI 프롬프트 개인정보", "AI에 들어갈 민감 정보가 현재 적습니다.", "AI 요청 전에도 이름·연락처·계좌는 필요한 경우만 남기세요.", "/ai");
  }
  return {
    id: "ai-prompt-privacy",
    category: "privacy",
    severity: "warn",
    title: "AI 전송 전 마스킹",
    summary: "연락처·계좌·하객 정보가 데이터 안에 있어요.",
    detail: "AI에게 요청할 때는 실명, 전화번호, 계좌, 하객별 축의금 같은 정보는 빼거나 익명화하세요. 운영자 제공 AI는 프롬프트가 서버와 AI 제공자를 거칩니다.",
    to: "/ai",
    action: "AI 설정 확인",
  };
}

function internationalTransferNotice(data: WeddingData): AgentFinding {
  const usesExternal = data.preferences.mode === "hosted" || data.preferences.mode === "supabase";
  if (!usesExternal) {
    return good("privacy", "외부 처리 고지", "로컬 모드는 기본적으로 외부 저장소를 쓰지 않아요.", "AI나 발행 기능을 켜면 별도 고지가 필요합니다.", "/privacy");
  }
  return {
    id: "international-transfer-notice",
    category: "privacy",
    severity: "warn",
    title: "외부 처리·국외이전 고지",
    summary: "Vercel·Supabase·AI 제공자 정보를 운영자가 확인해야 해요.",
    detail: "실제 배포 리전, 처리 목적, 보유기간, 수탁자, 국외이전 항목을 운영 환경에 맞게 개인정보 안내에 구체화하세요.",
    to: "/privacy",
    action: "고지 확인",
  };
}

function contractEvidence(data: WeddingData): AgentFinding {
  const contracted = [
    ...(data.venues ?? []).filter((x) => String(x.status ?? "").includes("계약")),
    ...data.sdm.filter((x) => String(x.status ?? "").includes("계약")),
  ];
  const weak = contracted.filter((x) => !String(x.notes ?? "").match(/계약|잔금|취소|환불|포함|원본|파일|세금|봉사료/));
  if (contracted.length === 0) {
    return {
      id: "contract-evidence",
      category: "legal",
      severity: "info",
      title: "계약 증빙 메모",
      summary: "계약 상태인 업체가 아직 없어요.",
      detail: "계약하면 취소·환불·원본 파일·추가금·식대 포함 범위를 메모에 남겨두세요.",
      to: "/venues",
      action: "업체 후보 보기",
    };
  }
  if (weak.length === 0) {
    return good("legal", "계약 증빙 메모", "계약 업체에 확인 메모가 남아 있어요.", "계약서 원본과 견적서는 앱 밖에도 별도 보관하세요.", "/venues");
  }
  return {
    id: "contract-evidence",
    category: "legal",
    severity: "warn",
    title: "계약 조건 메모 부족",
    summary: `${weak.length}개 계약 업체에 핵심 조건 메모가 부족해요.`,
    detail: "계약금, 잔금일, 취소·환불, 원본 제공, 추가금, 식대 포함 범위를 텍스트로 남겨두면 분쟁 때 확인이 쉽습니다.",
    to: "/venues",
    action: "계약 메모 추가",
    count: weak.length,
  };
}

function isBudgetOver(item: BudgetItem): boolean {
  if (typeof item.planned !== "number" || typeof item.actual !== "number") return false;
  return item.actual > item.planned;
}

function collectExternalLinks(data: WeddingData): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  const push = (label: string, href?: string) => {
    if (href?.trim()) out.push({ label, href: href.trim() });
  };
  push("청첩장 지도", data.invitation.venueMapUrl);
  push("청첩장 대표 사진", data.invitation.heroImageUrl);
  push("청첩장 BGM", data.invitation.bgmUrl);
  data.invitation.gallery?.forEach((item, index) => push(`청첩장 갤러리 ${index + 1}`, item.url));
  data.rings.forEach((item) => {
    push(`반지 ${item.brand} ${item.model}`, item.link);
    push(`반지 이미지 ${item.brand} ${item.model}`, item.imageUrl);
    item.imageUrls?.forEach((url, index) => push(`반지 이미지 ${index + 1}`, url));
  });
  data.sdm.forEach((item) => push(`업체 ${item.name}`, item.link));
  data.hotels.forEach((item) => {
    item.otaPrices?.forEach((ota) => push(`숙소 ${item.name} ${ota.ota}`, ota.url));
  });
  data.flights.forEach((item) => push(`항공 ${item.flightNumber || item.airline || item.id}`, item.link));
  (data.venues ?? []).forEach((item) => push(`예식장 ${item.name}`, item.link));
  data.video.photos.forEach((item, index) => push(`영상 사진 ${index + 1}`, item.url));
  push("영상 BGM", data.video.bgmUrl);
  return out;
}

function isSafeExternalHref(href: string): boolean {
  if (/^(https?:|mailto:|tel:|blob:|data:image\/)/i.test(href)) return true;
  if (/^idb:/i.test(href)) return true;
  if (href.startsWith("/") || href.startsWith("#")) return true;
  return false;
}

function good(category: AgentFinding["category"], title: string, summary: string, detail: string, to?: string): AgentFinding {
  return {
    id: title.toLowerCase().replace(/\s+/g, "-"),
    category,
    severity: "good",
    title,
    summary,
    detail,
    to,
    action: to ? "확인" : undefined,
  };
}
