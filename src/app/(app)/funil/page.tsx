import { requireRole } from '@/lib/auth/require-role'
import { StubPage } from '@/components/stub-page'

export default async function FunilPage() {
  await requireRole(['administrador', 'gestor', 'comercial'])
  return <StubPage title="Funil" phase="Fase 2 (Etapa 2.3 — Kanban)" />
}
