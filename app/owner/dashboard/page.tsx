import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OwnerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'owner') redirect('/login')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard Owner</h1>
      <p className="mt-2 text-gray-600">Selamat datang, Owner.</p>
    </div>
  )
}
