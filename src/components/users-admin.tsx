'use client'

import { useActionState, useState, useTransition } from 'react'
import { ROLE_LABELS, type UserRole } from '@/lib/auth/nav-config'
import {
  createUser,
  resetPassword,
  setActive,
  updateRole,
  type ActionState,
} from '@/app/(app)/admin/users/actions'

export interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  active: boolean
}

const ROLES = Object.keys(ROLE_LABELS) as UserRole[]
const initialState: ActionState = {}

const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
const buttonClass =
  'rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50'
const secondaryButtonClass =
  'rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50'

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="text-xs text-red-600">{state.error}</p>
  if (state.success) return <p className="text-xs text-green-700">{state.success}</p>
  return null
}

function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initialState)

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-gray-900">Novo utilizador</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="fullName" required placeholder="Nome" className={inputClass} />
        <input
          name="email"
          type="email"
          required
          placeholder="E-mail"
          className={inputClass}
        />
        <select name="role" defaultValue="recepcao" className={inputClass}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <input
          name="password"
          type="text"
          required
          minLength={8}
          autoComplete="off"
          placeholder="Palavra-passe inicial (mín. 8)"
          className={inputClass}
        />
      </div>
      <p className="text-xs text-gray-500">
        Entregue a palavra-passe inicial à pessoa por um canal seguro.
      </p>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? 'A criar…' : 'Criar utilizador'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

function UserRowItem({ user, isMe }: { user: UserRow; isMe: boolean }) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateRole.bind(null, user.id),
    initialState
  )
  const [pwState, pwAction, pwPending] = useActionState(
    resetPassword.bind(null, user.id),
    initialState
  )
  const [activeState, setActiveState] = useState<ActionState>({})
  const [activePending, startTransition] = useTransition()
  const [showReset, setShowReset] = useState(false)

  function toggleActive() {
    startTransition(async () => {
      setActiveState(await setActive(user.id, !user.active))
    })
  }

  return (
    <tr className={`border-b border-gray-100 align-top ${user.active ? '' : 'text-gray-400'}`}>
      <td className="py-2 pr-2">
        {user.full_name ?? '—'}
        {isMe && <span className="ml-1 text-xs text-gray-500">(eu)</span>}
      </td>
      <td className="py-2 pr-2">{user.email}</td>
      <td className="py-2 pr-2">
        <form action={roleAction} className="flex items-center gap-2">
          <select
            name="role"
            defaultValue={user.role}
            disabled={isMe}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {!isMe && (
            <button type="submit" disabled={rolePending} className={secondaryButtonClass}>
              Guardar
            </button>
          )}
        </form>
        <Feedback state={roleState} />
      </td>
      <td className="py-2 pr-2">{user.active ? 'Ativo' : 'Desativado'}</td>
      <td className="space-y-1 py-2">
        <div className="flex flex-wrap gap-2">
          {!isMe && (
            <button
              type="button"
              onClick={toggleActive}
              disabled={activePending}
              className={secondaryButtonClass}
            >
              {user.active ? 'Desativar' : 'Reativar'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowReset((v) => !v)}
            className={secondaryButtonClass}
          >
            Redefinir palavra-passe
          </button>
        </div>
        {showReset && (
          <form action={pwAction} className="flex items-center gap-2">
            <input
              name="password"
              type="text"
              required
              minLength={8}
              autoComplete="off"
              placeholder="Nova (mín. 8)"
              className="w-36 rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
            <button type="submit" disabled={pwPending} className={secondaryButtonClass}>
              Guardar
            </button>
          </form>
        )}
        <Feedback state={activeState} />
        <Feedback state={pwState} />
      </td>
    </tr>
  )
}

export function UsersAdmin({ users, meId }: { users: UserRow[]; meId: string }) {
  return (
    <div className="space-y-6">
      <CreateUserForm />
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600">
            <th className="py-2">Nome</th>
            <th className="py-2">E-mail</th>
            <th className="py-2">Perfil</th>
            <th className="py-2">Estado</th>
            <th className="py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRowItem key={u.id} user={u} isMe={u.id === meId} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
