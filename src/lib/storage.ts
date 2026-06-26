// 저장 계층 추상화.
// 모드 1: localStorage (this file's default impl)
// 모드 2: Supabase (storage.supabase.ts)
//
// 페이지는 useWeddingData() 훅으로만 데이터를 만지고, 백엔드를 알 필요 없다.

import { useCallback, useEffect, useState } from "react";
import { defaultData, WeddingData, SCHEMA_VERSION } from "./schema";
import { createSupabaseStorage } from "./storage.supabase";
import { demoData } from "../data/demoData";
import {
  setOwnerToken, setSecrets, isSupabaseHost, getHostedConfig, getHostedUserId,
  getOrCreateOwnerToken, hostedUserMatches,
} from "./security";
import { currentUserId, getAuthClient } from "./auth";
import { createHostedStorage, deleteHostedWedding } from "./storage.hosted";
import { unpublishInvitation } from "./inviteHosting";
import { clearImageStore, inlineIdbForExport, stripUnresolvedIdb } from "./imageStore";

const LS_KEY = "wedding-os/v1";
const LS_REVISION_KEY = "wedding-os/revision/v1";
const CORRUPT_BACKUP_KEY = "wedding-os/corrupt-backup/v1";
const DEVICE_WIPE_KEY = "wedding-os-control/device-wipe/v1";
let _wipeGeneration = typeof localStorage !== "undefined" ? localStorage.getItem(DEVICE_WIPE_KEY) : null;
let _deviceWiped = false;

export type RealtimeStatus = "idle" | "connecting" | "subscribed" | "disconnected";

export type LoadResult = { data: WeddingData; version?: number } | null;
export type SaveResult = {
  ok: boolean;
  /** 새 서버 version (성공 시) — 클라이언트가 다음 save 에 이걸 보내 conflict 검출 */
  version?: number;
  /** 다른 기기/탭이 먼저 저장 → 우리 변경은 거절됨. 사용자에게 "새로고침" 안내 필요 */
  conflict?: boolean;
};

export type StorageDriver = {
  load: () => Promise<LoadResult>;
  /** expectedVersion 을 주면 낙관적 동시성 검사를 수행. 없으면 무조건 덮어씀 (모드 1 / 첫 save). */
  save: (data: WeddingData, expectedVersion?: number) => Promise<SaveResult>;
  /** 외부에서 변경됐을 때 알림 (Supabase realtime 등) — 모드 1에선 no-op.
   *  onStatus 가 주어지면 채널 상태(SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED) 도 전달.
   *  payload 의 새 version 도 함께 전달해서 클라이언트 ref 갱신. */
  subscribe?: (
    cb: (data: WeddingData, version?: number) => void,
    onStatus?: (status: RealtimeStatus) => void,
  ) => () => void;
};

// 저장 실패 (특히 QuotaExceeded) 시 한 번만 사용자에게 알림.
// React 컴포넌트에서 호출되도록 mutable 상태 — 가벼운 토스트로 충분.
let lastQuotaAlert = 0;
function notifyQuotaError() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastQuotaAlert < 60_000) return; // 1분 내 중복 알림 차단
  lastQuotaAlert = now;
  // setTimeout으로 비동기 — setData 콜백 안에서 alert가 React 경고 안 뜨도록
  setTimeout(() => {
    alert(
      "이 기기에 담을 공간이 거의 찼어요.\n\n" +
      "지금은 모든 걸 이 휴대폰 안에만 보관하고 있어서,\n" +
      "저장 한도(약 5MB)에 가까워지면 사진을 더 넣기 어려워요.\n\n" +
      "이렇게 해보세요\n" +
      "· 안 쓰는 사진을 조금 정리하거나\n" +
      "· [설정 → 데이터 백업]으로 지금까지의 내용을 먼저 내려받은 뒤,\n" +
      "  [설정 → 저장 방식 다시 선택]에서 '내 사이트 만들기' 모드로 옮기면\n" +
      "  사진을 훨씬 넉넉하게 쓸 수 있어요."
    );
  }, 50);
}

export const localStorageDriver: StorageDriver = {
  async load() {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      assertImportBounds(parsed);
      assertImportFieldTypes(parsed);
      const revision = Number(localStorage.getItem(LS_REVISION_KEY) ?? "0") || 0;
      return { data: migrate(parsed), version: revision };
    } catch {
      if (raw) {
        try { localStorage.setItem(CORRUPT_BACKUP_KEY, raw); } catch { /* 저장소 자체가 막힌 경우 */ }
      }
      return null;
    }
  },
  async save(data, expectedVersion) {
    try {
      const currentRevision = Number(localStorage.getItem(LS_REVISION_KEY) ?? "0") || 0;
      if (expectedVersion !== undefined && expectedVersion !== currentRevision) {
        return { ok: false, conflict: true, version: currentRevision };
      }
      const nextRevision = currentRevision + 1;
      localStorage.setItem(LS_REVISION_KEY, String(nextRevision));
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      } catch (error) {
        // 본문 쓰기 실패 시 revision만 앞서 나가면 이후 모든 저장이 충돌로 거절된다.
        try { localStorage.setItem(LS_REVISION_KEY, String(currentRevision)); } catch { /* 원래 오류를 유지 */ }
        throw error;
      }
      return { ok: true, version: nextRevision };
    } catch (e: any) {
      // QuotaExceededError 또는 비슷한 — 사용자에게 알림
      const name = e?.name ?? "";
      if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
        notifyQuotaError();
      }
      return { ok: false };
    }
  },
};

export function hasCorruptLocalBackup(): boolean {
  try { return !!localStorage.getItem(CORRUPT_BACKUP_KEY); } catch { return false; }
}

export function downloadCorruptLocalBackup(): void {
  const raw = localStorage.getItem(CORRUPT_BACKUP_KEY);
  if (!raw) return;
  const blob = new Blob([raw], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `wedding-os-corrupt-backup-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** 공용 기기 로그아웃/전체 삭제용: Wedding OS의 복호화된 로컬 흔적을 모두 제거한다. */
export async function clearLocalDeviceData(): Promise<void> {
  await clearImageStore();
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith("wedding-os/")) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
  const remains = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .some((key) => key?.startsWith("wedding-os/"));
  if (remains) throw new Error("기기 데이터를 완전히 지우지 못했습니다.");
  const generation = `${Date.now()}-${crypto.randomUUID()}`;
  localStorage.setItem(DEVICE_WIPE_KEY, generation);
  _wipeGeneration = generation;
  _deviceWiped = true;
  try { sessionStorage.removeItem("wedding-os/demo-banner-dismissed/v1"); } catch { /* 세션 저장소 접근 불가 */ }
}

// 객체 여부 — null/array 는 제외
function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

// ──────────────────────────────────────────────────────────────
// 스키마 마이그레이션 체인
// SCHEMA_VERSION 을 올릴 때, 이전 버전에서 새 버전으로 가는 함수를 등록한다.
// 예: 사진 필드 이름을 url → src 로 바꾸면 migrations[2] 에 변환 함수 추가.
// 빠진 버전(=등록 안 됨) 은 identity → shape sanitize 가 마무리하므로 안전.
// ──────────────────────────────────────────────────────────────
type RawData = Record<string, unknown>;
const migrations: Record<number, (prev: RawData) => RawData> = {
  // 2: (v1) => ({ ...v1, newField: ... }),
};

function applyMigrations(raw: RawData, fromVersion: number, toVersion: number): RawData {
  let cur = raw;
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    const fn = migrations[v];
    if (fn) {
      try { cur = fn(cur); }
      catch (e) {
        if (typeof console !== "undefined") console.warn(`[storage] migration v${v} failed:`, e);
      }
    }
  }
  return cur;
}

function detectSchemaVersion(raw: RawData): number {
  const v = raw.schemaVersion;
  return typeof v === "number" && v > 0 ? v : 1;
}

// preferences.supabase 가 안전한 호스트인지 검증.
// localStorage 가 변조됐을 때 anon key 가 공격자 호스트로 새는 사고 방지.
function sanitizeSupabaseConfig(s: unknown): WeddingData["preferences"]["supabase"] | undefined {
  if (!isPlainObject(s)) return undefined;
  const url = typeof s.url === "string" ? s.url : "";
  const anonKey = typeof s.anonKey === "string" ? s.anonKey : "";
  const configId = typeof s.configId === "string" ? s.configId : undefined;
  const rsvpToken = typeof s.rsvpToken === "string" ? s.rsvpToken : undefined;
  if (!url || !anonKey) return undefined;
  if (!isSupabaseHost(url)) {
    // 변조 의심 — 통째로 무시 (UI 에선 mode=null + supabase=undefined 로 보임)
    return undefined;
  }
  return { url, anonKey, ...(configId ? { configId } : {}), ...(rsvpToken ? { rsvpToken } : {}) };
}

function migrate(raw: unknown): WeddingData {
  // 누락된 필드를 defaultData로 안전하게 보충 + 손상된 입력 검증.
  // raw 는 localStorage 또는 import 파일에서 옴 → 절대 신뢰하지 않는다.
  const base = defaultData();
  const rawObj: RawData = isPlainObject(raw) ? raw : {};
  // 1) 버전 마이그레이션 — 이전 버전 데이터를 SCHEMA_VERSION 까지 끌어올림.
  const fromVersion = detectSchemaVersion(rawObj);
  const data: RawData = applyMigrations(rawObj, fromVersion, SCHEMA_VERSION);
  // 2) 모양 검증 — 마이그레이션 후에도 손상된 필드는 defaultData 로 보충.

  // 이전 버전 호환: preferences.aiKey 가 남아 있다면 별도 secrets 저장소로 이전 후 제거.
  // (공개될 수 있는 WeddingData 트리에 sk-ant-... 같은 결제 키가 들어가는 걸 막기 위함.)
  const prefsRaw: Record<string, unknown> = isPlainObject(data.preferences) ? data.preferences : {};
  if (typeof prefsRaw.aiKey === "string" && prefsRaw.aiKey) {
    try { setSecrets({ aiKey: prefsRaw.aiKey }); } catch { /* noop */ }
  }

  const validMode = (m: unknown): WeddingData["preferences"]["mode"] =>
    m === "local" || m === "hosted" || m === "supabase" || m === "devOnly" ? m : null;
  const validLocale = (l: unknown): WeddingData["preferences"]["locale"] =>
    l === "ko" || l === "en" || l === "zh" ? l : "ko";

  return {
    schemaVersion: SCHEMA_VERSION,
    preferences: {
      ...base.preferences,
      mode: validMode(prefsRaw.mode),
      locale: validLocale(prefsRaw.locale),
      isDemo: prefsRaw.isDemo === true,
      supabase: sanitizeSupabaseConfig(prefsRaw.supabase),
      lastBackupAt: typeof prefsRaw.lastBackupAt === "string" ? prefsRaw.lastBackupAt : undefined,
    },
    ai: (() => {
      const rawAi = isPlainObject(data.ai) ? data.ai : {};
      const rawProfile = isPlainObject(rawAi.profile) ? rawAi.profile : {};
      // 'budget' 우선순위는 폐기됨 — 옛 데이터는 'venue' 로 끌어올린다.
      const rawPriority = String(rawProfile.priority);
      const priority = rawPriority === "budget"
        ? "venue" as const
        : (["venue", "invitation", "rings", "trip"].includes(rawPriority)
            ? rawPriority as "venue" | "invitation" | "rings" | "trip"
            : undefined);
      return {
        starterSummary: typeof rawAi.starterSummary === "string" ? rawAi.starterSummary : undefined,
        today: Array.isArray(rawAi.today)
          ? rawAi.today.filter(isPlainObject).slice(0, 3).map((item) => ({
              title: typeof item.title === "string" ? item.title.slice(0, 200) : "",
              reason: typeof item.reason === "string" ? item.reason.slice(0, 500) : undefined,
              targetPath: typeof item.targetPath === "string" ? item.targetPath.slice(0, 100) : undefined,
            })).filter((item) => item.title)
          : undefined,
        updatedAt: typeof rawAi.updatedAt === "string" ? rawAi.updatedAt : undefined,
        profile: {
          priority,
          budgetKRW: typeof rawProfile.budgetKRW === "number" && rawProfile.budgetKRW > 0
            ? Math.min(rawProfile.budgetKRW, 10_000_000_000)
            : undefined,
          region: typeof rawProfile.region === "string" ? rawProfile.region.slice(0, 80) : undefined,
          onboardedAt: typeof rawProfile.onboardedAt === "string" ? rawProfile.onboardedAt : undefined,
        },
      };
    })(),
    invitation:  { ...base.invitation,  ...(isPlainObject(data.invitation) ? data.invitation : {}) },
    rings:       (Array.isArray(data.rings)   ? data.rings.filter(isPlainObject)   : []) as WeddingData["rings"],
    sdm:         (Array.isArray(data.sdm)     ? data.sdm.filter(isPlainObject)     : []) as WeddingData["sdm"],
    hotels:      (Array.isArray(data.hotels)  ? data.hotels.filter(isPlainObject)  : []) as WeddingData["hotels"],
    flights:     (Array.isArray(data.flights) ? data.flights.filter(isPlainObject) : []) as WeddingData["flights"],
    honeymoon: (() => {
      const h = isPlainObject(data.honeymoon) ? data.honeymoon : {};
      return {
        ...base.honeymoon,
        ...h,
        regions: Array.isArray(h.regions) ? h.regions : [],
      };
    })(),
    checklist:   (Array.isArray(data.checklist) ? data.checklist.filter(isPlainObject).map((section) => ({
      ...section,
      items: Array.isArray(section.items) ? section.items.filter(isPlainObject) : [],
    })) : []) as WeddingData["checklist"],
    venues:      (Array.isArray(data.venues)   ? data.venues.filter(isPlainObject)   : []) as WeddingData["venues"],
    budget:      (Array.isArray(data.budget)   ? data.budget.filter(isPlainObject)   : []) as WeddingData["budget"],
    guests:      (Array.isArray(data.guests)   ? data.guests.filter(isPlainObject)   : []) as WeddingData["guests"],
    headcount:   sanitizeHeadcount(data.headcount),
    ceremony:    (Array.isArray(data.ceremony) ? data.ceremony.filter(isPlainObject) : undefined) as WeddingData["ceremony"],
    video: (() => {
      const v = isPlainObject(data.video) ? data.video : {};
      return {
        ...base.video,
        ...v,
        acts: Array.isArray(v.acts) ? v.acts : [],
        photos: Array.isArray(v.photos) ? v.photos : [],
      };
    })(),
    publish: sanitizePublish(data.publish),
  };
}

// 예상 인원 검증 — side·category 가 유효하고 expected 가 정상 수일 때만 통과.
function sanitizeHeadcount(h: unknown): WeddingData["headcount"] {
  if (!isPlainObject(h) || !Array.isArray(h.estimates)) return undefined;
  const cats = new Set(["family", "relative", "work", "school", "friend", "acquaintance"]);
  const estimates = h.estimates
    .filter(isPlainObject)
    .filter((e) => (e.side === "groom" || e.side === "bride") && cats.has(String(e.category)))
    .map((e) => ({
      side: e.side,
      category: e.category,
      expected: typeof e.expected === "number" && e.expected > 0 ? Math.min(Math.round(e.expected), 9999) : 0,
    }))
    .filter((e) => e.expected > 0);
  const giftAvg = Array.isArray(h.giftAvg)
    ? h.giftAvg
        .filter(isPlainObject)
        .filter((g) => cats.has(String(g.category)) && typeof g.krw === "number" && g.krw >= 0)
        .map((g) => ({ category: g.category, krw: Math.min(Math.round(g.krw as number), 100_000_000) }))
    : [];
  if (!estimates.length && !giftAvg.length) return undefined;
  return { estimates, ...(giftAvg.length ? { giftAvg } : {}) } as WeddingData["headcount"];
}

// 발행 자격증명 검증 — code·keyRaw 가 문자열일 때만 통과. 손상 시 undefined(미발행 취급).
function sanitizePublish(p: unknown): WeddingData["publish"] {
  if (!isPlainObject(p)) return undefined;
  const code = typeof p.code === "string" ? p.code : "";
  const keyRaw = typeof p.keyRaw === "string" ? p.keyRaw : "";
  const rsvpToken = typeof p.rsvpToken === "string" ? p.rsvpToken : undefined;
  if (!/^[a-z0-9]{6,16}$/.test(code) || !keyRaw) return undefined;
  return {
    code,
    keyRaw,
    ...(rsvpToken ? { rsvpToken } : {}),
    publishedAt: typeof p.publishedAt === "string" ? p.publishedAt : "",
  };
}

/** 현재 저장된 모드만 보고 드라이버 선택. preferences.mode 없으면 local. */
function selectDriver(data: WeddingData | null): StorageDriver {
  const mode = data?.preferences.mode;
  if (mode === "hosted") {
    // 간편 모드 — 운영자 Supabase(env) + 시크릿(weddingId·weddingKey) + ownerToken.
    const cfg = getHostedConfig();
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (cfg && url && key) {
      return createHostedStorage(url, key, cfg.weddingId, cfg.weddingKey, getOrCreateOwnerToken());
    }
    // env/시크릿 누락 → 로컬에만 안전 보관 (연결되면 다음 save 부터 동기화).
    return localStorageDriver;
  }
  if (mode === "supabase" && data?.preferences.supabase) {
    const sb = data.preferences.supabase;
    return createSupabaseStorage(sb.url, sb.anonKey, sb.configId);
  }
  return localStorageDriver;
}

// ──────────────────────────────────────────────────────────────
// 낙관적 동시성 — 모듈 레벨로 현재 알고 있는 server version 유지.
// useWeddingData 가 init/realtime 에서 갱신, enqueueSave 가 save 직전에 읽음.
// (configId 가 단일 'default' 이고 hook 도 App.tsx 단일 인스턴스라 module state OK)
// ──────────────────────────────────────────────────────────────
let _localVersion: number | undefined = undefined;
let _localMirrorVersion: number | undefined = undefined;
export type ConflictStatus = "none" | "detected";
let _conflictStatus: ConflictStatus = "none";
const _conflictListeners = new Set<(s: ConflictStatus) => void>();
function _emitConflict(s: ConflictStatus) {
  if (_conflictStatus === s) return;
  _conflictStatus = s;
  _conflictListeners.forEach((l) => l(s));
}

export function useConflictStatus(): ConflictStatus {
  const [s, setS] = useState<ConflictStatus>(_conflictStatus);
  useEffect(() => {
    setS(_conflictStatus);
    const listener = (next: ConflictStatus) => setS(next);
    _conflictListeners.add(listener);
    return () => { _conflictListeners.delete(listener); };
  }, []);
  return s;
}

export function clearConflict() { _emitConflict("none"); }

async function mirrorToLocal(data: WeddingData): Promise<void> {
  const result = await localStorageDriver.save(data, _localMirrorVersion);
  if (result.ok && typeof result.version === "number") {
    _localMirrorVersion = result.version;
  } else if (result.conflict) {
    _emitConflict("detected");
  }
}

/**
 * 최상위 훅. 페이지에선 이것만 쓴다.
 *
 * 주의: 모드 전환 시점에 driver 자체가 바뀐다.
 * preferences.mode가 바뀌면 다음 save 호출부터 새 드라이버로 감.
 */
export function useWeddingData() {
  const [data, setData] = useState<WeddingData | null>(null);
  const [loading, setLoading] = useState(true);

  // 초기 로드 — cancelled 로 StrictMode race 차단 (상세 설명은 아래)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      consumeOwnerTokenFromHash();
      const fromLocal = await localStorageDriver.load();
      if (cancelled) return;
      if (fromLocal) {
        if (fromLocal.data.preferences.mode === "hosted" && getHostedUserId()) {
          const userId = await currentUserId();
          if (cancelled) return;
          if (!userId || !hostedUserMatches(userId)) {
            setData(demoData());
            setLoading(false);
            if (window.location.pathname !== "/login") window.location.replace("/login");
            return;
          }
        }
        _localMirrorVersion = fromLocal.version;
        const driver = selectDriver(fromLocal.data);
        const fromActual = (await driver.load()) ?? fromLocal;
        if (cancelled) return;
        let normalized: WeddingData;
        try {
          assertImportBounds(fromActual.data);
          assertImportFieldTypes(fromActual.data);
          normalized = migrate(fromActual.data);
        } catch {
          normalized = fromLocal.data;
          _emitConflict("detected");
        }
        setData(normalized);
        _localVersion = fromActual.version;
        if (driver !== localStorageDriver && normalized !== fromLocal.data) void mirrorToLocal(normalized);
        setLoading(false);
        return;
      }

      // 로컬에 아무것도 없으면 예시(데모)로 시작 — 모드 선택 전 둘러보기 단계.
      // 간편(hosted) 모드 복구는 /recover 가 시크릿(weddingId·key)+mode 를 심어 위 fromLocal
      // 경로로 들어온다. 공개 청첩장은 /i/<code> 가 별도(Blob) 처리하므로, 여기서 운영자
      // env supabase 를 직접 읽지 않는다 (옛 단일테넌트 경로 제거).
      if (cancelled) return;
      setData(demoData());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // A session can change in another tab without an explicit logout on this page.
  // Never keep rendering a hosted wedding after the browser switches to a different account.
  useEffect(() => {
    const client = getAuthClient();
    if (!client) return;
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (getHostedConfig() && getHostedUserId() && (!userId || !hostedUserMatches(userId))) {
        window.location.replace("/login");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // 다른 탭의 로컬 편집을 수신한다. 저장 중이면 덮지 않고 충돌로 표시한다.
  useEffect(() => {
    if (data?.preferences.mode !== "local") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LS_KEY || !event.newValue) return;
      if (_pending > 0) { _emitConflict("detected"); return; }
      try {
        const parsed: unknown = JSON.parse(event.newValue);
        assertImportBounds(parsed);
        assertImportFieldTypes(parsed);
        const next = migrate(parsed);
        _localMirrorVersion = Number(localStorage.getItem(LS_REVISION_KEY) ?? "0") || 0;
        setData(next);
      } catch {
        _emitConflict("detected");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [data?.preferences.mode]);

  // 로그아웃/기기 삭제는 모든 모드와 탭에 전파한다. 이전 탭의 메모리 상태도 즉시 폐기한다.
  useEffect(() => {
    const onDeviceWipe = (event: StorageEvent) => {
      if (event.key !== DEVICE_WIPE_KEY || !event.newValue || event.newValue === _wipeGeneration) return;
      _wipeGeneration = event.newValue;
      _deviceWiped = true;
      window.location.replace("/");
    };
    window.addEventListener("storage", onDeviceWipe);
    return () => window.removeEventListener("storage", onDeviceWipe);
  }, []);

  const update = useCallback(
    async (patch: Partial<WeddingData> | ((prev: WeddingData) => WeddingData)) => {
      setData((prev) => {
        const base = prev ?? defaultData();
        const next = typeof patch === "function" ? patch(base) : { ...base, ...patch };
        // 저장은 큐로 직렬화 — 빠르게 연속 update 가 와도 호출 순서대로 반영되도록.
        // (앞 요청이 네트워크 지연으로 늦게 도착해 새 값을 덮어쓰는 race 방지.)
        enqueueSave(next);
        return next;
      });
    },
    []
  );

  // 실시간 협업 — 모드 2일 때만, Supabase Realtime postgres_changes 구독.
  // 신랑·신부 동시 편집 시 다른 쪽 화면이 자동 갱신됨.
  const supabaseUrl = data?.preferences.supabase?.url;
  const supabaseKey = data?.preferences.supabase?.anonKey;
  const isSupabaseMode = data?.preferences.mode === "supabase";
  useEffect(() => {
    // supabase 연결(프로젝트·모드)이 바뀌면 이전 프로젝트의 server version 은 무효다.
    // 초기화하지 않으면 다음 save 가 엉뚱한 expectedVersion 을 보내 거짓 충돌이나
    // 조용한 덮어쓰기를 일으킬 수 있다. (마운트 시엔 초기 load 가 곧 올바른 값으로 덮어씀.)
    _localVersion = undefined;
    if (!isSupabaseMode || !supabaseUrl || !supabaseKey) {
      _emitRealtimeStatus("idle");
      return;
    }
    const driver = createSupabaseStorage(supabaseUrl, supabaseKey, data?.preferences.supabase?.configId);
    if (!driver.subscribe) return;
    const unsubscribe = driver.subscribe(
      (next, version) => {
        // 로컬 저장이 진행 중이면 원격 스냅샷을 적용하지 않는다 — 그대로 덮어쓰면
        // 내 미저장 편집이 사라지고, _localVersion 이 갱신돼 내 save 가 거짓 성공하며
        // 상대 변경까지 날린다. 건너뛰면 내 save 가 옛 버전으로 충돌 감지되어
        // '새로고침' 안내로 안전하게 수렴한다. (저장 큐가 비면 다음 이벤트가 정상 적용.)
        if (_pending > 0) return;
        let normalized: WeddingData;
        try {
          assertImportBounds(next);
          assertImportFieldTypes(next);
          normalized = migrate(next);
        } catch {
          _emitConflict("detected");
          return;
        }
        if (typeof version === "number") _localVersion = version;
        setData((prev) => {
          if (!prev) return normalized;
          if (JSON.stringify(prev) === JSON.stringify(normalized)) return prev;
          return normalized;
        });
        void mirrorToLocal(normalized);
      },
      (status) => _emitRealtimeStatus(status),
    );
    return () => {
      try { unsubscribe(); } catch {}
      _emitRealtimeStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUrl, supabaseKey, isSupabaseMode]);

  return { data, loading, update };
}

function consumeOwnerTokenFromHash() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const token = params.get("ownerToken");
  if (!token || !setOwnerToken(token)) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

// 직렬 저장 큐. 모든 save 호출이 이 chain 위에서 순차 실행된다.
// 실패는 조용히 — 다음 save 가 올바른 최신 상태를 다시 쓰면 정상화됨.
let saveChain: Promise<unknown> = Promise.resolve();

// 저장 상태 — 모드 2(원격)에선 사용자가 "내 데이터가 잘 갔나" 알 수 있도록 헤더에 작게 노출.
export type SaveStatus = "idle" | "saving" | "saved" | "error";
let _saveStatus: SaveStatus = "idle";
let _pending = 0;
let _lastError = false;
let _savedClearTimer: ReturnType<typeof setTimeout> | null = null;
const _saveListeners = new Set<(s: SaveStatus) => void>();
function _emitSaveStatus(s: SaveStatus) {
  _saveStatus = s;
  _saveListeners.forEach((l) => l(s));
}

export function useSaveStatus(): SaveStatus {
  const [s, setS] = useState<SaveStatus>(_saveStatus);
  useEffect(() => {
    setS(_saveStatus);
    const listener = (next: SaveStatus) => setS(next);
    _saveListeners.add(listener);
    return () => { _saveListeners.delete(listener); };
  }, []);
  return s;
}

// 실시간 채널 상태 — 끊겼을 때 헤더에 작게 알림(부부 동시 편집이 깨졌다는 신호).
let _realtimeStatus: RealtimeStatus = "idle";
const _realtimeListeners = new Set<(s: RealtimeStatus) => void>();
function _emitRealtimeStatus(s: RealtimeStatus) {
  if (_realtimeStatus === s) return;
  _realtimeStatus = s;
  _realtimeListeners.forEach((l) => l(s));
}

export function useRealtimeStatus(): RealtimeStatus {
  const [s, setS] = useState<RealtimeStatus>(_realtimeStatus);
  useEffect(() => {
    setS(_realtimeStatus);
    const listener = (next: RealtimeStatus) => setS(next);
    _realtimeListeners.add(listener);
    return () => { _realtimeListeners.delete(listener); };
  }, []);
  return s;
}

function enqueueSave(next: WeddingData) {
  const queuedWipeGeneration = _wipeGeneration;
  const driver = selectDriver(next);
  _pending++;
  if (_savedClearTimer) { clearTimeout(_savedClearTimer); _savedClearTimer = null; }
  _emitSaveStatus("saving");
  saveChain = saveChain
    .then(async () => {
      const currentWipeGeneration = localStorage.getItem(DEVICE_WIPE_KEY);
      if (_deviceWiped || currentWipeGeneration !== queuedWipeGeneration) {
        _deviceWiped = true;
        _pending--;
        if (_pending === 0) _emitSaveStatus("idle");
        return;
      }
      try {
        const expectedVersion = driver === localStorageDriver ? _localMirrorVersion : _localVersion;
        const r = await driver.save(next, expectedVersion);
        if (r.ok) {
          if (typeof r.version === "number") {
            if (driver === localStorageDriver) _localMirrorVersion = r.version;
            else _localVersion = r.version;
          }
        } else {
          _lastError = true;
          if (r.conflict) _emitConflict("detected");
        }
      } catch { _lastError = true; }
      if (!_deviceWiped && driver !== localStorageDriver) {
        // 모드 2여도 localStorage에 항상 미러 — 오프라인 fallback / 새 기기 import 시 출발점.
        try { await mirrorToLocal(next); }
        catch { /* localStorage 실패는 별도 notifyQuotaError 가 처리 */ }
      }
      _pending--;
      if (_pending === 0) {
        const finalStatus: SaveStatus = _lastError ? "error" : "saved";
        _lastError = false;
        _emitSaveStatus(finalStatus);
        if (finalStatus === "saved") {
          _savedClearTimer = setTimeout(() => {
            if (_saveStatus === "saved") _emitSaveStatus("idle");
            _savedClearTimer = null;
          }, 2500);
        }
      }
    })
    .catch(() => undefined);
}

// 데이터 export / import — 모드 전환 또는 백업용.
//
// 보안: 백업 파일은 사용자가 친구에게 보내 의견을 묻거나, 클라우드에 올리는 경우가 잦다.
// 따라서 export 시 시크릿(supabase anonKey 등) 은 제거한다.
// 모드 2 설정은 사용자가 새 기기에서 Setup 위저드로 다시 입력하도록 안내.
//
// 사진: idb:<id> 참조는 다른 기기에서 못 푸므로 export 시 base64 로 인라인.
//       (백업 파일이 다른 기기/세션에서도 그대로 열리도록 portable 보장.)
// 운영자 서버에 남는 내 데이터를 정리 — 계정/데이터 완전 삭제 시 호출.
// best-effort: 일부 실패해도 나머지는 진행(네트워크 등). 로컬 삭제는 호출부가 별도로 처리.
export async function purgeServerData(data: WeddingData): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  // 1. 발행 청첩장(Blob): 암호문·메타·RSVP 삭제 (ownerToken 검증)
  if (data.publish?.code) {
    try {
      const result = await unpublishInvitation(data.publish.code);
      if (!result.ok) errors.push(result.reason);
    } catch { errors.push("발행 청첩장을 삭제하지 못했습니다."); }
  }
  // 2. 간편(hosted) 데이터 행 삭제
  if (data.preferences.mode === "hosted") {
    const cfg = getHostedConfig();
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (cfg && url && key) {
      try {
        const deleted = await deleteHostedWedding(url, key, cfg.weddingId, getOrCreateOwnerToken());
        if (!deleted) errors.push("간편 모드 서버 데이터를 삭제하지 못했습니다.");
      } catch { errors.push("간편 모드 서버 데이터를 삭제하지 못했습니다."); }
    } else {
      errors.push("간편 모드 삭제 자격증명을 찾지 못했습니다.");
    }
  }
  return { ok: errors.length === 0, errors };
}

export async function exportData(data: WeddingData): Promise<void> {
  const inlined: WeddingData = await inlineIdbForExport(data);
  // base64 인라인에 실패해 남은 idb: 참조는 다른 기기에서 못 푸므로 깨진 사진이 된다.
  // 백업에 죽은 참조를 담는 대신 들어내고, 몇 장이 빠졌는지 사용자에게 정직하게 알린다.
  const { data: cleaned, removed } = stripUnresolvedIdb(inlined);
  if (removed > 0 && typeof window !== "undefined") {
    alert(
      `⚠️ 사진 ${removed}장은 백업 파일에 담지 못했어요.\n\n` +
      "이 사진들의 원본을 이 기기에서 찾지 못했어요.\n" +
      "나머지 모든 정보는 백업에 정상 포함됩니다."
    );
  }
  const sanitized: WeddingData = {
    ...cleaned,
    preferences: {
      ...cleaned.preferences,
      // supabase 연결 정보는 백업에 포함하지 않음 — 친구에게 백업 공유 시 키 노출 방지.
      supabase: undefined,
    },
  };
  const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const name = `wedding-os-backup-${new Date().toISOString().split("T")[0]}.json`;
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// import 시 환경설정(특히 preferences.supabase) 은 현재 값을 유지한다.
// 그렇지 않으면 악의적으로 작성된 백업 파일이 사용자의 모드 2 연결을 공격자의 Supabase 로 바꿔치기할 수 있음.
export async function importData(file: File, current: WeddingData): Promise<WeddingData> {
  const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
  if (file.size > MAX_IMPORT_BYTES) throw new Error("백업 파일은 20MB 이하여야 합니다.");
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  assertImportBounds(parsed);
  assertImportFieldTypes(parsed);
  const migrated = migrate(parsed);
  return {
    ...migrated,
    preferences: {
      ...migrated.preferences,
      // 백업이 모드·로케일·디스플레이 설정을 가져오는 건 허용,
      // 단 supabase 연결 정보는 항상 현재 기기 값으로 강제 — 데이터 탈취 방지.
      supabase: current.preferences.supabase,
    },
  };
}

function assertImportFieldTypes(value: unknown): void {
  if (!isPlainObject(value)) throw new Error("백업 최상위 데이터가 객체가 아닙니다.");
  const scalar = (record: Record<string, unknown>, strings: string[], numbers: string[] = [], booleans: string[] = []) => {
    for (const key of strings) {
      if (record[key] !== undefined && typeof record[key] !== "string") throw new Error(`백업 필드 ${key}의 형식이 올바르지 않습니다.`);
      if (typeof record[key] === "string" && record[key].length > 20_000) throw new Error(`백업 필드 ${key}가 너무 깁니다.`);
    }
    for (const key of numbers) if (record[key] !== undefined && (typeof record[key] !== "number" || !Number.isFinite(record[key]))) throw new Error(`백업 필드 ${key}의 형식이 올바르지 않습니다.`);
    for (const key of booleans) if (record[key] !== undefined && typeof record[key] !== "boolean") throw new Error(`백업 필드 ${key}의 형식이 올바르지 않습니다.`);
  };
  const records = (key: string) => {
    const list = value[key];
    if (list === undefined) return [];
    if (!Array.isArray(list) || !list.every(isPlainObject)) throw new Error(`백업의 ${key} 목록 형식이 올바르지 않습니다.`);
    return list;
  };
  const nestedRecords = (record: Record<string, unknown>, key: string) => {
    const list = record[key];
    if (list === undefined) return [];
    if (!Array.isArray(list) || !list.every(isPlainObject)) throw new Error(`백업의 ${key} 목록 형식이 올바르지 않습니다.`);
    return list;
  };
  const optionalRecord = (record: Record<string, unknown>, key: string) => {
    const item = record[key];
    if (item === undefined) return undefined;
    if (!isPlainObject(item)) throw new Error(`백업의 ${key} 형식이 올바르지 않습니다.`);
    return item;
  };
  const contractFields = ["contact", "quote", "payment", "cancellation", "included", "extras", "evidence"];

  records("rings").forEach((item) => {
    scalar(item, ["id", "brand", "model", "material", "imageUrl", "imageFit", "notes", "link", "lastVerified", "source"], ["priceKRW"], ["hasDiamond"]);
    for (const key of ["imageUrls", "starredBy", "likedBy"] as const) {
      if (item[key] !== undefined && (!Array.isArray(item[key]) || !item[key].every((entry) => typeof entry === "string"))) {
        throw new Error(`백업 필드 ${key}의 형식이 올바르지 않습니다.`);
      }
    }
  });
  records("sdm").forEach((item) => {
    scalar(item, ["id", "category", "name", "priceRange", "region", "notes", "link", "status", "contact", "balanceDueAt"], ["depositKRW", "balanceKRW"]);
    const contract = optionalRecord(item, "contract");
    if (contract) scalar(contract, contractFields);
  });
  records("hotels").forEach((item) => {
    scalar(item, ["id", "name", "location", "notes", "lastVerified", "source"]);
    nestedRecords(item, "rooms").forEach((room) => scalar(room, ["type"], ["pricePerNight"], ["breakfast"]));
    nestedRecords(item, "otaPrices").forEach((price) => scalar(price, ["ota", "url"], ["price"]));
  });
  records("flights").forEach((item) => scalar(item, ["id", "airline", "flightNumber", "from", "to", "departAt", "arriveAt", "notes", "link", "lastVerified", "source"], ["priceKRW"]));
  records("venues").forEach((item) => {
    scalar(item, ["id", "name", "region", "hallType", "foodType", "link", "notes", "status", "visitedAt", "lastVerified", "source", "contact", "balanceDueAt"], ["capacityMin", "capacityMax", "mealPriceMin", "mealPriceMax", "depositKRW", "balanceKRW"]);
    const contract = optionalRecord(item, "contract");
    if (contract) scalar(contract, contractFields);
  });
  records("budget").forEach((item) => scalar(item, ["id", "category", "notes"], ["planned", "actual", "avgKRW"], ["paid"]));
  records("guests").forEach((item) => scalar(item, ["id", "name", "relation", "group", "side", "category", "phone", "email", "status", "notes", "invitedAt"], ["partyCount", "giftKRW"], ["meal"]));

  records("checklist").forEach((section) => {
    scalar(section, ["id", "icon", "title"]);
    if (!Array.isArray(section.items) || !section.items.every(isPlainObject)) throw new Error("백업의 체크리스트 항목 형식이 올바르지 않습니다.");
    section.items.forEach((item) => scalar(item, ["id", "text", "source", "dueDate", "priority"], ["ddayOffset"], ["done"]));
  });

  if (value.honeymoon !== undefined) {
    if (!isPlainObject(value.honeymoon)) throw new Error("백업의 신혼여행 형식이 올바르지 않습니다.");
    scalar(value.honeymoon, ["startDate", "endDate", "notes"]);
    nestedRecords(value.honeymoon, "regions").forEach((region) =>
      scalar(region, ["id", "name", "schedule", "notes"], ["durationDays", "budgetKRW"]));
  }

  if (value.video !== undefined) {
    if (!isPlainObject(value.video)) throw new Error("백업의 영상 형식이 올바르지 않습니다.");
    scalar(value.video, ["title", "templateId", "bgmUrl"], ["titleCardSec", "endingSec", "fps"]);
    nestedRecords(value.video, "acts").forEach((act) => scalar(act, ["id", "title", "subtitle"]));
    nestedRecords(value.video, "photos").forEach((photo) => {
      scalar(photo, ["id", "caption", "effect", "transition", "filter", "actId"], ["durationSec"]);
      if (typeof photo.url !== "string" || photo.url.length > 8 * 1024 * 1024) throw new Error("백업의 영상 사진 형식이 올바르지 않습니다.");
    });
    if (value.video.ending !== undefined) {
      if (!isPlainObject(value.video.ending)) throw new Error("백업의 영상 엔딩 형식이 올바르지 않습니다.");
      scalar(value.video.ending, ["message", "date", "time", "venue"]);
    }
  }

  if (value.ai !== undefined) {
    if (!isPlainObject(value.ai)) throw new Error("백업의 AI 메모 형식이 올바르지 않습니다.");
    scalar(value.ai, ["starterSummary", "updatedAt"]);
    nestedRecords(value.ai, "today").forEach((item) => scalar(item, ["title", "reason", "targetPath"]));
    nestedRecords(value.ai, "dialogue").forEach((item) => scalar(item, ["id", "question", "answer", "answeredAt"]));
  }

  if (isPlainObject(value.invitation)) {
    scalar(value.invitation, [
      "groomName", "brideName", "groomEnglishName", "brideEnglishName", "date", "time", "venue", "venueHall",
      "venueAddress", "venueMapUrl", "greeting", "groomOrder", "brideOrder", "groomPhone",
      "bridePhone", "groomAccount", "brideAccount", "theme", "fontStyle",
    ], [], ["rsvpEnabled"]);
    for (const mediaKey of ["heroImageUrl", "bgmUrl"] as const) {
      const media = value.invitation[mediaKey];
      if (media !== undefined && (typeof media !== "string" || media.length > 8 * 1024 * 1024)) {
        throw new Error(`백업 필드 ${mediaKey}의 형식이 올바르지 않습니다.`);
      }
    }
    if (value.invitation.gallery !== undefined && (!Array.isArray(value.invitation.gallery) || !value.invitation.gallery.every((item) => {
      if (!isPlainObject(item)) return false;
      return typeof item.url === "string" && item.url.length <= 8 * 1024 * 1024 &&
        (item.caption === undefined || (typeof item.caption === "string" && item.caption.length <= 20_000));
    }))) throw new Error("백업의 갤러리 형식이 올바르지 않습니다.");
    for (const parentKey of ["groomParents", "brideParents"] as const) {
      const parents = value.invitation[parentKey];
      if (parents !== undefined) {
        if (!isPlainObject(parents)) throw new Error(`백업 필드 ${parentKey}의 형식이 올바르지 않습니다.`);
        scalar(parents, ["father", "mother"]);
      }
    }
  }
}

function assertImportBounds(value: unknown, depth = 0): void {
  if (depth > 20) throw new Error("백업 데이터 구조가 너무 깊습니다.");
  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new Error("백업 항목 수가 허용 범위를 넘었습니다.");
    value.forEach((item) => assertImportBounds(item, depth + 1));
    return;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length > 1_000) throw new Error("백업 객체의 필드 수가 허용 범위를 넘었습니다.");
    entries.forEach(([, item]) => assertImportBounds(item, depth + 1));
    return;
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("백업에 올바르지 않은 숫자가 있습니다.");
  if (typeof value === "string" && value.length > 8 * 1024 * 1024) throw new Error("백업 문자열이 허용 크기를 넘었습니다.");
}
