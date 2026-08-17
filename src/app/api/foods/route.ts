import { randomUUID } from 'node:crypto'

import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/db'
import { barcodeCache, foodLogs, foods } from '@/db/schema'
import { getSession } from '@/lib/dal'
import { normalizeBarcode } from '@/lib/food/barcode'
import { lookupBarcode, searchOff, type OffFood } from '@/lib/food/off'

export const runtime = 'nodejs'

/** OFF product data is near-static; a month-old row is fine and saves a call. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type FoodResult = {
  id: string
  name: string
  brand: string | null
  kcal100: number
  protein100: number | null
  carbs100: number | null
  fat100: number | null
  fiber100: number | null
  sugar100: number | null
  sodiumMg100: number | null
  servingGrams: number | null
  servingLabel: string | null
  source: string
  dataQuality: string
  imageUrl: string | null
}

const toResult = (f: typeof foods.$inferSelect): FoodResult => ({
  id: f.id,
  name: f.name,
  brand: f.brand,
  kcal100: f.kcal100,
  protein100: f.protein100,
  carbs100: f.carbs100,
  fat100: f.fat100,
  fiber100: f.fiber100,
  sugar100: f.sugar100,
  sodiumMg100: f.sodiumMg100,
  servingGrams: null,
  servingLabel: null,
  source: f.source,
  dataQuality: f.dataQuality,
  imageUrl: f.imageUrl,
})

async function persistOff(off: OffFood): Promise<typeof foods.$inferSelect> {
  const existing = (
    await db
      .select()
      .from(foods)
      .where(and(eq(foods.source, 'off'), eq(foods.sourceId, off.barcode)))
      .limit(1)
  )[0]

  const values = {
    name: off.name,
    brand: off.brand,
    barcode: off.barcode,
    kcal100: off.kcal100,
    protein100: off.protein100,
    carbs100: off.carbs100,
    fat100: off.fat100,
    fiber100: off.fiber100,
    sugar100: off.sugar100,
    satFat100: off.satFat100,
    sodiumMg100: off.sodiumMg100,
    imageUrl: off.imageUrl,
    dataQuality: off.dataQuality,
    fetchedAt: new Date(),
    rawJson: JSON.stringify(off.raw),
  }

  if (existing) {
    await db.update(foods).set(values).where(eq(foods.id, existing.id))
    return { ...existing, ...values } as typeof foods.$inferSelect
  }

  const id = randomUUID()
  await db.insert(foods).values({ id, source: 'off', sourceId: off.barcode, ...values })
  return (await db.select().from(foods).where(eq(foods.id, id)).limit(1))[0]
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const url = new URL(request.url)
  const barcode = url.searchParams.get('barcode')
  const query = (url.searchParams.get('q') ?? '').trim()

  // ------------------------------------------------------------- barcode
  if (barcode) {
    const code = normalizeBarcode(barcode)
    if (!code) return NextResponse.json({ error: 'Not a valid barcode.' }, { status: 400 })

    const cached = (
      await db.select().from(barcodeCache).where(eq(barcodeCache.barcode, code)).limit(1)
    )[0]

    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      if (cached.notFound) return NextResponse.json({ food: null, cached: true })
      const food = (
        await db.select().from(foods).where(eq(foods.id, cached.foodId!)).limit(1)
      )[0]
      if (food) return NextResponse.json({ food: toResult(food), cached: true })
    }

    try {
      const off = await lookupBarcode(code)
      if (!off) {
        await db
          .insert(barcodeCache)
          .values({ barcode: code, notFound: true, fetchedAt: new Date() })
          .onConflictDoUpdate({
            target: barcodeCache.barcode,
            set: { notFound: true, foodId: null, fetchedAt: new Date() },
          })
        return NextResponse.json({ food: null })
      }

      const row = await persistOff(off)
      await db
        .insert(barcodeCache)
        .values({ barcode: code, foodId: row.id, notFound: false, fetchedAt: new Date() })
        .onConflictDoUpdate({
          target: barcodeCache.barcode,
          set: { foodId: row.id, notFound: false, fetchedAt: new Date() },
        })

      return NextResponse.json({
        food: { ...toResult(row), servingGrams: off.servingGrams, servingLabel: off.servingLabel },
      })
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.message.includes('no nutrition')
              ? error.message
              : 'Could not reach Open Food Facts. You can still add this manually.',
        },
        { status: 502 },
      )
    }
  }

  // -------------------------------------------------------------- search
  if (!query) {
    // Empty query: the "Recently logged" list, deduped by name.
    const recent = await db
      .select({
        name: foodLogs.name,
        brand: foodLogs.brand,
        kcal: sql<number>`max(${foodLogs.kcal})`,
        grams: sql<number>`max(${foodLogs.grams})`,
        portion: sql<string>`max(${foodLogs.portionLabel})`,
        at: sql<number>`max(${foodLogs.loggedAt})`,
      })
      .from(foodLogs)
      .where(eq(foodLogs.userId, session.userId))
      .groupBy(foodLogs.name)
      .orderBy(desc(sql`max(${foodLogs.loggedAt})`))
      .limit(25)

    return NextResponse.json({
      recent: recent.map((r) => ({
        name: r.name,
        brand: r.brand,
        kcal: Number(r.kcal),
        grams: Number(r.grams),
        portionLabel: r.portion,
      })),
    })
  }

  // Local first — the bundled USDA rows and anything cached from OFF. This is
  // what makes search work offline and with no API key.
  const localRows = await db
    .select()
    .from(foods)
    .where(
      and(
        or(like(foods.name, `%${query}%`), like(foods.brand, `%${query}%`)),
        or(eq(foods.source, 'usda'), eq(foods.source, 'off'), eq(foods.source, 'user')),
      ),
    )
    .limit(30)

  let remote: FoodResult[] = []
  if (localRows.length < 8) {
    try {
      const offResults = await searchOff(query, 15)
      remote = offResults.map((o) => ({
        id: `off:${o.barcode}`,
        name: o.name,
        brand: o.brand,
        kcal100: o.kcal100,
        protein100: o.protein100,
        carbs100: o.carbs100,
        fat100: o.fat100,
        fiber100: o.fiber100,
        sugar100: o.sugar100,
        sodiumMg100: o.sodiumMg100,
        servingGrams: o.servingGrams,
        servingLabel: o.servingLabel,
        source: 'off',
        dataQuality: o.dataQuality,
        imageUrl: o.imageUrl,
      }))
    } catch {
      // Rate limited or offline — local results still stand on their own.
    }
  }

  const seen = new Set<string>()
  const results = [...localRows.map(toResult), ...remote].filter((r) => {
    const key = `${r.name.toLowerCase()}|${r.brand?.toLowerCase() ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json({ results })
}
