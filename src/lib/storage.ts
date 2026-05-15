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
    } catch {
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

  // 초기 로드: localStorage에 일단 미리보기를 받아두고, 그 안의 mode 보고 진짜 드라이버 결정.
  // 저장된 게 전혀 없으면 → 데모 데이터로 시작 (첫 방문자가 빈 화면 대신 완성된 예시를 봄).
  useEffect(() => {
    (async () => {
      const fromLocal = await localStorageDriver.load();
      if (!fromLocal) {
        setData(demoData());
        setLoading(false);
        return;
      }
      const driver = selectDriver(fromLocal);
      const fromActual = (await driver.load()) ?? fromLocal ?? defaultData();
      setData(fromActual);
      setLoading(false);
    })();
  }, []);

  const update = useCallback(
    async (patch: Partial<WeddingData> | ((prev: WeddingData) => WeddingData)) => {
      setData((prev) => {
        const base = prev ?? defaultData();
        const next = typeof patch === "function" ? patch(base) : { ...base, ...patch };
        const driver = selectDriver(next);
        // fire-and-forget save
        driver.save(next).catch(() => {});
        // localStorage에도 항상 미러 — 모드 2여도 오프라인 fallback
        if (driver !== localStorageDriver) localStorageDriver.save(next).catch(() => {});
        return next;
      });
    },
    []
  );

  return { data, loading, update };
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
