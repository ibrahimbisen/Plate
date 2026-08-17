'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { createLog } from '@/app/actions/log'
import { parseFoodText, type ParsedEntry } from '@/app/actions/voice'
import { CheckIcon, CloseIcon, MicIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { formatKcal } from '@/lib/metrics'
import { totalsFromItems } from '@/lib/nutrition'

type Stage = 'idle' | 'listening' | 'thinking' | 'review'

/** Prefer WebM/Opus, but Safari was MP4-only until 18.4 — probe, never assume. */
function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', '']
  return candidates.find((t) => t === '' || MediaRecorder.isTypeSupported(t)) || undefined
}

export function VoiceFlow({
  aiEnabled,
  sttConfigured,
}: {
  aiEnabled: boolean
  sttConfigured: boolean
}) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('idle')
  const [transcript, setTranscript] = useState('')
  const [entries, setEntries] = useState<ParsedEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [levels, setLevels] = useState<number[]>(Array(28).fill(0.1))
  const [pending, start] = useTransition()

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    cancelAnimationFrame(rafRef.current)
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    recorderRef.current = null
    void audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }

  async function beginRecording() {
    setError(null)
    setTranscript('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Live waveform. AudioContext starts suspended on iOS and must be resumed
      // from inside the gesture that started it.
      const AudioCtx = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      await ctx.resume()
      audioCtxRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const draw = () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128)
        setLevels((prev) => [...prev.slice(1), Math.max(0.08, Math.min(1, peak * 2.2))])
        rafRef.current = requestAnimationFrame(draw)
      }
      draw()

      if (sttConfigured) {
        const mimeType = pickMimeType()
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        chunksRef.current = []
        recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
        recorder.onstop = () => void transcribe(new Blob(chunksRef.current, { type: recorder.mimeType }))
        recorder.start()
        recorderRef.current = recorder
      } else {
        startBrowserRecognition(stream)
      }

      setStage('listening')
    } catch {
      setError('Microphone access was blocked. You can type what you ate instead.')
      setStage('idle')
    }
  }

  /**
   * Browser SpeechRecognition. Works in a Safari tab but is reported broken once
   * the app is installed to the Home Screen, which is exactly how this app is
   * meant to be used — hence the server path above and the text box below.
   */
  function startBrowserRecognition(stream: MediaStream) {
    const Ctor =
      (window as never as { SpeechRecognition?: new () => never }).SpeechRecognition ??
      (window as never as { webkitSpeechRecognition?: new () => never }).webkitSpeechRecognition

    if (!Ctor) {
      stream.getTracks().forEach((t) => t.stop())
      setError('This browser cannot transcribe speech. Type what you ate instead.')
      setStage('idle')
      return
    }

    const recognition = new Ctor() as unknown as {
      lang: string
      interimResults: boolean
      continuous: boolean
      start: () => void
      stop: () => void
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void
      onerror: () => void
      onend: () => void
    }

    recognition.lang = navigator.language || 'en-US'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript
      setTranscript(text)
    }
    recognition.onerror = () => {
      setError('Could not hear that clearly. Try again, or type it instead.')
      setStage('idle')
    }
    recognition.onend = () => {
      stream.getTracks().forEach((t) => t.stop())
      setTranscript((current) => {
        if (current.trim()) void interpret(current)
        else setStage('idle')
        return current
      })
    }

    recognition.start()
    recognitionRef.current = recognition
  }

  async function transcribe(blob: Blob) {
    setStage('thinking')
    try {
      const body = new FormData()
      body.append('audio', blob, 'clip.webm')
      const res = await fetch('/api/voice', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Transcription failed.')
        setStage('idle')
        return
      }
      setTranscript(json.text)
      await interpret(json.text)
    } catch {
      setError('Could not reach the server.')
      setStage('idle')
    }
  }

  async function interpret(text: string) {
    setStage('thinking')
    const result = await parseFoodText(text)
    if (!result.ok) {
      setError(result.error)
      setStage('idle')
      return
    }
    setEntries(result.entries)
    setStage('review')
  }

  function stopListening() {
    cancelAnimationFrame(rafRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    else recognitionRef.current?.stop()
  }

  function cancel() {
    cleanup()
    setStage('idle')
    setTranscript('')
  }

  function logAll() {
    start(async () => {
      for (const entry of entries) {
        await createLog({ name: entry.name, items: entry.items })
      }
      router.push('/')
    })
  }

  // ---------------------------------------------------------------- listening
  if (stage === 'listening') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-page/90 px-6 backdrop-blur-xl">
        <div className="flex h-24 items-center gap-[3px]" aria-hidden="true">
          {levels.map((level, i) => (
            <span
              key={i}
              className="w-[5px] rounded-full bg-ink transition-[height] duration-75"
              style={{ height: `${Math.max(6, level * 88)}px` }}
            />
          ))}
        </div>

        <div className="text-center">
          <p className="text-[20px] font-semibold">Listening…</p>
          <p className="label-muted mt-1 max-w-[30ch]">
            {transcript || 'Say what you ate, like “two eggs and a slice of toast”.'}
          </p>
        </div>

        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={cancel}
            aria-label="Cancel"
            className="grid h-14 w-14 place-items-center rounded-full bg-fill"
          >
            <CloseIcon size={24} />
          </button>
          <button
            type="button"
            onClick={stopListening}
            aria-label="Done"
            className="grid h-20 w-20 place-items-center rounded-full bg-accent text-accent-ink"
          >
            <CheckIcon size={30} />
          </button>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------------------- thinking
  if (stage === 'thinking') {
    return (
      <div className="flex min-h-[85svh] flex-col items-center justify-center gap-3 text-center">
        <MicIcon size={28} className="animate-pulse" />
        <p className="text-[19px] font-semibold">Working out what that was</p>
        {transcript && <p className="label-muted max-w-[32ch]">&ldquo;{transcript}&rdquo;</p>}
      </div>
    )
  }

  // ------------------------------------------------------------------- review
  if (stage === 'review') {
    return (
      <div className="flex min-h-[85svh] flex-col gap-4 pb-4">
        <ScreenHeader title="Check this over" fallbackHref="/log/search" />
        <p className="label-muted">&ldquo;{transcript}&rdquo;</p>

        {entries.map((entry, i) => {
          const totals = totalsFromItems(entry.items)
          return (
            <div key={i} className="card flex flex-col gap-2 p-4">
              <p className="text-[17px] font-semibold">{entry.name}</p>
              <p className="tabular">
                <strong className="text-[22px] font-bold">{formatKcal(totals.kcal)}</strong> cal
                <span className="ml-3 text-[14px] text-ink-muted">
                  P {Math.round(totals.protein)}g · C {Math.round(totals.carbs)}g · F{' '}
                  {Math.round(totals.fat)}g
                </span>
              </p>
              <p className="text-[13px] text-ink-muted">
                {entry.items.map((it) => `${it.name} ${Math.round(it.grams)}g`).join(' · ')}
              </p>
            </div>
          )
        })}

        <div className="mt-auto flex gap-3 pt-4">
          <button type="button" className="btn-secondary flex-1" onClick={cancel}>
            Start over
          </button>
          <button type="button" className="btn-primary flex-1" onClick={logAll} disabled={pending}>
            {pending ? 'Logging…' : `Log ${entries.length > 1 ? `all ${entries.length}` : 'it'}`}
          </button>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------- idle
  return (
    <div className="flex min-h-[85svh] flex-col gap-5 pb-4">
      <ScreenHeader title="Voice log" fallbackHref="/log/search" />

      <div className="card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-fill">
          <MicIcon size={32} />
        </div>
        <div>
          <h2 className="text-[19px] font-semibold">Say what you ate</h2>
          <p className="label-muted mt-1">
            &ldquo;Two scrambled eggs, a slice of sourdough and a flat white.&rdquo;
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="label-muted text-[15px]">
          {error}
        </p>
      )}

      {!aiEnabled && (
        <p className="label-muted text-[14px]">
          Voice logging needs an <code className="chip">ANTHROPIC_API_KEY</code> to turn what you
          say into food entries.
        </p>
      )}

      <button
        type="button"
        className="btn-primary"
        onClick={beginRecording}
        disabled={!aiEnabled}
      >
        <MicIcon size={20} />
        Start talking
      </button>

      {/* Typing always works, on every browser, installed or not. */}
      <div className="card flex flex-col gap-3 p-4">
        <label htmlFor="typed" className="text-[15px] font-semibold">
          Or just type it
        </label>
        <textarea
          id="typed"
          rows={3}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Two eggs and a slice of toast"
          className="w-full rounded-2xl border border-line bg-card-muted p-3 outline-none focus-visible:border-ink"
        />
        <button
          type="button"
          className="btn-secondary"
          disabled={!transcript.trim() || !aiEnabled}
          onClick={() => void interpret(transcript)}
        >
          Work it out
        </button>
      </div>

      <Link href="/log/manual" className="btn-secondary mt-auto">
        Add manually instead
      </Link>
    </div>
  )
}
