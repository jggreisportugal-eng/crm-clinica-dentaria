'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/require-role'
import { ROLE_LABELS, type UserRole } from '@/lib/auth/nav-config'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export interface ActionState {
  error?: string
  success?: string
}

const MIN_PASSWORD_LENGTH = 8
// Supabase Auth: ban "permanente" = 100 anos; 'none' levanta o ban.
const BAN_FOREVER = '876000h'

function isRole(value: unknown): value is UserRole {
  return typeof value === 'string' && value in ROLE_LABELS
}

// Utilizador alvo, lido com o cliente do administrador: a RLS
// (users_select_admin) só devolve utilizadores da organização dele, por isso
// um id de outra clínica resulta em null — nunca chega à Admin API.
async function getTargetInMyOrg(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('id', userId)
    .maybeSingle()
  return data
}

export async function createUser(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole(['administrador'])

  const fullName = String(formData.get('fullName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const role = formData.get('role')

  if (!fullName || !email) {
    return { error: 'Nome e e-mail são obrigatórios.' }
  }
  if (!isRole(role)) {
    return { error: 'Perfil inválido.' }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `A palavra-passe tem de ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    }
  }

  const me = await getTargetInMyOrg(admin.id)
  if (!me) {
    return { error: 'Não foi possível identificar a sua organização.' }
  }

  // organization_id vem sempre do administrador autenticado, nunca do
  // formulário — um administrador só cria utilizadores na própria clínica.
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role, organization_id: me.organization_id },
    user_metadata: { full_name: fullName },
  })

  if (error) {
    return { error: `Não foi possível criar o utilizador: ${error.message}` }
  }

  revalidatePath('/admin/users')
  return { success: `Utilizador ${email} criado.` }
}

export async function updateRole(
  userId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole(['administrador'])
  const role = formData.get('role')

  if (!isRole(role)) {
    return { error: 'Perfil inválido.' }
  }
  if (userId === admin.id && role !== 'administrador') {
    return { error: 'Não pode retirar a si próprio o perfil de Administrador.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)
    .select('id')

  if (error || !data?.length) {
    return { error: `Não foi possível alterar o perfil: ${error?.message ?? 'utilizador não encontrado'}` }
  }

  revalidatePath('/admin/users')
  return { success: 'Perfil atualizado.' }
}

export async function setActive(
  userId: string,
  active: boolean
): Promise<ActionState> {
  const admin = await requireRole(['administrador'])

  if (userId === admin.id && !active) {
    return { error: 'Não pode desativar a sua própria conta.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .update({ active })
    .eq('id', userId)
    .select('id')

  if (error || !data?.length) {
    return { error: `Não foi possível alterar o estado: ${error?.message ?? 'utilizador não encontrado'}` }
  }

  // Além de active=false (que o requireProfile verifica), o ban impede novos
  // logins e a renovação da sessão no Supabase Auth.
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(
    userId,
    { ban_duration: active ? 'none' : BAN_FOREVER }
  )

  if (banError) {
    return { error: `Estado alterado, mas falhou o bloqueio de acesso: ${banError.message}` }
  }

  revalidatePath('/admin/users')
  return { success: active ? 'Utilizador reativado.' : 'Utilizador desativado.' }
}

export async function resetPassword(
  userId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole(['administrador'])
  const password = String(formData.get('password') ?? '')

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `A palavra-passe tem de ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    }
  }
  if (!(await getTargetInMyOrg(userId))) {
    return { error: 'Utilizador não encontrado.' }
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(
    userId,
    { password }
  )

  if (error) {
    return { error: `Não foi possível redefinir a palavra-passe: ${error.message}` }
  }

  return { success: 'Palavra-passe redefinida.' }
}
