import { requireRole } from '@/lib/auth/require-role'
import { StubPage } from '@/components/stub-page'

export default async function ConfigPage() {
  await requireRole(['administrador'])
  return <StubPage title="Configuração" phase="fase a definir (integrações, parâmetros gerais)" />
}
