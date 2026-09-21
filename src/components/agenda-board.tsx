'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
} from '@/lib/appointment-status'

export interface AppointmentRow {
  id: string
  status: AppointmentStatus
  scheduled_at: string
  notes: string | null
  patient: { full_name: string } | null
  professional: { full_name: string } | null
}

const dateFormat = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function AgendaBoard({
  initialAppointments,
  patients,
  professionals,
  canManage,
}: {
  initialAppointments: AppointmentRow[]
  patients: { id: string; full_name: string }[]
  professionals: { id: string; full_name: string | null }[]
  canManage: boolean
}) {
  const [appointments, setAppointments] = useState(initialAppointments)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [patientId, setPatientId] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id: patientId,
        professional_id: professionalId || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        notes: notes || null,
      })
      .select(
        'id, status, scheduled_at, notes, patient:patients(full_name), professional:users(full_name)'
      )
      .single()

    setSubmitting(false)

    if (error) {
      setError(`Não foi possível marcar a consulta: ${error.message}`)
      return
    }

    setAppointments((current) =>
      [...current, data as unknown as AppointmentRow].sort((a, b) =>
        a.scheduled_at.localeCompare(b.scheduled_at)
      )
    )
    setPatientId('')
    setProfessionalId('')
    setScheduledAt('')
    setNotes('')
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    const previous = appointments
    setAppointments((current) =>
      current.map((a) => (a.id === id ? { ...a, status } : a))
    )
    setError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)

    if (error) {
      setAppointments(previous)
      setError(`Não foi possível atualizar o estado: ${error.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {canManage && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-5 sm:items-end"
        >
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600">
              Paciente
            </label>
            <select
              required
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Selecionar…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">
              Profissional
            </label>
            <select
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Sem preferência</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? 'Sem nome'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">
              Data/hora
            </label>
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">
              Notas
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'A marcar…' : 'Marcar consulta'}
          </button>
        </form>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2">Data/hora</th>
            <th className="py-2">Paciente</th>
            <th className="py-2">Profissional</th>
            <th className="py-2">Estado</th>
            <th className="py-2">Notas</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id} className="border-b border-gray-100">
              <td className="py-2">{dateFormat.format(new Date(a.scheduled_at))}</td>
              <td className="py-2">{a.patient?.full_name ?? '—'}</td>
              <td className="py-2">{a.professional?.full_name ?? '—'}</td>
              <td className="py-2">
                {canManage ? (
                  <select
                    value={a.status}
                    onChange={(e) =>
                      updateStatus(a.id, e.target.value as AppointmentStatus)
                    }
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  >
                    {APPOINTMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {APPOINTMENT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  APPOINTMENT_STATUS_LABELS[a.status]
                )}
              </td>
              <td className="py-2 text-gray-500">{a.notes ?? '—'}</td>
            </tr>
          ))}
          {appointments.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-gray-400">
                Sem consultas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
