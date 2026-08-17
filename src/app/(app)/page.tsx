import Link from 'next/link'

import { FlameIcon, PlateMark } from '@/components/icons'
import { DayRing, ProgressRing } from '@/components/progress-ring'
import { requireUser } from '@/lib/dal'
import {
  addDays,
  dayOfMonth,
  todayLocal,
  weekdayLabel,
  weekStripRange,
  type LocalDate,
} from '@/lib/date'
import {
  buildDayView,
  buildWeekStrip,
  loggedDatesSince,
  recentEntries,
} from '@/lib/day'
import { computeStreak } from '@/lib/metrics'
import { MacroCarousel } from './macro-carousel'
import { EntryRow } from './entry-row'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams

  const today = todayLocal(user.timezone)
  const selected: LocalDate = /^\d{4}-\d{2}-\d{2}$/.test(params.d ?? '') ? params.d! : today

  const strip = weekStripRange(selected)
  const [day, stripDays, entries, loggedDates] = await Promise.all([
    buildDayView(user, selected),
    buildWeekStrip(user.id, strip, today, selected),
    recentEntries(user.id, selected),
    loggedDatesSince(user.id, addDays(today, -400)),
  ])

  const streak = computeStreak(loggedDates, today)
  const goal = day.goal
  const eatenRatio = day.budget > 0 ? day.totals.kcal / day.budget : 0

  const macros = [
    {
      key: 'protein' as const,
      label: 'Protein left',
      left: (goal?.proteinG ?? 0) - day.totals.protein,
      goal: goal?.proteinG ?? 0,
      eaten: day.totals.protein,
      color: 'var(--color-protein)',
      glyph: '🍗',
    },
    {
      key: 'carbs' as const,
      label: 'Carbs left',
      left: (goal?.carbsG ?? 0) - day.totals.carbs,
      goal: goal?.carbsG ?? 0,
      eaten: day.totals.carbs,
      color: 'var(--color-carbs)',
      glyph: '🌾',
    },
    {
      key: 'fat' as const,
      label: 'Fat left',
      left: (goal?.fatG ?? 0) - day.totals.fat,
      goal: goal?.fatG ?? 0,
      eaten: day.totals.fat,
      color: 'var(--color-fat)',
      glyph: '💧',
    },
  ]

  return (
    <div className="flex flex-col gap-5 pt-2">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlateMark size={30} />
          <span className="text-[27px] font-bold tracking-[-0.03em]">Plate</span>
        </div>
        <Link
          href="/progress"
          className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 shadow-[var(--shadow-card)]"
          aria-label={`${streak} day streak`}
        >
          <FlameIcon size={18} filled className="text-[#FF8A3D]" />
          <span className="text-[17px] font-semibold tabular">{streak}</span>
        </Link>
      </header>

      {/* Week strip */}
      <nav aria-label="Select a day" className="grid grid-cols-7 gap-1">
        {stripDays.map((d) => {
          const isFuture = d.date > today
          return (
            <Link
              key={d.date}
              href={d.date === today ? '/' : `/?d=${d.date}`}
              aria-current={d.isSelected ? 'date' : undefined}
              aria-disabled={isFuture}
              tabIndex={isFuture ? -1 : undefined}
              className={`flex flex-col items-center gap-1.5 rounded-[18px] py-2 transition-colors ${
                d.isSelected ? 'bg-card shadow-[var(--shadow-card)]' : ''
              } ${isFuture ? 'pointer-events-none' : ''}`}
            >
              <span
                className={`text-[13px] font-medium ${
                  isFuture ? 'text-ink-faint' : d.isSelected ? 'text-ink' : 'text-ink-muted'
                }`}
              >
                {weekdayLabel(d.date)}
              </span>
              <DayRing
                state={d.state === 'selected' ? 'dotted' : d.state}
                day={dayOfMonth(d.date)}
                selected={d.isSelected}
              />
            </Link>
          )
        })}
      </nav>

      {/* Calories + macros carousel */}
      <MacroCarousel
        left={day.left}
        eatenRatio={eatenRatio}
        burnedBonus={day.burnedBonus}
        rollover={day.rollover}
        eaten={day.totals.kcal}
        budget={day.budget}
        macros={macros}
      />

      {/* Recently uploaded */}
      <section className="flex flex-col gap-3">
        <h2 className="section-title">
          {selected === today ? 'Recently uploaded' : 'Logged this day'}
        </h2>

        {entries.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <ProgressRing progress={0} size={64} stroke={7}>
              <FlameIcon size={22} className="text-ink-muted" />
            </ProgressRing>
            <p className="text-[17px] font-semibold">Nothing logged yet</p>
            <p className="label-muted max-w-[30ch]">
              Tap the plus button to scan a meal, search the food database, or add something
              manually.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      {goal == null && (
        <Link href="/onboarding" className="card flex flex-col gap-2 p-5">
          <span className="text-[17px] font-semibold">Set your daily targets</span>
          <span className="label-muted">
            Answer a few questions and Plate will work out your calories and macros.
          </span>
        </Link>
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'
