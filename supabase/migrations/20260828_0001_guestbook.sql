-- 임시 사이트 방명록 초기 설정
-- Supabase Dashboard > SQL Editor에서 전체 내용을 한 번 실행합니다.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  nickname varchar(20) not null,
  content varchar(500) not null,
  is_secret boolean not null default false,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guestbook_nickname_length check (char_length(btrim(nickname)) between 1 and 20),
  constraint guestbook_content_length check (char_length(btrim(content)) between 1 and 500)
);

create index if not exists guestbook_entries_created_at_idx
  on public.guestbook_entries (created_at desc);

alter table public.guestbook_entries enable row level security;

-- 테이블을 브라우저에서 직접 읽거나 수정하지 못하게 합니다.
revoke all on table public.guestbook_entries from anon, authenticated;

create or replace function public.list_guestbook_entries(
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  nickname text,
  content text,
  is_secret boolean,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    entry.id,
    entry.nickname::text,
    case when entry.is_secret then null else entry.content::text end,
    entry.is_secret,
    entry.created_at,
    entry.updated_at,
    count(*) over() as total_count
  from public.guestbook_entries as entry
  order by entry.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.create_guestbook_entry(
  p_nickname text,
  p_content text,
  p_password text,
  p_is_secret boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  p_nickname := btrim(coalesce(p_nickname, ''));
  p_content := btrim(coalesce(p_content, ''));

  if char_length(p_nickname) not between 1 and 20 then
    raise exception '닉네임은 1자 이상 20자 이하로 입력해주세요.';
  end if;
  if char_length(p_content) not between 1 and 500 then
    raise exception '내용은 1자 이상 500자 이하로 입력해주세요.';
  end if;
  if char_length(coalesce(p_password, '')) not between 6 and 50 then
    raise exception '글 비밀번호는 6자 이상 50자 이하로 입력해주세요.';
  end if;

  insert into public.guestbook_entries (nickname, content, is_secret, password_hash)
  values (p_nickname, p_content, coalesce(p_is_secret, false), crypt(p_password, gen_salt('bf', 10)))
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.read_secret_guestbook_entry(
  p_id uuid,
  p_password text
)
returns table (content text)
language sql
security definer
set search_path = public, extensions
as $$
  select entry.content::text
  from public.guestbook_entries as entry
  where entry.id = p_id
    and entry.is_secret = true
    and entry.password_hash = crypt(coalesce(p_password, ''), entry.password_hash)
  limit 1;
$$;

create or replace function public.update_guestbook_entry(
  p_id uuid,
  p_nickname text,
  p_content text,
  p_password text,
  p_is_secret boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  changed_rows integer;
begin
  p_nickname := btrim(coalesce(p_nickname, ''));
  p_content := btrim(coalesce(p_content, ''));

  if char_length(p_nickname) not between 1 and 20 then
    raise exception '닉네임은 1자 이상 20자 이하로 입력해주세요.';
  end if;
  if char_length(p_content) not between 1 and 500 then
    raise exception '내용은 1자 이상 500자 이하로 입력해주세요.';
  end if;

  update public.guestbook_entries as entry
  set nickname = p_nickname,
      content = p_content,
      is_secret = coalesce(p_is_secret, false),
      updated_at = now()
  where entry.id = p_id
    and entry.password_hash = crypt(coalesce(p_password, ''), entry.password_hash);

  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

create or replace function public.delete_guestbook_entry(
  p_id uuid,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  changed_rows integer;
begin
  delete from public.guestbook_entries as entry
  where entry.id = p_id
    and entry.password_hash = crypt(coalesce(p_password, ''), entry.password_hash);

  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

revoke all on function public.list_guestbook_entries(integer, integer) from public;
revoke all on function public.create_guestbook_entry(text, text, text, boolean) from public;
revoke all on function public.read_secret_guestbook_entry(uuid, text) from public;
revoke all on function public.update_guestbook_entry(uuid, text, text, text, boolean) from public;
revoke all on function public.delete_guestbook_entry(uuid, text) from public;

grant execute on function public.list_guestbook_entries(integer, integer) to anon, authenticated;
grant execute on function public.create_guestbook_entry(text, text, text, boolean) to anon, authenticated;
grant execute on function public.read_secret_guestbook_entry(uuid, text) to anon, authenticated;
grant execute on function public.update_guestbook_entry(uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.delete_guestbook_entry(uuid, text) to anon, authenticated;
