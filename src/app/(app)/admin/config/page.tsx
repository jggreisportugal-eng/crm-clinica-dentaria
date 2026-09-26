import { requireRole } from '@/lib/auth/require-role'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { AgentKeys, type AgentKeyRow } from '@/components/agent-keys'

// agent_api_keys só é acessível ao service_role; a organização vem do
// administrador autenticado (RLS de users) e filtra a leitura.
export default async function ConfigPage() {
  const admin = await requireRole(['administrador'])

  const supabase = await createClient()
  const { data: me } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', admin.id)
    .single()

  const { data: keys } = await createAdminClient()
    .from('agent_api_keys')
    .select('id, name, key_prefix, active, created_at, last_used_at')
    .eq('organization_id', me?.organization_id ?? '')
    .order('created_at', { ascending: false })
    .returns<AgentKeyRow[]>()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Configuração</h1>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Chaves da API do assistente virtual
          </h2>
          <p className="text-sm text-gray-500">
            Permitem ao assistente (fazer.ai) consultar pacientes e registar
            pedidos de marcação desta clínica. Revogue uma chave se suspeitar
            que foi exposta.
          </p>
        </div>
        <AgentKeys keys={keys ?? []} />
      </section>
    </div>
  )
}
