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

export function videoEditPrompt(currentConfig: any, request: string): BridgePrompt {
  return {
    title: "식전영상 수정",
    prompt: `다음은 식전영상의 현재 설정(JSON)입니다. 요청에 맞게 수정해서 같은 형식의 JSON으로 답변해주세요.

요청: ${request}

현재 설정:
\`\`\`json
${JSON.stringify(currentConfig, null, 2)}
\`\`\`

수정된 전체 JSON만 답변해주세요. 변경 이유는 한 줄로 짧게.`,
    expectedShape: "json",
  };
}

/** 답변 텍스트에서 첫 JSON 블록을 뽑는다. ```json ...``` 또는 그냥 {...} 둘 다 처리. */
export function extractJSON(text: string): unknown | null {
  // 코드블럭 우선
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch { /* fall through */ }
  }
  // 가장 바깥 중괄호
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall */ }
  }
  return null;
}

export const CHAT_LINKS = {
  claude: "https://claude.ai/new",
  chatgpt: "https://chatgpt.com/",
  gemini: "https://gemini.google.com/app",
};
