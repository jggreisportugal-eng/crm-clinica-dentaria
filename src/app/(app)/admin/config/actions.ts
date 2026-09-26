'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/require-role'
import { generateKey, hashKey } from '@/lib/agent-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export interface KeyActionState {
  error?: string
  // Chave em claro: devolvida UMA vez ao administrador, nunca guardada.
  newKey?: string
}

async function myOrganizationId(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single()
  return data?.organization_id as string | undefined
}

export async function createAgentKey(
  _prev: KeyActionState,
  formData: FormData
): Promise<KeyActionState> {
  const admin = await requireRole(['administrador'])
  const name = String(formData.get('name') ?? '').trim() || 'Agente fazer.ai'

  const organizationId = await myOrganizationId(admin.id)
  if (!organizationId) return { error: 'Organização não encontrada.' }

  const key = generateKey()
  const { error } = await createAdminClient().from('agent_api_keys').insert({
    organization_id: organizationId,
    name: name.slice(0, 80),
    key_prefix: key.slice(0, 10),
    key_hash: hashKey(key),
  })

  if (error) return { error: `Não foi possível gerar a chave: ${error.message}` }

  revalidatePath('/admin/config')
  return { newKey: key }
}

export async function revokeAgentKey(keyId: string) {
  const admin = await requireRole(['administrador'])
  const organizationId = await myOrganizationId(admin.id)
  if (!organizationId) return

  // Filtro por organização: um id de outra clínica não revoga nada.
  await createAdminClient()
    .from('agent_api_keys')
    .update({ active: false })
    .eq('id', keyId)
    .eq('organization_id', organizationId)

  revalidatePath('/admin/config')
}

export interface FormActionState {
  error?: string
  success?: string
}

// Só a origem (esquema + domínio + porta): é o que o browser envia no
// cabeçalho Origin e o que a rota pública compara.
function toOrigin(raw: string) {
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return url.protocol === 'https:' || url.hostname === 'localhost' ? url.origin : null
  } catch {
    return null
  }
}

export async function createSiteForm(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const admin = await requireRole(['administrador'])
  const name = String(formData.get('name') ?? '').trim()
  const origin = toOrigin(String(formData.get('origin') ?? '').trim())
  const interest = String(formData.get('interest') ?? '').trim()

  if (!name) return { error: 'Indique um nome para o formulário.' }
  if (!origin) return { error: 'Endereço do site inválido (ex.: https://www.clinica.pt).' }

  const organizationId = await myOrganizationId(admin.id)
  if (!organizationId) return { error: 'Organização não encontrada.' }

  const { error } = await createAdminClient().from('site_forms').insert({
    organization_id: organizationId,
    name: name.slice(0, 80),
    allowed_origins: [origin],
    default_interest: interest ? interest.slice(0, 200) : null,
  })

  if (error) return { error: `Não foi possível criar o formulário: ${error.message}` }

  revalidatePath('/admin/config')
  return { success: 'Formulário criado.' }
}

export async function deactivateSiteForm(formId: string) {
  const admin = await requireRole(['administrador'])
  const organizationId = await myOrganizationId(admin.id)
  if (!organizationId) return

  await createAdminClient()
    .from('site_forms')
    .update({ active: false })
    .eq('id', formId)
    .eq('organization_id', organizationId)

  revalidatePath('/admin/config')
}
