// 저장 계층 추상화.
// 모드 1: localStorage (this file's default impl)
// 모드 2: Supabase (storage.supabase.ts)
//
// 페이지는 useWeddingData() 훅으로만 데이터를 만지고, 백엔드를 알 필요 없다.

import { useCallback, useEffect, useState } from "react";
import { defaultData, WeddingData, SCHEMA_VERSION } from "./schema";
import { createSupabaseStorage, loadPublicInvitation } from "./storage.supabase";
import { demoData } from "../data/demoData";
import { getOwnerToken, setOwnerToken, setSecrets, isSupabaseHost } from "./security";
import { inlineIdbForExport, stripUnresolvedIdb } from "./imageStore";

const LS_KEY = "wedding-os/v1";

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
      "⚠️ 사진을 더 저장할 공간이 부족해요.\n\n" +
      "휴대폰 저장 한도(약 5MB)에 도달했어요.\n" +
      "→ 사진을 일부 지우거나\n" +
      "→ [더보기 → 데이터 백업]으로 내려받은 다음,\n" +
      "   [내 사이트 만들기] 모드로 전환하시면\n" +
      "   더 많은 사진을 쓸 수 있어요."
    );
  }, 50);
}

export const localStorageDriver: StorageDriver = {
  async load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as WeddingData;
      return { data: migrate(parsed) };
    } catch {
      return null;
    }
  },
  async save(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      return { ok: true };
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
  if (!url || !anonKey) return undefined;
  if (!isSupabaseHost(url)) {
    // 변조 의심 — 통째로 무시 (UI 에선 mode=null + supabase=undefined 로 보임)
    return undefined;
  }
  return { url, anonKey, ...(configId ? { configId } : {}) };
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
    m === "local" || m === "supabase" || m === "devOnly" ? m : null;
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
    invitation:  { ...base.invitation,  ...(isPlainObject(data.invitation) ? data.invitation : {}) },
    rings:       Array.isArray(data.rings)    ? data.rings    : [],
    sdm:         Array.isArray(data.sdm)      ? data.sdm      : [],
    hotels:      Array.isArray(data.hotels)   ? data.hotels   : [],
    flights:     Array.isArray(data.flights)  ? data.flights  : [],
    honeymoon: (() => {
      const h = isPlainObject(data.honeymoon) ? data.honeymoon : {};
      return {
        ...base.honeymoon,
        ...h,
        regions: Array.isArray(h.regions) ? h.regions : [],
      };
    })(),
    checklist:   Array.isArray(data.checklist) ? data.checklist : [],
    venues:      Array.isArray(data.venues)    ? data.venues    : [],
    budget:      Array.isArray(data.budget)    ? data.budget    : [],
    guests:      Array.isArray(data.guests)    ? data.guests    : [],
    video: (() => {
      const v = isPlainObject(data.video) ? data.video : {};
      return {
        ...base.video,
        ...v,
        acts: Array.isArray(v.acts) ? v.acts : [],
        photos: Array.isArray(v.photos) ? v.photos : [],
      };
    })(),
  };
}

/** 현재 저장된 모드만 보고 드라이버 선택. preferences.mode 없으면 local. */
function selectDriver(data: WeddingData | null): StorageDriver {
  const mode = data?.preferences.mode;
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
        const driver = selectDriver(fromLocal.data);
        const fromActual = (await driver.load()) ?? fromLocal;
        if (cancelled) return;
        setData(fromActual.data);
        _localVersion = fromActual.version;
        setLoading(false);
        return;
      }

      // 환경변수 기반 supabase 로드 시도 (배포된 공개 청첩장에 게스트로 진입한 경우).
      // 공개 라우트에서는 전체 wedding_data 를 절대 내려받지 않고 invitation JSON 만 로드한다.
      const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (envUrl && envKey) {
        try {
          if (getOwnerToken()) {
            const envDriver = createSupabaseStorage(envUrl, envKey, "default");
            const fromFullEnv = await envDriver.load();
            if (cancelled) return;
            if (fromFullEnv) {
              setData({
                ...fromFullEnv.data,
                preferences: {
                  ...fromFullEnv.data.preferences,
                  mode: "supabase",
                  supabase: { url: envUrl, anonKey: envKey, configId: "default" },
                  isDemo: false,
                },
              });
              _localVersion = fromFullEnv.version;
              setLoading(false);
              return;
            }
          }

          const fromEnv = await loadPublicInvitation(envUrl, envKey, "default");
          if (cancelled) return;
          if (fromEnv.ok && fromEnv.invitation) {
            const base = defaultData();
            setData({
              ...base,
              invitation: {
                ...base.invitation,
                ...fromEnv.invitation,
              },
              preferences: {
                ...base.preferences,
                mode: "supabase",
                supabase: { url: envUrl, anonKey: envKey, configId: "default" },
                isDemo: false,
              },
            });
            _localVersion = undefined;
            setLoading(false);
            return;
          }
        } catch { /* fall through to demo */ }
      }

      if (cancelled) return;
      setData(demoData());
      setLoading(false);
    })();
    return () => { cancelled = true; };
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
        if (typeof version === "number") _localVersion = version;
        setData((prev) => {
          if (!prev) return next;
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          return next;
        });
        localStorageDriver.save(next).catch(() => {});
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
  const driver = selectDriver(next);
  _pending++;
  if (_savedClearTimer) { clearTimeout(_savedClearTimer); _savedClearTimer = null; }
  _emitSaveStatus("saving");
  saveChain = saveChain
    .then(async () => {
      try {
        const r = await driver.save(next, _localVersion);
        if (r.ok) {
          if (typeof r.version === "number") _localVersion = r.version;
        } else {
          _lastError = true;
          if (r.conflict) _emitConflict("detected");
        }
      } catch { _lastError = true; }
      if (driver !== localStorageDriver) {
        // 모드 2여도 localStorage에 항상 미러 — 오프라인 fallback / 새 기기 import 시 출발점.
        try { await localStorageDriver.save(next); } catch { /* localStorage 실패는 별도 notifyQuotaError 가 처리 */ }
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
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
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
