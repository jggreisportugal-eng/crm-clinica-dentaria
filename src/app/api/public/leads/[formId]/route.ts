import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/phone'

// Recetor dos formulários das landing pages (site_forms). O id do
// formulário é público (vai no código do site), por isso a rota defende-se
// sozinha: Origin tem de estar em allowed_origins, consentimento RGPD
// obrigatório, honeypot "empresa" (campo escondido que só robôs preenchem)
// e limite de envios por IP.

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Um único contentor do CRM: um mapa em memória chega para travar abusos
// de um mesmo IP (reinicia com o contentor, o que é aceitável aqui).
const hits = new Map<string, number[]>()

function rateLimited(ip: string) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 10_000) hits.clear()
  return recent.length > RATE_LIMIT
}

function text(value: unknown, max: number) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v ? v.slice(0, max) : null
}

async function loadForm(formId: string) {
  if (!UUID_RE.test(formId)) return null
  const { data } = await createAdminClient()
    .from('site_forms')
    .select('id, organization_id, name, allowed_origins, default_interest')
    .eq('id', formId)
    .eq('active', true)
    .maybeSingle()
  return data
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export async function OPTIONS(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const origin = request.headers.get('origin') ?? ''
  const form = await loadForm((await params).formId)
  if (!form || !form.allowed_origins.includes(origin)) {
    return new NextResponse(null, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const origin = request.headers.get('origin') ?? ''
  const form = await loadForm((await params).formId)

  if (!form || !form.allowed_origins.includes(origin)) {
    return NextResponse.json({ erro: 'Formulário não autorizado.' }, { status: 403 })
  }
  const headers = corsHeaders(origin)
  const reply = (body: object, status = 200) =>
    NextResponse.json(body, { status, headers })

  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'desconhecido'
  if (rateLimited(ip)) {
    return reply({ erro: 'Demasiados envios. Tente novamente dentro de alguns minutos.' }, 429)
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return reply({ erro: 'Pedido inválido.' }, 400)
  }

  // Honeypot: responde "ok" para o robô não perceber que foi apanhado.
  if (text(body.empresa, 200)) {
    return reply({ ok: true })
  }

  const nome = text(body.nome, 100)
  const email = text(body.email, 255)?.toLowerCase() ?? null
  const telefone = normalizePhone(text(body.telefone, 30) ?? '')
  const mensagem = text(body.mensagem, 1000)

  if (!nome || nome.length < 2) return reply({ erro: 'Indique o seu nome.' }, 400)
  if (email && !EMAIL_RE.test(email)) return reply({ erro: 'E-mail inválido.' }, 400)
  if (!telefone && !email) return reply({ erro: 'Indique um telefone ou e-mail.' }, 400)
  if (body.consentimento !== true) {
    return reply({ erro: 'É necessário aceitar a política de privacidade.' }, 400)
  }

  const utm = (key: string) => text(body[key], 200)
  const { error } = await createAdminClient().rpc('ingest_site_lead', {
    p_organization_id: form.organization_id,
    p_form_name: form.name,
    p_name: nome,
    p_email: email,
    p_phone: telefone,
    p_message: mensagem,
    p_interest: text(body.interesse, 200) ?? form.default_interest,
    p_consent: true,
    p_utm_source: utm('utm_source'),
    p_utm_medium: utm('utm_medium'),
    p_utm_campaign: utm('utm_campaign'),
    p_utm_content: utm('utm_content'),
    p_utm_term: utm('utm_term'),
    p_landing_page: text(body.landing_page, 500),
    p_referrer: text(body.referrer, 500),
    p_raw: { formulario: form.name, origem: origin },
  })

  if (error) {
    console.error('[public/leads]', form.id, error.message)
    return reply({ erro: 'Não foi possível enviar o pedido. Tente novamente.' }, 500)
  }

  return reply({ ok: true })
}
