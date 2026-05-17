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

  const handleExport = async () => {
    // exportData 는 idb 사진을 base64 로 인라인하느라 async — 큰 갤러리면 잠깐 걸림.
    await exportData(data);
    update((prev: WeddingData) => ({
      ...prev,
      preferences: { ...prev.preferences, lastBackupAt: todayISO() },
    }));
  };

  const handleImport = async (file: File) => {
    try {
      const imported = await importData(file, data);
      if (confirm("현재 데이터를 덮어쓸까요?\n(연결 정보는 안전하게 그대로 둡니다)")) {
        // import 도 "백업 시점" 으로 인정 — 사용자가 파일을 손에 쥐고 있으니 같은 안전 수준.
        // 안 그러면 30일 전 백업 import 시 곧장 "오래 백업 안 함" 알림이 뜸.
        update(() => ({
          ...imported,
          preferences: { ...imported.preferences, lastBackupAt: todayISO() },
        }));
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

  const currentMode =
    data.preferences.mode === "local" ? "내 휴대폰에 저장" :
    data.preferences.mode === "supabase" ? "내 사이트로 배포" :
    data.preferences.mode === "devOnly" ? "코드 직접 수정" : "선택 안 됨";

  return (
    <div className="page pt-8 pb-10 space-y-10">
      <div>
        <div className="eyebrow-gold mb-2">More</div>
        <h1 className="font-serif text-[2rem] leading-none">더보기</h1>
      </div>

      <Section title="저장 방식">
        <p className="text-[13px] text-soft">
          현재 · <b className="text-ink">{currentMode}</b>
        </p>
        <button onClick={switchMode} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold mt-3">
          저장 방식 다시 선택 →
        </button>
      </Section>

      <Section title="PDF로 저장 (인쇄)">
        <p className="text-[12.5px] text-soft leading-relaxed">
          청첩장이나 체크리스트를 PDF로 저장하고 싶을 때 —
          각 페이지에서 <b className="text-ink">Cmd/Ctrl + P</b> 로 인쇄 → <b className="text-ink">"PDF로 저장"</b> 을 선택하세요.
          인쇄 친화 스타일이 자동 적용됩니다.
        </p>
        <p className="text-[11px] text-soft mt-2">
          모바일은 일반적으로 브라우저 메뉴 → 공유 → 프린트 흐름.
        </p>
      </Section>

      <Section title="데이터 백업">
        <p className="text-[12.5px] text-soft mb-4 leading-relaxed">
          모든 데이터를 한 파일(JSON)로 내보내거나, 다시 불러올 수 있어요.
        </p>
        <div className="flex gap-6">
          <button onClick={handleExport} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
            내려받기 (백업) →
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
          <button onClick={() => fileRef.current?.click()} className="text-[12px] underline underline-offset-4 text-soft hover:text-ink">
            백업에서 불러오기
          </button>
        </div>
        {data.preferences.lastBackupAt && (
          <p className="eyebrow mt-3">
            마지막 백업 · <span className="tabular-nums">{data.preferences.lastBackupAt}</span>
          </p>
        )}
      </Section>

      <Section title="AI 편집 방식">
        <p className="text-[12px] text-soft leading-relaxed">
          현재는 <b className="text-ink">챗봇 다리 방식</b>만 지원해요 — ChatGPT / Claude / Gemini 무료 버전에
          프롬프트를 복붙하고, 답변을 다시 붙여넣으면 영상 · 정보가 갱신됩니다.
          본인 API 키 직접 호출은 안전 · 비용 이슈로 일단 미지원.
        </p>
      </Section>

      {data.preferences.mode === "supabase" && (
        <Section title="Supabase 연결 정보">
          <div className="space-y-1.5 text-[11.5px] text-soft">
            <p className="break-all">URL · <span className="text-ink">{data.preferences.supabase?.url}</span></p>
            <p>anon key · <span className="text-ink">••••••{data.preferences.supabase?.anonKey.slice(-6)}</span></p>
          </div>
          <Link to="/setup" className="text-[12px] underline underline-offset-4 text-ink hover:text-gold inline-block mt-3">
            셋업 가이드 다시 보기 →
          </Link>
          <OwnerToggle />
        </Section>
      )}

      <Section title="문의 / 오류 신고">
        <p className="text-[12.5px] text-soft mb-4 leading-relaxed">
          이상하거나 안 되는 게 있으면 부담 없이 알려주세요.
          개인적으로 만든 도구라 오류가 있을 수밖에 없어요.
        </p>
        <Link to="/contact" className="btn-primary px-6 py-3 text-[12px]">
          문의하기 →
        </Link>
      </Section>

      <Section title="위험한 작업">
        <button onClick={reset} className="text-[12px] underline underline-offset-4 text-gold hover:text-ink">
          모든 데이터 지우기 →
        </button>
      </Section>

      <p className="text-center text-[11px] text-soft pt-4 border-t border-hair space-x-3">
        <span>Wedding OS · 개인 프로젝트</span>
        <span>·</span>
        <Link to="/privacy" className="underline underline-offset-2">개인정보 · 보안 안내</Link>
        <span>·</span>
        <a href="https://github.com/commet/wedding-os" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">GitHub</a>
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-2">
      <h3 className="eyebrow-gold mb-4">{title}</h3>
      {children}
      <div className="hairline mt-8" />
    </section>
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
    <div className="pt-4 mt-4 border-t border-hair space-y-2">
      <p className="text-[11.5px] text-soft">
        이 기기는 현재{" "}
        <b className={owner ? "text-gold" : "text-soft"}>{owner ? "오너 (편집 가능)" : "게스트 (보기 전용)"}</b>
        예요.
      </p>
      <button onClick={toggle} className="text-[12px] underline underline-offset-4 text-ink hover:text-gold">
        {owner ? "이 기기를 게스트로 되돌리기" : "이 기기를 오너로 표시"} →
      </button>
    </div>
  );
}
