import { requireProfile } from '@/lib/auth/require-role'
import { ROLE_LABELS, type UserRole } from '@/lib/auth/nav-config'
import { createClient } from '@/lib/supabase/server'
import { KpiCard, KpiGroup } from '@/components/kpi-card'

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

const longDate = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Lisbon',
})

function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat('pt-PT', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Europe/Lisbon',
    }).format(now)
  )
  if (hour < 12) return 'Bom dia'
  if (hour < 20) return 'Boa tarde'
  return 'Boa noite'
}

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

  const now = new Date()
  const todayLabel = longDate.format(now)
  const firstName = profile.full_name?.split(' ')[0]

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-8 sm:py-10">
      <header>
        <p className="text-sm text-gray-500">{todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
          {firstName ? `${greeting(now)}, ${firstName}` : greeting(now)}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {profile.full_name ? user.email : null}
          {profile.full_name ? ' — ' : null}
          {ROLE_LABELS[profile.role]}
        </p>
      </header>

      <KpiGroup title="Pacientes e contactos">
        <KpiCard label="Pacientes ativos" value={totalPatients ?? 0} />
        {canSeeLeads && (
          <KpiCard
            label="Novos leads"
            value={newLeads}
            hint="Ainda sem primeiro contacto"
          />
        )}
        {canSeeFunil && (
          <KpiCard
            label="Follow-ups hoje"
            value={todayFollowUps}
            hint="Tarefas pendentes com data de hoje"
          />
        )}
      </KpiGroup>

      {canSeeFunil && (
        <KpiGroup title="Funil de tratamentos">
          <KpiCard
            label="Taxa de conversão"
            value={`${conversionRate}%`}
            hint="Negócios ativos concluídos"
          />
          <KpiCard
            label="Valor potencial em funil"
            value={currency.format(potentialValue)}
            hint="Soma dos negócios em aberto"
          />
          <KpiCard label="Tarefas pendentes" value={pendingTasks} />
        </KpiGroup>
      )}
    </div>
  )
}
