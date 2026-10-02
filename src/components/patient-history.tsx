'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FUNNEL_STAGE_LABELS, type FunnelStage } from '@/lib/funnel-stages'
import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
} from '@/lib/appointment-status'

// Cronologia do paciente (função patient_history: só eventos deste
// paciente, filtrados pela organização e pelo perfil de quem consulta).

interface HistoryEvent {
  occurred_at: string
  kind: string
  actor_name: string | null
  details: Record<string, unknown>
}

const dateTime = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Lisbon',
})

const fmt = (iso: unknown) =>
  typeof iso === 'string' ? dateTime.format(new Date(iso)) : '—'

const DOTS: Record<string, string> = {
  'patient.created': 'bg-gray-400',
  'deal.stage': 'bg-violet-500',
  'deal.weekend_followup': 'bg-emerald-500',
  'deal.weekend_followup_stopped': 'bg-rose-500',
  appointment: 'bg-sky-500',
  'appointment.reminder': 'bg-sky-300',
  'task.created': 'bg-amber-400',
  'task.completed': 'bg-amber-600',
}

function describe(e: HistoryEvent): { title: string; detail?: string } {
  const d = e.details
  switch (e.kind) {
    case 'patient.created':
      return { title: 'Paciente registado' }
    case 'deal.stage': {
      const stage = FUNNEL_STAGE_LABELS[d.funnel_stage as FunnelStage] ?? String(d.funnel_stage)
      return { title: d.created ? `Entrou no funil — ${stage}` : `Fase: ${stage}` }
    }
    case 'deal.weekend_followup':
      return {
        title:
          d.channel === 'whatsapp'
            ? 'Follow-up de fim de semana enviado pela assistente (WhatsApp)'
            : 'Follow-up de fim de semana — tarefa para a receção ligar',
        detail: d.count ? `${d.count}.º seguido sem resposta` : undefined,
      }
    case 'deal.weekend_followup_stopped':
      return {
        title: 'Follow-ups de fim de semana parados',
        detail: `${d.count ?? 3} seguidos sem resposta — tarefa para decidir (ligar ou dar como perdido)`,
      }
    case 'appointment':
      return {
        title: `Consulta marcada para ${fmt(d.scheduled_at)}${d.professional ? ` com ${d.professional}` : ''}`,
        detail: `Estado: ${APPOINTMENT_STATUS_LABELS[d.status as AppointmentStatus] ?? d.status}`,
      }
    case 'appointment.reminder':
      return {
        title: `Lembrete da consulta de ${fmt(d.scheduled_at)}`,
        detail: d.channel === 'whatsapp' ? 'Pela assistente (WhatsApp)' : 'Tarefa para a receção telefonar',
      }
    case 'task.created':
      return { title: `Tarefa: ${d.title}` }
    case 'task.completed':
      return { title: `Tarefa concluída: ${d.title}` }
    default:
      return { title: e.kind }
  }
}

export function PatientHistory({ patientId }: { patientId: string }) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    createClient()
      .rpc('patient_history', { p_patient_id: patientId })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setEvents((data ?? []) as HistoryEvent[])
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  if (error) {
    return <p className="text-sm text-red-600">Não foi possível carregar o histórico: {error}</p>
  }
  if (!events) return <p className="text-sm text-gray-500">A carregar histórico…</p>
  if (events.length === 0) return <p className="text-sm text-gray-500">Sem histórico.</p>

  return (
    <ol className="relative ml-1.5 space-y-3 border-l border-gray-200 py-1">
      {events.map((e, i) => {
        const { title, detail } = describe(e)
        return (
          <li key={i} className="relative pl-4">
            <span
              className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${DOTS[e.kind] ?? 'bg-gray-400'}`}
            />
            <div className="text-sm text-gray-900">{title}</div>
            <div className="text-xs text-gray-500">
              {fmt(e.occurred_at)}
              {e.actor_name && ` · ${e.actor_name}`}
              {detail && ` · ${detail}`}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
