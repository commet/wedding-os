// 저장 계층 추상화.
// 모드 1: localStorage (this file's default impl)
// 모드 2: Supabase (storage.supabase.ts)
//
// 페이지는 useWeddingData() 훅으로만 데이터를 만지고, 백엔드를 알 필요 없다.

import { useCallback, useEffect, useState } from "react";
import { defaultData, WeddingData, SCHEMA_VERSION } from "./schema";
import { createSupabaseStorage } from "./storage.supabase";
import { demoData } from "../data/demoData";

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

function migrate(data: WeddingData): WeddingData {
  // 향후 schemaVersion 마이그레이션 자리.
  if (!data.schemaVersion) data.schemaVersion = SCHEMA_VERSION;
  return data;
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

// 데이터 export / import — 모드 전환 또는 백업용
export function exportData(data: WeddingData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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

export async function importData(file: File): Promise<WeddingData> {
  const text = await file.text();
  const parsed = JSON.parse(text) as WeddingData;
  return migrate(parsed);
}
