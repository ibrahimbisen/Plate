'use client'

import { useEffect, useState, useTransition } from 'react'

import { updatePreferences } from '@/app/actions/settings'
import { ScreenHeader } from '@/components/screen-header'
import type { Preferences } from '@/db/schema'

type Appearance = 'system' | 'light' | 'dark'

const TOGGLES = [
  {
    key: 'addBurnedCalories' as const,
    title: 'Add burned calories',
    detail: 'Add burned calories back to your daily goal',
  },
  {
    key: 'rolloverCalories' as const,
    title: 'Rollover calories',
    detail: "Add up to 200 left over calories from yesterday into today's daily goal",
  },
  {
    key: 'autoAdjustMacros' as const,
    title: 'Auto adjust macros',
    detail:
      'When editing calories or macronutrients, automatically adjust the other values proportionally',
  },
  {
    key: 'badgeCelebrations' as const,
    title: 'Badge celebrations',
    detail: 'Show a full-screen animation when you unlock a new badge',
  },
]

export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [state, setState] = useState(initial)
  const [, start] = useTransition()

  // Appearance is applied instantly on the client and mirrored to localStorage,
  // which is what the inline script in the root layout reads before first paint.
  useEffect(() => {
    const apply = () => {
      const dark =
        state.appearance === 'dark' ||
        (state.appearance === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    localStorage.setItem('calai-appearance', state.appearance)
    apply()

    if (state.appearance !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [state.appearance])

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setState((s) => ({ ...s, [key]: value }))
    start(() => void updatePreferences({ [key]: value } as never))
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ScreenHeader title="Preferences" fallbackHref="/profile" />

      <section className="card flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-[19px] font-bold">Appearance</h2>
          <p className="label-muted text-[14px]">Choose light, dark, or system appearance</p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {(['system', 'light', 'dark'] as Appearance[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => set('appearance', mode)}
              aria-pressed={state.appearance === mode}
              className={`flex flex-col items-center gap-2 rounded-tile border-2 p-3 transition-colors ${
                state.appearance === mode ? 'border-ink' : 'border-line'
              }`}
            >
              <ThemeSwatch mode={mode} />
              <span className="text-[14px] font-semibold capitalize">{mode}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        {TOGGLES.map((t, i) => (
          <div
            key={t.key}
            className={`flex items-start gap-4 p-4 ${i > 0 ? 'border-t border-line' : ''}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold">{t.title}</p>
              <p className="label-muted text-[14px]">{t.detail}</p>
            </div>
            <Toggle
              checked={Boolean(state[t.key])}
              label={t.title}
              onChange={(v) => set(t.key, v as never)}
            />
          </div>
        ))}
      </section>

      <p className="label-muted px-1 text-[13px]">
        Burned calories and rollover both change the number on your Home screen straight away.
      </p>
    </div>
  )
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
        checked ? 'bg-ink' : 'bg-fill-strong'
      }`}
    >
      <span
        className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}

/** Miniature of the Home screen, matching the picker in the reference app. */
function ThemeSwatch({ mode }: { mode: Appearance }) {
  const dark = mode === 'dark'
  const bg = dark ? '#1c1c1e' : '#ffffff'
  const line = dark ? '#3a3a3c' : '#e9e9ee'

  const body = (
    <>
      <rect x="6" y="6" width="26" height="5" rx="2.5" fill={line} />
      <circle cx="46" cy="14" r="7" fill="none" stroke={line} strokeWidth="2.5" />
      <rect x="6" y="24" width="14" height="12" rx="3" fill={line} />
      <rect x="23" y="24" width="14" height="12" rx="3" fill={line} />
      <rect x="40" y="24" width="14" height="12" rx="3" fill={line} />
    </>
  )

  return (
    <svg viewBox="0 0 60 42" className="w-full rounded-lg" aria-hidden="true">
      <rect width="60" height="42" rx="6" fill={bg} />
      {mode === 'system' && <rect x="30" width="30" height="42" fill="#1c1c1e" />}
      {body}
      {mode === 'system' && (
        <g>
          <rect x="36" y="24" width="14" height="12" rx="3" fill="#3a3a3c" />
          <rect x="36" y="6" width="18" height="5" rx="2.5" fill="#3a3a3c" />
        </g>
      )}
      <rect x="0.5" y="0.5" width="59" height="41" rx="5.5" fill="none" stroke={line} />
    </svg>
  )
}
