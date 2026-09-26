import { requireProfile } from '@/lib/auth/require-role'
import { Nav } from '@/components/nav'
import { LogoutButton } from '@/components/logout-button'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireProfile()

  // Além do ban no Supabase Auth (que impede novos logins), uma sessão já
  // aberta de uma conta desativada deixa de ver qualquer módulo.
  if (!profile.active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-700">
            A sua conta foi desativada. Fale com o administrador da clínica.
          </p>
          <LogoutButton />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <Nav role={profile.role} userName={profile.full_name ?? profile.role} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
