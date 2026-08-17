'use server'

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { nutritionGoals, preferences, reminders, users } from '@/db/schema'
import { requireUser } from '@/lib/dal'
import { todayLocal } from '@/lib/date'
import { kcalFromMacros, rescaleMacrosToCalories, type Macros } from '@/lib/metrics'

export async function updatePreferences(patch: {
  appearance?: 'system' | 'light' | 'dark'
  badgeCelebrations?: boolean
  addBurnedCalories?: boolean
  rolloverCalories?: boolean
  autoAdjustMacros?: boolean
}): Promise<void> {
  const user = await requireUser()
  await db.update(preferences).set(patch).where(eq(preferences.userId, user.id))
  revalidatePath('/', 'layout')
}

export async function updateProfile(patch: {
  firstName?: string
  lastName?: string
  username?: string
}): Promise<void> {
  const user = await requireUser()
  await db.update(users).set(patch).where(eq(users.id, user.id))
  revalidatePath('/', 'layout')
}

export async function updatePersonalDetails(patch: {
  heightCm?: number
  birthDate?: string
  sex?: 'male' | 'female'
  dailyStepGoal?: number
  goalWeightKg?: number
  units?: 'imperial' | 'metric'
}): Promise<void> {
  const user = await requireUser()
  await db.update(users).set(patch).where(eq(users.id, user.id))
  revalidatePath('/', 'layout')
}

/**
 * Writes a NEW goal row rather than editing the current one, so days already
 * logged keep the target they were measured against.
 *
 * With "Auto adjust macros" on, editing calories rescales P/C/F to preserve the
 * split; editing a macro recomputes calories at 4/4/9.
 */
export async function updateNutritionGoals(input: {
  calories?: number
  macros?: Partial<Macros>
  changed: 'calories' | 'macro'
}): Promise<{ calories: number; macros: Macros }> {
  const user = await requireUser()
  const today = todayLocal(user.timezone)

  const current = (
    await db
      .select()
      .from(nutritionGoals)
      .where(eq(nutritionGoals.userId, user.id))
      .orderBy(nutritionGoals.effectiveFrom)
      .limit(1)
  ).at(-1)

  const baseMacros: Macros = {
    proteinG: input.macros?.proteinG ?? current?.proteinG ?? 150,
    carbsG: input.macros?.carbsG ?? current?.carbsG ?? 200,
    fatG: input.macros?.fatG ?? current?.fatG ?? 70,
  }

  let calories = input.calories ?? current?.calories ?? 2000
  let macros = baseMacros

  if (user.preferences.autoAdjustMacros) {
    if (input.changed === 'calories') {
      macros = rescaleMacrosToCalories(
        {
          proteinG: current?.proteinG ?? baseMacros.proteinG,
          carbsG: current?.carbsG ?? baseMacros.carbsG,
          fatG: current?.fatG ?? baseMacros.fatG,
        },
        calories,
      )
    } else {
      calories = kcalFromMacros(macros)
    }
  }

  // One goal row per day: re-editing today replaces today's, never history's.
  const existingToday = (
    await db
      .select()
      .from(nutritionGoals)
      .where(eq(nutritionGoals.userId, user.id))
  ).find((g) => g.effectiveFrom === today)

  if (existingToday) {
    await db
      .update(nutritionGoals)
      .set({ calories, proteinG: macros.proteinG, carbsG: macros.carbsG, fatG: macros.fatG, source: 'manual' })
      .where(eq(nutritionGoals.id, existingToday.id))
  } else {
    await db.insert(nutritionGoals).values({
      id: randomUUID(),
      userId: user.id,
      effectiveFrom: today,
      calories,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      source: 'manual',
      bmr: current?.bmr,
      tdee: current?.tdee,
    })
  }

  revalidatePath('/')
  revalidatePath('/profile/goals')
  return { calories, macros }
}

export async function updateReminder(
  slot: 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'endOfDay',
  patch: { timeOfDay?: string; enabled?: boolean },
): Promise<void> {
  const user = await requireUser()
  const all = await db.select().from(reminders).where(eq(reminders.userId, user.id))
  const row = all.find((r) => r.slot === slot)

  if (row) await db.update(reminders).set(patch).where(eq(reminders.id, row.id))
  else
    await db.insert(reminders).values({
      id: randomUUID(),
      userId: user.id,
      slot,
      timeOfDay: patch.timeOfDay ?? '12:00',
      enabled: patch.enabled ?? false,
    })

  revalidatePath('/profile/reminders')
}
