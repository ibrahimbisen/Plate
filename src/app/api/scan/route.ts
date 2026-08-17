import { NextResponse } from 'next/server'

import {
  AiFailedError,
  AiUnavailableError,
  aiEnabled,
  analyzeLabel,
  analyzeMealPhoto,
} from '@/lib/ai'
import { healthScore } from '@/lib/health-score'
import { resolveStoredPath, storePhoto, toBase64 } from '@/lib/photos'

/**
 * Photo upload + analysis.
 *
 * A route handler rather than a Server Action deliberately: Server Actions cap
 * request bodies at 1 MB, which a phone photo blows past instantly. Route
 * handlers have no framework-level limit (the real ceiling is your reverse
 * proxy — set client_max_body_size).
 */
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  if (!aiEnabled()) {
    return NextResponse.json(
      {
        error:
          'AI scanning is not set up on this server. Add ANTHROPIC_API_KEY to your .env, or log this manually.',
        code: 'ai_unavailable',
      },
      { status: 503 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Could not read the upload.' }, { status: 400 })
  }

  const file = form.get('photo')
  const mode = String(form.get('mode') ?? 'food')
  const correction = form.get('correction') ? String(form.get('correction')) : undefined
  const existingPath = form.get('path') ? String(form.get('path')) : undefined

  let relativePath: string
  try {
    if (existingPath) {
      // "Fix results" re-analyses the photo already on disk.
      if (!resolveStoredPath(existingPath)) {
        return NextResponse.json({ error: 'Unknown photo.' }, { status: 400 })
      }
      relativePath = existingPath
    } else {
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No photo was attached.' }, { status: 400 })
      }
      relativePath = (await storePhoto(file)).relativePath
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not process that image.' },
      { status: 400 },
    )
  }

  const absolute = resolveStoredPath(relativePath)!

  try {
    const base64 = await toBase64(absolute)
    const image = { base64, mediaType: 'image/jpeg' as const }

    if (mode === 'label') {
      const label = await analyzeLabel(image)
      if (!label.readable) {
        return NextResponse.json(
          {
            error: 'That label was not readable. Try again with more light and less blur.',
            code: 'unreadable',
            path: relativePath,
          },
          { status: 422 },
        )
      }
      return NextResponse.json({ mode: 'label', path: relativePath, label })
    }

    const analysis = await analyzeMealPhoto(image, correction)

    const score = healthScore({
      kcal100: weighted(analysis.items, (i) => i.kcalPer100g),
      protein100: weighted(analysis.items, (i) => i.proteinPer100g),
      satFat100: weighted(analysis.items, (i) => i.fatPer100g) / 3,
      fiber100: weighted(analysis.items, (i) => i.fiberPer100g),
      sugar100: weighted(analysis.items, (i) => i.sugarPer100g),
      sodiumMg100: weighted(analysis.items, (i) => i.sodiumMgPer100g),
      fvlPercent: analysis.fvlPercent,
    })

    return NextResponse.json({ mode: 'food', path: relativePath, analysis, healthScore: score })
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return NextResponse.json({ error: error.message, code: 'ai_unavailable' }, { status: 503 })
    }
    if (error instanceof AiFailedError) {
      return NextResponse.json(
        { error: error.message, code: 'ai_failed', path: relativePath },
        { status: 502 },
      )
    }
    return NextResponse.json({ error: 'Analysis failed.', path: relativePath }, { status: 500 })
  }
}

/** Weight-averages a per-100g field across ingredients. */
function weighted<T extends { grams: number }>(items: T[], pick: (i: T) => number): number {
  const total = items.reduce((a, i) => a + i.grams, 0)
  if (total <= 0) return 0
  return items.reduce((a, i) => a + pick(i) * i.grams, 0) / total
}
