// Cria 5 utilizadores de teste (um por perfil) usando a Admin API
// (service_role) — NÃO expor isto como formulário público: a escolha do
// perfil (role) nunca deve ficar acessível ao próprio utilizador.
//
// Uso: node --env-file=.env.local scripts/seed-test-users.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente.')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_PASSWORD = 'TesteCRM!2026'

const perfis = [
  { role: 'administrador', email: 'admin@teste.crm', full_name: 'Admin Teste' },
  { role: 'gestor', email: 'gestor@teste.crm', full_name: 'Gestor Teste' },
  { role: 'recepcao', email: 'recepcao@teste.crm', full_name: 'Receção Teste' },
  { role: 'comercial', email: 'comercial@teste.crm', full_name: 'Comercial Teste' },
  { role: 'profissional', email: 'profissional@teste.crm', full_name: 'Profissional Teste' },
]

for (const perfil of perfis) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: perfil.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { role: perfil.role, full_name: perfil.full_name },
  })

  if (error) {
    console.error(`✗ ${perfil.email}: ${error.message}`)
    continue
  }

  console.log(`✓ ${perfil.email} (${perfil.role}) — id ${data.user.id}`)
}

console.log(`\nPassword de teste para todos: ${TEST_PASSWORD}`)
