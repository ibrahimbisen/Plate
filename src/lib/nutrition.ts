/**
 * Per-ingredient nutrition math, shared by the server actions and the editable
 * result screen so the number the user sees while dragging grams is computed
 * by exactly the same code that will persist it.
 */

export type LogItemInput = {
  name: string
  grams: number
  gramsLow?: number
  gramsHigh?: number
  kcal100: number
  protein100?: number
  carbs100?: number
  fat100?: number
  fiber100?: number
  sugar100?: number
  sodiumMg100?: number
  isHiddenFat?: boolean
  confidence?: number
}

export type LogTotals = {
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodiumMg: number
  kcalLow: number
  kcalHigh: number
}

/**
 * Totals always come from grams x per-100g. The model is asked to estimate
 * weights, never to do arithmetic — and a user's edit to a gram value has to
 * flow through the same path as the original estimate.
 */
export function totalsFromItems(items: LogItemInput[], quantity = 1): LogTotals {
  const sum = items.reduce(
    (acc, item) => {
      const factor = (item.grams * quantity) / 100
      acc.grams += item.grams * quantity
      acc.kcal += item.kcal100 * factor
      acc.protein += (item.protein100 ?? 0) * factor
      acc.carbs += (item.carbs100 ?? 0) * factor
      acc.fat += (item.fat100 ?? 0) * factor
      acc.fiber += (item.fiber100 ?? 0) * factor
      acc.sugar += (item.sugar100 ?? 0) * factor
      acc.sodiumMg += (item.sodiumMg100 ?? 0) * factor
      return acc
    },
    { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodiumMg: 0 },
  )

  return {
    ...sum,
    kcalLow: items.reduce(
      (a, i) => a + (i.kcal100 * (i.gramsLow ?? i.grams) * quantity) / 100,
      0,
    ),
    kcalHigh: items.reduce(
      (a, i) => a + (i.kcal100 * (i.gramsHigh ?? i.grams) * quantity) / 100,
      0,
    ),
  }
}
