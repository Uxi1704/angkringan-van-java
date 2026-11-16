-- Satuan menu (tusuk, gelas, porsi, ...) dan catatan pesanan.
-- Jalankan sekali di Supabase → SQL Editor.

alter table public.menus add column if not exists unit text;
update public.menus set unit = 'tusuk' where unit is null or btrim(unit) = '';
alter table public.menus alter column unit set default 'tusuk';

alter table public.orders add column if not exists note text;

drop function if exists public.place_order(uuid, text, timestamptz, jsonb);
drop function if exists public.place_order(uuid, text, timestamptz, jsonb, text);

create function public.place_order(
  p_location_id uuid,
  p_customer_name text,
  p_ordered_at timestamptz,
  p_items jsonb,
  p_note text default null
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
  v_unit text;
  v_note text;
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

  v_note := nullif(left(btrim(coalesce(p_note, '')), 300), '');

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

    v_unit := coalesce(nullif(btrim(v_menu.unit), ''), 'tusuk');

    if v_left is null then
      raise exception '% belum punya stok di lapak ini', v_menu.name;
    end if;
    if v_left < v_qty then
      raise exception '% tersisa % %', v_menu.name, v_left, v_unit;
    end if;

    update public.stocks
    set quantity = quantity - v_qty, updated_at = now()
    where location_id = p_location_id and menu_id = v_menu.id;

    v_total := v_total + v_menu.price * v_qty;
  end loop;

  insert into public.orders (location_id, kasir_id, total, status, customer_name, ordered_at, note)
  values (p_location_id, v_uid, v_total, 'completed', trim(p_customer_name), coalesce(p_ordered_at, now()), v_note)
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

revoke all on function public.place_order(uuid, text, timestamptz, jsonb, text) from public;
grant execute on function public.place_order(uuid, text, timestamptz, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
