'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { STARTER_DRINKS, STARTER_MENUS, menuKind, menuUnit, rupiah, sortLocations, stallBrand } from '@/lib/shop'
import { StallSwitch } from '@/app/components/StallSwitch'

type Menu = {
  id: string
  name: string
  price: number
  category: string | null
  is_active: boolean
  unit?: string | null
  location_id?: string | null
}

type Location = { id: string; name: string }

const unitIdeas = ['tusuk', 'gelas', 'porsi', 'bungkus', 'pcs']
const splitMessage = 'Menu masih tercampur. Buka Supabase → SQL Editor, jalankan supabase/006_menu_per_lapak.sql sekali, lalu muat ulang.'

export default function MenuPage() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [locationId, setLocationId] = useState('')
  const [splitReady, setSplitReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState('tusuk')
  const [kind, setKind] = useState<'makanan' | 'minuman'>('makanan')
  const [editing, setEditing] = useState<Menu | null>(null)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const brand = stallBrand(locations.find((item) => item.id === locationId)?.name || '')

  useEffect(() => { loadMenus() }, [])

  async function loadMenus(nextLocationId?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { data: locs } = await supabase.from('locations').select('id, name')
    const nextLocs = sortLocations(locs || [])
    const chosen = nextLocationId || locationId || nextLocs[0]?.id || ''
    setLocations(nextLocs)
    setLocationId(chosen)
    const scoped = await supabase.from('menus').select('*').eq('location_id', chosen).order('name')
    if (scoped.error && /location_id/i.test(scoped.error.message)) {
      setSplitReady(false)
      const all = await supabase.from('menus').select('*').order('name')
      if (all.error) setError(all.error.message)
      else setMenus((all.data || []).filter((menu) => menu.is_active !== false))
    } else if (scoped.error) {
      setError(scoped.error.message)
    } else {
      setSplitReady(true)
      setMenus((scoped.data || []).filter((menu) => menu.is_active !== false))
    }
    setLoading(false)
  }

  function explain(message: string) {
    if (/location_id/i.test(message)) return splitMessage
    if (/unit/i.test(message)) return 'Satuan belum aktif. Jalankan supabase/003_unit_catatan.sql di SQL Editor Supabase.'
    return message
  }

  async function seedStall() {
    if (!splitReady || !locationId) {
      setError(splitMessage)
      return
    }
    setError('')
    const { data: existingRows } = await supabase.from('menus').select('name').eq('location_id', locationId)
    const existing = new Set((existingRows || []).map((menu) => String(menu.name || '').toLowerCase()))
    const missing = [
      ...STARTER_MENUS.filter((menu) => !existing.has(menu.name.toLowerCase())).map((menu) => ({
        name: menu.name, price: menu.price, category: 'makanan', unit: 'tusuk', location_id: locationId, is_active: true,
      })),
      ...STARTER_DRINKS.filter((menu) => !existing.has(menu.name.toLowerCase())).map((menu) => ({
        name: menu.name, price: menu.price, category: 'minuman', unit: 'gelas', location_id: locationId, is_active: true,
      })),
    ]
    if (missing.length === 0) return
    const inserted = await supabase.from('menus').insert(missing).select('id')
    if (inserted.error) {
      setError(explain(inserted.error.message))
      return
    }
    if (inserted.data?.length) {
      await supabase.from('stocks').insert(inserted.data.map((row) => ({
        menu_id: row.id, location_id: locationId, quantity: 0,
      })))
    }
    await loadMenus(locationId)
  }

  function pickKind(next: 'makanan' | 'minuman') {
    setKind(next)
    if (next === 'minuman' && unit === 'tusuk') setUnit('gelas')
    if (next === 'makanan' && unit === 'gelas') setUnit('tusuk')
  }

  function resetForm() {
    setEditing(null)
    setName('')
    setPrice('')
    setUnit('tusuk')
    setKind('makanan')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !price || !unit.trim()) return
    if (!splitReady || !locationId) {
      setError(splitMessage)
      return
    }
    setError('')
    const payload = {
      name,
      price: parseInt(price, 10),
      category: kind,
      unit: unit.trim().slice(0, 20),
      is_active: true,
      location_id: locationId,
    }
    const result = editing
      ? await supabase.from('menus').update(payload).eq('id', editing.id).select('id')
      : await supabase.from('menus').insert(payload).select('id')
    if (result.error) {
      setError(explain(result.error.message))
      return
    }
    if (!result.data || result.data.length === 0) {
      setError('Menu tidak tersimpan. Masuk sebagai owner, lalu coba lagi.')
      return
    }
    if (!editing && result.data[0]) {
      await supabase.from('stocks').insert({ menu_id: result.data[0].id, location_id: locationId, quantity: 0 })
    }
    resetForm()
    await loadMenus(locationId)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus menu ini dari lapak yang sedang dipilih?')) return
    setError('')
    await supabase.from('stocks').delete().eq('menu_id', id)
    const { data, error: hideError } = await supabase.from('menus').update({ is_active: false }).eq('id', id).select('id')
    if (hideError) {
      setError(hideError.message)
      return
    }
    if (!data || data.length === 0) {
      setError('Menu tidak terhapus. Masuk sebagai owner, lalu coba lagi.')
      return
    }
    if (editing?.id === id) resetForm()
    setMenus((current) => current.filter((menu) => menu.id !== id))
  }

  function startEdit(menu: Menu) {
    setEditing(menu)
    setName(menu.name)
    setPrice(menu.price.toString())
    setUnit(menuUnit(menu.unit))
    setKind(menuKind(menu.category))
    if (menuKind(menu.category) === 'minuman' && menuUnit(menu.unit) === 'tusuk') setUnit('gelas')
  }

  const visible = menus.filter((menu) => menuKind(menu.category) === kind)

  if (loading) return <div className="p-6">Memuat...</div>

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-sogan">Kelola menu</p>
          <h1 className="text-2xl">Pilih angkringan</h1>
        </div>
        <button onClick={() => router.push('/owner/dashboard')} className="text-sm text-primary">← Pantau</button>
      </div>
      <StallSwitch
        locations={locations}
        value={locationId}
        onChange={(id) => { resetForm(); loadMenus(id) }}
      />
      <p className="mb-4 mt-2 text-sm text-stone-600">
        {splitReady
          ? `Yang tampil hanya menu ${brand.short}. Lapak lain tidak ikut.`
          : 'Tiap angkringan akan punya daftar sendiri setelah SQL dijalankan.'}
      </p>
      {!splitReady ? <p className="mb-3 rounded-xl bg-white p-3 text-sm text-sogan">{splitMessage}</p> : null}
      {error ? <p className="mb-3 text-sm text-sogan">{error}</p> : null}
      <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">{editing ? `Edit menu ${brand.short}` : `Tambah menu ${brand.short}`}</h2>
        <input type="text" placeholder="Nama menu" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2" required />
        <input type="number" placeholder="Harga" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded border px-3 py-2" required />
        <div>
          <p className="mb-2 text-sm">Satuan</p>
          <div className="mb-2 flex flex-wrap gap-2">
            {unitIdeas.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setUnit(idea)}
                className={'rounded-full px-3 py-1 text-sm ' + (unit === idea ? 'bg-primary text-white' : 'bg-paper')}
              >
                {idea}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Atau ketik satuan lain" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded border px-3 py-2" required />
        </div>
        <div>
          <p className="mb-2 text-sm">Jenis</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => pickKind('makanan')} className={'h-11 rounded-lg font-medium ' + (kind === 'makanan' ? 'bg-primary text-white' : 'bg-paper')}>Makanan</button>
            <button type="button" onClick={() => pickKind('minuman')} className={'h-11 rounded-lg font-medium ' + (kind === 'minuman' ? 'bg-primary text-white' : 'bg-paper')}>Minuman</button>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded bg-primary px-4 py-2 text-white">{editing ? 'Update' : 'Tambah'}</button>
          {editing ? <button type="button" onClick={resetForm} className="rounded border px-4 py-2">Batal</button> : null}
        </div>
      </form>
      <div className="space-y-2">
        {visible.map((menu) => (
          <div key={menu.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
            <div>
              <div className="font-medium">{menu.name}</div>
              <div className="text-sm text-stone-600">{rupiah(menu.price)} · {menuUnit(menu.unit)} · {menuKind(menu.category) === 'minuman' ? 'Minuman' : 'Makanan'}</div>
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={() => startEdit(menu)} className="text-primary">Edit</button>
              <button onClick={() => handleDelete(menu.id)} className="text-sogan">Hapus</button>
            </div>
          </div>
        ))}
        {visible.length === 0 ? <p className="rounded-2xl bg-white py-4 text-center text-sm text-stone-500">Belum ada {kind} di {brand.short}</p> : null}
      </div>
      <button type="button" onClick={seedStall} className="mt-4 w-full rounded-xl bg-white px-3 py-3 text-sm font-medium text-primary shadow-sm">
        Isi menu awal {brand.short}
      </button>
    </div>
  )
}
