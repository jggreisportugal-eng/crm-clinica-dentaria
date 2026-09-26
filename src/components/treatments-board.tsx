'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TREATMENT_STATUSES,
  TREATMENT_STATUS_LABELS,
  type TreatmentStatus,
} from '@/lib/treatment-status'

export interface TreatmentRow {
  id: string
  treatment_type: string
  treatment_plan: string | null
  budget: number | null
  status: TreatmentStatus
  patient: { full_name: string } | null
  professional: { full_name: string } | null
  deal: { funnel_stage: string } | null
}

const currency = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

export function TreatmentsBoard({
  initialTreatments,
  patients,
  deals,
  professionals,
  canCreate,
}: {
  initialTreatments: TreatmentRow[]
  patients: { id: string; full_name: string }[]
  deals: { id: string; patient_id: string; funnel_stage: string }[]
  professionals: { id: string; full_name: string | null }[]
  canCreate: boolean
}) {
  const [treatments, setTreatments] = useState(initialTreatments)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [patientId, setPatientId] = useState('')
  const [dealId, setDealId] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [treatmentType, setTreatmentType] = useState('')
  const [treatmentPlan, setTreatmentPlan] = useState('')
  const [budget, setBudget] = useState('')

  const dealsForPatient = deals.filter((d) => d.patient_id === patientId)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('treatments')
      .insert({
        patient_id: patientId,
        deal_id: dealId || null,
        professional_id: professionalId || null,
        treatment_type: treatmentType,
        treatment_plan: treatmentPlan || null,
        budget: budget ? Number(budget) : null,
      })
      .select(
        'id, treatment_type, treatment_plan, budget, status, patient:patients(full_name), professional:users(full_name), deal:deals(funnel_stage)'
      )
      .single()

    setSubmitting(false)

    if (error) {
      setError(`Não foi possível criar o tratamento: ${error.message}`)
      return
    }

    setTreatments((current) => [data as unknown as TreatmentRow, ...current])
    setPatientId('')
    setDealId('')
    setProfessionalId('')
    setTreatmentType('')
    setTreatmentPlan('')
    setBudget('')
  }

  async function updateStatus(id: string, status: TreatmentStatus) {
    const previous = treatments
    setTreatments((current) =>
      current.map((t) => (t.id === id ? { ...t, status } : t))
    )
    setError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('treatments')
      .update({ status })
      .eq('id', id)

    if (error) {
      setTreatments(previous)
      setError(`Não foi possível atualizar o estado: ${error.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {canCreate && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-6 sm:items-end"
        >
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600">
              Paciente
            </label>
            <select
              required
              value={patientId}
              onChange={(e) => {
                setPatientId(e.target.value)
                setDealId('')
              }}
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
              Deal (opcional)
            </label>
            <select
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              disabled={!patientId}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
            >
              <option value="">Sem deal</option>
              {dealsForPatient.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.funnel_stage}
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
              Tipo de tratamento
            </label>
            <input
              type="text"
              required
              value={treatmentType}
              onChange={(e) => setTreatmentType(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600">
              Orçamento (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div className="sm:col-span-5">
            <label className="block text-xs font-medium text-gray-600">
              Plano (descrição comercial)
            </label>
            <input
              type="text"
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-600 hover:bg-brand-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'A criar…' : 'Criar tratamento'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="data-table">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2">Paciente</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Profissional</th>
              <th className="py-2">Orçamento</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {treatments.map((t) => (
              <tr key={t.id} className="border-b border-gray-100">
                <td className="py-2">{t.patient?.full_name ?? '—'}</td>
                <td className="py-2">{t.treatment_type}</td>
                <td className="py-2">{t.professional?.full_name ?? '—'}</td>
                <td className="py-2">
                  {t.budget != null ? currency.format(t.budget) : '—'}
                </td>
                <td className="py-2">
                  <select
                    value={t.status}
                    onChange={(e) =>
                      updateStatus(t.id, e.target.value as TreatmentStatus)
                    }
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  >
                    {TREATMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {TREATMENT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {treatments.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-400">
                  Sem tratamentos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
