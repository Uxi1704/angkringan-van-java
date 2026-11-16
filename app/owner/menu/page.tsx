'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadMenus()
  }, [])

  async function loadMenus() {
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) setMenus(data)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !price) return

    if (editing) {
      await supabase
        .from('menus')
        .update({
          name,
          price: parseInt(price),
          category: category || null,
        })
        .eq('id', editing.id)
      setEditing(null)
    } else {
      await supabase.from('menus').insert({
        name,
        price: parseInt(price),
        category: category || null,
      })
    }

    setName('')
    setPrice('')
    setCategory('')
    loadMenus()
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus menu ini?')) return
    await supabase.from('menus').delete().eq('id', id)
    loadMenus()
  }

  function startEdit(menu: Menu) {
    setEditing(menu)
    setName(menu.name)
    setPrice(menu.price.toString())
    setCategory(menu.category || '')
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Kelola Menu</h1>
        <button onClick={() => router.push('/owner/dashboard')} className="text-sm text-blue-600">
          ← Dashboard
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow mb-6 space-y-3">
        <h2 className="font-semibold">{editing ? 'Edit Menu' : 'Tambah Menu'}</h2>
        <input
          type="text"
          placeholder="Nama menu"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="number"
          placeholder="Harga"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="text"
          placeholder="Kategori (opsional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        <div className="flex gap-2">
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
            {editing ? 'Update' : 'Tambah'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setName('')
                setPrice('')
                setCategory('')
              }}
              className="border px-4 py-2 rounded"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {menus.map((menu) => (
          <div key={menu.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
            <div>
              <div className="font-medium">{menu.name}</div>
              <div className="text-sm text-gray-600">
                Rp {menu.price.toLocaleString()} {menu.category && `• ${menu.category}`}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(menu)} className="text-blue-600 text-sm">
                Edit
              </button>
              <button onClick={() => handleDelete(menu.id)} className="text-red-600 text-sm">
                Hapus
              </button>
            </div>
          </div>
        ))}
        {menus.length === 0 && <p className="text-gray-500 text-center py-4">Belum ada menu</p>}
      </div>
    </div>
  )
}
