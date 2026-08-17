import {
  bmrMifflinStJeor,
  dailyCalorieTargetDetailed,
  deriveMacros,
  inToCm,
  lbToKg,
  maxWeeklyRateKg,
  tdeeFromBmr,
  type ActivityLevel,
  type Sex,
} from './metrics'
import { ageOn, type LocalDate } from './date'

export type OnboardingInput = {
  firstName: string
  lastName: string
  sex: Sex
  birthDate: string
  heightValue: number
  heightInches?: number
  weightValue: number
  goalWeightValue: number
  activityLevel: ActivityLevel
  weeklyRateValue: number
  units: 'imperial' | 'metric'
}

export type DerivedGoals = ReturnType<typeof computeGoals>

/**
 * Turns the onboarding answers into daily targets.
 *
 * Deliberately a plain synchronous function in a shared module rather than a
 * Server Action, so the onboarding preview and the server write run the exact
 * same code and can never disagree.
 */
export function computeGoals(input: OnboardingInput, today: LocalDate) {
  const metric = input.units === 'metric'

  const heightCm = metric
    ? input.heightValue
    : inToCm(input.heightValue * 12 + (input.heightInches ?? 0))
  const weightKg = metric ? input.weightValue : lbToKg(input.weightValue)
  const goalWeightKg = metric ? input.goalWeightValue : lbToKg(input.goalWeightValue)

  // The picker asks "how fast"; direction comes from where the goal sits.
  const magnitude = Math.abs(metric ? input.weeklyRateValue : lbToKg(input.weeklyRateValue))
  const capped = Math.min(magnitude, maxWeeklyRateKg(weightKg))
  const losing = goalWeightKg < weightKg
  const weeklyRateKg =
    Math.abs(goalWeightKg - weightKg) < 0.5 ? 0 : losing ? -capped : capped

  const age = input.birthDate ? ageOn(input.birthDate, today) : 30
  const bmr = bmrMifflinStJeor({ weightKg, heightCm, age, sex: input.sex })
  const tdee = tdeeFromBmr(bmr, input.activityLevel)
  const target = dailyCalorieTargetDetailed({ tdee, bmr, weeklyRateKg, sex: input.sex })
  const calories = target.calories

  const macros = deriveMacros({
    calories,
    // Anchor protein to the smaller of current and goal weight: "1 g per lb" of
    // a high starting weight massively overshoots.
    anchorWeightKg: Math.min(weightKg, goalWeightKg || weightKg),
    goal: weeklyRateKg < 0 ? 'lose' : weeklyRateKg > 0 ? 'gain' : 'maintain',
  })

  return {
    heightCm,
    weightKg,
    goalWeightKg,
    weeklyRateKg,
    age,
    bmr,
    tdee,
    calories,
    macros,
    // Surfaced in the onboarding review step so a capped pace is never silent.
    floored: target.floored,
    floorReason: target.floorReason,
    effectiveWeeklyRateKg: target.effectiveWeeklyRateKg,
  }
}
