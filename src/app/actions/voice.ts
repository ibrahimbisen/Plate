'use server'

import { aiEnabled, analyzeText } from '@/lib/ai'
import { requireUser } from '@/lib/dal'
import type { LogItemInput } from '@/lib/nutrition'

export type ParsedEntry = { name: string; items: LogItemInput[] }

/**
 * Turns a spoken or typed description into structured entries.
 *
 * Shared by voice logging and the "describe what you ate" search box — the
 * input is text either way, so there is one code path.
 */
export async function parseFoodText(
  description: string,
): Promise<{ ok: true; entries: ParsedEntry[] } | { ok: false; error: string }> {
  await requireUser()

  if (!description.trim()) return { ok: false, error: 'Say or type what you ate first.' }
  if (!aiEnabled()) {
    return {
      ok: false,
      error: 'AI is not set up on this server. Search the food database or add it manually.',
    }
  }

  try {
    const parsed = await analyzeText(description.trim())
    if (parsed.entries.length === 0) {
      return { ok: false, error: 'Could not work out any foods from that.' }
    }

    return {
      ok: true,
      entries: parsed.entries.map((entry) => ({
        name: entry.name,
        items: entry.items.map((i) => ({
          name: i.name,
          grams: i.grams,
          gramsLow: i.gramsLow,
          gramsHigh: i.gramsHigh,
          kcal100: i.kcalPer100g,
          protein100: i.proteinPer100g,
          carbs100: i.carbPer100g,
          fat100: i.fatPer100g,
          fiber100: i.fiberPer100g,
          sugar100: i.sugarPer100g,
          sodiumMg100: i.sodiumMgPer100g,
          isHiddenFat: i.isEstimatedHiddenFat,
          confidence: i.confidence,
        })),
      })),
    }
  } catch {
    return { ok: false, error: 'Could not work that out. Try adding it manually.' }
  }
}

export async function sttConfigured(): Promise<boolean> {
  return Boolean(process.env.STT_ENDPOINT)
}
