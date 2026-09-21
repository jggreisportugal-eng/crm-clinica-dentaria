import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Recurso de teste da Etapa 1.2: só o perfil Administrador deve conseguir
// listar todos os utilizadores. A restrição é imposta pela RLS
// (policy users_select_admin) — qualquer outro perfil só recebe, via
// PostgREST, o seu próprio registo (policy users_select_own), nunca a
// lista completa, mesmo que esta página fosse acedida diretamente.
export default async function AdminUsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, active')
    .order('created_at', { ascending: true })

  const isAdmin = (users?.length ?? 0) > 1 || users?.[0]?.id !== user.id

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Utilizadores</h1>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {!error && (users?.length ?? 0) <= 1 && !isAdmin && (
        <p className="text-sm text-gray-500">
          Está a ver apenas o seu próprio registo — a RLS restringe a lista
          completa ao perfil Administrador.
        </p>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2">E-mail</th>
            <th className="py-2">Nome</th>
            <th className="py-2">Perfil</th>
            <th className="py-2">Ativo</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} className="border-b border-gray-100">
              <td className="py-2">{u.email}</td>
              <td className="py-2">{u.full_name ?? '—'}</td>
              <td className="py-2">{u.role}</td>
              <td className="py-2">{u.active ? 'Sim' : 'Não'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
