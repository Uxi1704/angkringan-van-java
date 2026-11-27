'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { dayKeyJakarta, formatWib, stallBrand } from '@/lib/shop'
import { Struk, type StrukData } from '@/app/components/Struk'

type Item = { menu_name: string; quantity: number; price: number; subtotal: number }
type Order = {
  id: string
  total: number
  status: string
  created_at: string
  ordered_at: string | null
  customer_name: string | null
  note: string | null
  kasir_name: string | null
  location_id: string
  locations: { name: string } | null
  order_items: Item[]
}

function asItems(value: unknown): Item[] {
  if (!Array.isArray(value)) return []
  return (value as any[]).map((row) => ({
    menu_name: String(row.menu_name || ''),
    quantity: Number(row.quantity || 0),
    price: Number(row.price || 0),
    subtotal: Number(row.subtotal || 0),
  }))
}

function jakartaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function dayRange(dateKey: string): { start: string; end: string } {
  const start = new Date(`${dateKey}T00:00:00+07:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export default function RiwayatPage() {
  const supabase = createClient()
  const router = useRouter()
  const [role, setRole] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [date, setDate] = useState(jakartaToday)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<StrukData | null>(null)

  const load = useCallback(async (selected: string) => {
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile) {
      router.push('/login')
      return
    }
    setRole(profile.role || '')

    const { start, end } = dayRange(selected)
    const baseSelect = 'id, total, status, created_at, ordered_at, customer_name, note, kasir_name, location_id, locations(name), order_items(menu_name, quantity, price, subtotal)'

    // Prefer ordered_at, fall back to created_at
    let query = supabase
      .from('orders')
      .select(baseSelect)
      .or(`and(ordered_at.gte.${start},ordered_at.lt.${end}),and(ordered_at.is.null,created_at.gte.${start},created_at.lt.${end})`)
      .neq('status', 'cancelled')
      .order('ordered_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(200)

    let { data, error: queryError } = await query

    if (queryError && /kasir_name|note/i.test(queryError.message)) {
      const slimmer = 'id, total, status, created_at, ordered_at, customer_name, location_id, locations(name), order_items(menu_name, quantity, price, subtotal)'
      const second = await supabase
        .from('orders')
        .select(slimmer)
        .or(`and(ordered_at.gte.${start},ordered_at.lt.${end}),and(ordered_at.is.null,created_at.gte.${start},created_at.lt.${end})`)
        .neq('status', 'cancelled')
        .order('ordered_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200)
      data = second.data
      queryError = second.error
    }

    if (queryError && /order_items|relationship/i.test(queryError.message)) {
      const plain = 'id, total, status, created_at, ordered_at, customer_name, location_id, locations(name)'
      const third = await supabase
        .from('orders')
        .select(plain)
        .or(`and(ordered_at.gte.${start},ordered_at.lt.${end}),and(ordered_at.is.null,created_at.gte.${start},created_at.lt.${end})`)
        .neq('status', 'cancelled')
        .order('ordered_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200)
      data = third.data
      queryError = third.error
    }

    if (queryError) setError(queryError.message)

    const rows = ((data || []) as any[]).map((row) => ({
      ...row,
      note: row.note ?? null,
      kasir_name: row.kasir_name ?? null,
      locations: Array.isArray(row.locations) ? row.locations[0] || null : row.locations,
      order_items: asItems(row.order_items),
    })) as Order[]

    setOrders(rows)
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    load(date)
  }, [date, load])

  const totalToday = useMemo(() => orders.reduce((sum, o) => sum + o.total, 0), [orders])

  function openReceipt(order: Order) {
    const when = order.ordered_at || order.created_at
    const brand = stallBrand(order.locations?.name || '')
    setReceipt({
      customer: order.customer_name || 'Tanpa nama',
      stall: brand.place,
      brand: brand.brand,
      cashier: order.kasir_name || 'Kasir',
      whenLabel: formatWib(when),
      note: order.note,
      total: order.total,
      lines: order.order_items.map((item) => ({
        name: item.menu_name,
        qty: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
    })
  }

  if (receipt) {
    return (
      <div className="mx-auto min-h-screen max-w-lg bg-paper px-4 py-5">
        <Struk data={receipt} />
        <div className="no-print mx-auto mt-4 flex max-w-xs gap-2">
          <button type="button" onClick={() => window.print()} className="h-12 flex-1 rounded-lg bg-primary font-medium text-white">Cetak</button>
          <button type="button" onClick={() => setReceipt(null)} className="h-12 flex-1 rounded-lg border bg-white font-medium">Kembali</button>
        </div>
      </div>
    )
  }

  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00+07:00`))

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary">{role === 'owner' ? 'Pemilik' : 'Kasir'}</p>
          <h1 className="text-2xl font-bold">Riwayat pesanan</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push(role === 'owner' ? '/owner/dashboard' : '/kasir/dashboard')}
          className="text-sm text-primary"
        >
          ← Kembali
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-stone-600">Pilih tanggal</span>
          <input
            type="date"
            value={date}
            max={jakartaToday()}
            onChange={(e) => setDate(e.target.value || jakartaToday())}
            className="h-11 w-full"
          />
        </label>
        <div className="pt-5 text-right text-sm">
          <p className="text-xs text-stone-500">{orders.length} transaksi</p>
          <p className="font-semibold text-primary">{totalToday.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <p className="mb-3 text-sm text-stone-600">{dateLabel}</p>

      {error ? <p className="mb-3 rounded-lg bg-white/90 px-3 py-2 text-sm text-sogan">{error}</p> : null}

      {loading ? (
        <p className="rounded-xl bg-white/90 p-4 text-sm text-stone-500">Memuat...</p>
      ) : orders.length === 0 ? (
        <p className="rounded-xl bg-white/90 p-4 text-sm text-stone-500">Tidak ada transaksi di tanggal ini.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((order) => {
            const when = order.ordered_at || order.created_at
            const brand = stallBrand(order.locations?.name || '')
            return (
              <li key={order.id} className="rounded-xl border border-ink/5 bg-white/95 px-3 py-2.5 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{order.customer_name || 'Tanpa nama'}</p>
                    <p className="text-xs text-stone-500">
                      {brand.short} · {formatWib(when)}
                    </p>
                    {order.kasir_name ? <p className="text-xs text-stone-600">Kasir: {order.kasir_name}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => openReceipt(order)}
                    className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium"
                  >
                    Struk
                  </button>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs">
                  {order.order_items.map((item, index) => (
                    <li key={index} className="flex justify-between gap-3">
                      <span className="truncate">{item.quantity} {item.menu_name}</span>
                      <span className="shrink-0">{item.subtotal.toLocaleString('id-ID')}</span>
                    </li>
                  ))}
                  {order.order_items.length === 0 ? <li className="text-stone-500">Rincian belum tersimpan.</li> : null}
                </ul>
                {order.note ? <p className="mt-1.5 text-xs text-stone-600">Catatan: {order.note}</p> : null}
                <p className="mt-1.5 text-right font-semibold">Rp {order.total.toLocaleString('id-ID')}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
