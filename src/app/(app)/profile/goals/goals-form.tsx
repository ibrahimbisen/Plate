'use client'

import { useState, useTransition } from 'react'

import { updateNutritionGoals } from '@/app/actions/settings'
import { ScreenHeader } from '@/components/screen-header'
import { kcalFromMacros, rescaleMacrosToCalories, type Macros } from '@/lib/metrics'

export function GoalsForm({
  initial,
  autoAdjust,
}: {
  initial: Macros & { calories: number }
  autoAdjust: boolean
}) {
  const [calories, setCalories] = useState(initial.calories)
  const [macros, setMacros] = useState<Macros>(initial)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  /**
   * "Auto adjust macros" from Preferences: editing calories rescales P/C/F to
   * preserve the split, and editing a macro recomputes calories at 4/4/9.
   */
  function onCalories(next: number) {
    setCalories(next)
    setSaved(false)
    if (autoAdjust) setMacros(rescaleMacrosToCalories(macros, next))
  }

  function onMacro(key: keyof Macros, value: number) {
    const next = { ...macros, [key]: value }
    setMacros(next)
    setSaved(false)
    if (autoAdjust) setCalories(kcalFromMacros(next))
  }

  const derived = kcalFromMacros(macros)
  const drift = Math.abs(derived - calories)

  function save() {
    start(async () => {
      await updateNutritionGoals({ calories, macros, changed: 'macro' })
      setSaved(true)
    })
  }

  return (
    <div className="flex min-h-[85svh] flex-col gap-5 pb-4">
      <ScreenHeader title="Nutrition goals" fallbackHref="/profile" />

      <section className="card flex flex-col gap-3 p-5">
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
            Daily calories
          </span>
          <input
            value={String(calories)}
            onChange={(e) => onCalories(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
            inputMode="numeric"
            className="h-16 w-full rounded-2xl border border-line bg-card-muted px-4 text-[26px] font-bold tabular outline-none focus-visible:border-ink"
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        {(
          [
            ['proteinG', 'Protein', 'var(--color-protein)'],
            ['carbsG', 'Carbs', 'var(--color-carbs)'],
            ['fatG', 'Fat', 'var(--color-fat)'],
          ] as const
        ).map(([key, label, color]) => (
          <div key={key} className="card flex items-center gap-4 p-4">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
            <span className="flex-1 text-[16px] font-semibold">{label}</span>
            <input
              value={String(macros[key])}
              onChange={(e) => onMacro(key, Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
              inputMode="numeric"
              aria-label={`${label} grams`}
              className="h-12 w-20 rounded-xl border border-line bg-card-muted text-center tabular outline-none focus-visible:border-ink"
            />
            <span className="w-4 text-[15px] text-ink-muted">g</span>
          </div>
        ))}
      </section>

      {!autoAdjust && drift > 25 && (
        <p className="rounded-2xl bg-fill p-4 text-[14px] leading-relaxed text-ink-soft">
          Your macros work out to <strong className="font-semibold">{derived} cal</strong>, which is{' '}
          {drift} away from the target above. Turn on “Auto adjust macros” in Preferences to keep
          them in step automatically.
        </p>
      )}

      <p className="label-muted text-[13px]">
        Changing these creates a new goal from today onward. Days you have already logged keep the
        targets they were measured against.
      </p>

      <button type="button" className="btn-primary mt-auto" onClick={save} disabled={pending}>
        {pending ? 'Saving…' : saved ? 'Saved' : 'Save goals'}
      </button>
    </div>
  )
}
