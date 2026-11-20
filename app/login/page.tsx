'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signError } = await supabase.auth.signInWithPassword({ email, password })
    if (signError || !data.user) {
      setError(signError?.message || 'Gagal masuk')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    if (profile?.role === 'owner') router.push('/owner/dashboard')
    else if (profile?.role === 'kasir') router.push('/kasir/dashboard')
    else setError('Akun ini belum punya profil. Tambahkan baris di tabel profiles dengan role owner atau kasir.')
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md">
        <div className="mb-4 flex justify-center gap-4">
          <img src="/logo-vanjava65.jpg" alt="VANJAVA65" className="h-20 w-20 rounded-full object-cover" />
          <img src="/logo-arjuna85.jpg" alt="ARJUNA85" className="h-20 w-20 rounded-full object-cover" />
        </div>
        <p className="text-center text-xs font-medium text-sogan">Simpang Bangkal · Simpang Sebabi</p>
        <h1 className="mb-6 text-center text-xl font-bold">VANJAVA65 & ARJUNA85</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border px-3 py-2" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border px-3 py-2" required />
          </div>
          {error ? <p className="text-sm text-sogan">{error}</p> : null}
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary py-2 font-medium text-white disabled:opacity-50">
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
