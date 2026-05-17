// 개인정보처리방침 / 보안 안내.
// 셀프 호스팅 구조에서 데이터가 어디에 머무는지 명확히 설명한다.

export default function Privacy() {
  return (
    <div className="page pt-8 pb-10 max-w-app mx-auto text-[13px] leading-relaxed">
      <div className="mb-2">
        <div className="eyebrow-gold mb-2">Privacy · Security</div>
        <h1 className="font-serif text-[2rem] leading-none">개인정보 · 보안 안내</h1>
      </div>
      <p className="eyebrow mt-3 mb-8">
        최종 갱신 · 2026-05-17
      </p>

      <Section num="01" title="한눈에">
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>본 도구는 <b>오픈소스 셀프 호스팅 도구</b>입니다. 운영자가 운영하는 중앙 데이터 서버는 없습니다.</li>
          <li>입력하신 데이터는 <b>본인 기기(브라우저)</b> 또는 <b>본인이 직접 만든 Supabase 프로젝트</b>에만 저장됩니다.</li>
          <li>운영자(yclee913) 는 사용자 데이터에 <b>접근할 수 없습니다</b>.</li>
          <li>AI 기능은 사용자가 직접 챗봇(ChatGPT/Claude/Gemini) 에 복붙하는 방식으로 동작합니다.</li>
        </ul>
      </Section>

      <Section num="02" title="수집 · 저장 항목">
        <p className="text-soft mb-3">사용자가 직접 입력한 다음 정보들이 저장될 수 있습니다.</p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>본인 · 배우자 · 혼주의 이름, 영문 이름, 관계</li>
          <li>연락처(전화번호), 입금 계좌 정보</li>
          <li>예식 일정 · 장소 · 주소</li>
          <li>업로드 또는 외부 링크로 추가한 사진 URL</li>
          <li>체크리스트 · 신혼여행 · 반지 등 결혼 준비 메모</li>
        </ul>
        <p className="text-[11.5px] text-soft mt-3">
          주민등록번호 등 고유식별정보는 수집하지 않습니다.
        </p>
      </Section>

      <Section num="03" title="저장 위치">
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li><b>모드 1 (휴대폰 저장)</b> · 입력값은 본인 브라우저의 localStorage 에만 저장됩니다. 외부 전송 없음.</li>
          <li><b>모드 2 (내 사이트)</b> · 본인이 가입한 Supabase 프로젝트에 직접 저장됩니다. 공개 청첩장 링크는 청첩장 정보만 읽습니다.</li>
          <li><b>모드 3 (개발자 모드)</b> · 코드를 받아 본인 인프라에서 직접 운영합니다.</li>
        </ul>
      </Section>

      <Section num="04" title="제3자 처리위탁">
        <p className="mb-3">본 도구가 동작하기 위해 다음 외부 서비스에 사용자가 직접 연결할 수 있습니다.</p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li><b>Supabase</b> (사용자가 선택한 리전) — 데이터 저장</li>
          <li><b>Vercel</b> — 정적 호스팅·배포</li>
          <li><b>Unsplash / jsdelivr CDN</b> — 기본 사진·폰트 정적 자원 로드</li>
          <li>지도/검색 외부 링크 클릭 시 · 카카오맵·네이버지도·구글·인스타 등</li>
        </ul>
        <p className="text-[11.5px] text-soft mt-3">
          외부 서비스 이용 시 해당 서비스의 정책이 적용됩니다.
        </p>
      </Section>

      <Section num="05" title="공개 링크와 편집 링크">
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li><b>공개 청첩장 링크</b> · 하객에게 보내는 링크입니다. 이름, 일시, 장소, 연락처, 계좌, 사진 등 청첩장에 표시한 정보만 노출됩니다.</li>
          <li><b>편집 초대 링크</b> · 부부가 함께 편집할 때만 쓰는 링크입니다. 이 링크에는 편집 권한 토큰이 포함되므로 하객·단톡방·SNS에 공유하지 마세요.</li>
          <li>브라우저, Supabase, Vercel 계정 접근 권한은 사용자 본인이 관리합니다. 계정 비밀번호와 배포 환경변수는 다른 사람에게 공유하지 마세요.</li>
        </ul>
      </Section>

      <Section num="06" title="데이터 삭제 · 내려받기">
        <p className="mb-3">모든 데이터는 본인이 직접 통제합니다.</p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>모드 1 · 더보기 → "모든 데이터 지우기"</li>
          <li>모드 2 · 본인의 Supabase 대시보드에서 row/table 삭제</li>
          <li>백업 · 더보기 → "내려받기" 로 JSON 다운로드 가능 (보안상 anon key 등 시크릿은 제외됨)</li>
        </ul>
      </Section>

      <Section num="07" title="업체 카탈로그 안내 (스드메 · 청첩장 등)">
        <p>
          본 도구가 표시하는 업체 목록은 결혼 카페 · 후기 등에서 자주 언급되는 곳을 단순 정리한 출발점이며,
          순위 · 평가 · 제휴 관계가 아닙니다. 정보가 부정확하거나 표시 삭제를 원하시는 업체는 아래로 알려주시면
          <b> 24시간 이내 처리</b>해드립니다.
        </p>
      </Section>

      <Section num="08" title="문의" last>
        <p>
          오류 · 보안 · 삭제 요청 등은{" "}
          <a className="underline underline-offset-2 text-ink" href="mailto:yclee913@gmail.com" rel="noopener noreferrer">yclee913@gmail.com</a>
          {" "}또는{" "}
          <a className="underline underline-offset-2 text-ink" href="https://github.com/commet/wedding-os/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>
          {" "}로 알려주세요.
        </p>
      </Section>

      <p className="text-[11px] text-soft pt-8 text-center">
        본 안내는 셀프 호스팅 사용자를 위한 개인정보·보안 고지입니다. 법적 의무 판단은 운영 방식에 따라 달라질 수 있습니다.
      </p>
    </div>
  );
}

function Section({ num, title, children, last }: { num: string; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={`py-7 ${last ? "" : "border-b border-hair"}`}>
      <div className="flex items-baseline gap-4 mb-4">
        <span className="font-serif text-soft text-base tabular-nums w-6 flex-shrink-0">{num}</span>
        <h2 className="font-serif text-[17px] text-ink">{title}</h2>
      </div>
      <div className="pl-10 text-ink/90">{children}</div>
    </section>
  );
}
