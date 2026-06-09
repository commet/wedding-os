// 사용자 클립보드 복사용 SQL 텍스트 (supabase/schema.sql 의 내용과 동일하게 유지할 것)
const SchemaText = `-- Wedding OS — Supabase 셋업 SQL
-- ------------------------------------------------------------------
-- 사용 방법:
--   1) Supabase 프로젝트 만들기 → SQL Editor 열기
--   2) 아래 SQL 전체를 복사해서 붙여넣고 "Run" 클릭
--   3) 끝.
--
-- 안전성 메모:
--   - RLS(Row Level Security)를 켭니다.
--   - 공개 청첩장은 invitation JSON 만 읽습니다. 예산·하객·체크리스트는 공개 응답에 포함되지 않습니다.
--   - 전체 데이터 읽기/쓰기는 앱이 로컬에 보관하는 owner token 을 RPC 에 전달할 때만 허용합니다.
--   - RSVP 와 코멘트 테이블은 게스트가 INSERT 만 가능. 다른 사람 응답을 보거나 변경할 수 없습니다.
--   - 본 도구의 제작자는 사용자의 Supabase 에 접근할 수 없습니다.
-- ------------------------------------------------------------------

create extension if not exists pgcrypto;

-- 1. 메인 데이터 테이블
create table if not exists public.wedding_data (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  owner_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 옛 스키마 호환 — version 컬럼이 없으면 추가.
alter table public.wedding_data add column if not exists version int not null default 1;
alter table public.wedding_data add column if not exists owner_token_hash text;

-- 2. RSVP 테이블 (하객 응답)
create table if not exists public.rsvp (
  id uuid primary key default gen_random_uuid(),
  config_id text not null default 'default',
  name text not null,
  side text check (side in ('groom', 'bride')),
  attending boolean not null,
  guests int default 1,
  meal text,
  message text,
  created_at timestamptz not null default now()
);

alter table public.rsvp add column if not exists config_id text not null default 'default';
create index if not exists rsvp_config_created_idx on public.rsvp (config_id, created_at desc);

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
--    wedding_data: 직접 SELECT/UPDATE 는 막고, 아래 SECURITY DEFINER RPC 로만 접근합니다.
drop policy if exists "wedding_data_all"    on public.wedding_data;
drop policy if exists "wedding_data_read"   on public.wedding_data;
drop policy if exists "wedding_data_write"  on public.wedding_data;

--    rsvp: 게스트는 자기 응답을 INSERT 만 가능. SELECT/UPDATE/DELETE 는 차단.
--          → 한 명의 악의적 게스트가 다른 게스트의 응답을 보거나 지우는 걸 방지.
--          → 부부는 owner token 으로 list_rsvp RPC 를 통해 앱에서 응답을 조회
--            (Supabase 대시보드의 Table Editor 에서도 직접 볼 수 있음).
drop policy if exists "rsvp_all"        on public.rsvp;
drop policy if exists "rsvp_insert_only" on public.rsvp;
create policy "rsvp_insert_only" on public.rsvp for insert with check (true);

--    collab_comments: 동일 — 코멘트 작성만 허용, 변조·열람 차단.
drop policy if exists "collab_all"         on public.collab_comments;
drop policy if exists "collab_insert_only" on public.collab_comments;
create policy "collab_insert_only" on public.collab_comments for insert with check (true);

-- 5-1. 공개/오너 RPC
create or replace function public.ensure_wedding_owner(p_id text, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_hash text;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'owner token required' using errcode = 'P0001';
  end if;

  insert into public.wedding_data (id, data, owner_token_hash)
  values (p_id, '{}'::jsonb, crypt(p_token, gen_salt('bf')))
  on conflict (id) do nothing;

  select owner_token_hash into existing_hash
  from public.wedding_data
  where id = p_id
  for update;

  if existing_hash is null then
    update public.wedding_data
    set owner_token_hash = crypt(p_token, gen_salt('bf'))
    where id = p_id;
    return;
  end if;

  if existing_hash <> crypt(p_token, existing_hash) then
    raise exception 'owner token mismatch' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.load_wedding_data(p_id text default 'default', p_token text default null)
returns table(data jsonb, version int)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_wedding_owner(p_id, p_token);

  return query
  select w.data, w.version
  from public.wedding_data w
  where w.id = p_id;
end;
$$;

create or replace function public.save_wedding_data(
  p_id text default 'default',
  p_token text default null,
  p_data jsonb default '{}'::jsonb,
  p_expected_version int default null
)
returns table(ok boolean, version int, conflict boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_version int;
  next_version int;
begin
  perform public.ensure_wedding_owner(p_id, p_token);

  select w.version into current_version
  from public.wedding_data w
  where w.id = p_id
  for update;

  if p_expected_version is not null and current_version is not null and current_version <> p_expected_version then
    return query select false, current_version, true, 'version conflict';
    return;
  end if;

  update public.wedding_data
  set data = p_data,
      updated_at = now()
  where id = p_id
  returning public.wedding_data.version into next_version;

  return query select true, next_version, false, null::text;
end;
$$;

create or replace function public.get_public_invitation(p_id text default 'default')
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(data->'invitation', '{}'::jsonb)
  from public.wedding_data
  where id = p_id
$$;

create or replace function public.list_rsvp(p_id text default 'default', p_token text default null)
returns table(
  id uuid,
  name text,
  side text,
  attending boolean,
  guests int,
  meal text,
  message text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_wedding_owner(p_id, p_token);

  return query
  select r.id, r.name, r.side, r.attending, r.guests, r.meal, r.message, r.created_at
  from public.rsvp r
  where r.config_id = p_id
  order by r.created_at desc;
end;
$$;

grant execute on function public.load_wedding_data(text, text) to anon, authenticated;
grant execute on function public.save_wedding_data(text, text, jsonb, int) to anon, authenticated;
grant execute on function public.get_public_invitation(text) to anon, authenticated;
grant execute on function public.list_rsvp(text, text) to anon, authenticated;

-- 6. updated_at 자동 갱신 + version 자동 증가 (낙관적 동시성)
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  -- 클라이언트가 version 을 명시했고 그대로 두면 server-side 에서 +1.
  -- 클라이언트가 OLD.version 을 보내고 우리가 검증할 때, 통과 시 자동 증가.
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

-- 7. wedding_data row 크기 가드 — JSONB 가 폭주하면 동기화 느려지고 비용 ↑.
--   사진을 base64 로 박으면 금방 커지므로 5MB 한도 (대형 갤러리 + 안전 마진).
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

-- 8. 기본 row 하나 (있으면 그대로 둠)
insert into public.wedding_data (id, data) values ('default', '{}'::jsonb)
on conflict (id) do nothing;

-- 완료. 이 SQL이 정상적으로 실행되면 "Success. No rows returned" 가 보입니다.
`;

export default SchemaText;
