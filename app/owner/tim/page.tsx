'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Staff = {
  id: string
  email: string
  full_name: string | null
  role: string
}

function explain(message: string) {
  if (/list_staff|create_kasir|rename_kasir|reset_kasir_password|schema cache|could not find the function/i.test(message)) {
    return 'Pengaturan akun belum aktif. Jalankan supabase/004_akun_kasir.sql di SQL Editor Supabase, lalu muat ulang.'
  }
  return message
}

export default function TimPage() {
  const supabase = createClient()
  const router = useRouter()
  const [staff, setStaff] = useState<Staff[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [passwords, setPasswords] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'owner') {
      router.push('/kasir/dashboard')
      return
    }
    const { data, error: queryError } = await supabase.rpc('list_staff')
    if (queryError) setError(explain(queryError.message))
    const rows = (data || []) as Staff[]
    setStaff(rows)
    setNames(Object.fromEntries(rows.map((row) => [row.id, row.full_name || ''])))
    setLoading(false)
  }

  async function createKasir(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setPending('create')
    const { error: rpcError } = await supabase.rpc('create_kasir', {
      p_email: email.trim(),
      p_password: password,
      p_full_name: name.trim(),
    })
    setPending('')
    if (rpcError) {
      setError(explain(rpcError.message))
      return
    }
    setName('')
    setEmail('')
    setPassword('')
    setNotice('Akun kasir sudah dibuat. Mereka bisa langsung masuk.')
    await load()
  }

  async function rename(id: string) {
    setError('')
    setNotice('')
    setPending(id + ':name')
    const { error: rpcError } = await supabase.rpc('rename_kasir', {
      p_user_id: id,
      p_full_name: (names[id] || '').trim(),
    })
    setPending('')
    if (rpcError) {
      setError(explain(rpcError.message))
      return
    }
    setNotice('Nama kasir disimpan.')
    await load()
  }

  async function resetPassword(id: string) {
    const next = passwords[id] || ''
    if (next.length < 6) {
      setError('Password baru minimal 6 karakter.')
      return
    }
    setError('')
    setNotice('')
    setPending(id + ':password')
    const { error: rpcError } = await supabase.rpc('reset_kasir_password', {
      p_user_id: id,
      p_password: next,
    })
    setPending('')
    if (rpcError) {
      setError(explain(rpcError.message))
      return
    }
    setPasswords((current) => ({ ...current, [id]: '' }))
    setNotice('Password kasir sudah diganti.')
  }

  if (loading) return <div className="p-6">Memuat...</div>

  return (
    <div className="mx-auto max-w-lg px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary">Pemilik</p>
          <h1 className="text-2xl font-bold">Akun kasir</h1>
        </div>
        <button onClick={() => router.push('/owner/dashboard')} className="text-sm text-primary">← Pantau</button>
      </div>
      <p className="mb-4 text-sm text-stone-600">Kasir yang sudah ada tetap muncul di sini. Tambah akun baru atau ganti password tanpa buka database.</p>
      {notice ? <p className="mb-3 rounded-lg bg-white px-3 py-2 text-sm text-primary">{notice}</p> : null}
      {error ? <p className="mb-3 rounded-lg bg-white px-3 py-2 text-sm text-sogan">{error}</p> : null}

      <form onSubmit={createKasir} className="mb-6 space-y-3 rounded-xl bg-white p-4">
        <h2 className="font-semibold">Tambah kasir</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kasir" className="h-12 w-full rounded-lg border px-3" required />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email untuk masuk" className="h-12 w-full rounded-lg border px-3" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password, minimal 6 karakter" minLength={6} autoComplete="new-password" className="h-12 w-full rounded-lg border px-3" required />
        <button type="submit" disabled={pending === 'create'} className="h-12 w-full rounded-lg bg-primary font-medium text-white disabled:opacity-50">
          {pending === 'create' ? 'Menyimpan...' : 'Buat akun'}
        </button>
      </form>

      <ul className="space-y-3">
        {staff.map((person) => (
          <li key={person.id} className="rounded-xl bg-white p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="font-semibold">{person.full_name || person.email}</p>
              <p className="text-xs text-stone-500">{person.role === 'owner' ? 'Pemilik' : 'Kasir'}</p>
            </div>
            <p className="mb-3 text-sm text-stone-600">{person.email}</p>
            {person.role === 'kasir' ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={names[person.id] ?? ''}
                    onChange={(e) => setNames((current) => ({ ...current, [person.id]: e.target.value }))}
                    className="h-11 min-w-0 flex-1 rounded-lg border px-3"
                  />
                  <button type="button" disabled={pending === person.id + ':name'} onClick={() => rename(person.id)} className="h-11 shrink-0 rounded-lg border px-3 text-sm">
                    Simpan nama
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={passwords[person.id] ?? ''}
                    autoComplete="new-password"
                    placeholder="Password baru"
                    onChange={(e) => setPasswords((current) => ({ ...current, [person.id]: e.target.value }))}
                    className="h-11 min-w-0 flex-1 rounded-lg border px-3"
                  />
                  <button type="button" disabled={pending === person.id + ':password'} onClick={() => resetPassword(person.id)} className="h-11 shrink-0 rounded-lg bg-primary px-3 text-sm text-white disabled:opacity-50">
                    Reset
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
