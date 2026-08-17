import { TabBar } from '@/components/tab-bar'
import { requireUser } from '@/lib/dal'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const initials =
    `${user.firstName.at(0) ?? ''}${user.lastName.at(0) ?? ''}`.toUpperCase() || 'ME'

  return (
    <div className="app-frame">
      <div className="app-scroll">
        <div className="app-shell">{children}</div>
      </div>
      <TabBar initials={initials} />
    </div>
  )
}
