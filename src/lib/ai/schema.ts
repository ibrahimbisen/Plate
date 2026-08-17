import { z } from 'zod'

/**
 * The model estimates WEIGHTS, not calories.
 *
 * Published evaluations of vision LLMs on meal photos (PMC11858203, 114 photos
 * against 7 dietitians) found identification is strong — F1 88.6% — while
 * portion size is the dominant error at ~28% MAE, under-estimated on 76% of
 * meals. Median energy error across many meals is near zero, but that is errors
 * cancelling in aggregate, not per-meal accuracy.
 *
 * So we ask for per-ingredient grams plus per-100g composition, and do all the
 * arithmetic ourselves. That plays to the model's strength (visual estimation),
 * gives the user something directly editable, and yields an audit trail.
 */
export const MealItemSchema = z.object({
  name: z.string().describe('One ingredient, not a whole dish'),
  grams: z.number().describe('Best estimate of edible weight in grams'),
  gramsLow: z.number().describe('Low end of a plausible range'),
  gramsHigh: z.number().describe('High end of a plausible range'),
  kcalPer100g: z.number(),
  proteinPer100g: z.number(),
  carbPer100g: z.number(),
  fatPer100g: z.number(),
  fiberPer100g: z.number(),
  sugarPer100g: z.number(),
  sodiumMgPer100g: z.number(),
  isEstimatedHiddenFat: z
    .boolean()
    .describe('True for cooking oil, butter, dressing or glaze that is not directly visible'),
  confidence: z.number().describe('0 to 1'),
})

export const MealAnalysisSchema = z.object({
  name: z.string().describe('A short name for the meal as a whole'),
  items: z.array(MealItemSchema),
  fvlPercent: z
    .number()
    .describe('Percent of the meal by weight that is fruit, vegetables, or legumes; 0 if none'),
  scaleReference: z
    .string()
    .describe('What was used to judge scale, e.g. "dinner plate ~27cm". Empty string if none.'),
  assumptions: z.array(z.string()),
  clarifyingQuestion: z
    .string()
    .describe('The single question that would most reduce error, or an empty string'),
  overallConfidence: z.number().describe('0 to 1'),
})

export type MealItem = z.infer<typeof MealItemSchema>
export type MealAnalysis = z.infer<typeof MealAnalysisSchema>

/**
 * A nutrition label is transcription, not estimation, so it gets its own
 * schema — asking for per-ingredient grams here would invite invention.
 */
export const LabelAnalysisSchema = z.object({
  name: z.string(),
  brand: z.string(),
  servingSizeG: z.number().describe('Serving size in grams or millilitres; 0 if not stated'),
  servingSizeText: z.string().describe('Verbatim serving text, e.g. "3/4 cup (28g)"'),
  servingsPerContainer: z.number(),
  caloriesPerServing: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  fiberG: z.number(),
  sugarG: z.number(),
  sodiumMg: z.number(),
  readable: z.boolean().describe('False if the label could not be read reliably'),
})

export type LabelAnalysis = z.infer<typeof LabelAnalysisSchema>

/** Natural-language logging: "two eggs and a slice of toast". */
export const TextAnalysisSchema = z.object({
  entries: z.array(
    z.object({
      name: z.string(),
      items: z.array(MealItemSchema),
    }),
  ),
})

export type TextAnalysis = z.infer<typeof TextAnalysisSchema>

export const ExerciseAnalysisSchema = z.object({
  name: z.string(),
  minutes: z.number(),
  met: z.number().describe('Metabolic equivalent for the described activity and intensity'),
  intensity: z.enum(['low', 'medium', 'high']),
})

export type ExerciseAnalysis = z.infer<typeof ExerciseAnalysisSchema>
