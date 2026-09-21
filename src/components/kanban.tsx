'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS, type FunnelStage } from '@/lib/funnel-stages'

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
    const previous = deals
    setDeals((current) =>
      current.map((d) => (d.id === dealId ? { ...d, funnel_stage: stage } : d))
    )
    setError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('deals')
      .update({ funnel_stage: stage })
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
              className="flex w-64 shrink-0 flex-col rounded-lg bg-gray-100 p-2"
            >
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {FUNNEL_STAGE_LABELS[stage]} · {stageDeals.length}
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
                    className={`cursor-grab rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm active:cursor-grabbing ${
                      draggingId === deal.id ? 'opacity-50' : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900">
                      {deal.patient?.full_name ?? 'Paciente sem nome'}
                    </p>
                    <p className="mt-1 text-gray-600">
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
