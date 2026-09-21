import { NextResponse } from 'next/server'

// Verificação da Etapa 1.1: confirma que o backend consegue alcançar o
// projeto Supabase configurado (usa o endpoint público de health do GoTrue,
// não depende de nenhuma tabela ainda existir).
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: 'Variáveis de ambiente do Supabase em falta' },
      { status: 500 }
    )
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      cache: 'no-store',
    })
    const body = await res.json()

    return NextResponse.json({ ok: res.ok, supabase: body })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
