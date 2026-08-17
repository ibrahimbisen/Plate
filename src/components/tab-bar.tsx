'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  BarcodeIcon,
  BookmarkIcon,
  ChartIcon,
  CloseIcon,
  DumbbellIcon,
  HomeIcon,
  MicIcon,
  PersonIcon,
  PlusIcon,
  ScanIcon,
  SearchIcon,
} from './icons'

const TABS = [
  { href: '/', label: 'Home', Icon: HomeIcon },
  { href: '/progress', label: 'Progress', Icon: ChartIcon },
  { href: '/profile', label: 'Profile', Icon: PersonIcon },
]

const ACTIONS = [
  { href: '/log/exercise', label: 'Log exercise', Icon: DumbbellIcon },
  { href: '/log/barcode', label: 'Scan barcode', Icon: BarcodeIcon },
  { href: '/log/search', label: 'Food Database', Icon: SearchIcon },
  { href: '/log/scan', label: 'Scan food', Icon: ScanIcon },
  { href: '/log/voice', label: 'Voice log', Icon: MicIcon },
]

export function TabBar({ initials }: { initials: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Pushing a history entry means the iOS edge-swipe closes the sheet instead
  // of exiting the app — standalone mode has no browser back button.
  useEffect(() => {
    if (!open) return
    const onPop = () => setOpen(false)
    window.history.pushState({ fab: true }, '')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open])

  function close() {
    if (window.history.state?.fab) window.history.back()
    else setOpen(false)
  }

  function go(href: string) {
    close()
    router.push(href)
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={close}
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] animate-[fade_.18s_ease]"
        />
      )}

      {open && (
        <div className="fixed inset-x-0 z-50 px-4" style={{ bottom: 'calc(112px + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto grid w-full max-w-[480px] grid-cols-2 gap-3">
            {ACTIONS.map(({ href, label, Icon }, i) => (
              <button
                key={href}
                type="button"
                onClick={() => go(href)}
                style={{ animationDelay: `${i * 28}ms` }}
                className="card flex animate-[pop_.22s_cubic-bezier(.2,.9,.3,1.2)_both] flex-col items-center gap-2.5 px-4 py-6 active:scale-[0.97] transition-transform last:col-span-2"
              >
                <Icon size={26} />
                <span className="text-[15px] font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto mx-auto flex w-full max-w-[480px] items-center gap-3">
          <div className="flex flex-1 items-center justify-around rounded-[28px] border border-line bg-card/85 px-1.5 py-1.5 shadow-[var(--shadow-lift)] backdrop-blur-xl">
            {TABS.map(({ href, label, Icon }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-w-[76px] flex-col items-center gap-1 rounded-[22px] px-3 py-2 transition-colors ${
                    active ? 'bg-fill text-ink' : 'text-ink-muted'
                  }`}
                >
                  {label === 'Profile' && initials ? (
                    <span
                      className="grid h-[26px] w-[26px] place-items-center rounded-full text-[10px] font-bold text-white"
                      style={{
                        background: 'linear-gradient(135deg, var(--avatar-from), var(--avatar-to))',
                      }}
                    >
                      {initials}
                    </span>
                  ) : (
                    <Icon size={24} strokeWidth={active ? 2.1 : 1.75} />
                  )}
                  <span className="text-[11px] font-medium leading-none">{label}</span>
                </Link>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => (open ? close() : setOpen(true))}
            aria-label={open ? 'Close quick actions' : 'Add'}
            aria-expanded={open}
            className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-full bg-accent text-accent-ink shadow-[var(--shadow-lift)] transition-transform active:scale-95"
          >
            <span className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>
              {open ? <PlusIcon size={28} /> : <PlusIcon size={28} />}
            </span>
          </button>
        </div>
      </nav>

      <style jsx global>{`
        @keyframes pop {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.94);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  )
}

/** Kept separate so the barcode icon import is used by the scan entry point. */
export const QuickScanIcon = BarcodeIcon
export const QuickCloseIcon = CloseIcon
