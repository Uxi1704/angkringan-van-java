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
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-3xl bg-white px-6 py-8">
        <div className="mb-5 grid grid-cols-2 gap-3 text-center">
          <div>
            <img src="/logo-vanjava65.jpg" alt="VANJAVA65" className="mx-auto h-24 w-24 rounded-full object-cover shadow-md" />
            <p className="mt-2 font-display text-sm font-semibold">VANJAVA65</p>
            <p className="text-[11px] text-stone-500">Simpang Bangkal</p>
          </div>
          <div>
            <img src="/logo-arjuna85.jpg" alt="ARJUNA85" className="mx-auto h-24 w-24 rounded-full object-cover shadow-md" />
            <p className="mt-2 font-display text-sm font-semibold">ARJUNA85</p>
            <p className="text-[11px] text-stone-500">Simpang Sebabi</p>
          </div>
        </div>
        <h1 className="mb-5 text-center text-2xl">Masuk kasir</h1>
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full px-3" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full px-3" required />
          </div>
          {error ? <p className="text-sm text-sogan">{error}</p> : null}
          <button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-primary font-semibold text-white disabled:opacity-50">
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
