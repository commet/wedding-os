// AI 비용 0 — 사용자가 챗봇(ChatGPT, Claude, Gemini)에 복붙해서 결과를 받아온다.
// 우리는 프롬프트만 만들어주고, 답변에서 JSON을 뽑아내는 도우미만 제공한다.
import type { InvitationContent, WeddingData } from "./schema";
import type { PlanningSectionStatus } from "./derived";

export type BridgePrompt = {
  title: string;
  prompt: string;
  expectedShape: "json" | "text";
  /** Managed AI 품질/비용 tier. deep은 서버에서 별도 quota를 통과해야만 Sonnet 계열로 승격된다. */
  tier?: "standard" | "deep";
  /** 답변에서 추출할 JSON 키 — UI에 자동 채워줄 필드 */
  keys?: string[];
};

export function weddingPlanStarterPrompt(data: WeddingData): BridgePrompt {
  const inv = data.invitation;
  const summary = {
    weddingDate: inv.date || null,
    venueFilled: Boolean(inv.venue),
    invitationFieldsFilled: [
      inv.groomName,
      inv.brideName,
      inv.date,
      inv.venue,
      inv.greeting,
    ].filter(Boolean).length,
    counts: {
      checklistItems: data.checklist.reduce((n, section) => n + section.items.length, 0),
      budgetItems: data.budget?.length ?? 0,
      guests: data.guests?.length ?? 0,
      rings: data.rings.length,
      venues: data.venues?.length ?? 0,
      honeymoonRegions: data.honeymoon.regions.length,
      flights: data.flights.length,
      hotels: data.hotels.length,
    },
    currentHoneymoonRegions: data.honeymoon.regions.map((r) => r.name).slice(0, 5),
    currentBudgetCategories: (data.budget ?? []).map((b) => b.category).slice(0, 8),
  };

  return {
    title: "준비 초안 만들기",
    prompt: `당신은 한국 결혼 준비를 돕는 중립적인 웨딩 플래너입니다.
아래 Dearie 상태를 보고 사용자가 바로 시작할 수 있는 기본판을 만들어주세요.

중요한 원칙:
- 부모님 관여도, 종교, 문화, 언어, 가족사 같은 민감하거나 지나치게 개인적인 가정은 하지 마세요.
- 업체·가격·일정은 확정처럼 말하지 말고, 사용자가 확인할 출발점으로 제안하세요.
- 웨딩홀 관련 제안에는 보증인원, 식대, 변경·환급 기준, 외부업체 반입료, 동시 예식/하객 동선 중 적어도 2가지를 확인 항목으로 포함하세요.
- 계약 관련 제안은 법률 조언처럼 단정하지 말고, 계약서·견적서에 남길 확인 항목으로 표현하세요.
- 청첩장·RSVP 관련 제안은 이름, 측, 참석 여부, 인원, 식사 메모처럼 필요한 정보만 받는 방향으로 제안하세요.
- 혼인신고는 등록기준지·본·증인 서명·방문/우편 접수기관 확인처럼 준비물 중심으로 제안하세요.
- 임신 사전건강관리 지원은 임신 계획이 있는 경우에만, e보건소/보건소 대상 확인·검사의뢰서·참여 의료기관·청구 증빙 확인 수준으로 제안하세요.
- 전입신고·건강지원은 공식 창구 확인 수준으로만 제안하고 개인 상황을 추정하지 마세요.
- 돈 관련 제안은 총액 추정보다 "빠뜨리기 쉬운 항목"과 "계약서에서 확인할 조건" 위주로 적으세요.
- 너무 많이 만들지 말고, 오늘 바로 도움이 되는 핵심만 제안하세요.
- 전화번호, 계좌, 하객 이름 같은 민감 정보는 요청하지 마세요.

현재 상태:
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

반드시 아래 JSON 형식으로만 답해주세요:
\`\`\`json
{
  "summary": "지금 이 사용자가 먼저 잡으면 좋은 방향 한 문장",
  "today": [
    { "title": "오늘 할 일", "reason": "왜 지금 필요한지", "targetPath": "/budget" }
  ],
  "checklistItems": [
    { "section": "AI 시작 정리", "text": "구체적인 할 일", "ddayOffset": -180, "priority": "yellow" }
  ],
  "budgetItems": [
    { "category": "예산 항목명", "planned": 1000000, "notes": "확인할 기준" }
  ],
  "honeymoonRegions": [
    { "name": "지역명", "durationDays": 6, "notes": "어울리는 이유와 확인할 점" }
  ],
  "invitationGreeting": "청첩장 모시는 글 초안. 4~6줄. 과하게 감성적이지 않고 담백하게."
}
\`\`\`

제안 수 제한:
- today 3개 이하
- checklistItems 5개 이하
- budgetItems 5개 이하
- honeymoonRegions 3개 이하`,
    expectedShape: "json",
    tier: "deep",
  };
}

export function weddingSectionTalkPrompt(data: WeddingData, section: PlanningSectionStatus): BridgePrompt {
  const inv = data.invitation;
  const routeCounts = {
    venues: data.venues?.length ?? 0,
    sdm: data.sdm.filter((vendor) => vendor.category !== "snap").length,
    snap: data.sdm.filter((vendor) => vendor.category === "snap").length,
    rings: data.rings.length,
    tripRegions: data.honeymoon.regions.length,
    flights: data.flights.length,
    hotels: data.hotels.length,
    guests: data.guests?.length ?? 0,
    budgetItems: data.budget?.length ?? 0,
    checklistItems: data.checklist.reduce((n, item) => n + item.items.length, 0),
    ceremonySteps: data.ceremony?.length ?? 0,
    videoPhotos: data.video?.photos?.length ?? 0,
  };
  const sectionData = {
    section: {
      key: section.key,
      label: section.label,
      path: section.to,
      percent: section.percent,
      state: section.state,
      detail: section.detail,
      nextAction: section.nextAction,
    },
    wedding: {
      date: inv.date || null,
      venue: inv.venue || null,
      hasNames: Boolean(inv.groomName || inv.brideName),
    },
    counts: routeCounts,
    currentItems: {
      venues: (data.venues ?? []).map((item) => ({ name: item.name, status: item.status, region: item.region })).slice(0, 8),
      sdm: data.sdm.map((item) => ({ name: item.name, category: item.category, status: item.status })).slice(0, 8),
      rings: data.rings.map((item) => ({ brand: item.brand, model: item.model, priceKRW: item.priceKRW })).slice(0, 8),
      honeymoonRegions: data.honeymoon.regions.map((item) => ({ name: item.name, durationDays: item.durationDays })).slice(0, 6),
      budgetCategories: (data.budget ?? []).map((item) => ({ category: item.category, planned: item.planned, actual: item.actual })).slice(0, 8),
    },
  };

  return {
    title: `${section.label} 다음 행동 정리`,
    prompt: `당신은 한국 결혼 준비를 돕는 중립적인 웨딩 플래너입니다.
사용자는 지금 Dearie 앱의 "${section.label}" 화면에서 도움을 요청했습니다.
전체 계획을 다시 만들지 말고, 이 화면에서 바로 이어갈 수 있는 다음 행동만 작게 정리해주세요.

중요한 원칙:
- 사용자가 입력하지 않은 가족관계, 종교, 문화, 지역 사정, 예산 여유를 추정하지 마세요.
- 업체·가격·일정은 확정처럼 말하지 말고, 사용자가 확인할 체크포인트로 표현하세요.
- 특정 업체의 최신 가격·가능 날짜·리뷰를 확인했다고 말하지 마세요. 웹 검색 출처를 만들어내지 마세요.
- 전화번호, 계좌, 하객 이름, 복구 링크 같은 민감 정보는 요청하지 마세요.
- 사용자의 수고를 줄이는 방향으로, 질문은 최대 2개까지만 제안하세요.
- 제안은 이 화면의 nextAction("${section.nextAction}")을 먼저 해결하게 해주세요.
- targetPath는 가능한 한 "${section.to}"를 사용하세요. 다른 화면으로 넘어가야 할 때만 Dearie 앱의 실제 경로를 쓰세요.

현재 화면 상태:
\`\`\`json
${JSON.stringify(sectionData, null, 2)}
\`\`\`

반드시 아래 JSON 형식으로만 답해주세요:
\`\`\`json
{
  "summary": "지금 화면에서 바로 이어갈 방향 한 문장",
  "today": [
    { "title": "바로 할 일", "reason": "왜 지금 필요한지", "targetPath": "${section.to}" }
  ],
  "checklistItems": [
    { "section": "${section.label}", "text": "사용자가 실제로 확인할 한 가지", "ddayOffset": -90, "priority": "yellow" }
  ],
  "budgetItems": [
    { "category": "예산 항목명", "planned": 1000000, "notes": "확인할 조건" }
  ]${section.key === "trip" ? `,
  "honeymoonRegions": [
    { "name": "지역명", "durationDays": 6, "notes": "어울리는 이유와 확인할 점" }
  ]` : ""}${section.key === "invitation" ? `,
  "invitationGreeting": "청첩장 화면에서만 필요할 때의 문안 초안"
` : ""}
}
\`\`\`

제안 수 제한:
- today 1~2개
- checklistItems 1~4개
- budgetItems는 예산에 실제로 연결될 항목이 있을 때만 0~3개
${section.key === "trip" ? "- honeymoonRegions 0~3개" : "- honeymoonRegions는 넣지 마세요"}
${section.key === "invitation" ? "- invitationGreeting은 필요할 때만 작성" : "- invitationGreeting은 넣지 마세요"}`,
    expectedShape: "json",
    tier: "standard",
  };
}

export function invitationGreetingPrompt(inv: InvitationContent, tone = "담백하고 정중하게"): BridgePrompt {
  const summary = {
    hasNames: Boolean(inv.groomName || inv.brideName),
    date: inv.date || null,
    venueFilled: Boolean(inv.venue),
    currentGreeting: inv.greeting,
    theme: inv.theme ?? "cream",
    fontStyle: inv.fontStyle ?? "serif",
  };

  return {
    title: "청첩장 문안 다듬기",
    prompt: `한국 모바일 청첩장에 들어갈 "모시는 글"을 다듬어주세요.

원칙:
- 원하는 톤: ${tone}
- 과하게 오글거리거나 상투적인 표현은 피하고, 자연스럽게.
- 부모님, 종교, 문화, 언어, 가족 관계를 새로 추정하지 마세요.
- 이름·연락처·계좌 같은 개인정보를 본문에 넣지 마세요.
- 4~6줄 정도로 읽기 쉽게 줄바꿈을 포함하세요.

현재 정보:
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

모시는 글 본문만 답해주세요. 제목이나 설명은 붙이지 마세요.`,
    expectedShape: "text",
    tier: "standard",
  };
}

export function ringPriceCheckPrompt(brand: string, model: string, material?: string): BridgePrompt {
  return {
    title: "반지 가격 참고 추정",
    prompt: `다음 결혼반지의 한국 판매 가격대를 참고용으로 추정해주세요. 웹 검색 도구가 없다면 현재 가격을 확인했다고 말하거나 출처 URL을 만들어내지 마세요.

브랜드: ${brand}
모델: ${model}${material ? `\n소재: ${material}` : ""}

답변은 반드시 아래 JSON 형식으로 부탁드려요:
\`\`\`json
{
  "priceKRW": 1850000,
  "source": "공식 홈페이지 URL 또는 매장 이름",
  "verifiedAt": "${new Date().toISOString().split("T")[0]}"
}
\`\`\``,
    expectedShape: "json",
    tier: "standard",
    keys: ["priceKRW", "source", "verifiedAt"],
  };
}

export function hotelPriceCheckPrompt(hotel: string, checkInDate?: string, nights?: number): BridgePrompt {
  return {
    title: "호텔 가격 참고 추정",
    prompt: `다음 호텔의 가격대를 참고용으로 추정해주세요. 웹 검색 도구가 없다면 OTA 실시간 가격을 확인했다고 말하거나 URL을 만들어내지 마세요.

호텔: ${hotel}${checkInDate ? `\n체크인: ${checkInDate}` : ""}${nights ? `\n${nights}박` : ""}

OTA: 호텔스닷컴, 아고다, 익스피디아, 부킹닷컴, 트립닷컴

답변은 JSON 형식으로:
\`\`\`json
{
  "results": [
    { "ota": "아고다", "pricePerNight": 180000, "url": "..." }
  ],
  "verifiedAt": "${new Date().toISOString().split("T")[0]}"
}
\`\`\``,
    expectedShape: "json",
    tier: "standard",
  };
}

export function flightSearchPrompt(from: string, to: string, date: string): BridgePrompt {
  return {
    title: "항공편 후보 참고 추정",
    prompt: `다음 일정에 맞는 항공편 후보를 참고용으로 제안해주세요. 웹 검색 도구가 없다면 실제 운항편이나 현재 가격을 확인했다고 말하지 마세요.

출발: ${from}
도착: ${to}
날짜: ${date}

직항 위주로 3개, 경유 2개 정도 추천해주세요. 가격은 이코노미 기준.

답변은 JSON으로:
\`\`\`json
{
  "options": [
    { "airline": "...", "flightNumber": "...", "departAt": "...", "arriveAt": "...", "priceKRW": 0, "stops": 0 }
  ],
  "verifiedAt": "${new Date().toISOString().split("T")[0]}"
}
\`\`\``,
    expectedShape: "json",
    tier: "standard",
  };
}

export function videoEditPrompt(
  currentConfig: any,
  request: string,
  templateName?: string,
): BridgePrompt {
  // 1) 페이로드 다이어트 — 사용자가 직접 업로드한 사진은 base64 data URL 로 들어 있어
  //    한 장에 200~400KB, 30장이면 9~12MB 짜리 JSON 이 된다. ChatGPT 가 한 번에 받지 못함.
  //    토큰으로 치환해서 보내고, 답변에서 다시 복원한다 (restoreDataUrls).
  // 2) AI 가 실수로 URL 을 마사지하는 사고도 막아준다.
  const slim = {
    ...currentConfig,
    photos: Array.isArray(currentConfig?.photos)
      ? currentConfig.photos.map((p: any) => ({
          ...p,
          url:
            typeof p?.url === "string" && p.url.startsWith("data:")
              ? `__DATA_URL_${p.id}__`
              : p?.url,
        }))
      : currentConfig?.photos,
  };
  const ctx = templateName
    ? `이 영상은 '${templateName}' 템플릿을 기반으로 만들어졌어요. 템플릿의 분위기와 챕터 구조는 가능한 한 유지해주세요.\n\n`
    : "";
  return {
    title: "식전영상 수정",
    prompt: `${ctx}다음은 식전영상의 현재 설정(JSON)입니다. 요청에 맞게 수정해서 같은 형식의 JSON으로 답변해주세요.

요청: ${request}

현재 설정:
\`\`\`json
${JSON.stringify(slim, null, 2)}
\`\`\`

규칙 (꼭 지켜주세요):
1. photos 배열의 url 은 절대 새로 만들거나 바꾸지 마세요. \`__DATA_URL_xxx__\` 같은 토큰은 그대로 두면 앱이 알아서 복원해요.
2. photos 배열의 id 도 그대로 유지하세요.
3. acts(챕터) 와 templateId 는 사용자가 명시적으로 바꿔달라고 하지 않는 한 그대로.
4. 효과(effect) / 필터(filter) / 전환(transition) / 길이(durationSec) / 자막(caption) / 순서 변경은 자유롭게.
5. 사용자가 삭제하라고 한 게 아니라면 photos 항목 개수는 유지하세요.

수정된 전체 JSON 만 답변해주세요. 변경 이유는 한 줄로 짧게.`,
    expectedShape: "json",
    tier: "deep",
  };
}

/** 답변 JSON 에서 `__DATA_URL_id__` 토큰을 원본 data URL 로 복원한다. */
export function restoreDataUrls(parsed: any, originalConfig: any): any {
  if (!parsed || !Array.isArray(parsed.photos) || !Array.isArray(originalConfig?.photos)) {
    return parsed;
  }
  return {
    ...parsed,
    photos: parsed.photos.map((p: any) => {
      const url = typeof p?.url === "string" ? p.url : "";
      const m = url.match(/^__DATA_URL_(.+)__$/);
      if (m) {
        const original = originalConfig.photos.find((op: any) => op?.id === m[1]);
        if (original?.url) return { ...p, url: original.url };
      }
      return p;
    }),
  };
}

/** 답변 텍스트에서 첫 JSON 블록을 뽑는다. ```json ...``` 또는 그냥 {...} 둘 다 처리. */
export function extractJSON(text: string): unknown | null {
  // 1) 코드블럭 우선 — ```json ... ``` 또는 ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch { /* fall through */ }
  }
  // 2) 중괄호 균형 스캔 — 각 '{' 후보마다 균형 잡힌 끝까지 잘라 파싱을 시도하고,
  //    처음으로 성공하는 객체를 돌려준다. 답변에 산문 속 중괄호나 여러 JSON
  //    블록이 섞여 있어도 (예전 first-{ ~ last-} 방식과 달리) 깨지지 않는다.
  let from = text.indexOf("{");
  while (from !== -1) {
    const candidate = scanBalancedObject(text, from);
    if (candidate) {
      try { return JSON.parse(candidate); } catch { /* 다음 후보로 */ }
    }
    from = text.indexOf("{", from + 1);
  }
  return null;
}

// start 위치의 '{' 부터 균형이 맞는 '}' 까지의 부분 문자열.
// 문자열 리터럴 내부의 중괄호와 이스케이프된 따옴표는 깊이 계산에서 제외한다.
function scanBalancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export const CHAT_LINKS = {
  claude: "https://claude.ai/new",
  chatgpt: "https://chatgpt.com/",
  gemini: "https://gemini.google.com/app",
};
