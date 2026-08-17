import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'

import {
  ExerciseAnalysisSchema,
  LabelAnalysisSchema,
  MealAnalysisSchema,
  TextAnalysisSchema,
  type ExerciseAnalysis,
  type LabelAnalysis,
  type MealAnalysis,
  type TextAnalysis,
} from './schema'
import {
  EXERCISE_PROMPT,
  FIX_RESULTS_PROMPT,
  LABEL_PROMPT,
  MEAL_PHOTO_PROMPT,
  TEXT_LOG_PROMPT,
} from './prompts'

export class AiUnavailableError extends Error {
  constructor(message = 'AI analysis is not configured on this server.') {
    super(message)
    this.name = 'AiUnavailableError'
  }
}

export class AiFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiFailedError'
  }
}

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY)

/** Never date-suffix these IDs — the bare alias is the complete model name. */
const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-opus-5'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!aiEnabled()) throw new AiUnavailableError()
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 })
  return client
}

type ImageInput = { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' }

/**
 * One call shape for every analysis.
 *
 * `messages.parse` sets output_config.format from the Zod schema and validates
 * the response, so we get a typed object or a clear failure — never a string
 * that has to be JSON.parsed and hoped over.
 */
async function analyze<T extends z.ZodType>(opts: {
  schema: T
  prompt: string
  image?: ImageInput
  text?: string
  /** Photo scans use medium for latency; "Fix results" retries at high. */
  effort?: 'low' | 'medium' | 'high'
}): Promise<z.infer<T>> {
  const content: Anthropic.ContentBlockParam[] = []

  // The image goes first — documented ordering for vision requests.
  if (opts.image) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: opts.image.mediaType, data: opts.image.base64 },
    })
  }
  content.push({ type: 'text', text: opts.text ? `${opts.prompt}\n\n${opts.text}` : opts.prompt })

  let response
  try {
    response = await getClient().messages.parse({
      model: MODEL(),
      // Thinking is on by default and counts against max_tokens together with
      // the response, so a long ingredient list needs real headroom.
      max_tokens: 8192,
      output_config: {
        format: zodOutputFormat(opts.schema as never),
        effort: opts.effort ?? 'medium',
      },
      messages: [{ role: 'user', content }],
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiFailedError('The AI service is rate limited right now. Try again in a moment.')
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiUnavailableError('The configured ANTHROPIC_API_KEY was rejected.')
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AiFailedError('Could not reach the AI service. Check the server’s connection.')
    }
    throw new AiFailedError('The AI service returned an error.')
  }

  // Guard before touching content: a refusal is a 200 with an empty body.
  if (response.stop_reason === 'refusal') {
    throw new AiFailedError('The AI declined to analyse this image.')
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AiFailedError('The analysis was cut short. Try a simpler photo.')
  }

  const parsed = response.parsed_output as z.infer<T> | null
  if (!parsed) throw new AiFailedError('The AI response could not be read.')
  return parsed
}

export async function analyzeMealPhoto(
  image: ImageInput,
  correction?: string,
): Promise<MealAnalysis> {
  return analyze({
    schema: MealAnalysisSchema,
    prompt: correction ? FIX_RESULTS_PROMPT(correction) : MEAL_PHOTO_PROMPT,
    image,
    // A correction means the first pass was wrong; spend more on the retry.
    effort: correction ? 'high' : 'medium',
  })
}

export async function analyzeLabel(image: ImageInput): Promise<LabelAnalysis> {
  return analyze({ schema: LabelAnalysisSchema, prompt: LABEL_PROMPT, image, effort: 'low' })
}

export async function analyzeText(description: string): Promise<TextAnalysis> {
  return analyze({
    schema: TextAnalysisSchema,
    prompt: TEXT_LOG_PROMPT,
    text: `The user said: "${description}"`,
  })
}

export async function analyzeExercise(description: string): Promise<ExerciseAnalysis> {
  return analyze({
    schema: ExerciseAnalysisSchema,
    prompt: EXERCISE_PROMPT,
    text: `The user said: "${description}"`,
    effort: 'low',
  })
}
