import 'server-only'

import { atwaterCheck } from '../metrics'
import { normalizeBarcode } from './barcode'

/**
 * Open Food Facts client.
 *
 * Every mapping rule below exists because the naive version silently produces a
 * wrong number — not because the API errors. The failure mode throughout is a
 * well-formed JSON object containing a plausible lie.
 */

const BASE = 'https://world.openfoodfacts.org'

/** OFF blocks generic user agents, and browsers cannot set this header —
 *  which is the whole reason these calls are proxied through our server. */
function userAgent(): string {
  const contact = process.env.OFF_CONTACT_EMAIL || 'selfhosted@example.org'
  return `CalAI-SelfHosted/0.1 (${contact})`
}

/** Only the nutrients we actually map. `nutriments` also contains things that
 *  are not nutrients at all — nova-group, carbon footprint — and OFF "scales"
 *  them per serving as if they were masses. Never iterate it generically. */
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'product_quantity',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'image_front_small_url',
  'image_url',
  'nutriments',
  'nutrition_data_per',
  'completeness',
].join(',')

export type OffFood = {
  barcode: string
  name: string
  brand: string | null
  imageUrl: string | null
  kcal100: number
  protein100: number | null
  carbs100: number | null
  fat100: number | null
  fiber100: number | null
  sugar100: number | null
  satFat100: number | null
  sodiumMg100: number | null
  servingGrams: number | null
  servingLabel: string | null
  packageGrams: number | null
  dataQuality: 'ok' | 'suspect'
  raw: unknown
}

export class OffUnusableError extends Error {}

type Nutriments = Record<string, number | string | undefined>

const num = (n: Nutriments, key: string): number | null => {
  const v = n[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function mapOffProduct(product: Record<string, unknown>): OffFood {
  const n = (product.nutriments ?? {}) as Nutriments
  const code = normalizeBarcode(String(product.code ?? ''))
  if (!code) throw new OffUnusableError('Unrecognised barcode.')

  // `energy_100g` is KILOJOULES. Reading it as calories overstates by 4.184x.
  let kcal100 = num(n, 'energy-kcal_100g')
  if (kcal100 == null) {
    const kj = num(n, 'energy-kj_100g') ?? num(n, 'energy_100g')
    kcal100 = kj != null ? kj / 4.184 : null
  }
  if (kcal100 == null) {
    // ~25% of OFF products have no usable nutrition. Say so rather than
    // recording a confident zero.
    throw new OffUnusableError('This product has no nutrition data on Open Food Facts.')
  }

  // US products frequently carry ONLY `carbohydrates-total`. Defaulting the
  // missing `carbohydrates` key to 0 records a bag of crisps as zero-carb.
  const carbs100 = num(n, 'carbohydrates_100g') ?? num(n, 'carbohydrates-total_100g')

  // Sodium values are in GRAMS, and `sodium_100g` is sometimes 1000x wrong
  // while `salt_100g` is right. Cross-check and prefer the label-printed salt.
  let quality: 'ok' | 'suspect' = 'ok'
  const sodiumDirect = num(n, 'sodium_100g')
  const salt = num(n, 'salt_100g')
  const sodiumFromSalt = salt != null ? salt / 2.5 : null

  let sodiumG = sodiumDirect
  if (sodiumDirect != null && sodiumFromSalt != null && sodiumFromSalt > 0) {
    if (Math.abs(sodiumDirect - sodiumFromSalt) / sodiumFromSalt > 0.2) {
      sodiumG = sodiumFromSalt
      quality = 'suspect'
    }
  } else if (sodiumDirect == null) {
    sodiumG = sodiumFromSalt
  }

  // A "<" modifier means the label said "less than" — an upper bound, not a
  // measurement.
  for (const key of ['fiber', 'sugars', 'salt', 'sodium', 'fat', 'proteins']) {
    if (n[`${key}_modifier`] === '<') quality = 'suspect'
  }

  const brandsRaw = product.brands
  const brand =
    (Array.isArray(brandsRaw) ? brandsRaw[0] : String(brandsRaw ?? '').split(',')[0])?.trim() ||
    null

  const servingQuantity = product.serving_quantity
  const servingGrams =
    typeof servingQuantity === 'number'
      ? servingQuantity
      : typeof servingQuantity === 'string' && servingQuantity.trim() !== ''
        ? Number(servingQuantity)
        : null

  const food: OffFood = {
    barcode: code,
    name:
      String(product.product_name || product.product_name_en || product.generic_name || '').trim() ||
      'Unnamed product',
    brand,
    imageUrl:
      (product.image_front_small_url as string) || (product.image_url as string) || null,
    kcal100,
    protein100: num(n, 'proteins_100g'),
    carbs100,
    fat100: num(n, 'fat_100g'),
    fiber100: num(n, 'fiber_100g'),
    sugar100: num(n, 'sugars_100g'),
    satFat100: num(n, 'saturated-fat_100g'),
    sodiumMg100: sodiumG != null ? sodiumG * 1000 : null,
    // `serving_size` is free text ("21 pieces (28 g)") — a display label only.
    // `serving_quantity` is the parsed number to compute with, and is often
    // simply absent. Never invent one: guessing 100 g is how a tracker ends up
    // 3x wrong on peanut butter.
    servingGrams: servingGrams && Number.isFinite(servingGrams) ? servingGrams : null,
    servingLabel: (product.serving_size as string) || null,
    packageGrams:
      typeof product.product_quantity === 'number' ? product.product_quantity : null,
    dataQuality: quality,
    raw: product,
  }

  if (atwaterCheck({
    kcal: food.kcal100,
    protein: food.protein100,
    carbs: food.carbs100,
    fat: food.fat100,
  }) === 'suspect') {
    food.dataQuality = 'suspect'
  }

  return food
}

async function offFetch(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** v2 is used deliberately: v3's own reference page is marked under development,
 *  and the envelopes differ (`status: 1` vs `status: "success"`). */
export async function lookupBarcode(rawCode: string): Promise<OffFood | null> {
  const code = normalizeBarcode(rawCode)
  if (!code) return null

  const json = (await offFetch(
    `${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
  )) as { status?: number; product?: Record<string, unknown> }

  // Explicitly `=== 1`: a truthiness check also passes for v3's "failure".
  if (json.status !== 1 || !json.product) return null
  return mapOffProduct(json.product)
}

/** Full-text search is not available on v2/v3 — this is Search-a-licious. */
export async function searchOff(query: string, limit = 20): Promise<OffFood[]> {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=${limit}`
  const json = (await offFetch(url)) as { hits?: Record<string, unknown>[] }

  const out: OffFood[] = []
  for (const hit of json.hits ?? []) {
    try {
      out.push(mapOffProduct(hit))
    } catch {
      // Skip products with no usable nutrition rather than showing a zero.
    }
  }
  return out
}
