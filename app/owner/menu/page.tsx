'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { STARTER_MENUS, rupiah } from '@/lib/shop'

type Menu = {
  id: string
  name: string
  price: number
  category: string | null
  is_active: boolean
}

export default function MenuPage() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
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
    else setMenus(data || [])
    setLoading(false)
  }

  async function seed() {
    setError('')
    const existing = new Set(menus.map((menu) => menu.name.toLowerCase()))
    const missing = STARTER_MENUS.filter((menu) => !existing.has(menu.name.toLowerCase()))
    if (missing.length === 0) return
    const { error: insertError } = await supabase.from('menus').insert(missing.map((menu) => ({
      name: menu.name,
      price: menu.price,
      category: 'gorengan',
    })))
    if (insertError) setError(insertError.message)
    else await loadMenus()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !price) return
    setError('')
    const payload = { name, price: parseInt(price, 10), category: category || null }
    const result = editing
      ? await supabase.from('menus').update(payload).eq('id', editing.id)
      : await supabase.from('menus').insert(payload)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setEditing(null)
    setName('')
    setPrice('')
    setCategory('')
    await loadMenus()
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus menu ini?')) return
    const { error: deleteError } = await supabase.from('menus').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await loadMenus()
  }

  function startEdit(menu: Menu) {
    setEditing(menu)
    setName(menu.name)
    setPrice(menu.price.toString())
    setCategory(menu.category || '')
  }

  if (loading) return <div className="p-6">Memuat...</div>

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kelola menu</h1>
        <button onClick={() => router.push('/owner/dashboard')} className="text-sm text-primary">← Pantau</button>
      </div>
      {error ? <p className="mb-3 text-sm text-sogan">{error}</p> : null}
      <button type="button" onClick={seed} className="mb-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-primary">
        Isi menu awal angkringan
      </button>
      <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-xl bg-white p-4">
        <h2 className="font-semibold">{editing ? 'Edit menu' : 'Tambah menu'}</h2>
        <input type="text" placeholder="Nama menu" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2" required />
        <input type="number" placeholder="Harga" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded border px-3 py-2" required />
        <input type="text" placeholder="Kategori (opsional)" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border px-3 py-2" />
        <div className="flex gap-2">
          <button type="submit" className="rounded bg-primary px-4 py-2 text-white">{editing ? 'Update' : 'Tambah'}</button>
          {editing ? (
            <button type="button" onClick={() => { setEditing(null); setName(''); setPrice(''); setCategory('') }} className="rounded border px-4 py-2">Batal</button>
          ) : null}
        </div>
      </form>
      <div className="space-y-2">
        {menus.map((menu) => (
          <div key={menu.id} className="flex items-center justify-between rounded-xl bg-white p-4">
            <div>
              <div className="font-medium">{menu.name}</div>
              <div className="text-sm text-stone-600">{rupiah(menu.price)} {menu.category ? `· ${menu.category}` : ''}</div>
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
