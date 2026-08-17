/**
 * The ring that appears on the calories card, each macro tile, and the exercise
 * preview. Pure SVG so it works in a Server Component and costs nothing.
 *
 * `progress` is 0-1 and is clamped: going over goal fills the ring completely
 * rather than wrapping around a second time.
 */
export function ProgressRing({
  progress,
  size = 96,
  stroke = 10,
  color = 'var(--color-ink)',
  track = 'var(--color-track)',
  children,
  className,
}: {
  progress: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: React.ReactNode
  className?: string
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  return (
    <div
      className={`relative grid shrink-0 place-items-center ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - clamped)}
            style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/** The dashed / colored day ring in the week strip. */
export function DayRing({
  state,
  day,
  selected,
  size = 44,
}: {
  state: 'dotted' | 'green' | 'yellow' | 'red' | 'future'
  day: number
  selected: boolean
  size?: number
}) {
  const stroke = 2
  const r = (size - stroke) / 2
  const color =
    state === 'green'
      ? 'var(--color-good)'
      : state === 'yellow'
        ? 'var(--color-warn)'
        : state === 'red'
          ? 'var(--color-bad)'
          : state === 'future'
            ? 'var(--color-ink-faint)'
            : 'var(--color-ink-faint)'

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={selected ? 'var(--color-ink)' : color}
          strokeWidth={selected ? 2.5 : stroke}
          strokeDasharray={state === 'dotted' && !selected ? '4 4' : undefined}
        />
      </svg>
      <span
        className={`absolute text-[17px] font-semibold tabular ${
          state === 'future' ? 'text-ink-faint' : 'text-ink'
        }`}
      >
        {day}
      </span>
    </div>
  )
}
