import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Two conventions hold across this whole schema. Both are load-bearing.
 *
 * 1. TIMESTAMPS ARE `timestamp_ms` EVERYWHERE. Never mix in `timestamp`
 *    (which is seconds) — the two silently produce dates in 1970 or year 56000.
 *
 * 2. ANYTHING THAT BELONGS TO A DAY ALSO STORES `localDate` ('YYYY-MM-DD') in
 *    the user's timezone. "Calories today" is a civil-date question, not an
 *    instant question: bucketing on the UTC timestamp puts a UTC-8 user's 8pm
 *    dinner on tomorrow. Every daily rollup groups by localDate.
 */

const id = () => text('id').primaryKey()
const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)

// ---------------------------------------------------------------------------
// User & settings
// ---------------------------------------------------------------------------

export const users = sqliteTable('users', {
  id: id(),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  username: text('username').notNull().default(''),
  avatarPath: text('avatar_path'),

  // Personal details (screenshot: Personal Details)
  sex: text('sex', { enum: ['male', 'female'] }).notNull().default('male'),
  birthDate: text('birth_date'), // 'YYYY-MM-DD'
  heightCm: real('height_cm'),
  startWeightKg: real('start_weight_kg'),
  goalWeightKg: real('goal_weight_kg'),
  dailyStepGoal: integer('daily_step_goal').notNull().default(10000),

  // Goal shaping
  activityLevel: text('activity_level', {
    enum: ['sedentary', 'light', 'moderate', 'very', 'extra'],
  })
    .notNull()
    .default('sedentary'),
  weeklyRateKg: real('weekly_rate_kg').notNull().default(-0.5), // negative = losing

  // Display
  units: text('units', { enum: ['imperial', 'metric'] }).notNull().default('imperial'),
  timezone: text('timezone').notNull().default('UTC'),
  locale: text('locale').notNull().default('en'),

  onboardedAt: integer('onboarded_at', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
})

export const preferences = sqliteTable('preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  appearance: text('appearance', { enum: ['system', 'light', 'dark'] })
    .notNull()
    .default('system'),
  badgeCelebrations: integer('badge_celebrations', { mode: 'boolean' }).notNull().default(true),
  addBurnedCalories: integer('add_burned_calories', { mode: 'boolean' }).notNull().default(true),
  rolloverCalories: integer('rollover_calories', { mode: 'boolean' }).notNull().default(true),
  autoAdjustMacros: integer('auto_adjust_macros', { mode: 'boolean' }).notNull().default(true),
})

/**
 * Goals are stored as HISTORY ROWS, not as a single mutable row. A day is
 * always evaluated against the goal that was in force on that day, so editing
 * today's target never rewrites last month's rings.
 */
export const nutritionGoals = sqliteTable(
  'nutrition_goals',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    effectiveFrom: text('effective_from').notNull(), // 'YYYY-MM-DD'

    calories: integer('calories').notNull(),
    proteinG: integer('protein_g').notNull(),
    carbsG: integer('carbs_g').notNull(),
    fatG: integer('fat_g').notNull(),

    // What produced these numbers, for the "how was this calculated" sheet.
    source: text('source', { enum: ['derived', 'manual', 'adaptive'] })
      .notNull()
      .default('derived'),
    bmr: real('bmr'),
    tdee: real('tdee'),
    createdAt: createdAt(),
  },
  (t) => [index('nutrition_goals_lookup').on(t.userId, t.effectiveFrom)],
)

// ---------------------------------------------------------------------------
// Foods
// ---------------------------------------------------------------------------

/**
 * Canonical nutrition is ALWAYS per 100 g (or per 100 ml when basis='volume').
 * Portions are multipliers on top. There is exactly one basis in this table.
 */
export const foods = sqliteTable(
  'foods',
  {
    id: id(),
    source: text('source', {
      enum: ['usda', 'off', 'user', 'ai', 'label', 'recipe'],
    }).notNull(),
    sourceId: text('source_id'), // fdcId | barcode | null
    barcode: text('barcode'), // normalized: EAN-13 padded, EAN-8 left alone

    name: text('name').notNull(),
    brand: text('brand'),
    basis: text('basis', { enum: ['mass', 'volume'] })
      .notNull()
      .default('mass'),
    densityGPerMl: real('density_g_per_ml'),

    kcal100: real('kcal_100').notNull(),
    protein100: real('protein_100'),
    carbs100: real('carbs_100'),
    fat100: real('fat_100'),
    fiber100: real('fiber_100'),
    sugar100: real('sugar_100'),
    satFat100: real('sat_fat_100'),
    sodiumMg100: real('sodium_mg_100'),

    healthScore: real('health_score'), // 0-10, Nutri-Score 2023 derived
    // 'ok' | 'suspect' | 'user_edited' — surfaced as a badge, never auto-corrected
    dataQuality: text('data_quality').notNull().default('ok'),
    imageUrl: text('image_url'),
    fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' }),
    rawJson: text('raw_json'), // keep the original payload; you will need it

    // Set for foods the user created or bookmarked ("My foods").
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('foods_barcode').on(t.barcode),
    index('foods_name').on(t.name),
    uniqueIndex('foods_source_unique').on(t.source, t.sourceId),
  ],
)

/** Every way a food can be counted. "1 cup", "3 nuggets", "1 serving", "100 g". */
export const foodPortions = sqliteTable(
  'food_portions',
  {
    id: id(),
    foodId: text('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    label: text('label').notNull(), // "cup", "serving", "nugget", "g", "oz"
    amount: real('amount').notNull().default(1), // this portion describes `amount` x label
    gramWeight: real('gram_weight').notNull(), // ...weighing this many grams
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    source: text('source').notNull().default('builtin'), // label | usda | off | user | builtin
  },
  (t) => [index('food_portions_food').on(t.foodId)],
)

export const savedFoods = sqliteTable(
  'saved_foods',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    foodId: text('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('saved_foods_unique').on(t.userId, t.foodId)],
)

/** "My meals" — a named bundle of foods logged together in one tap. */
export const meals = sqliteTable('meals', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  photoPath: text('photo_path'),
  createdAt: createdAt(),
})

export const mealItems = sqliteTable(
  'meal_items',
  {
    id: id(),
    mealId: text('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    foodId: text('food_id').references(() => foods.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    grams: real('grams').notNull(),
  },
  (t) => [index('meal_items_meal').on(t.mealId)],
)

// ---------------------------------------------------------------------------
// The log
// ---------------------------------------------------------------------------

/**
 * Nutrition is DENORMALIZED into the log entry on purpose. If a row stored only
 * a foreign key, an Open Food Facts contributor fixing a typo would silently
 * rewrite the user's history from six months ago. `foodId` is kept for
 * provenance and an explicit user-initiated "refresh", never for reads.
 */
export const foodLogs = sqliteTable(
  'food_logs',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    loggedAt: integer('logged_at', { mode: 'timestamp_ms' }).notNull(),
    localDate: text('local_date').notNull(), // 'YYYY-MM-DD' in the user's tz
    mealSlot: text('meal_slot', { enum: ['breakfast', 'lunch', 'dinner', 'snack'] }),

    foodId: text('food_id').references(() => foods.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    brand: text('brand'),
    photoPath: text('photo_path'),

    quantity: real('quantity').notNull().default(1),
    portionLabel: text('portion_label').notNull().default('serving'),
    grams: real('grams').notNull(), // the universal intermediate

    // Frozen totals at log time.
    kcal: real('kcal').notNull(),
    protein: real('protein').notNull().default(0),
    carbs: real('carbs').notNull().default(0),
    fat: real('fat').notNull().default(0),
    fiber: real('fiber'),
    sugar: real('sugar'),
    sodiumMg: real('sodium_mg'),
    healthScore: real('health_score'),

    // AI provenance
    aiConfidence: real('ai_confidence'),
    kcalLow: real('kcal_low'),
    kcalHigh: real('kcal_high'),
    scaleReference: text('scale_reference'),
    assumptions: text('assumptions'), // JSON array

    createdAt: createdAt(),
  },
  (t) => [
    index('food_logs_day').on(t.userId, t.localDate),
    index('food_logs_recent').on(t.userId, t.loggedAt),
  ],
)

/** Per-ingredient breakdown, so grams stay editable after the fact. */
export const foodLogItems = sqliteTable(
  'food_log_items',
  {
    id: id(),
    logId: text('log_id')
      .notNull()
      .references(() => foodLogs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    grams: real('grams').notNull(),
    gramsLow: real('grams_low'),
    gramsHigh: real('grams_high'),
    kcal100: real('kcal_100').notNull(),
    protein100: real('protein_100'),
    carbs100: real('carbs_100'),
    fat100: real('fat_100'),
    fiber100: real('fiber_100'),
    sugar100: real('sugar_100'),
    sodiumMg100: real('sodium_mg_100'),
    isHiddenFat: integer('is_hidden_fat', { mode: 'boolean' }).notNull().default(false),
    confidence: real('confidence'),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('food_log_items_log').on(t.logId)],
)

export const exerciseLogs = sqliteTable(
  'exercise_logs',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    loggedAt: integer('logged_at', { mode: 'timestamp_ms' }).notNull(),
    localDate: text('local_date').notNull(),

    kind: text('kind', { enum: ['run', 'lifting', 'describe', 'manual'] }).notNull(),
    name: text('name').notNull(),
    intensity: text('intensity', { enum: ['low', 'medium', 'high'] }),
    durationMin: integer('duration_min'),
    kcalBurned: real('kcal_burned').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('exercise_logs_day').on(t.userId, t.localDate)],
)

export const weightEntries = sqliteTable(
  'weight_entries',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    recordedAt: integer('recorded_at', { mode: 'timestamp_ms' }).notNull(),
    weightKg: real('weight_kg').notNull(),
    photoPath: text('photo_path'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('weight_entries_day').on(t.userId, t.localDate)],
)

export const progressPhotos = sqliteTable(
  'progress_photos',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    path: text('path').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('progress_photos_day').on(t.userId, t.localDate)],
)

export const badges = sqliteTable(
  'badges',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    earnedAt: integer('earned_at', { mode: 'timestamp_ms' }).notNull(),
    seenAt: integer('seen_at', { mode: 'timestamp_ms' }),
  },
  (t) => [uniqueIndex('badges_unique').on(t.userId, t.slug)],
)

export const reminders = sqliteTable(
  'reminders',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slot: text('slot', {
      enum: ['breakfast', 'lunch', 'snack', 'dinner', 'endOfDay'],
    }).notNull(),
    timeOfDay: text('time_of_day').notNull(), // 'HH:MM' 24h
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [uniqueIndex('reminders_unique').on(t.userId, t.slot)],
)

/** Cache for Open Food Facts lookups — 15 req/min/IP makes this mandatory. */
export const barcodeCache = sqliteTable('barcode_cache', {
  barcode: text('barcode').primaryKey(),
  foodId: text('food_id').references(() => foods.id, { onDelete: 'cascade' }),
  notFound: integer('not_found', { mode: 'boolean' }).notNull().default(false),
  fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' }).notNull(),
})

export type User = typeof users.$inferSelect
export type Preferences = typeof preferences.$inferSelect
export type NutritionGoal = typeof nutritionGoals.$inferSelect
export type Food = typeof foods.$inferSelect
export type FoodPortion = typeof foodPortions.$inferSelect
export type FoodLog = typeof foodLogs.$inferSelect
export type FoodLogItem = typeof foodLogItems.$inferSelect
export type ExerciseLog = typeof exerciseLogs.$inferSelect
export type WeightEntry = typeof weightEntries.$inferSelect
