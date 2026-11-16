'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { dayKeyJakarta, dayLabel, formatWib, rupiah, stallPlace } from '@/lib/shop'

type Order = {
  id: string
  total: number
  status: string
  created_at: string
  ordered_at: string | null
  customer_name: string | null
  location_id: string
  locations: { name: string } | null
}

const ranges = [
  { id: 'today', label: 'Hari ini' },
  { id: '7d', label: '7 hari' },
  { id: '30d', label: '30 hari' },
  { id: 'all', label: 'Semua' },
] as const

export default function OwnerDashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
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
    const { data, error: queryError } = await supabase
      .from('orders')
      .select('id, total, status, created_at, ordered_at, customer_name, location_id, locations(name)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    const rows = ((data || []) as any[]).map((row) => ({
      ...row,
      locations: Array.isArray(row.locations) ? row.locations[0] || null : row.locations,
    }))
    setOrders(rows as Order[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const nowKey = dayKeyJakarta(new Date().toISOString())
    return orders.filter((order) => {
      if (order.status === 'cancelled') return false
      const when = order.ordered_at || order.created_at
      const key = dayKeyJakarta(when)
      if (stall !== 'all' && order.location_id !== stall) return false
      if (range === 'today') return key === nowKey
      if (range === '7d') return Date.now() - new Date(when).getTime() <= 7 * 86400000
      if (range === '30d') return Date.now() - new Date(when).getTime() <= 30 * 86400000
      return true
    })
  }, [orders, range, stall])

  const omzet = filtered.reduce((sum, order) => sum + order.total, 0)
  const stalls = Array.from(new Map(orders.map((order) => [order.location_id, order.locations?.name || 'Lapak'])).entries())
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
      <h1 className="mb-4 text-2xl font-bold">Pantauan penjualan</h1>
      <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
        <Link href="/owner/menu" className="rounded-xl bg-white p-3 font-medium">Menu</Link>
        <Link href="/kasir/stok" className="rounded-xl bg-white p-3 font-medium">Stok</Link>
        <Link href="/kasir/dashboard" className="rounded-xl bg-white p-3 font-medium">Kasir</Link>
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
        {stalls.map(([id, name]) => (
          <button key={id} type="button" onClick={() => setStall(id)} className={'h-10 shrink-0 rounded-full px-4 text-sm ' + (stall === id ? 'bg-ink text-white' : 'bg-white')}>
            {stallPlace(name)}
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
        <ul className="space-y-2 text-sm">
          {filtered.slice(0, 40).map((order) => (
            <li key={order.id} className="flex justify-between gap-3">
              <span>
                <span className="font-medium">{order.customer_name || 'Tanpa nama'}</span>
                <span className="block text-xs text-stone-500">{stallPlace(order.locations?.name || '')} · {formatWib(order.ordered_at || order.created_at)}</span>
              </span>
              <span>{rupiah(order.total)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
