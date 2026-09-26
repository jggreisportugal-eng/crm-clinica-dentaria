export const FUNNEL_STAGES = [
  'novo_lead',
  'contactado',
  'avaliacao_marcada',
  'avaliacao_realizada',
  'orcamento_enviado',
  'em_negociacao',
  'tratamento_iniciado',
  'concluido',
  'perdido',
] as const

export type FunnelStage = (typeof FUNNEL_STAGES)[number]

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  novo_lead: 'Novo lead',
  contactado: 'Contactado',
  avaliacao_marcada: 'Avaliação marcada',
  avaliacao_realizada: 'Avaliação realizada',
  orcamento_enviado: 'Orçamento enviado',
  em_negociacao: 'Em negociação',
  tratamento_iniciado: 'Tratamento iniciado',
  concluido: 'Concluído',
  perdido: 'Perdido',
}

// Cores por etapa (classes Tailwind literais, para o scanner as encontrar):
// badge = etiqueta na lista de pacientes; dot = marcador da coluna no Kanban.
export const FUNNEL_STAGE_COLORS: Record<FunnelStage, { badge: string; dot: string }> = {
  novo_lead: { badge: 'bg-sky-100 text-sky-800', dot: 'bg-sky-400' },
  contactado: { badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-400' },
  avaliacao_marcada: { badge: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-400' },
  avaliacao_realizada: { badge: 'bg-violet-100 text-violet-800', dot: 'bg-violet-400' },
  orcamento_enviado: { badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-400' },
  em_negociacao: { badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-400' },
  tratamento_iniciado: { badge: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500' },
  concluido: { badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  perdido: { badge: 'bg-rose-100 text-rose-800', dot: 'bg-rose-400' },
}
