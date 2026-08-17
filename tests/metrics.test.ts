/**
 * Assertions for the derived-metric formulas. These are the numbers the whole
 * app is built on, so they get checked against hand-computed values rather
 * than against themselves.
 *
 * Run with:  npx tsx tests/metrics.test.ts
 */
import assert from 'node:assert/strict'

import { addDays, ageOn, eachDay, toLocalDate, weekStripRange } from '../src/lib/date'
import {
  adaptiveTdee,
  atwaterCheck,
  bmi,
  bmiCategory,
  bmrMifflinStJeor,
  caloriesLeft,
  computeStreak,
  computeWeightTrend,
  dailyCalorieTarget,
  dailyCalorieTargetDetailed,
  deriveMacros,
  estimateExpenditure,
  exerciseKcal,
  kcalFromMacros,
  lbToKg,
  ringState,
  tdeeFromBmr,
  weightChanges,
} from '../src/lib/metrics'

let passed = 0
function check(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (error) {
    console.error(`  FAIL ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

const near = (a: number, b: number, tol = 0.5) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`)

console.log('\ndates')

check('toLocalDate respects the timezone, not the UTC instant', () => {
  // 2026-03-02T04:30Z is still 2026-03-01 at 8:30pm in Los Angeles.
  const instant = Date.parse('2026-03-02T04:30:00Z')
  assert.equal(toLocalDate(instant, 'America/Los_Angeles'), '2026-03-01')
  assert.equal(toLocalDate(instant, 'UTC'), '2026-03-02')
})

check('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01') // 2026 is not a leap year
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})

check('addDays is unaffected by DST', () => {
  // US DST starts 2026-03-08; a civil-date walk must not skip or repeat a day.
  assert.equal(addDays('2026-03-07', 1), '2026-03-08')
  assert.equal(addDays('2026-03-08', 1), '2026-03-09')
  assert.equal(eachDay('2026-03-06', '2026-03-10').length, 5)
})

check('week strip is 7 days ending one day ahead of the selection', () => {
  const strip = weekStripRange('2026-08-16')
  assert.equal(strip.length, 7)
  assert.equal(strip[0], '2026-08-11')
  assert.equal(strip[5], '2026-08-16')
  assert.equal(strip[6], '2026-08-17')
})

check('ageOn does not count a birthday that has not happened yet', () => {
  assert.equal(ageOn('2003-06-22', '2026-06-21'), 22)
  assert.equal(ageOn('2003-06-22', '2026-06-22'), 23)
})

console.log('\nenergy targets')

check('Mifflin-St Jeor matches hand-computed values', () => {
  // male: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
  near(bmrMifflinStJeor({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' }), 1780, 0.01)
  // female: same minus 166 => 1780 - 5 - 161 = 1614
  near(bmrMifflinStJeor({ weightKg: 80, heightCm: 180, age: 30, sex: 'female' }), 1614, 0.01)
})

check('1 lb/week deficit is ~500 kcal/day when the floor allows it', () => {
  const bmr = 1800
  const tdee = tdeeFromBmr(bmr, 'very') // 3105 — plenty of headroom above BMR
  const t = dailyCalorieTargetDetailed({ tdee, bmr, weeklyRateKg: -lbToKg(1), sex: 'male' })
  near(tdee - t.calories, 500, 2)
  assert.equal(t.floored, false)
})

check('a sedentary user cannot out-deficit their own BMR, and is told so', () => {
  // Sedentary TDEE is only BMR x 1.2, so a 500 kcal deficit lands below BMR.
  const bmr = 1800
  const tdee = tdeeFromBmr(bmr, 'sedentary') // 2160
  const t = dailyCalorieTargetDetailed({ tdee, bmr, weeklyRateKg: -lbToKg(1), sex: 'male' })

  assert.equal(t.calories, 1800, 'target clamps to BMR')
  assert.equal(t.floored, true, 'the clamp must be reported, never silent')
  assert.equal(t.floorReason, 'bmr')
  // The delivered pace is gentler than the one requested — and we can say so.
  assert.ok(
    Math.abs(t.effectiveWeeklyRateKg) < lbToKg(1),
    'effective pace should be gentler than requested',
  )
  near(Math.abs(t.effectiveWeeklyRateKg), 0.327, 0.01) // 360 kcal/day
})

check('target never falls below BMR or the sex floor', () => {
  // A large deficit against a high BMR must clamp at BMR, not at 1500.
  const bmr = 2100
  const target = dailyCalorieTarget({ tdee: 2520, bmr, weeklyRateKg: -1.5, sex: 'male' })
  assert.ok(target >= bmr, `${target} should not be below BMR ${bmr}`)

  const small = dailyCalorieTarget({ tdee: 1400, bmr: 1150, weeklyRateKg: -1, sex: 'female' })
  assert.ok(small >= 1200, `${small} should respect the 1200 floor`)
})

check('a surplus is allowed to exceed TDEE', () => {
  const target = dailyCalorieTarget({ tdee: 2500, bmr: 1800, weeklyRateKg: 0.25, sex: 'male' })
  assert.ok(target > 2500)
})

console.log('\nmacros')

check('protein scales with bodyweight, not with the calorie target', () => {
  const lo = deriveMacros({ calories: 1800, anchorWeightKg: 75, goal: 'lose' })
  const hi = deriveMacros({ calories: 2600, anchorWeightKg: 75, goal: 'lose' })
  assert.equal(lo.proteinG, hi.proteinG, 'protein must not move with calories')
  assert.equal(lo.proteinG, 150) // 75 kg * 2.0 g/kg
  assert.ok(hi.carbsG > lo.carbsG, 'carbs absorb the difference')
})

check('macros reconstruct the calorie target', () => {
  const m = deriveMacros({ calories: 2200, anchorWeightKg: 80, goal: 'lose' })
  near(kcalFromMacros(m), 2200, 12) // rounding to whole grams
})

check('an aggressive deficit still yields non-negative carbs', () => {
  const m = deriveMacros({ calories: 1200, anchorWeightKg: 110, goal: 'lose' })
  assert.ok(m.carbsG >= 0, `carbs went negative: ${m.carbsG}`)
  assert.ok(m.fatG > 0)
})

console.log('\ncalories left')

check('burned calories and rollover are added only when enabled', () => {
  const base = {
    goalCalories: 2000,
    eatenToday: 500,
    burnedToday: 300,
    goalYesterday: 2000,
    eatenYesterday: 1900,
  }
  const off = caloriesLeft({ ...base, addBurnedCalories: false, rolloverCalories: false })
  assert.equal(off.left, 1500)

  const on = caloriesLeft({ ...base, addBurnedCalories: true, rolloverCalories: true })
  assert.equal(on.burnedBonus, 300)
  assert.equal(on.rollover, 100) // 2000 - 1900
  assert.equal(on.left, 1900) // 2000 + 300 + 100 - 500
})

check('rollover is capped at 200 and never negative', () => {
  const over = caloriesLeft({
    goalCalories: 2000,
    eatenToday: 0,
    burnedToday: 0,
    addBurnedCalories: false,
    rolloverCalories: true,
    goalYesterday: 2000,
    eatenYesterday: 1000, // 1000 unspent
  })
  assert.equal(over.rollover, 200)

  const under = caloriesLeft({
    goalCalories: 2000,
    eatenToday: 0,
    burnedToday: 0,
    addBurnedCalories: false,
    rolloverCalories: true,
    goalYesterday: 2000,
    eatenYesterday: 2600, // overate
  })
  assert.equal(under.rollover, 0, 'an overshoot must not create a debt')
})

console.log('\nring colors')

check('ring thresholds match the in-app legend', () => {
  const g = { goal: 2000, isFuture: false, hasLogs: true }
  assert.equal(ringState({ ...g, hasLogs: false, eaten: 0 }), 'dotted')
  assert.equal(ringState({ ...g, eaten: 1500 }), 'green') // under
  assert.equal(ringState({ ...g, eaten: 2100 }), 'green') // exactly 100 over
  assert.equal(ringState({ ...g, eaten: 2101 }), 'yellow')
  assert.equal(ringState({ ...g, eaten: 2200 }), 'yellow') // exactly 200 over
  assert.equal(ringState({ ...g, eaten: 2201 }), 'red')
  assert.equal(ringState({ ...g, isFuture: true, eaten: 0 }), 'future')
})

console.log('\nstreak')

check('streak counts back from today and survives an unlogged today', () => {
  const dates = new Set(['2026-08-16', '2026-08-15', '2026-08-14'])
  assert.equal(computeStreak(dates, '2026-08-16'), 3)
  // Today not logged yet — yesterday's streak still stands.
  assert.equal(computeStreak(dates, '2026-08-17'), 3)
  // Two days missed — broken.
  assert.equal(computeStreak(dates, '2026-08-18'), 0)
  assert.equal(computeStreak(new Set(), '2026-08-16'), 0)
})

console.log('\nBMI')

check('BMI matches the value shown in the app', () => {
  // 275 lb at 6ft6 => 124.7 kg / 1.981 m
  const value = bmi(lbToKg(275), 198.12)
  near(value, 31.8, 0.15)
  assert.equal(bmiCategory(value), 'Obese')
})

check('BMI category boundaries', () => {
  assert.equal(bmiCategory(18.4), 'Underweight')
  assert.equal(bmiCategory(18.5), 'Healthy')
  assert.equal(bmiCategory(24.9), 'Healthy')
  assert.equal(bmiCategory(25), 'Overweight')
  assert.equal(bmiCategory(29.9), 'Overweight')
  assert.equal(bmiCategory(30), 'Obese')
})

console.log('\nweight trend (EWMA)')

check('trend walks calendar days, not entries', () => {
  // Two readings five days apart must produce six points, not two.
  const trend = computeWeightTrend([
    { localDate: '2026-08-01', weightKg: 100 },
    { localDate: '2026-08-06', weightKg: 99 },
  ])
  assert.equal(trend.length, 6)
  assert.equal(trend[0].trendKg, 100, 'seeded with the first reading')
  // Gap days carry the trend forward untouched.
  assert.equal(trend[1].trendKg, 100)
  assert.equal(trend[4].trendKg, 100)
  near(trend[5].trendKg, 99.9, 0.001) // 100 + 0.1*(99-100)
})

check('trend lags a step change, as a 20-day average should', () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({
    localDate: addDays('2026-08-01', i),
    weightKg: i === 0 ? 100 : 95,
  }))
  const trend = computeWeightTrend(entries)
  const final = trend[trend.length - 1].trendKg
  assert.ok(final > 95 && final < 97, `expected a lagging trend, got ${final}`)
})

console.log('\nadaptive expenditure')

check('expenditure is recovered from intake plus weight change', () => {
  // Eat 2000/day, lose exactly 0.5 kg over 14 days.
  // TDEE = (2000*14 + 0.5*7700) / 14 = 2000 + 275 = 2275
  const days = Array.from({ length: 14 }, (_, i) => ({
    date: addDays('2026-08-01', i),
    intakeKcal: 2000,
    trendKg: 80 - (0.5 * i) / 13,
  }))
  const est = estimateExpenditure(days, 14)
  assert.ok(est != null)
  near(est!, 2275, 1)
})

check('a sparse window is rejected rather than guessed', () => {
  const days = Array.from({ length: 14 }, (_, i) => ({
    date: addDays('2026-08-01', i),
    intakeKcal: i < 5 ? 2000 : null, // 36% adherence
    trendKg: 80,
  }))
  assert.equal(estimateExpenditure(days, 14), null)
})

check('adaptive estimate is clamped to +/-15% of the formula', () => {
  // Wildly implausible loss => estimator would say ~5800; must clamp.
  const days = Array.from({ length: 30 }, (_, i) => ({
    date: addDays('2026-08-01', i),
    intakeKcal: 2000,
    trendKg: 90 - i * 0.5,
  }))
  const { value, isAdaptive } = adaptiveTdee({ days, formulaTdee: 2500 })
  assert.equal(isAdaptive, true)
  assert.ok(value <= 2500 * 1.15 + 0.001, `${value} exceeded the clamp`)
  assert.ok(value >= 2500 * 0.85 - 0.001)
})

check('falls back to the formula before there is enough data', () => {
  const days = Array.from({ length: 5 }, (_, i) => ({
    date: addDays('2026-08-01', i),
    intakeKcal: 2000,
    trendKg: 80,
  }))
  const { value, isAdaptive } = adaptiveTdee({ days, formulaTdee: 2400 })
  assert.equal(isAdaptive, false)
  assert.equal(value, 2400)
})

check('weight change table reports direction', () => {
  const trend = computeWeightTrend(
    Array.from({ length: 10 }, (_, i) => ({
      localDate: addDays('2026-08-01', i),
      weightKg: 100 - i,
    })),
  )
  const rows = weightChanges(trend, [3, 7])
  assert.ok(rows.every((r) => r.direction === 'Decrease'), 'losing weight reads as Decrease')
  assert.equal(weightChanges([], [3]).at(0)?.direction, 'No change')
})

console.log('\nexercise')

check('MET formula matches kcal = MET x kg x hours', () => {
  // Jogging (9.8 MET), 80 kg, 30 min => 9.8 * 80 * 0.5 = 392
  assert.equal(exerciseKcal({ kind: 'run', intensity: 'medium', minutes: 30, weightKg: 80 }), 392)
  // Light lifting (3.0), 80 kg, 60 min => 240
  assert.equal(
    exerciseKcal({ kind: 'lifting', intensity: 'low', minutes: 60, weightKg: 80 }),
    240,
  )
})

console.log('\nnutrition sanity checks')

check('Atwater check flags impossible rows but tolerates real labels', () => {
  // Almonds: label calories sit well below 4/4/9 because of food-specific
  // factors. Roughly 21P / 22C / 50F per 100 g, label ~579 kcal.
  assert.equal(atwaterCheck({ kcal: 579, protein: 21, carbs: 22, fat: 50 }), 'ok')
  // Hallucinated: claims 200 kcal with 50 g of fat.
  assert.equal(atwaterCheck({ kcal: 200, protein: 10, carbs: 10, fat: 50 }), 'suspect')
  // More than 100 g of macros in 100 g of food.
  assert.equal(atwaterCheck({ kcal: 800, protein: 60, carbs: 60, fat: 20 }), 'suspect')
  assert.equal(atwaterCheck({ kcal: 500, protein: null, carbs: 10, fat: 10 }), 'unknown')
})

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}\n`)
