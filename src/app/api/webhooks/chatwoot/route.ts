import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/phone'

// Etapa 3.3 — recetor dos webhooks de conta do Chatwoot (Definições →
// Integrações → Webhooks). A organização é descoberta pelo account.id do
// payload (tabela chatwoot_integrations) e o pedido só é aceite com uma
// assinatura válida: X-Chatwoot-Signature = "sha256=" + HMAC-SHA256 de
// "<X-Chatwoot-Timestamp>.<corpo>" com o segredo desse webhook
// (lib/webhooks/trigger.rb do Chatwoot v4).

const MAX_CLOCK_SKEW_SECONDS = 300

interface ChatwootContact {
  id?: number
  name?: string | null
  phone_number?: string | null
  email?: string | null
}

interface ChatwootConversation {
  id?: number
  status?: string
  channel?: string
  meta?: { sender?: ChatwootContact }
}

interface ChatwootPayload {
  event?: string
  account?: { id?: number }
  // message_created
  id?: number
  content?: string | null
  message_type?: string
  private?: boolean
  created_at?: string | number
  sender?: ChatwootContact & { type?: string }
  inbox?: { id?: number; name?: string }
  conversation?: ChatwootConversation
  // conversation_* (o próprio payload é a conversa)
  status?: string
  channel?: string
  meta?: { sender?: ChatwootContact }
}

function validSignature(secret: string, timestamp: string, body: string, signature: string) {
  const expected = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function toDate(value: string | number | undefined) {
  if (value == null) return null
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// O canal real (WhatsApp via Evolution) chega como "Channel::Api"; só o
// nome da inbox o identifica, e esse só vem nos eventos de mensagem. Nos
// eventos de conversa devolve null e a primeira mensagem preenche o canal.
function channelOf(conversation: ChatwootConversation, inboxName?: string) {
  if (/whatsapp/i.test(inboxName ?? '') || /whatsapp/i.test(conversation.channel ?? '')) {
    return 'whatsapp'
  }
  if (!inboxName) return null
  return conversation.channel?.replace('Channel::', '').toLowerCase() ?? null
}

export async function POST(request: Request) {
  const body = await request.text()
  const timestamp = request.headers.get('x-chatwoot-timestamp') ?? ''
  const signature = request.headers.get('x-chatwoot-signature') ?? ''

  let payload: ChatwootPayload
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const accountId = payload.account?.id
  if (!accountId || !timestamp || !signature) {
    return NextResponse.json({ error: 'Pedido não assinado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: integration } = await supabase
    .from('chatwoot_integrations')
    .select('organization_id, chatwoot_base_url, webhook_secret')
    .eq('chatwoot_account_id', accountId)
    .eq('active', true)
    .maybeSingle()

  const skew = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (
    !integration ||
    !(skew <= MAX_CLOCK_SKEW_SECONDS) ||
    !validSignature(integration.webhook_secret, timestamp, body, signature)
  ) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  const isMessage = payload.event === 'message_created'
  const isConversation =
    payload.event === 'conversation_created' ||
    payload.event === 'conversation_status_changed' ||
    payload.event === 'conversation_updated'

  if (!isMessage && !isConversation) {
    return NextResponse.json({ ignored: payload.event }, { status: 202 })
  }

  // Notas privadas e mensagens de sistema ("conversa resolvida por…") não
  // são conversa com o paciente.
  if (isMessage && (payload.private || payload.message_type === 'activity')) {
    return NextResponse.json({ ignored: 'private/activity' }, { status: 202 })
  }

  const conversation: ChatwootConversation = isMessage
    ? payload.conversation ?? {}
    : { id: payload.id, status: payload.status, channel: payload.channel, meta: payload.meta }
  const contact =
    conversation.meta?.sender ??
    (isMessage && payload.message_type === 'incoming' ? payload.sender : undefined)

  if (!conversation.id || !contact) {
    return NextResponse.json({ ignored: 'sem conversa/contacto' }, { status: 202 })
  }

  const base = integration.chatwoot_base_url.replace(/\/$/, '')
  const { data, error } = await supabase.rpc('chatwoot_ingest', {
    p_organization_id: integration.organization_id,
    p_chatwoot_conversation_id: String(conversation.id),
    p_chatwoot_contact_id: contact.id != null ? String(contact.id) : null,
    p_contact_name: contact.name ?? null,
    p_phone: normalizePhone(contact.phone_number ?? ''),
    p_email: contact.email?.trim().toLowerCase() || null,
    p_channel: channelOf(conversation, payload.inbox?.name),
    p_conversation_status: conversation.status ?? null,
    p_conversation_link: `${base}/app/accounts/${accountId}/conversations/${conversation.id}`,
    ...(isMessage && payload.id != null
      ? {
          p_message_id: String(payload.id),
          p_direction: payload.message_type === 'incoming' ? 'inbound' : 'outbound',
          p_sender_label: payload.sender?.name ?? null,
          p_content: payload.content ?? null,
          p_sent_at: toDate(payload.created_at),
        }
      : {}),
    p_raw: {
      chatwoot_account_id: accountId,
      chatwoot_contact_id: contact.id ?? null,
      chatwoot_conversation_id: conversation.id,
      inbox: payload.inbox?.name ?? null,
      event: payload.event,
    },
  })

  if (error) {
    console.error('[chatwoot-webhook]', payload.event, error.message)
    return NextResponse.json({ error: 'Falha ao processar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...data })
}
