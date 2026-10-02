import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/agent-api'

// "Autorização de contacto" (contactAuth) do assistente de DEMONSTRAÇÃO do
// fazer.ai, no número comercial da Clinic Smart. O mesmo número recebe
// contactos normais (clientes a falar com o José) e visitantes da landing
// page que querem testar o robô: só estes últimos devem ser atendidos pela IA.
//
// A landing page abre o WhatsApp com a mensagem já começada por "/demo". O
// fazer.ai chama esta rota com o texto da mensagem (includeMessageText) e
// com mode "once": o primeiro "sim" fica guardado para o contacto durante o
// TTL configurado no agente, por isso as mensagens seguintes da demonstração
// já não precisam do código. Sem código => {"authorized": false} e o robô
// fica calado; a mensagem chega ao José como um contacto normal.
//
// Contrato do fazer.ai (modules/contact-auth/check.ts): POST
// {contact, conversation, message?: {text}} e resposta 2xx com
// {"authorized": boolean}. Qualquer outra resposta conta como erro e o robô
// não responde (fail-closed).

// "/demo", "#demo" ou "demo" no início da mensagem, sem distinguir maiúsculas.
const DEMO_CODE = /^\s*[/#]?demo\b/i

export async function POST(request: Request) {
  const ctx = await authenticateAgent(request)
  if (ctx instanceof NextResponse) return ctx

  const body = await request.json().catch(() => null)
  const text = typeof body?.message?.text === 'string' ? body.message.text : ''

  const authorized = DEMO_CODE.test(text)
  return NextResponse.json({
    authorized,
    ...(authorized ? {} : { reason: 'sem_codigo_demo' }),
  })
}
