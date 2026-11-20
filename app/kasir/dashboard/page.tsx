'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatWib, jakartaInputNow, jakartaInputToIso, menuKind, menuUnit, rupiah, sortLocations, stallBrand } from '@/lib/shop'
import { Struk, type StrukData } from '@/app/components/Struk'
import { StallSwitch } from '@/app/components/StallSwitch'

type Menu = { id: string; name: string; price: number; unit?: string | null; category?: string | null; location_id?: string | null }
type Location = { id: string; name: string }
type Stock = { menu_id: string; location_id: string; quantity: number }

export default function KasirDashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [menus, setMenus] = useState<Menu[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [locationId, setLocationId] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [when, setWhen] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [role, setRole] = useState('')
  const [cashierName, setCashierName] = useState('Kasir')
  const [receipt, setReceipt] = useState<StrukData | null>(null)
  const [kind, setKind] = useState<'makanan' | 'minuman'>('makanan')
  const [splitReady, setSplitReady] = useState(true)

  useEffect(() => {
    setWhen(jakartaInputNow())
    load()
  }, [])

  useEffect(() => {
    if (!receipt) return
    const timer = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(timer)
  }, [receipt])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const named = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
    let profile = named.data as { role?: string; full_name?: string | null } | null
    if (named.error && /full_name/i.test(named.error.message)) {
      const plain = await supabase.from('profiles').select('role').eq('id', user.id).single()
      profile = plain.data
    }
    setRole(profile?.role || '')
    const fromEmail = (user.email || '').split('@')[0]
    setCashierName((profile?.full_name || '').trim() || fromEmail || 'Kasir')
    const [{ data: locs }, menuResult, { data: stockData, error: stockError }] = await Promise.all([
      supabase.from('locations').select('id, name').order('name'),
      supabase.from('menus').select('id, name, price, unit, category, location_id').eq('is_active', true).order('name'),
      supabase.from('stocks').select('menu_id, location_id, quantity'),
    ])
    let menuData = menuResult.data as Menu[] | null
    let menuError = menuResult.error
    if (menuError && /location_id/i.test(menuError.message)) {
      setSplitReady(false)
      const plain = await supabase.from('menus').select('id, name, price, unit, category').eq('is_active', true).order('name')
      menuData = plain.data
      menuError = plain.error
    } else {
      setSplitReady(true)
    }
    if (menuError && /unit/i.test(menuError.message)) {
      const plain = await supabase.from('menus').select('id, name, price').eq('is_active', true).order('name')
      menuData = plain.data
    }
    const nextLocs = sortLocations(locs || [])
    setLocations(nextLocs)
    setLocationId((current) => current || nextLocs[0]?.id || '')
    setMenus(menuData || [])
    setStocks(stockData || [])
    if (stockError) setError('Stok belum aktif. Jalankan supabase/002_operational.sql di SQL Editor Supabase.')
    setLoading(false)
  }

  const stallMenus = useMemo(
    () => menus.filter((menu) => !splitReady || menu.location_id === locationId),
    [menus, splitReady, locationId],
  )
  const visibleMenus = useMemo(
    () => stallMenus.filter((menu) => menuKind(menu.category) === kind),
    [stallMenus, kind],
  )
  const lines = useMemo(
    () => stallMenus.map((menu) => ({ menu, qty: cart[menu.id] || 0 })).filter((line) => line.qty > 0),
    [stallMenus, cart],
  )
  const total = lines.reduce((sum, line) => sum + line.qty * line.menu.price, 0)
  const count = lines.reduce((sum, line) => sum + line.qty, 0)
  const countLabel = useMemo(() => {
    const units = Array.from(new Set(lines.map((line) => menuUnit(line.menu.unit))))
    if (units.length === 1) return `${count} ${units[0]}`
    return `${count} item`
  }, [lines, count])

  function leftOf(menuId: string) {
    return stocks.find((row) => row.menu_id === menuId && row.location_id === locationId)?.quantity ?? 0
  }

  function setQty(menuId: string, next: number) {
    const cap = leftOf(menuId)
    setCart((current) => {
      const copy = { ...current }
      if (next <= 0) delete copy[menuId]
      else copy[menuId] = Math.min(cap, next)
      return copy
    })
  }

  async function checkout() {
    setError('')
    setNotice('')
    if (!name.trim()) {
      setError('Isi nama pelanggan dulu.')
      return
    }
    if (!locationId || lines.length === 0) {
      setError('Pilih lapak dan minimal satu menu.')
      return
    }
    let orderedAt = ''
    try {
      orderedAt = jakartaInputToIso(when)
    } catch {
      setError('Tanggal dan jam tidak valid.')
      return
    }
    setPending(true)
    const base = {
      p_location_id: locationId,
      p_customer_name: name.trim(),
      p_ordered_at: orderedAt,
      p_items: lines.map((line) => ({ menu_id: line.menu.id, quantity: line.qty })),
    }
    let { error: rpcError } = await supabase.rpc('place_order', { ...base, p_note: note.trim() || null })
    if (rpcError && /schema cache|could not find the function|p_note/i.test(rpcError.message)) {
      if (note.trim()) {
        setPending(false)
        setError('Catatan belum aktif. Jalankan supabase/003_unit_catatan.sql di SQL Editor Supabase, lalu catat lagi.')
        return
      }
      const retry = await supabase.rpc('place_order', base)
      rpcError = retry.error
    }
    setPending(false)
    if (rpcError) {
      const missing = /place_order|schema cache/i.test(rpcError.message)
      setError(missing
        ? 'Database belum siap. Jalankan file supabase/002_operational.sql di SQL Editor Supabase, lalu coba lagi.'
        : rpcError.message)
      return
    }
    const picked = stallBrand(locations.find((item) => item.id === locationId)?.name || '')
    const snapshot: StrukData = {
      customer: name.trim(),
      stall: picked.place,
      brand: picked.brand,
      cashier: cashierName,
      whenLabel: formatWib(orderedAt),
      note: note.trim(),
      lines: lines.map((line) => ({
        name: line.menu.name,
        qty: line.qty,
        unit: menuUnit(line.menu.unit),
        price: line.menu.price,
        subtotal: line.qty * line.menu.price,
      })),
      total,
    }
    setName('')
    setNote('')
    setCart({})
    setWhen(jakartaInputNow())
    setNotice('')
    setReceipt(snapshot)
    await load()
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="p-6">Memuat...</div>

  if (receipt) {
    return (
      <div className="mx-auto min-h-screen max-w-lg bg-paper px-4 py-5">
        <Struk data={receipt} />
        <div className="no-print mx-auto mt-4 flex max-w-xs gap-2">
          <button type="button" onClick={() => window.print()} className="h-12 flex-1 rounded-lg bg-primary font-medium text-white">Cetak</button>
          <button type="button" onClick={() => setReceipt(null)} className="h-12 flex-1 rounded-lg border bg-white font-medium">Pesanan baru</button>
        </div>
      </div>
    )
  }

  const current = stallBrand(locations.find((item) => item.id === locationId)?.name || '')

  return (
    <div className="no-print mx-auto min-h-screen max-w-lg px-4 pb-36 pt-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={current.logo} alt={current.short} className="h-14 w-14 rounded-full object-cover" />
          <div>
            <p className="text-xs font-medium text-primary">{current.brand}</p>
            <h1 className="text-2xl font-bold">Catat pesanan</h1>
            <p className="text-xs text-stone-500">Kasir: {cashierName} · {current.place}</p>
          </div>
        </div>
        <button onClick={logout} className="text-sm text-sogan">Keluar</button>
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/kasir/stok" className="rounded-full bg-white px-3 py-2 font-medium text-primary shadow-sm">Stok</Link>
        <Link href="/riwayat" className="rounded-full bg-white px-3 py-2 font-medium text-primary shadow-sm">Riwayat</Link>
        {role === 'owner' ? <Link href="/owner/dashboard" className="rounded-full bg-white px-3 py-2 font-medium text-primary shadow-sm">Pantau</Link> : null}
      </div>

      <StallSwitch locations={locations} value={locationId} onChange={(id) => { setLocationId(id); setCart({}) }} />
      {!splitReady ? <p className="mb-4 mt-2 text-sm text-sogan">Menu dua angkringan masih tercampur. Jalankan supabase/006_menu_per_lapak.sql sekali.</p> : <div className="mb-4" />}

      <div className="mb-4 grid gap-3">
        <label className="block text-sm">
          Nama pelanggan
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Misalnya Mas Budi" className="mt-1 h-12 w-full rounded-lg border bg-white px-3" />
        </label>
        <label className="block text-sm">
          Tanggal dan jam (WIB)
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 h-12 w-full rounded-lg border bg-white px-3" />
        </label>
        <label className="block text-sm">
          Catatan (opsional)
          <textarea
            value={note}
            maxLength={300}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Misalnya pedas, tanpa sambal"
            className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
          />
        </label>
      </div>

      {notice ? <p className="mb-3 rounded-lg bg-white px-3 py-2 text-sm text-primary">{notice}</p> : null}
      {error ? <p className="mb-3 rounded-lg bg-white px-3 py-2 text-sm text-sogan">{error}</p> : null}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setKind('makanan')} className={'h-12 rounded-xl font-semibold ' + (kind === 'makanan' ? 'bg-primary text-white' : 'bg-white')}>Makanan</button>
        <button type="button" onClick={() => setKind('minuman')} className={'h-12 rounded-xl font-semibold ' + (kind === 'minuman' ? 'bg-primary text-white' : 'bg-white')}>Minuman</button>
      </div>

      <ul className="space-y-2">
        {visibleMenus.map((menu) => {
          const qty = cart[menu.id] || 0
          const left = leftOf(menu.id)
          const unit = menuUnit(menu.unit)
          return (
            <li key={menu.id} className={'flex items-center gap-3 rounded-xl bg-white p-3 ' + (qty > 0 ? 'ring-2 ring-primary' : '')}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{menu.name}</p>
                <p className="text-sm text-stone-600">{rupiah(menu.price)} / {unit}</p>
                <p className={'text-xs ' + (left <= 5 ? 'text-sogan' : 'text-stone-500')}>{left <= 0 ? 'Habis' : `Sisa ${left} ${unit}`}</p>
              </div>
              <button type="button" disabled={qty === 0} onClick={() => setQty(menu.id, qty - 1)} className="h-11 w-11 rounded-lg border disabled:opacity-40">−</button>
              <span className="w-6 text-center font-medium">{qty}</span>
              <button type="button" disabled={left <= 0 || qty >= left} onClick={() => setQty(menu.id, qty + 1)} className="h-11 w-11 rounded-lg bg-primary text-white disabled:opacity-40">+</button>
            </li>
          )
        })}
        {visibleMenus.length === 0 ? <li className="rounded-xl bg-white p-4 text-sm">{kind === 'minuman' ? 'Belum ada minuman. Owner bisa menambah di halaman Menu.' : 'Belum ada makanan. Owner bisa menambah di halaman Menu.'}</li> : null}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-stone-500">{countLabel} · {current.short}</p>
            <p className="text-xl font-semibold">{rupiah(total)}</p>
          </div>
          <button type="button" disabled={pending || lines.length === 0} onClick={checkout} className="h-12 rounded-lg bg-primary px-4 font-medium text-white disabled:opacity-50">
            {pending ? 'Menyimpan...' : 'Cetak pesanan'}
          </button>
        </div>
      </div>
    </div>
  )
}
