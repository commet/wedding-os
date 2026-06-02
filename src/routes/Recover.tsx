// /recover#w=..&t=..&k=..  — 복구 링크로 간편(hosted) 모드 이어받기.
//
// 기기교체·부부공유 시 진입. 프래그먼트에서 weddingId·ownerToken·weddingKey 를 받아
// 시크릿에 심고, mode='hosted' 로 로컬을 seed 한 뒤 새로고침으로 진입한다.
// 새로고침 후 정상 로드 경로가 hosted 드라이버로 서버 암호문을 복호화해 가져온다.
// (in-memory 버전 동기화 race 를 피하려고 일부러 hard reload 한다.)

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { defaultData } from "../lib/schema";
import { parseRecoveryFragment } from "../lib/recovery";
import { setHostedConfig, setOwnerToken, markOwner } from "../lib/security";
import { localStorageDriver } from "../lib/storage";

export default function Recover() {
  const [status, setStatus] = useState<"working" | "error">("working");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const bundle = parseRecoveryFragment(window.location.hash);
      if (!bundle) { setStatus("error"); return; }
      if (!setOwnerToken(bundle.ownerToken)) { setStatus("error"); return; }
      setHostedConfig({ weddingId: bundle.weddingId, weddingKey: bundle.weddingKey });
      markOwner();

      // mode='hosted' 로 로컬 seed — 새로고침 후 로드 경로가 hosted 드라이버를 고르게.
      const seed = {
        ...defaultData(),
        preferences: { ...defaultData().preferences, mode: "hosted" as const },
      };
      await localStorageDriver.save(seed);

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
