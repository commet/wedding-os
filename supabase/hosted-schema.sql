-- Wedding OS operator-hosted encrypted storage.
-- Apply this migration to the operator Supabase project before enabling hosted mode.

begin;

create extension if not exists pgcrypto;
create schema if not exists weddingos;
revoke create on schema public from public;
revoke all on schema weddingos from public, anon, authenticated;

create table if not exists weddingos.weddings (
  id text primary key check (id ~ '^w[a-z2-7]{24}$'),
  data jsonb not null default '{}'::jsonb,
  owner_token_hash text not null,
  version int not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wos_weddings_created_by_idx on weddingos.weddings(created_by);

alter table weddingos.weddings enable row level security;
revoke all on weddingos.weddings from public, anon, authenticated;

create table if not exists public.wos_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blob text not null,
  salt text not null,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wos_accounts_blob_size') then
    alter table public.wos_accounts add constraint wos_accounts_blob_size check (length(blob) between 1 and 4096);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'wos_accounts_salt_size') then
    alter table public.wos_accounts add constraint wos_accounts_salt_size check (length(salt) between 1 and 256);
  end if;
end $$;

alter table public.wos_accounts enable row level security;
revoke all on public.wos_accounts from public, anon;
grant select, insert, update, delete on public.wos_accounts to authenticated;
drop policy if exists "wos_accounts_own" on public.wos_accounts;
create policy "wos_accounts_own" on public.wos_accounts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.wos_load(p_id text, p_token text)
returns table(data jsonb, version int)
language plpgsql
security definer
set search_path = public, weddingos
as $$
declare
  stored_hash text;
begin
  if p_id !~ '^w[a-z2-7]{24}$' or p_token is null or length(p_token) not between 32 and 256 then
    raise exception 'invalid credentials' using errcode = 'P0001';
  end if;
  select owner_token_hash into stored_hash from weddingos.weddings where id = p_id;
  if stored_hash is null or stored_hash <> crypt(p_token, stored_hash) then
    raise exception 'owner token mismatch' using errcode = 'P0001';
  end if;
  return query select w.data, w.version from weddingos.weddings w where w.id = p_id;
end;
$$;

create or replace function public.wos_save(
  p_id text,
  p_token text,
  p_data jsonb,
  p_expected_version int default null
)
returns table(ok boolean, version int, conflict boolean)
language plpgsql
security definer
set search_path = public, weddingos
as $$
declare
  stored_hash text;
  current_version int;
  next_version int;
begin
  if p_id !~ '^w[a-z2-7]{24}$' or p_token is null or length(p_token) not between 32 and 256 then
    raise exception 'invalid credentials' using errcode = 'P0001';
  end if;
  if pg_column_size(p_data) > 5 * 1024 * 1024 then
    raise exception 'payload too large' using errcode = 'P0001';
  end if;

  select owner_token_hash, w.version into stored_hash, current_version
  from weddingos.weddings w where w.id = p_id for update;

  if stored_hash is null then
    if auth.uid() is null then
      raise exception 'authentication required to provision wedding' using errcode = 'P0001';
    end if;
    -- Serialize quota checks for this account so parallel provisioning cannot race past the limit.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
    if (select count(*) from weddingos.weddings where created_by = auth.uid()) >= 5 then
      raise exception 'wedding quota exceeded' using errcode = 'P0001';
    end if;
    insert into weddingos.weddings(id, data, owner_token_hash, created_by)
    values (p_id, p_data, crypt(p_token, gen_salt('bf')), auth.uid())
    returning weddingos.weddings.version into next_version;
    return query select true, next_version, false;
    return;
  end if;

  if stored_hash <> crypt(p_token, stored_hash) then
    raise exception 'owner token mismatch' using errcode = 'P0001';
  end if;
  if p_expected_version is not null and current_version <> p_expected_version then
    return query select false, current_version, true;
    return;
  end if;

  update weddingos.weddings
  set data = p_data, version = weddingos.weddings.version + 1, updated_at = now()
  where id = p_id returning weddingos.weddings.version into next_version;
  return query select true, next_version, false;
end;
$$;

create or replace function public.wos_delete(p_id text, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, weddingos
as $$
declare
  stored_hash text;
begin
  if p_id !~ '^w[a-z2-7]{24}$' or p_token is null or length(p_token) not between 32 and 256 then
    raise exception 'invalid credentials' using errcode = 'P0001';
  end if;
  select owner_token_hash into stored_hash from weddingos.weddings where id = p_id for update;
  if stored_hash is null then
    return true;
  end if;
  if p_token is null or stored_hash <> crypt(p_token, stored_hash) then
    raise exception 'owner token mismatch' using errcode = 'P0001';
  end if;
  delete from weddingos.weddings where id = p_id;
  return true;
end;
$$;

revoke all on function public.wos_load(text, text) from public;
revoke all on function public.wos_save(text, text, jsonb, int) from public;
revoke all on function public.wos_delete(text, text) from public;
grant execute on function public.wos_load(text, text) to anon, authenticated;
grant execute on function public.wos_save(text, text, jsonb, int) to anon, authenticated;
grant execute on function public.wos_delete(text, text) to anon, authenticated;

commit;
