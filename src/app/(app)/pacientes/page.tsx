import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import {
  PatientsBoard,
  type DealRef,
  type PatientRow,
} from '@/components/patients-board'
import { PATIENT_COLUMNS } from '@/lib/patient-columns'

// Todas as queries passam pela RLS: pacientes da própria organização;
// deals só para perfis do Funil (Receção recebe lista vazia); users só a
// lista completa para Administrador (os outros veem o próprio registo).
export default async function PacientesPage() {
  const profile = await requireRole([
    'administrador',
    'gestor',
    'recepcao',
    'comercial',
  ])

  const supabase = await createClient()

  const [{ data: patients, error }, { data: deals }, { data: users }] =
    await Promise.all([
      supabase
        .from('patients')
        .select(PATIENT_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(1000)
        .returns<PatientRow[]>(),
      supabase
        .from('deals')
        .select('patient_id, funnel_stage')
        .eq('active', true)
        .returns<DealRef[]>(),
      supabase
        .from('users')
        .select('id, full_name')
        .eq('active', true)
        .order('full_name'),
    ])

  return (
    <div className="space-y-4 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Pacientes</h1>
      {error && <p className="text-sm text-red-600">{error.message}</p>}
      <PatientsBoard
        initialPatients={patients ?? []}
        initialDeals={deals ?? []}
        users={users ?? []}
        canEdit
        canCreateDeals={['administrador', 'gestor', 'comercial'].includes(
          profile.role
        )}
      />
    </div>
  )
}
