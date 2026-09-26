// Normaliza telefones para E.164 (+351912345678) — o mesmo formato que o
// WhatsApp/Chatwoot usa, para a deduplicação por telefone funcionar quando
// a integração Chatwoot (Etapa 3.3) chegar. Números portugueses de 9
// dígitos sem indicativo recebem +351; o resto fica só sem espaços/traços.
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let digits = trimmed.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`
  if (/^[29]\d{8}$/.test(digits)) digits = `+351${digits}`

  return digits
}
