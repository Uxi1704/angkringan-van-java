-- Schema untuk Angkringan Van Java
-- Jalankan di Supabase SQL Editor

-- 1. Tabel lokasi
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- 'Van Java 1', 'Van Java 2'
  created_at timestamptz default now()
);

insert into public.locations (name) values 
  ('Angkringan Van Java 1'),
  ('Angkringan Van Java 2')
on conflict (name) do nothing;

-- 2. Tabel profiles (extend dari auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'kasir' check (role in ('kasir', 'owner')),
  location_id uuid references public.locations(id), -- null untuk owner (bisa akses semua)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Enable RLS
alter table public.profiles enable row level security;
alter table public.locations enable row level security;

-- 4. Policies untuk profiles
-- User bisa lihat profile sendiri
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

-- Owner bisa lihat semua profiles
create policy "Owner can view all profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  )
);

-- Hanya owner yang bisa update role/location (opsional, bisa disesuaikan)
create policy "Owner can update profiles"
on public.profiles for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  )
);

-- 5. Trigger otomatis buat profile saat user baru daftar
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, location_id)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'kasir'),
    (new.raw_user_meta_data->>'location_id')::uuid
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. Locations bisa dibaca semua authenticated user
create policy "Locations are viewable by authenticated users"
on public.locations for select
to authenticated
using (true);
