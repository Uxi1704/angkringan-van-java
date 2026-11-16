'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Stock = {
  id: string
  menu_id: string
  location_id: string
  quantity: number
  menus: { name: string; price: number } | null
}

export default function StokPage() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [menus, setMenus] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [selectedMenu, setSelectedMenu] = useState('')
  const [quantity, setQuantity] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    if (!prof?.location_id) {
      setLoading(false)
      return
    }

    const { data: stockData } = await supabase
      .from('stocks')
      .select('*, menus(name, price)')
      .eq('location_id', prof.location_id)

    const { data: menuData } = await supabase
      .from('menus')
      .select('*')
      .eq('is_active', true)

    if (stockData) setStocks(stockData)
    if (menuData) setMenus(menuData)
    setLoading(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMenu || !quantity || !profile?.location_id) return

    const existing = stocks.find((s) => s.menu_id === selectedMenu)

    if (existing) {
      await supabase
        .from('stocks')
        .update({ quantity: parseInt(quantity) })
        .eq('id', existing.id)
    } else {
      await supabase.from('stocks').insert({
        menu_id: selectedMenu,
        location_id: profile.location_id,
        quantity: parseInt(quantity),
      })
    }

    setSelectedMenu('')
    setQuantity('')
    loadData()
  }

  if (loading) return <div className="p-6">Loading...</div>

  if (!profile?.location_id) {
    return (
      <div className="p-6">
        <p className="text-red-600">Kasir ini belum punya lokasi. Hubungi owner.</p>
        <button onClick={() => router.push('/kasir/dashboard')} className="mt-4 text-blue-600">
          ← Kembali
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Update Stok</h1>
        <button onClick={() => router.push('/kasir/dashboard')} className="text-blue-600 text-sm">
          ← Kasir
        </button>
      </div>

      <form onSubmit={handleUpdate} className="bg-white p-4 rounded-lg shadow mb-4 space-y-3">
        <select
          value={selectedMenu}
          onChange={(e) => setSelectedMenu(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        >
          <option value="">Pilih menu</option>
          {menus.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Jumlah stok"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          Update Stok
        </button>
      </form>

      <div className="space-y-2">
        {stocks.map((stock) => (
          <div key={stock.id} className="bg-white p-3 rounded-lg shadow flex justify-between">
            <span>{stock.menus?.name || 'Menu'}</span>
            <span className="font-medium">{stock.quantity}</span>
          </div>
        ))}
        {stocks.length === 0 && <p className="text-gray-500 text-center">Belum ada data stok</p>}
      </div>
    </div>
  )
}
