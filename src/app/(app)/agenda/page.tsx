import { requireRole } from '@/lib/auth/require-role'
import { StubPage } from '@/components/stub-page'

export default async function AgendaPage() {
  await requireRole(['administrador', 'gestor', 'recepcao', 'profissional'])
  return <StubPage title="Agenda" phase="Fase 4 (Etapa 4.2)" />
}
