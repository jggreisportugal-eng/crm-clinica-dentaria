import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Com o CRM publicado, esta rota não pode ficar aberta a qualquer pessoa:
// só cria organizações quem souber o ONBOARDING_SECRET (env do servidor).
// Sem a variável definida, o onboarding fica desligado.
function isValidAccessCode(accessCode: unknown) {
  const secret = process.env.ONBOARDING_SECRET
  if (!secret || typeof accessCode !== 'string') return false
  const a = Buffer.from(accessCode)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Etapa 8.4 — cria uma nova organização + o seu primeiro utilizador
// Administrador. Usa o cliente admin (service_role) porque organizations
// não tem policy de insert para utilizadores comuns (Etapa 8.2/8.3) — só
// este fluxo, server-side, pode criar uma organização nova.
export async function POST(request: Request) {
  const { organizationName, fullName, email, password, accessCode } =
    await request.json()

  if (!isValidAccessCode(accessCode)) {
    return NextResponse.json(
      { error: 'Código de acesso inválido.' },
      { status: 403 }
    )
  }

  if (!organizationName || !fullName || !email || !password) {
    return NextResponse.json(
      { error: 'Todos os campos são obrigatórios.' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('name', 'Básico')
    .single()

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: organizationName,
      plan_id: plan?.id ?? null,
      subscribed_at: plan ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (orgError || !organization) {
    return NextResponse.json(
      { error: `Não foi possível criar a organização: ${orgError?.message}` },
      { status: 500 }
    )
  }

  const { error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // role/organization_id em app_metadata (só service_role grava) — ver
    // migração 20260926120000; user_metadata é editável pelo utilizador.
    app_metadata: {
      role: 'administrador',
      organization_id: organization.id,
    },
    user_metadata: { full_name: fullName },
  })

  if (userError) {
    // Reverte a organização criada — sem primeiro administrador, a
    // organização fica órfã e inacessível. O funil default e o registo de
    // auditoria criados pelos triggers referenciam-na, por isso saem antes.
    await supabase.from('activities').delete().eq('organization_id', organization.id)
    await supabase.from('pipelines').delete().eq('organization_id', organization.id)
    await supabase.from('organizations').delete().eq('id', organization.id)
    return NextResponse.json(
      { error: `Não foi possível criar o utilizador: ${userError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
