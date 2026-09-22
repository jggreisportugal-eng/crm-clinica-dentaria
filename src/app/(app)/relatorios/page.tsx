import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS } from '@/lib/funnel-stages'
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS } from '@/lib/appointment-status'
import { TREATMENT_STATUSES, TREATMENT_STATUS_LABELS } from '@/lib/treatment-status'

const currency = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

export default async function RelatoriosPage() {
  await requireRole(['administrador', 'gestor'])

  const supabase = await createClient()

  const [
    { data: byOrigin },
    { data: byStage },
    { data: byAppointment },
    { data: byTreatment },
    { data: teamPerformance },
    { data: dealsHealth },
  ] = await Promise.all([
    supabase
      .from('report_leads_by_origin')
      .select('origin, total_leads, converted_leads, conversion_rate_pct'),
    supabase
      .from('report_funnel_conversion')
      .select('funnel_stage, deals_count, total_value'),
    supabase
      .from('report_appointments_summary')
      .select('status, appointments_count'),
    supabase
      .from('report_treatments_billing')
      .select('status, treatments_count, total_budget'),
    supabase.rpc('get_team_performance'),
    supabase.rpc('get_deals_health'),
  ])

  const stageMap = new Map((byStage ?? []).map((s) => [s.funnel_stage, s]))
  const appointmentMap = new Map((byAppointment ?? []).map((a) => [a.status, a]))
  const treatmentMap = new Map((byTreatment ?? []).map((t) => [t.status, t]))

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Relatórios</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium text-gray-900">
          Leads por origem e conversão
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Origem</th>
              <th className="py-2">Leads</th>
              <th className="py-2">Convertidos</th>
              <th className="py-2">Taxa de conversão</th>
            </tr>
          </thead>
          <tbody>
            {(byOrigin ?? []).map((row) => (
              <tr key={row.origin} className="border-b border-gray-100">
                <td className="py-2">{row.origin}</td>
                <td className="py-2">{row.total_leads}</td>
                <td className="py-2">{row.converted_leads}</td>
                <td className="py-2">{row.conversion_rate_pct ?? 0}%</td>
              </tr>
            ))}
            {(byOrigin ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-400">
                  Sem dados ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-gray-900">
          Conversão ao longo do funil
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Etapa</th>
              <th className="py-2">Negócios</th>
              <th className="py-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {FUNNEL_STAGES.map((stage) => {
              const row = stageMap.get(stage)
              return (
                <tr key={stage} className="border-b border-gray-100">
                  <td className="py-2">{FUNNEL_STAGE_LABELS[stage]}</td>
                  <td className="py-2">{row?.deals_count ?? 0}</td>
                  <td className="py-2">
                    {currency.format(row?.total_value ?? 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-gray-900">
          Consultas por status
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Status</th>
              <th className="py-2">Consultas</th>
            </tr>
          </thead>
          <tbody>
            {APPOINTMENT_STATUSES.map((status) => (
              <tr key={status} className="border-b border-gray-100">
                <td className="py-2">{APPOINTMENT_STATUS_LABELS[status]}</td>
                <td className="py-2">
                  {appointmentMap.get(status)?.appointments_count ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-gray-900">
          Tratamentos e faturação comercial
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Status</th>
              <th className="py-2">Tratamentos</th>
              <th className="py-2">Orçamento total</th>
            </tr>
          </thead>
          <tbody>
            {TREATMENT_STATUSES.map((status) => {
              const row = treatmentMap.get(status)
              return (
                <tr key={status} className="border-b border-gray-100">
                  <td className="py-2">{TREATMENT_STATUS_LABELS[status]}</td>
                  <td className="py-2">{row?.treatments_count ?? 0}</td>
                  <td className="py-2">
                    {currency.format(row?.total_budget ?? 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-gray-900">
          Desempenho por profissional/equipa
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Utilizador</th>
              <th className="py-2">Perfil</th>
              <th className="py-2">Deals fechados</th>
              <th className="py-2">Consultas realizadas</th>
            </tr>
          </thead>
          <tbody>
            {(teamPerformance ?? []).map(
              (row: {
                user_id: string
                full_name: string | null
                role: string
                deals_closed: number
                appointments_done: number
              }) => (
                <tr key={row.user_id} className="border-b border-gray-100">
                  <td className="py-2">{row.full_name ?? '—'}</td>
                  <td className="py-2">{row.role}</td>
                  <td className="py-2">{row.deals_closed}</td>
                  <td className="py-2">{row.appointments_done}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-gray-900">
          Motivos de perda
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Paciente</th>
              <th className="py-2">Responsável</th>
              <th className="py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {(dealsHealth ?? [])
              .filter((d: { funnel_stage: string }) => d.funnel_stage === 'perdido')
              .map(
                (d: {
                  deal_id: string
                  patient_name: string | null
                  responsible_name: string | null
                  lost_reason: string | null
                }) => (
                  <tr key={d.deal_id} className="border-b border-gray-100">
                    <td className="py-2">{d.patient_name ?? '—'}</td>
                    <td className="py-2">{d.responsible_name ?? '—'}</td>
                    <td className="py-2 text-gray-500">
                      {d.lost_reason ?? 'Não capturado'}
                    </td>
                  </tr>
                )
              )}
            {(dealsHealth ?? []).filter(
              (d: { funnel_stage: string }) => d.funnel_stage === 'perdido'
            ).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-gray-400">
                  Sem negócios perdidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-gray-900">
          Oportunidades paradas (7+ dias sem atualização)
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Paciente</th>
              <th className="py-2">Etapa</th>
              <th className="py-2">Responsável</th>
              <th className="py-2">Dias parado</th>
            </tr>
          </thead>
          <tbody>
            {(dealsHealth ?? [])
              .filter((d: { funnel_stage: string }) => d.funnel_stage !== 'perdido')
              .map(
                (d: {
                  deal_id: string
                  patient_name: string | null
                  funnel_stage: keyof typeof FUNNEL_STAGE_LABELS
                  responsible_name: string | null
                  days_since_update: number
                }) => (
                  <tr key={d.deal_id} className="border-b border-gray-100">
                    <td className="py-2">{d.patient_name ?? '—'}</td>
                    <td className="py-2">{FUNNEL_STAGE_LABELS[d.funnel_stage]}</td>
                    <td className="py-2">{d.responsible_name ?? '—'}</td>
                    <td className="py-2">{d.days_since_update}</td>
                  </tr>
                )
              )}
            {(dealsHealth ?? []).filter(
              (d: { funnel_stage: string }) => d.funnel_stage !== 'perdido'
            ).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-400">
                  Sem oportunidades paradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
