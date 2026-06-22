// /recover#w=..&t=..&k=..  — 복구 링크로 간편(hosted) 모드 이어받기.
//
// 기기교체·부부공유 시 진입. 프래그먼트에서 weddingId·ownerToken·weddingKey 를 받아
// 시크릿에 심고, mode='hosted' 로 로컬을 seed 한 뒤 새로고침으로 진입한다.
// 새로고침 후 정상 로드 경로가 hosted 드라이버로 서버 암호문을 복호화해 가져온다.
// (in-memory 버전 동기화 race 를 피하려고 일부러 hard reload 한다.)

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { parseRecoveryFragment } from "../lib/recovery";
import { setHostedRecoveryCredentials } from "../lib/security";
import { localStorageDriver } from "../lib/storage";
import { createHostedStorage } from "../lib/storage.hosted";

export default function Recover() {
  const [status, setStatus] = useState<"working" | "error">("working");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const bundle = parseRecoveryFragment(window.location.hash);
      if (!bundle) { setStatus("error"); return; }
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (!url || !anonKey) { setStatus("error"); return; }

      // 기존 기기 데이터를 건드리기 전에 원격 자격증명과 복호화 키를 실제 데이터로 검증한다.
      const remote = await createHostedStorage(
        url, anonKey, bundle.weddingId, bundle.weddingKey, bundle.ownerToken,
      ).load();
      if (!remote) { setStatus("error"); return; }
      const restored = {
        ...remote.data,
        preferences: { ...remote.data.preferences, mode: "hosted" as const, isDemo: false },
      };
      const previous = await localStorageDriver.load();
      const saved = await localStorageDriver.save(restored);
      if (!saved.ok) { setStatus("error"); return; }

      if (!setHostedRecoveryCredentials(
        { weddingId: bundle.weddingId, weddingKey: bundle.weddingKey },
        bundle.ownerToken,
      )) {
        if (previous) await localStorageDriver.save(previous.data);
        setStatus("error");
        return;
      }
      // URL/히스토리에서 키 제거 후 대시보드로 새로고침 진입.
      window.history.replaceState(null, "", "/recover");
      window.location.assign("/dashboard");
    })();
  }, []);

  if (status === "error") {
    return (
      <div className="page max-w-app mx-auto pt-20 text-center">
        <div className="eyebrow-gold mb-3">복구 실패</div>
        <p className="text-[13px] text-soft leading-relaxed mb-6">
          복구 링크가 올바르지 않아요. 링크 전체(<code className="bg-cream px-1">#</code> 뒤 포함)를 그대로 열었는지 확인해주세요.
        </p>
        <Link to="/" className="text-[13px] text-ink underline underline-offset-4 hover:text-gold">처음으로 →</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-soft">
      청첩장 준비 정보를 가져오는 중…
    </div>
  );
}
