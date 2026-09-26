import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { authenticateAgent, type AgentContext } from '@/lib/agent-api'

// Lembretes das consultas de amanhã (hora de Lisboa). Chamado uma vez por
// dia pelo n8n com uma chave da API do agente da organização.
//
// Paciente com conversation_ref (já falou com a assistente e uma ferramenta
// do CRM correu nessa conversa) => evento para o webhook "Generic" do
// fazer.ai, e é a assistente que escreve o lembrete na conversa (fica no
// histórico dela, que assim percebe a resposta do paciente). Sem ref, ou se
// o fazer.ai não reconhecer a ref => tarefa para a receção telefonar.
// Cada consulta só é lembrada uma vez (appointments.reminder_sent_at).

interface DueAppointment {
  appointment_id: string
  patient_id: string
  patient_name: string
  patient_phone: string | null
  scheduled_at: string
  professional_name: string | null
  conversation_ref: string | null
}

const dayFormat = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Lisbon',
})
const timeFormat = new Intl.DateTimeFormat('pt-PT', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Lisbon',
})

function describe(a: DueAppointment) {
  const when = new Date(a.scheduled_at)
  const who = a.professional_name ? ` com ${a.professional_name}` : ''
  return `amanhã, ${dayFormat.format(when)}, às ${timeFormat.format(when)}${who}`
}

// Texto do evento para a assistente: são os factos a transmitir; o tom e a
// forma vêm das instruções da integração no fazer.ai.
function reminderText(a: DueAppointment, clinicName: string) {
  return [
    `Lembrete de consulta para ${a.patient_name}.`,
    `Consulta na ${clinicName}: ${describe(a)}.`,
    'Peça ao paciente que confirme a presença respondendo a esta mensagem, ou que diga se precisa de remarcar ou cancelar.',
  ].join('\n')
}

async function markSent(ctx: AgentContext, appointmentId: string, channel: 'whatsapp' | 'tarefa') {
  await ctx.supabase
    .from('appointments')
    .update({ reminder_sent_at: new Date().toISOString(), reminder_channel: channel })
    .eq('id', appointmentId)
    .eq('organization_id', ctx.organizationId)
}

async function callTask(ctx: AgentContext, a: DueAppointment, reason: string) {
  await ctx.supabase.from('tasks').insert({
    organization_id: ctx.organizationId,
    patient_id: a.patient_id,
    appointment_id: a.appointment_id,
    title: `Lembrar consulta por telefone — ${a.patient_name}`.slice(0, 200),
    description: [
      `Consulta ${describe(a)}.`,
      `Telemóvel: ${a.patient_phone ?? '—'}`,
      reason,
    ].join('\n'),
    due_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
  })
  await markSent(ctx, a.appointment_id, 'tarefa')
}

export async function POST(request: Request) {
  const ctx = await authenticateAgent(request)
  if (ctx instanceof NextResponse) return ctx

  const [{ data: due, error }, { data: webhook }, { data: org }] = await Promise.all([
    ctx.supabase.rpc('appointments_due_reminder', { p_organization_id: ctx.organizationId }),
    ctx.supabase
      .from('agent_webhooks')
      .select('inbound_url, secret')
      .eq('organization_id', ctx.organizationId)
      .eq('active', true)
      .maybeSingle(),
    ctx.supabase.from('organizations').select('name').eq('id', ctx.organizationId).single(),
  ])

  if (error) {
    console.error('[agent/lembretes]', error.message)
    return NextResponse.json({ erro: 'Não foi possível obter as consultas.' }, { status: 500 })
  }

  const summary = { whatsapp: 0, tarefa: 0, falhas: 0 }

  for (const a of (due ?? []) as DueAppointment[]) {
    if (!a.conversation_ref || !webhook) {
      await callTask(
        ctx,
        a,
        webhook
          ? 'O paciente ainda não falou com a assistente pelo WhatsApp.'
          : 'Lembretes pelo WhatsApp não configurados para esta clínica.'
      )
      summary.tarefa++
      continue
    }

    const body = JSON.stringify({
      event_id: `lembrete-${a.appointment_id}`,
      conversation_ref: a.conversation_ref,
      text: reminderText(a, org?.name ?? 'clínica'),
    })

    try {
      const res = await fetch(webhook.inbound_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': createHmac('sha256', webhook.secret).update(body).digest('hex'),
        },
        body,
        signal: AbortSignal.timeout(15_000),
      })
      const result = await res.json().catch(() => ({}))

      if (!res.ok) {
        console.error('[agent/lembretes] fazer.ai', res.status, a.appointment_id)
        summary.falhas++
        continue
      }
      if (result?.outcome === 'uncorrelated') {
        await callTask(ctx, a, 'A conversa do WhatsApp já não é reconhecida pela assistente.')
        summary.tarefa++
        continue
      }
      await markSent(ctx, a.appointment_id, 'whatsapp')
      summary.whatsapp++
    } catch (e) {
      console.error('[agent/lembretes] fazer.ai', (e as Error).message, a.appointment_id)
      summary.falhas++
    }
  }

  return NextResponse.json({ consultas: (due ?? []).length, ...summary })
}
