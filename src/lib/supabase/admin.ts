import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com service_role — ignora RLS. Uso restrito a código server-side
 * de confiança (jobs, webhooks, admin). Nunca importar em código de cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
