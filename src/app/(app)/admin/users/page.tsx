import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { UsersAdmin, type UserRow } from '@/components/users-admin'

// Gestão da equipa da clínica. A lista vem com o cliente do administrador:
// a RLS (users_select_admin) já limita à organização dele. Criar contas,
// banir e redefinir palavras-passe precisa da Admin API (service_role) e
// vive em ./actions.ts, sempre com requireRole + verificação de organização.
export default async function AdminUsersPage() {
  const admin = await requireRole(['administrador'])

  const supabase = await createClient()
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, role, active')
    .order('created_at', { ascending: true })
    .returns<UserRow[]>()

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Utilizadores</h1>
      {error && <p className="text-sm text-red-600">{error.message}</p>}
      <UsersAdmin users={users ?? []} meId={admin.id} />
    </div>
  )
}
