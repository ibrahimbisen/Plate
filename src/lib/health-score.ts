/**
 * Health score 0-10, derived from the Nutri-Score 2023 algorithm.
 *
 * Nutri-Score is fully public and algorithmic (Nature Food, 2024), which is why
 * it backs this rather than an invented heuristic. NOVA is deliberately not
 * used as a score: it is a human-assigned 4-class taxonomy with no formula.
 *
 * The 0-10 mapping is ours. A Nutri-Score of ~0 lands at 7.3/10, which happens
 * to match the "Health score 7/10" shown in the reference app.
 */

export type NutriInput = {
  kcal100: number
  sugar100: number
  satFat100: number
  sodiumMg100: number
  fiber100: number
  protein100: number
  /** Percent of weight that is fruit, vegetables or legumes. */
  fvlPercent: number
  isBeverage?: boolean
}

const points = (value: number, thresholds: number[]) => {
  let p = 0
  for (const t of thresholds) if (value > t) p++
  return p
}

// Energy in kJ; the tables are defined in kJ, not kcal.
const ENERGY_KJ = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]
const SUGAR_G = [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51]
const SATFAT_G = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
// Table is in mg of sodium.
const SODIUM_MG = [80, 160, 240, 320, 400, 480, 560, 640, 720, 800, 880, 960, 1040, 1120, 1200,
  1280, 1360, 1440, 1520, 1600]

const FIBER_G = [3.0, 4.1, 5.2, 6.3, 7.4]
const PROTEIN_G = [2.4, 4.8, 7.2, 9.6, 12, 14, 17]
const FVL = [40, 60, 80, 80]

/** Raw Nutri-Score points. Lower is better; roughly -15 to +40. */
export function nutriScorePoints(n: NutriInput): number {
  const energyKj = n.kcal100 * 4.184

  const negative =
    points(energyKj, ENERGY_KJ) +
    points(n.sugar100, SUGAR_G) +
    points(n.satFat100, SATFAT_G) +
    points(n.sodiumMg100, SODIUM_MG)

  const fvlPoints = points(n.fvlPercent, FVL)
  const fiberPoints = points(n.fiber100, FIBER_G)
  const proteinPoints = points(n.protein100, PROTEIN_G)

  // Above the threshold, protein stops counting — so a very salty, very fatty
  // food cannot buy its way back to a good score on protein alone.
  const positive =
    negative >= 11 && !n.isBeverage
      ? fvlPoints + fiberPoints
      : fvlPoints + fiberPoints + proteinPoints

  return negative - positive
}

/** Maps the Nutri-Score range onto 0-10, inverted so higher is healthier. */
export function healthScore(n: NutriInput): number {
  const s = Math.max(-15, Math.min(40, nutriScorePoints(n)))
  return Math.round(((40 - s) / 55) * 10 * 10) / 10
}

/**
 * Convenience wrapper for a whole logged meal, aggregating its ingredients to a
 * per-100g basis first — Nutri-Score is defined per 100 g, so scoring a serving
 * directly would make a small portion of something terrible look good.
 */
export function healthScoreForItems(
  items: {
    grams: number
    kcal100: number
    protein100?: number
    fat100?: number
    fiber100?: number
    sugar100?: number
    sodiumMg100?: number
  }[],
  fvlPercent = 0,
): number | null {
  const totalG = items.reduce((a, i) => a + i.grams, 0)
  if (totalG <= 0) return null

  const per100 = (pick: (i: (typeof items)[number]) => number | undefined) =>
    (items.reduce((a, i) => a + (pick(i) ?? 0) * i.grams, 0) / totalG) || 0

  return healthScore({
    kcal100: per100((i) => i.kcal100),
    protein100: per100((i) => i.protein100),
    // Saturated fat is not modelled separately; approximate it as a third of
    // total fat, which is the typical mixed-diet ratio.
    satFat100: per100((i) => i.fat100) / 3,
    fiber100: per100((i) => i.fiber100),
    sugar100: per100((i) => i.sugar100),
    sodiumMg100: per100((i) => i.sodiumMg100),
    fvlPercent,
  })
}
