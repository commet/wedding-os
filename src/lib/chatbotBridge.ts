// AI 비용 0 — 사용자가 챗봇(ChatGPT, Claude, Gemini)에 복붙해서 결과를 받아온다.
// 우리는 프롬프트만 만들어주고, 답변에서 JSON을 뽑아내는 도우미만 제공한다.

export type BridgePrompt = {
  title: string;
  prompt: string;
  expectedShape: "json" | "text";
  /** 답변에서 추출할 JSON 키 — UI에 자동 채워줄 필드 */
  keys?: string[];
};

export function ringPriceCheckPrompt(brand: string, model: string, material?: string): BridgePrompt {
  return {
    title: "반지 가격 확인",
    prompt: `다음 결혼반지의 현재 한국 매장(공식 홈페이지/공식 매장) 가격을 알려주세요.

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
    keys: ["priceKRW", "source", "verifiedAt"],
  };
}

export function hotelPriceCheckPrompt(hotel: string, checkInDate?: string, nights?: number): BridgePrompt {
  return {
    title: "호텔 가격 확인",
    prompt: `다음 호텔의 가격을 여러 OTA(예약 사이트)에서 비교해주세요.

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
  };
}

export function flightSearchPrompt(from: string, to: string, date: string): BridgePrompt {
  return {
    title: "항공편 찾기",
    prompt: `다음 일정으로 항공편을 찾아주세요.

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
