'use client'

import { useActionState, useTransition } from 'react'
import {
  createAgentKey,
  revokeAgentKey,
  type KeyActionState,
} from '@/app/(app)/admin/config/actions'

export interface AgentKeyRow {
  id: string
  name: string
  key_prefix: string
  active: boolean
  created_at: string
  last_used_at: string | null
}

const dateTime = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Lisbon',
})

const initialState: KeyActionState = {}

export function AgentKeys({ keys }: { keys: AgentKeyRow[] }) {
  const [state, formAction, pending] = useActionState(createAgentKey, initialState)
  const [revoking, startTransition] = useTransition()

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          name="name"
          placeholder="Nome (ex.: Maria — fazer.ai)"
          className="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? 'A gerar…' : 'Gerar nova chave'}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.newKey && (
        <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">
            Copie a chave agora — não volta a ser mostrada.
          </p>
          <code className="block break-all rounded bg-white px-2 py-1 font-mono text-xs text-gray-900">
            {state.newKey}
          </code>
          <p className="text-xs text-amber-800">
            Cole-a no cofre (vault) do fazer.ai. Não a envie por chat ou e-mail.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="data-table">
          <thead>
            <tr>
              <th className="py-2">Nome</th>
              <th className="py-2">Chave</th>
              <th className="py-2">Criada</th>
              <th className="py-2">Último uso</th>
              <th className="py-2">Estado</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-gray-500">
                  Ainda não há chaves.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className={`border-t border-gray-100 ${k.active ? '' : 'text-gray-400'}`}>
                <td className="py-2">{k.name}</td>
                <td className="py-2 font-mono text-xs">{k.key_prefix}…</td>
                <td className="py-2">{dateTime.format(new Date(k.created_at))}</td>
                <td className="py-2">
                  {k.last_used_at ? dateTime.format(new Date(k.last_used_at)) : '—'}
                </td>
                <td className="py-2">{k.active ? 'Ativa' : 'Revogada'}</td>
                <td className="py-2 text-right">
                  {k.active && (
                    <button
                      type="button"
                      disabled={revoking}
                      onClick={() => startTransition(() => revokeAgentKey(k.id))}
                      className="text-xs text-red-700 underline disabled:opacity-50"
                    >
                      Revogar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
