import { requireProfile } from '@/lib/auth/require-role'
import { ROLE_LABELS, type UserRole } from '@/lib/auth/nav-config'
import { createClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/kpi-card'

// Perfis que têm acesso a leads (Etapa 1.8 / policy leads_select) — usado
// para decidir se mostramos o KPI de Novos Leads, em vez de mostrar um
// zero enganador para quem a RLS já filtra a zero linhas.
const LEADS_ACCESS: UserRole[] = ['administrador', 'gestor', 'comercial', 'recepcao']

export default async function DashboardPage() {
  const { user, profile } = await requireProfile()
  const supabase = await createClient()

  const { count: totalPatients } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)

  const canSeeLeads = LEADS_ACCESS.includes(profile.role)
  let newLeads = 0

  if (canSeeLeads) {
    const { count } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'novo')
    newLeads = count ?? 0
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          {profile.full_name ?? user.email} · {ROLE_LABELS[profile.role]}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="Total de Pacientes" value={totalPatients ?? 0} />
        {canSeeLeads && <KpiCard label="Novos Leads" value={newLeads} />}
      </div>
    </div>
  )
}
