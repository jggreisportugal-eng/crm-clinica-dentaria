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
    <nav className="z-10 flex shrink-0 flex-col bg-brand-900 text-brand-100 md:sticky md:top-0 md:h-screen md:w-60 md:justify-between md:p-4">
      <div>
        <div className="flex items-center justify-between gap-2 px-4 pt-3 md:mb-8 md:px-2 md:pt-2">
          <p className="flex items-center gap-2.5 text-base font-semibold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-700 text-xs font-bold text-brand-100">
              CS
            </span>
            Clinic Smart
          </p>
          <div className="text-brand-200 md:hidden">
            <LogoutButton />
          </div>
        </div>
        <ul className="flex gap-1 overflow-x-auto px-3 py-3 md:block md:space-y-0.5 md:overflow-visible md:p-0">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-brand-50 font-semibold text-brand-900'
                      : 'text-brand-100/85 hover:bg-brand-800 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="hidden border-t border-brand-800 px-2 pt-4 md:block">
        <p className="truncate text-sm font-medium text-white">{userName}</p>
        <p className="text-xs text-brand-300">{ROLE_LABELS[role]}</p>
        <div className="pt-2 text-brand-200">
          <LogoutButton />
        </div>
      </div>
    </nav>
  )
}
