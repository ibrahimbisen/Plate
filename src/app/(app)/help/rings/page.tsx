import { ScreenHeader } from '@/components/screen-header'
import { requireUser } from '@/lib/dal'

export const metadata = { title: 'Ring colours · Cal AI' }

const LEGEND = [
  {
    color: 'var(--color-good)',
    title: 'Green',
    detail: 'Up to 100 calories over your target',
    dashed: false,
  },
  {
    color: 'var(--color-warn)',
    title: 'Yellow',
    detail: '100–200 calories over your target',
    dashed: false,
  },
  {
    color: 'var(--color-bad)',
    title: 'Red',
    detail: 'More than 200 calories over your target',
    dashed: false,
  },
  {
    color: 'var(--color-ink-faint)',
    title: 'Dotted',
    detail: 'Nothing logged that day',
    dashed: true,
  },
]

export default async function RingsHelpPage() {
  await requireUser()

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ScreenHeader fallbackHref="/profile" />
      <h1 className="text-title">Ring Colours Explained</h1>

      <p className="label-muted">
        The ring around each date on the Home screen shows how close you were to your calorie
        target that day.
      </p>

      <ul className="flex flex-col gap-4">
        {LEGEND.map((item) => (
          <li key={item.title} className="flex items-center gap-4">
            <svg width="44" height="44" aria-hidden="true" className="shrink-0">
              <circle
                cx="22"
                cy="22"
                r="20"
                fill="none"
                stroke={item.color}
                strokeWidth="2.5"
                strokeDasharray={item.dashed ? '4 4' : undefined}
              />
            </svg>
            <div>
              <p className="text-[17px] font-semibold">{item.title}</p>
              <p className="label-muted text-[15px]">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="label-muted text-[14px]">
        Going a little over on one day is normal and the ring is not a judgement — the weekly trend
        on Progress is the number that actually moves your weight.
      </p>
    </div>
  )
}
