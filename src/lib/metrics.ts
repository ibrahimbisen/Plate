/**
 * Every derived number in the app. Pure functions, no I/O, no framework —
 * so they can be unit-tested and reasoned about in isolation.
 *
 * Sources for the non-obvious constants are cited inline. Where a widely-used
 * convention has no authoritative backing (the activity multipliers, the
 * calorie floors), that is stated rather than hidden.
 */

import { addDays, diffDays, eachDay, type LocalDate } from './date'

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export const KG_PER_LB = 0.45359237
export const KCAL_PER_KG = 7700 // ~3500 kcal/lb, the conventional energy density
export const CM_PER_IN = 2.54

export const lbToKg = (lb: number) => lb * KG_PER_LB
export const kgToLb = (kg: number) => kg / KG_PER_LB
export const inToCm = (inches: number) => inches * CM_PER_IN
export const cmToIn = (cm: number) => cm / CM_PER_IN

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// ---------------------------------------------------------------------------
// Energy targets
// ---------------------------------------------------------------------------

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'

/**
 * Mifflin–St Jeor, the equation the Academy of Nutrition and Dietetics found
 * most accurate in both non-obese and obese adults.
 * Mifflin MD et al., Am J Clin Nutr 1990;51:241-247.
 */
export function bmrMifflinStJeor(opts: {
  weightKg: number
  heightCm: number
  age: number
  sex: Sex
}): number {
  const base = 10 * opts.weightKg + 6.25 * opts.heightCm - 5 * opts.age
  return opts.sex === 'male' ? base + 5 : base - 161
}

/**
 * NOTE ON HONESTY: these multipliers are a long-standing convention with no
 * authoritative primary source. They are NOT from the Mifflin paper. The
 * FAO/WHO/UNU PAL table gives materially different values — it puts sedentary
 * adults in industrialised countries at ~1.5, not 1.2.
 *
 * They are a starting point only. After ~2-3 weeks the adaptive expenditure
 * estimator below supersedes them with a measurement, which is the real answer.
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, { title: string; detail: string }> = {
  sedentary: { title: 'Sedentary', detail: 'Little or no exercise, desk job' },
  light: { title: 'Lightly active', detail: 'Light exercise 1–3 days a week' },
  moderate: { title: 'Moderately active', detail: 'Moderate exercise 3–5 days a week' },
  very: { title: 'Very active', detail: 'Hard exercise 6–7 days a week' },
  extra: { title: 'Extra active', detail: 'Hard exercise plus a physical job' },
}

export function tdeeFromBmr(bmr: number, activity: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activity]
}

/**
 * Floors follow the 2013 AHA/ACC/TOS obesity guidelines (1200–1500 kcal for
 * women, 1500–1800 for men). We also clamp at BMR: a 250 lb user with a
 * 2100 kcal BMR should never be handed a nominally-legal 1500 kcal target.
 */
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 }

export type CalorieTarget = {
  calories: number
  /** True when the requested pace was not achievable within the safety floor. */
  floored: boolean
  floorReason: 'bmr' | 'minimum' | null
  /** The pace actually delivered, which may be gentler than the one requested. */
  effectiveWeeklyRateKg: number
}

/**
 * Note the consequence of the BMR clamp: a sedentary user has TDEE = BMR x 1.2,
 * so their largest possible deficit is ~20%. Asking for 1 lb/week gets them
 * about 0.7. That is the correct safety behaviour, but it must never be
 * silent — `floored` exists so the UI can say the pace was capped.
 */
export function dailyCalorieTargetDetailed(opts: {
  tdee: number
  bmr: number
  weeklyRateKg: number // negative to lose
  sex: Sex
}): CalorieTarget {
  const raw = opts.tdee + (opts.weeklyRateKg * KCAL_PER_KG) / 7

  // A surplus is free to exceed TDEE; only deficits are clamped.
  if (opts.weeklyRateKg >= 0) {
    return {
      calories: Math.round(raw),
      floored: false,
      floorReason: null,
      effectiveWeeklyRateKg: opts.weeklyRateKg,
    }
  }

  const bmrFloor = Math.round(opts.bmr)
  const minFloor = CALORIE_FLOOR[opts.sex]
  const floor = Math.max(bmrFloor, minFloor)
  const calories = Math.round(Math.max(raw, floor))
  const floored = calories > Math.round(raw)

  return {
    calories,
    floored,
    floorReason: floored ? (bmrFloor >= minFloor ? 'bmr' : 'minimum') : null,
    effectiveWeeklyRateKg: ((calories - opts.tdee) * 7) / KCAL_PER_KG,
  }
}

export function dailyCalorieTarget(opts: {
  tdee: number
  bmr: number
  weeklyRateKg: number
  sex: Sex
}): number {
  return dailyCalorieTargetDetailed(opts).calories
}

/** Safety rail on the rate picker: ~1% of bodyweight per week. */
export function maxWeeklyRateKg(weightKg: number): number {
  return Math.max(0.25, Math.round(weightKg * 0.01 * 10) / 10)
}

// ---------------------------------------------------------------------------
// Macros
// ---------------------------------------------------------------------------

export type Macros = { proteinG: number; carbsG: number; fatG: number }

/**
 * Protein is anchored to BODYWEIGHT, not to a percentage of calories.
 *
 * A fixed 40/30/30 split makes protein scale *with* the calorie target, which
 * is backwards: protein needs go UP as calories come down. ISSN's position
 * stand is 1.4–2.0 g/kg generally, and 2.3–3.1 g/kg to retain lean mass while
 * hypocaloric (Jäger et al., JISSN 2017).
 *
 * `anchorWeightKg` should be goal weight or lean mass for high-body-fat users;
 * "1 g per lb of current weight" massively overshoots at 300 lb.
 */
export function deriveMacros(opts: {
  calories: number
  anchorWeightKg: number
  goal: 'lose' | 'maintain' | 'gain'
}): Macros {
  const perKg = opts.goal === 'lose' ? 2.0 : opts.goal === 'gain' ? 1.8 : 1.6
  let proteinG = Math.round(opts.anchorWeightKg * perKg)

  let fatG = Math.round((opts.calories * 0.25) / 9)
  const fatFloorG = Math.round((opts.calories * 0.2) / 9) // AMDR lower bound

  let carbsG = Math.round((opts.calories - proteinG * 4 - fatG * 9) / 4)

  // Aggressive deficit: fat yields to its floor first, then protein.
  if (carbsG < 0) {
    fatG = fatFloorG
    carbsG = Math.round((opts.calories - proteinG * 4 - fatG * 9) / 4)
    if (carbsG < 0) {
      carbsG = 50
      proteinG = Math.max(50, Math.round((opts.calories - fatG * 9 - carbsG * 4) / 4))
    }
  }
  return { proteinG, carbsG, fatG }
}

export const kcalFromMacros = (m: Macros) => m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9

/**
 * Preferences → "Auto adjust macros": editing calories rescales P/C/F to
 * preserve the split; editing one macro recomputes calories at 4/4/9.
 */
export function rescaleMacrosToCalories(current: Macros, nextCalories: number): Macros {
  const currentKcal = kcalFromMacros(current)
  if (currentKcal <= 0) return current
  const factor = nextCalories / currentKcal
  return {
    proteinG: Math.round(current.proteinG * factor),
    carbsG: Math.round(current.carbsG * factor),
    fatG: Math.round(current.fatG * factor),
  }
}

// ---------------------------------------------------------------------------
// The daily number
// ---------------------------------------------------------------------------

export type DayTotals = {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export const EMPTY_TOTALS: DayTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export const ROLLOVER_CAP = 200 // screenshot: "Add up to 200 left over calories"

/**
 * caloriesLeft = goal
 *              + burned          (if prefs.addBurnedCalories)
 *              + rollover        (if prefs.rolloverCalories, capped at 200)
 *              - eaten
 */
export function caloriesLeft(opts: {
  goalCalories: number
  eatenToday: number
  burnedToday: number
  addBurnedCalories: boolean
  rolloverCalories: boolean
  goalYesterday?: number
  eatenYesterday?: number
}): { left: number; burnedBonus: number; rollover: number; budget: number } {
  const burnedBonus = opts.addBurnedCalories ? Math.max(0, opts.burnedToday) : 0

  let rollover = 0
  if (opts.rolloverCalories && opts.goalYesterday != null && opts.eatenYesterday != null) {
    rollover = clamp(opts.goalYesterday - opts.eatenYesterday, 0, ROLLOVER_CAP)
  }

  const budget = opts.goalCalories + burnedBonus + rollover
  return { left: Math.round(budget - opts.eatenToday), burnedBonus, rollover, budget }
}

// ---------------------------------------------------------------------------
// Week-strip ring state
// ---------------------------------------------------------------------------

export type RingState = 'dotted' | 'green' | 'yellow' | 'red' | 'future' | 'selected'

/**
 * From the in-app "Ring Colors Explained" screen:
 *   green  — up to 100 calories over the deficit target
 *   yellow — 100-200 over
 *   red    — more than 200 over
 *   dotted — nothing logged that day
 */
export function ringState(opts: {
  hasLogs: boolean
  eaten: number
  goal: number
  isFuture: boolean
}): RingState {
  if (opts.isFuture) return 'future'
  if (!opts.hasLogs) return 'dotted'
  const over = opts.eaten - opts.goal
  if (over <= 100) return 'green'
  if (over <= 200) return 'yellow'
  return 'red'
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

/**
 * Consecutive days ending today (or yesterday, so the streak survives until
 * the user logs) that have at least one food entry.
 */
export function computeStreak(loggedDates: Set<LocalDate>, today: LocalDate): number {
  let cursor = loggedDates.has(today) ? today : addDays(today, -1)
  if (!loggedDates.has(cursor)) return 0
  let streak = 0
  while (loggedDates.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

// ---------------------------------------------------------------------------
// BMI
// ---------------------------------------------------------------------------

export type BmiCategory = 'Underweight' | 'Healthy' | 'Overweight' | 'Obese'

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return weightKg / (m * m)
}

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'Underweight'
  if (value < 25) return 'Healthy'
  if (value < 30) return 'Overweight'
  return 'Obese'
}

/** Position 0-1 along the 4-segment bar, for the marker in the BMI card. */
export function bmiBarPosition(value: number): number {
  const MIN = 15
  const MAX = 40
  return clamp((value - MIN) / (MAX - MIN), 0, 1)
}

// ---------------------------------------------------------------------------
// Weight trend (EWMA) and adaptive expenditure
// ---------------------------------------------------------------------------

export const EWMA_ALPHA = 0.1

export type TrendPoint = { date: LocalDate; weightKg: number | null; trendKg: number }

/**
 * Hacker's Diet exponentially-weighted moving average:
 *   A[d] = A[d-1] + 0.1 * (M[d] - A[d-1])
 *
 * alpha = 0.1 is roughly a 20-day window. Daily scale noise from glycogen,
 * sodium and hydration is +/- 1-2 kg, which dwarfs a genuine 0.1 kg/day trend.
 *
 * Two subtleties that are easy to get wrong:
 *   - Walk EVERY CALENDAR DAY, not every entry. Applying one EWMA step across a
 *     5-day gap treats a 5-day change as a 1-day change and the trend lurches.
 *   - Seed with the first reading, not zero, or you get a garbage ramp-up.
 */
export function computeWeightTrend(
  entries: { localDate: LocalDate; weightKg: number }[],
  through?: LocalDate,
): TrendPoint[] {
  if (entries.length === 0) return []
  const sorted = [...entries].sort((a, b) => a.localDate.localeCompare(b.localDate))
  const byDate = new Map(sorted.map((e) => [e.localDate, e.weightKg]))

  const first = sorted[0].localDate
  const last = through ?? sorted[sorted.length - 1].localDate
  if (diffDays(first, last) < 0) return []

  let trend = sorted[0].weightKg
  const out: TrendPoint[] = []
  for (const date of eachDay(first, last)) {
    const reading = byDate.get(date)
    if (reading != null) trend = trend + EWMA_ALPHA * (reading - trend)
    out.push({ date, weightKg: reading ?? null, trendKg: trend })
  }
  return out
}

export type DayEnergy = { date: LocalDate; intakeKcal: number | null; trendKg: number }

/**
 * Adaptive TDEE from energy balance:
 *
 *   TDEE = [ sum(intake) + (trendStart - trendEnd) * 7700 ] / days
 *
 * Losing weight means the trend term is positive, i.e. expenditure exceeded
 * intake. This is what the app's "Expenditure Changes" panel is measuring.
 *
 * Returns null unless there is a full window with >= 80% logging adherence —
 * a sparse window produces a confidently wrong number.
 */
export function estimateExpenditure(days: DayEnergy[], windowDays = 14): number | null {
  if (days.length < windowDays) return null
  const w = days.slice(-windowDays)

  const logged = w.filter((d) => d.intakeKcal != null && d.intakeKcal > 0)
  if (logged.length / w.length < 0.8) return null

  // Scale up for missed days rather than treating them as zero-calorie days.
  const totalIntake =
    logged.reduce((s, d) => s + (d.intakeKcal ?? 0), 0) * (w.length / logged.length)

  const deltaKg = w[0].trendKg - w[w.length - 1].trendKg
  return (totalIntake + deltaKg * KCAL_PER_KG) / w.length
}

/**
 * Blend the measurement with the formula on a confidence ramp, then clamp.
 *
 * The clamp and the adherence gate above are load-bearing: two weeks of
 * under-logging (people log breakfast and lunch, not the beer) otherwise
 * produces a spuriously low expenditure -> a lower target -> worse adherence.
 */
export function adaptiveTdee(opts: {
  days: DayEnergy[]
  formulaTdee: number
  windowDays?: number
}): { value: number; isAdaptive: boolean } {
  const empirical = estimateExpenditure(opts.days, opts.windowDays ?? 14)
  if (empirical == null) return { value: opts.formulaTdee, isAdaptive: false }

  const n = opts.days.length
  const w = clamp((n - 14) / 14, 0, 1) // 0 at day 14 -> 1 at day 28
  const blended = w * empirical + (1 - w) * opts.formulaTdee
  return {
    value: clamp(blended, opts.formulaTdee * 0.85, opts.formulaTdee * 1.15),
    isAdaptive: true,
  }
}

export type ChangeRow = {
  windowDays: number
  delta: number
  direction: 'Increase' | 'Decrease' | 'No change'
}

export const WEIGHT_WINDOWS = [3, 7, 14, 30, 90] as const
export const EXPENDITURE_WINDOWS = [3, 7, 14, 30, 90] as const

export function weightChanges(trend: TrendPoint[], windows: readonly number[]): ChangeRow[] {
  if (trend.length === 0) {
    return windows.map((w) => ({ windowDays: w, delta: 0, direction: 'No change' as const }))
  }
  const latest = trend[trend.length - 1]
  return windows.map((windowDays) => {
    const idx = Math.max(0, trend.length - 1 - windowDays)
    const delta = latest.trendKg - trend[idx].trendKg
    return { windowDays, delta, direction: describeDirection(delta, 0.05) }
  })
}

export function describeDirection(delta: number, epsilon: number): ChangeRow['direction'] {
  if (Math.abs(delta) < epsilon) return 'No change'
  return delta > 0 ? 'Increase' : 'Decrease'
}

/** Projected date of reaching goal weight at the current trend rate. */
export function goalEta(opts: {
  currentKg: number
  goalKg: number
  weeklyRateKg: number
  from: LocalDate
}): LocalDate | null {
  const remaining = opts.goalKg - opts.currentKg
  if (Math.abs(remaining) < 0.1) return opts.from
  // Rate must move toward the goal.
  if (remaining * opts.weeklyRateKg <= 0) return null
  const weeks = remaining / opts.weeklyRateKg
  if (!Number.isFinite(weeks) || weeks <= 0) return null
  return addDays(opts.from, Math.ceil(weeks * 7))
}

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

/** kcal = MET x weightKg x hours. */
export const MET_TABLE = {
  run: { low: 3.5, medium: 9.8, high: 23.0 },
  lifting: { low: 3.0, medium: 5.0, high: 6.0 },
} as const

export type ExerciseKind = keyof typeof MET_TABLE
export type Intensity = 'low' | 'medium' | 'high'

export function exerciseKcal(opts: {
  kind: ExerciseKind
  intensity: Intensity
  minutes: number
  weightKg: number
}): number {
  const met = MET_TABLE[opts.kind][opts.intensity]
  return Math.round(met * opts.weightKg * (opts.minutes / 60))
}

export const INTENSITY_COPY: Record<ExerciseKind, Record<Intensity, string>> = {
  run: {
    high: 'Sprinting - 14 mph (4 minute miles)',
    medium: 'Jogging - 6 mph (10 minute miles)',
    low: 'Chill walk - 3 mph (20 minute miles)',
  },
  lifting: {
    high: 'Training to failure, breathing heavily',
    medium: 'Breaking a sweat, many reps',
    low: 'Not breaking a sweat, giving little effort',
  },
}

// ---------------------------------------------------------------------------
// Sanity checks on nutrition data
// ---------------------------------------------------------------------------

/**
 * Atwater cross-check. Label calories and 4/4/9 legitimately disagree — FDA
 * rounding, fibre accounting, sugar alcohols, and food-specific Atwater factors
 * (almonds are ~20% below what 4/4/9 predicts). So this FLAGS, it never
 * "corrects": overwriting the source would make almonds wrong.
 */
export function atwaterCheck(n: {
  kcal: number
  protein?: number | null
  carbs?: number | null
  fat?: number | null
}): 'ok' | 'suspect' | 'unknown' {
  if (n.protein == null || n.carbs == null || n.fat == null) return 'unknown'
  const derived = 4 * n.protein + 4 * n.carbs + 9 * n.fat
  const tolerance = Math.max(30, 0.25 * Math.max(n.kcal, 1))
  if (Math.abs(derived - n.kcal) > tolerance) return 'suspect'
  if (n.protein + n.carbs + n.fat > 100.5) return 'suspect' // per 100 g
  if (n.kcal > 902) return 'suspect' // pure fat is 900 kcal/100 g
  return 'ok'
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const formatKcal = (n: number) => Math.round(n).toLocaleString('en-US')

export function formatGrams(n: number): string {
  if (n < 10) return `${Math.round(n * 10) / 10}g`
  return `${Math.round(n)}g`
}

export function formatWeight(kg: number, units: 'imperial' | 'metric'): string {
  return units === 'imperial'
    ? `${(Math.round(kgToLb(kg) * 10) / 10).toFixed(1)} lbs`
    : `${(Math.round(kg * 10) / 10).toFixed(1)} kg`
}

export function formatHeight(cm: number, units: 'imperial' | 'metric'): string {
  if (units === 'metric') return `${Math.round(cm)} cm`
  const totalIn = Math.round(cmToIn(cm))
  return `${Math.floor(totalIn / 12)} ft ${totalIn % 12} in`
}
