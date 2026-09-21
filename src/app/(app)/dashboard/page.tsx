import { requireProfile } from '@/lib/auth/require-role'
import { ROLE_LABELS, type UserRole } from '@/lib/auth/nav-config'
import { createClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/kpi-card'

// Perfis que têm acesso a leads (Etapa 1.8 / policy leads_select) — usado
// para decidir se mostramos o KPI de Novos Leads, em vez de mostrar um
// zero enganador para quem a RLS já filtra a zero linhas.
const LEADS_ACCESS: UserRole[] = ['administrador', 'gestor', 'comercial', 'recepcao']

// Mesmo conjunto de perfis do módulo Funil (deals/pipelines — Etapas
// 2.1/2.2): os indicadores de funil da Etapa 2.6 são tratados como um
// bloco só, escopado a quem gere o funil.
const FUNIL_ACCESS: UserRole[] = ['administrador', 'gestor', 'comercial']

const currency = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

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

  const canSeeFunil = FUNIL_ACCESS.includes(profile.role)
  let conversionRate = 0
  let potentialValue = 0
  let pendingTasks = 0
  let todayFollowUps = 0

  if (canSeeFunil) {
    const { count: totalDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)

    const { count: wonDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .eq('funnel_stage', 'concluido')

    conversionRate = totalDeals
      ? Math.round(((wonDeals ?? 0) / totalDeals) * 100)
      : 0

    const { data: openDeals } = await supabase
      .from('deals')
      .select('estimated_value')
      .eq('active', true)
      .not('funnel_stage', 'in', '(concluido,perdido)')

    potentialValue = (openDeals ?? []).reduce(
      (sum, d) => sum + (d.estimated_value ?? 0),
      0
    )

    const { count: pending } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente')
    pendingTasks = pending ?? 0

    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(startOfDay)
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

    const { count: today } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .gte('due_at', startOfDay.toISOString())
      .lt('due_at', endOfDay.toISOString())
    todayFollowUps = today ?? 0
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
        {canSeeFunil && (
          <>
            <KpiCard label="Taxa de Conversão" value={`${conversionRate}%`} />
            <KpiCard
              label="Valor Potencial em Funil"
              value={currency.format(potentialValue)}
            />
            <KpiCard label="Pendências" value={pendingTasks} />
            <KpiCard label="Follow-ups Hoje" value={todayFollowUps} />
          </>
        )}
      </div>
    </div>
  )
}
