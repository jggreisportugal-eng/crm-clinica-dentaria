import { requireRole } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { TreatmentsBoard, type TreatmentRow } from '@/components/treatments-board'

const CREATE_ROLES = ['administrador', 'gestor']

export default async function TratamentosPage() {
  const profile = await requireRole(['administrador', 'gestor', 'profissional'])

  const supabase = await createClient()
  const canCreate = CREATE_ROLES.includes(profile.role)

  const { data: treatments } = await supabase
    .from('treatments')
    .select(
      'id, treatment_type, treatment_plan, budget, status, patient:patients(full_name), professional:users(full_name), deal:deals(funnel_stage)'
    )
    .eq('active', true)
    .order('created_at', { ascending: false })

  let patients: { id: string; full_name: string }[] = []
  let deals: { id: string; patient_id: string; funnel_stage: string }[] = []
  let professionals: { id: string; full_name: string | null }[] = []

  if (canCreate) {
    const [{ data: patientsData }, { data: dealsData }, { data: professionalsData }] =
      await Promise.all([
        supabase
          .from('patients')
          .select('id, full_name')
          .eq('active', true)
          .order('full_name'),
        supabase
          .from('deals')
          .select('id, patient_id, funnel_stage')
          .eq('active', true),
        supabase
          .from('users')
          .select('id, full_name')
          .eq('role', 'profissional')
          .eq('active', true),
      ])
    patients = patientsData ?? []
    deals = dealsData ?? []
    professionals = professionalsData ?? []
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Tratamentos</h1>
      <p className="mb-4 text-sm text-gray-500">
        Acompanhamento comercial de tratamentos — plano, orçamento e status.
      </p>
      <TreatmentsBoard
        initialTreatments={(treatments as unknown as TreatmentRow[]) ?? []}
        patients={patients}
        deals={deals}
        professionals={professionals}
        canCreate={canCreate}
      />
    </div>
  )
}
