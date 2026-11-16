'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Menu = {
  id: string
  name: string
  price: number
  category: string | null
}

type CartItem = {
  menu: Menu
  quantity: number
}

export default function KasirDashboard() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
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

    const { data: prof } = await supabase.from('profiles').select('*, locations(name)').eq('id', user.id).single()
    setProfile(prof)

    const { data: menuData } = await supabase
      .from('menus')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (menuData) setMenus(menuData)
    setLoading(false)
  }

  function addToCart(menu: Menu) {
    setCart((prev) => {
      const existing = prev.find((item) => item.menu.id === menu.id)
      if (existing) {
        return prev.map((item) =>
          item.menu.id === menu.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { menu, quantity: 1 }]
    })
  }

  function updateQuantity(menuId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.menu.id === menuId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  const total = cart.reduce((sum, item) => sum + item.menu.price * item.quantity, 0)

  async function handleCheckout() {
    if (cart.length === 0 || !profile?.location_id) {
      alert('Lokasi kasir belum diatur')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        location_id: profile.location_id,
        kasir_id: user.id,
        total,
        status: 'completed',
      })
      .select()
      .single()

    if (orderError || !order) {
      alert('Gagal buat order: ' + (orderError?.message || ''))
      return
    }

    const items = cart.map((item) => ({
      order_id: order.id,
      menu_id: item.menu.id,
      menu_name: item.menu.name,
      price: item.menu.price,
      quantity: item.quantity,
      subtotal: item.menu.price * item.quantity,
    }))

    await supabase.from('order_items').insert(items)

    setCart([])
    alert('Order berhasil!')
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Kasir</h1>
          <p className="text-sm text-gray-600">{profile?.locations?.name || 'Lokasi belum diatur'}</p>
        </div>
        <Link href="/kasir/stok" className="text-blue-600 text-sm">
          Update Stok
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6">
        {menus.map((menu) => (
          <button
            key={menu.id}
            onClick={() => addToCart(menu)}
            className="bg-white p-3 rounded-lg shadow text-left active:bg-gray-50"
          >
            <div className="font-medium text-sm">{menu.name}</div>
            <div className="text-green-600 text-sm">Rp {menu.price.toLocaleString()}</div>
          </button>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow fixed bottom-4 left-4 right-4 max-w-2xl mx-auto">
          <h2 className="font-semibold mb-2">Pesanan</h2>
          <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
            {cart.map((item) => (
              <div key={item.menu.id} className="flex justify-between items-center text-sm">
                <span>{item.menu.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.menu.id, -1)} className="w-6 h-6 bg-gray-200 rounded">
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.menu.id, 1)} className="w-6 h-6 bg-gray-200 rounded">
                    +
                  </button>
                  <span className="w-16 text-right">Rp {(item.menu.price * item.quantity).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center font-bold border-t pt-2">
            <span>Total: Rp {total.toLocaleString()}</span>
            <button onClick={handleCheckout} className="bg-green-600 text-white px-4 py-2 rounded-lg">
              Bayar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
