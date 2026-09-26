import { NextResponse } from 'next/server'
import {
  authenticateAgent,
  badRequest,
  findPatient,
  formatLisbon,
  readIdentity,
  readText,
  rememberConversationRef,
} from '@/lib/agent-api'

// Ferramenta responder_lembrete: o paciente respondeu ao lembrete (ou fala
// da próxima consulta). Confirmar => consulta "confirmada" e a tarefa
// "Confirmar consulta" fica concluída. Remarcar/cancelar => a assistente não
// mexe na agenda: cria uma tarefa para a receção tratar com o paciente.

const ACTIONS = ['confirmar', 'remarcar', 'cancelar'] as const
type Action = (typeof ACTIONS)[number]
const LOOKAHEAD_DAYS = 8

export async function POST(request: Request) {
  const ctx = await authenticateAgent(request)
  if (ctx instanceof NextResponse) return ctx

  const body = await request.json().catch(() => ({}))
  const identity = readIdentity(body)
  const acao = readText(body, 'acao', 20)?.toLowerCase() as Action | undefined
  const observacoes = readText(body, 'observacoes', 1000)

  if (!acao || !ACTIONS.includes(acao)) {
    return badRequest('acao tem de ser confirmar, remarcar ou cancelar.')
  }

  await rememberConversationRef(ctx, identity)
  const patient = await findPatient(ctx, identity)
  if (!patient) {
    return NextResponse.json({ erro: 'Este contacto não está registado no CRM.' }, { status: 422 })
  }

  const until = new Date(Date.now() + LOOKAHEAD_DAYS * 86_400_000).toISOString()
  const { data: appointment } = await ctx.supabase
    .from('appointments')
    .select('id, scheduled_at, status, professional:users(full_name)')
    .eq('organization_id', ctx.organizationId)
    .eq('patient_id', patient.id)
    .in('status', ['marcada', 'confirmada'])
    .gte('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', until)
    .order('scheduled_at')
    .limit(1)
    .maybeSingle<{
      id: string
      scheduled_at: string
      status: string
      professional: { full_name: string | null } | null
    }>()

  if (!appointment) {
    return NextResponse.json(
      { erro: 'Não há nenhuma consulta marcada nos próximos dias para este contacto.' },
      { status: 422 }
    )
  }

  const quando = `${formatLisbon(appointment.scheduled_at)}${
    appointment.professional?.full_name ? ` com ${appointment.professional.full_name}` : ''
  }`

  if (acao === 'confirmar') {
    await ctx.supabase
      .from('appointments')
      .update({ status: 'confirmada' })
      .eq('id', appointment.id)
      .eq('organization_id', ctx.organizationId)
    await ctx.supabase
      .from('tasks')
      .update({ status: 'concluida', completed_at: new Date().toISOString() })
      .eq('organization_id', ctx.organizationId)
      .eq('appointment_id', appointment.id)
      .eq('status', 'pendente')
      .eq('title', 'Confirmar consulta')

    return NextResponse.json({ ok: true, consulta: quando, mensagem: 'Consulta confirmada.' })
  }

  const label = acao === 'remarcar' ? 'Remarcar consulta' : 'Cancelamento de consulta'
  await ctx.supabase.from('tasks').insert({
    organization_id: ctx.organizationId,
    patient_id: patient.id,
    appointment_id: appointment.id,
    title: `${label} — ${patient.full_name}`.slice(0, 200),
    description: [
      `Consulta: ${quando}.`,
      observacoes && `Indicação do paciente: ${observacoes}`,
      patient.phone && `Telemóvel: ${patient.phone}`,
      patient.chatwoot_conversation_link && `Conversa: ${patient.chatwoot_conversation_link}`,
      'Pedido feito ao assistente virtual — tratar com o paciente.',
    ]
      .filter(Boolean)
      .join('\n'),
    due_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
  })

  return NextResponse.json({
    ok: true,
    consulta: quando,
    mensagem:
      acao === 'remarcar'
        ? 'Pedido de remarcação registado; a equipa vai contactar o paciente.'
        : 'Pedido de cancelamento registado; a equipa vai tratar e confirmar com o paciente.',
  })
}
