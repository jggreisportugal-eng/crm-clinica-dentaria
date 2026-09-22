import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS } from '@/lib/funnel-stages'

const currency = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

export default async function RelatoriosPage() {
  await requireRole(['administrador', 'gestor'])

  const supabase = await createClient()

  const [{ data: byOrigin }, { data: byStage }] = await Promise.all([
    supabase
      .from('report_leads_by_origin')
      .select('origin, total_leads, converted_leads, conversion_rate_pct'),
    supabase
      .from('report_funnel_conversion')
      .select('funnel_stage, deals_count, total_value'),
  ])

  const stageMap = new Map(
    (byStage ?? []).map((s) => [s.funnel_stage, s])
  )

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
    </div>
  )
}
