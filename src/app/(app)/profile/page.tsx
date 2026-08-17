import Link from 'next/link'

import { logout } from '@/app/actions/auth'
import {
  BellIcon,
  ChevronRight,
  IdIcon,
  LogoutIcon,
  SettingsIcon,
  ShareIcon,
  TargetIcon,
} from '@/components/icons'
import { requireUser } from '@/lib/dal'

export const metadata = { title: 'Profile · Cal AI' }
export const dynamic = 'force-dynamic'

const GROUPS = [
  {
    title: 'Account',
    rows: [
      { href: '/profile/personal', label: 'Personal Details', Icon: IdIcon },
      { href: '/profile/preferences', label: 'Preferences', Icon: SettingsIcon },
    ],
  },
  {
    title: 'Goals & Tracking',
    rows: [
      { href: '/profile/goals', label: 'Edit Nutrition Goals', Icon: TargetIcon },
      { href: '/profile/reminders', label: 'Tracking Reminders', Icon: BellIcon },
      { href: '/progress/weight', label: 'Weight history', Icon: ChevronRight },
    ],
  },
  {
    title: 'This app',
    rows: [
      { href: '/install', label: 'Add to Home Screen', Icon: ShareIcon },
      { href: '/help/rings', label: 'Ring colours explained', Icon: ChevronRight },
      { href: '/about', label: 'About & data sources', Icon: ChevronRight },
    ],
  },
]

export default async function ProfilePage() {
  const user = await requireUser()
  const initials = `${user.firstName.at(0) ?? ''}${user.lastName.at(0) ?? ''}`.toUpperCase() || 'ME'
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'You'

  return (
    <div className="flex flex-col gap-5 pt-2">
      <h1 className="text-title">Profile</h1>

      <Link href="/profile/edit" className="card flex items-center gap-4 p-4">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-[19px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--avatar-from), var(--avatar-to))' }}
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[19px] font-bold">{name}</span>
          {user.username && (
            <span className="block truncate text-[15px] text-ink-muted">@{user.username}</span>
          )}
        </span>
        <ChevronRight size={20} className="shrink-0 text-ink-muted" />
      </Link>

      {GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="px-1 text-[15px] font-medium text-ink-muted">{group.title}</h2>
          <div className="card overflow-hidden">
            {group.rows.map((row, i) => (
              <Link
                key={row.href}
                href={row.href}
                className={`flex items-center gap-3 px-4 py-4 ${
                  i > 0 ? 'border-t border-line' : ''
                }`}
              >
                <row.Icon size={21} className="shrink-0" />
                <span className="flex-1 text-[16px] font-medium">{row.label}</span>
                <ChevronRight size={18} className="shrink-0 text-ink-muted" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <form action={logout}>
        <button type="submit" className="card flex w-full items-center gap-3 px-4 py-4 text-bad">
          <LogoutIcon size={21} />
          <span className="text-[16px] font-medium">Log out</span>
        </button>
      </form>

      <p className="px-1 pb-2 text-center text-[13px] text-ink-muted">
        Self-hosted Cal AI · your data stays on your server
      </p>
    </div>
  )
}
