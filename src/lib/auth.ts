// Supabase Auth (이메일 매직링크) — 간편(hosted) 모드의 *식별·복구* 레이어.
//
// 로그인은 "누구인지"만 증명한다. 내용 복호화 키는 passphrase 로 감싼 blob 으로만 복구되며
// (account.ts) 운영자는 못 푼다 — 로그인이 E2E 비밀을 깨지 않는다.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseHost } from "./security";
import type { RecoveryBundle } from "./recovery";
import { wrapBundle, unwrapBundle } from "./account";

let _client: SupabaseClient | null | undefined;

/** Auth 싱글톤. env(운영자 Supabase) 가 없으면 null → 로그인 비활성. */
export function getAuthClient(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key || !isSupabaseHost(url)) { _client = null; return null; }
  _client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _client;
}

export function authAvailable(): boolean { return !!getAuthClient(); }

/** 매직링크 발송. 클릭하면 /login 으로 돌아와 세션이 잡힌다. */
export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  const c = getAuthClient();
  if (!c) return { ok: false, error: "로그인을 사용할 수 없어요." };
  const { error } = await c.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/login` },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function currentEmail(): Promise<string | null> {
  const c = getAuthClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.user?.email ?? null;
}

async function currentUid(c: SupabaseClient): Promise<string | null> {
  const { data } = await c.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function signOut(): Promise<void> {
  const c = getAuthClient();
  if (c) await c.auth.signOut();
}

/** 로그인 상태에서 복구 번들을 passphrase 로 감싸 계정에 저장(upsert). */
export async function linkAccount(
  bundle: RecoveryBundle,
  passphrase: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = getAuthClient();
  if (!c) return { ok: false, error: "로그인을 사용할 수 없어요." };
  const uid = await currentUid(c);
  if (!uid) return { ok: false, error: "먼저 로그인해주세요." };
  const { blob, salt } = await wrapBundle(bundle, passphrase);
  const { error } = await c.from("wos_accounts").upsert({ user_id: uid, blob, salt });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** 로그인 상태에서 계정 blob 을 passphrase 로 풀어 복구 번들 반환. */
export async function recoverAccount(
  passphrase: string,
): Promise<{ ok: true; bundle: RecoveryBundle } | { ok: false; error: string }> {
  const c = getAuthClient();
  if (!c) return { ok: false, error: "로그인을 사용할 수 없어요." };
  const uid = await currentUid(c);
  if (!uid) return { ok: false, error: "먼저 로그인해주세요." };
  const { data, error } = await c.from("wos_accounts").select("blob, salt").eq("user_id", uid).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "이 계정에 연결된 청첩장이 없어요." };
  try {
    return { ok: true, bundle: await unwrapBundle(data.blob as string, data.salt as string, passphrase) };
  } catch {
    return { ok: false, error: "암호문구가 올바르지 않아요." };
  }
}

/** 현재 로그인 계정에 연결된 청첩장(blob)이 있는지. */
export async function hasLinkedAccount(): Promise<boolean> {
  const c = getAuthClient();
  if (!c) return false;
  const uid = await currentUid(c);
  if (!uid) return false;
  const { data } = await c.from("wos_accounts").select("user_id").eq("user_id", uid).maybeSingle();
  return !!data;
}
