'use client'

import { useMemo, useState, useTransition } from 'react'

import { completeOnboarding } from '@/app/actions/onboarding'
import { ChevronLeft } from '@/components/icons'
import { computeGoals, type OnboardingInput } from '@/lib/goals'
import { ACTIVITY_LABELS, formatKcal, type ActivityLevel, type Sex } from '@/lib/metrics'

const STEPS = ['You', 'Body', 'Activity', 'Goal', 'Plan'] as const

const emptyDraft = {
  firstName: '',
  lastName: '',
  sex: 'male' as Sex,
  birthDate: '',
  units: 'imperial' as 'imperial' | 'metric',
  heightFeet: 5,
  heightInches: 10,
  heightCm: 178,
  weightLb: 180,
  weightKg: 82,
  goalWeightLb: 165,
  goalWeightKg: 75,
  activityLevel: 'sedentary' as ActivityLevel,
  weeklyRateLb: 1,
  weeklyRateKg: 0.5,
}

export function OnboardingFlow() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(emptyDraft)
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const metric = draft.units === 'metric'

  const input: OnboardingInput = useMemo(
    () => ({
      firstName: draft.firstName,
      lastName: draft.lastName,
      sex: draft.sex,
      birthDate: draft.birthDate,
      units: draft.units,
      heightValue: metric ? draft.heightCm : draft.heightFeet,
      heightInches: metric ? undefined : draft.heightInches,
      weightValue: metric ? draft.weightKg : draft.weightLb,
      goalWeightValue: metric ? draft.goalWeightKg : draft.goalWeightLb,
      activityLevel: draft.activityLevel,
      weeklyRateValue: metric ? draft.weeklyRateKg : draft.weeklyRateLb,
    }),
    [draft, metric],
  )

  // Same pure function the server uses, so the preview cannot drift.
  const preview = useMemo(
    () => computeGoals(input, new Date().toISOString().slice(0, 10)),
    [input],
  )

  const canAdvance =
    step === 0 ? draft.firstName.trim().length > 0 : step === 1 ? draft.birthDate !== '' : true

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      startTransition(() => void completeOnboarding(input, timezone))
    }
  }

  return (
    <div className="flex min-h-[85svh] flex-col gap-6">
      <header className="flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full bg-fill"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-track'}`}
            />
          ))}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-5">
        {step === 0 && (
          <Step title="What should we call you?" subtitle="This only ever stays on your server.">
            <Field label="First name">
              <input
                className={inputClass}
                value={draft.firstName}
                autoFocus
                autoCapitalize="words"
                autoCorrect="off"
                onChange={(e) => set('firstName', e.target.value)}
              />
            </Field>
            <Field label="Last name">
              <input
                className={inputClass}
                value={draft.lastName}
                autoCapitalize="words"
                autoCorrect="off"
                onChange={(e) => set('lastName', e.target.value)}
              />
            </Field>
            <Segmented
              value={draft.units}
              onChange={(v) => set('units', v)}
              options={[
                { value: 'imperial', label: 'lbs / ft' },
                { value: 'metric', label: 'kg / cm' },
              ]}
            />
          </Step>
        )}

        {step === 1 && (
          <Step title="A few body basics" subtitle="These feed the calorie calculation.">
            <Segmented
              value={draft.sex}
              onChange={(v) => set('sex', v)}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
            />
            <Field label="Date of birth">
              <input
                type="date"
                className={inputClass}
                value={draft.birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => set('birthDate', e.target.value)}
              />
            </Field>

            {metric ? (
              <Field label="Height (cm)">
                <NumberInput value={draft.heightCm} onChange={(v) => set('heightCm', v)} />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Height (ft)">
                  <NumberInput value={draft.heightFeet} onChange={(v) => set('heightFeet', v)} />
                </Field>
                <Field label="Height (in)">
                  <NumberInput value={draft.heightInches} onChange={(v) => set('heightInches', v)} />
                </Field>
              </div>
            )}

            <Field label={`Current weight (${metric ? 'kg' : 'lbs'})`}>
              <NumberInput
                value={metric ? draft.weightKg : draft.weightLb}
                step={0.1}
                onChange={(v) => set(metric ? 'weightKg' : 'weightLb', v)}
              />
            </Field>
          </Step>
        )}

        {step === 2 && (
          <Step title="How active are you?" subtitle="Pick the closest match — you can change it later.">
            <div className="flex flex-col gap-2.5">
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => {
                const active = draft.activityLevel === level
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => set('activityLevel', level)}
                    className={`card flex flex-col items-start gap-0.5 p-4 text-left transition-all ${
                      active ? 'ring-2 ring-ink' : ''
                    }`}
                  >
                    <span className="text-[16px] font-semibold">{ACTIVITY_LABELS[level].title}</span>
                    <span className="label-muted text-[14px]">{ACTIVITY_LABELS[level].detail}</span>
                  </button>
                )
              })}
            </div>
            <p className="label-muted text-[13px]">
              This is a starting point only. Once you have about three weeks of data, Plate
              measures your actual energy expenditure and stops relying on this estimate.
            </p>
          </Step>
        )}

        {step === 3 && (
          <Step title="What are you aiming for?" subtitle="Set a goal weight and a comfortable pace.">
            <Field label={`Goal weight (${metric ? 'kg' : 'lbs'})`}>
              <NumberInput
                value={metric ? draft.goalWeightKg : draft.goalWeightLb}
                step={0.1}
                onChange={(v) => set(metric ? 'goalWeightKg' : 'goalWeightLb', v)}
              />
            </Field>
            <Field label={`Weekly pace (${metric ? 'kg' : 'lbs'} per week)`}>
              <div className="flex gap-2">
                {(metric ? [0.25, 0.5, 0.75, 1] : [0.5, 1, 1.5, 2]).map((rate) => {
                  const current = metric ? draft.weeklyRateKg : draft.weeklyRateLb
                  const active = Math.abs(current - rate) < 0.001
                  return (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => set(metric ? 'weeklyRateKg' : 'weeklyRateLb', rate)}
                      className={`h-11 flex-1 rounded-full text-[15px] font-semibold transition-colors ${
                        active ? 'bg-accent text-accent-ink' : 'bg-fill text-ink'
                      }`}
                    >
                      {rate}
                    </button>
                  )
                })}
              </div>
            </Field>
            <p className="label-muted text-[13px]">
              Paces above about 1% of your bodyweight per week are capped automatically.
            </p>
          </Step>
        )}

        {step === 4 && (
          <Step title="Here's your plan" subtitle="You can fine-tune any of these later.">
            <div className="card flex flex-col gap-1 p-6 text-center">
              <p className="text-hero tabular">{formatKcal(preview.calories)}</p>
              <p className="label-muted">calories per day</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Protein', value: preview.macros.proteinG, color: 'var(--color-protein)' },
                { label: 'Carbs', value: preview.macros.carbsG, color: 'var(--color-carbs)' },
                { label: 'Fat', value: preview.macros.fatG, color: 'var(--color-fat)' },
              ].map((m) => (
                <div key={m.label} className="card flex flex-col items-center gap-1 p-4">
                  <span className="h-1.5 w-8 rounded-full" style={{ background: m.color }} />
                  <p className="text-[22px] font-bold tabular">{m.value}g</p>
                  <p className="text-[13px] text-ink-muted">{m.label}</p>
                </div>
              ))}
            </div>
            {preview.floored && (
              <p className="rounded-2xl bg-fill p-4 text-[14px] leading-relaxed text-ink-soft">
                <strong className="font-semibold">Your pace was eased back.</strong>{' '}
                {preview.floorReason === 'bmr'
                  ? 'The pace you picked would put you below the energy your body uses at rest, so Plate set the target there instead.'
                  : 'The pace you picked would fall below a safe daily minimum, so Plate set the target there instead.'}{' '}
                You&rsquo;ll lose about{' '}
                <strong className="font-semibold">
                  {Math.abs(
                    metric
                      ? preview.effectiveWeeklyRateKg
                      : preview.effectiveWeeklyRateKg / 0.45359237,
                  ).toFixed(2)}{' '}
                  {metric ? 'kg' : 'lbs'}
                </strong>{' '}
                a week. Moving more raises this.
              </p>
            )}

            <details className="card p-4">
              <summary className="cursor-pointer text-[15px] font-semibold">
                How this was calculated
              </summary>
              <div className="mt-3 flex flex-col gap-2 text-[14px] text-ink-muted">
                <Row label="Resting burn (Mifflin–St Jeor)" value={`${formatKcal(preview.bmr)} cal`} />
                <Row label="With activity" value={`${formatKcal(preview.tdee)} cal`} />
                <Row
                  label="Weekly pace"
                  value={`${preview.weeklyRateKg > 0 ? '+' : ''}${preview.weeklyRateKg.toFixed(2)} kg`}
                />
                <p className="pt-1 text-[13px]">
                  Activity multipliers are a common convention rather than a measured value, so
                  treat this as a starting estimate. Plate replaces it with your real expenditure
                  once it has a few weeks of weight and food data.
                </p>
              </div>
            </details>
          </Step>
        )}
      </div>

      <button type="button" className="btn-primary" onClick={next} disabled={!canAdvance || pending}>
        {pending ? 'Saving…' : step === STEPS.length - 1 ? 'Start tracking' : 'Continue'}
      </button>
    </div>
  )
}

const inputClass =
  'h-14 w-full rounded-2xl border border-line bg-card px-4 text-ink outline-none focus-visible:border-ink'

function Step({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">{title}</h1>
        <p className="label-muted">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * inputmode="decimal" rather than type="number": the native number input has
 * spinners, rejects some locale decimal separators, and returns "" for
 * anything it considers invalid.
 */
function NumberInput({
  value,
  onChange,
  step = 1,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      enterKeyHint="next"
      autoComplete="off"
      className={inputClass}
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, '')
        const n = Number(raw)
        if (Number.isFinite(n)) onChange(step < 1 ? n : Math.round(n))
      }}
    />
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex gap-1 rounded-full bg-fill p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-11 flex-1 rounded-full text-[15px] font-semibold transition-colors ${
            value === o.value ? 'bg-card text-ink shadow-[var(--shadow-card)]' : 'text-ink-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className="font-semibold text-ink tabular">{value}</span>
    </div>
  )
}
