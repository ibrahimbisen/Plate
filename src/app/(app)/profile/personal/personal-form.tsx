'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { updatePersonalDetails } from '@/app/actions/settings'
import { ChevronRight } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { cmToIn, formatHeight, formatWeight, inToCm } from '@/lib/metrics'

type Initial = {
  sex: 'male' | 'female'
  birthDate: string
  heightCm: number
  goalWeightKg: number
  dailyStepGoal: number
  units: 'imperial' | 'metric'
}

export function PersonalForm({ initial }: { initial: Initial }) {
  const [state, setState] = useState(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [, start] = useTransition()

  function save<K extends keyof Initial>(key: K, value: Initial[K]) {
    setState((s) => ({ ...s, [key]: value }))
    start(() => void updatePersonalDetails({ [key]: value } as never))
  }

  const metric = state.units === 'metric'
  const totalIn = Math.round(cmToIn(state.heightCm))

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ScreenHeader title="Personal Details" fallbackHref="/profile" />

      <Link href="/progress/weight" className="card flex items-center justify-between p-5">
        <span>
          <span className="block label-muted">Goal weight</span>
          <span className="block text-[24px] font-bold tabular">
            {state.goalWeightKg ? formatWeight(state.goalWeightKg, state.units) : 'Not set'}
          </span>
        </span>
        <ChevronRight size={20} className="text-ink-muted" />
      </Link>

      <section className="card overflow-hidden">
        <Row label="Units">
          <div className="flex gap-1 rounded-full bg-fill p-0.5">
            {(['imperial', 'metric'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => save('units', u)}
                className={`h-8 rounded-full px-3 text-[14px] font-semibold ${
                  state.units === u ? 'bg-card text-ink' : 'text-ink-muted'
                }`}
              >
                {u === 'imperial' ? 'lbs' : 'kg'}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Height">
          {editing === 'height' ? (
            metric ? (
              <NumberField
                value={state.heightCm}
                suffix="cm"
                onCommit={(v) => {
                  save('heightCm', v)
                  setEditing(null)
                }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <NumberField
                  value={Math.floor(totalIn / 12)}
                  suffix="ft"
                  onCommit={(ft) => {
                    save('heightCm', inToCm(ft * 12 + (totalIn % 12)))
                    setEditing(null)
                  }}
                />
                <NumberField
                  value={totalIn % 12}
                  suffix="in"
                  onCommit={(inch) => {
                    save('heightCm', inToCm(Math.floor(totalIn / 12) * 12 + inch))
                    setEditing(null)
                  }}
                />
              </div>
            )
          ) : (
            <Value onClick={() => setEditing('height')}>
              {formatHeight(state.heightCm, state.units)}
            </Value>
          )}
        </Row>

        <Row label="Date of birth">
          <input
            type="date"
            value={state.birthDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => save('birthDate', e.target.value)}
            className="h-10 rounded-full bg-fill px-3 text-[15px] font-semibold outline-none"
          />
        </Row>

        <Row label="Sex">
          <div className="flex gap-1 rounded-full bg-fill p-0.5">
            {(['male', 'female'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => save('sex', s)}
                className={`h-8 rounded-full px-3 text-[14px] font-semibold capitalize ${
                  state.sex === s ? 'bg-card text-ink' : 'text-ink-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Daily step goal">
          {editing === 'steps' ? (
            <NumberField
              value={state.dailyStepGoal}
              suffix="steps"
              onCommit={(v) => {
                save('dailyStepGoal', v)
                setEditing(null)
              }}
            />
          ) : (
            <Value onClick={() => setEditing('steps')}>
              {state.dailyStepGoal.toLocaleString('en-US')} steps
            </Value>
          )}
        </Row>
      </section>

      <p className="label-muted text-[13px]">
        Height, age and sex feed the calorie calculation. Changing them does not rewrite past days
        — update your goals from Profile if you want new targets.
      </p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-4 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-line">
      <span className="text-[16px] font-medium">{label}</span>
      {children}
    </div>
  )
}

function Value({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[16px] font-semibold tabular">
      {children}
    </button>
  )
}

function NumberField({
  value,
  suffix,
  onCommit,
}: {
  value: number
  suffix: string
  onCommit: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  return (
    <span className="flex items-center gap-1.5">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
        onBlur={() => onCommit(Number(draft) || value)}
        inputMode="decimal"
        enterKeyHint="done"
        className="h-10 w-20 rounded-xl border border-line bg-card-muted text-center tabular outline-none focus-visible:border-ink"
      />
      <span className="text-[14px] text-ink-muted">{suffix}</span>
    </span>
  )
}
