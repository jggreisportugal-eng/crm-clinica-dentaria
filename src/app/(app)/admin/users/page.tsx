import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'

// Recurso de teste da Etapa 1.2: só o perfil Administrador deve conseguir
// listar todos os utilizadores. A restrição é imposta pela RLS
// (policy users_select_admin) — este requireRole é defesa em profundidade
// ao nível da rota; sem ele, outro perfil só receberia o próprio registo
// via PostgREST, nunca a lista completa.
export default async function AdminUsersPage() {
  await requireRole(['administrador'])

  const supabase = await createClient()
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, active')
    .order('created_at', { ascending: true })

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Utilizadores</h1>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

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
