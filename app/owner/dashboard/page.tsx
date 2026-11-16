'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { dayKeyJakarta, dayLabel, formatWib, rupiah, stallPlace } from '@/lib/shop'

type Location = { id: string; name: string }
type Order = {
  id: string
  total: number
  status: string
  created_at: string
  ordered_at: string | null
  customer_name: string | null
  note: string | null
  location_id: string
  locations: { name: string } | null
}

const ranges = [
  { id: 'today', label: 'Hari ini' },
  { id: '7d', label: '7 hari' },
  { id: '30d', label: '30 hari' },
  { id: 'all', label: 'Semua' },
] as const

function inRange(order: Order, range: (typeof ranges)[number]['id'], nowKey: string) {
  if (order.status === 'cancelled') return false
  const when = order.ordered_at || order.created_at
  const key = dayKeyJakarta(when)
  if (range === 'today') return key === nowKey
  if (range === '7d') return Date.now() - new Date(when).getTime() <= 7 * 86400000
  if (range === '30d') return Date.now() - new Date(when).getTime() <= 30 * 86400000
  return true
}

export default function OwnerDashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [range, setRange] = useState<(typeof ranges)[number]['id']>('30d')
  const [stall, setStall] = useState<'all' | string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'owner') {
      router.push('/kasir/dashboard')
      return
    }
    const since = new Date(Date.now() - 40 * 86400000).toISOString()
    const locQuery = supabase.from('locations').select('id, name').order('name')
    const orderQuery = supabase
      .from('orders')
      .select('id, total, status, created_at, ordered_at, customer_name, note, location_id, locations(name)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    const [locRes, orderRes] = await Promise.all([locQuery, orderQuery])
    let rows = orderRes.data as any[] | null
    let queryError = orderRes.error
    if (queryError && /note/i.test(queryError.message)) {
      const fallback = await supabase
        .from('orders')
        .select('id, total, status, created_at, ordered_at, customer_name, location_id, locations(name)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      rows = fallback.data as any[] | null
      queryError = fallback.error
    }
    if (queryError) setError(queryError.message)
    const normalized = ((rows || []) as any[]).map((row) => ({
      ...row,
      note: row.note ?? null,
      locations: Array.isArray(row.locations) ? row.locations[0] || null : row.locations,
    }))
    setLocations(locRes.data || [])
    setOrders(normalized as Order[])
    setLoading(false)
  }

  const nowKey = dayKeyJakarta(new Date().toISOString())
  const ranged = useMemo(
    () => orders.filter((order) => inRange(order, range, nowKey)),
    [orders, range, nowKey],
  )
  const filtered = useMemo(
    () => (stall === 'all' ? ranged : ranged.filter((order) => order.location_id === stall)),
    [ranged, stall],
  )

  const omzet = filtered.reduce((sum, order) => sum + order.total, 0)
  const byDay = new Map<string, { nota: number; omzet: number }>()
  for (const order of filtered) {
    const key = dayKeyJakarta(order.ordered_at || order.created_at)
    const row = byDay.get(key) || { nota: 0, omzet: 0 }
    row.nota += 1
    row.omzet += order.total
    byDay.set(key, row)
  }
  const days = Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]))

  if (loading) return <div className="p-6">Memuat...</div>

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <p className="text-xs font-medium text-primary">Pemilik</p>
      <h1 className="mb-3 text-2xl font-bold">Pantauan penjualan</h1>
      <Link href="/owner/tim" className="mb-4 flex h-14 items-center justify-center rounded-xl bg-primary text-base font-semibold text-white">
        Tambah akun kasir
      </Link>
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <Link href="/owner/menu" className="rounded-xl bg-white p-3 font-medium">Menu</Link>
        <Link href="/kasir/stok" className="rounded-xl bg-white p-3 font-medium">Stok</Link>
        <Link href="/kasir/dashboard" className="rounded-xl bg-white p-3 font-medium">Kasir</Link>
        <Link href="/owner/tim" className="rounded-xl bg-white p-3 font-medium">Akun kasir</Link>
      </div>
      <div className="mb-2 flex gap-2 overflow-x-auto">
        {ranges.map((item) => (
          <button key={item.id} type="button" onClick={() => setRange(item.id)} className={'h-10 shrink-0 rounded-full px-4 text-sm ' + (range === item.id ? 'bg-primary text-white' : 'bg-white')}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        <button type="button" onClick={() => setStall('all')} className={'h-10 shrink-0 rounded-full px-4 text-sm ' + (stall === 'all' ? 'bg-ink text-white' : 'bg-white')}>Semua lapak</button>
        {locations.map((location) => (
          <button key={location.id} type="button" onClick={() => setStall(location.id)} className={'h-10 shrink-0 rounded-full px-4 text-sm ' + (stall === location.id ? 'bg-ink text-white' : 'bg-white')}>
            {stallPlace(location.name)}
          </button>
        ))}
      </div>
      {error ? <p className="mb-3 text-sm text-sogan">{error}</p> : null}
      <section className="mb-4 rounded-xl bg-primary p-5 text-white">
        <p className="text-sm text-white/75">Omzet</p>
        <p className="text-4xl font-semibold">{rupiah(omzet)}</p>
        <p className="mt-2 text-sm text-white/80">{filtered.length} nota</p>
      </section>
      <section className="mb-4 rounded-xl bg-white p-4">
        <h2 className="text-lg font-semibold">Per lapak</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {locations.map((location) => {
            const rows = ranged.filter((order) => order.location_id === location.id)
            const sum = rows.reduce((total, order) => total + order.total, 0)
            return (
              <li key={location.id} className="flex items-center justify-between gap-3">
                <span className="font-medium">{stallPlace(location.name)}</span>
                <span className="text-stone-500">{rows.length} nota</span>
                <span>{rupiah(sum)}</span>
              </li>
            )
          })}
        </ul>
      </section>
      <section className="mb-4 rounded-xl bg-white p-4">
        <h2 className="text-lg font-semibold">Laporan {range === '30d' ? '30 hari' : 'periode ini'}</h2>
        {days.length === 0 ? <p className="mt-2 text-sm text-stone-500">Belum ada penjualan.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {days.map(([key, row]) => (
              <li key={key} className="flex justify-between gap-3">
                <span>{dayLabel(key)}</span>
                <span className="text-stone-500">{row.nota} nota</span>
                <span className="font-medium">{rupiah(row.omzet)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">Nota</h2>
        {filtered.length === 0 ? <p className="text-sm text-stone-500">Belum ada penjualan.</p> : (
          <ul className="space-y-3 text-sm">
            {filtered.slice(0, 40).map((order) => (
              <li key={order.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium">{order.customer_name || 'Tanpa nama'}</span>
                  <span className="block text-xs text-stone-500">{stallPlace(order.locations?.name || '')} · {formatWib(order.ordered_at || order.created_at)}</span>
                  {order.note ? <span className="mt-1 block text-xs text-stone-600">Catatan: {order.note}</span> : null}
                </span>
                <span className="shrink-0">{rupiah(order.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
