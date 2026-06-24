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
    publicContactExposure(data),
    recoveryLinkRisk(data),
    guestPrivacy(data),
    rsvpScope(data),
    bgmCopyright(data),
    photoRights(data),
    vendorFreshness(data),
    budgetOverrun(data),
    overdueChecklist(data),
    backupHealth(data),
    aiPromptPrivacy(data),
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
