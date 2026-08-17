'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  logDescribedExercise,
  logManualExercise,
  logStructuredExercise,
} from '@/app/actions/activity'
import { DumbbellIcon, FlameIcon, NoteIcon, RunIcon, SparkleIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { INTENSITY_COPY, type Intensity } from '@/lib/metrics'

type Mode = 'menu' | 'run' | 'lifting' | 'describe' | 'manual'

const DURATIONS = [15, 30, 60, 90]

export function ExerciseFlow({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('menu')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [intensity, setIntensity] = useState<Intensity>('medium')
  const [minutes, setMinutes] = useState(15)
  const [description, setDescription] = useState('')
  const [manualKcal, setManualKcal] = useState('')

  function done() {
    router.push('/')
  }

  if (mode === 'menu') {
    const options = [
      { key: 'run', Icon: RunIcon, title: 'Run', detail: 'Running, jogging, sprinting, etc.' },
      {
        key: 'lifting',
        Icon: DumbbellIcon,
        title: 'Weight lifting',
        detail: 'Machines, free weights, etc.',
      },
      { key: 'describe', Icon: NoteIcon, title: 'Describe', detail: 'Write your workout in text' },
      {
        key: 'manual',
        Icon: FlameIcon,
        title: 'Manual',
        detail: 'Enter exactly how many calories you burned',
      },
    ] as const

    return (
      <div className="flex flex-col gap-5 pb-4">
        <ScreenHeader title="Exercise" />
        <h1 className="text-title">Log Exercise</h1>
        <div className="flex flex-col gap-3">
          {options.map(({ key, Icon, title, detail }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key as Mode)}
              className="card flex items-center gap-4 p-5 text-left transition-transform active:scale-[0.99]"
            >
              <Icon size={26} />
              <div>
                <p className="text-[17px] font-semibold">{title}</p>
                <p className="label-muted text-[14px]">{detail}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (mode === 'run' || mode === 'lifting') {
    const kind = mode
    return (
      <div className="flex min-h-[85svh] flex-col gap-6 pb-4">
        <ScreenHeader title={kind === 'run' ? 'Run' : 'Weight lifting'} />

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-[19px] font-bold">
            <SparkleIcon size={20} /> Set intensity
          </h2>
          <div className="card flex flex-col gap-1 p-4">
            {(['high', 'medium', 'low'] as const).map((level) => {
              const active = intensity === level
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setIntensity(level)}
                  aria-pressed={active}
                  className={`rounded-tile px-3 py-3 text-left transition-colors ${
                    active ? 'bg-fill' : ''
                  }`}
                >
                  <p
                    className={`text-[17px] ${active ? 'font-bold text-ink' : 'font-semibold text-ink-muted'}`}
                  >
                    {level[0].toUpperCase() + level.slice(1)}
                  </p>
                  <p className={`text-[14px] ${active ? 'text-ink-soft' : 'text-ink-muted'}`}>
                    {INTENSITY_COPY[kind][level]}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[19px] font-bold">Duration</h2>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setMinutes(d)}
                className={`h-11 flex-1 rounded-full text-[15px] font-semibold transition-colors ${
                  minutes === d ? 'bg-accent text-accent-ink' : 'border border-line bg-card text-ink'
                }`}
              >
                {d} mins
              </button>
            ))}
          </div>
          <input
            value={String(minutes)}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value.replace(/[^0-9]/g, '')) || 1))}
            inputMode="numeric"
            aria-label="Minutes"
            className="h-14 w-full rounded-2xl border border-line bg-card px-4 outline-none focus-visible:border-ink"
          />
        </section>

        <button
          type="button"
          className="btn-primary mt-auto"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await logStructuredExercise({ kind, intensity, minutes })
              done()
            })
          }
        >
          {pending ? 'Saving…' : 'Continue'}
        </button>
      </div>
    )
  }

  if (mode === 'describe') {
    return (
      <div className="flex min-h-[85svh] flex-col gap-5 pb-4">
        <ScreenHeader title="Describe Exercise" />

        <textarea
          rows={4}
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe workout time, intensity, etc."
          className="w-full rounded-2xl border border-line bg-card p-4 outline-none focus-visible:border-ink"
        />

        <span className="chip w-fit">
          <SparkleIcon size={14} /> Worked out by AI
        </span>

        <div className="rounded-tile bg-fill p-4 text-[15px] text-ink-soft">
          <strong className="font-semibold">Example:</strong> Leisure bike ride for 30 mins, felt
          refreshed
        </div>

        {error && (
          <p role="alert" className="text-[15px] text-bad">
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn-primary mt-auto"
          disabled={pending || !description.trim() || !aiEnabled}
          onClick={() =>
            start(async () => {
              const result = await logDescribedExercise(description.trim())
              if (result.ok) done()
              else setError(result.error)
            })
          }
        >
          {pending ? 'Working it out…' : 'Add Exercise'}
        </button>
        {!aiEnabled && (
          <p className="label-muted text-center text-[14px]">
            AI is not set up on this server — use Manual instead.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-[85svh] flex-col gap-5 pb-4">
      <ScreenHeader title="Manual" />
      <h1 className="text-title">Calories burned</h1>

      <input
        autoFocus
        value={manualKcal}
        onChange={(e) => setManualKcal(e.target.value.replace(/[^0-9]/g, ''))}
        inputMode="numeric"
        placeholder="0"
        aria-label="Calories burned"
        className="h-16 w-full rounded-2xl border border-line bg-card px-4 text-[24px] font-bold tabular outline-none focus-visible:border-ink"
      />

      <button
        type="button"
        className="btn-primary mt-auto"
        disabled={pending || !Number(manualKcal)}
        onClick={() =>
          start(async () => {
            await logManualExercise(Number(manualKcal))
            done()
          })
        }
      >
        {pending ? 'Saving…' : 'Add'}
      </button>
    </div>
  )
}
