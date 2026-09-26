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
