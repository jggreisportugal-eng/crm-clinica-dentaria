export const APPOINTMENT_STATUSES = [
  'marcada',
  'confirmada',
  'realizada',
  'cancelada',
  'faltou',
] as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  marcada: 'Marcada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  faltou: 'Faltou',
}
