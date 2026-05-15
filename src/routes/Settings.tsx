import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { WeddingData } from "../lib/schema";
import { exportData, importData } from "../lib/storage";
import { todayISO } from "../lib/freshness";
import { clearSecrets, clearOwner, isOwner, markOwner } from "../lib/security";

type Props = { data: WeddingData; update: (patch: any) => void; };

export default function Settings({ data, update }: Props) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportData(data);
    update((prev: WeddingData) => ({
      ...prev,
      preferences: { ...prev.preferences, lastBackupAt: todayISO() },
    }));
  };

  const handleImport = async (file: File) => {
    try {
      const imported = await importData(file, data);
      if (confirm("현재 데이터를 덮어쓸까요?\n(연결 정보는 안전하게 그대로 둡니다)")) {
        update(() => imported);
      }
    } catch (e) {
      alert("파일을 읽을 수 없어요. JSON 백업 파일이 맞는지 확인해주세요.");
    }
  };

  const reset = () => {
    if (!confirm("정말 모든 데이터를 지울까요? 되돌릴 수 없어요.")) return;
    localStorage.removeItem("wedding-os/v1");
    clearSecrets();
    clearOwner();
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
        <h3 className="font-medium">📄 PDF로 저장 (인쇄)</h3>
        <p className="text-sm text-soft leading-relaxed">
          청첩장이나 체크리스트를 PDF로 저장하고 싶을 때 — 각 페이지에서{" "}
          <b className="text-ink">Cmd/Ctrl + P</b>로 인쇄 → <b>"PDF로 저장"</b>을 선택하세요.
          인쇄 친화 스타일이 자동 적용됩니다.
        </p>
        <p className="text-xs text-soft">
          (모바일은 일반적으로 브라우저 메뉴 → "공유" → "프린트" 흐름)
        </p>
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

      <section className="card space-y-2 bg-cream/50">
        <h3 className="font-medium text-sm">🤖 AI 편집 방식</h3>
        <p className="text-xs text-soft leading-relaxed">
          현재는 <b className="text-ink">챗봇 다리 방식</b>만 지원해요 — ChatGPT/Claude/Gemini 무료 버전에
          프롬프트를 복붙하고, 답변을 다시 붙여넣으면 영상·정보가 갱신됩니다.
          본인 API 키 직접 호출은 안전·비용 이슈로 일단 미지원.
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
          <OwnerToggle />
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

      <p className="text-center text-xs text-soft pt-4 space-x-2">
        <span>Wedding OS · 개인 프로젝트</span>
        <span>·</span>
        <Link to="/privacy" className="underline">개인정보 · 보안 안내</Link>
        <span>·</span>
        <a href="https://github.com/commet/wedding-os" target="_blank" rel="noopener noreferrer" className="underline">GitHub</a>
      </p>
    </div>
  );
}

// 모드 2 에서 부부 두 번째 기기는 셋업 위저드를 거치지 않을 수 있음(같은 URL 공유 또는 데이터 import).
// 본인이라는 걸 표시해야 청첩장 페이지에서 편집 탭이 노출됨.
function OwnerToggle() {
  const [owner, setOwner] = useState(isOwner());

  const toggle = () => {
    if (owner) {
      if (!confirm("이 기기를 '게스트' 로 되돌릴까요?\n청첩장의 편집 탭이 숨겨집니다.")) return;
      clearOwner();
      setOwner(false);
    } else {
      if (!confirm(
        "이 기기를 청첩장의 오너로 표시할까요?\n\n" +
        "오너만 청첩장의 편집 탭을 볼 수 있어요.\n" +
        "본인(부부) 기기에서만 켜주세요. 단톡방·SNS 공유받은 기기에서 켜면 안 됩니다."
      )) return;
      markOwner();
      setOwner(true);
    }
  };

  return (
    <div className="pt-2 border-t border-line space-y-2">
      <p className="text-xs text-soft">
        이 기기는 현재{" "}
        <b className={owner ? "text-gold" : "text-soft"}>{owner ? "오너 (편집 가능)" : "게스트 (보기 전용)"}</b>
        예요.
      </p>
      <button onClick={toggle} className="btn-secondary w-full text-xs">
        {owner ? "이 기기를 게스트로 되돌리기" : "이 기기를 오너로 표시"}
      </button>
    </div>
  );
}
