import Link from 'next/link'

import { and, asc, eq, gte } from 'drizzle-orm'

import { db } from '@/db'
import { exerciseLogs, weightEntries } from '@/db/schema'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  FlameIcon,
} from '@/components/icons'
import { BmiBar, DailyCaloriesChart, Sparkline, WeeklyEnergyChart, WeightChart } from '@/components/charts'
import { requireUser } from '@/lib/dal'
import { addDays, eachDay, startOfWeek, todayLocal, weekdayLabel } from '@/lib/date'
import { goalForDate, loggedDatesSince, summariesForRange } from '@/lib/day'
import {
  adaptiveTdee,
  bmi,
  bmiBarPosition,
  bmiCategory,
  computeStreak,
  computeWeightTrend,
  EXPENDITURE_WINDOWS,
  formatKcal,
  formatWeight,
  goalEta,
  kgToLb,
  WEIGHT_WINDOWS,
  weightChanges,
  type ChangeRow,
} from '@/lib/metrics'
import { formatLongDate } from '@/lib/date'

export const metadata = { title: 'Progress · Cal AI' }
export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  const user = await requireUser()
  const today = todayLocal(user.timezone)
  const from = addDays(today, -120)

  const [weights, summaries, goal, loggedDates, exercise] = await Promise.all([
    db
      .select()
      .from(weightEntries)
      .where(and(eq(weightEntries.userId, user.id), gte(weightEntries.localDate, from)))
      .orderBy(asc(weightEntries.localDate)),
    summariesForRange(user.id, from, today),
    goalForDate(user.id, today),
    loggedDatesSince(user.id, addDays(today, -400)),
    db
      .select()
      .from(exerciseLogs)
      .where(and(eq(exerciseLogs.userId, user.id), gte(exerciseLogs.localDate, from)))
      .orderBy(asc(exerciseLogs.localDate)),
  ])

  const trend = computeWeightTrend(
    weights.map((w) => ({ localDate: w.localDate, weightKg: w.weightKg })),
    today,
  )
  const currentKg = trend.at(-1)?.trendKg ?? user.startWeightKg ?? null
  const streak = computeStreak(loggedDates, today)

  // Adaptive expenditure, and the change table the reference app shows.
  const energyDays = eachDay(from, today).map((date) => {
    const point = trend.find((t) => t.date === date)
    return {
      date,
      intakeKcal: summaries.get(date)?.totals.kcal ?? null,
      trendKg: point?.trendKg ?? currentKg ?? 0,
    }
  })
  const formulaTdee = goal?.tdee ?? 2200
  const expenditureNow = adaptiveTdee({ days: energyDays, formulaTdee })

  const expenditureRows: ChangeRow[] = EXPENDITURE_WINDOWS.map((windowDays) => {
    const past = adaptiveTdee({
      days: energyDays.slice(0, Math.max(0, energyDays.length - windowDays)),
      formulaTdee,
    })
    const delta = expenditureNow.value - past.value
    return {
      windowDays,
      delta,
      direction: Math.abs(delta) < 1 ? 'No change' : delta > 0 ? 'Increase' : 'Decrease',
    }
  })

  const weightRows = weightChanges(trend, WEIGHT_WINDOWS)

  // This week, Sun-Sat, for the energy chart.
  const weekStart = startOfWeek(today)
  const week = eachDay(weekStart, addDays(weekStart, 6)).map((date) => ({
    label: weekdayLabel(date).slice(0, 3),
    burned: exercise
      .filter((e) => e.localDate === date)
      .reduce((a, e) => a + e.kcalBurned, 0),
    consumed: summaries.get(date)?.totals.kcal ?? 0,
  }))
  const weekBurned = week.reduce((a, d) => a + d.burned, 0)
  const weekConsumed = week.reduce((a, d) => a + d.consumed, 0)

  const dailyAverage = eachDay(addDays(today, -6), today).map((date) => ({
    label: weekdayLabel(date).slice(0, 1),
    value: summaries.get(date)?.totals.kcal ?? 0,
  }))

  const bmiValue = currentKg && user.heightCm ? bmi(currentKg, user.heightCm) : null
  const eta =
    currentKg && user.goalWeightKg && user.weeklyRateKg !== 0
      ? goalEta({
          currentKg,
          goalKg: user.goalWeightKg,
          weeklyRateKg: user.weeklyRateKg,
          from: today,
        })
      : null

  const fmtWeight = (kg: number) => formatWeight(kg, user.units)
  const startKg = user.startWeightKg ?? currentKg ?? 0
  const goalKg = user.goalWeightKg ?? 0
  const progressPct =
    startKg && goalKg && startKg !== goalKg && currentKg
      ? Math.max(0, Math.min(100, ((startKg - currentKg) / (startKg - goalKg)) * 100))
      : 0

  return (
    <div className="flex flex-col gap-5 pt-2">
      <h1 className="text-title">Progress</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="card flex flex-col items-center gap-2 p-5">
          <FlameIcon size={38} filled className="text-[#FF8A3D]" />
          <p className="text-stat tabular">{streak}</p>
          <p className="label-muted text-[14px]">Day Streak</p>
        </div>
        <div className="card flex flex-col items-center justify-center gap-2 p-5">
          <p className="text-stat tabular">{loggedDates.size}</p>
          <p className="label-muted text-center text-[14px]">Days logged</p>
        </div>
      </div>

      {/* Current weight */}
      <section className="card flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-muted">Current Weight</p>
            <p className="text-stat tabular">{currentKg ? fmtWeight(currentKg) : '—'}</p>
          </div>
          <Link href="/progress/weight" className="btn-pill">
            Log weight <ArrowRight size={16} />
          </Link>
        </div>

        {startKg > 0 && goalKg > 0 && (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-track">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[14px] text-ink-muted">
              <span>
                Start: <strong className="font-semibold text-ink">{fmtWeight(startKg)}</strong>
              </span>
              <span>
                Goal: <strong className="font-semibold text-ink">{fmtWeight(goalKg)}</strong>
              </span>
            </div>
            {eta && (
              <p className="label-muted text-[14px]">
                At your goal by <strong className="font-semibold text-ink">{formatLongDate(eta)}</strong>.
              </p>
            )}
          </>
        )}
      </section>

      {/* Weight chart */}
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[19px] font-bold">Weight Progress</h2>
        <WeightChart points={trend} goalKg={user.goalWeightKg} format={fmtWeight} />
      </section>

      {/* Weight changes */}
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[19px] font-bold">Weight Changes</h2>
        <ul className="flex flex-col">
          {weightRows.map((row, i) => (
            <li
              key={row.windowDays}
              className={`flex items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <span className="w-16 shrink-0 text-[15px] text-ink-muted">
                {row.windowDays} day
              </span>
              <Sparkline
                values={trendWindow(trend, row.windowDays)}
                color={row.delta < 0 ? 'var(--color-good)' : 'var(--color-ink-muted)'}
              />
              <span className="flex-1 text-right text-[16px] font-semibold tabular">
                {user.units === 'imperial'
                  ? `${kgToLb(row.delta).toFixed(1)} lbs`
                  : `${row.delta.toFixed(1)} kg`}
              </span>
              <span className="flex w-24 shrink-0 items-center justify-end gap-1 text-[14px] text-ink-muted">
                <DirectionIcon direction={row.direction} />
                {row.direction}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Daily average calories */}
      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[19px] font-bold">Daily Average Calories</h2>
        <DailyCaloriesChart days={dailyAverage} goal={goal?.calories} />
      </section>

      {/* Weekly energy */}
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-[19px] font-bold">Weekly Energy</h2>
        <div className="flex gap-6">
          <Stat label="Burned" value={weekBurned} />
          <Stat label="Consumed" value={weekConsumed} />
          <Stat label="Energy" value={weekConsumed - weekBurned} signed />
        </div>
        <WeeklyEnergyChart days={week} />
      </section>

      {/* Expenditure changes */}
      <section className="card flex flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[19px] font-bold">Expenditure Changes</h2>
          <span className="text-[15px] font-semibold tabular">
            {formatKcal(expenditureNow.value)} cal
          </span>
        </div>
        <p className="label-muted text-[13px]">
          {expenditureNow.isAdaptive
            ? 'Measured from what you logged and how your weight trend moved — not from a formula.'
            : 'Estimated from your height, weight and activity. Once you have about two weeks of food and weight data this switches to a measurement.'}
        </p>
        <ul className="flex flex-col">
          {expenditureRows.map((row, i) => (
            <li
              key={row.windowDays}
              className={`flex items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <span className="w-16 shrink-0 text-[15px] text-ink-muted">{row.windowDays} day</span>
              <span className="flex-1 text-right text-[16px] font-semibold tabular">
                {row.delta > 0 ? '+' : ''}
                {row.delta.toFixed(1)} cal
              </span>
              <span className="flex w-24 shrink-0 items-center justify-end gap-1 text-[14px] text-ink-muted">
                <DirectionIcon direction={row.direction} />
                {row.direction}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* BMI */}
      {bmiValue != null && (
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-[19px] font-bold">Your BMI</h2>
          <div className="flex items-baseline gap-3">
            <p className="text-stat tabular">{bmiValue.toFixed(1)}</p>
            <p className="label-muted">
              Your weight is{' '}
              <span className="chip ml-1">{bmiCategory(bmiValue)}</span>
            </p>
          </div>
          <BmiBar value={bmiValue} position={bmiBarPosition(bmiValue)} />
          <p className="label-muted text-[13px]">
            BMI does not know the difference between muscle and fat, and it is not meaningful
            during pregnancy or for children. Your weight trend is the more useful number.
          </p>
        </section>
      )}
    </div>
  )
}

function trendWindow(trend: { trendKg: number }[], days: number): number[] {
  const slice = trend.slice(Math.max(0, trend.length - days - 1))
  return slice.length >= 2 ? slice.map((t) => t.trendKg) : [0, 0]
}

function DirectionIcon({ direction }: { direction: ChangeRow['direction'] }) {
  if (direction === 'Increase') return <ArrowUpRight size={15} />
  if (direction === 'Decrease') return <ArrowDownRight size={15} />
  return <ArrowRight size={15} />
}

function Stat({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  return (
    <div>
      <p className="label-muted text-[14px]">{label}</p>
      <p className="text-[24px] font-bold tabular">
        {signed && value > 0 ? '+' : ''}
        {formatKcal(value)} <span className="text-[14px] font-normal text-ink-muted">cal</span>
      </p>
    </div>
  )
}
