'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { deleteLog, updateLog } from '@/app/actions/log'
import { totalsFromItems, type LogItemInput } from '@/lib/nutrition'
import { PencilIcon, TrashIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { formatKcal } from '@/lib/metrics'

type LogHeader = {
  id: string
  name: string
  brand: string | null
  photoPath: string | null
  quantity: number
  loggedAt: number
  healthScore: number | null
  kcalLow: number | null
  kcalHigh: number | null
  aiConfidence: number | null
  scaleReference: string | null
  assumptions: string[]
}

/**
 * The editable result screen.
 *
 * Grams per ingredient are the primary control. Published evaluations put
 * vision-model portion error around 28%, so letting someone drag "rice: 180 g"
 * to 250 g is the single largest accuracy win available — and totals recompute
 * live from those grams rather than from anything the model asserted.
 */
export function FoodDetail({
  log,
  items: initialItems,
  timeZone,
}: {
  log: LogHeader
  items: LogItemInput[]
  timeZone: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const [name, setName] = useState(log.name)
  const [editingName, setEditingName] = useState(false)
  const [quantity, setQuantity] = useState(log.quantity)
  const [items, setItems] = useState(initialItems)
  const [page, setPage] = useState(0)

  const totals = useMemo(() => totalsFromItems(items, quantity), [items, quantity])

  const dirty =
    name !== log.name ||
    quantity !== log.quantity ||
    items.some((it, i) => it.grams !== initialItems[i]?.grams)

  function setGrams(index: number, grams: number) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, grams: Math.max(0, grams) } : it)))
  }

  function save() {
    start(async () => {
      await updateLog(log.id, { name, quantity, items })
      router.push('/')
    })
  }

  function remove() {
    start(async () => {
      await deleteLog(log.id)
      router.push('/')
    })
  }

  const hasRange = log.kcalLow != null && log.kcalHigh != null && log.kcalHigh > log.kcalLow

  return (
    <div className="flex min-h-[85svh] flex-col gap-4 pb-4">
      <ScreenHeader
        title="Nutrition"
        action={
          <button
            type="button"
            onClick={remove}
            aria-label="Delete entry"
            disabled={pending}
            className="grid h-10 w-10 place-items-center rounded-full bg-fill text-bad"
          >
            <TrashIcon size={18} />
          </button>
        }
      />

      {log.photoPath && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/photos/${encodeURIComponent(log.photoPath)}`}
          alt=""
          className="h-56 w-full rounded-card object-cover"
        />
      )}

      <div className="card flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="chip">
            {new Date(log.loggedAt).toLocaleTimeString('en-US', {
              timeZone,
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
          <div className="flex items-center gap-1 rounded-full border border-line px-1">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(0.25, Math.round((q - 0.25) * 100) / 100))}
              className="grid h-9 w-9 place-items-center text-[20px]"
            >
              −
            </button>
            <span className="min-w-8 text-center text-[16px] font-semibold tabular">
              {quantity % 1 === 0 ? quantity : quantity.toFixed(2)}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => Math.round((q + 0.25) * 100) / 100)}
              className="grid h-9 w-9 place-items-center text-[20px]"
            >
              +
            </button>
          </div>
        </div>

        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setEditingName(false)}
            className="w-full rounded-2xl border border-line bg-card-muted px-3 py-2 text-[24px] font-bold outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="flex items-center gap-2 text-left text-[26px] font-bold leading-tight tracking-[-0.02em]"
          >
            {name || 'Tap to name'}
            <PencilIcon size={17} className="shrink-0 text-ink-muted" />
          </button>
        )}

        {/* Nutrition carousel: macros, then the secondary panel */}
        <div
          className="snap-row"
          onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          <div className="snap-page flex flex-col gap-3">
            <div className="rounded-tile border border-line p-4">
              <p className="label-muted text-[14px]">Calories</p>
              <p className="text-stat tabular">{formatKcal(totals.kcal)}</p>
              {hasRange && (
                <p className="mt-0.5 text-[13px] text-ink-muted tabular">
                  roughly {formatKcal((log.kcalLow! * quantity) / log.quantity)}–
                  {formatKcal((log.kcalHigh! * quantity) / log.quantity)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Protein" value={`${Math.round(totals.protein)}g`} color="var(--color-protein)" />
              <Metric label="Carbs" value={`${Math.round(totals.carbs)}g`} color="var(--color-carbs)" />
              <Metric label="Fats" value={`${Math.round(totals.fat)}g`} color="var(--color-fat)" />
            </div>
          </div>

          <div className="snap-page flex flex-col gap-3 pl-3">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Fiber" value={`${Math.round(totals.fiber)}g`} />
              <Metric label="Sugar" value={`${Math.round(totals.sugar)}g`} />
              <Metric label="Sodium" value={`${Math.round(totals.sodiumMg)}mg`} />
            </div>
            {log.healthScore != null && (
              <div className="rounded-tile border border-line p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[15px] font-semibold">Health score</p>
                  <p className="text-[15px] font-bold tabular">
                    {log.healthScore.toFixed(1)}/10
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-track">
                  <div
                    className="h-full rounded-full bg-good"
                    style={{ width: `${(log.healthScore / 10) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-[12px] text-ink-muted">
                  Based on the Nutri-Score 2023 algorithm.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {[0, 1].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${page === i ? 'bg-ink' : 'bg-ink-faint'}`}
            />
          ))}
        </div>
      </div>

      {/* Ingredients — the editable part */}
      <section className="flex flex-col gap-3">
        <h2 className="section-title">Ingredients</h2>
        <p className="label-muted text-[14px]">
          Adjust any weight and the totals update. Portion size is where estimates go wrong most.
        </p>

        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={index} className="card flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                  {item.name}
                  {item.isHiddenFat && (
                    <span className="ml-2 text-[12px] font-normal text-ink-muted">
                      cooking fat
                    </span>
                  )}
                </p>
                <p className="text-[13px] text-ink-muted tabular">
                  {formatKcal((item.kcal100 * item.grams * quantity) / 100)} cal
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  value={String(Math.round(item.grams))}
                  onChange={(e) => setGrams(index, Number(e.target.value.replace(/[^0-9]/g, '')))}
                  inputMode="numeric"
                  aria-label={`Grams of ${item.name}`}
                  className="h-11 w-16 rounded-xl border border-line bg-card-muted text-center outline-none focus-visible:border-ink"
                />
                <span className="text-[14px] text-ink-muted">g</span>
              </div>
            </li>
          ))}
        </ul>

        {(log.scaleReference || log.assumptions.length > 0) && (
          <details className="card p-4">
            <summary className="cursor-pointer text-[15px] font-semibold">
              How this was estimated
            </summary>
            <div className="mt-2 flex flex-col gap-1.5 text-[14px] text-ink-muted">
              {log.scaleReference && <p>Scale reference: {log.scaleReference}</p>}
              {log.assumptions.map((a, i) => (
                <p key={i}>{a}</p>
              ))}
            </div>
          </details>
        )}
      </section>

      <div className="mt-auto flex gap-3 pt-4">
        <button
          type="button"
          className="btn-primary"
          onClick={save}
          disabled={pending || !dirty}
        >
          {pending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-tile border border-line p-3">
      <div className="flex items-center gap-1.5">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        <p className="text-[13px] text-ink-muted">{label}</p>
      </div>
      <p className="mt-0.5 text-[20px] font-bold tabular">{value}</p>
    </div>
  )
}
