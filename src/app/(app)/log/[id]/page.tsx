import { and, asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'

import { db } from '@/db'
import { foodLogItems, foodLogs } from '@/db/schema'
import { requireUser } from '@/lib/dal'
import { FoodDetail } from './food-detail'

export const dynamic = 'force-dynamic'

export default async function LogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params // Next 16: params is a Promise
  const user = await requireUser()

  const log = (
    await db
      .select()
      .from(foodLogs)
      .where(and(eq(foodLogs.id, id), eq(foodLogs.userId, user.id)))
      .limit(1)
  )[0]
  if (!log) notFound()

  const items = await db
    .select()
    .from(foodLogItems)
    .where(eq(foodLogItems.logId, id))
    .orderBy(asc(foodLogItems.position))

  return (
    <FoodDetail
      log={{
        id: log.id,
        name: log.name,
        brand: log.brand,
        photoPath: log.photoPath,
        quantity: log.quantity,
        loggedAt: log.loggedAt.getTime(),
        healthScore: log.healthScore,
        kcalLow: log.kcalLow,
        kcalHigh: log.kcalHigh,
        aiConfidence: log.aiConfidence,
        scaleReference: log.scaleReference,
        assumptions: log.assumptions ? (JSON.parse(log.assumptions) as string[]) : [],
      }}
      items={items.map((i) => ({
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
      }))}
      timeZone={user.timezone}
    />
  )
}
