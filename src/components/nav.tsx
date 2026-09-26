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
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col justify-between bg-brand-900 p-4 text-brand-100">
      <div>
        <p className="mb-6 flex items-center gap-2 px-2 text-base font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-500 text-sm font-bold text-brand-950">
            CS
          </span>
          Clinic Smart
        </p>
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-brand-600 font-medium text-white shadow-sm'
                      : 'text-brand-100 hover:bg-brand-800 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="space-y-1 border-t border-brand-800 pt-4">
        <p className="px-2 text-sm font-medium text-white">{userName}</p>
        <p className="px-2 text-xs text-brand-300">{ROLE_LABELS[role]}</p>
        <div className="px-2 pt-1 text-brand-200">
          <LogoutButton />
        </div>
      </div>
    </nav>
  )
}
