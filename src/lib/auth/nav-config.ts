export type UserRole =
  | 'administrador'
  | 'gestor'
  | 'recepcao'
  | 'comercial'
  | 'profissional'

export const ROLE_LABELS: Record<UserRole, string> = {
  administrador: 'Administrador',
  gestor: 'Gestor',
  recepcao: 'Receção',
  comercial: 'Comercial',
  profissional: 'Profissional',
}

export interface NavItem {
  href: string
  label: string
  roles: UserRole[]
}

// Módulos do CRM e perfis com acesso, conforme a tabela de perfis do
// documento. Alguns apontam para páginas ainda por implementar nas fases
// seguintes (Funil na Fase 2, Agenda na Fase 4, Tratamentos na Fase 5,
// Relatórios na Fase 7) — o item de navegação já existe (Etapa 1.9), o
// conteúdo é construído quando a fase correspondente chegar.
export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    roles: ['administrador', 'gestor', 'recepcao', 'comercial', 'profissional'],
  },
  {
    href: '/pacientes',
    label: 'Pacientes',
    roles: ['administrador', 'gestor', 'recepcao', 'comercial'],
  },
  {
    href: '/funil',
    label: 'Funil',
    roles: ['administrador', 'gestor', 'comercial'],
  },
  {
    href: '/agenda',
    label: 'Agenda',
    roles: ['administrador', 'gestor', 'recepcao', 'profissional'],
  },
  {
    href: '/tratamentos',
    label: 'Tratamentos',
    roles: ['administrador', 'gestor', 'profissional'],
  },
  {
    href: '/relatorios',
    label: 'Relatórios',
    roles: ['administrador', 'gestor'],
  },
  {
    href: '/admin/users',
    label: 'Utilizadores',
    roles: ['administrador'],
  },
  {
    href: '/admin/config',
    label: 'Configuração',
    roles: ['administrador'],
  },
]
