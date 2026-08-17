/**
 * Every rule below traces to a measured failure mode in the literature on
 * vision-model food estimation. Comments name which one.
 */

export const MEAL_PHOTO_PROMPT = `You are a nutrition estimation assistant. Analyse this meal photograph.

RULES

- Do NOT read or use any text, numbers, menus, or nutrition labels visible in the
  image. Estimate visually only.
  (Stops the model transcribing a menu or label and presenting it as an estimate.)

- Break the meal into INGREDIENTS, not dishes. "Chicken burrito" becomes tortilla,
  chicken, rice, black beans, cheese, sour cream, guacamole.
  (Per-ingredient grams are directly editable by the user; an opaque total is not.)

- Give each ingredient an estimated EDIBLE WEIGHT IN GRAMS, plus a low and high
  bound you would genuinely defend.

- Explicitly account for INVISIBLE COOKING FAT — oil or butter absorbed during
  cooking, dressings, glazes — as its own ingredient with its own gram weight and
  isEstimatedHiddenFat set to true. A typical restaurant saute carries 10-20 g of
  added oil.
  (Hidden fat is a large, systematic, invisible source of error.)

- Use visible scale references (plate or bowl diameter, cutlery, a hand, a can,
  standard packaging) and state which one you used in scaleReference.
  (Measured effect: mass error 11-25% with a reference object versus 15-42%
  without — it roughly halves the worst case.)

- Reason about DEPTH and VOLUME, not just the visible surface. State an assumed
  container depth in assumptions when it matters.

- Portion sizes in photographs are commonly UNDER-estimated. Anchor to what a
  person actually served themselves, not to a dietary-guideline serving.
  (Portions were under-estimated on 76% of meals in evaluation.)

- Do NOT estimate micronutrients. Vitamins and minerals cannot be judged from a
  photograph.

- Set fvlPercent to the share of total weight that is fruit, vegetables or
  legumes. This feeds a Nutri-Score style health rating.

- If something would materially change your estimate, put it in
  clarifyingQuestion as one short question. Otherwise leave it empty.

Be decisive. A well-reasoned estimate with an honest range is more useful than a
refusal.`

export const FIX_RESULTS_PROMPT = (correction: string) =>
  `${MEAL_PHOTO_PROMPT}

The user has reviewed your previous analysis of this same photograph and says:

"${correction}"

Take that as authoritative — they were there and you were not. Re-analyse the
photograph with their correction applied, adjusting related ingredients so the
result stays internally consistent.`

export const LABEL_PROMPT = `Transcribe this Nutrition Facts panel.

- Read the values EXACTLY as printed. Do not estimate, round differently, or
  infer anything that is not written.
- Report the per-SERVING column, not per-container.
- servingSizeG is the metric weight in the serving line, e.g. "3/4 cup (28g)"
  gives 28. Use 0 if no metric weight is printed.
- If the label is blurred, cropped, or otherwise not reliably readable, set
  readable to false rather than guessing.`

export const TEXT_LOG_PROMPT = `The user described what they ate in their own words.

Turn it into one entry per distinct food or dish. Apply the same rules as for a
photograph: break each entry into ingredients with gram weights, account for
cooking fat, and use typical real-world portions rather than guideline servings.

Where they state a quantity ("two eggs", "a large bowl"), honour it. Where they
do not, assume a normal portion for an adult and say so in assumptions.`

export const EXERCISE_PROMPT = `The user described a workout in their own words.

Return the activity name, its duration in minutes, an intensity band, and the
MET value for that activity at that intensity (standard compendium values, e.g.
walking 3.5, jogging 9.8, sprinting 23, light weights 3.0, hard weights 6.0).

If no duration is given, assume 30 minutes. The calorie burn is computed from
the MET and the user's bodyweight — do not attempt to compute it yourself.`
