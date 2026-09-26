import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { TasksBoard, type TaskRow } from '@/components/tasks-board'

// Tarefas da clínica: pedidos de marcação do assistente virtual,
// confirmações de consulta e follow-ups. A RLS (tasks_select) limita à
// organização e aos perfis administrador/gestor/comercial/receção.
export default async function TarefasPage() {
  await requireRole(['administrador', 'gestor', 'comercial', 'recepcao'])

  const supabase = await createClient()
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(
      'id, title, description, due_at, status, created_at, patient:patients(full_name, phone, chatwoot_conversation_link)'
    )
    .order('status')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(300)
    .returns<TaskRow[]>()

  const renderedAt = new Date().getTime()

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Tarefas</h1>
      {error && <p className="text-sm text-red-600">{error.message}</p>}
      <TasksBoard initialTasks={tasks ?? []} now={renderedAt} />
    </div>
  )
}
