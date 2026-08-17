import { requireUser } from '@/lib/dal'
import { PreferencesForm } from './preferences-form'

export const metadata = { title: 'Preferences · Plate' }
export const dynamic = 'force-dynamic'

export default async function PreferencesPage() {
  const user = await requireUser()
  return <PreferencesForm initial={user.preferences} />
}
