'use client'

import { useActionState, useTransition } from 'react'
import {
  createSiteForm,
  deactivateSiteForm,
  type FormActionState,
} from '@/app/(app)/admin/config/actions'

export interface SiteFormRow {
  id: string
  name: string
  allowed_origins: string[]
  default_interest: string | null
  active: boolean
}

const CRM_URL = 'https://crm.clinicsmart.cloud'
const initialState: FormActionState = {}
const inputClass = 'rounded-md border border-gray-300 px-3 py-1.5 text-sm'

export function SiteForms({ forms }: { forms: SiteFormRow[] }) {
  const [state, formAction, pending] = useActionState(createSiteForm, initialState)
  const [deactivating, startTransition] = useTransition()

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input name="name" required placeholder="Nome (ex.: Landing ortodontia)" className={`w-60 ${inputClass}`} />
        <input name="origin" required placeholder="Site (ex.: https://demo.clinicsmart.cloud)" className={`w-80 ${inputClass}`} />
        <input name="interest" placeholder="Interesse por defeito (opcional)" className={`w-60 ${inputClass}`} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? 'A criar…' : 'Criar formulário'}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">{state.success}</p>}

      {forms.length === 0 && (
        <p className="text-sm text-gray-500">Ainda não há formulários.</p>
      )}

      <ul className="space-y-3">
        {forms.map((f) => (
          <li
            key={f.id}
            className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${f.active ? '' : 'opacity-50'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-gray-900">
                {f.name}
                {!f.active && <span className="ml-2 text-xs text-gray-500">(desativado)</span>}
              </p>
              {f.active && (
                <button
                  type="button"
                  disabled={deactivating}
                  onClick={() => startTransition(() => deactivateSiteForm(f.id))}
                  className="text-xs text-red-700 underline disabled:opacity-50"
                >
                  Desativar
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Site autorizado: {f.allowed_origins.join(', ')}
              {f.default_interest && ` · Interesse: ${f.default_interest}`}
            </p>
            <p className="mt-2 text-xs text-gray-600">Endereço de envio (usar no código do site):</p>
            <code className="block break-all rounded bg-slate-50 px-2 py-1 font-mono text-xs text-gray-900">
              {CRM_URL}/api/public/leads/{f.id}
            </code>
          </li>
        ))}
      </ul>
    </div>
  )
}
