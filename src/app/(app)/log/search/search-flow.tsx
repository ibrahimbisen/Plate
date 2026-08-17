'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { createLog } from '@/app/actions/log'
import { FlameIcon, MicIcon, NoteIcon, PlusIcon, SearchIcon } from '@/components/icons'
import { ScreenHeader } from '@/components/screen-header'
import { formatKcal } from '@/lib/metrics'

type FoodResult = {
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

type Recent = {
  name: string
  brand: string | null
  kcal: number
  grams: number
  portionLabel: string
}

export function SearchFlow() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [recent, setRecent] = useState<Recent[]>([])
  const [loading, setLoading] = useState(false)
  const [pending, start] = useTransition()
  const [selected, setSelected] = useState<FoodResult | null>(null)
  const [grams, setGrams] = useState(100)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch('/api/foods')
      .then((r) => r.json())
      .then((j) => setRecent(j.recent ?? []))
      .catch(() => {})
  }, [])

  const search = useCallback((q: string) => {
    abort.current?.abort()
    if (q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    abort.current = controller
    setLoading(true)

    fetch(`/api/foods?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => setResults(j.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Debounced so a fast typist does not spend the Open Food Facts budget
  // (10 search requests per minute per IP).
  useEffect(() => {
    const t = setTimeout(() => search(query), 350)
    return () => clearTimeout(t)
  }, [query, search])

  function logFood(food: FoodResult, g: number) {
    start(async () => {
      await createLog({
        name: food.brand ? `${food.name} · ${food.brand}` : food.name,
        brand: food.brand ?? undefined,
        portionLabel: 'g',
        items: [
          {
            name: food.name,
            grams: g,
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

  function logRecent(item: Recent) {
    start(async () => {
      const grams = item.grams > 0 ? item.grams : 100
      await createLog({
        name: item.name,
        brand: item.brand ?? undefined,
        portionLabel: item.portionLabel,
        items: [{ name: item.name, grams, kcal100: (item.kcal / grams) * 100 }],
      })
      router.push('/')
    })
  }

  return (
    <div className="flex min-h-[85svh] flex-col gap-4 pb-4">
      <ScreenHeader title="Log food" />

      <label className="relative block">
        <SearchIcon
          size={19}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe what you ate"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-14 w-full rounded-2xl border border-line bg-card pl-12 pr-4 outline-none focus-visible:border-ink"
        />
      </label>

      {selected && (
        <div className="card flex flex-col gap-3 p-4">
          <div>
            <p className="text-[17px] font-semibold">{selected.name}</p>
            {selected.brand && <p className="label-muted text-[14px]">{selected.brand}</p>}
          </div>

          {selected.dataQuality === 'suspect' && (
            <p className="rounded-xl bg-fill p-3 text-[13px] text-ink-soft">
              The numbers for this product look inconsistent on Open Food Facts. Worth a check
              against the packet.
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
            {selected.servingGrams && (
              <button
                type="button"
                onClick={() => setGrams(selected.servingGrams!)}
                className="chip ml-auto"
              >
                1 serving ({Math.round(selected.servingGrams)}g)
              </button>
            )}
          </div>

          <p className="text-[15px] tabular">
            <strong className="text-[20px] font-bold">
              {formatKcal((selected.kcal100 * grams) / 100)}
            </strong>{' '}
            cal
            <span className="ml-3 text-ink-muted">
              P {Math.round(((selected.protein100 ?? 0) * grams) / 100)}g · C{' '}
              {Math.round(((selected.carbs100 ?? 0) * grams) / 100)}g · F{' '}
              {Math.round(((selected.fat100 ?? 0) * grams) / 100)}g
            </span>
          </p>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setSelected(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={pending || grams <= 0}
              onClick={() => logFood(selected, grams)}
            >
              {pending ? 'Logging…' : 'Log it'}
            </button>
          </div>
        </div>
      )}

      {query.trim().length >= 2 ? (
        <section className="flex flex-col gap-2">
          {loading && <p className="label-muted">Searching…</p>}
          {!loading && results.length === 0 && (
            <div className="card flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-[16px] font-semibold">Nothing found for &ldquo;{query}&rdquo;</p>
              <p className="label-muted">Add it yourself and it&rsquo;ll be there next time.</p>
              <Link href="/log/manual" className="btn-secondary mt-1">
                Add manually
              </Link>
            </div>
          )}
          {results.map((food) => (
            <button
              key={food.id}
              type="button"
              onClick={() => {
                setSelected(food)
                setGrams(food.servingGrams ?? 100)
              }}
              className="card flex items-center gap-3 p-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold">
                  {food.name}
                  {food.brand && <span className="text-ink-muted"> · {food.brand}</span>}
                </p>
                <p className="flex items-center gap-1 text-[14px] text-ink-muted">
                  <FlameIcon size={13} filled />
                  {formatKcal(food.kcal100)} cal per 100g
                </p>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill">
                <PlusIcon size={18} />
              </span>
            </button>
          ))}
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="section-title">Recently logged</h2>
          {recent.length === 0 ? (
            <p className="label-muted">Anything you log will show up here for one-tap repeats.</p>
          ) : (
            recent.map((item, i) => (
              <button
                key={`${item.name}-${i}`}
                type="button"
                onClick={() => logRecent(item)}
                disabled={pending}
                className="card flex items-center gap-3 p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold">
                    {item.name}
                    {item.brand && <span className="text-ink-muted"> · {item.brand}</span>}
                  </p>
                  <p className="flex items-center gap-1 text-[14px] text-ink-muted">
                    <FlameIcon size={13} filled />
                    {formatKcal(item.kcal)} cal · {item.portionLabel}
                  </p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill">
                  <PlusIcon size={18} />
                </span>
              </button>
            ))
          )}
        </section>
      )}

      <div className="sticky bottom-0 mt-auto flex gap-3 bg-page/85 py-3 backdrop-blur-xl">
        <Link href="/log/manual" className="btn-secondary flex-1">
          <NoteIcon size={18} />
          Manual add
        </Link>
        <Link href="/log/voice" className="btn-secondary flex-1">
          <MicIcon size={18} />
          Voice log
        </Link>
      </div>
    </div>
  )
}
