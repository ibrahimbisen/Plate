import { ScreenHeader } from '@/components/screen-header'
import { requireUser } from '@/lib/dal'
import { InstallGuide } from './install-guide'

export const metadata = { title: 'Add to Home Screen · Plate' }

export default async function InstallPage() {
  await requireUser()

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ScreenHeader fallbackHref="/profile" />
      <h1 className="text-title">Add to Home Screen</h1>
      <p className="label-muted">
        Installing gives you a full-screen app with no browser bars, and it is what keeps your
        offline data from being cleared after a week of not opening it.
      </p>
      <InstallGuide />
    </div>
  )
}
