import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/agent-api'
import { runWeekendFollowups } from '@/lib/weekend-followup'

// Follow-up de "bom fim de semana" aos negócios à espera de decisão.
// Chamado às sextas pelo n8n com uma chave da API do agente da organização
// (docs/n8n-followup-fim-de-semana.json). Regras em src/lib/weekend-followup.ts
// e na migração 20261001120000_weekend_followup.sql.

export async function POST(request: Request) {
  const ctx = await authenticateAgent(request)
  if (ctx instanceof NextResponse) return ctx

  const result = await runWeekendFollowups(ctx)
  if ('erro' in result) return NextResponse.json(result, { status: 500 })
  return NextResponse.json(result)
}
