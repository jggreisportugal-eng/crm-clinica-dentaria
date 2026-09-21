import { requireRole } from '@/lib/auth/require-role'
import { StubPage } from '@/components/stub-page'

export default async function PacientesPage() {
  await requireRole(['administrador', 'gestor', 'recepcao', 'comercial'])
  return <StubPage title="Pacientes" phase="Fase 1 (schema pronto — UI completa a seguir)" />
}
