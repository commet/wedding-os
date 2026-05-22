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
        최종 갱신 · 2026-05-22
      </p>

      <Section num="01" title="한눈에">
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>본 도구는 <b>오픈소스 도구</b>입니다. 기본 저장은 <b>본인 기기 또는 본인 인프라</b>이며, 중앙 데이터 서버는 없습니다.</li>
          <li>입력하신 데이터는 <b>본인 기기(브라우저)</b> 또는 <b>본인이 직접 만든 Supabase 프로젝트</b>에 저장됩니다.</li>
          <li>선택 기능인 <b>'간편 발행'</b>만 운영자 서버에 데이터를 올리며, 이때도 내용은 <b>종단간 암호화</b>되어 운영자가 읽을 수 없습니다 (08 항목 참고).</li>
          <li>운영자(yclee913)는 사용자 데이터의 <b>내용을 읽을 수 없습니다</b>.</li>
          <li>AI 기능은 사용자가 직접 챗봇(ChatGPT/Claude/Gemini)에 복붙하거나, 본인 API 키로 실행합니다.</li>
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
          <li><b>간편 발행 (선택)</b> · 청첩장을 운영자 서버에 <b>암호화</b>해 올려 공유 링크를 만듭니다. 08 항목 참고.</li>
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

      <Section num="08" title="간편 발행 청첩장 (운영자 호스팅)">
        <p className="mb-3 text-soft">
          '간편 발행'은 청첩장을 운영자 서버에 올려 진짜 공유 링크를 만드는 <b className="text-ink">선택 기능</b>입니다.
        </p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>
            <b>종단간 암호화</b> · 청첩장 본문(이름·인사말·식장·연락처·계좌·사진)과 하객 RSVP는
            사용자 브라우저에서 암호화된 뒤 업로드됩니다. 복호화 키는 공유 링크의{" "}
            <code className="bg-cream px-1">#</code> 뒤에만 있고 서버로 전송되지 않으므로,
            <b className="text-ink"> 운영자는 청첩장 내용도 RSVP도 읽을 수 없습니다.</b>
          </li>
          <li>
            <b>평문 보관 항목</b> · 카카오톡 링크 미리보기를 위해 <b className="text-ink">신랑·신부 이름과 예식 날짜</b>만
            암호화하지 않고 보관합니다. 그 외 정보는 모두 암호문입니다.
          </li>
          <li>
            <b>링크를 가진 사람</b> · 발행된 청첩장은 링크(키 포함)를 가진 누구나 열 수 있습니다.
            하객에게 보내는 용도이므로 의도된 동작이며, 링크에 진짜 비밀은 담지 마세요.
          </li>
          <li><b>보관 기간</b> · 발행된 청첩장은 예식일 +6개월 뒤 자동으로 만료·삭제됩니다.</li>
        </ul>
        <p className="text-[11.5px] text-soft mt-4 leading-relaxed">
          <b className="text-ink">이용 조건</b> · 간편 발행은 무료 편의 기능으로 제공되며 가용성·보존을
          보장하지 않습니다. 중요한 데이터는 [더보기 → 백업]으로 따로 보관하세요. 불법이거나 타인의 권리를
          침해하는 콘텐츠의 발행은 금지되며, 신고가 접수되면 운영자가 삭제할 수 있습니다 (운영자는 암호문을
          못 읽으므로 신고에 의존합니다). 더 강한 통제가 필요하면 모드 2(본인 Supabase) 또는 모드 3을 사용하세요.
        </p>
      </Section>

      <Section num="09" title="문의" last>
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
