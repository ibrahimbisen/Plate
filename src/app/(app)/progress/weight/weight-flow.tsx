'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { logWeight } from '@/app/actions/activity'
import { ScreenHeader } from '@/components/screen-header'
import { formatLongDate } from '@/lib/date'
import { formatWeight, kgToLb } from '@/lib/metrics'

export function WeightFlow({
  units,
  entries,
}: {
  units: 'imperial' | 'metric'
  entries: { localDate: string; weightKg: number }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(entries.length === 0)
  const latest = entries[0]
  const [value, setValue] = useState(
    latest ? String(Math.round((units === 'imperial' ? kgToLb(latest.weightKg) : latest.weightKg) * 10) / 10) : '',
  )

  const first = entries.at(-1)
  const change = latest && first ? latest.weightKg - first.weightKg : 0

  return (
    <div className="flex min-h-[85svh] flex-col gap-5 pb-4">
      <ScreenHeader title="Weight History" fallbackHref="/progress" />

      <div className="flex flex-col items-center gap-1 py-2 text-center">
        {latest ? (
          <>
            <p className="label-muted text-[15px]">
              Last weigh-in: {formatLongDate(latest.localDate)}
            </p>
            <p className="text-hero tabular">{formatWeight(latest.weightKg, units)}</p>
            {first && first.localDate !== latest.localDate && (
              <p className="label-muted">
                {change === 0
                  ? 'No change'
                  : `${change > 0 ? '+' : ''}${
                      units === 'imperial' ? kgToLb(change).toFixed(1) : change.toFixed(1)
                    } ${units === 'imperial' ? 'lbs' : 'kg'}`}{' '}
                since {formatLongDate(first.localDate)}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-[19px] font-semibold">No weigh-ins yet</p>
            <p className="label-muted max-w-[30ch]">
              Weigh yourself at a consistent time — the trend line smooths out the day-to-day noise.
            </p>
          </>
        )}
      </div>

      {open && (
        <div className="card flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Today&rsquo;s weight ({units === 'imperial' ? 'lbs' : 'kg'})
            </span>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              enterKeyHint="done"
              className="h-16 w-full rounded-2xl border border-line bg-card-muted px-4 text-[26px] font-bold tabular outline-none focus-visible:border-ink"
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={pending || !Number(value)}
            onClick={() =>
              start(async () => {
                await logWeight(Number(value), units)
                setOpen(false)
                router.refresh()
              })
            }
          >
            {pending ? 'Saving…' : 'Save weigh-in'}
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="section-title">History</h2>
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li key={e.localDate} className="card flex items-center justify-between p-4">
                <span className="text-[17px] font-semibold tabular">
                  {formatWeight(e.weightKg, units)}
                </span>
                <span className="label-muted text-[14px]">{formatLongDate(e.localDate)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!open && (
        <div className="sticky bottom-0 mt-auto bg-page/85 py-3 backdrop-blur-xl">
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            Log weight
          </button>
        </div>
      )}
    </div>
  )
}
