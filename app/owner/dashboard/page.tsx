import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function OwnerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') redirect('/login')

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Dashboard Owner</h1>
      <p className="mt-2 text-gray-600 mb-6">Selamat datang, Owner.</p>

      <div className="space-y-3">
        <Link href="/owner/menu" className="block bg-white p-4 rounded-lg shadow hover:shadow-md">
          <div className="font-medium">Kelola Menu</div>
          <div className="text-sm text-gray-600">Tambah, edit, hapus menu & harga</div>
        </Link>
      </div>
    </div>
  )
}
