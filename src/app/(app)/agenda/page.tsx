import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { AgendaBoard, type AppointmentRow } from '@/components/agenda-board'

const MANAGE_ROLES = ['administrador', 'gestor', 'recepcao']

export default async function AgendaPage() {
  const profile = await requireRole([
    'administrador',
    'gestor',
    'recepcao',
    'profissional',
  ])

  const supabase = await createClient()
  const canManage = MANAGE_ROLES.includes(profile.role)

  const { data: appointments } = await supabase
    .from('appointments')
    .select(
      'id, status, scheduled_at, notes, patient:patients(full_name), professional:users(full_name)'
    )
    .order('scheduled_at', { ascending: true })

  let patients: { id: string; full_name: string }[] = []
  let professionals: { id: string; full_name: string | null }[] = []

  if (canManage) {
    const [{ data: patientsData }, { data: professionalsData }] =
      await Promise.all([
        supabase
          .from('patients')
          .select('id, full_name')
          .eq('active', true)
          .order('full_name'),
        supabase
          .from('users')
          .select('id, full_name')
          .eq('role', 'profissional')
          .eq('active', true),
      ])
    patients = patientsData ?? []
    professionals = professionalsData ?? []
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Agenda</h1>
      <p className="mb-4 text-sm text-gray-500">
        {canManage
          ? 'Marque consultas/avaliações e atualize o estado de cada uma.'
          : 'As suas consultas e avaliações.'}
      </p>
      <AgendaBoard
        initialAppointments={(appointments as unknown as AppointmentRow[]) ?? []}
        patients={patients}
        professionals={professionals}
        canManage={canManage}
      />
    </div>
  )
}
