'use server'

import { randomUUID } from 'node:crypto'

import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { exerciseLogs, weightEntries } from '@/db/schema'
import { analyzeExercise, aiEnabled } from '@/lib/ai'
import { requireUser } from '@/lib/dal'
import { toLocalDate } from '@/lib/date'
import { exerciseKcal, lbToKg, type Intensity } from '@/lib/metrics'

/** Current bodyweight drives the MET calculation; fall back to onboarding. */
async function currentWeightKg(userId: string, startWeightKg: number | null): Promise<number> {
  const latest = (
    await db
      .select()
      .from(weightEntries)
      .where(eq(weightEntries.userId, userId))
      .orderBy(desc(weightEntries.localDate))
      .limit(1)
  )[0]
  return latest?.weightKg ?? startWeightKg ?? 75
}

export async function logStructuredExercise(input: {
  kind: 'run' | 'lifting'
  intensity: Intensity
  minutes: number
}): Promise<void> {
  const user = await requireUser()
  const weightKg = await currentWeightKg(user.id, user.startWeightKg)
  const now = new Date()

  await db.insert(exerciseLogs).values({
    id: randomUUID(),
    userId: user.id,
    loggedAt: now,
    localDate: toLocalDate(now, user.timezone),
    kind: input.kind,
    name: input.kind === 'run' ? 'Run' : 'Weight lifting',
    intensity: input.intensity,
    durationMin: input.minutes,
    kcalBurned: exerciseKcal({
      kind: input.kind,
      intensity: input.intensity,
      minutes: input.minutes,
      weightKg,
    }),
  })

  revalidatePath('/')
  revalidatePath('/progress')
}

export async function logManualExercise(kcal: number): Promise<void> {
  const user = await requireUser()
  const now = new Date()

  await db.insert(exerciseLogs).values({
    id: randomUUID(),
    userId: user.id,
    loggedAt: now,
    localDate: toLocalDate(now, user.timezone),
    kind: 'manual',
    name: 'Exercise',
    kcalBurned: Math.max(0, Math.round(kcal)),
  })

  revalidatePath('/')
  revalidatePath('/progress')
}

/**
 * Free-text exercise. The model returns a MET value and duration; the calorie
 * burn is still computed here from the user's bodyweight so it stays consistent
 * with the Run and Lifting flows.
 */
export async function logDescribedExercise(
  description: string,
): Promise<{ ok: true; name: string; kcal: number } | { ok: false; error: string }> {
  const user = await requireUser()
  if (!aiEnabled()) {
    return { ok: false, error: 'AI is not set up on this server. Use Manual to enter calories.' }
  }

  try {
    const parsed = await analyzeExercise(description)
    const weightKg = await currentWeightKg(user.id, user.startWeightKg)
    const kcal = Math.round(parsed.met * weightKg * (parsed.minutes / 60))
    const now = new Date()

    await db.insert(exerciseLogs).values({
      id: randomUUID(),
      userId: user.id,
      loggedAt: now,
      localDate: toLocalDate(now, user.timezone),
      kind: 'describe',
      name: parsed.name,
      intensity: parsed.intensity,
      durationMin: parsed.minutes,
      kcalBurned: kcal,
      note: description,
    })

    revalidatePath('/')
    revalidatePath('/progress')
    return { ok: true, name: parsed.name, kcal }
  } catch {
    return { ok: false, error: 'Could not work that out. Try Manual instead.' }
  }
}

export async function deleteExercise(id: string): Promise<void> {
  const user = await requireUser()
  await db.delete(exerciseLogs).where(eq(exerciseLogs.id, id))
  revalidatePath('/')
  revalidatePath('/progress')
  void user
}

/** One weigh-in per civil day; logging again replaces it. */
export async function logWeight(value: number, units: 'imperial' | 'metric'): Promise<void> {
  const user = await requireUser()
  const weightKg = units === 'imperial' ? lbToKg(value) : value
  const now = new Date()
  const localDate = toLocalDate(now, user.timezone)

  await db
    .insert(weightEntries)
    .values({ id: randomUUID(), userId: user.id, localDate, recordedAt: now, weightKg })
    .onConflictDoUpdate({
      target: [weightEntries.userId, weightEntries.localDate],
      set: { weightKg, recordedAt: now },
    })

  revalidatePath('/progress')
  revalidatePath('/progress/weight')
}
