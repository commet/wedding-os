// 이용조건 / 책임 범위.
// 공개 서비스로 운영할 때 경쟁사·업체·사용자가 문제 삼기 쉬운 경계를 한 화면에 모은다.

import { Link } from "react-router-dom";
import { koBreak } from "../lib/typography";

export default function Terms() {
  return (
    <div className="page pt-8 pb-10 max-w-app mx-auto text-[13px] leading-relaxed">
      <div className="mb-2">
        <div className="eyebrow-gold mb-2">이용 조건</div>
        <h1 className="font-serif text-[2rem] leading-[1.08]">{koBreak("Dearie 이용 안내")}</h1>
      </div>
      <p className="eyebrow mt-3 mb-8">최종 갱신 · 2026-06-30</p>

      <Section num="01" title="서비스의 성격">
        <p>
          Dearie는 예비부부가 결혼 준비 정보를 정리하는 <b className="text-ink">개인용 도구</b>입니다.
          예식장·스드메·반지·여행 후보를 보증하거나 중개하지 않고, 계약 체결을 대리하지 않습니다.
          가격·수용 인원·가능 일정·계약 조건은 수시로 바뀌므로 최종 계약 전 반드시 공식 채널과 계약서로 직접 확인해야 합니다.
        </p>
      </Section>

      <Section num="02" title="업체·브랜드 정보">
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>업체·브랜드명은 비교와 개인 메모를 위한 식별 목적으로만 표시합니다.</li>
          <li>표시는 추천·순위·광고·제휴·공식 대리 관계를 의미하지 않습니다.</li>
          <li>카탈로그는 공개적으로 확인 가능한 사실, 공식 페이지, 사용자가 직접 입력한 메모, 상담 확인일을 중심으로 정리합니다.</li>
          <li>후기 원문, 유료 DB, 회원 전용 게시물, 타 서비스의 편집 배열을 복제해 저장하지 않는 것을 원칙으로 합니다.</li>
          <li>정정·삭제·권리침해 신고는 <Link to="/contact" className="underline underline-offset-2 text-ink">문의</Link>로 보내주세요. 확인 가능한 요청은 신속히 처리합니다.</li>
        </ul>
      </Section>

      <Section num="03" title="사용자 콘텐츠">
        <p className="mb-3">
          사용자가 올리는 사진, 음악, 문구, 계약서 메모, 하객 정보에 대한 권리와 적법한 이용 책임은 사용자에게 있습니다.
        </p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>스튜디오·스냅 사진, 드레스 화보, 음원, 가사, 상업 문구는 이용허락 범위를 확인한 뒤 사용하세요.</li>
          <li>하객 명단과 RSVP는 예식 준비에 필요한 범위로만 수집하고, 불필요한 민감정보를 입력하지 마세요.</li>
          <li>복구·편집 링크와 공유 비밀번호를 함께 가진 사람은 전체 데이터를 열 수 있습니다. 잘못 보낸 경우 설정에서 공유 권한을 새로 만들어 이전 보호 링크를 무효화하고, 배우자 외 제3자에게 전달하지 마세요.</li>
        </ul>
      </Section>

      <Section num="04" title="AI와 자동화">
        <p>
          Dearie의 AI 답변은 초안과 체크리스트 정리를 돕기 위한 것입니다. 법률·세무·의료·계약 자문이 아니며,
          업체의 실제 견적이나 예약 가능 여부를 보장하지 않습니다. AI 요청에 복구 링크, 계좌번호, 하객 명단,
          계약서 원본처럼 노출되면 곤란한 정보는 넣지 마세요.
        </p>
      </Section>

      <Section num="05" title="보안과 금지 행위">
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>타인의 청첩장 링크, 복구 링크, 계정, 저장소에 무단 접근하거나 접근을 시도해서는 안 됩니다.</li>
          <li>대량 요청, 자동 RSVP 제출, 취약점 악용, 서비스 거부 공격, 개인정보 수집·추출을 금지합니다.</li>
          <li>보안 취약점을 발견하면 공개 글이나 이슈 대신 <Link to="/contact" className="underline underline-offset-2 text-ink">비공개로 신고</Link>해주세요. 실제 사용자 데이터 접근·변조·삭제 없이 재현 정보만 보내주세요.</li>
        </ul>
      </Section>

      <Section num="06" title="가용성과 책임 범위">
        <p>
          Dearie는 무료 또는 셀프 호스팅 형태로 제공되는 도구입니다. 데이터 보존, 외부 서비스 장애,
          브라우저 저장소 삭제, 사용자가 공유한 링크 유출, 제3자 서비스 정책 변경으로 생기는 손실을 완전히 보장할 수 없습니다.
          중요한 데이터는 설정에서 정기적으로 백업하고, 공개 서비스로 운영하는 경우 실제 사업자 정보와 법적 고지를 본인 상황에 맞게 보완해야 합니다.
        </p>
      </Section>

      <Section num="07" title="삭제·정정·연락" last>
        <p>
          개인정보 삭제, 업체 표시 정정·삭제, 저작권·상표권 문제, 보안 취약점 신고는{" "}
          <Link to="/contact" className="underline underline-offset-2 text-ink">문의</Link> 또는{" "}
          <a className="underline underline-offset-2 text-ink" href="mailto:yclee913@gmail.com" rel="noopener noreferrer">yclee913@gmail.com</a>
          {" "}으로 보내주세요. 공개 GitHub Issue에는 개인정보, 복구 링크, 보안 취약점 세부 내용을 적지 마세요.
        </p>
      </Section>

      <p className="text-[11px] text-soft pt-8 text-center">
        자세한 개인정보 처리 구조는 <Link to="/privacy" className="underline underline-offset-2 text-ink">개인정보 · 보안 안내</Link>와{" "}
        <Link to="/trust" className="underline underline-offset-2 text-ink">투명성 페이지</Link>에서 확인할 수 있습니다.
      </p>
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
      <div className="pl-10 text-ink/90">{children}</div>
    </section>
  );
}
