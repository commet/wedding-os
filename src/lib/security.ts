// 보안 유틸 — URL/이미지/시크릿 처리 한 곳에서.
//
// 원칙:
//   1) 사용자 입력이나 AI 답변이 그대로 href / src 로 들어가지 않도록 검증.
//   2) 진짜 시크릿(AI 키, supabase anon key) 은 WeddingData 와 분리해 별도 localStorage 키에 보관.
//      → 모드 2에서 공개 row 로 새지 않도록.
//   3) 오너 표식은 클라이언트 신뢰 한도 내에서만 — 진짜 권한은 Supabase Auth 가 들어와야 끝남.

/** 안전한 외부 링크 — javascript: / data: / vbscript: 차단. http(s), mailto, tel 만 허용. */
export function safeHref(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    // base 를 줘서 상대 경로도 처리. 절대경로일 땐 base 무시됨.
    const parsed = new URL(trimmed, typeof window !== "undefined" ? window.location.origin : "https://x");
    const ok = ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol);
    return ok ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

/** 이미지/오디오 src 용 — http(s), data:image|audio, blob: (same-origin ObjectURL) 허용.
 *  idb:<id> 는 가짜 스킴(IndexedDB 참조) 이라 그대로는 못 그림 → useImageSrc 로 먼저 blob: 으로 해석한 뒤 호출. */
export function safeMediaSrc(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:(image|audio)\//i.test(trimmed)) return trimmed;
  if (/^blob:/i.test(trimmed)) return trimmed;
  // 같은 출처 정적 경로 (예: /rings/r1.png — 번들된 카탈로그 이미지). '//'(프로토콜 상대)는 제외.
  if (/^\/(?!\/)/.test(trimmed)) return trimmed;
  return undefined;
}

/** 전화번호 — 숫자, 하이픈, +, 공백, 괄호만 남김. tel: 핸들러에 인젝션되지 않도록. */
export function safeTel(phone: unknown): string | undefined {
  if (typeof phone !== "string") return undefined;
  const cleaned = phone.replace(/[^\d+\-\s()]/g, "").trim();
  return cleaned || undefined;
}

/** Supabase URL 호스트 화이트리스트 — 공식 도메인만 허용. */
export function isSupabaseHost(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      /^[A-Za-z0-9-]+\.supabase\.(co|in)$/.test(u.host)
    );
  } catch {
    return false;
  }
}

// ── 시크릿 분리 저장소 ────────────────────────────────
// 이 키는 절대 WeddingData 와 함께 export/sync 되지 않는다.

const SECRETS_KEY = "wedding-os/secrets/v1";

type Secrets = {
  aiKey?: string;
  ai?: AiConfig;
  ownerToken?: string;
  // 간편(hosted) 모드 — 운영자 호스팅 E2E. WeddingData/백업과 분리해 시크릿에만 둔다.
  // weddingId: 운영자 Supabase 의 내 행 id. weddingKey: 복호화 키(base64url, inviteCrypto).
  // 운영자는 weddingKey 를 절대 못 받으므로 암호문을 못 푼다.
  weddingId?: string;
  weddingKey?: string;
};

/** 간편(hosted) 모드 자격증명 — weddingId + weddingKey. */
export type HostedConfig = { weddingId: string; weddingKey: string };

export type AiProvider = "bridge" | "gemini" | "openai" | "anthropic" | "ollama";

export type AiConfig = {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

export function getSecrets(): Secrets {
  try {
    const raw = localStorage.getItem(SECRETS_KEY);
    return raw ? (JSON.parse(raw) as Secrets) : {};
  } catch {
    return {};
  }
}

export function setSecrets(patch: Secrets): void {
  try {
    const current = getSecrets();
    const next = { ...current, ...patch };
    // 빈 문자열은 삭제로 취급
    if (next.aiKey === "" || next.aiKey === undefined) delete next.aiKey;
    localStorage.setItem(SECRETS_KEY, JSON.stringify(next));
  } catch { /* 저장 실패는 조용히 — 사용자가 다시 입력하면 됨 */ }
}

export function getAiConfig(): AiConfig {
  const ai = getSecrets().ai;
  if (!ai || ai.provider === "bridge") return { provider: "bridge" };
  return {
    provider: ai.provider,
    apiKey: ai.apiKey,
    model: ai.model,
    baseUrl: ai.baseUrl,
  };
}

export function setAiConfig(ai: AiConfig): void {
  const clean: AiConfig = {
    provider: ai.provider,
    apiKey: ai.apiKey?.trim() || undefined,
    model: ai.model?.trim() || undefined,
    baseUrl: ai.baseUrl?.trim() || undefined,
  };
  setSecrets({ ai: clean.provider === "bridge" ? { provider: "bridge" } : clean });
}

export function clearSecrets(): void {
  try { localStorage.removeItem(SECRETS_KEY); } catch { /* noop */ }
}

export function getOrCreateOwnerToken(): string {
  const current = getSecrets().ownerToken;
  if (current && current.length >= 32) return current;
  const token = createToken();
  setSecrets({ ownerToken: token });
  return token;
}

export function getOwnerToken(): string | undefined {
  const token = getSecrets().ownerToken;
  return token && token.length >= 32 ? token : undefined;
}

export function setOwnerToken(token: string): boolean {
  const clean = token.trim();
  if (clean.length < 32) return false;
  setSecrets({ ownerToken: clean });
  markOwner();
  return true;
}

function createToken(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c?.randomUUID) {
    return `${c.randomUUID()}-${c.randomUUID()}`;
  }
  const bytes = new Uint8Array(32);
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// ── 간편(hosted) 모드 자격증명 ──────────────────────
// weddingId + weddingKey 는 시크릿 저장소에만 — 백업/동기화에 절대 안 섞인다.
// (ownerToken 은 위 getOrCreateOwnerToken 재사용.)

export function getHostedConfig(): HostedConfig | undefined {
  const { weddingId, weddingKey } = getSecrets();
  if (!weddingId || !weddingKey) return undefined;
  return { weddingId, weddingKey };
}

export function setHostedConfig(cfg: HostedConfig): void {
  const weddingId = cfg.weddingId.trim();
  const weddingKey = cfg.weddingKey.trim();
  if (!weddingId || !weddingKey) return;
  setSecrets({ weddingId, weddingKey });
}

export function clearHostedConfig(): void {
  try {
    const cur = getSecrets();
    delete cur.weddingId;
    delete cur.weddingKey;
    localStorage.setItem(SECRETS_KEY, JSON.stringify(cur));
  } catch { /* noop */ }
}

// ── 오너 마커 ────────────────────────────────────────
// 모드 2에서 "이 기기가 청첩장의 주인" 임을 표시. 게스트가 편집 탭에 접근하지 못하도록.
// 클라이언트 신뢰 한도 내에서만 — 실제 보호는 Supabase Auth 도입 시 적용됨.

const OWNER_KEY = "wedding-os/owner/v1";

export function isOwner(): boolean {
  try { return localStorage.getItem(OWNER_KEY) === "1"; }
  catch { return false; }
}

export function markOwner(): void {
  try { localStorage.setItem(OWNER_KEY, "1"); } catch { /* noop */ }
}

export function clearOwner(): void {
  try { localStorage.removeItem(OWNER_KEY); } catch { /* noop */ }
}
