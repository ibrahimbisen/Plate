'use server'

import { randomUUID } from 'node:crypto'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { foodLogItems, foodLogs, savedFoods } from '@/db/schema'
import { requireUser } from '@/lib/dal'
import { toLocalDate, type LocalDate } from '@/lib/date'
import { atwaterCheck } from '@/lib/metrics'
import { totalsFromItems, type LogItemInput } from '@/lib/nutrition'

export type CreateLogInput = {
  name: string
  brand?: string
  items: LogItemInput[]
  quantity?: number
  portionLabel?: string
  photoPath?: string
  foodId?: string
  healthScore?: number
  mealSlot?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  /** Overrides "now" so a user can backdate an entry to another day. */
  onDate?: LocalDate
  aiConfidence?: number
  scaleReference?: string
  assumptions?: string[]
}

export async function createLog(input: CreateLogInput): Promise<string> {
  const user = await requireUser()

  const quantity = input.quantity ?? 1
  const items = input.items.filter((i) => i.grams > 0 && Number.isFinite(i.kcal100))
  if (items.length === 0) throw new Error('A log entry needs at least one item.')

  const totals = totalsFromItems(items, quantity)
  const now = new Date()
  const localDate = input.onDate ?? toLocalDate(now, user.timezone)
  const id = randomUUID()

  await db.insert(foodLogs).values({
    id,
    userId: user.id,
    loggedAt: now,
    localDate,
    mealSlot: input.mealSlot,
    foodId: input.foodId,
    name: input.name.trim() || 'Untitled',
    brand: input.brand,
    photoPath: input.photoPath,
    quantity,
    portionLabel: input.portionLabel ?? 'serving',
    grams: totals.grams,
    kcal: totals.kcal,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    fiber: totals.fiber,
    sugar: totals.sugar,
    sodiumMg: totals.sodiumMg,
    healthScore: input.healthScore,
    aiConfidence: input.aiConfidence,
    kcalLow: totals.kcalLow,
    kcalHigh: totals.kcalHigh,
    scaleReference: input.scaleReference,
    assumptions: input.assumptions ? JSON.stringify(input.assumptions) : null,
  })

  await db.insert(foodLogItems).values(
    items.map((item, position) => ({
      id: randomUUID(),
      logId: id,
      name: item.name,
      grams: item.grams,
      gramsLow: item.gramsLow,
      gramsHigh: item.gramsHigh,
      kcal100: item.kcal100,
      protein100: item.protein100,
      carbs100: item.carbs100,
      fat100: item.fat100,
      fiber100: item.fiber100,
      sugar100: item.sugar100,
      sodiumMg100: item.sodiumMg100,
      isHiddenFat: item.isHiddenFat ?? false,
      confidence: item.confidence,
      position,
    })),
  )

  revalidatePath('/')
  revalidatePath('/progress')
  return id
}

/** Re-derives totals after the user edits ingredient grams or the quantity. */
export async function updateLog(
  logId: string,
  patch: { name?: string; quantity?: number; items?: LogItemInput[]; mealSlot?: string },
): Promise<void> {
  const user = await requireUser()

  const existing = (
    await db
      .select()
      .from(foodLogs)
      .where(and(eq(foodLogs.id, logId), eq(foodLogs.userId, user.id)))
      .limit(1)
  )[0]
  if (!existing) throw new Error('Entry not found.')

  const items =
    patch.items ??
    (await db.select().from(foodLogItems).where(eq(foodLogItems.logId, logId))).map((i) => ({
      name: i.name,
      grams: i.grams,
      gramsLow: i.gramsLow ?? undefined,
      gramsHigh: i.gramsHigh ?? undefined,
      kcal100: i.kcal100,
      protein100: i.protein100 ?? undefined,
      carbs100: i.carbs100 ?? undefined,
      fat100: i.fat100 ?? undefined,
      fiber100: i.fiber100 ?? undefined,
      sugar100: i.sugar100 ?? undefined,
      sodiumMg100: i.sodiumMg100 ?? undefined,
      isHiddenFat: i.isHiddenFat,
      confidence: i.confidence ?? undefined,
    }))

  const quantity = patch.quantity ?? existing.quantity
  const totals = totalsFromItems(items, quantity)

  await db
    .update(foodLogs)
    .set({
      name: patch.name?.trim() || existing.name,
      quantity,
      grams: totals.grams,
      kcal: totals.kcal,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      fiber: totals.fiber,
      sugar: totals.sugar,
      sodiumMg: totals.sodiumMg,
      kcalLow: totals.kcalLow,
      kcalHigh: totals.kcalHigh,
    })
    .where(eq(foodLogs.id, logId))

  if (patch.items) {
    await db.delete(foodLogItems).where(eq(foodLogItems.logId, logId))
    await db.insert(foodLogItems).values(
      patch.items.map((item, position) => ({
        id: randomUUID(),
        logId,
        name: item.name,
        grams: item.grams,
        gramsLow: item.gramsLow,
        gramsHigh: item.gramsHigh,
        kcal100: item.kcal100,
        protein100: item.protein100,
        carbs100: item.carbs100,
        fat100: item.fat100,
        fiber100: item.fiber100,
        sugar100: item.sugar100,
        sodiumMg100: item.sodiumMg100,
        isHiddenFat: item.isHiddenFat ?? false,
        confidence: item.confidence,
        position,
      })),
    )
  }

  revalidatePath('/')
  revalidatePath(`/log/${logId}`)
  revalidatePath('/progress')
}

export async function deleteLog(logId: string): Promise<void> {
  const user = await requireUser()
  await db.delete(foodLogs).where(and(eq(foodLogs.id, logId), eq(foodLogs.userId, user.id)))
  revalidatePath('/')
  revalidatePath('/progress')
}

export async function toggleSaved(foodId: string): Promise<boolean> {
  const user = await requireUser()
  const existing = (
    await db
      .select()
      .from(savedFoods)
      .where(and(eq(savedFoods.userId, user.id), eq(savedFoods.foodId, foodId)))
      .limit(1)
  )[0]

  if (existing) {
    await db.delete(savedFoods).where(eq(savedFoods.id, existing.id))
    revalidatePath('/log/saved')
    return false
  }
  await db.insert(savedFoods).values({ id: randomUUID(), userId: user.id, foodId })
  revalidatePath('/log/saved')
  return true
}

/**
 * Manual entry: the user types totals directly. Stored as a single item whose
 * per-100g values are back-computed from the grams they gave, so it flows
 * through exactly the same math as every other entry.
 */
export async function createManualLog(form: {
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  grams?: number
  onDate?: LocalDate
}): Promise<{ id: string; warning: string | null }> {
  const grams = form.grams && form.grams > 0 ? form.grams : 100
  const scale = 100 / grams

  const quality = atwaterCheck({
    kcal: form.kcal * scale,
    protein: form.protein * scale,
    carbs: form.carbs * scale,
    fat: form.fat * scale,
  })

  const id = await createLog({
    name: form.name,
    onDate: form.onDate,
    portionLabel: form.grams ? 'g' : 'serving',
    items: [
      {
        name: form.name,
        grams,
        kcal100: form.kcal * scale,
        protein100: form.protein * scale,
        carbs100: form.carbs * scale,
        fat100: form.fat * scale,
      },
    ],
  })

  return {
    id,
    warning:
      quality === 'suspect'
        ? "Those macros don't add up to that calorie count. Saved anyway — double-check if it looks off."
        : null,
  }
}
