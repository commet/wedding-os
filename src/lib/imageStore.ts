// IndexedDB 기반 이미지 저장소.
//
// localStorage(약 5MB) 한도 때문에 모드 1 사용자가 사진 10장만 넣어도 막혔던 문제 해소.
// IndexedDB 는 일반적으로 수백 MB ~ GB 단위까지 허용된다.
//
// URL 스킴:
//   idb:<id>  — IndexedDB blob 참조. 렌더링 직전에 createObjectURL 로 해석.
//   data:...  — 기존 base64 (모드 2 cross-device 동기화 / export 용).
//   https:... — 외부 이미지 (rings 카탈로그, demoData unsplash 등).
//
// 모드별 정책:
//   모드 1 (local):    업로드 → IndexedDB → idb:<id> 저장. 로컬 저장소 부담 X.
//   모드 2 (supabase): 업로드 → base64 → JSONB 동기화. 두 기기에서 같은 사진 봄.
//   (모드 전환 시 saveImage 결과가 자동으로 적절한 포맷으로 갱신됨.
//    이미 박힌 idb 참조는 storage.ts 의 모드 전환 마이그레이션에서 일괄 변환.)
//
// 가비지:
//   현재는 명시적 del() 호출 시에만 정리. 향후 wedding_data 전체를 훑어 미사용 idb 키를 청소하는
//   가벼운 sweep 함수를 추가할 수 있음(앱 시작 시 1회).

import { useEffect, useState } from "react";
import { compressImage, compressToBlob, type CompressOptions } from "./imageCompress";
import type { Mode, WeddingData } from "./schema";

const DB_NAME = "wedding-os-images";
const DB_VERSION = 1;
const STORE = "blobs";

const IDB_PREFIX = "idb:";

let _dbPromise: Promise<IDBDatabase> | null = null;
function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("이 브라우저는 IndexedDB 를 지원하지 않아요"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // 다른 탭의 전체 삭제 요청을 막지 않도록 즉시 연결을 닫는다.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open 실패"));
  });
  return _dbPromise;
}

function genId(): string {
  // 짧은 랜덤 id — crypto.randomUUID 가 없는 옛 브라우저 대비.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Blob 저장 → idb:<id> 형태 URL 리턴 */
export async function putBlob(blob: Blob): Promise<string> {
  const db = await openDB();
  const id = genId();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return IDB_PREFIX + id;
}

/** idb:<id> URL 에서 Blob 꺼냄 — 없으면 null */
export async function getBlob(url: string): Promise<Blob | null> {
  if (!url.startsWith(IDB_PREFIX)) return null;
  const id = url.slice(IDB_PREFIX.length);
  const db = await openDB();
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** idb:<id> 삭제 — 미사용 사진 정리 */
export async function delBlob(url: string): Promise<void> {
  if (!url.startsWith(IDB_PREFIX)) return;
  const id = url.slice(IDB_PREFIX.length);
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 개인정보 삭제용: 저장된 이미지 Blob 전체와 DB 자체를 제거한다. */
export async function clearImageStore(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  if (_dbPromise) {
    try { (await _dbPromise).close(); } catch { /* 이미 닫힌 DB */ }
    _dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("이미지 저장소 삭제 실패"));
    req.onblocked = () => reject(new Error("다른 탭이 이미지 저장소를 사용 중입니다. 다른 탭을 닫고 다시 시도해주세요."));
  });
}

/** idb:<id> → ObjectURL (img src 로 그대로 사용) */
async function resolveIdbToObjectUrl(url: string): Promise<string | null> {
  const blob = await getBlob(url);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/** idb:<id> → data:image/...;base64,... 변환. 모드 전환 / export 용. */
export async function idbToDataUrl(url: string): Promise<string | null> {
  if (!url.startsWith(IDB_PREFIX)) return null;
  const blob = await getBlob(url);
  if (!blob) return null;
  return new Promise<string | null>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(blob);
  });
}

/** data: URL 을 Blob 으로 변환 → IndexedDB 저장. 모드 supabase→local 마이그레이션용. */
export async function dataUrlToIdb(dataUrl: string): Promise<string | null> {
  if (!dataUrl.startsWith("data:")) return null;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return putBlob(blob);
  } catch {
    return null;
  }
}

/** 어떤 형식이든 <img src=> 에 바로 쓸 수 있는 URL 로 변환.
 *  idb:<id> 면 ObjectURL, data:/http(s): 면 그대로. 못 찾으면 null. */
export async function resolveImageSrc(url: string | undefined | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith(IDB_PREFIX)) return resolveIdbToObjectUrl(url);
  return url;
}

/** React 훅 — idb:<id> 를 자동으로 ObjectURL 로 해석.
 *  컴포넌트 unmount 시 ObjectURL revoke 해서 메모리 누수 차단. */
export function useImageSrc(url: string | undefined | null): string | null {
  const [resolved, setResolved] = useState<string | null>(() =>
    url && url.startsWith(IDB_PREFIX) ? null : url ?? null,
  );

  useEffect(() => {
    let alive = true;
    let createdObjectUrl: string | null = null;
    if (!url) { setResolved(null); return; }
    if (!url.startsWith(IDB_PREFIX)) { setResolved(url); return; }

    resolveIdbToObjectUrl(url).then((r) => {
      if (!alive) {
        if (r) URL.revokeObjectURL(r);
        return;
      }
      createdObjectUrl = r;
      setResolved(r);
    });

    return () => {
      alive = false;
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
    };
  }, [url]);

  return resolved;
}

export function isIdbUrl(url: string | undefined | null): boolean {
  return !!url && url.startsWith(IDB_PREFIX);
}

/** 업로드 진입점 — 모드에 따라 idb:<id> 또는 data:base64 반환.
 *  모드 1: IndexedDB (localStorage 5MB 한도 회피)
 *  모드 2: base64 (Supabase JSONB 동기화로 부부 두 기기 모두에서 보임) */
export async function uploadImage(
  file: File,
  opts: CompressOptions & { mode: Mode | null }
): Promise<string> {
  const { mode, ...co } = opts;
  if (mode === "supabase") {
    // 모드 2 는 cross-device 동기화 위해 data URL 유지
    return compressImage(file, co);
  }
  // 모드 1 / 미정: IndexedDB
  const blob = await compressToBlob(file, co);
  return putBlob(blob);
}

// ──────────────────────────────────────────────────────────────
// 모드 전환 마이그레이션 — wedding data 트리 안의 모든 이미지 URL 을 한 번에 변환.
// ──────────────────────────────────────────────────────────────

/** 데이터 트리 안의 모든 "이미지 URL 슬롯" 에 대해 비동기 변환을 적용.
 *  변환이 null 을 반환하면 원본 유지. */
export async function transformImageUrls(
  data: any,
  transform: (url: string) => Promise<string | null>,
): Promise<any> {
  const next = structuredClone(data);
  const fix = async (val: string | undefined): Promise<string | undefined> => {
    if (!val) return val;
    const r = await transform(val);
    return r ?? val;
  };

  if (next.invitation) {
    next.invitation.heroImageUrl = await fix(next.invitation.heroImageUrl);
    if (Array.isArray(next.invitation.gallery)) {
      for (const g of next.invitation.gallery) g.url = await fix(g.url);
    }
  }
  if (next.video && Array.isArray(next.video.photos)) {
    for (const p of next.video.photos) p.url = await fix(p.url);
  }
  // rings.imageUrl 은 보통 외부 https — idb 가 아닐 가능성 높지만 일관성 위해 통과.
  if (Array.isArray(next.rings)) {
    for (const r of next.rings) r.imageUrl = await fix(r.imageUrl);
  }
  return next;
}

/** 모드 local → supabase 전환 시 호출. idb:<id> → data:base64 (Supabase JSONB 동기화 가능 형태) */
export async function migrateImagesIdbToDataUrl(data: any): Promise<any> {
  return transformImageUrls(data, async (url) => {
    if (!url.startsWith(IDB_PREFIX)) return null;
    return idbToDataUrl(url);
  });
}

/** export 시 호출. idb:<id> → data:base64 (백업 파일 portable) */
export async function inlineIdbForExport(data: any): Promise<any> {
  return migrateImagesIdbToDataUrl(data);
}

/** export 직후 호출 — base64 인라인에 실패해 남아 있는 idb: 참조를 찾아낸다.
 *  죽은 참조(블롭 유실 등으로 다른 기기에선 못 푸는 사진)를 들어내고
 *  몇 장을 제거했는지 보고한다. 백업 파일에 깨진 사진 참조가 들어가는 걸 막는다. */
export function stripUnresolvedIdb(data: WeddingData): { data: WeddingData; removed: number } {
  const next = structuredClone(data);
  let removed = 0;
  const isIdb = (u: unknown): u is string => typeof u === "string" && u.startsWith(IDB_PREFIX);

  if (next.invitation) {
    if (isIdb(next.invitation.heroImageUrl)) { next.invitation.heroImageUrl = undefined; removed++; }
    if (Array.isArray(next.invitation.gallery)) {
      const before = next.invitation.gallery.length;
      next.invitation.gallery = next.invitation.gallery.filter((g) => !isIdb(g?.url));
      removed += before - next.invitation.gallery.length;
    }
  }
  if (next.video && Array.isArray(next.video.photos)) {
    const before = next.video.photos.length;
    next.video.photos = next.video.photos.filter((p) => !isIdb(p?.url));
    removed += before - next.video.photos.length;
  }
  if (Array.isArray(next.rings)) {
    for (const r of next.rings) {
      if (isIdb(r?.imageUrl)) { r.imageUrl = undefined; removed++; }
    }
  }
  return { data: next, removed };
}
