-- Stok per lapak, nama pelanggan, dan jam pesanan.
-- Jalankan sekali di Supabase → SQL Editor.

alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists ordered_at timestamptz default now();

create table if not exists public.stocks (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  menu_id uuid not null references public.menus(id),
  quantity integer not null default 0 check (quantity >= 0 and quantity <= 100000),
  updated_at timestamptz default now(),
  unique (location_id, menu_id)
);

alter table public.stocks enable row level security;

drop policy if exists "Stocks readable" on public.stocks;
create policy "Stocks readable"
on public.stocks for select
to authenticated
using (true);

drop policy if exists "Stocks writable" on public.stocks;
create policy "Stocks writable"
on public.stocks for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid()))
with check (exists (select 1 from public.profiles p where p.id = auth.uid()));

drop policy if exists "Kasir can insert orders" on public.orders;
create policy "Kasir can insert orders"
on public.orders for insert
to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid()));

drop policy if exists "Users can view own location orders" on public.orders;
create policy "Users can view own location orders"
on public.orders for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'kasir')
  )
);

insert into public.menus (name, price, category)
select v.name, v.price, 'gorengan'
from (
  values
    ('Sakalop', 3000),
    ('Sayap', 7000),
    ('Otak otak', 3000),
    ('Tempura', 3000),
    ('Tahu bacem', 3000),
    ('Tempe bacem', 3000),
    ('Telor puyuh', 5000),
    ('Sosis bakar', 7000)
) as v(name, price)
where not exists (select 1 from public.menus m where m.name = v.name);

insert into public.stocks (location_id, menu_id, quantity)
select l.id, m.id, 30
from public.locations l
cross join public.menus m
on conflict (location_id, menu_id) do nothing;

create or replace function public.place_order(
  p_location_id uuid,
  p_customer_name text,
  p_ordered_at timestamptz,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order uuid;
  v_total integer := 0;
  v_item jsonb;
  v_menu public.menus%rowtype;
  v_qty integer;
  v_left integer;
begin
  if v_uid is null then
    raise exception 'Harus masuk dulu';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Profil belum ada. Buat baris di tabel profiles.';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Isi nama pelanggan';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Pilih minimal satu menu';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Jumlah tidak valid';
    end if;
    select * into v_menu
    from public.menus
    where id = (v_item->>'menu_id')::uuid and is_active = true;
    if not found then
      raise exception 'Menu tidak ditemukan';
    end if;

    select quantity into v_left
    from public.stocks
    where location_id = p_location_id and menu_id = v_menu.id
    for update;

    if v_left is null then
      raise exception '% belum punya stok di lapak ini', v_menu.name;
    end if;
    if v_left < v_qty then
      raise exception '% tersisa % tusuk', v_menu.name, v_left;
    end if;

    update public.stocks
    set quantity = quantity - v_qty, updated_at = now()
    where location_id = p_location_id and menu_id = v_menu.id;

    v_total := v_total + v_menu.price * v_qty;
  end loop;

  insert into public.orders (location_id, kasir_id, total, status, customer_name, ordered_at)
  values (p_location_id, v_uid, v_total, 'completed', trim(p_customer_name), coalesce(p_ordered_at, now()))
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_menu from public.menus where id = (v_item->>'menu_id')::uuid;
    insert into public.order_items (order_id, menu_id, menu_name, price, quantity, subtotal)
    values (v_order, v_menu.id, v_menu.name, v_menu.price, v_qty, v_menu.price * v_qty);
  end loop;

  return v_order;
end;
$$;

revoke all on function public.place_order(uuid, text, timestamptz, jsonb) from public;
grant execute on function public.place_order(uuid, text, timestamptz, jsonb) to authenticated;
