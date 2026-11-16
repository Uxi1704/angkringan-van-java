-- Owner menambah kasir dan reset password dari website.
-- Jalankan sekali di Supabase → SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.assert_owner()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Hanya pemilik yang bisa mengatur akun';
  end if;
end;
$$;

create or replace function public.list_staff()
returns table (id uuid, email text, full_name text, role text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.assert_owner();
  return query
  select p.id, u.email::text, p.full_name, p.role
  from public.profiles p
  join auth.users u on u.id = p.id
  order by case when p.role = 'owner' then 0 else 1 end, coalesce(p.full_name, u.email::text);
end;
$$;

create or replace function public.create_kasir(
  p_email text,
  p_password text,
  p_full_name text
) returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_id uuid := gen_random_uuid();
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_name text := btrim(coalesce(p_full_name, ''));
begin
  perform public.assert_owner();
  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email tidak valid';
  end if;
  if clean_name = '' then
    raise exception 'Isi nama kasir';
  end if;
  if p_password is null or char_length(p_password) < 6 or char_length(p_password) > 72 then
    raise exception 'Password 6 sampai 72 karakter';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_id,
    'authenticated',
    'authenticated',
    clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', clean_name, 'role', 'kasir'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    new_id,
    jsonb_build_object('sub', new_id::text, 'email', clean_email, 'email_verified', true),
    'email',
    new_id::text,
    now(),
    now(),
    now()
  );

  insert into public.profiles (id, full_name, role)
  values (new_id, clean_name, 'kasir')
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = 'kasir';

  return new_id;
exception
  when unique_violation then
    raise exception 'Email ini sudah dipakai';
end;
$$;

create or replace function public.rename_kasir(p_user_id uuid, p_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := btrim(coalesce(p_full_name, ''));
begin
  perform public.assert_owner();
  if clean_name = '' then
    raise exception 'Isi nama kasir';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'kasir') then
    raise exception 'Akun kasir tidak ditemukan';
  end if;
  update public.profiles
  set full_name = left(clean_name, 80), updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.reset_kasir_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.assert_owner();
  if p_password is null or char_length(p_password) < 6 or char_length(p_password) > 72 then
    raise exception 'Password 6 sampai 72 karakter';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'kasir') then
    raise exception 'Akun kasir tidak ditemukan';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function public.assert_owner() from public, anon, authenticated;
revoke all on function public.list_staff() from public, anon;
revoke all on function public.create_kasir(text, text, text) from public, anon;
revoke all on function public.rename_kasir(uuid, text) from public, anon;
revoke all on function public.reset_kasir_password(uuid, text) from public, anon;

grant execute on function public.list_staff() to authenticated;
grant execute on function public.create_kasir(text, text, text) to authenticated;
grant execute on function public.rename_kasir(uuid, text) to authenticated;
grant execute on function public.reset_kasir_password(uuid, text) to authenticated;

notify pgrst, 'reload schema';
