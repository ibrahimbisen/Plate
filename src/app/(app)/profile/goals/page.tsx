import { desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { nutritionGoals } from '@/db/schema'
import { requireUser } from '@/lib/dal'
import { GoalsForm } from './goals-form'

export const metadata = { title: 'Nutrition goals · Cal AI' }
export const dynamic = 'force-dynamic'

export default async function GoalsPage() {
  const user = await requireUser()

  const current = (
    await db
      .select()
      .from(nutritionGoals)
      .where(eq(nutritionGoals.userId, user.id))
      .orderBy(desc(nutritionGoals.effectiveFrom))
      .limit(1)
  )[0]

  return (
    <GoalsForm
      autoAdjust={user.preferences.autoAdjustMacros}
      initial={{
        calories: current?.calories ?? 2000,
        proteinG: current?.proteinG ?? 150,
        carbsG: current?.carbsG ?? 200,
        fatG: current?.fatG ?? 67,
      }}
    />
  )
}
