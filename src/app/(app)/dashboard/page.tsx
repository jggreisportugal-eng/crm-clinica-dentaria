import { requireProfile } from '@/lib/auth/require-role'

export default async function DashboardPage() {
  const { user, profile } = await requireProfile()

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="rounded-lg border border-gray-200 p-4 text-sm">
        <p>
          <span className="font-medium">E-mail:</span> {user.email}
        </p>
        <p>
          <span className="font-medium">Nome:</span>{' '}
          {profile.full_name ?? '—'}
        </p>
        <p>
          <span className="font-medium">Perfil:</span> {profile.role}
        </p>
      </div>
    </div>
  )
}
