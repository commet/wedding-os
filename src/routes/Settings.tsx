import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { exportData, importData } from "../lib/storage";
import { todayISO } from "../lib/freshness";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Settings({ data, update }: Props) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [aiKey, setAiKey] = useState(data.preferences.aiKey ?? "");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleExport = () => {
    exportData(data);
    update((prev: WeddingData) => ({
      ...prev,
      preferences: { ...prev.preferences, lastBackupAt: todayISO() },
    }));
  };

  const handleImport = async (file: File) => {
    try {
      const imported = await importData(file);
      if (confirm("현재 데이터를 덮어쓸까요? (취소 시 변화 없음)")) {
        update(() => imported);
      }
    } catch (e) {
      alert("파일을 읽을 수 없어요. JSON 백업 파일이 맞는지 확인해주세요.");
    }
  };

  const saveAiKey = () => {
    update((prev: WeddingData) => ({
      ...prev,
      preferences: { ...prev.preferences, aiKey: aiKey.trim() || undefined },
    }));
  };

  const reset = () => {
    if (!confirm("정말 모든 데이터를 지울까요? 되돌릴 수 없어요.")) return;
    localStorage.removeItem("wedding-os/v1");
    window.location.href = "/";
  };

  const switchMode = () => {
    if (!confirm("모드를 다시 선택하시겠어요? 현재 데이터는 그대로 유지됩니다.")) return;
    update((prev: WeddingData) => ({
      ...prev,
      preferences: { ...prev.preferences, mode: null },
    }));
    navigate("/");
  };

  return (
    <div className="px-5 py-6 space-y-4">
      <h1 className="font-serif text-2xl">더보기</h1>

      <section className="card space-y-3">
        <h3 className="font-medium">저장 방식</h3>
        <p className="text-sm">
          현재: <b>{
            data.preferences.mode === "local" ? "내 휴대폰에 저장" :
            data.preferences.mode === "supabase" ? "내 사이트로 배포" :
            data.preferences.mode === "devOnly" ? "코드 직접 수정" : "선택 안 됨"
          }</b>
        </p>
        <button onClick={switchMode} className="btn-secondary w-full">
          저장 방식 다시 선택
        </button>
      </section>

      <section className="card space-y-3">
        <h3 className="font-medium">데이터 백업</h3>
        <p className="text-sm text-soft">
          모든 데이터를 한 파일(JSON)로 내보내거나, 다시 불러올 수 있어요.
        </p>
        <button onClick={handleExport} className="btn-primary w-full">
          📥 내려받기 (백업)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
        <button onClick={() => fileRef.current?.click()} className="btn-secondary w-full">
          📤 백업에서 불러오기
        </button>
        {data.preferences.lastBackupAt && (
          <p className="text-xs text-soft text-center">
            마지막 백업: {data.preferences.lastBackupAt}
          </p>
        )}
      </section>

      <section className="card space-y-3">
        <h3 className="font-medium">AI 키 (선택)</h3>
        <p className="text-sm text-soft">
          본인 Anthropic API 키를 입력하면 챗봇 복붙 없이 바로 AI 편집이 가능해요.
          입력하지 않으면 기본은 챗봇 복붙 방식으로 동작합니다.
        </p>
        <input
          type="password"
          className="input text-xs"
          value={aiKey}
          onChange={(e) => setAiKey(e.target.value)}
          placeholder="sk-ant-..."
        />
        <button onClick={saveAiKey} className="btn-secondary w-full">저장</button>
        <p className="text-xs text-soft">
          키는 이 기기/이 Supabase 안에만 저장되며, 본인 외엔 접근 불가합니다.
        </p>
      </section>

      {data.preferences.mode === "supabase" && (
        <section className="card space-y-2">
          <h3 className="font-medium">Supabase 연결 정보</h3>
          <p className="text-xs text-soft break-all">
            URL: {data.preferences.supabase?.url}
          </p>
          <p className="text-xs text-soft">
            anon key: ••••••{data.preferences.supabase?.anonKey.slice(-6)}
          </p>
          <Link to="/setup" className="btn-secondary w-full inline-block text-center">
            셋업 가이드 다시 보기
          </Link>
        </section>
      )}

      <section className="card space-y-3">
        <h3 className="font-medium">문의 / 오류 신고</h3>
        <p className="text-sm text-soft">
          이상하거나 안 되는 게 있으면 부담 없이 알려주세요. 개인적으로 만든 도구라 오류가 있을 수밖에 없어요.
        </p>
        <Link to="/contact" className="btn-primary w-full inline-block text-center">
          ✉️ 문의하기
        </Link>
      </section>

      <section className="card space-y-3 border-red-200">
        <h3 className="font-medium text-red-500">위험한 작업</h3>
        <button onClick={reset} className="btn-secondary w-full text-red-500 border-red-300">
          모든 데이터 지우기
        </button>
      </section>

      <p className="text-center text-xs text-soft pt-4">
        Wedding OS · 개인 프로젝트<br />
        <a href="https://github.com/commet/wedding-os" target="_blank" className="underline">GitHub</a>
      </p>
    </div>
  );
}
