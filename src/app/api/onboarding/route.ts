import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Etapa 8.4 — cria uma nova organização + o seu primeiro utilizador
// Administrador. Usa o cliente admin (service_role) porque organizations
// não tem policy de insert para utilizadores comuns (Etapa 8.2/8.3) — só
// este fluxo, server-side, pode criar uma organização nova.
export async function POST(request: Request) {
  const { organizationName, fullName, email, password } = await request.json()

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
    user_metadata: {
      role: 'administrador',
      full_name: fullName,
      organization_id: organization.id,
    },
  })

  if (userError) {
    // Reverte a organização criada — sem primeiro administrador, a
    // organização fica órfã e inacessível.
    await supabase.from('organizations').delete().eq('id', organization.id)
    return NextResponse.json(
      { error: `Não foi possível criar o utilizador: ${userError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
