-- Schema untuk Angkringan Van Java
-- Jalankan di Supabase SQL Editor

-- 1. Tabel lokasi
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

insert into public.locations (name) values 
  ('Angkringan Van Java 1'),
  ('Angkringan Van Java 2')
on conflict (name) do nothing;

-- 2. Tabel profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'kasir' check (role in ('kasir', 'owner')),
  location_id uuid references public.locations(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Tabel menus
create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null,
  category text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Tabel orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id),
  kasir_id uuid references auth.users(id),
  total integer not null default 0,
  status text default 'completed' check (status in ('pending', 'completed', 'cancelled')),
  created_at timestamptz default now()
);

-- 5. Tabel order_items
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  menu_id uuid references public.menus(id),
  menu_name text not null,
  price integer not null,
  quantity integer not null default 1,
  subtotal integer not null
);

-- 6. Enable RLS
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.menus enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Profiles policies
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Owner can view all profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "Owner can update profiles"
on public.profiles for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  )
);

-- Locations
create policy "Locations are viewable by authenticated users"
on public.locations for select
to authenticated
using (true);

-- Menus
create policy "Menus are viewable by authenticated users"
on public.menus for select
to authenticated
using (true);

create policy "Owner can insert menus"
on public.menus for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "Owner can update menus"
on public.menus for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "Owner can delete menus"
on public.menus for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  )
);

-- Orders: kasir bisa insert order di lokasi sendiri, owner bisa lihat semua
create policy "Kasir can insert orders"
on public.orders for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'owner' or (p.role = 'kasir' and p.location_id = location_id))
  )
);

create policy "Users can view own location orders"
on public.orders for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'owner' or p.location_id = orders.location_id)
  )
);

-- Order items
create policy "Order items viewable by authenticated"
on public.order_items for select
to authenticated
using (true);

create policy "Kasir can insert order items"
on public.order_items for insert
to authenticated
with check (true);

-- Trigger profile
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
