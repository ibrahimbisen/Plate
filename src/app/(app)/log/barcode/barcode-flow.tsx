'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { createLog } from '@/app/actions/log'
import { BarcodeIcon, CameraIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { isValidBarcode, normalizeBarcode } from '@/lib/food/barcode'
import { formatKcal } from '@/lib/metrics'

type Food = {
  id: string
  name: string
  brand: string | null
  kcal100: number
  protein100: number | null
  carbs100: number | null
  fat100: number | null
  fiber100: number | null
  sugar100: number | null
  sodiumMg100: number | null
  servingGrams: number | null
  servingLabel: string | null
  dataQuality: string
}

export function BarcodeFlow() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  const lastRef = useRef<{ code: string; count: number }>({ code: '', count: 0 })

  const [scanning, setScanning] = useState(false)
  const [supported, setSupported] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [food, setFood] = useState<Food | null>(null)
  const [grams, setGrams] = useState(100)
  const [pending, start] = useTransition()

  const lookup = useCallback(async (raw: string) => {
    const code = normalizeBarcode(raw)
    if (!code) return
    setStatus('Looking it up…')
    stop()

    try {
      const res = await fetch(`/api/foods?barcode=${encodeURIComponent(code)}`)
      const json = await res.json()
      if (json.food) {
        setFood(json.food)
        setGrams(json.food.servingGrams ?? 100)
        setStatus(null)
      } else {
        setStatus(
          `No product found for ${code}. It may not be in Open Food Facts yet — you can add it manually.`,
        )
      }
    } catch {
      setStatus('Could not reach the server.')
    }
  }, [])

  function stop() {
    runningRef.current = false
    setScanning(false)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => stop, [])

  async function startScanning() {
    setStatus(null)
    setFood(null)

    // getUserMedia only exists on a secure origin. On plain http the manual
    // entry below is the whole feature, so say so rather than failing silently.
    if (!navigator.mediaDevices?.getUserMedia) {
      setSupported(false)
      setStatus(
        window.isSecureContext
          ? 'This browser will not give the page camera access.'
          : 'Live scanning needs HTTPS. Type the number underneath the barcode instead.',
      )
      return
    }

    try {
      // `ideal`, not `exact`: exact throws OverconstrainedError on any device
      // without a rear camera.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream
      setScanning(true)

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()

      // Keep the screen awake — hunting for a barcode on a curved packet takes
      // longer than the auto-lock timeout.
      const wakeLock = await navigator.wakeLock?.request('screen').catch(() => null)

      // BarcodeDetector is still behind a flag in Safari, and `'BarcodeDetector'
      // in window` is a broken test (desktop Chrome answers true then fails).
      // The ponyfill is used unconditionally for consistent behaviour.
      const { BarcodeDetector } = await import('barcode-detector/ponyfill')
      const detector = new BarcodeDetector({
        // Restricting formats is a large speed win over the default set.
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      runningRef.current = true
      let lastRun = 0

      const tick = async (now: number) => {
        if (!runningRef.current) {
          void wakeLock?.release().catch(() => {})
          return
        }
        // Timestamp-based throttle: Low Power Mode caps rAF at 30fps, so a
        // frame-count throttle would silently halve the scan rate.
        if (now - lastRun > 100 && video.videoWidth > 0 && ctx) {
          lastRun = now
          // Decode a centre band rather than the whole frame — roughly 3x
          // faster and far fewer false positives.
          const bandH = Math.round(video.videoHeight * 0.3)
          const sy = Math.round((video.videoHeight - bandH) / 2)
          canvas.width = video.videoWidth
          canvas.height = bandH
          ctx.drawImage(video, 0, sy, video.videoWidth, bandH, 0, 0, video.videoWidth, bandH)

          try {
            const found = await detector.detect(canvas)
            const value = found[0]?.rawValue
            if (value) {
              // Two consecutive identical reads before accepting, which kills
              // essentially all misreads.
              if (lastRef.current.code === value) lastRef.current.count++
              else lastRef.current = { code: value, count: 1 }

              if (lastRef.current.count >= 2) {
                void wakeLock?.release().catch(() => {})
                await lookup(value)
                return
              }
            }
          } catch {
            // Keep scanning — a failed frame is normal.
          }
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    } catch {
      setStatus('Camera access was blocked. Type the number instead.')
      stop()
    }
  }

  function logIt() {
    if (!food) return
    start(async () => {
      await createLog({
        name: food.brand ? `${food.name} · ${food.brand}` : food.name,
        brand: food.brand ?? undefined,
        portionLabel: 'g',
        items: [
          {
            name: food.name,
            grams,
            kcal100: food.kcal100,
            protein100: food.protein100 ?? undefined,
            carbs100: food.carbs100 ?? undefined,
            fat100: food.fat100 ?? undefined,
            fiber100: food.fiber100 ?? undefined,
            sugar100: food.sugar100 ?? undefined,
            sodiumMg100: food.sodiumMg100 ?? undefined,
          },
        ],
      })
      router.push('/')
    })
  }

  const manualValid = manual.length >= 8 && normalizeBarcode(manual) !== null

  return (
    <div className="flex min-h-[85svh] flex-col gap-4 pb-4">
      <ScreenHeader title="Scan barcode" fallbackHref="/log/search" />

      {food ? (
        <div className="card flex flex-col gap-4 p-5">
          <div>
            <p className="text-[20px] font-bold">{food.name}</p>
            {food.brand && <p className="label-muted">{food.brand}</p>}
          </div>

          {food.dataQuality === 'suspect' && (
            <p className="rounded-xl bg-fill p-3 text-[13px] text-ink-soft">
              These numbers look inconsistent on Open Food Facts — worth checking against the packet
              before you rely on them.
            </p>
          )}

          <div className="flex items-center gap-2">
            <input
              value={String(grams)}
              onChange={(e) => setGrams(Math.max(0, Number(e.target.value.replace(/[^0-9]/g, ''))))}
              inputMode="numeric"
              aria-label="Grams"
              className="h-12 w-24 rounded-xl border border-line bg-card-muted text-center outline-none focus-visible:border-ink"
            />
            <span className="text-[15px] text-ink-muted">grams</span>
            {food.servingGrams && (
              <button
                type="button"
                className="chip ml-auto"
                onClick={() => setGrams(food.servingGrams!)}
              >
                {food.servingLabel ?? `1 serving (${Math.round(food.servingGrams)}g)`}
              </button>
            )}
          </div>

          <p className="tabular">
            <strong className="text-[24px] font-bold">
              {formatKcal((food.kcal100 * grams) / 100)}
            </strong>{' '}
            cal
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => {
                setFood(null)
                setStatus(null)
              }}
            >
              Scan another
            </button>
            <button type="button" className="btn-primary flex-1" onClick={logIt} disabled={pending}>
              {pending ? 'Logging…' : 'Log it'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-card bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              disablePictureInPicture
              className="h-64 w-full object-cover"
            />
            {!scanning && (
              <div className="absolute inset-0 grid place-items-center bg-fill">
                <BarcodeIcon size={44} className="text-ink-muted" />
              </div>
            )}
            {/* Landscape framing guide matching the wide shape of a 1D barcode */}
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-white/80" />
          </div>

          {status && <p className="label-muted text-[15px]">{status}</p>}

          {!scanning && (
            <button type="button" className="btn-primary" onClick={startScanning}>
              <CameraIcon size={20} />
              Start scanning
            </button>
          )}
          {scanning && (
            <button type="button" className="btn-secondary" onClick={stop}>
              Stop
            </button>
          )}

          {/*
            The manual fallback is the cheapest insurance in the app, and the
            only path that survives both a locked-down camera and the iOS 26
            standalone-PWA rotation bug.
          */}
          <div className="card flex flex-col gap-3 p-4">
            <label className="text-[15px] font-semibold" htmlFor="code">
              Or type the number under the barcode
            </label>
            <input
              id="code"
              value={manual}
              onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="search"
              placeholder="0038000138416"
              className="h-14 w-full rounded-2xl border border-line bg-card-muted px-4 tabular outline-none focus-visible:border-ink"
            />
            {manual.length >= 8 && !isValidBarcode(manual) && (
              <p className="text-[13px] text-ink-muted">
                That check digit doesn&rsquo;t match — worth re-reading, though some store-label
                codes are genuinely non-standard, so you can still try it.
              </p>
            )}
            <button
              type="button"
              className="btn-secondary"
              disabled={!manualValid}
              onClick={() => lookup(manual)}
            >
              Look it up
            </button>
          </div>

          <Link href="/log/manual" className="btn-secondary mt-auto">
            Add manually instead
          </Link>
        </>
      )}
      {!supported && null}
    </div>
  )
}
