'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, ROLE_LABELS, type UserRole } from '@/lib/auth/nav-config'
import { LogoutButton } from './logout-button'

export function Nav({
  role,
  userName,
}: {
  role: UserRole
  userName: string
}) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <nav className="flex w-56 shrink-0 flex-col justify-between border-r border-gray-200 bg-white p-4">
      <div>
        <p className="mb-4 px-2 text-sm font-semibold text-gray-900">
          CRM Clínica
        </p>
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-2 py-1.5 text-sm ${
                    active
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="space-y-1 border-t border-gray-200 pt-4">
        <p className="px-2 text-xs text-gray-500">
          {userName} · {ROLE_LABELS[role]}
        </p>
        <div className="px-2">
          <LogoutButton />
        </div>
      </div>
    </nav>
  )
}
