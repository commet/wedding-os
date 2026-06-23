// 투명성 페이지 (/trust) — "운영자도 내용을 못 읽는다"를 *말이 아니라 직접 확인*으로 보여준다.
//
// 구성: 라이브 암호화 데모(맨 앞 — show, don't tell) → 원리(로그인≠암호화) →
//       F12 직접 검증 → 오픈소스 코드 핀 → 3단 보관 스펙트럼 → 정직한 고지.

import { Link } from "react-router-dom";
import CipherPeek from "../components/CipherPeek";
import { koBreak } from "../lib/typography";

const REPO = "https://github.com/commet/wedding-os/blob/master";

export default function Trust() {
  return (
    <div className="page pt-8 pb-12 max-w-app mx-auto text-[13px] leading-relaxed">
      <div className="mb-2">
        <div className="eyebrow-gold mb-2">보안 직접 확인</div>
        <h1 className="font-serif text-[2rem] leading-[1.1]">
          {koBreak("내용은 운영자도")}<br />{koBreak("못 읽습니다.")}
        </h1>
      </div>
      <p className="text-soft mt-3 mb-2">
        믿어달라고 말하지 않을게요. <b className="text-ink">직접 확인</b>하세요.
      </p>

      {/* 01 — 직접 확인 (라이브 데모가 맨 앞) */}
      <Section num="01" title="당신 데이터가 어떻게 보이는지">
        <p className="text-soft mb-4">
          아래는 가짜 효과가 아니라, 앱이 실제로 쓰는 암호화 함수를 이 페이지에서 그대로 돌린 결과예요.
          입력을 바꾸면 운영자에게 보이는 암호문이 즉시 바뀝니다.
        </p>
        <CipherPeek />
      </Section>

      {/* 02 — 원리 (로그인 ≠ 암호화) */}
      <Section num="02" title="어떻게 이게 가능한가요">
        <p className="mb-4">
          핵심은 <b>로그인</b>과 <b>암호화</b>가 다른 일이라는 거예요.
        </p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft mb-5">
          <li><b>로그인</b> = "당신이 누구인지" 확인 (출입 통제)</li>
          <li><b>암호화</b> = "누가 읽을 수 있는지" (내용의 비밀)</li>
        </ul>
        <p className="text-soft mb-5">
          보통 앱은 서버가 내용을 읽을 수 있고, 로그인은 <i>다른 사람</i>만 막습니다.
          우리는 반대로, 내용을 <b className="text-ink">당신 기기에서 암호화</b>한 뒤 올리기 때문에
          서버(운영자)조차 읽을 수 없어요.
        </p>

        {/* 간단 다이어그램 */}
        <div className="paper-card px-4 py-5 text-center text-[12px] space-y-2">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="chip">내 폰 · 평문 🔓</span>
            <span className="text-soft">→ 암호화 →</span>
            <span className="chip-active">암호문 🔒</span>
          </div>
          <div className="text-soft text-[18px] leading-none">↓</div>
          <div className="inline-flex flex-col items-center gap-1">
            <span className="chip">☁️ 운영자 서버 · 암호문 🔒 만</span>
            <span className="text-[11px] text-gold">운영자는 여기서 멈춤 — 키가 없음</span>
          </div>
          <div className="text-soft text-[18px] leading-none">↓</div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="chip-active">암호문 🔒</span>
            <span className="text-soft">→ 복호화 →</span>
            <span className="chip">상대 폰 · 평문 🔓</span>
          </div>
        </div>
      </Section>

      {/* 03 — F12 직접 검증 */}
      <Section num="03" title="브라우저로 직접 검증하기">
        <p className="text-soft mb-3">
          위 데모도 못 믿겠다면, 실제 저장 요청이 암호문인지 직접 보세요. 누구나 1분이면 확인합니다.
        </p>
        <ol className="list-decimal list-outside pl-5 space-y-2 marker:text-soft">
          <li>PC 브라우저에서 <b className="text-ink">F12</b>(또는 우클릭 → 검사) → <b className="text-ink">Network</b> 탭을 엽니다.</li>
          <li>청첩장을 발행하거나 데이터를 저장합니다.</li>
          <li>목록에서 <code className="bg-cream px-1">invite-publish</code> 또는 저장 요청을 클릭 → <b className="text-ink">Payload/Request</b>를 봅니다.</li>
          <li>올라가는 본문이 전부 알아볼 수 없는 암호문이면 — 증명 끝. 거짓이라면 여기서 들통납니다.</li>
        </ol>
      </Section>

      {/* 04 — 오픈소스 코드 핀 */}
      <Section num="04" title="코드로 확인하기">
        <p className="text-soft mb-3">
          당신 브라우저에서 도는 코드는 전부 공개돼 있습니다. 전문가라면 직접 읽고 검증할 수 있어요.
        </p>
        <ul className="space-y-2">
          <li>
            <a href={`${REPO}/src/lib/inviteCrypto.ts`} target="_blank" rel="noopener noreferrer"
               className="underline underline-offset-2 text-ink">inviteCrypto.ts</a>
            <span className="text-soft"> — 암호화(AES-GCM-256). 키 생성·암복호화 전부.</span>
          </li>
          <li>
            <a href={`${REPO}/api/invite-publish.ts`} target="_blank" rel="noopener noreferrer"
               className="underline underline-offset-2 text-ink">api/invite-publish.ts</a>
            <span className="text-soft"> — 서버는 암호문만 받습니다. 키는 받지 않아요.</span>
          </li>
          <li>
            <a href={`${REPO}/src/lib/inviteHosting.ts`} target="_blank" rel="noopener noreferrer"
               className="underline underline-offset-2 text-ink">inviteHosting.ts</a>
            <span className="text-soft"> — 키는 링크의 <code className="bg-cream px-1">#</code> 뒤에만 붙습니다.</span>
          </li>
          <li>
            <a href="https://github.com/commet/wedding-os" target="_blank" rel="noopener noreferrer"
               className="underline underline-offset-2 text-ink">전체 저장소 →</a>
          </li>
        </ul>
      </Section>

      {/* 05 — 3단 스펙트럼 */}
      <Section num="05" title="세 가지 보관 방식 — 골라 쓰세요">
        <p className="text-soft mb-4">
          편의와 프라이버시는 트레이드오프예요. 셋 다 정직하게 열어둡니다.
        </p>
        <div className="space-y-4">
          <Tier
            name="이 기기만"
            line="아무 데도 안 올라가요 — 이 폰에만."
            who="클라우드 자체가 찜찜한 분 · 최고 프라이버시 · 단일 기기"
          />
          <Tier
            name="간편 (운영자 호스팅·E2E)"
            line="쉽게, 함께 — 운영자 서버엔 암호문만."
            who="대부분의 부부 · 로그인은 신원·복구·안심용이고, 내용은 운영자도 못 봅니다"
            star
          />
          <Tier
            name="직접 운영"
            line="운영자를 아예 안 거쳐요 — 내 외부 저장소에 직접."
            who="기술 설정이 가능한 분 · 완전한 데이터 주권"
          />
        </div>
      </Section>

      {/* 06 — 정직한 고지 */}
      <Section num="06" title="숨기지 않는 단 하나" last>
        <ul className="list-disc list-outside pl-5 space-y-2 marker:text-soft">
          <li>
            <b>평문으로 보관되는 것</b> · 카카오톡 링크 미리보기를 위해 <b className="text-ink">신랑·신부 이름과 예식 날짜</b>만
            암호화하지 않습니다. 그 외(연락처·계좌·축의금·사진)는 전부 암호문입니다.
          </li>
          <li>
            <b>간편 모드의 로그인</b> · 운영자는 "누가 결혼식을 준비 중인지"(이메일)는 알게 됩니다.
            하지만 <b className="text-ink">그 안에 무엇이 있는지는 못 봅니다</b>. 이마저 싫다면 "이 기기만" 또는 "직접 운영"을 쓰세요.
          </li>
          <li>
            <b>링크를 가진 사람</b> · 발행된 청첩장은 링크(키 포함)를 가진 누구나 열 수 있습니다. 하객용이므로 의도된 동작이에요.
          </li>
        </ul>
        <p className="text-[12px] text-soft mt-5">
          더 자세한 처리방침은 <Link to="/privacy" className="underline underline-offset-2 text-ink">개인정보 · 보안 안내</Link>를 보세요.
        </p>
      </Section>
    </div>
  );
}

function Tier({ name, line, who, star }: { name: string; line: string; who: string; star?: boolean }) {
  return (
    <div className="border-l-2 border-hair pl-4">
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="font-serif text-[16px] text-ink">{koBreak(name)}</h3>
        {star && <span className="eyebrow-gold">추천</span>}
      </div>
      <p className="text-[13px] text-ink mb-1">{line}</p>
      <p className="text-[11.5px] text-soft leading-relaxed">{who}</p>
    </div>
  );
}

function Section({ num, title, children, last }: { num: string; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={`py-7 ${last ? "" : "border-b border-hair"}`}>
      <div className="flex items-baseline gap-4 mb-4">
        <span className="font-serif text-soft text-base tabular-nums w-6 flex-shrink-0">{num}</span>
        <h2 className="font-serif text-[17px] text-ink">{koBreak(title)}</h2>
      </div>
      <div className="pl-10">{children}</div>
    </section>
  );
}
