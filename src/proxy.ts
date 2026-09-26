import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|api/onboarding|api/webhooks|api/agent|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
