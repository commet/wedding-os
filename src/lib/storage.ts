// 저장 계층 추상화.
// 모드 1: localStorage (this file's default impl)
// 모드 2: Supabase (storage.supabase.ts)
//
// 페이지는 useWeddingData() 훅으로만 데이터를 만지고, 백엔드를 알 필요 없다.

import { useCallback, useEffect, useState } from "react";
import { defaultData, WeddingData, SCHEMA_VERSION } from "./schema";
import { createSupabaseStorage } from "./storage.supabase";
import { demoData } from "../data/demoData";
import { setSecrets } from "./security";

const LS_KEY = "wedding-os/v1";

export type StorageDriver = {
  load: () => Promise<WeddingData | null>;
  save: (data: WeddingData) => Promise<boolean>;
  /** 외부에서 변경됐을 때 알림 (Supabase realtime 등) — 모드 1에선 no-op */
  subscribe?: (cb: (data: WeddingData) => void) => () => void;
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
      return migrate(parsed);
    } catch {
      return null;
    }
  },
  async save(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      return true;
    } catch (e: any) {
      // QuotaExceededError 또는 비슷한 — 사용자에게 알림
      const name = e?.name ?? "";
      if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
        notifyQuotaError();
      }
      return false;
    }
  },
};

function migrate(raw: unknown): WeddingData {
  // 누락된 필드를 defaultData로 안전하게 보충.
  // 옛 버전에서 저장된 데이터에 새 필드(예: sdm)가 없어도 깨지지 않도록.
  const base = defaultData();
  const data = (raw ?? {}) as Partial<WeddingData>;

  // 이전 버전 호환: preferences.aiKey 가 남아 있다면 별도 secrets 저장소로 이전 후 제거.
  // (공개될 수 있는 WeddingData 트리에 sk-ant-... 같은 결제 키가 들어가는 걸 막기 위함.)
  const prefsRaw = (data.preferences ?? {}) as Partial<{ aiKey: string } & WeddingData["preferences"]>;
  if (typeof prefsRaw.aiKey === "string" && prefsRaw.aiKey) {
    try { setSecrets({ aiKey: prefsRaw.aiKey }); } catch { /* noop */ }
  }
  const { aiKey: _drop, ...prefsSafe } = prefsRaw;
  void _drop;

  return {
    schemaVersion: SCHEMA_VERSION,
    preferences: { ...base.preferences, ...prefsSafe },
    invitation:  { ...base.invitation,  ...(data.invitation  ?? {}) },
    rings:       Array.isArray(data.rings)    ? data.rings    : [],
    sdm:         Array.isArray(data.sdm)      ? data.sdm      : [],
    hotels:      Array.isArray(data.hotels)   ? data.hotels   : [],
    flights:     Array.isArray(data.flights)  ? data.flights  : [],
    honeymoon:   { ...base.honeymoon, ...(data.honeymoon ?? {}),
                   regions: Array.isArray(data.honeymoon?.regions) ? data.honeymoon!.regions : [] },
    checklist:   Array.isArray(data.checklist) ? data.checklist : [],
    video:       { ...base.video, ...(data.video ?? {}),
                   acts: Array.isArray(data.video?.acts) ? data.video!.acts : [],
                   photos: Array.isArray(data.video?.photos) ? data.video!.photos : [] },
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

/**
 * 최상위 훅. 페이지에선 이것만 쓴다.
 *
 * 주의: 모드 전환 시점에 driver 자체가 바뀐다.
 * preferences.mode가 바뀌면 다음 save 호출부터 새 드라이버로 감.
 */
export function useWeddingData() {
  const [data, setData] = useState<WeddingData | null>(null);
  const [loading, setLoading] = useState(true);

  // 초기 로드:
  //   1) localStorage 가 있으면 — 모드 1 또는 모드 2 사용자(오너)
  //   2) localStorage 비어 있고 환경변수가 있으면 — 모드 2 게스트 (사용자가 Vercel 배포한 사이트)
  //   3) 둘 다 없으면 — 첫 방문자, 데모 데이터로 시작
  useEffect(() => {
    (async () => {
      const fromLocal = await localStorageDriver.load();
      if (fromLocal) {
        const driver = selectDriver(fromLocal);
        const fromActual = (await driver.load()) ?? fromLocal;
        setData(fromActual);
        setLoading(false);
        return;
      }

      // 환경변수 기반 supabase 로드 시도 (모드 2 사용자가 배포한 사이트에 게스트로 진입한 경우)
      const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (envUrl && envKey) {
        try {
          const envDriver = createSupabaseStorage(envUrl, envKey, "default");
          const fromEnv = await envDriver.load();
          if (fromEnv) {
            setData({
              ...fromEnv,
              preferences: {
                ...fromEnv.preferences,
                mode: "supabase",
                supabase: { url: envUrl, anonKey: envKey, configId: "default" },
                isDemo: false,
              },
            });
            setLoading(false);
            return;
          }
        } catch { /* fall through to demo */ }
      }

      setData(demoData());
      setLoading(false);
    })();
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
    if (!isSupabaseMode || !supabaseUrl || !supabaseKey) return;
    const driver = createSupabaseStorage(supabaseUrl, supabaseKey, data?.preferences.supabase?.configId);
    if (!driver.subscribe) return;
    const unsubscribe = driver.subscribe((next) => {
      setData((prev) => {
        if (!prev) return next;
        // 큰 객체 변경 비교 — JSON.stringify는 비용 있지만 사용 빈도가 낮아 OK.
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
      localStorageDriver.save(next).catch(() => {});
    });
    return () => { try { unsubscribe(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUrl, supabaseKey, isSupabaseMode]);

  return { data, loading, update };
}

// 직렬 저장 큐. 모든 save 호출이 이 chain 위에서 순차 실행된다.
// 실패는 조용히 — 다음 save 가 올바른 최신 상태를 다시 쓰면 정상화됨.
let saveChain: Promise<unknown> = Promise.resolve();
function enqueueSave(next: WeddingData) {
  const driver = selectDriver(next);
  saveChain = saveChain
    .then(() => driver.save(next))
    .catch(() => undefined);
  if (driver !== localStorageDriver) {
    // 모드 2여도 localStorage에 항상 미러 — 오프라인 fallback / 새 기기 import 시 출발점.
    saveChain = saveChain
      .then(() => localStorageDriver.save(next))
      .catch(() => undefined);
  }
}

// 데이터 export / import — 모드 전환 또는 백업용.
//
// 보안: 백업 파일은 사용자가 친구에게 보내 의견을 묻거나, 클라우드에 올리는 경우가 잦다.
// 따라서 export 시 시크릿(supabase anonKey 등) 은 제거한다.
// 모드 2 설정은 사용자가 새 기기에서 Setup 위저드로 다시 입력하도록 안내.
export function exportData(data: WeddingData): void {
  const sanitized: WeddingData = {
    ...data,
    preferences: {
      ...data.preferences,
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
