'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { STARTER_DRINKS, STARTER_MENUS, menuKind, menuUnit, rupiah } from '@/lib/shop'

type Menu = {
  id: string
  name: string
  price: number
  category: string | null
  is_active: boolean
  unit?: string | null
}

const unitIdeas = ['tusuk', 'gelas', 'porsi', 'bungkus', 'pcs']

export default function MenuPage() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState('tusuk')
  const [kind, setKind] = useState<'makanan' | 'minuman'>('makanan')
  const [editing, setEditing] = useState<Menu | null>(null)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { loadMenus() }, [])

  async function loadMenus() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { data, error: queryError } = await supabase.from('menus').select('*').order('name')
    if (queryError) setError(queryError.message)
    else setMenus((data || []).filter((menu) => menu.is_active !== false))
    setLoading(false)
  }

  function explain(message: string) {
    if (/unit/i.test(message)) {
      return 'Satuan belum aktif. Jalankan supabase/003_unit_catatan.sql di SQL Editor Supabase.'
    }
    return message
  }

  async function takenNames() {
    const { data } = await supabase.from('menus').select('name')
    return new Set((data || []).map((menu) => String(menu.name || '').toLowerCase()))
  }

  async function seed() {
    setError('')
    const existing = await takenNames()
    const missing = STARTER_MENUS.filter((menu) => !existing.has(menu.name.toLowerCase()))
    if (missing.length === 0) return
    const { error: insertError } = await supabase.from('menus').insert(missing.map((menu) => ({
      name: menu.name,
      price: menu.price,
      category: 'makanan',
      unit: 'tusuk',
    })))
    if (insertError) setError(explain(insertError.message))
    else await loadMenus()
  }

  async function seedDrinks() {
    setError('')
    const existing = await takenNames()
    const missing = STARTER_DRINKS.filter((menu) => !existing.has(menu.name.toLowerCase()))
    if (missing.length === 0) return
    const { error: insertError } = await supabase.from('menus').insert(missing.map((menu) => ({
      name: menu.name,
      price: menu.price,
      category: 'minuman',
      unit: 'gelas',
    })))
    if (insertError) setError(explain(insertError.message))
    else await loadMenus()
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
    setError('')
    const payload = {
      name,
      price: parseInt(price, 10),
      category: kind,
      unit: unit.trim().slice(0, 20),
      is_active: true,
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
    resetForm()
    await loadMenus()
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus menu ini?')) return
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

  if (loading) return <div className="p-6">Memuat...</div>

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kelola menu</h1>
        <button onClick={() => router.push('/owner/dashboard')} className="text-sm text-primary">← Pantau</button>
      </div>
      {error ? <p className="mb-3 text-sm text-sogan">{error}</p> : null}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={seed} className="rounded-lg bg-white px-3 py-3 text-sm font-medium text-primary">Isi menu makanan</button>
        <button type="button" onClick={seedDrinks} className="rounded-lg bg-white px-3 py-3 text-sm font-medium text-primary">Isi menu minuman</button>
      </div>
      <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-xl bg-white p-4">
        <h2 className="font-semibold">{editing ? 'Edit menu' : 'Tambah menu'}</h2>
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
          {editing ? (
            <button type="button" onClick={resetForm} className="rounded border px-4 py-2">Batal</button>
          ) : null}
        </div>
      </form>
      <div className="space-y-2">
        {menus.map((menu) => (
          <div key={menu.id} className="flex items-center justify-between rounded-xl bg-white p-4">
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
        {menus.length === 0 ? <p className="py-4 text-center text-stone-500">Belum ada menu</p> : null}
      </div>
    </div>
  )
}
