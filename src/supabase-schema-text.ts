// 사용자 클립보드 복사용 SQL 텍스트 (supabase/schema.sql 의 내용과 동일하게 유지할 것)
const SchemaText = `-- Wedding OS — Supabase 셋업 SQL
-- ------------------------------------------------------------------
-- 사용 방법:
--   1) Supabase 프로젝트 만들기 → SQL Editor 열기
--   2) 아래 SQL 전체를 복사해서 붙여넣고 "Run" 클릭
--   3) 끝. (옛 스키마를 이미 깐 경우에도 재실행 안전 — idempotent.)
--
-- 안전성 메모:
--   - RLS 를 켭니다.
--   - 현재 버전은 인증을 사용하지 않아서, anon key 보유자라면 누구나 청첩장 row 를 읽고 쓸 수 있습니다.
--     → 청첩장 URL 은 가까운 가족·친구에게만 공유하세요.
--   - RSVP 와 코멘트는 권한을 좁혀 게스트가 INSERT 만 가능. 다른 사람 응답을 보거나 변경할 수 없습니다.
--   - 본 도구의 제작자는 사용자의 Supabase 에 접근할 수 없습니다.
-- ------------------------------------------------------------------

create table if not exists public.wedding_data (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 옛 스키마 호환 — version 컬럼이 없으면 추가
alter table public.wedding_data add column if not exists version int not null default 1;

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

create table if not exists public.collab_comments (
  id uuid primary key default gen_random_uuid(),
  page text not null,
  target_id text,
  author text,
  body text not null,
  resolved boolean default false,
  created_at timestamptz not null default now()
);

alter table public.wedding_data enable row level security;
alter table public.rsvp enable row level security;
alter table public.collab_comments enable row level security;

-- wedding_data: 단일 부부 가정 — read/write 허용
drop policy if exists "wedding_data_all"    on public.wedding_data;
drop policy if exists "wedding_data_read"   on public.wedding_data;
drop policy if exists "wedding_data_write"  on public.wedding_data;
create policy "wedding_data_read"  on public.wedding_data for select using (true);
create policy "wedding_data_write" on public.wedding_data for all    using (true) with check (true);

-- rsvp / collab: INSERT 만 허용 (게스트 간 정보 보호)
drop policy if exists "rsvp_all"            on public.rsvp;
drop policy if exists "rsvp_insert_only"    on public.rsvp;
create policy "rsvp_insert_only"    on public.rsvp for insert with check (true);

drop policy if exists "collab_all"          on public.collab_comments;
drop policy if exists "collab_insert_only"  on public.collab_comments;
create policy "collab_insert_only"  on public.collab_comments for insert with check (true);

-- updated_at 자동 갱신 + version 자동 증가 (낙관적 동시성)
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  if new.version = old.version then
    new.version = old.version + 1;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists wedding_data_touch on public.wedding_data;
create trigger wedding_data_touch
before update on public.wedding_data
for each row execute function public.touch_updated_at();

-- wedding_data row 크기 가드 — JSONB 가 5MB 넘으면 reject (사진 base64 폭주 방지)
create or replace function public.wedding_data_size_guard()
returns trigger as $$
declare
  size_bytes int;
begin
  size_bytes := pg_column_size(new.data);
  if size_bytes > 5 * 1024 * 1024 then
    raise exception 'wedding_data 가 너무 큽니다 (% bytes). 사진을 줄이거나 일부를 삭제하세요.', size_bytes
      using errcode = 'P0001';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists wedding_data_size_check on public.wedding_data;
create trigger wedding_data_size_check
before insert or update on public.wedding_data
for each row execute function public.wedding_data_size_guard();

insert into public.wedding_data (id, data) values ('default', '{}'::jsonb)
on conflict (id) do nothing;
`;

export default SchemaText;
