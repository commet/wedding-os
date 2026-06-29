// 개인정보처리방침 / 보안 안내.
// 셀프 호스팅 구조에서 데이터가 어디에 머무는지 명확히 설명한다.

export default function Privacy() {
  return (
    <div className="page pt-8 pb-10 max-w-app mx-auto text-[13px] leading-relaxed">
      <div className="mb-2">
        <div className="eyebrow-gold mb-2">개인정보와 보안</div>
        <h1 className="font-serif text-[2rem] leading-none">개인정보 · 보안 안내</h1>
      </div>
      <p className="eyebrow mt-3 mb-8">
        최종 갱신 · 2026-06-29
      </p>

      <Section num="01" title="한눈에">
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>본 도구는 <b>오픈소스</b>이며, 저장 방식을 직접 선택합니다 — ① <b>이 기기만</b>(로컬) ② <b>간편</b>(운영자 호스팅·종단간 암호화) ③ <b>직접 운영</b>(본인 외부 저장소) ④ <b>코드 직접 운영</b>.</li>
          <li><b>로컬·직접 운영</b>은 운영자 서버를 거치지 않습니다(본인 기기 또는 본인 인프라).</li>
          <li><b>간편</b>은 운영자 서버에 저장하되, 모든 내용이 <b>이 기기에서 종단간 암호화</b>되어 암호문으로만 올라갑니다. 복호화 키는 서버로 전송되지 않아 <b>운영자는 내용도 키도 알 수 없습니다</b> (03·08 항목).</li>
          <li><b>운영자 저장소의 결혼 준비 데이터는 운영자가 읽을 수 없는 암호문입니다.</b> 간편 모드 로그인 신원과, 사용자가 명시적으로 Dearie AI에 보낸 프롬프트는 별도로 처리됩니다.</li>
          <li>AI 기능은 직접 복붙, 본인 API 키, 또는 로그인 후 운영자 제공 AI 중에서 선택합니다. 운영자 제공 AI를 쓰면 프롬프트가 운영자 서버를 거쳐 Anthropic으로 전송됩니다.</li>
        </ul>
      </Section>

      <Section num="02" title="수집 · 저장 항목">
        <p className="text-soft mb-3">사용자가 직접 입력한 다음 정보들이 저장될 수 있습니다.</p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>본인 · 배우자 · 혼주의 이름, 관계</li>
          <li>연락처(전화번호), 입금 계좌 정보</li>
          <li>예식 일정 · 장소 · 주소</li>
          <li>업로드한 사진과 사진 설명</li>
          <li>체크리스트 · 신혼여행 · 반지 등 결혼 준비 메모</li>
          <li>하객 이름·연락처·관계·참석 여부·식사 메모·축하 메시지 등 사용자가 입력하거나 하객이 제출한 정보</li>
          <li>로그인 사용 시 이메일, 소셜 로그인 제공자가 전달한 계정 식별정보</li>
        </ul>
        <p className="text-[11.5px] text-soft mt-3">
          주민등록번호 등 고유식별정보는 수집하지 않습니다. 하객 RSVP도 예식 준비에 필요한 이름·참석 여부·인원·식사 메모 중심으로만 받는 것을 권장합니다.
        </p>
      </Section>

      <Section num="03" title="저장 위치">
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li><b>이 기기만 (로컬)</b> · 입력값은 본인 브라우저의 localStorage/IndexedDB 에만 저장됩니다. 외부 전송 없음.</li>
          <li><b>간편 (운영자 호스팅·E2E)</b> · 결혼 준비 본문은 이 기기에서 암호화된 암호문으로 올라갑니다. 복호화 키는 공유·복구 링크의 <code className="bg-cream px-1">#</code> 에만 있고 서버로 전송되지 않아 운영자는 본문을 읽을 수 없습니다. 다만 로그인 계정 정보와 08 항목의 OG 메타는 별도 평문으로 처리됩니다.</li>
          <li><b>직접 운영 (내 외부 저장소)</b> · 본인이 가입한 외부 저장소(Supabase)에 직접 저장됩니다. 운영자를 거치지 않습니다.</li>
          <li><b>개발자 모드</b> · 코드를 받아 본인 인프라에서 직접 운영합니다.</li>
          <li><b>간편 발행 (선택)</b> · 청첩장을 운영자 서버에 <b>암호화</b>해 올려 공유 링크를 만듭니다. 08 항목 참고.</li>
        </ul>
      </Section>

      <Section num="04" title="제3자 처리위탁">
        <p className="mb-3">본 도구가 동작하기 위해 다음 외부 서비스에 사용자가 직접 연결할 수 있습니다.</p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li><b>외부 저장소(Supabase)</b> (사용자가 선택한 리전) — 데이터 저장</li>
          <li><b>Vercel</b> — 정적 호스팅·배포</li>
          <li><b>Anthropic</b> — 로그인 사용자가 운영자 제공 AI를 선택한 경우 프롬프트 처리</li>
          <li><b>Unsplash / jsdelivr CDN</b> — 기본 사진·폰트 정적 자원 로드</li>
          <li>지도/검색 외부 링크 클릭 시 · 카카오맵·네이버지도·구글·인스타 등</li>
        </ul>
        <p className="text-[11.5px] text-soft mt-3">
          외부 서비스 이용 시 해당 서비스의 정책이 적용됩니다. 실제 운영자는 배포 전에 각 업체의 처리 국가·리전,
          이전 항목·목적·시점과 방법·보유기간을 확인하여 본 방침에 구체적으로 공개해야 합니다.
        </p>
      </Section>

      <Section num="05" title="공개 링크 · 복구 링크 · 로그인">
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li><b>공개 청첩장 링크</b> · 하객에게 보내는 링크입니다. 이름, 일시, 장소, 연락처, 계좌, 사진 등 청첩장에 표시한 정보만 노출됩니다.</li>
          <li><b>복구·편집 링크 (간편 모드)</b> · 기기 교체 복구와 부부 공동 편집에 쓰는 링크입니다. <b>데이터 전체의 복호화 키가 포함된 마스터 열쇠</b>이므로 배우자에게만 1:1로 보내고 하객·단톡방·SNS에 공유하지 마세요. 키는 링크의 <code className="bg-cream px-1">#</code> 에만 있어 서버로 전송되지 않습니다.</li>
          <li><b>간편 모드 로그인 (선택)</b> · 이메일·카카오·구글로 로그인하면 기기를 바꿔도 복구할 수 있습니다. 이때 운영자는 <b>로그인 신원(이메일 등)은 알 수 있으나</b>, 복호화 키는 본인이 정한 <b>암호문구로 감싸여 저장</b>되므로 <b>내용은 여전히 읽을 수 없습니다</b>. 암호문구를 잊으면 운영자도 복구를 도와드릴 수 없습니다.</li>
          <li>브라우저, 외부 저장소, 배포 서비스 계정 접근 권한은 사용자 본인이 관리합니다. 계정 비밀번호와 배포 환경변수는 다른 사람에게 공유하지 마세요.</li>
        </ul>
      </Section>

      <Section num="06" title="데이터 삭제 · 내려받기">
        <p className="mb-3">모든 데이터는 본인이 직접 통제합니다.</p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>로컬 · 설정 → "모든 데이터 지우기"</li>
          <li>간편 · 설정 → "모든 데이터 지우기"를 누르면 운영자 서버의 암호문과 복구 연결도 함께 삭제됩니다.</li>
          <li>직접 운영 · 본인의 외부 저장소 대시보드에서 row/table 삭제</li>
          <li>백업 · 설정 → "내려받기" 로 JSON 다운로드 가능 (보안상 anon key 등 시크릿은 제외됨)</li>
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
          보장하지 않습니다. 중요한 데이터는 [설정 → 백업]으로 따로 보관하세요. 불법이거나 타인의 권리를
          침해하는 콘텐츠의 발행은 금지되며, 신고가 접수되면 운영자가 삭제할 수 있습니다 (운영자는 암호문을
          못 읽으므로 신고에 의존합니다). 더 강한 통제가 필요하면 직접 운영 모드(본인 외부 저장소) 또는 코드 직접 운영을 사용하세요.
        </p>
      </Section>

      <Section num="09" title="저작권 · 상표 · 콘텐츠">
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li><b>사진</b> · 직접 촬영하지 않은 사진, 스튜디오·스냅 원본, 업체 제공 이미지는 계약서나 이용허락 범위 안에서만 올리세요. 청첩장·식전영상·SNS 공유 허용 범위가 다를 수 있습니다.</li>
          <li><b>음악</b> · 상용 음원을 식전영상, 청첩장 BGM, 온라인 공유 영상에 넣는 경우 별도 사용 허락이 필요할 수 있습니다. 공유저작물도 출처 표시, 변경 가능 여부, 상업적 이용 제한 등 조건을 확인하세요.</li>
          <li><b>상표·업체명</b> · 반지 브랜드, 웨딩홀, 스튜디오명은 비교·메모 목적으로만 표시합니다. Dearie는 해당 브랜드와 제휴·후원·공식 추천 관계가 아닙니다.</li>
          <li><b>AI 문안</b> · AI가 만든 청첩장 문구, 안내문, 계약 질문은 초안입니다. 타인의 시·노래 가사·상업 문구를 그대로 쓰지 말고 최종 문안은 직접 확인하세요.</li>
        </ul>
      </Section>

      <Section num="10" title="운영자 확인 필요 항목">
        <p className="mb-3">
          본 저장소를 공개 서비스로 운영하려면 코드만으로 해결되지 않는 운영 정보가 필요합니다.
          실제 운영자는 배포 전에 다음 항목을 본인 상황에 맞게 채워야 합니다.
        </p>
        <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-soft">
          <li>운영자 또는 사업자 명칭, 개인정보 보호 책임자, 실제 연락처</li>
          <li>Vercel·Supabase·Anthropic·소셜 로그인 제공자의 실제 처리 국가, 리전, 보유기간</li>
          <li>개인정보 침해 신고·삭제 요청·차단·통지 절차</li>
          <li>업체 정보 삭제·정정 요청을 받았을 때의 처리 기준</li>
        </ul>
      </Section>

      <Section num="11" title="문의" last>
        <p>
          개인정보 보호 책임 및 보안 · 삭제 요청 창구는 Dearie 운영자입니다. 개인정보가 포함된 요청은{" "}
          <a className="underline underline-offset-2 text-ink" href="mailto:yclee913@gmail.com" rel="noopener noreferrer">yclee913@gmail.com</a>
          {" "}으로 보내주세요. 공개될 수 있는 GitHub Issue에는 이름·연락처·계좌·복구 링크 등 개인정보를 적지 마세요.
          일반 기능 오류만{" "}
          <a className="underline underline-offset-2 text-ink" href="https://github.com/commet/wedding-os/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>로 알려주세요.
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
