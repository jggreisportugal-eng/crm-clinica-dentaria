'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DentalArch } from '@/components/dental-arch'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou palavra-passe incorretos. Confirme os dados e tente de novo.'
          : error.message
      )
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="grid min-h-screen bg-background md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-900 text-sm font-bold text-brand-200">
              CS
            </span>
            <span className="text-base font-semibold text-brand-900">
              Clinic Smart
            </span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Entrar
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-500">
            Use o e-mail e a palavra-passe da sua conta na clínica.
          </p>

          <div className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-[15px]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-gray-700"
              >
                Palavra-passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-[15px]"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-700 px-3.5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
            >
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Ainda não tem uma clínica registada?{' '}
            <a
              href="/onboarding"
              className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900"
            >
              Criar clínica
            </a>
          </p>
        </form>
      </main>

      <aside className="relative hidden flex-col justify-center gap-14 overflow-hidden bg-brand-900 p-12 text-brand-100 md:flex lg:p-16">
        <DentalArch className="w-full max-w-md" />
        <div className="max-w-md">
          <p className="text-2xl font-medium leading-snug text-white lg:text-[28px]">
            A agenda, os pacientes e os lembretes da clínica, num só sítio.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-200">
            A Maria confirma as consultas pelo WhatsApp e cada resposta fica
            registada na ficha do paciente.
          </p>
        </div>
      </aside>
    </div>
  )
}
