'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatWib, stallPlace } from '@/lib/shop'
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

export default function RiwayatPage() {
  const supabase = createClient()
  const router = useRouter()
  const [role, setRole] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [range, setRange] = useState<'today' | 'all'>('today')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<StrukData | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
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
    const withItems = 'id, total, status, created_at, ordered_at, customer_name, note, kasir_name, location_id, locations(name), order_items(menu_name, quantity, price, subtotal)'
    let result = await supabase.from('orders').select(withItems).order('created_at', { ascending: false }).limit(80)
    if (result.error && /kasir_name|note/i.test(result.error.message)) {
      const slimmer = 'id, total, status, created_at, ordered_at, customer_name, location_id, locations(name), order_items(menu_name, quantity, price, subtotal)'
      result = await supabase.from('orders').select(slimmer).order('created_at', { ascending: false }).limit(80)
    }
    if (result.error && /order_items|relationship/i.test(result.error.message)) {
      const plain = 'id, total, status, created_at, ordered_at, customer_name, location_id, locations(name)'
      result = await supabase.from('orders').select(plain).order('created_at', { ascending: false }).limit(80)
    }
    if (result.error) setError(result.error.message)
    const rows = ((result.data || []) as any[]).map((row) => ({
      ...row,
      note: row.note ?? null,
      kasir_name: row.kasir_name ?? null,
      locations: Array.isArray(row.locations) ? row.locations[0] || null : row.locations,
      order_items: asItems(row.order_items),
    })) as Order[]
    setOrders(rows.filter((order) => order.status !== 'cancelled'))
    setLoading(false)
  }

  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const visible = orders.filter((order) => {
    if (range === 'all') return true
    const when = order.ordered_at || order.created_at
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(when))
    return key === todayKey
  })

  function openReceipt(order: Order) {
    const when = order.ordered_at || order.created_at
    setReceipt({
      customer: order.customer_name || 'Tanpa nama',
      stall: stallPlace(order.locations?.name || ''),
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

  if (loading) return <div className="p-6">Memuat...</div>

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
      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setRange('today')} className={'h-10 rounded-full px-4 text-sm ' + (range === 'today' ? 'bg-primary text-white' : 'bg-white')}>Hari ini</button>
        <button type="button" onClick={() => setRange('all')} className={'h-10 rounded-full px-4 text-sm ' + (range === 'all' ? 'bg-primary text-white' : 'bg-white')}>Semua</button>
      </div>
      {error ? <p className="mb-3 rounded-lg bg-white px-3 py-2 text-sm text-sogan">{error}</p> : null}
      {visible.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-stone-500">Belum ada pesanan.</p> : (
        <ul className="space-y-3">
          {visible.map((order) => {
            const when = order.ordered_at || order.created_at
            return (
              <li key={order.id} className="rounded-xl bg-white p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{order.customer_name || 'Tanpa nama'}</p>
                    <p className="text-xs text-stone-500">{stallPlace(order.locations?.name || '')} · {formatWib(when)}</p>
                    {order.kasir_name ? <p className="text-xs text-stone-600">Kasir: {order.kasir_name}</p> : null}
                  </div>
                  <button type="button" onClick={() => openReceipt(order)} className="shrink-0 rounded-lg border px-3 py-2 text-xs font-medium">Struk</button>
                </div>
                <ul className="mt-3 space-y-1">
                  {order.order_items.map((item, index) => (
                    <li key={index} className="flex justify-between gap-3">
                      <span>{item.quantity} {item.menu_name}</span>
                      <span>{item.subtotal.toLocaleString('id-ID')}</span>
                    </li>
                  ))}
                  {order.order_items.length === 0 ? <li className="text-stone-500">Rincian menu belum tersimpan.</li> : null}
                </ul>
                {order.note ? <p className="mt-2 text-xs text-stone-600">Catatan: {order.note}</p> : null}
                <p className="mt-2 text-right font-semibold">Rp {order.total.toLocaleString('id-ID')}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
