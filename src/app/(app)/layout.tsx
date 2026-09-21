import { requireProfile } from '@/lib/auth/require-role'
import { Nav } from '@/components/nav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireProfile()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Nav role={profile.role} userName={profile.full_name ?? profile.role} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
