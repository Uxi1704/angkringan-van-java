'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { stallPlace } from '@/lib/shop'

type Location = { id: string; name: string }
type Menu = { id: string; name: string }
type Stock = { id: string; menu_id: string; location_id: string; quantity: number }

export default function StokPage() {
  const supabase = createClient()
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [locationId, setLocationId] = useState('')
  const [menus, setMenus] = useState<Menu[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [steps, setSteps] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const [{ data: locs }, { data: menuData }, { data: stockData, error: stockError }] = await Promise.all([
      supabase.from('locations').select('id, name').order('name'),
      supabase.from('menus').select('id, name').eq('is_active', true).order('name'),
      supabase.from('stocks').select('id, menu_id, location_id, quantity'),
    ])
    const nextLocs = locs || []
    setLocations(nextLocs)
    setLocationId((current) => current || nextLocs[0]?.id || '')
    setMenus(menuData || [])
    setStocks(stockData || [])
    if (stockError) setError('Tabel stok belum ada. Jalankan supabase/002_operational.sql di SQL Editor Supabase.')
    setLoading(false)
  }

  async function adjust(menuId: string, delta: number) {
    if (!locationId || delta === 0) return
    setError('')
    setPending(true)
    const existing = stocks.find((row) => row.menu_id === menuId && row.location_id === locationId)
    if (!existing) {
      const { error: insertError } = await supabase.from('stocks').insert({
        menu_id: menuId,
        location_id: locationId,
        quantity: Math.max(0, delta),
      })
      setPending(false)
      if (insertError) setError(insertError.message)
      else await load()
      return
    }
    const next = existing.quantity + delta
    if (next < 0) {
      setPending(false)
      setError('Stok tidak boleh minus.')
      return
    }
    const { error: updateError } = await supabase.from('stocks').update({ quantity: next }).eq('id', existing.id)
    setPending(false)
    if (updateError) setError(updateError.message)
    else await load()
  }

  if (loading) return <div className="p-6">Memuat...</div>

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stok tusuk</h1>
        <button onClick={() => router.push('/kasir/dashboard')} className="text-sm text-primary">← Kasir</button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {locations.map((location) => (
          <button
            key={location.id}
            type="button"
            onClick={() => setLocationId(location.id)}
            className={'rounded-xl px-3 py-3 text-left ' + (location.id === locationId ? 'bg-primary text-white' : 'bg-white')}
          >
            <span className="block text-xs opacity-80">{location.name}</span>
            <span className="font-semibold">{stallPlace(location.name)}</span>
          </button>
        ))}
      </div>
      {error ? <p className="mb-3 text-sm text-sogan">{error}</p> : null}
      <ul className="space-y-2">
        {menus.map((menu) => {
          const qty = stocks.find((row) => row.menu_id === menu.id && row.location_id === locationId)?.quantity ?? 0
          const step = Number(steps[menu.id] || '1') || 1
          return (
            <li key={menu.id} className="rounded-xl bg-white p-3">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold">{menu.name}</p>
                <p className={qty <= 5 ? 'text-sogan' : ''}>{qty} tusuk</p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" disabled={pending} onClick={() => adjust(menu.id, -step)} className="h-11 flex-1 rounded-lg border text-sm">Kurangi</button>
                <input
                  value={steps[menu.id] || '1'}
                  inputMode="numeric"
                  onChange={(e) => setSteps((current) => ({ ...current, [menu.id]: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                  className="h-11 w-16 rounded-lg border text-center"
                />
                <button type="button" disabled={pending} onClick={() => adjust(menu.id, step)} className="h-11 flex-1 rounded-lg bg-primary text-sm text-white">Tambah</button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
