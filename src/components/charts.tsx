/**
 * Hand-rolled inline SVG charts.
 *
 * No chart library: there are five fixed forms here, and referencing
 * `var(--color-…)` directly means both themes work with no JS and no re-render.
 *
 * Conventions applied throughout (see the mark specs):
 *   - 2px lines, >=8px markers, thin bars with rounded data-ends
 *   - a 2px surface-coloured gap between adjacent fills
 *   - recessive grid and axes; values in ink tokens, never in the series colour
 *   - a legend whenever there are two series, plus direct labels
 */

const AXIS = 'var(--color-ink-faint)'
const GRID = 'var(--color-line)'
const LABEL = 'var(--color-ink-muted)'

// ---------------------------------------------------------------------------
// Sparkline — the tiny inline trace in the change tables
// ---------------------------------------------------------------------------

export function Sparkline({
  values,
  width = 44,
  height = 22,
  color = 'var(--color-ink-muted)',
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line
          x1={2}
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = (width - 4) / (values.length - 1)

  const d = values
    .map((v, i) => {
      const x = 2 + i * step
      const y = height - 2 - ((v - min) / span) * (height - 4)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Weight over time — one series, so no legend; the title names it
// ---------------------------------------------------------------------------

export type WeightPoint = { date: string; weightKg: number | null; trendKg: number }

export function WeightChart({
  points,
  goalKg,
  format,
  height = 200,
}: {
  points: WeightPoint[]
  goalKg: number | null
  format: (kg: number) => string
  height?: number
}) {
  if (points.length === 0) {
    return <EmptyPlot height={height} message="Log a weight to start the chart." />
  }

  const values = points.flatMap((p) => [p.trendKg, ...(p.weightKg != null ? [p.weightKg] : [])])
  if (goalKg != null) values.push(goalKg)

  let min = Math.min(...values)
  let max = Math.max(...values)
  const pad = Math.max(1, (max - min) * 0.15)
  min -= pad
  max += pad
  const span = max - min || 1

  const W = 320
  const H = height
  const PAD_L = 38
  const PAD_R = 8
  const PAD_T = 10
  const PAD_B = 22
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B

  const x = (i: number) => PAD_L + (i / Math.max(1, points.length - 1)) * plotW
  const y = (v: number) => PAD_T + (1 - (v - min) / span) * plotH

  const trendPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.trendKg).toFixed(1)}`)
    .join(' ')

  const ticks = [max, (max + min) / 2, min]
  const last = points[points.length - 1]

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Weight trend, currently ${format(last.trendKg)}`}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={y(t)} x2={W - PAD_R} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={4} y={y(t) + 4} fontSize={11} fill={LABEL}>
              {format(t)}
            </text>
          </g>
        ))}

        {goalKg != null && goalKg > min && goalKg < max && (
          <g>
            <line
              x1={PAD_L}
              y1={y(goalKg)}
              x2={W - PAD_R}
              y2={y(goalKg)}
              stroke="var(--color-good)"
              strokeWidth={2}
              strokeDasharray="5 4"
              opacity={0.75}
            />
            <text x={W - PAD_R} y={y(goalKg) - 5} fontSize={11} fill={LABEL} textAnchor="end">
              goal
            </text>
          </g>
        )}

        {/* Actual readings sit under the trend as recessive dots — the trend is
            the story, the scale noise is context. */}
        {points.map((p, i) =>
          p.weightKg != null ? (
            <circle key={i} cx={x(i)} cy={y(p.weightKg)} r={2.5} fill={AXIS} opacity={0.55} />
          ) : null,
        )}

        <path
          d={trendPath}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Direct label on the current value only — never a number per point. */}
        <circle
          cx={x(points.length - 1)}
          cy={y(last.trendKg)}
          r={4.5}
          fill="var(--color-ink)"
          stroke="var(--color-card)"
          strokeWidth={2}
        />
      </svg>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Daily average calories — one series of bars
// ---------------------------------------------------------------------------

export function DailyCaloriesChart({
  days,
  goal,
  height = 180,
}: {
  days: { label: string; value: number }[]
  goal?: number | null
  height?: number
}) {
  if (days.every((d) => d.value === 0)) {
    return <EmptyPlot height={height} message="This will update as you log more food." />
  }

  const W = 320
  const H = height
  const PAD_T = 14
  const PAD_B = 24
  const plotH = H - PAD_T - PAD_B
  const max = Math.max(...days.map((d) => d.value), goal ?? 0) * 1.12 || 1

  const slot = W / days.length
  const barW = Math.min(26, slot * 0.55)

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Calories by day">
        {goal != null && goal > 0 && (
          <line
            x1={0}
            y1={PAD_T + (1 - goal / max) * plotH}
            x2={W}
            y2={PAD_T + (1 - goal / max) * plotH}
            stroke={GRID}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {days.map((d, i) => {
          const h = (d.value / max) * plotH
          const cx = i * slot + slot / 2
          return (
            <g key={i}>
              {d.value > 0 && (
                <rect
                  x={cx - barW / 2}
                  y={PAD_T + plotH - h}
                  width={barW}
                  height={Math.max(h, 3)}
                  rx={4} /* rounded data-end, square against the baseline */
                  fill="var(--color-ink)"
                  opacity={0.85}
                />
              )}
              <text x={cx} y={H - 7} fontSize={11} fill={LABEL} textAnchor="middle">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Weekly energy — two series, so a legend AND direct labels are required
// ---------------------------------------------------------------------------

export function WeeklyEnergyChart({
  days,
  height = 190,
}: {
  days: { label: string; burned: number; consumed: number }[]
  height?: number
}) {
  const max = Math.max(...days.flatMap((d) => [d.burned, d.consumed]), 1) * 1.15

  const W = 320
  const H = height
  const PAD_T = 12
  const PAD_B = 26
  const plotH = H - PAD_T - PAD_B
  const slot = W / days.length
  const barW = Math.min(11, slot * 0.26)
  const GAP = 2 // surface-coloured gap between the paired bars

  const gridLines = [0.25, 0.5, 0.75, 1]

  return (
    <figure className="m-0 flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Calories burned and consumed by day"
      >
        {gridLines.map((g) => (
          <line
            key={g}
            x1={0}
            y1={PAD_T + (1 - g) * plotH}
            x2={W}
            y2={PAD_T + (1 - g) * plotH}
            stroke={GRID}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
        ))}

        {days.map((d, i) => {
          const cx = i * slot + slot / 2
          const bh = (d.burned / max) * plotH
          const ch = (d.consumed / max) * plotH
          return (
            <g key={i}>
              {d.burned > 0 && (
                <rect
                  x={cx - barW - GAP / 2}
                  y={PAD_T + plotH - bh}
                  width={barW}
                  height={Math.max(bh, 3)}
                  rx={4}
                  fill="var(--color-burned)"
                />
              )}
              {d.consumed > 0 && (
                <rect
                  x={cx + GAP / 2}
                  y={PAD_T + plotH - ch}
                  width={barW}
                  height={Math.max(ch, 3)}
                  rx={4}
                  fill="var(--color-consumed)"
                />
              )}
              <text x={cx} y={H - 8} fontSize={11} fill={LABEL} textAnchor="middle">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>

      <figcaption className="flex justify-center gap-5">
        {[
          ['Burned', 'var(--color-burned)'],
          ['Consumed', 'var(--color-consumed)'],
        ].map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5 text-[13px] text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// BMI — a status scale, not a categorical palette
// ---------------------------------------------------------------------------

export function BmiBar({ value, position }: { value: number; position: number }) {
  const segments = [
    { label: 'Underweight', range: '<18.5', color: '#4a86e8', flex: 3.5 },
    { label: 'Healthy', range: '18.5–24.9', color: '#3f9e5a', flex: 6.4 },
    { label: 'Overweight', range: '25.0–29.9', color: '#c08a2e', flex: 5 },
    { label: 'Obese', range: '>30.0', color: '#c2413f', flex: 10 },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div className="flex gap-1" role="img" aria-label={`BMI ${value.toFixed(1)}`}>
          {segments.map((s) => (
            <span
              key={s.label}
              className="h-2.5 rounded-full"
              style={{ flex: s.flex, background: s.color }}
            />
          ))}
        </div>
        {/* Marker gets a surface ring so it reads against any segment. */}
        <span
          className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-[var(--color-card)]"
          style={{ left: `${position * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {segments.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1 text-[12px] font-medium text-ink-soft">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="text-[11px] text-ink-muted tabular">{s.range}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyPlot({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-center"
      style={{ height }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-fill">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="12" width="4" height="7" rx="1" fill="var(--color-ink-muted)" />
          <rect x="10" y="8" width="4" height="11" rx="1" fill="var(--color-ink-muted)" />
          <rect x="16" y="14" width="4" height="5" rx="1" fill="var(--color-ink-muted)" />
        </svg>
      </div>
      <p className="text-[16px] font-semibold">No data to show</p>
      <p className="label-muted text-[14px]">{message}</p>
    </div>
  )
}
