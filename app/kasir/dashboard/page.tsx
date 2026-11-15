// app/kasir/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function KasirDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, location_id, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'kasir') {
    redirect('/owner/dashboard')
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard Kasir</h1>
      <p>Halo, {profile.full_name}</p>
      <p>Role: {profile.role}</p>
      <p>Lokasi ID: {profile.location_id || 'Belum diatur'}</p>
      
      <div className="mt-6">
        <p className="text-gray-600">Halaman ini hanya untuk kasir.</p>
        <p>Nanti di sini: proses order + update stok.</p>
      </div>
    </div>
  )
}
