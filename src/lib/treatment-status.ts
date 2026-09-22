export const TREATMENT_STATUSES = [
  'proposto',
  'aceite',
  'em_andamento',
  'concluido',
  'cancelado',
] as const

export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number]

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
  proposto: 'Proposto',
  aceite: 'Aceite',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}
