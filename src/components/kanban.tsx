'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FUNNEL_STAGES,
  FUNNEL_STAGE_COLORS,
  FUNNEL_STAGE_LABELS,
  type FunnelStage,
} from '@/lib/funnel-stages'

export interface DealCard {
  id: string
  funnel_stage: FunnelStage
  estimated_value: number | null
  patient: { full_name: string } | null
  responsible: { full_name: string } | null
}

const currency = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

export function Kanban({ initialDeals }: { initialDeals: DealCard[] }) {
  const [deals, setDeals] = useState(initialDeals)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function moveDeal(dealId: string, stage: FunnelStage) {
    // Etapa 7.4: captura opcional do motivo ao perder um negócio, para
    // o relatório de motivos de perda ter algo além de "não capturado".
    const lostReason =
      stage === 'perdido' ? window.prompt('Motivo da perda (opcional):') : null

    const previous = deals
    setDeals((current) =>
      current.map((d) => (d.id === dealId ? { ...d, funnel_stage: stage } : d))
    )
    setError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('deals')
      .update({
        funnel_stage: stage,
        ...(stage === 'perdido' ? { lost_reason: lostReason || null } : {}),
      })
      .eq('id', dealId)

    if (error) {
      setDeals(previous)
      setError(`Não foi possível mover o negócio: ${error.message}`)
    }
  }

  return (
    <div className="flex-1 overflow-x-auto">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex h-full gap-3">
        {FUNNEL_STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.funnel_stage === stage)
          return (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const dealId = e.dataTransfer.getData('text/deal-id')
                if (dealId) moveDeal(dealId, stage)
                setDraggingId(null)
              }}
              className="flex w-64 shrink-0 flex-col rounded-lg bg-slate-100 p-2"
            >
              <p className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
                <span className={`h-2 w-2 rounded-full ${FUNNEL_STAGE_COLORS[stage].dot}`} />
                {FUNNEL_STAGE_LABELS[stage]}
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-gray-500">
                  {stageDeals.length}
                </span>
              </p>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/deal-id', deal.id)
                      setDraggingId(deal.id)
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`cursor-grab rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm transition hover:border-brand-300 hover:shadow active:cursor-grabbing ${
                      draggingId === deal.id ? 'opacity-50' : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900">
                      {deal.patient?.full_name ?? 'Paciente sem nome'}
                    </p>
                    <p className="mt-1 font-medium text-brand-700">
                      {deal.estimated_value != null
                        ? currency.format(deal.estimated_value)
                        : '—'}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {deal.responsible?.full_name ?? 'Sem responsável'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
