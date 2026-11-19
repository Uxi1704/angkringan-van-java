'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { menuKind, menuUnit, stallPlace } from '@/lib/shop'

type Location = { id: string; name: string }
type Menu = { id: string; name: string; unit?: string | null; category?: string | null }
type Stock = { id: string; menu_id: string; location_id: string; quantity: number }

export default function StokPage() {
  const supabase = createClient()
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [locationId, setLocationId] = useState('')
  const [menus, setMenus] = useState<Menu[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState('')
  const [kind, setKind] = useState<'makanan' | 'minuman'>('makanan')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const [{ data: locs }, menuResult, { data: stockData, error: stockError }] = await Promise.all([
      supabase.from('locations').select('id, name').order('name'),
      supabase.from('menus').select('id, name, unit, category').eq('is_active', true).order('name'),
      supabase.from('stocks').select('id, menu_id, location_id, quantity'),
    ])
    let menuData = menuResult.data as Menu[] | null
    if (menuResult.error && /unit/i.test(menuResult.error.message)) {
      const plain = await supabase.from('menus').select('id, name').eq('is_active', true).order('name')
      menuData = plain.data
    }
    const nextLocs = locs || []
    setLocations(nextLocs)
    setLocationId((current) => current || nextLocs[0]?.id || '')
    setMenus(menuData || [])
    setStocks(stockData || [])
    if (stockError) setError('Tabel stok belum ada. Jalankan supabase/002_operational.sql di SQL Editor Supabase.')
    setLoading(false)
  }

  async function saveQty(menuId: string, currentQty: number) {
    if (!locationId) return
    const raw = (drafts[menuId] ?? String(currentQty)).trim()
    if (!/^\d+$/.test(raw)) {
      setError('Isi jumlah stok dengan angka.')
      return
    }
    const next = Number(raw)
    if (next > 100000) {
      setError('Stok maksimal 100.000.')
      return
    }
    setError('')
    setNotice('')
    setSaving(menuId)
    const existing = stocks.find((row) => row.menu_id === menuId && row.location_id === locationId)
    const result = existing
      ? await supabase.from('stocks').update({ quantity: next, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await supabase.from('stocks').insert({ menu_id: menuId, location_id: locationId, quantity: next })
    setSaving('')
    if (result.error) {
      setError(result.error.message)
      return
    }
    setDrafts((current) => {
      const copy = { ...current }
      delete copy[menuId]
      return copy
    })
    setNotice('Stok tersimpan.')
    await load()
  }

  if (loading) return <div className="p-6">Memuat...</div>

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stok</h1>
        <button onClick={() => router.push('/kasir/dashboard')} className="text-sm text-primary">← Kasir</button>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {locations.map((location) => (
          <button
            key={location.id}
            type="button"
            onClick={() => { setLocationId(location.id); setDrafts({}) }}
            className={'rounded-xl px-3 py-3 text-left ' + (location.id === locationId ? 'bg-primary text-white' : 'bg-white')}
          >
            <span className="block text-xs opacity-80">{location.name}</span>
            <span className="font-semibold">{stallPlace(location.name)}</span>
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm text-stone-600">Ketik jumlah yang tersisa, lalu simpan. Satuan mengikuti menu.</p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setKind('makanan')} className={'h-11 rounded-xl font-semibold ' + (kind === 'makanan' ? 'bg-ink text-white' : 'bg-white')}>Makanan</button>
        <button type="button" onClick={() => setKind('minuman')} className={'h-11 rounded-xl font-semibold ' + (kind === 'minuman' ? 'bg-ink text-white' : 'bg-white')}>Minuman</button>
      </div>
      {notice ? <p className="mb-3 text-sm text-primary">{notice}</p> : null}
      {error ? <p className="mb-3 text-sm text-sogan">{error}</p> : null}
      <ul className="space-y-2">
        {menus.filter((menu) => menuKind(menu.category) === kind).map((menu) => {
          const qty = stocks.find((row) => row.menu_id === menu.id && row.location_id === locationId)?.quantity ?? 0
          const unit = menuUnit(menu.unit)
          return (
            <li key={menu.id} className="rounded-xl bg-white p-3">
              <p className="font-semibold">{menu.name}</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  value={drafts[menu.id] ?? String(qty)}
                  onChange={(e) => setDrafts((current) => ({ ...current, [menu.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveQty(menu.id, qty) }}
                  className={'h-12 min-w-0 flex-1 rounded-lg border px-3 text-lg font-semibold ' + (qty <= 5 ? 'text-sogan' : '')}
                />
                <span className="w-16 shrink-0 text-sm text-stone-600">{unit}</span>
                <button
                  type="button"
                  disabled={saving === menu.id}
                  onClick={() => saveQty(menu.id, qty)}
                  className="h-12 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving === menu.id ? '...' : 'Simpan'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
