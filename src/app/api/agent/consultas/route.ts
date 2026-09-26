import { NextResponse } from 'next/server'
import {
  authenticateAgent,
  findPatient,
  formatLisbon,
  readIdentity,
  rememberConversationRef,
} from '@/lib/agent-api'
import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
} from '@/lib/appointment-status'

// Ferramenta consultas_do_paciente: próximas consultas de quem está a
// falar (marcadas ou confirmadas), para responder "quando é a minha
// consulta?" sem passar a conversa à equipa.
export async function POST(request: Request) {
  const ctx = await authenticateAgent(request)
  if (ctx instanceof NextResponse) return ctx

  const body = await request.json().catch(() => ({}))
  const identity = readIdentity(body)
  await rememberConversationRef(ctx, identity)
  const patient = await findPatient(ctx, identity)

  if (!patient) {
    return NextResponse.json({
      consultas: [],
      mensagem: 'Este contacto ainda não está registado no CRM.',
    })
  }

  const { data } = await ctx.supabase
    .from('appointments')
    .select('scheduled_at, status, professional:users(full_name)')
    .eq('organization_id', ctx.organizationId)
    .eq('patient_id', patient.id)
    .in('status', ['marcada', 'confirmada'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(5)
    .returns<
      {
        scheduled_at: string
        status: AppointmentStatus
        professional: { full_name: string | null } | null
      }[]
    >()

  const consultas = (data ?? []).map((a) => ({
    quando: formatLisbon(a.scheduled_at),
    profissional: a.professional?.full_name ?? null,
    estado: APPOINTMENT_STATUS_LABELS[a.status],
  }))

  return NextResponse.json({
    consultas,
    mensagem: consultas.length ? undefined : 'Sem consultas futuras marcadas.',
  })
}
