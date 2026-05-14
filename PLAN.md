# wedding-os — 작업 계획서

> 한 도메인에서 결혼 준비 대시보드 + 모바일 청첩장 + 식전영상 에디터를 묶는다.
> 비개발자도 자기 결혼식에 쓸 수 있고, 개발자는 AI로 자기 식대로 손볼 수 있다.
> 운영은 본인이 하지 않는다 — 사용자가 본인 인프라로 굴린다.

---

## 0. 목표 (Goals)

1. **세 가지 모드** 중 하나를 선택해서 같은 결과물에 도달할 수 있다.
   - 모드 1: 로컬 (localStorage, 가입 0, 공유 X)
   - 모드 2: 셀프 호스팅 (Vercel + Supabase, 공유 O, 협업 O)
   - 모드 3: 코드 받아 직접 고치기 (GitHub fork + Claude Code 등)
2. **운영 책임 0**: 본인은 사용자 데이터에 접근 불가, 사용자 인프라에 책임 없음.
3. **비개발자가 첫 30분 안에 가치를 본다**: 청첩장 미리보기 + 체크리스트 작동.
4. **AI 비용 0 운영**: 챗봇 다리 모드(복붙) 기본, 본인 API 키는 선택지.
5. **데이터 신선도**: 모든 시세성 정보(반지, 호텔, 항공)에 `lastVerified` + 업데이트 동선.
6. **연락처**: 이슈/문의는 `yclee913@gmail.com`으로 가는 사전 양식 폼.

---

## 1. 스코프

### In scope (이번에 만든다)
- Vite + React + TS + Tailwind 모노 앱
- 3-모드 선택 화면 (랜딩)
- 라우터: `/`, `/dashboard`, `/rings`, `/hotel`, `/flights`, `/honeymoon`, `/checklist`, `/invitation`, `/video`, `/setup`, `/settings`, `/contact`
- localStorage 저장 레이어 + Supabase 어댑터 (인터페이스만 통일)
- 모바일 우선 UI
- 데이터 신선도 + 챗봇 다리 패턴
- README + CLAUDE.md + AGENTS.md
- Issue/Contact 폼 (mailto + 임시 양식)

### Out of scope (이번엔 안 한다 — 다음 페이즈)
- Remotion 영상 에디터의 풀 통합 (자리만 만들고 안내)
- Realtime 협업 (Supabase 어댑터에서 골격만; 작동은 모드 2 셋업 후)
- 1-Click "Deploy to Vercel" 버튼은 안내까지만; 실제 fork는 GitHub 측 자동
- 결제/SaaS 백엔드 (없음)
- 자체 AI API 호출 (없음 — 사용자 키 또는 챗봇 다리)

### 명시적 비목표
- 본인이 사용자 데이터를 보관·관리하지 않는다.
- 본인이 사용자 AI 비용을 부담하지 않는다.
- 본인이 1:1 셋업 지원을 의무로 하지 않는다 (선택적으로 가능).

---

## 2. 아키텍처

```
wedding-os/
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                          # 라우터 + 모드 가드
│  ├─ routes/
│  │  ├─ Welcome.tsx                   # 모드 선택 화면 (최초 진입)
│  │  ├─ Dashboard.tsx
│  │  ├─ Rings.tsx
│  │  ├─ Hotel.tsx
│  │  ├─ Flights.tsx
│  │  ├─ Honeymoon.tsx
│  │  ├─ Checklist.tsx
│  │  ├─ Invitation.tsx
│  │  ├─ Video.tsx                     # 풀 에디터는 stub, 안내
│  │  ├─ Setup.tsx                     # 모드 2 셋업 위저드
│  │  ├─ Settings.tsx
│  │  └─ Contact.tsx
│  ├─ components/
│  │  ├─ AppShell.tsx                  # 헤더 + 하단 탭(모바일)
│  │  ├─ Card.tsx
│  │  ├─ Modal.tsx
│  │  ├─ FreshnessBadge.tsx
│  │  ├─ ChatbotBridgeButton.tsx
│  │  ├─ FieldEditor.tsx
│  │  └─ ModeBadge.tsx
│  ├─ lib/
│  │  ├─ storage.ts                    # 추상 인터페이스
│  │  ├─ storage.local.ts              # localStorage 구현
│  │  ├─ storage.supabase.ts           # Supabase 구현 (어댑터)
│  │  ├─ mode.ts                       # 현재 모드 상태
│  │  ├─ schema.ts                     # 모든 데이터 타입
│  │  ├─ chatbotBridge.ts              # 자연어 → 프롬프트 생성
│  │  └─ freshness.ts                  # lastVerified util
│  ├─ data/
│  │  ├─ ringsTemplate.ts              # 브랜드 카탈로그 (lastVerified)
│  │  ├─ hotelOtaTemplate.ts           # OTA 목록
│  │  ├─ checklistTemplate.ts          # 8 카테고리
│  │  └─ honeymoonRegions.ts
│  └─ styles/
│     └─ index.css                     # Tailwind
├─ public/
│  ├─ favicon.svg
│  └─ og.png
├─ supabase/
│  ├─ schema.sql                       # 모드 2 사용자가 자기 DB에 돌릴 SQL
│  └─ README.md
├─ AGENTS.md                            # Claude Code 사용자용
├─ CLAUDE.md                            # 동일 내용 (양쪽 도구 호환)
├─ README.md                            # 사용자용
├─ package.json
├─ vite.config.ts
├─ tailwind.config.ts
└─ tsconfig.json
```

### 데이터 모델 (schema.ts)

```ts
export type WeddingData = {
  meta: { groomName, brideName, date, venue, ... };
  rings: Ring[];           // 사용자가 추가/편집 가능
  hotels: Hotel[];
  flights: Flight[];
  honeymoon: HoneymoonPlan;
  checklist: ChecklistSection[];
  invitation: InvitationContent;
  video: VideoConfig;      // letter-editor 형식과 호환
  preferences: {
    mode: 'local' | 'supabase' | 'devOnly';
    locale: 'ko' | 'en' | 'zh';
    aiKey?: string;        // 선택, 본인 키 입력 시
  };
  schemaVersion: number;
};
```

모든 페이지는 `useWeddingData()` 훅으로 같은 모델을 읽고 쓴다. 저장 백엔드는 모드에 따라 갈림.

---

## 3. 모드별 흐름

### 모드 1: 로컬
- 데이터: `localStorage["wedding-os/v1"]` (JSON 직렬화)
- 협업: 불가능
- 공유: 데이터 export → JSON 파일 다운로드, import 가능
- 셋업: 0 (모드 선택 직후 바로 대시보드)

### 모드 2: 셀프 호스팅
- 데이터: 사용자 Supabase 프로젝트
- 키: 사용자가 `.env` 또는 Settings 화면에서 입력 (URL + anon key)
- 셋업 위저드 (5단계):
  1. **Supabase 가입 안내** (스크린샷 + 무료 가입 링크)
  2. **새 프로젝트 만들기** (스크린샷, 리전 추천)
  3. **테이블 만들기** ("아래 SQL을 SQL Editor에 붙여넣기" — 클립보드 복사 버튼)
  4. **URL + anon key 입력** (검증 → 한 번 ping 시도)
  5. **Vercel 가입 + 1-Click Deploy** (GitHub 연동 → fork → 환경변수 입력)
- 사용자에게 가장 부담스러운 부분: SQL 붙여넣기. **"무서워하지 마세요, 단어 그대로 복사·붙여넣기만 하면 돼요"**
- 셋업 끝나면 모드 1에서 입력했던 데이터가 자동으로 마이그레이션 (사용자 동의 후)

### 모드 3: 코드 받아 직접
- 셋업 화면에서 "GitHub에서 받기" 버튼 → 레포 링크 + CLAUDE.md 강조
- "이 레포 통째로 받아 Claude Code (또는 Cursor)에 던지면, AI가 당신의 결혼식에 맞춰 손봐줍니다"
- AGENTS.md에 일반적인 변경 요청 예시 10개 정도 박아둠

---

## 4. 페이지별 상세

### `/` Welcome (모드 선택)
- 처음 진입 (모드 미선택 시) 또는 Settings → "모드 다시 선택"
- 3개 카드, 모바일에서 세로로 스택
- 카드 아래에 **비교표** (사용자 요청)
- 각 카드에 "추천: 어떤 분에게" 한 줄
- 모드 1 → 즉시 대시보드
- 모드 2 → `/setup`
- 모드 3 → 외부 깃허브 링크

### `/dashboard`
- "오늘의 우선순위" (빨강·노랑·초록)
- 결혼식 D-day
- 각 페이지로 가는 카드 (체크리스트 진척도, 청첩장 미리보기 썸네일, 영상 진척도)
- 모바일에서 한 컬럼

### `/rings`
- mayrriage 카탈로그 (브랜드별 그룹) + 사용자가 추가/편집/삭제
- 각 카드에 ★(즐겨찾기) + ♥(좋아요) — 둘 다 누를 수 있음
- 각 카드 우하단 `📅 2026.05.14 기준 · 확인하기` (FreshnessBadge)
- "확인하기" → 챗봇 다리 모달 (브랜드명 + 모델 + "현재 가격" 프롬프트 생성)

### `/hotel`
- mayrriage 패턴: 호텔 1곳, OTA 15곳 가격 비교 가능
- 사용자가 호텔 추가 가능
- OTA별 링크 + 가격 + 검증 일자

### `/flights`
- 멀티시티 비교 (다구간)
- 사용자가 항공편 옵션 직접 추가
- 마일리지 메모

### `/honeymoon`
- 다국 지역 탭 (사용자가 탭 자유 추가)
- 일정 표 + 예산 + 링크

### `/checklist`
- 8개 카테고리, 카테고리별 펼치기/접기
- 우선순위 표시 (🔴🟡🟢)
- 항목 추가/완료 토글
- "마감일" 옵션

### `/invitation`
- **편집 모드**와 **미리보기 모드** 토글
- 편집 모드: 폼 (이름·날짜·시간·장소·연락처·계좌·인사말·갤러리 업로드)
- 미리보기: letter/index.html 스타일을 React 컴포넌트로 (3개국어 토글 포함)
- "공유하기": 모드 1이면 비활성화 + "공유하려면 모드 2로 전환" 안내
- OG 메타 가이드 (모드 2 deploy 시 자동 적용)

### `/video` (Stub)
- "식전영상 에디터는 letter-editor 코드를 통째로 받아 사용하세요" 안내
- 챗봇 다리: "이런 식의 5-Act 영상을 만들고 싶어요. 사진 X장이 있는데..." 같은 프롬프트 생성
- 통합 풀 에디터는 다음 페이즈

### `/setup`
- 모드 2 위저드 5단계 (위 모드 2 흐름)
- 진행률 바
- 막힐 때마다 "❓ 도움 필요하신가요?" → Contact 폼으로

### `/settings`
- 현재 모드 표시 + 변경
- 데이터 export/import (JSON)
- AI 키 입력 (Anthropic) — 선택
- 언어 (KO/EN/ZH)
- Contact / 개발자 정보

### `/contact`
- 폼: 이름, 이메일, 이슈 분류 (셀렉트), 내용
- 제출 시 `mailto:yclee913@gmail.com?subject=...&body=...` 열림
- 안내 카피: "개인적으로 만든 도구라 오류가 있을 수밖에 없어요. 부담 없이 알려주세요."
- 이전에 입력한 모드/페이지 자동 첨부 옵션

---

## 5. AI 통합 — 두 갈래

### 챗봇 다리 (기본, 비용 0)

```
사용자 행동: [지금 확인] 버튼 클릭
→ 모달 등장
→ "다음 프롬프트를 복사해서 ChatGPT나 Claude 무료 버전에 붙여넣으세요"
→ 자동 생성된 프롬프트 + [복사] 버튼
→ [ChatGPT 열기] [Claude 열기] [Gemini 열기] 외부 링크
→ "답변을 받아 아래에 붙여넣으세요" 텍스트 영역
→ 도구가 답변에서 필요한 정보 추출 + 적용
```

프롬프트 예시 (반지 가격 갱신):
```
다음 반지의 현재 한국 매장 가격을 알아봐 주세요:
- 브랜드: 티파니
- 모델: 투게더 4mm
- 소재: 플래티넘
- 다이아: 없음

답변을 JSON으로 부탁드려요:
{"price_krw": 숫자, "source": "확인한 사이트", "verified_at": "2026-05-14"}
```

### 본인 키 (Settings → AI 키 입력)

- Anthropic API 키 입력
- 입력 시 검증 (작은 ping)
- 입력 후엔 챗봇 다리 단계 생략, 도구가 직접 호출
- 비용 안내 명시: "한 번 호출에 약 $0.01"

---

## 6. 데이터 신선도 패턴

```ts
type Verifiable<T> = T & {
  lastVerified: string;   // ISO date
  source?: string;
}
```

- 각 카드에 작은 회색 글씨 `📅 YYYY.MM.DD 기준`
- 90일 지나면 노란색, 180일 지나면 빨강 (단순 휴리스틱)
- 클릭 시 챗봇 다리 모달

---

## 7. 모바일 UX 규칙

- 모든 인터랙티브 요소 최소 44×44px (Apple HIG)
- 하단 고정 탭 (대시보드·청첩장·영상·체크리스트·더보기)
- 모달은 하단 시트 (iOS 스타일)
- 폼은 한 화면에 한 그룹씩
- 사진 업로드는 카메라 + 갤러리 둘 다
- 폰트: Pretendard 또는 시스템 폰트
- 다크모드: 시스템 따라가기 (v1엔 안 함, 후속)

---

## 8. 흡수 — 무엇을 어떻게 가져올지

### mayrriage에서
- 카탈로그 데이터 (반지/호텔/항공/체크리스트) → 더미 + 사용자 편집 가능 패턴으로
- 페이지 UI 패턴 → 그대로 재구성
- 비밀번호 게이트 → 모드 2일 때만 옵션으로 제공
- 개인 데이터 (Yaechan/Sulki, 실 일정) → 전부 제거, 예시 자리에 `예: 도현 & 지윤` 같은 플레이스홀더

### letter에서
- index.html 1908줄 → React 컴포넌트로 분해
  - Hero / Greeting / Calendar / Gallery / Venue / Account / RSVP / Footer
- letter-editor의 핵심 — `VideoConfig` 타입과 자연어 편집 패턴은 schema.ts로 흡수
- 영상 렌더는 letter-editor 레포 코드로 안내(`/video` Stub)
- RSVP 폼은 모드 2에서만 작동 (Supabase 테이블)

---

## 9. 위험 + 대응

| 위험 | 가능성 | 영향 | 대응 |
|---|---|---|---|
| 사용자가 SQL 붙여넣기 실패 | 높음 | 모드 2 막힘 | 한 줄씩 끊어 보여주기 + 단계별 검증 버튼 + 영상 가이드 |
| Supabase 키 노출 | 중간 | 정보 노출 | anon key만 사용 + RLS 강제 SQL + "절대 service_role 키 쓰지 마세요" 경고 |
| localStorage 손실 | 중간 | 사용자 작업 손실 | 자동 export 권유 (24h마다 백업 다운로드 알림) |
| 모드 1 → 2 전환 시 충돌 | 중간 | 데이터 손상 | 명시적 import 단계, 자동 merge 안 함 |
| AI 답변 파싱 실패 | 높음 | UX 짜증 | 답변에서 JSON 못 찾으면 "원시 답변" 그대로 보여주고 사용자가 직접 필드 채우게 |
| 이메일 폼이 mailto:로 안 열리는 환경 | 낮음 | 연락 못 함 | 클립보드 복사 fallback + 이메일 주소 표시 |
| 사용자가 React/Vite 빌드 실패 | 중간 | 모드 3 막힘 | README에 가장 흔한 에러 3개 + 해결 |
| Vercel deploy 환경변수 실수 | 높음 | 빈 사이트 | Vercel 가이드에 스크린샷 + `VITE_SUPABASE_URL` 정확한 이름 강조 |

---

## 10. 구현 페이즈

### Phase A (이 세션 P0)
- 스캐폴드 + 라우팅 + 모드 선택 + storage 추상
- 대시보드 + 체크리스트
- Settings + Contact
- README + CLAUDE.md
- 빌드 통과

### Phase B (이 세션 P1, 시간 되면)
- 반지/호텔/항공/신혼여행 페이지 (mayrriage 흡수)
- 청첩장 빌더 + 미리보기
- 모드 2 셋업 위저드 5단계
- 챗봇 다리 helper

### Phase C (다음 세션)
- 영상 에디터 실 통합 (Remotion)
- Realtime 협업 (모드 2)
- 1-Click Vercel 버튼 + 자동 환경변수 주입
- 모바일 디테일 (햅틱, gesture)
- 다크모드

---

## 11. 검수 기준

빌드 통과 외에:
- [ ] 모드 1만으로 청첩장 미리보기 작동
- [ ] 모드 1만으로 체크리스트 항목 추가/완료/저장 (새로고침 후 유지)
- [ ] 모드 선택 후 Settings에서 다시 변경 가능
- [ ] Contact 폼 → mailto: 정상 동작
- [ ] 데이터 export JSON 다운로드 + import 복원
- [ ] 모바일 뷰포트 (375 × 667)에서 가로 스크롤 X
- [ ] 모든 페이지에 `back` 버튼 또는 하단 탭 존재
- [ ] FreshnessBadge가 90/180일 기준으로 색 바뀜
- [ ] 챗봇 다리 모달의 프롬프트 클립보드 복사 작동
- [ ] CLAUDE.md / AGENTS.md 둘 다 충분히 자세함

---

## 12. 셀프 리뷰 보강

- **면책 (Disclaimer)**: README + Welcome 화면 footer에 한 줄 — "개인적으로 만든 도구, 무보증, 본인 책임 사용"
- **모드 1 백업 알림**: 마지막 export 후 7일 지나면 대시보드 상단에 "오래 백업 안 했어요. 지금 내려받기" 노란 띠
- **Supabase service_role 경고**: 셋업 위저드 4단계 + Settings에 빨강 박스 "❗ service_role 키는 절대 입력하지 마세요. anon (public) 키만 사용하세요"
- **mailto fallback**: Contact 제출 시 1) mailto: 열기 시도, 2) 1.5초 후 응답 없으면 모달로 전환 — 이메일 주소 + 본문 + 클립보드 복사 버튼
- **Welcome 비교표**: 카드 3개 + 그 아래 비교표 (모드 / 가입 필요? / 공유? / 협업? / 비용 / 어려움). 모바일에선 표가 가로 스크롤이 아니라 카드 안에 fold-out으로

## 13. 본인을 위한 메모

- 본인이 운영하는 라이브 데모 사이트는 **모드 1 (localStorage)** 만 작동하도록.
  - 어떤 사용자 데이터도 본인 인프라에 닿지 않음
  - 모드 2/3은 안내·가이드만
- 도메인 후보: `wedding-os.app`, `weddinghub.app`, `weddingkit.app`
- 본인 라이브 데모는 `demo.weddinghub.app` 같은 식으로
- 이슈가 너무 많아지면 `https://github.com/commet/wedding-os/issues` 로 트래픽 라우팅
