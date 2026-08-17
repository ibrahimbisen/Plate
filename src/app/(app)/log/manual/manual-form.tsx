'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { createManualLog } from '@/app/actions/log'
import { ScreenHeader } from '@/components/screen-header'
import { kcalFromMacros } from '@/lib/metrics'

const field =
  'h-14 w-full rounded-2xl border border-line bg-card px-4 text-ink outline-none focus-visible:border-ink'

export function ManualForm() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')

  const n = (v: string) => {
    const parsed = Number(v.replace(/[^0-9.]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  // Live Atwater cross-check, so a typo is caught before it is saved rather
  // than silently distorting the day's totals.
  const mismatch = useMemo(() => {
    const entered = n(kcal)
    if (!entered) return null
    const derived = kcalFromMacros({ proteinG: n(protein), carbsG: n(carbs), fatG: n(fat) })
    if (derived === 0) return null
    const off = Math.abs(derived - entered)
    if (off <= Math.max(30, entered * 0.25)) return null
    return `Those macros work out to about ${Math.round(derived)} cal, not ${entered}.`
  }, [kcal, protein, carbs, fat])

  function submit() {
    if (!name.trim()) return setError('Give it a name so you can find it later.')
    if (!n(kcal)) return setError('Enter how many calories this was.')
    setError(null)

    start(async () => {
      try {
        await createManualLog({
          name: name.trim(),
          kcal: n(kcal),
          protein: n(protein),
          carbs: n(carbs),
          fat: n(fat),
        })
        router.push('/')
      } catch {
        setError('Could not save that. Try again.')
      }
    })
  }

  return (
    <div className="flex min-h-[85svh] flex-col gap-5 pb-4">
      <ScreenHeader title="Add manually" fallbackHref="/log/search" />

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            What did you eat?
          </span>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chicken salad"
            autoFocus
            autoCapitalize="sentences"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Calories
          </span>
          <input
            className={field}
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            inputMode="numeric"
            enterKeyHint="next"
            placeholder="0"
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['Protein', protein, setProtein, 'var(--color-protein)'],
              ['Carbs', carbs, setCarbs, 'var(--color-carbs)'],
              ['Fat', fat, setFat, 'var(--color-fat)'],
            ] as const
          ).map(([label, value, set, color]) => (
            <label key={label} className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                {label}
              </span>
              <input
                className={field}
                value={value}
                onChange={(e) => set(e.target.value)}
                inputMode="decimal"
                enterKeyHint="next"
                placeholder="0"
              />
            </label>
          ))}
        </div>

        {mismatch && (
          <p className="rounded-2xl bg-fill p-4 text-[14px] leading-relaxed text-ink-soft">
            {mismatch} You can still save it — labels and macros often disagree because of rounding
            and fibre.
          </p>
        )}

        {error && (
          <p role="alert" className="text-[15px] text-bad">
            {error}
          </p>
        )}
      </div>

      <div className="mt-auto pt-4">
        <button type="button" className="btn-primary" onClick={submit} disabled={pending}>
          {pending ? 'Saving…' : 'Log it'}
        </button>
      </div>
    </div>
  )
}
