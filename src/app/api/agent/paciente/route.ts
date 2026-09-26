import { NextResponse } from 'next/server'
import {
  authenticateAgent,
  findPatient,
  formatLisbon,
  readIdentity,
  rememberConversationRef,
} from '@/lib/agent-api'
import { FUNNEL_STAGE_LABELS, type FunnelStage } from '@/lib/funnel-stages'

const BOOKING_TASK_PREFIX = 'Pedido de marcação'

// Ferramenta procurar_paciente: o agente fica a saber se quem está a falar
// já é paciente, o nome registado, a etapa comercial e a próxima consulta.
// Minimização (RGPD): nada de e-mail, data de nascimento ou valores.
export async function POST(request: Request) {
  const ctx = await authenticateAgent(request)
  if (ctx instanceof NextResponse) return ctx

  const body = await request.json().catch(() => ({}))
  const identity = readIdentity(body)
  await rememberConversationRef(ctx, identity)
  const patient = await findPatient(ctx, identity)

  if (!patient) {
    return NextResponse.json({
      encontrado: false,
      mensagem: 'Este contacto ainda não está registado no CRM.',
    })
  }

  const [{ data: deal }, { data: next }, { data: pendingRequests }] =
    await Promise.all([
      ctx.supabase
        .from('deals')
        .select('funnel_stage')
        .eq('organization_id', ctx.organizationId)
        .eq('patient_id', patient.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ funnel_stage: FunnelStage }>(),
      ctx.supabase
        .from('appointments')
        .select('scheduled_at, professional:users(full_name)')
        .eq('organization_id', ctx.organizationId)
        .eq('patient_id', patient.id)
        .in('status', ['marcada', 'confirmada'])
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at')
        .limit(1)
        .maybeSingle<{ scheduled_at: string; professional: { full_name: string | null } | null }>(),
      ctx.supabase
        .from('tasks')
        .select('title')
        .eq('organization_id', ctx.organizationId)
        .eq('patient_id', patient.id)
        .eq('status', 'pendente')
        .ilike('title', `${BOOKING_TASK_PREFIX}%`)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  // O título da tarefa é "Pedido de marcação — <tratamento> — <nome>": o
  // agente precisa de saber PARA QUEM é cada pedido (pode ser de um filho
  // feito pelo mesmo WhatsApp), não só que existe um.
  const pedidos = (pendingRequests ?? []).map((t) =>
    t.title.replace(BOOKING_TASK_PREFIX, '').replace(/^\s*—\s*/, '')
  )

  return NextResponse.json({
    encontrado: true,
    nome: patient.full_name,
    interesse: patient.interest,
    etapa: deal ? FUNNEL_STAGE_LABELS[deal.funnel_stage] : null,
    proxima_consulta: next
      ? `${formatLisbon(next.scheduled_at)}${next.professional?.full_name ? ` com ${next.professional.full_name}` : ''}`
      : null,
    pedido_marcacao_pendente: pedidos.length > 0,
    pedidos_pendentes: pedidos,
  })
}
