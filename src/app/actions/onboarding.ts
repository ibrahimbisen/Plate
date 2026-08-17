'use server'

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { nutritionGoals, users } from '@/db/schema'
import { getCurrentUser } from '@/lib/dal'
import { safeTimeZone, todayLocal } from '@/lib/date'
import { computeGoals, type OnboardingInput } from '@/lib/goals'

export async function completeOnboarding(input: OnboardingInput, timezone: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('No user row found.')

  const tz = safeTimeZone(timezone)
  const today = todayLocal(tz)
  const derived = computeGoals(input, today)

  await db
    .update(users)
    .set({
      timezone: tz,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      username: input.firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'me',
      sex: input.sex,
      birthDate: input.birthDate || null,
      heightCm: derived.heightCm,
      startWeightKg: derived.weightKg,
      goalWeightKg: derived.goalWeightKg,
      activityLevel: input.activityLevel,
      weeklyRateKg: derived.weeklyRateKg,
      units: input.units,
      onboardedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  await db.insert(nutritionGoals).values({
    id: randomUUID(),
    userId: user.id,
    effectiveFrom: today,
    calories: derived.calories,
    proteinG: derived.macros.proteinG,
    carbsG: derived.macros.carbsG,
    fatG: derived.macros.fatG,
    source: 'derived',
    bmr: derived.bmr,
    tdee: derived.tdee,
  })

  revalidatePath('/', 'layout')
  redirect('/')
}
