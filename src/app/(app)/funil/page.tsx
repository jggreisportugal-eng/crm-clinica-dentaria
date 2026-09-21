import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { Kanban, type DealCard } from '@/components/kanban'

export default async function FunilPage() {
  await requireRole(['administrador', 'gestor', 'comercial'])

  const supabase = await createClient()

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id, name')
    .eq('is_default', true)
    .single()

  const { data: deals } = await supabase
    .from('deals')
    .select(
      'id, funnel_stage, estimated_value, patient:patients(full_name), responsible:users(full_name)'
    )
    .eq('active', true)
    .eq('pipeline_id', pipeline?.id ?? '')
    .order('created_at', { ascending: true })

  return (
    <div className="flex h-screen flex-col p-8">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-gray-900">
          Funil {pipeline ? `— ${pipeline.name}` : ''}
        </h1>
        <p className="text-sm text-gray-500">
          Arraste um cartão entre colunas para mudar a etapa.
        </p>
      </div>
      <Kanban initialDeals={(deals as unknown as DealCard[]) ?? []} />
    </div>
  )
}
