-- Wedding OS — Supabase 셋업 SQL
-- ------------------------------------------------------------------
-- 사용 방법:
--   1) Supabase 프로젝트 만들기 → SQL Editor 열기
--   2) 아래 SQL 전체를 복사해서 붙여넣고 "Run" 클릭
--   3) 끝.
--
-- 안전성 메모:
--   - RLS(Row Level Security)를 켭니다.
--   - 현재 버전은 인증을 사용하지 않아서, anon key 를 가진 누구나 청첩장 row 를 읽고 쓸 수 있습니다.
--     (청첩장 URL = anon key 노출과 동일하므로 공개 게시는 권장하지 않습니다.)
--   - 다만 RSVP 와 코멘트 테이블은 권한을 좁혀, 게스트가 다른 사람의 응답을 변경/삭제하거나
--     읽을 수 없도록 INSERT 만 허용합니다. (사용자가 본인 대시보드에서 직접 조회.)
--   - 본 도구의 제작자는 사용자의 Supabase 에 접근할 수 없습니다.
-- ------------------------------------------------------------------

-- 1. 메인 데이터 테이블
create table if not exists public.wedding_data (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. RSVP 테이블 (하객 응답)
create table if not exists public.rsvp (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  side text check (side in ('groom', 'bride')),
  attending boolean not null,
  guests int default 1,
  meal text,
  message text,
  created_at timestamptz not null default now()
);

-- 3. 코멘트 / 협업 (선택)
create table if not exists public.collab_comments (
  id uuid primary key default gen_random_uuid(),
  page text not null,
  target_id text,
  author text,
  body text not null,
  resolved boolean default false,
  created_at timestamptz not null default now()
);

-- 4. RLS 켜기
alter table public.wedding_data enable row level security;
alter table public.rsvp enable row level security;
alter table public.collab_comments enable row level security;

-- 5. 정책
--    wedding_data: 단일 부부 가정 — 청첩장 표시·편집에 모두 필요해 read/write 허용.
--                  (auth 도입 시 본 정책을 owner 기반으로 교체할 것.)
drop policy if exists "wedding_data_all"    on public.wedding_data;
drop policy if exists "wedding_data_read"   on public.wedding_data;
drop policy if exists "wedding_data_write"  on public.wedding_data;
create policy "wedding_data_read"  on public.wedding_data for select using (true);
create policy "wedding_data_write" on public.wedding_data for all    using (true) with check (true);

--    rsvp: 게스트는 자기 응답을 INSERT 만 가능. SELECT/UPDATE/DELETE 는 차단.
--          → 한 명의 악의적 게스트가 다른 게스트의 응답을 보거나 지우는 걸 방지.
--          → 부부는 본인 Supabase 대시보드의 Table Editor 에서 직접 응답을 조회.
drop policy if exists "rsvp_all"        on public.rsvp;
drop policy if exists "rsvp_insert_only" on public.rsvp;
create policy "rsvp_insert_only" on public.rsvp for insert with check (true);

--    collab_comments: 동일 — 코멘트 작성만 허용, 변조·열람 차단.
drop policy if exists "collab_all"         on public.collab_comments;
drop policy if exists "collab_insert_only" on public.collab_comments;
create policy "collab_insert_only" on public.collab_comments for insert with check (true);

-- 6. updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists wedding_data_touch on public.wedding_data;
create trigger wedding_data_touch
before update on public.wedding_data
for each row execute function public.touch_updated_at();

-- 7. 기본 row 하나 (있으면 그대로 둠)
insert into public.wedding_data (id, data) values ('default', '{}'::jsonb)
on conflict (id) do nothing;

-- 완료. 이 SQL이 정상적으로 실행되면 "Success. No rows returned" 가 보입니다.
