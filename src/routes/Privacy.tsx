// 개인정보처리방침 / 보안 안내.
// 개인정보보호법 제30조 의무 + 사용자 신뢰 — 데이터가 어디에 머무는지 명확히.

export default function Privacy() {
  return (
    <div className="px-5 py-6 space-y-5 max-w-app mx-auto text-sm leading-relaxed">
      <h1 className="font-serif text-2xl">개인정보 · 보안 안내</h1>
      <p className="text-soft">
        최종 갱신: 2026-05-15
      </p>

      <section className="card space-y-2">
        <h2 className="font-medium">1. 한눈에</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>본 도구는 <b>오픈소스 개인 프로젝트</b>입니다. 운영자가 운영하는 중앙 서버는 없습니다.</li>
          <li>입력하신 데이터는 <b>본인 기기(브라우저)</b> 또는 <b>본인이 직접 만든 Supabase 프로젝트</b>에만 저장됩니다.</li>
          <li>운영자(yclee913)는 사용자 데이터에 <b>접근할 수 없습니다</b>.</li>
          <li>AI 기능은 사용자가 직접 챗봇(ChatGPT/Claude/Gemini)에 복붙하거나, 사용자 본인의 API 키로만 호출됩니다.</li>
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">2. 수집·저장 항목</h2>
        <p className="text-soft">사용자가 직접 입력한 다음 정보들이 저장될 수 있습니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>본인·배우자·혼주의 이름, 영문 이름, 관계</li>
          <li>연락처(전화번호), 입금 계좌 정보</li>
          <li>예식 일정·장소·주소</li>
          <li>업로드 또는 외부 링크로 추가한 사진 URL</li>
          <li>체크리스트·신혼여행·반지 등 결혼 준비 메모</li>
        </ul>
        <p className="text-xs text-soft">
          ※ 주민등록번호 등 고유식별정보는 수집하지 않습니다.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">3. 저장 위치</h2>
        <ul className="list-disc list-inside space-y-1">
          <li><b>모드 1 (휴대폰 저장)</b>: 입력값은 본인 브라우저의 localStorage 에만 저장됩니다. 외부 전송 없음.</li>
          <li><b>모드 2 (내 사이트)</b>: 본인이 가입한 Supabase 프로젝트에 직접 저장됩니다. 운영자는 해당 프로젝트의 접근 권한이 없습니다.</li>
          <li><b>모드 3 (개발자 모드)</b>: 코드를 받아 본인 인프라에서 직접 운영합니다.</li>
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">4. 제3자 처리위탁</h2>
        <p>본 도구가 동작하기 위해 다음 외부 서비스에 사용자가 직접 연결할 수 있습니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li><b>Supabase</b>(미국·한국 등 사용자 선택 리전) — 데이터 저장</li>
          <li><b>Vercel</b>(미국·한국 리전) — 정적 호스팅</li>
          <li><b>Unsplash / jsdelivr CDN</b> — 사진·폰트 정적 자원 로드</li>
          <li>지도/검색 외부 링크 클릭 시: 카카오맵·네이버지도·구글·인스타 등</li>
        </ul>
        <p className="text-xs text-soft">
          외부 서비스 이용 시 해당 서비스의 정책이 적용됩니다.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">5. 보안 상의 한계 (꼭 읽어주세요)</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>모드 2의 청첩장 URL은 받은 사람이라면 누구나 데이터 조회·수정 가능성이 있습니다. 인증 기반 보안이 들어가기 전까지는 <b>가까운 가족·친구에게만 공유</b>를 권장합니다.</li>
          <li>본 도구는 "있는 그대로(AS-IS)" 제공되며, 호스팅·운영하면서 발생하는 결과는 호스팅한 본인의 책임입니다.</li>
          <li>오류·보안 이슈 발견 시 즉시 문의 부탁드립니다 — 빠르게 수정합니다.</li>
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">6. 데이터 삭제·내려받기</h2>
        <p>모든 데이터는 본인이 직접 통제합니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>모드 1: 더보기 → "모든 데이터 지우기"</li>
          <li>모드 2: 본인의 Supabase 대시보드에서 row/table 삭제</li>
          <li>백업: 더보기 → "내려받기" 로 JSON 다운로드 가능 (보안상 anon key 등 시크릿은 제외됨)</li>
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">7. 업체 카탈로그 안내 (스드메·청첩장 등)</h2>
        <p>
          본 도구가 표시하는 업체 목록은 결혼 카페·후기 등에서 자주 언급되는 곳을 단순 정리한 출발점이며,
          순위·평가·제휴 관계가 아닙니다. 정보가 부정확하거나 표시 삭제를 원하시는 업체는 아래로 알려주시면
          <b>24시간 이내 처리</b>해드립니다.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">8. 문의</h2>
        <p>
          오류·보안·삭제 요청 등은{" "}
          <a className="underline" href="mailto:yclee913@gmail.com" rel="noopener noreferrer">yclee913@gmail.com</a>
          {" "}또는{" "}
          <a className="underline" href="https://github.com/commet/wedding-os/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>
          {" "}로 알려주세요.
        </p>
      </section>

      <p className="text-xs text-soft pt-2 text-center">
        본 안내는 한국 개인정보보호법 제30조에 따른 개인정보처리방침 의무 이행을 겸합니다.
      </p>
    </div>
  );
}
