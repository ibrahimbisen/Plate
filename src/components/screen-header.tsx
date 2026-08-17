'use client'

import { useRouter } from 'next/navigation'

import { ChevronLeft } from './icons'

/**
 * Standalone PWAs have no browser chrome, so every pushed screen supplies its
 * own back affordance. Falls back to a known route when there is no history to
 * pop (a cold start straight into a deep link).
 */
export function ScreenHeader({
  title,
  fallbackHref = '/',
  action,
}: {
  title?: string
  fallbackHref?: string
  action?: React.ReactNode
}) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-1 flex items-center gap-3 bg-page/85 px-4 py-3 backdrop-blur-xl">
      <button
        type="button"
        aria-label="Back"
        onClick={() => {
          if (window.history.length > 1) router.back()
          else router.push(fallbackHref)
        }}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fill"
      >
        <ChevronLeft size={20} />
      </button>
      {title && <h1 className="flex-1 truncate text-center text-[17px] font-semibold">{title}</h1>}
      <div className="flex h-10 min-w-10 shrink-0 items-center justify-end">{action}</div>
    </header>
  )
}
