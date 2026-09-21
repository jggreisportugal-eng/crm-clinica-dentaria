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
