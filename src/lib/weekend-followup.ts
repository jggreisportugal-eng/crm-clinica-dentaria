import { createHmac } from 'node:crypto'
import type { AgentContext } from '@/lib/agent-api'
import { FUNNEL_STAGE_LABELS, type FunnelStage } from '@/lib/funnel-stages'

// Follow-up de "bom fim de semana" (sextas, chamado pelo n8n). Mesmo caminho
// dos lembretes de consulta: com conversation_ref => evento para o webhook
// "Generic" do fazer.ai e a assistente escreve na conversa; sem ref (ou ref
// que o fazer.ai já não reconhece) => tarefa para a receção telefonar.
// As regras de quem recebe estão em deals_due_weekend_followup; cada envio é
// reservado com claim_weekend_followup, por isso correr duas vezes na mesma
// sexta não envia duas mensagens.

interface DueDeal {
  deal_id: string
  patient_id: string
  patient_name: string
  patient_phone: string | null
  funnel_stage: FunnelStage
  stage_changed_at: string
  followup_count: number
  last_followup_at: string | null
  conversation_ref: string | null
  exhausted: boolean
}

export interface WeekendFollowupSummary {
  negocios: number
  whatsapp: number
  tarefa: number
  decidir: number
  falhas: number
}

const dateFormat = new Intl.DateTimeFormat('pt-PT', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Lisbon',
})

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

// Texto do evento para a assistente: são os factos; o tom vem das
// instruções da integração no fazer.ai.
export function followupText(d: DueDeal) {
  const stage = FUNNEL_STAGE_LABELS[d.funnel_stage].toLowerCase()
  const subject = d.funnel_stage === 'avaliacao_realizada' ? 'tratamento' : 'orçamento'
  return [
    `Follow-up de fim de semana para ${firstName(d.patient_name)}.`,
    `Fase: ${stage} desde ${dateFormat.format(new Date(d.stage_changed_at))}.`,
    `Deseje um bom fim de semana e pergunte, sem pressão, se já tem alguma posição sobre o ${subject} ou se ficou alguma dúvida que possamos esclarecer. Não mencione preços nem prazos de oferta.`,
  ].join('\n')
}

async function callTask(ctx: AgentContext, d: DueDeal, reason: string) {
  await ctx.supabase.from('tasks').insert({
    organization_id: ctx.organizationId,
    patient_id: d.patient_id,
    deal_id: d.deal_id,
    title: `Follow-up de fim de semana — ligar a ${d.patient_name}`.slice(0, 200),
    description: [
      `${FUNNEL_STAGE_LABELS[d.funnel_stage]} desde ${dateFormat.format(new Date(d.stage_changed_at))}.`,
      'Desejar bom fim de semana e perguntar, sem pressão, se já tem uma posição ou alguma dúvida. Não falar de preços nem prazos de oferta.',
      `Telemóvel: ${d.patient_phone ?? '—'}`,
      reason,
    ].join('\n'),
    due_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
  })
  await logSent(ctx, d, 'tarefa')
}

async function logSent(ctx: AgentContext, d: DueDeal, channel: 'whatsapp' | 'tarefa') {
  await ctx.supabase.rpc('log_weekend_followup', {
    p_organization_id: ctx.organizationId,
    p_deal_id: d.deal_id,
    p_channel: channel,
  })
}

async function release(ctx: AgentContext, d: DueDeal) {
  await ctx.supabase.rpc('release_weekend_followup', {
    p_organization_id: ctx.organizationId,
    p_deal_id: d.deal_id,
    p_previous_last_at: d.last_followup_at,
    p_previous_count: d.followup_count,
  })
}

export async function runWeekendFollowups(
  ctx: AgentContext
): Promise<WeekendFollowupSummary | { erro: string }> {
  const [{ data: due, error }, { data: webhook }] = await Promise.all([
    ctx.supabase.rpc('deals_due_weekend_followup', { p_organization_id: ctx.organizationId }),
    ctx.supabase
      .from('agent_webhooks')
      .select('inbound_url, secret')
      .eq('organization_id', ctx.organizationId)
      .eq('active', true)
      .maybeSingle(),
  ])

  if (error) {
    console.error('[agent/followup-fim-de-semana]', error.message)
    return { erro: 'Não foi possível obter os negócios.' }
  }

  const deals = (due ?? []) as DueDeal[]
  const summary: WeekendFollowupSummary = {
    negocios: deals.length,
    whatsapp: 0,
    tarefa: 0,
    decidir: 0,
    falhas: 0,
  }

  for (const d of deals) {
    const { data: action, error: claimError } = await ctx.supabase.rpc('claim_weekend_followup', {
      p_organization_id: ctx.organizationId,
      p_deal_id: d.deal_id,
    })
    if (claimError) {
      console.error('[agent/followup-fim-de-semana] claim', claimError.message, d.deal_id)
      summary.falhas++
      continue
    }
    if (action === 'decidir') {
      summary.decidir++
      continue
    }
    if (action !== 'enviar') continue

    if (!d.conversation_ref || !webhook) {
      await callTask(
        ctx,
        d,
        webhook
          ? 'O paciente ainda não falou com a assistente pelo WhatsApp.'
          : 'Follow-ups pelo WhatsApp não configurados para esta clínica.'
      )
      summary.tarefa++
      continue
    }

    // Um event_id por envio: se o fazer.ai receber o mesmo evento duas
    // vezes (retry), não escreve duas mensagens.
    const body = JSON.stringify({
      event_id: `followup-fds-${d.deal_id}-${d.followup_count + 1}`,
      conversation_ref: d.conversation_ref,
      text: followupText(d),
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
        console.error('[agent/followup-fim-de-semana] fazer.ai', res.status, d.deal_id)
        await release(ctx, d)
        summary.falhas++
        continue
      }
      if (result?.outcome === 'uncorrelated') {
        await callTask(ctx, d, 'A conversa do WhatsApp já não é reconhecida pela assistente.')
        summary.tarefa++
        continue
      }
      await logSent(ctx, d, 'whatsapp')
      summary.whatsapp++
    } catch (e) {
      console.error('[agent/followup-fim-de-semana] fazer.ai', (e as Error).message, d.deal_id)
      await release(ctx, d)
      summary.falhas++
    }
  }

  return summary
}
