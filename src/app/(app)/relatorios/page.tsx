import { requireRole } from '@/lib/auth/require-role'
import { StubPage } from '@/components/stub-page'

export default async function RelatoriosPage() {
  await requireRole(['administrador', 'gestor'])
  return <StubPage title="Relatórios" phase="Fase 7" />
}
