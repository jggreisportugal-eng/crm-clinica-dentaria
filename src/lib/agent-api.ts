import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/phone'

// Base comum das rotas /api/agent/* (ferramentas HTTP do agente fazer.ai).
// Autenticação: Authorization: Bearer <chave> → organização (agent_api_keys,
// só o hash). Identidade do paciente: SEMPRE a conversa do Chatwoot e o
// telefone que o fazer.ai injeta do contexto ({{conversation_id}},
// {{contact_id}}, {{contact_phone}}) — nunca um campo que o modelo preenche,
// para uma conversa não conseguir ler dados de outro paciente.

export const KEY_PREFIX = 'crm_'

export function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

export function generateKey() {
  return `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`
}

export type AdminClient = ReturnType<typeof createAdminClient>

export interface AgentContext {
  supabase: AdminClient
  organizationId: string
}

export async function authenticateAgent(
  request: Request
): Promise<AgentContext | NextResponse> {
  const auth = request.headers.get('authorization') ?? ''
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''

  if (!key.startsWith(KEY_PREFIX)) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('agent_api_keys')
    .select('id, organization_id, active')
    .eq('key_hash', hashKey(key))
    .maybeSingle()

  if (!data?.active) {
    // Só o prefixo (o mesmo que o ecrã Configuração mostra) — nunca a chave.
    console.warn(
      `[agent-api] chave ${data ? 'revogada' : 'desconhecida'}: ${key.slice(0, 10)}…`
    )
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  await supabase
    .from('agent_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return { supabase, organizationId: data.organization_id }
}

export interface ConversationIdentity {
  conversationId: string | null
  contactId: string | null
  phone: string | null
  contactName: string | null
}

function clean(value: unknown, max = 200) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  // Placeholder por resolver (ex.: playground sem conversa) → sem valor.
  if (!v || v.includes('{{')) return null
  return v.slice(0, max)
}

export function readIdentity(body: Record<string, unknown>): ConversationIdentity {
  return {
    conversationId: clean(body.conversation_id, 40),
    contactId: clean(body.contact_id, 40),
    phone: normalizePhone(clean(body.contact_phone, 40) ?? ''),
    contactName: clean(body.contact_name, 120),
  }
}

export function readText(body: Record<string, unknown>, field: string, max = 500) {
  return clean(body[field], max)
}

export interface PatientRef {
  id: string
  full_name: string
  phone: string | null
  interest: string | null
  chatwoot_conversation_link: string | null
}

const PATIENT_REF_COLUMNS = 'id, full_name, phone, interest, chatwoot_conversation_link'

// Paciente desta conversa: primeiro pela conversa do Chatwoot (ligada pelo
// webhook), depois pelo telefone do contacto. Sempre dentro da organização.
export async function findPatient(
  { supabase, organizationId }: AgentContext,
  identity: ConversationIdentity
): Promise<PatientRef | null> {
  if (identity.conversationId) {
    const { data } = await supabase
      .from('conversations')
      .select(`patient:patients(${PATIENT_REF_COLUMNS})`)
      .eq('organization_id', organizationId)
      .eq('chatwoot_conversation_id', identity.conversationId)
      .maybeSingle<{ patient: PatientRef | null }>()
    if (data?.patient) return data.patient
  }

  if (identity.phone) {
    const { data } = await supabase
      .from('patients')
      .select(PATIENT_REF_COLUMNS)
      .eq('organization_id', organizationId)
      .eq('phone', identity.phone)
      .eq('active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle<PatientRef>()
    if (data) return data
  }

  return null
}

export function badRequest(message: string) {
  return NextResponse.json({ erro: message }, { status: 400 })
}

const lisbon = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Lisbon',
})

export function formatLisbon(iso: string) {
  return lisbon.format(new Date(iso))
}
