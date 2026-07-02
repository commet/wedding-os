# CLAUDE.md — AI 도구로 이 레포 손볼 때 읽어주세요

이 파일은 Claude Code, Cursor, Aider 같은 AI 도구에게 이 레포의 의도·구조·자주 하는 변경을 설명합니다.

---

## 한 줄 요약

**Dearie** — 결혼 준비 한 도메인 통합 앱. 비개발자도 자기 결혼식에 쓸 수 있고, 개발자는 AI로 자기 식대로 손볼 수 있는 모노 앱.

---

## 핵심 설계 원칙 (절대 깨지 말 것)

1. **운영자(yclee913)는 사용자 데이터의 내용을 읽을 수 없다.** 모드 1·2·3 데이터는 본인 기기/인프라에만 저장. '간편 발행'은 운영자 서버(Vercel Blob)에 올리되 **종단간 암호화** — 복호화 키는 공유 링크의 `#` 프래그먼트에만 있어 운영자는 복호화 불가. 평문 보관은 카톡 미리보기용 이름·날짜뿐. Supabase URL/key 는 사용자 본인 것만, 본인의 키를 코드에 박지 말 것.
2. **AI 비용은 사용자가 부담한다.** 기본은 챗봇 다리(ChatGPT/Claude 복붙). 본인 API 키는 사용자가 Settings에서 입력.
3. **네 가지 모드 (local / hosted / supabase / devOnly)** 가 같은 데이터 모델을 공유. 페이지는 `useWeddingData()` 훅으로만 접근. (아래 "3단 스펙트럼" 참고)
4. **모바일 우선.** 모든 UI는 max-width 480px 기준.
5. **데이터 신선도.** 시세성 정보(반지/호텔/항공)는 `lastVerified` 필드 + FreshnessBadge 노출.
6. **둘이 같이 결정하게 돕는다.** Dearie는 단순 체크리스트가 아니라 함께 정해야 할 시점, 판단 재료, 미루면 손해 보는 일정·혜택·추가금 신호를 다루는 운영 에이전트여야 한다. 책임 추적은 전면에 두지 말고, "지금 같이 보면 좋은 결정"을 먼저 보여준다. 이 관점은 [PRODUCT_INSIGHTS.md](./PRODUCT_INSIGHTS.md) 와 [DECISION_MAP_PLAN.md](./DECISION_MAP_PLAN.md) 를 먼저 확인할 것.

---

## 3단 저장 스펙트럼 + 간편 E2E 호스팅 (2026-06 신규)

사용자는 프라이버시↔편의 스펙트럼에서 저장 방식을 고른다 (`Welcome.tsx`):

| 모드 | 뜻 | 데이터 위치 | 운영자가 읽나 |
|---|---|---|---|
| `local` | 이 기기만 | 브라우저 localStorage/IDB | 안 올라감 |
| `hosted` ⭐ | 간편 (운영자 호스팅·E2E) | 운영자 Supabase, **암호문만** | ❌ 키 없음 |
| `supabase` | 독립 (내 Supabase) | 본인 인프라 | ❌ 안 거침 |
| `devOnly` | 개발자 | — | — |

**간편(hosted) 핵심:**
- 백엔드 = 휴면 프로젝트 **sayu-db** 재활용 (Supabase 무료 2개 한도). `weddingos` 스키마 + `public.wos_*` RPC(ownerToken bcrypt). 결혼 데이터 전체를 `inviteCrypto`로 암호화해 `data` 컬럼에 암호문(`{ct,v}`)으로만 저장.
- 키 모델: `weddingId`+`ownerToken`+`weddingKey`는 secrets(localStorage)+복구링크(`/recover#w=&t=&k=`)에만. 운영자 복호화 불가.
- **로그인**(`/login`, `lib/auth.ts`): 이메일 매직링크 + 카카오·구글. *식별·복구·안심*용 — 내용 비밀과 무관. 복구번들을 passphrase로 감싸(`lib/account.ts`, PBKDF2→AES-GCM) `public.wos_accounts`(RLS 본인행)에 blob 저장. 운영자는 이메일만 알고 내용·키는 못 봄.
- 공개 청첩장·RSVP는 기존 Blob 발행(`api/invite-*`) 재사용. 풀 realtime row 구독은 쓰지 않고, 저장 성공 시 본문 없는 broadcast 갱신 신호 + 앱 복귀·네트워크 복구·90초 주기 최신화 + 충돌 안내로 수렴.

**관련 파일:** `lib/storage.hosted.ts`(암복호화 드라이버) · `lib/recovery.ts` · `lib/account.ts` · `lib/auth.ts` · `routes/HostedStart.tsx` · `routes/Recover.tsx` · `routes/Login.tsx` · `routes/Trust.tsx`(투명성) · `components/CipherPeek.tsx`.

**운영자 설정은 `DEPLOY.md` 참고** (Vercel env, Supabase Auth Redirect URLs). DB 마이그레이션은 sayu-db에 적용됨(이름 `weddingos_*`).

---

## 폴더 구조

```
src/
  App.tsx                    라우터 + 모드 가드
  main.tsx                   진입점
  routes/
    Welcome.tsx              모드 선택 화면
    Dashboard.tsx            홈 (메뉴 허브)
    Rings.tsx                반지 (이미지 중심 카드 + ★/♥)
    Sdm.tsx                  스드메 / 본식 스냅 (라우트는 /sdm, /snap 으로 분리)
    Venues.tsx               예식장 (후보 비교 · 답사)
    Trip.tsx                 신혼여행 통합 (옛 Hotel/Flights/Honeymoon 흡수)
    Checklist.tsx            체크리스트
    Ceremony.tsx             식순 (당일 진행표 · 시간·담당·음악)
    Budget.tsx               예산 · 비용
    Guests.tsx               하객 명단 · 축의금 · 식수
    Invitation.tsx           모바일 청첩장 빌더 (/invitation, /i 둘 다)
    Video.tsx                식전영상 (Remotion 기반, 라우트 lazy)
    Setup.tsx                독립(supabase) 셋업 위저드 5단계
    Settings.tsx             설정 + 백업 + 간편 로그인 상태
    HostedStart.tsx          간편 모드 시작 (자격증명 생성 + 복구 링크)
    Recover.tsx              /recover — 복구 링크로 기기교체·부부공유
    Login.tsx                /login — 이메일·카카오·구글 로그인 + 복구
    Trust.tsx                /trust — 투명성(라이브 암호화 데모)
    Contact.tsx              문의 폼
    Privacy.tsx              개인정보 처리방침
  components/
    AppShell.tsx             헤더 + 하단 탭
    Modal.tsx
    FreshnessBadge.tsx
    ChatbotBridgeModal.tsx
  lib/
    schema.ts                전체 데이터 타입
    storage.ts               useWeddingData() 훅 + 추상화
    storage.supabase.ts      Supabase 어댑터
    chatbotBridge.ts         자연어 → 프롬프트 생성 + JSON 추출
    freshness.ts             날짜 유틸
  data/
    ringsTemplate.ts         반지 카탈로그
    venueCatalog.ts          예식장 후보 카탈로그
    budgetTemplate.ts        예산 항목 템플릿
    giftCatalog.ts           답례품/선물 카탈로그
    videoTemplates.ts        식전영상 템플릿
api/
  og.js                      Vercel Node Function — 카톡 공유용 동적 OG 이미지
supabase/
  schema.sql                 사용자가 자기 DB에 돌릴 SQL
```

### 라우트 → 메뉴 매핑
하단 탭은 4개 핵심 라우트(`홈/청첩장/체크리스트/예산`) + 5번째 **`더보기`**(전체 기능 시트를 여는 버튼, `components/MenuSheet.tsx`).
그 외 모든 라우트(예식장·스드메·반지·신혼여행·영상·하객·공유·AI·설정·투명성·개인정보·문의)는 **`더보기` 시트**와 **Dashboard의 접이식 메뉴**에서 진입 — 둘 다 `lib/menu.ts` 의 `buildMenuGroups(data)` **단일 소스**를 공유.
새 라우트를 추가하면 어디서도 들어갈 수 없는 상태가 가장 흔한 사고 — `lib/menu.ts` 의 `buildMenuGroups` 에 항목을 추가할 것(그러면 시트·Dashboard 양쪽에 동시 노출됨).

---

## 자주 하는 변경 (사용자가 부탁할 만한 것)

### 1. 색상 / 테마 변경
`tailwind.config.ts` 의 `colors` 섹션을 수정하세요. 디자인 시스템:
- `cream` — 배경
- `gold` — 강조
- `sage`, `taupe` — 보조

### 2. 새 페이지 추가
1. `src/routes/MyPage.tsx` 생성, props = `{ data, update }`
2. `App.tsx` 에 `<Route path="/mypage" ... />` 추가
3. `AppShell.tsx` 의 `NAV` 배열에 추가 (하단 탭)

### 3. 새 데이터 필드 추가
`src/lib/schema.ts` 에 타입 추가. 마이그레이션이 필요하면 `storage.ts` 의 `migrate()` 함수에 분기 추가하고 `SCHEMA_VERSION` 증가.

### 4. 새 AI 기능 추가
1. `src/lib/chatbotBridge.ts` 에 새 프롬프트 함수 추가
2. 사용처에서 `ChatbotBridgeModal` 띄우기
3. 응답 받으면 `onApply` 에서 `update()` 호출해 반영

### 5. 영어/중국어 번역
`Invitation.tsx` 의 `t()` 함수 안 map 객체에 추가.

### 6. 청첩장 디자인 변경
`Invitation.tsx` 의 `Preview` 컴포넌트가 청첩장의 실제 모양. CSS/Tailwind 만 만지면 됨.

---

## 자주 하지 말아야 할 것 (안티패턴)

- ❌ 본인(개발자/제작자)의 Supabase URL/key를 코드에 박기
- ❌ 사용자 데이터를 외부 서버로 전송하기
- ❌ `service_role` key 사용 권장하기 (anon key만 사용)
- ❌ AI 호출을 본인 서버 거쳐서 하기 (사용자 키로 직접 호출)
- ❌ 모바일에서 가로 스크롤 발생시키기

---

## 빌드 / 실행

```bash
npm install
npm run dev        # 개발
npm run build      # 빌드
npm run typecheck  # 타입 체크
```

`npm run build` 가 통과해야 PR 가능.

---

## 데이터 흐름 한 페이지에

```
사용자 입력 (UI)
  ↓
update(patch) 함수 호출
  ↓
useWeddingData() 안에서:
  1. setData(next)              ← React 상태 즉시 갱신
  2. selectDriver(next).save()   ← 현재 모드에 맞는 저장소
  3. localStorage 미러 (안전망)
```

읽기는 반대로:
```
mount
  ↓
localStorage 에서 일단 로드 (모드 알아내려고)
  ↓
모드에 맞는 driver 의 load() 실행
  ↓
setData
```

---

## 모드 2 (Supabase) 흐름

- 사용자는 본인 Supabase URL + anon key 를 `Setup.tsx` 위저드에서 입력
- `supabase/schema.sql` 을 사용자가 본인 SQL Editor 에 붙여넣어 실행
- 저장은 `wedding_data` 테이블의 `data` JSONB 컬럼에 전체 객체 통째로
- 브라우저에서 직접 `select/update` 하지 말고 `load_wedding_data` / `save_wedding_data` RPC + 로컬 owner token 으로만 접근
- `/i` 공개 청첩장은 `get_public_invitation` RPC 로 invitation JSON 만 읽는다. 예산·하객·체크리스트 전체 데이터가 내려가면 안 됨

---

## 풀 영상 에디터는 어디?

지금 `/video` 는 stub. 풀 에디터는 별도 레포 `letter-editor` 에 있고, 다음 페이즈에 이 안으로 통합 예정. 이번 페이즈에선 `Video.tsx` 에서 외부 링크로 안내.

---

## 연락처

오류 발견 시 `yclee913@gmail.com` 또는 GitHub Issues.
