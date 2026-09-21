import { requireRole } from '@/lib/auth/require-role'
import { StubPage } from '@/components/stub-page'

export default async function TratamentosPage() {
  await requireRole(['administrador', 'gestor', 'profissional'])
  return <StubPage title="Tratamentos" phase="Fase 5 (Etapa 5.2)" />
}
