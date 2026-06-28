declare const process: { env: Record<string, string | undefined> };

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function json(body: unknown, status = 200): Response {
  return jsonWithHeaders(body, status);
}

export function jsonWithHeaders(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown")
    .split(",")[0]
    .trim();
}

function isSupabaseHost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /^[A-Za-z0-9-]+\.supabase\.(co|in)$/.test(u.host);
  } catch {
    return false;
  }
}

/** Best-effort burst protection. Authentication/capability checks remain the primary boundary. */
export function rateLimit(req: Request, scope: string, limit: number, windowMs: number): Response | null {
  return rateLimitByKey(req, scope, clientIp(req), limit, windowMs);
}

/** Same in-memory burst limiter, but keyed by authenticated user or capability as well as scope. */
export function rateLimitByKey(_req: Request, scope: string, identity: string, limit: number, windowMs: number): Response | null {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
  const key = `${scope}:${identity || "unknown"}`;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  current.count++;
  if (current.count <= limit) return null;
  return json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429);
}

export async function authenticateUser(req: Request): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return { ok: false, response: json({ error: "로그인이 필요합니다." }, 401) };

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, response: json({ error: "로그인 서버가 연결되지 않았습니다." }, 503) };
  if (!isSupabaseHost(url)) return { ok: false, response: json({ error: "로그인 서버 설정이 올바르지 않습니다." }, 503) };

  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: auth },
    });
    if (!res.ok) return { ok: false, response: json({ error: "로그인 세션이 만료됐습니다." }, 401) };
    const user = await res.json().catch(() => null);
    return user?.id
      ? { ok: true, userId: String(user.id) }
      : { ok: false, response: json({ error: "로그인이 필요합니다." }, 401) };
  } catch {
    return { ok: false, response: json({ error: "로그인 상태를 확인하지 못했습니다." }, 503) };
  }
}

export async function authenticateUserOptional(req: Request): Promise<
  { ok: true; userId: string | null } | { ok: false; response: Response }
> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth) return { ok: true, userId: null };
  return authenticateUser(req);
}

export async function requireAuthenticatedUser(req: Request): Promise<Response | null> {
  const auth = await authenticateUser(req);
  return auth.ok ? null : auth.response;
}

export async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
