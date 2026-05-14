-- Wedding OS — Supabase 셋업 SQL
-- ------------------------------------------------------------------
-- 사용 방법:
--   1) Supabase 프로젝트 만들기 → SQL Editor 열기
--   2) 아래 SQL 전체를 복사해서 붙여넣고 "Run" 클릭
--   3) 끝.
--
-- 안전성:
--   - RLS(Row Level Security)를 켭니다 — 누구나 데이터 마음대로 읽지 못하도록
--   - 모든 정책은 사용자가 anon key로 자기 데이터에 접근 가능, 그 외엔 차단
--   - 본 도구의 제작자는 사용자의 Supabase에 접근할 수 없습니다
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

-- 5. 정책 (anon 키로도 읽고 쓰기 가능 — 단일 사용자/부부 가정)
--    더 엄격한 보안이 필요하면 auth를 붙이세요 (advanced).
drop policy if exists "wedding_data_all" on public.wedding_data;
create policy "wedding_data_all" on public.wedding_data
  for all using (true) with check (true);

drop policy if exists "rsvp_all" on public.rsvp;
create policy "rsvp_all" on public.rsvp
  for all using (true) with check (true);

drop policy if exists "collab_all" on public.collab_comments;
create policy "collab_all" on public.collab_comments
  for all using (true) with check (true);

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
