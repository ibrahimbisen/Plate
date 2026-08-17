import 'server-only'

import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'

import { db } from '@/db'
import { exerciseLogs, foodLogs, nutritionGoals, type NutritionGoal } from '@/db/schema'
import { addDays, type LocalDate } from './date'
import { caloriesLeft, EMPTY_TOTALS, ringState, type DayTotals, type RingState } from './metrics'
import type { CurrentUser } from './dal'

/**
 * The goal in force on a given day.
 *
 * Goals are history rows, so a day is always evaluated against the target that
 * was set at the time. Editing today's goal never rewrites last month's rings.
 */
export async function goalForDate(userId: string, date: LocalDate): Promise<NutritionGoal | null> {
  const rows = await db
    .select()
    .from(nutritionGoals)
    .where(and(eq(nutritionGoals.userId, userId), lte(nutritionGoals.effectiveFrom, date)))
    .orderBy(desc(nutritionGoals.effectiveFrom))
    .limit(1)
  return rows[0] ?? null
}

export async function goalsForRange(
  userId: string,
  from: LocalDate,
  to: LocalDate,
): Promise<Map<LocalDate, NutritionGoal>> {
  // Include the most recent goal at or before `from`, so early days in the
  // range are not left without one.
  const rows = await db
    .select()
    .from(nutritionGoals)
    .where(and(eq(nutritionGoals.userId, userId), lte(nutritionGoals.effectiveFrom, to)))
    .orderBy(nutritionGoals.effectiveFrom)

  const out = new Map<LocalDate, NutritionGoal>()
  let current: NutritionGoal | null = null
  for (const row of rows) {
    if (row.effectiveFrom <= from) current = row
    else out.set(row.effectiveFrom, row)
  }
  return Object.assign(out, { __initial: current }) as Map<LocalDate, NutritionGoal> & {
    __initial: NutritionGoal | null
  }
}

export type DaySummary = {
  date: LocalDate
  totals: DayTotals
  burned: number
  entryCount: number
}

/** Per-day food totals across a civil-date range, grouped by localDate. */
export async function summariesForRange(
  userId: string,
  from: LocalDate,
  to: LocalDate,
): Promise<Map<LocalDate, DaySummary>> {
  const [food, exercise] = await Promise.all([
    db
      .select({
        date: foodLogs.localDate,
        kcal: sql<number>`coalesce(sum(${foodLogs.kcal}), 0)`,
        protein: sql<number>`coalesce(sum(${foodLogs.protein}), 0)`,
        carbs: sql<number>`coalesce(sum(${foodLogs.carbs}), 0)`,
        fat: sql<number>`coalesce(sum(${foodLogs.fat}), 0)`,
        entryCount: sql<number>`count(*)`,
      })
      .from(foodLogs)
      .where(
        and(
          eq(foodLogs.userId, userId),
          gte(foodLogs.localDate, from),
          lte(foodLogs.localDate, to),
        ),
      )
      .groupBy(foodLogs.localDate),
    db
      .select({
        date: exerciseLogs.localDate,
        burned: sql<number>`coalesce(sum(${exerciseLogs.kcalBurned}), 0)`,
      })
      .from(exerciseLogs)
      .where(
        and(
          eq(exerciseLogs.userId, userId),
          gte(exerciseLogs.localDate, from),
          lte(exerciseLogs.localDate, to),
        ),
      )
      .groupBy(exerciseLogs.localDate),
  ])

  const map = new Map<LocalDate, DaySummary>()
  for (const row of food) {
    map.set(row.date, {
      date: row.date,
      totals: {
        kcal: Number(row.kcal),
        protein: Number(row.protein),
        carbs: Number(row.carbs),
        fat: Number(row.fat),
      },
      burned: 0,
      entryCount: Number(row.entryCount),
    })
  }
  for (const row of exercise) {
    const existing = map.get(row.date)
    if (existing) existing.burned = Number(row.burned)
    else
      map.set(row.date, {
        date: row.date,
        totals: { ...EMPTY_TOTALS },
        burned: Number(row.burned),
        entryCount: 0,
      })
  }
  return map
}

export type DayView = {
  date: LocalDate
  goal: NutritionGoal | null
  totals: DayTotals
  burned: number
  entryCount: number
  left: number
  budget: number
  burnedBonus: number
  rollover: number
}

/** Everything the Home screen needs for the selected day. */
export async function buildDayView(user: CurrentUser, date: LocalDate): Promise<DayView> {
  const yesterday = addDays(date, -1)

  const [goal, goalYesterday, summaries] = await Promise.all([
    goalForDate(user.id, date),
    goalForDate(user.id, yesterday),
    summariesForRange(user.id, yesterday, date),
  ])

  const today = summaries.get(date)
  const prev = summaries.get(yesterday)
  const totals = today?.totals ?? { ...EMPTY_TOTALS }
  const burned = today?.burned ?? 0

  const { left, budget, burnedBonus, rollover } = caloriesLeft({
    goalCalories: goal?.calories ?? 2000,
    eatenToday: totals.kcal,
    burnedToday: burned,
    addBurnedCalories: user.preferences.addBurnedCalories,
    rolloverCalories: user.preferences.rolloverCalories,
    goalYesterday: goalYesterday?.calories,
    eatenYesterday: prev?.totals.kcal,
  })

  return {
    date,
    goal,
    totals,
    burned,
    entryCount: today?.entryCount ?? 0,
    left,
    budget,
    burnedBonus,
    rollover,
  }
}

export type StripDay = {
  date: LocalDate
  state: RingState
  isSelected: boolean
}

/** Ring state for each day in the Home week strip. */
export async function buildWeekStrip(
  userId: string,
  dates: LocalDate[],
  today: LocalDate,
  selected: LocalDate,
): Promise<StripDay[]> {
  const from = dates[0]
  const to = dates[dates.length - 1]
  const [summaries, goals] = await Promise.all([
    summariesForRange(userId, from, to),
    db
      .select()
      .from(nutritionGoals)
      .where(and(eq(nutritionGoals.userId, userId), lte(nutritionGoals.effectiveFrom, to)))
      .orderBy(nutritionGoals.effectiveFrom),
  ])

  function goalOn(date: LocalDate): number {
    let value = 2000
    for (const g of goals) {
      if (g.effectiveFrom <= date) value = g.calories
      else break
    }
    return value
  }

  return dates.map((date) => {
    const summary = summaries.get(date)
    return {
      date,
      isSelected: date === selected,
      state: ringState({
        hasLogs: (summary?.entryCount ?? 0) > 0,
        eaten: summary?.totals.kcal ?? 0,
        goal: goalOn(date),
        isFuture: date > today,
      }),
    }
  })
}

/** "Recently uploaded" — the selected day's entries, newest first. */
export async function recentEntries(userId: string, date: LocalDate) {
  return db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.localDate, date)))
    .orderBy(desc(foodLogs.loggedAt))
    .limit(50)
}

export async function loggedDatesSince(userId: string, from: LocalDate): Promise<Set<LocalDate>> {
  const rows = await db
    .selectDistinct({ date: foodLogs.localDate })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.localDate, from)))
  return new Set(rows.map((r) => r.date))
}

export { inArray }
