import { NextResponse } from 'next/server'

/**
 * Server-side speech-to-text.
 *
 * The Anthropic API does not accept audio, so no audio ever goes to Claude —
 * this proxies to any OpenAI-compatible /v1/audio/transcriptions endpoint,
 * which works with OpenAI, Groq, or a self-hosted whisper.cpp container. The
 * transcript is then parsed into food entries by the normal text path.
 *
 * If STT_ENDPOINT is unset the client falls back to the browser's own
 * SpeechRecognition, and failing that, to typing.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const endpoint = process.env.STT_ENDPOINT
  if (!endpoint) {
    return NextResponse.json(
      { error: 'No transcription endpoint configured.', code: 'stt_unavailable' },
      { status: 503 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Could not read the upload.' }, { status: 400 })
  }

  const audio = form.get('audio')
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'No audio was attached.' }, { status: 400 })
  }
  if (audio.size > 25_000_000) {
    return NextResponse.json({ error: 'That recording is too long.' }, { status: 413 })
  }

  const upstream = new FormData()
  upstream.append('file', audio, audio.name || 'audio.webm')
  upstream.append('model', process.env.STT_MODEL || 'whisper-1')

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: process.env.STT_API_KEY
        ? { Authorization: `Bearer ${process.env.STT_API_KEY}` }
        : undefined,
      body: upstream,
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Transcription failed.' }, { status: 502 })
    }

    const json = (await res.json()) as { text?: string }
    if (!json.text?.trim()) {
      return NextResponse.json({ error: 'Nothing was heard in that recording.' }, { status: 422 })
    }

    return NextResponse.json({ text: json.text.trim() })
  } catch {
    return NextResponse.json({ error: 'Could not reach the transcription service.' }, { status: 502 })
  }
}
