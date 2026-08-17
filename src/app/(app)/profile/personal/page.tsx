import { requireUser } from '@/lib/dal'
import { PersonalForm } from './personal-form'

export const metadata = { title: 'Personal details · Cal AI' }
export const dynamic = 'force-dynamic'

export default async function PersonalPage() {
  const user = await requireUser()

  return (
    <PersonalForm
      initial={{
        sex: user.sex,
        birthDate: user.birthDate ?? '',
        heightCm: user.heightCm ?? 175,
        goalWeightKg: user.goalWeightKg ?? 0,
        dailyStepGoal: user.dailyStepGoal,
        units: user.units,
      }}
    />
  )
}
