'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizePhone } from '@/lib/phone'
import {
  FUNNEL_STAGE_COLORS,
  FUNNEL_STAGE_LABELS,
  type FunnelStage,
} from '@/lib/funnel-stages'
import { PATIENT_COLUMNS } from '@/lib/patient-columns'

export interface PatientRow {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  birth_date: string | null
  preferred_contact_channel: string | null
  source: string | null
  interest: string | null
  estimated_value: number | null
  responsible_user_id: string | null
  consent_communication: boolean
  consent_marketing: boolean
  communication_preferences: Record<string, boolean>
  consent_recorded_at: string | null
  active: boolean
  last_interaction_at: string | null
  chatwoot_conversation_link: string | null
}

export interface DealRef {
  patient_id: string
  funnel_stage: FunnelStage
}

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'E-mail' },
] as const

const SOURCES = [
  'WhatsApp',
  'Telefone',
  'Presencial',
  'Site',
  'Instagram',
  'Facebook',
  'Google',
  'Recomendação',
  'Outro',
]

const currency = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

const dateTime = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Lisbon',
})

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm'
const labelClass = 'block text-xs font-medium text-gray-600'

interface FormValues {
  full_name: string
  phone: string
  email: string
  birth_date: string
  preferred_contact_channel: string
  source: string
  interest: string
  estimated_value: string
  responsible_user_id: string
  consent_communication: boolean
  consent_marketing: boolean
  communication_preferences: Record<string, boolean>
}

const EMPTY_FORM: FormValues = {
  full_name: '',
  phone: '',
  email: '',
  birth_date: '',
  preferred_contact_channel: 'whatsapp',
  source: '',
  interest: '',
  estimated_value: '',
  responsible_user_id: '',
  consent_communication: false,
  consent_marketing: false,
  communication_preferences: {},
}

function toFormValues(p: PatientRow): FormValues {
  return {
    full_name: p.full_name,
    phone: p.phone ?? '',
    email: p.email ?? '',
    birth_date: p.birth_date ?? '',
    preferred_contact_channel: p.preferred_contact_channel ?? '',
    source: p.source ?? '',
    interest: p.interest ?? '',
    estimated_value: p.estimated_value?.toString() ?? '',
    responsible_user_id: p.responsible_user_id ?? '',
    consent_communication: p.consent_communication,
    consent_marketing: p.consent_marketing,
    communication_preferences: p.communication_preferences ?? {},
  }
}

// Converte o formulário no payload da tabela. consent_recorded_at regista
// quando os consentimentos (RGPD) foram dados ou alterados pela última vez.
function toPayload(values: FormValues, previous?: PatientRow) {
  const consentChanged =
    !previous ||
    previous.consent_communication !== values.consent_communication ||
    previous.consent_marketing !== values.consent_marketing ||
    JSON.stringify(previous.communication_preferences ?? {}) !==
      JSON.stringify(values.communication_preferences)

  const anyConsent = values.consent_communication || values.consent_marketing

  return {
    full_name: values.full_name.trim(),
    phone: normalizePhone(values.phone),
    email: values.email.trim().toLowerCase() || null,
    birth_date: values.birth_date || null,
    preferred_contact_channel: values.preferred_contact_channel || null,
    source: values.source || null,
    interest: values.interest.trim() || null,
    estimated_value: values.estimated_value
      ? Number(values.estimated_value)
      : null,
    responsible_user_id: values.responsible_user_id || null,
    consent_communication: values.consent_communication,
    consent_marketing: values.consent_marketing,
    communication_preferences: values.communication_preferences,
    consent_recorded_at: consentChanged
      ? anyConsent
        ? new Date().toISOString()
        : null
      : previous.consent_recorded_at,
  }
}

function PatientForm({
  initial,
  users,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
  extra,
}: {
  initial: FormValues
  users: { id: string; full_name: string | null }[]
  submitLabel: string
  submitting: boolean
  onSubmit: (values: FormValues) => void
  onCancel?: () => void
  extra?: React.ReactNode
}) {
  const [values, setValues] = useState(initial)

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(values)
      }}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={labelClass}>Nome completo *</label>
          <input
            required
            value={values.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Data de nascimento</label>
          <input
            type="date"
            value={values.birth_date}
            onChange={(e) => set('birth_date', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Telemóvel</label>
          <input
            type="tel"
            placeholder="912 345 678"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>E-mail</label>
          <input
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Canal preferido</label>
          <select
            value={values.preferred_contact_channel}
            onChange={(e) => set('preferred_contact_channel', e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Origem</label>
          <select
            value={values.source}
            onChange={(e) => set('source', e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Interesse / tratamento</label>
          <input
            placeholder="ex.: Ortodontia, Implantes"
            value={values.interest}
            onChange={(e) => set('interest', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Valor estimado (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.estimated_value}
            onChange={(e) => set('estimated_value', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Responsável</label>
          <select
            value={values.responsible_user_id}
            onChange={(e) => set('responsible_user_id', e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? u.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-2 rounded-md border border-gray-200 p-3">
        <legend className="px-1 text-xs font-medium text-gray-600">
          Consentimentos (RGPD)
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.consent_communication}
            onChange={(e) => set('consent_communication', e.target.checked)}
          />
          Aceita ser contactado sobre consultas e tratamentos
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.consent_marketing}
            onChange={(e) => set('consent_marketing', e.target.checked)}
          />
          Aceita receber campanhas e promoções
        </label>
        <div className="flex flex-wrap gap-4 pt-1 text-sm">
          <span className="text-xs text-gray-600">Canais autorizados:</span>
          {CHANNELS.map((c) => (
            <label key={c.value} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={!!values.communication_preferences[c.value]}
                onChange={(e) =>
                  set('communication_preferences', {
                    ...values.communication_preferences,
                    [c.value]: e.target.checked,
                  })
                }
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      {extra}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 hover:bg-brand-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'A guardar…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

export function PatientsBoard({
  initialPatients,
  initialDeals,
  users,
  canEdit,
  canCreateDeals,
}: {
  initialPatients: PatientRow[]
  initialDeals: DealRef[]
  users: { id: string; full_name: string | null }[]
  canEdit: boolean
  canCreateDeals: boolean
}) {
  const [patients, setPatients] = useState(initialPatients)
  const [deals, setDeals] = useState(initialDeals)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [creating, setCreating] = useState(false)
  const [addToFunnel, setAddToFunnel] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const stageByPatient = useMemo(
    () => new Map(deals.map((d) => [d.patient_id, d.funnel_stage])),
    [deals]
  )
  const userName = useMemo(
    () => new Map(users.map((u) => [u.id, u.full_name ?? '—'])),
    [users]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const qDigits = q.replace(/\D/g, '')
    return patients.filter((p) => {
      if (!showInactive && !p.active) return false
      if (!q) return true
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.email ?? '').includes(q) ||
        (qDigits.length >= 3 && (p.phone ?? '').includes(qDigits))
      )
    })
  }, [patients, search, showInactive])

  function findDuplicate(phone: string | null, email: string | null, exceptId?: string) {
    return patients.find(
      (p) =>
        p.id !== exceptId &&
        ((phone && p.phone === phone) || (email && p.email === email))
    )
  }

  async function createDeal(patient: PatientRow) {
    const supabase = createClient()
    const { error } = await supabase.from('deals').insert({
      patient_id: patient.id,
      responsible_user_id: patient.responsible_user_id,
      estimated_value: patient.estimated_value,
    })
    if (error) {
      setError(`Paciente guardado, mas não foi possível adicioná-lo ao funil: ${error.message}`)
      return
    }
    setDeals((current) => [
      ...current,
      { patient_id: patient.id, funnel_stage: 'novo_lead' },
    ])
  }

  async function handleCreate(values: FormValues) {
    setError(null)
    setNotice(null)
    const payload = toPayload(values)

    const duplicate = findDuplicate(payload.phone, payload.email)
    if (duplicate) {
      setError(
        `Já existe um paciente com este telemóvel ou e-mail: ${duplicate.full_name}.`
      )
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('patients')
      .insert(payload)
      .select(PATIENT_COLUMNS)
      .single<PatientRow>()

    if (error || !data) {
      setSubmitting(false)
      setError(`Não foi possível criar o paciente: ${error?.message}`)
      return
    }

    setPatients((current) => [data, ...current])
    if (canCreateDeals && addToFunnel) {
      await createDeal(data)
    }
    setSubmitting(false)
    setCreating(false)
    setNotice(`Paciente ${data.full_name} criado.`)
  }

  async function handleUpdate(patient: PatientRow, values: FormValues) {
    setError(null)
    setNotice(null)
    const payload = toPayload(values, patient)

    const duplicate = findDuplicate(payload.phone, payload.email, patient.id)
    if (duplicate) {
      setError(
        `Já existe outro paciente com este telemóvel ou e-mail: ${duplicate.full_name}.`
      )
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('patients')
      .update(payload)
      .eq('id', patient.id)
      .select(PATIENT_COLUMNS)
      .single<PatientRow>()
    setSubmitting(false)

    if (error || !data) {
      setError(`Não foi possível guardar: ${error?.message}`)
      return
    }

    setPatients((current) => current.map((p) => (p.id === data.id ? data : p)))
    setEditingId(null)
    setNotice(`Ficha de ${data.full_name} atualizada.`)
  }

  async function toggleActive(patient: PatientRow) {
    setError(null)
    setNotice(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('patients')
      .update({ active: !patient.active })
      .eq('id', patient.id)

    if (error) {
      setError(`Não foi possível alterar o estado: ${error.message}`)
      return
    }
    setPatients((current) =>
      current.map((p) =>
        p.id === patient.id ? { ...p, active: !patient.active } : p
      )
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Pesquisar por nome, telemóvel ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-80 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar arquivados
        </label>
        {canEdit && !creating && (
          <button
            onClick={() => {
              setCreating(true)
              setEditingId(null)
            }}
            className="ml-auto rounded-md bg-brand-600 hover:bg-brand-700 px-3 py-1.5 text-sm font-medium text-white"
          >
            Novo paciente
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      {creating && (
        <PatientForm
          initial={EMPTY_FORM}
          users={users}
          submitLabel="Criar paciente"
          submitting={submitting}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
          extra={
            canCreateDeals && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addToFunnel}
                  onChange={(e) => setAddToFunnel(e.target.checked)}
                />
                Adicionar ao funil comercial (etapa &quot;Novo lead&quot;)
              </label>
            )
          }
        />
      )}

      <p className="text-xs text-gray-500">
        {filtered.length} paciente{filtered.length === 1 ? '' : 's'}
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="data-table">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600">
              <th className="py-2">Nome</th>
              <th className="py-2">Contacto</th>
              <th className="py-2">Interesse</th>
              <th className="py-2">Funil</th>
              <th className="py-2">Responsável</th>
              <th className="py-2">RGPD</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const stage = stageByPatient.get(p.id)
              if (editingId === p.id) {
                return (
                  <tr key={p.id}>
                    <td colSpan={7} className="py-2">
                      <PatientForm
                        initial={toFormValues(p)}
                        users={users}
                        submitLabel="Guardar alterações"
                        submitting={submitting}
                        onSubmit={(values) => handleUpdate(p, values)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                )
              }
              return (
                <tr
                  key={p.id}
                  className={`border-b border-gray-100 align-top ${p.active ? '' : 'text-gray-400'}`}
                >
                  <td className="py-2 pr-2 font-medium">
                    {p.full_name}
                    {!p.active && <span className="ml-1 text-xs">(arquivado)</span>}
                    {p.chatwoot_conversation_link && (
                      <a
                        href={p.chatwoot_conversation_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block text-xs font-normal text-brand-700 underline"
                      >
                        Abrir conversa
                        {p.last_interaction_at &&
                          ` · ${dateTime.format(new Date(p.last_interaction_at))}`}
                      </a>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <div>{p.phone ?? '—'}</div>
                    <div className="text-xs text-gray-500">{p.email}</div>
                  </td>
                  <td className="py-2 pr-2">
                    <div>{p.interest ?? '—'}</div>
                    {p.estimated_value != null && (
                      <div className="text-xs text-gray-500">
                        {currency.format(p.estimated_value)}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {stage ? (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${FUNNEL_STAGE_COLORS[stage].badge}`}
                      >
                        {FUNNEL_STAGE_LABELS[stage]}
                      </span>
                    ) : canCreateDeals && p.active ? (
                      <button
                        onClick={() => createDeal(p)}
                        className="text-xs text-gray-600 underline"
                      >
                        Adicionar ao funil
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {p.responsible_user_id
                      ? userName.get(p.responsible_user_id) ?? '—'
                      : '—'}
                  </td>
                  <td className="py-2 pr-2 text-xs">
                    {p.consent_communication ? 'Contacto ✓' : 'Contacto ✗'}
                    <br />
                    {p.consent_marketing ? 'Marketing ✓' : 'Marketing ✗'}
                  </td>
                  <td className="space-x-2 py-2 text-right whitespace-nowrap">
                    {canEdit && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(p.id)
                            setCreating(false)
                          }}
                          className="text-xs text-gray-600 underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleActive(p)}
                          className="text-xs text-gray-600 underline"
                        >
                          {p.active ? 'Arquivar' : 'Reativar'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
