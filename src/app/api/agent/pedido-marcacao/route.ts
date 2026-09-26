import { NextResponse } from 'next/server'
import {
  authenticateAgent,
  badRequest,
  findPatient,
  readIdentity,
  readText,
} from '@/lib/agent-api'

const TASK_TITLE = 'Pedido de marcação'
// Um segundo pedido na mesma conversa (o paciente mudou de ideias sobre o
// dia) atualiza a tarefa pendente em vez de criar outra.
const MERGE_WINDOW_HOURS = 24
const DUE_IN_HOURS = 2

function firstName(name: string) {
  return name
    .trim()
    .split(/\s+/)[0]
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Ferramenta registar_pedido_marcacao: o agente não marca consultas — deixa
// um pedido para a receção (tarefa) com o que o paciente confirmou, e o
// negócio avança de "Novo lead" para "Contactado".
export async function POST(request: Request) {
  const ctx = await authenticateAgent(request)
  if (ctx instanceof NextResponse) return ctx

  const body = await request.json().catch(() => ({}))
  const identity = readIdentity(body)
  const nome = readText(body, 'nome', 120)
  const tratamento = readText(body, 'tratamento', 200)
  const preferencia = readText(body, 'preferencia', 300)
  const observacoes = readText(body, 'observacoes', 1000)

  if (!nome || !tratamento || !preferencia) {
    return badRequest('Faltam dados: nome, tratamento e preferência de dia/horário são obrigatórios.')
  }
  if (!identity.conversationId && !identity.phone) {
    return badRequest('Sem conversa associada: o pedido só pode ser registado numa conversa real.')
  }

  let patient = await findPatient(ctx, identity)

  // A mensagem pode ter chegado antes do webhook do Chatwoot a registar:
  // cria o paciente pelo mesmo caminho atómico do webhook (sem duplicar).
  if (!patient && identity.conversationId) {
    await ctx.supabase.rpc('chatwoot_ingest', {
      p_organization_id: ctx.organizationId,
      p_chatwoot_conversation_id: identity.conversationId,
      p_chatwoot_contact_id: identity.contactId,
      p_contact_name: nome,
      p_phone: identity.phone,
      p_email: null,
      p_channel: 'whatsapp',
      p_conversation_status: null,
      p_conversation_link: null,
    })
    patient = await findPatient(ctx, identity)
  }

  if (!patient) {
    return NextResponse.json(
      { erro: 'Não foi possível identificar o paciente desta conversa.' },
      { status: 422 }
    )
  }

  // O pedido pode ser para outra pessoa (um filho, o cônjuge) a escrever do
  // mesmo WhatsApp: nesse caso a ficha do contacto não é tocada e a tarefa
  // diz para quem é. É a mesma pessoa se o primeiro nome coincide ou se a
  // ficha ainda não tem nome (só o telefone).
  const unnamed =
    patient.full_name === patient.phone || patient.full_name === 'Contacto Chatwoot'
  const samePerson = unnamed || firstName(patient.full_name) === firstName(nome)

  if (samePerson) {
    // O paciente criado pelo webhook tem o nome do perfil do WhatsApp (ou o
    // telefone); o nome confirmado na conversa substitui-o.
    const profileName =
      unnamed || (identity.contactName != null && patient.full_name === identity.contactName)
    await ctx.supabase
      .from('patients')
      .update({
        ...(profileName ? { full_name: nome } : {}),
        ...(patient.interest ? {} : { interest: tratamento }),
      })
      .eq('id', patient.id)
      .eq('organization_id', ctx.organizationId)
  }

  const { data: deal } = await ctx.supabase
    .from('deals')
    .select('id, funnel_stage')
    .eq('organization_id', ctx.organizationId)
    .eq('patient_id', patient.id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (deal?.funnel_stage === 'novo_lead') {
    await ctx.supabase
      .from('deals')
      .update({ funnel_stage: 'contactado' })
      .eq('id', deal.id)
  }

  const description = [
    `Nome indicado: ${nome}`,
    !samePerson && `Pedido feito por: ${patient.full_name} (contacto desta conversa)`,
    `Tratamento: ${tratamento}`,
    `Preferência de dia/horário: ${preferencia}`,
    observacoes && `Observações: ${observacoes}`,
    patient.phone && `Telemóvel: ${patient.phone}`,
    patient.chatwoot_conversation_link && `Conversa: ${patient.chatwoot_conversation_link}`,
    'Registado pelo assistente virtual — confirmar a marcação com o paciente.',
  ]
    .filter(Boolean)
    .join('\n')

  const since = new Date(Date.now() - MERGE_WINDOW_HOURS * 3600_000).toISOString()
  const { data: recent } = await ctx.supabase
    .from('tasks')
    .select('id, description')
    .eq('organization_id', ctx.organizationId)
    .eq('patient_id', patient.id)
    .eq('status', 'pendente')
    .ilike('title', `${TASK_TITLE}%`)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10)

  // Só atualiza o pedido pendente da MESMA pessoa (primeira linha da
  // descrição); o pedido para um filho não substitui o do pai.
  const pending = (recent ?? []).find(
    (t) => firstName(t.description?.split('\n')[0]?.replace('Nome indicado:', '') ?? '') === firstName(nome)
  )

  const title = `${TASK_TITLE} — ${tratamento} — ${nome}`.slice(0, 200)
  const { error } = pending
    ? await ctx.supabase
        .from('tasks')
        .update({ title, description })
        .eq('id', pending.id)
    : await ctx.supabase.from('tasks').insert({
        organization_id: ctx.organizationId,
        patient_id: patient.id,
        deal_id: deal?.id ?? null,
        title,
        description,
        due_at: new Date(Date.now() + DUE_IN_HOURS * 3600_000).toISOString(),
      })

  if (error) {
    console.error('[agent/pedido-marcacao]', error.message)
    return NextResponse.json({ erro: 'Não foi possível registar o pedido.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    atualizado: Boolean(pending),
    mensagem:
      'Pedido de marcação registado. A equipa da clínica vai confirmar o dia e a hora com o paciente.',
  })
}
