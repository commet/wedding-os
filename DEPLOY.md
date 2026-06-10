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

> 로컬 개발은 이미 `.env.local`에 위 두 값이 들어가 있습니다(gitignore).

## 2. Supabase Auth 설정 (로그인)

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
`CRON_SECRET`을 설정하면 인증됩니다. 배포 시 자동 등록.

---

## 4. 배포 후 브라우저 검증 (5분)

1. `/` → "내 결혼식 준비 시작" → "링크로 같이 시작" → 복구 링크 화면 뜨는지
2. "이메일로 로그인 연결" 또는 "카카오로 계속" → 로그인 → 암호문구 설정 → "연결됨 ✓"
3. **시크릿 창**에서 `/login` → 같은 계정 로그인 → 암호문구 입력 → 대시보드에 데이터 복구되는지
4. 청첩장 → 편집 → "청첩장 발행" → 링크 생성 → 미리보기에서 "공유 →"가 그 **링크**를 주는지
5. 발행된 `/i/<code>#k=...` 링크를 다른 브라우저에서 열어 청첩장이 보이는지 + RSVP 제출 → 발행자 화면에서 RSVP 보이는지

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
- **레이트리밋**: 발행/RSVP/계정생성 엔드포인트는 익명 호출 가능 → 남용 시 Vercel **Firewall/BotID**로 방어 권장(코드 아닌 설정).
- **암호문구 분실 = 로그인 복구 불가** (영지식 E2E의 대가). 복구 링크를 백업으로 안내.
- sayu-db는 RLS 전수 잠금 완료. 남은 공개-쓰기는 Sayu 앱의 append성 테이블(views·worldcup·feedback)뿐 — 비민감.
