'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import { createLog } from '@/app/actions/log'
import { BarcodeIcon, CameraIcon, ImageIcon, LabelIcon, SparkleIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { downscaleImage } from '@/lib/capture/resize'
import { formatKcal } from '@/lib/metrics'
import { totalsFromItems, type LogItemInput } from '@/lib/nutrition'

type Analysis = {
  name: string
  items: {
    name: string
    grams: number
    gramsLow: number
    gramsHigh: number
    kcalPer100g: number
    proteinPer100g: number
    carbPer100g: number
    fatPer100g: number
    fiberPer100g: number
    sugarPer100g: number
    sodiumMgPer100g: number
    isEstimatedHiddenFat: boolean
    confidence: number
  }[]
  scaleReference: string
  assumptions: string[]
  clarifyingQuestion: string
  overallConfidence: number
}

type Stage = 'capture' | 'analyzing' | 'review' | 'error'

const toItems = (a: Analysis): LogItemInput[] =>
  a.items.map((i) => ({
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
  }))

export function ScanFlow({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('capture')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [mode, setMode] = useState<'food' | 'label'>('food')

  const [path, setPath] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [items, setItems] = useState<LogItemInput[]>([])
  const [meta, setMeta] = useState<Pick<
    Analysis,
    'scaleReference' | 'assumptions' | 'clarifyingQuestion' | 'overallConfidence'
  > | null>(null)
  const [healthScore, setHealthScore] = useState<number | null>(null)
  const [correction, setCorrection] = useState('')
  const [showFix, setShowFix] = useState(false)
  const [saving, startSaving] = useTransition()

  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  async function send(body: FormData) {
    setStage('analyzing')
    setError(null)
    try {
      const res = await fetch('/api/scan', { method: 'POST', body })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'That did not work.')
        setStage('error')
        return
      }

      if (json.mode === 'label') {
        const l = json.label
        const grams = l.servingSizeG > 0 ? l.servingSizeG : 100
        const scale = 100 / grams
        setName(l.brand ? `${l.name} · ${l.brand}` : l.name)
        setItems([
          {
            name: l.name,
            grams,
            kcal100: l.caloriesPerServing * scale,
            protein100: l.proteinG * scale,
            carbs100: l.carbsG * scale,
            fat100: l.fatG * scale,
            fiber100: l.fiberG * scale,
            sugar100: l.sugarG * scale,
            sodiumMg100: l.sodiumMg * scale,
          },
        ])
        setMeta({
          scaleReference: '',
          assumptions: [l.servingSizeText ? `Serving: ${l.servingSizeText}` : ''].filter(Boolean),
          clarifyingQuestion: '',
          overallConfidence: 1,
        })
      } else {
        const a = json.analysis as Analysis
        setName(a.name)
        setItems(toItems(a))
        setMeta(a)
        setHealthScore(json.healthScore ?? null)
      }

      setPath(json.path)
      setStage('review')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setStage('error')
    }
  }

  async function onFile(file: File) {
    setPreview(URL.createObjectURL(file))
    try {
      const { blob } = await downscaleImage(file)
      const body = new FormData()
      body.append('photo', blob, 'meal.jpg')
      body.append('mode', mode)
      await send(body)
    } catch {
      setError('Could not read that photo. Try a different one.')
      setStage('error')
    }
  }

  function fixResults() {
    if (!path || !correction.trim()) return
    const body = new FormData()
    body.append('path', path)
    body.append('mode', 'food')
    body.append('correction', correction.trim())
    setShowFix(false)
    void send(body)
  }

  function save() {
    startSaving(async () => {
      await createLog({
        name,
        items,
        photoPath: path ?? undefined,
        healthScore: healthScore ?? undefined,
        aiConfidence: meta?.overallConfidence,
        scaleReference: meta?.scaleReference || undefined,
        assumptions: meta?.assumptions,
      })
      router.push('/')
    })
  }

  const totals = totalsFromItems(items)

  // ---------------------------------------------------------------- capture
  if (stage === 'capture') {
    return (
      <div className="flex min-h-[85svh] flex-col gap-5 pb-4">
        <ScreenHeader title="Scan food" />

        {!aiEnabled && (
          <div className="card flex flex-col gap-2 p-5">
            <h2 className="text-[17px] font-semibold">AI scanning is not set up</h2>
            <p className="label-muted">
              Add <code className="chip">ANTHROPIC_API_KEY</code> to your server&rsquo;s{' '}
              <code className="chip">.env</code> to scan meals from a photo. Everything else works
              without it.
            </p>
            <Link href="/log/search" className="btn-secondary mt-2">
              Search the food database instead
            </Link>
          </div>
        )}

        {/* Mode switcher. Barcode is a separate screen because it needs a live
            camera stream, while the other two use the native photo picker. */}
        <div className="flex gap-1 rounded-full bg-fill p-1">
          {(
            [
              ['food', 'Scan food', CameraIcon],
              ['label', 'Food label', LabelIcon],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-colors ${
                mode === value ? 'bg-card text-ink shadow-[var(--shadow-card)]' : 'text-ink-muted'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          <Link
            href="/log/barcode"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-ink-muted"
          >
            <BarcodeIcon size={18} />
            Barcode
          </Link>
        </div>

        <div className="card flex flex-col items-center gap-4 px-6 py-10 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-fill">
            <CameraIcon size={34} />
          </div>
          <div>
            <h2 className="text-[19px] font-semibold">
              {mode === 'food' ? 'Take a photo of your meal' : 'Photograph the nutrition label'}
            </h2>
            <p className="label-muted mt-1">
              {mode === 'food'
                ? 'Include a hand, fork, or plate edge in the frame — a size reference roughly halves the error.'
                : 'Fill the frame with the panel and keep it flat.'}
            </p>
          </div>

          <ul className="flex flex-col gap-1.5 text-left text-[14px] text-ink-muted">
            <li>Hold still</li>
            <li>Use plenty of light</li>
            <li>Make sure everything is visible</li>
          </ul>
        </div>

        {/*
          `capture="environment"` opens the native camera directly on iOS and
          Android, giving the full-resolution pipeline. getUserMedia is NOT used
          here: in an installed iOS PWA it currently returns 90-degree-rotated
          video and re-prompts for permission on every route change, and
          ImageCapture.takePhoto is still unavailable so the frame would only be
          preview quality anyway.
        */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        {/* A second input without `capture` — with it present iOS offers no library option. */}
        <input
          ref={libraryInput}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />

        <div className="mt-auto flex flex-col gap-3 pt-4">
          <button
            type="button"
            className="btn-primary"
            disabled={!aiEnabled}
            onClick={() => cameraInput.current?.click()}
          >
            <CameraIcon size={20} />
            Take a photo
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!aiEnabled}
            onClick={() => libraryInput.current?.click()}
          >
            <ImageIcon size={18} />
            Choose from library
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------- analyzing
  if (stage === 'analyzing') {
    return (
      <div className="flex min-h-[85svh] flex-col items-center justify-center gap-6 text-center">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-48 w-48 rounded-card object-cover opacity-60" />
        )}
        <div className="flex flex-col items-center gap-2">
          <SparkleIcon size={28} className="animate-pulse" />
          <p className="text-[19px] font-semibold">Working out what&rsquo;s in this</p>
          <p className="label-muted max-w-[28ch]">
            Identifying ingredients and estimating portion weights. A few seconds.
          </p>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ error
  if (stage === 'error') {
    return (
      <div className="flex min-h-[85svh] flex-col gap-5 pb-4">
        <ScreenHeader title="Scan food" />
        <div className="card flex flex-col gap-3 p-5">
          <h2 className="text-[17px] font-semibold">That didn&rsquo;t work</h2>
          <p className="label-muted">{error}</p>
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <button type="button" className="btn-primary" onClick={() => setStage('capture')}>
            Try another photo
          </button>
          <Link href="/log/manual" className="btn-secondary">
            Add it manually instead
          </Link>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------------------- review
  return (
    <div className="flex min-h-[85svh] flex-col gap-4 pb-4">
      <ScreenHeader title="Check the results" />

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-44 w-full rounded-card object-cover" />
      )}

      <div className="card flex flex-col gap-4 p-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-transparent text-[24px] font-bold leading-tight tracking-[-0.02em] outline-none"
          aria-label="Meal name"
        />

        <div className="rounded-tile border border-line p-4">
          <p className="label-muted text-[14px]">Calories</p>
          <p className="text-stat tabular">{formatKcal(totals.kcal)}</p>
          {totals.kcalHigh > totals.kcalLow && (
            <p className="mt-0.5 text-[13px] text-ink-muted tabular">
              roughly {formatKcal(totals.kcalLow)}–{formatKcal(totals.kcalHigh)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['Protein', totals.protein, 'var(--color-protein)'],
              ['Carbs', totals.carbs, 'var(--color-carbs)'],
              ['Fats', totals.fat, 'var(--color-fat)'],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label} className="rounded-tile border border-line p-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                <p className="text-[13px] text-ink-muted">{label}</p>
              </div>
              <p className="mt-0.5 text-[20px] font-bold tabular">{Math.round(value)}g</p>
            </div>
          ))}
        </div>
      </div>

      {meta?.clarifyingQuestion && (
        <div className="card flex flex-col gap-2 p-4">
          <p className="text-[15px] font-semibold">One thing would sharpen this</p>
          <p className="label-muted text-[14px]">{meta.clarifyingQuestion}</p>
          <button
            type="button"
            className="btn-secondary mt-1"
            onClick={() => setShowFix(true)}
          >
            Answer it
          </button>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="section-title">Ingredients</h2>
        <p className="label-muted text-[14px]">
          Adjust any weight — this is where estimates go wrong most, and totals update as you type.
        </p>
        {items.map((item, index) => (
          <div key={index} className="card flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">
                {item.name}
                {item.isHiddenFat && (
                  <span className="ml-2 text-[12px] font-normal text-ink-muted">cooking fat</span>
                )}
              </p>
              <p className="text-[13px] text-ink-muted tabular">
                {formatKcal((item.kcal100 * item.grams) / 100)} cal
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                value={String(Math.round(item.grams))}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) =>
                      i === index
                        ? { ...it, grams: Math.max(0, Number(e.target.value.replace(/[^0-9]/g, ''))) }
                        : it,
                    ),
                  )
                }
                inputMode="numeric"
                aria-label={`Grams of ${item.name}`}
                className="h-11 w-16 rounded-xl border border-line bg-card-muted text-center outline-none focus-visible:border-ink"
              />
              <span className="text-[14px] text-ink-muted">g</span>
            </div>
          </div>
        ))}
      </section>

      {showFix && (
        <div className="card flex flex-col gap-3 p-4">
          <label className="text-[15px] font-semibold" htmlFor="fix">
            What did it get wrong?
          </label>
          <textarea
            id="fix"
            rows={3}
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="It was grilled, not fried, and there was about twice as much rice."
            className="w-full rounded-2xl border border-line bg-card-muted p-3 outline-none focus-visible:border-ink"
          />
          <button
            type="button"
            className="btn-primary"
            onClick={fixResults}
            disabled={!correction.trim()}
          >
            Re-analyse
          </button>
        </div>
      )}

      <div className="mt-auto flex gap-3 pt-4">
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => setShowFix((v) => !v)}
        >
          <SparkleIcon size={17} />
          Fix results
        </button>
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={save}
          disabled={saving || items.length === 0}
        >
          {saving ? 'Logging…' : 'Log it'}
        </button>
      </div>
    </div>
  )
}
