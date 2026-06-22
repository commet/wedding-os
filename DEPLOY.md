# 배포 · 운영 체크리스트 (운영자 전용)

간편(hosted) 모드 + 로그인을 켜기 위해 **운영자가 직접 해야 하는 설정**을 한 곳에 모았습니다.
코드는 전부 준비됐고, 아래 환경/대시보드 설정만 하면 됩니다.

> 백엔드: 휴면 프로젝트 **sayu-db** 재활용 (ref `hgltvdshuyfffskvjmst`, 조직 commet's Org).
> 결혼 데이터는 `weddingos` 스키마에 **암호문으로만** 저장 — 운영자도 못 읽음.

---

## 1. Vercel 환경변수 (간편 모드 연결)

Vercel 프로젝트 → Settings → Environment Variables (Production·Preview·Development 모두):

| 이름 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | `https://hgltvdshuyfffskvjmst.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (Supabase → Project Settings → API → anon public key) |
| `BLOB_READ_WRITE_TOKEN` | (Vercel Blob 토큰 — 청첩장 발행/RSVP용, 이미 있으면 그대로) |
| `CRON_SECRET` | 임의의 긴 문자열 (만료 청첩장 정리 cron 보호) |
| `ANTHROPIC_API_KEY` | 로그인 사용자용 Wedding OS AI 서버 키 |

> 로컬 개발은 이미 `.env.local`에 위 두 값이 들어가 있습니다(gitignore).

## 2. Supabase Auth 설정 (로그인)

먼저 `supabase/hosted-schema.sql`을 운영자 프로젝트 SQL Editor에서 실행합니다. 이 마이그레이션이 적용되지 않으면 간편 모드와 로그인 복구를 열면 안 됩니다.

Supabase 대시보드 → Authentication:

- **Providers → Email**: 활성 (이미 켜져 있음 — 매직링크)
- **Providers → Kakao / Google**: 이미 활성 (Sayu가 설정해둠). 그대로 사용.
- **URL Configuration**:
  - **Site URL**: 배포 도메인 (예: `https://wedding-os.vercel.app`)
  - **Redirect URLs**에 추가 (이것이 없으면 로그인 왕복이 안 됨):
    - `http://localhost:5173/login`  (로컬 개발)
    - `https://<배포도메인>/login`  (프로덕션)
- 프로덕션 메일은 Supabase 기본 발송이 rate-limit 있으니, 본격 운영 시 **Custom SMTP** 권장.

## 3. 자동 정리 cron (이미 설정됨)

`vercel.json`에 `/api/invite-cleanup` 일일 cron이 들어 있습니다 (만료된 발행 청첩장 물리 삭제).
`CRON_SECRET`이 없으면 정리 함수는 503으로 거부됩니다. Production·Preview에 반드시 설정합니다.

---

## 4. 배포 후 브라우저 검증 (5분)

1. `/` → "내 결혼식 준비 시작" → "링크로 같이 시작" → 복구 링크 화면 뜨는지
2. "이메일로 로그인 연결" 또는 "카카오로 계속" → 로그인 → 암호문구 설정 → "연결됨 ✓"
3. **시크릿 창**에서 `/login` → 같은 계정 로그인 → 암호문구 입력 → 대시보드에 데이터 복구되는지
4. 청첩장 → 편집 → "청첩장 발행" → 링크 생성 → 미리보기에서 "공유 →"가 그 **링크**를 주는지
5. 발행된 `/i/<code>#k=...` 링크를 다른 브라우저에서 열어 청첩장이 보이는지 + RSVP 제출 → 발행자 화면에서 RSVP 보이는지

## 4-1. 공개 배포 법무·운영 게이트 (코드로 대신할 수 없음)

아래 항목이 비어 있으면 불특정 사용자를 받는 프로덕션 공개를 보류합니다.

- [ ] `/privacy`에 실제 운영자 또는 사업자 명칭, 개인정보 보호 책임자, 유효한 연락처를 기재
- [ ] Vercel·Supabase·Anthropic·인증 제공자의 실제 처리 국가/리전, 이전 항목·목적·방법·보유기간을 확인해 국외이전/처리위탁 고지를 구체화
- [ ] 사용자가 배우자·혼주·하객 등 제3자의 정보를 적법하게 입력할 책임과 공개 청첩장 노출 범위를 이용 전 고지
- [ ] 개인정보 침해 사고 대응 담당자, 로그 확인·차단·통지·신고 절차와 삭제 요청 처리 기록을 문서화
- [ ] Supabase SQL Editor에서 `supabase/hosted-schema.sql` 적용 후 RLS/RPC 권한을 실제 anon·authenticated 세션으로 검증
- [ ] Vercel Production 환경에서 `CRON_SECRET`을 넣고 `/api/invite-cleanup`이 200으로 실행되는지 확인
- [ ] 운영 DB·Blob의 보존/삭제 정책과 복구 훈련을 실행하고 결과를 기록

자동 검증은 `npm run verify:release`로 실행합니다. 성공하더라도 위 수동 항목을 대체하지 않습니다.

## 5. 저장 위치 요약 (사용자 안내용)

| 모드 | 데이터 위치 | 운영자가 읽을 수 있나 |
|---|---|---|
| 이 기기만 (로컬) | 본인 브라우저 | 안 올라감 |
| 간편 (호스팅·E2E) | 운영자 Supabase, **암호문** | ❌ (키 없음) |
| 독립 | 본인 Supabase | ❌ (안 거침) |

로그인 시 운영자는 **이메일 신원**은 알지만 **내용은 못 읽음** (passphrase로 감싼 키).

---

## 알아둘 한계 / 후속

- **간편 모드 실시간 동기화 없음** (RPC-only RLS) — 부부 편집은 새로고침/재진입 시 반영 + 충돌 안내 UI.
- **남용 방지**: AI·발행은 로그인 세션, RSVP는 링크별 capability, API는 IP burst limit을 확인합니다. Vercel Firewall/BotID도 추가 방어로 켭니다.
- **암호문구 분실 = 로그인 복구 불가** (영지식 E2E의 대가). 복구 링크를 백업으로 안내.
- sayu-db는 RLS 전수 잠금 완료. 남은 공개-쓰기는 Sayu 앱의 append성 테이블(views·worldcup·feedback)뿐 — 비민감.
