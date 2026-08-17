/**
 * Civil-date helpers.
 *
 * The whole app buckets by a 'YYYY-MM-DD' string in the *user's* timezone, not
 * by a UTC instant. A user in UTC-8 logging dinner at 8pm must see it on today,
 * not tomorrow — which is what `date(loggedAt)` on a UTC millisecond value
 * would give you.
 */

export type LocalDate = string // 'YYYY-MM-DD'

/** The user's civil date for a given instant. */
export function toLocalDate(instant: Date | number, timeZone: string): LocalDate {
  const d = typeof instant === 'number' ? new Date(instant) : instant
  // en-CA formats as YYYY-MM-DD, which is exactly what we store.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function todayLocal(timeZone: string): LocalDate {
  return toLocalDate(new Date(), timeZone)
}

/** Shift a civil date by whole days without ever touching a timezone. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d + days)
  return new Date(utc).toISOString().slice(0, 10)
}

export function diffDays(from: LocalDate, to: LocalDate): number {
  const [ay, am, ad] = from.split('-').map(Number)
  const [by, bm, bd] = to.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** Inclusive range of civil dates. Used by every chart and the EWMA walk. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = []
  const n = diffDays(from, to)
  for (let i = 0; i <= n; i++) out.push(addDays(from, i))
  return out
}

/** 0 = Sunday, matching the week strip and the Sun-Sat weekly charts. */
export function dayOfWeek(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** The Sunday that starts this date's week. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -dayOfWeek(date))
}

/** The 7-day window the Home strip shows: 5 days back through 1 day forward. */
export function weekStripRange(selected: LocalDate): LocalDate[] {
  return eachDay(addDays(selected, -5), addDays(selected, 1))
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weekdayLabel(date: LocalDate): string {
  return WEEKDAY_LABELS[dayOfWeek(date)]
}

export function dayOfMonth(date: LocalDate): number {
  return Number(date.slice(8, 10))
}

export function formatLongDate(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Age in whole years on a given civil date. */
export function ageOn(birthDate: LocalDate, on: LocalDate): number {
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [oy, om, od] = on.split('-').map(Number)
  let age = oy - by
  if (om < bm || (om === bm && od < bd)) age--
  return age
}

/** Resolve a browser-reported IANA zone, falling back safely. */
export function safeTimeZone(tz: string | undefined | null): string {
  if (!tz) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}
