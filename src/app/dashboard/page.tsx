import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, active')
    .eq('id', user.id)
    .single()

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="rounded-lg border border-gray-200 p-4 text-sm">
        <p>
          <span className="font-medium">E-mail:</span> {user.email}
        </p>
        <p>
          <span className="font-medium">Nome:</span>{' '}
          {profile?.full_name ?? '—'}
        </p>
        <p>
          <span className="font-medium">Perfil:</span> {profile?.role ?? '—'}
        </p>
      </div>
      {profile?.role === 'administrador' && (
        <a
          href="/admin/users"
          className="inline-block text-sm text-blue-600 underline"
        >
          Ver todos os utilizadores (área restrita a Administrador)
        </a>
      )}
    </div>
  )
}
