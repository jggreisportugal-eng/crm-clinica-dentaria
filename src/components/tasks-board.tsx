'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface TaskRow {
  id: string
  title: string
  description: string | null
  due_at: string | null
  status: 'pendente' | 'concluida' | 'cancelada'
  created_at: string
  patient: {
    full_name: string
    phone: string | null
    chatwoot_conversation_link: string | null
  } | null
}

const dateTime = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Lisbon',
})

// now vem do servidor (hora do pedido): o "em atraso" não pode depender de
// Date.now() durante o render.
export function TasksBoard({
  initialTasks,
  now,
}: {
  initialTasks: TaskRow[]
  now: number
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [showDone, setShowDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visible = tasks.filter((t) => showDone || t.status === 'pendente')

  async function setStatus(task: TaskRow, status: TaskRow['status']) {
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({
        status,
        completed_at: status === 'concluida' ? new Date().toISOString() : null,
      })
      .eq('id', task.id)

    if (error) {
      setError(`Não foi possível atualizar a tarefa: ${error.message}`)
      return
    }
    setTasks((current) =>
      current.map((t) => (t.id === task.id ? { ...t, status } : t))
    )
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={showDone}
          onChange={(e) => setShowDone(e.target.checked)}
        />
        Mostrar concluídas e canceladas
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {visible.length === 0 && (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Sem tarefas pendentes.
        </p>
      )}

      <ul className="space-y-3">
        {visible.map((t) => {
          const overdue =
            t.status === 'pendente' && t.due_at && new Date(t.due_at).getTime() < now
          return (
            <li
              key={t.id}
              className={`rounded-lg border bg-white p-4 shadow-sm ${
                t.status === 'pendente'
                  ? overdue
                    ? 'border-l-4 border-rose-200 border-l-rose-500'
                    : 'border-l-4 border-gray-200 border-l-brand-500'
                  : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">{t.title}</p>
                  <p className="text-sm text-gray-600">
                    {t.patient?.full_name ?? 'Paciente'}
                    {t.patient?.phone && ` · ${t.patient.phone}`}
                    {t.patient?.chatwoot_conversation_link && (
                      <>
                        {' · '}
                        <a
                          href={t.patient.chatwoot_conversation_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-700 underline"
                        >
                          Abrir conversa
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>Criada {dateTime.format(new Date(t.created_at))}</div>
                  {t.due_at && (
                    <div className={overdue ? 'font-medium text-rose-600' : ''}>
                      Prazo {dateTime.format(new Date(t.due_at))}
                    </div>
                  )}
                </div>
              </div>

              {t.description && (
                <p className="mt-2 text-sm whitespace-pre-wrap text-gray-700">
                  {t.description}
                </p>
              )}

              <div className="mt-3 flex gap-2">
                {t.status === 'pendente' ? (
                  <>
                    <button
                      onClick={() => setStatus(t, 'concluida')}
                      className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      Concluir
                    </button>
                    <button
                      onClick={() => setStatus(t, 'cancelada')}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setStatus(t, 'pendente')}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    Reabrir
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
