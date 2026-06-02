// 공유 이미지 업로드 버튼 — 청첩장·반지 등 어디서나 "내 사진" 업로드.
//
// 모드별 저장:
//   local / devOnly : IndexedDB(idb:<id>) — localStorage 5MB 한도 회피
//   supabase / hosted : base64 data URL — 동기화되는 모드라 데이터에 인라인되어야 두 기기서 보임
// 결과 url 은 SafeImg 가 idb:/data:/https: 를 모두 처리한다.

import { useRef, useState } from "react";
import type { Mode } from "../lib/schema";
import { compressImage, dataUrlSize } from "../lib/imageCompress";
import { uploadImage } from "../lib/imageStore";

export default function ImageUploadButton({
  onUploaded, mode, label = "내 사진 업로드", className = "btn-secondary text-sm",
}: {
  onUploaded: (url: string) => void;
  mode: Mode | null;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const inline = mode === "supabase" || mode === "hosted"; // 동기화 모드는 base64 인라인

  const handle = async (file: File) => {
    setBusy(true);
    try {
      if (inline) {
        const c = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 });
        if (dataUrlSize(c) > 1.2 * 1024 * 1024) {
          onUploaded(await compressImage(file, { maxWidth: 900, maxHeight: 900, quality: 0.75 }));
        } else {
          onUploaded(c);
        }
      } else {
        onUploaded(await uploadImage(file, { mode, maxWidth: 1200, maxHeight: 1200, quality: 0.82 }));
      }
    } catch (e: any) {
      alert("사진을 불러올 수 없어요: " + (e?.message ?? "알 수 없는 오류"));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
      />
      <button onClick={() => ref.current?.click()} disabled={busy} className={`${className} disabled:opacity-50`}>
        {busy ? "압축 중…" : label}
      </button>
    </>
  );
}
