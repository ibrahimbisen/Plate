import Link from 'next/link'

import { FlameIcon } from '@/components/icons'
import type { FoodLog } from '@/db/schema'
import { formatKcal } from '@/lib/metrics'

function time(ms: number, timeZone?: string) {
  return new Date(ms).toLocaleTimeString('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function EntryRow({ entry }: { entry: FoodLog }) {
  return (
    <li>
      <Link
        href={`/log/${entry.id}`}
        className="card flex items-center gap-3 p-3 transition-transform active:scale-[0.99]"
      >
        {entry.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/photos/${encodeURIComponent(entry.photoPath)}`}
            alt=""
            className="h-[62px] w-[62px] shrink-0 rounded-[16px] object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-[16px] bg-fill text-[26px]">
            🍽️
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{entry.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-muted">
            <span className="flex items-center gap-1">
              <FlameIcon size={14} filled />
              {formatKcal(entry.kcal)} cal
            </span>
            <span className="tabular">{time(entry.loggedAt.getTime())}</span>
          </div>
          <div className="mt-1.5 flex gap-3 text-[13px] text-ink-muted tabular">
            <span>P {Math.round(entry.protein)}g</span>
            <span>C {Math.round(entry.carbs)}g</span>
            <span>F {Math.round(entry.fat)}g</span>
          </div>
        </div>
      </Link>
    </li>
  )
}
