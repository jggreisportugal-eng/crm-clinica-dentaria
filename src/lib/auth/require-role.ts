import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from './nav-config'

interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  active: boolean
}

// cache(): evita repetir a mesma query (user + perfil) quando o layout e a
// página, dentro do mesmo pedido, chamam requireProfile()/requireRole().
export const requireProfile = cache(async () => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, active')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) {
    redirect('/login')
  }

  return { user, profile }
})

export async function requireRole(allowed: UserRole[]) {
  const { profile } = await requireProfile()

  if (!allowed.includes(profile.role)) {
    redirect('/dashboard')
  }

  return profile
}
