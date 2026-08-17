import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/dal'
import { OnboardingFlow } from './flow'

export const metadata = { title: 'Set up · Cal AI' }
export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.onboardedAt) redirect('/')

  return (
    <div className="app-frame">
      <div className="app-scroll">
        <div className="app-shell py-4">
          <OnboardingFlow />
        </div>
      </div>
    </div>
  )
}
