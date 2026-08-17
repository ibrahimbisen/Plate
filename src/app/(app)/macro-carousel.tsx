'use client'

import { useRef, useState } from 'react'

import { ChevronUpDown, FlameIcon } from '@/components/icons'
import { ProgressRing } from '@/components/progress-ring'
import { formatKcal } from '@/lib/metrics'

type Macro = {
  key: 'protein' | 'carbs' | 'fat'
  label: string
  left: number
  goal: number
  eaten: number
  color: string
  glyph: string
}

/**
 * The Home stats block: a 3-page snap carousel.
 *   page 1 — calories left + the three macro tiles
 *   page 2 — what has been eaten so far
 *   page 3 — the budget breakdown (goal, burned, rollover)
 */
export function MacroCarousel({
  left,
  eatenRatio,
  burnedBonus,
  rollover,
  eaten,
  budget,
  macros,
}: {
  left: number
  eatenRatio: number
  burnedBonus: number
  rollover: number
  eaten: number
  budget: number
  macros: Macro[]
}) {
  const [page, setPage] = useState(0)
  const [showEaten, setShowEaten] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  function onScroll() {
    const el = scroller.current
    if (!el) return
    setPage(Math.round(el.scrollLeft / el.clientWidth))
  }

  const goalCalories = budget - burnedBonus - rollover

  return (
    <section className="flex flex-col gap-3">
      <div ref={scroller} onScroll={onScroll} className="snap-row -mx-4 px-4">
        {/* Page 1 — the headline number */}
        <div className="snap-page flex flex-col gap-3 pr-0">
          <div className="card flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-hero tabular">
                {showEaten ? formatKcal(eaten) : formatKcal(Math.abs(left))}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEaten((v) => !v)}
                  className="flex items-center gap-1 text-[16px] text-ink-muted"
                >
                  {showEaten ? 'Calories eaten' : left < 0 ? 'Calories over' : 'Calories left'}
                  <ChevronUpDown size={16} />
                </button>
                {burnedBonus > 0 && (
                  <span className="chip">
                    <FlameIcon size={13} filled className="text-[#FF8A3D]" />+{formatKcal(burnedBonus)}
                  </span>
                )}
              </div>
            </div>
            <ProgressRing
              progress={eatenRatio}
              size={104}
              stroke={11}
              color={left < 0 ? 'var(--color-bad)' : 'var(--color-ink)'}
            >
              <FlameIcon size={30} filled className="text-ink" />
            </ProgressRing>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {macros.map((m) => {
              const ratio = m.goal > 0 ? m.eaten / m.goal : 0
              return (
                <div key={m.key} className="card flex flex-col gap-3 p-4">
                  <div>
                    <p className="text-[24px] font-bold leading-tight tracking-[-0.02em] tabular">
                      {Math.round(Math.abs(m.left))}g
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      {m.left < 0 ? m.label.replace('left', 'over') : m.label}
                    </p>
                  </div>
                  <ProgressRing
                    progress={ratio}
                    size={62}
                    stroke={7}
                    color={m.color}
                    className="mx-auto"
                  >
                    <span className="text-[18px] leading-none">{m.glyph}</span>
                  </ProgressRing>
                </div>
              )
            })}
          </div>
        </div>

        {/* Page 2 — consumed so far */}
        <div className="snap-page pl-3">
          <div className="card flex h-full flex-col gap-4 p-5">
            <h3 className="text-[17px] font-semibold">Eaten today</h3>
            <div className="flex flex-col gap-3">
              <StatLine label="Calories" value={`${formatKcal(eaten)} cal`} />
              {macros.map((m) => (
                <StatLine
                  key={m.key}
                  label={m.label.replace(' left', '')}
                  value={`${Math.round(m.eaten)}g of ${m.goal}g`}
                  ratio={m.goal > 0 ? m.eaten / m.goal : 0}
                  color={m.color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Page 3 — how the budget was built */}
        <div className="snap-page pl-3">
          <div className="card flex h-full flex-col gap-4 p-5">
            <h3 className="text-[17px] font-semibold">Today&rsquo;s budget</h3>
            <div className="flex flex-col gap-3">
              <StatLine label="Daily goal" value={`${formatKcal(goalCalories)} cal`} />
              <StatLine
                label="Exercise added back"
                value={burnedBonus > 0 ? `+${formatKcal(burnedBonus)} cal` : 'Off'}
              />
              <StatLine
                label="Rolled over from yesterday"
                value={rollover > 0 ? `+${formatKcal(rollover)} cal` : 'None'}
              />
              <div className="h-px bg-line" />
              <StatLine label="Total budget" value={`${formatKcal(budget)} cal`} strong />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              page === i ? 'w-1.5 bg-ink' : 'w-1.5 bg-ink-faint'
            }`}
          />
        ))}
      </div>
    </section>
  )
}

function StatLine({
  label,
  value,
  ratio,
  color,
  strong,
}: {
  label: string
  value: string
  ratio?: number
  color?: string
  strong?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={strong ? 'text-[16px] font-semibold' : 'label-muted'}>{label}</span>
        <span className={`tabular ${strong ? 'text-[16px] font-bold' : 'text-[16px] font-semibold'}`}>
          {value}
        </span>
      </div>
      {ratio != null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, background: color }}
          />
        </div>
      )}
    </div>
  )
}
