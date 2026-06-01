// CipherPeek — "운영자에게 보이는 것"을 직접 보여주는 라이브 암호화 데모.
//
// 신뢰는 말("암호화됐어요")이 아니라 *직접 확인*에서 나온다. 이 컴포넌트는 가짜 효과가
// 아니라 앱이 실제 업로드에 쓰는 바로 그 함수(inviteCrypto.encryptJSON)로 사용자의 입력을
// 그 자리에서 암호화해, 평문 ↔ 암호문 ↔ 키 를 나란히 보여준다.
//
// 쓰임:
//   1) 투명성 페이지(/trust) — editable 데모
//   2) (향후) 저장·발행 순간 "운영자에게 보이는 것" 미리보기 — sample 고정 + editable=false

import { useEffect, useRef, useState } from "react";
import { generateInviteKey, encryptJSON, type Bytes } from "../lib/inviteCrypto";

function bytesToBase64Url(bytes: Bytes): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const DEFAULT_SAMPLE = "김민준 ♥ 이서연\n축의금 50,000원\n신랑 연락처 010-1234-5678";

type Props = {
  /** 처음 보여줄 평문. 미지정 시 샘플(이름·축의금·연락처). */
  sample?: string;
  /** 사용자가 직접 입력해보게 할지. 기본 true. */
  editable?: boolean;
};

export default function CipherPeek({ sample = DEFAULT_SAMPLE, editable = true }: Props) {
  const [text, setText] = useState(sample);
  const [cipher, setCipher] = useState("");
  const [keyRaw, setKeyRaw] = useState("");
  const [nonce, setNonce] = useState(0); // "다시 암호화" — 같은 글자도 매번 달라짐을 보이기 위함
  const keyRef = useRef<CryptoKey | null>(null);

  // 데모용 키 1회 생성 — raw 는 "링크 # 에만 있는 키" 로 표시.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { key, raw } = await generateInviteKey();
        if (cancelled) return;
        keyRef.current = key;
        setKeyRaw(raw);
      } catch { /* 데모일 뿐 — 실패해도 페이지는 안 깨짐 */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // 입력이 바뀔 때마다(또는 "다시" 누를 때마다) 실제로 암호화.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!keyRef.current) return;
      try {
        const bytes = await encryptJSON(text, keyRef.current);
        if (cancelled) return;
        setCipher(bytesToBase64Url(bytes));
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [text, keyRaw, nonce]);

  return (
    <div className="space-y-3">
      {/* 1. 평문 — 내가 입력한 내용 */}
      <div>
        <div className="label mb-1.5">내가 입력한 내용 (평문)</div>
        {editable ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            spellCheck={false}
            className="input-boxed leading-relaxed resize-none"
            aria-label="암호화 데모 입력"
          />
        ) : (
          <pre className="paper-card px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap break-words font-sans">{text}</pre>
        )}
        {editable && (
          <p className="text-[11px] text-soft mt-1.5">↑ 직접 바꿔보세요. 아래가 즉시 달라집니다.</p>
        )}
      </div>

      {/* 화살표 + 라벨 */}
      <div className="flex items-center justify-center gap-2 text-soft">
        <span className="text-[11px] tracking-eyebrow uppercase">🔒 이 기기에서 암호화</span>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="text-[11px] underline underline-offset-2 hover:text-ink transition"
          title="같은 글자도 매번 다른 암호문이 됩니다 — 진짜 암호화라는 증거"
        >
          다시 ↻
        </button>
      </div>

      {/* 2. 암호문 — 서버·운영자에게 보이는 것 */}
      <div>
        <div className="label mb-1.5 text-gold">운영자 서버에 보이는 것 (암호문)</div>
        <div className="paper-card px-4 py-3 bg-cream/40 max-h-32 overflow-auto">
          <code className="text-[11px] font-mono text-soft break-all leading-relaxed">
            {cipher || "암호화 중…"}
          </code>
        </div>
        <p className="text-[11px] text-soft mt-1.5 leading-relaxed">
          운영자는 이 글자만 봅니다. 이름·축의금·연락처가 전부 사라졌죠. 같은 코드(<code className="bg-cream px-1">encryptJSON</code>)가
          당신 데이터를 올릴 때 그대로 쓰입니다.
        </p>
      </div>

      {/* 3. 키 — 링크 # 에만, 서버 전송 안 됨 */}
      <div className="pt-1">
        <div className="label mb-1.5">🔑 복호화 키 — 공유 링크의 <code className="bg-cream px-1">#</code> 에만</div>
        <div className="paper-card px-4 py-2.5">
          <code className="text-[11px] font-mono text-ink break-all">{keyRaw || "…"}</code>
        </div>
        <p className="text-[11px] text-soft mt-1.5 leading-relaxed">
          이 키는 링크의 <code className="bg-cream px-1">#</code> 뒤에만 있고 <b className="text-ink">서버로 전송되지 않습니다</b>
          (브라우저 표준). 그래서 키를 가진 사람만 풀 수 있고, 운영자는 못 풉니다.
        </p>
      </div>
    </div>
  );
}
