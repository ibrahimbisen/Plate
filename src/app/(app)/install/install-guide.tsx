'use client'

import { useEffect, useState } from 'react'

import { CheckIcon, ShareIcon } from '@/components/icons'

type Platform = 'ios' | 'android' | 'desktop'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }

export function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [installed, setInstalled] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const ua = navigator.userAgent
    setPlatform(
      /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop',
    )
    setInstalled(
      window.matchMedia('(display-mode: standalone)').matches ||
        // iOS exposes its own flag rather than display-mode in older versions.
        (navigator as { standalone?: boolean }).standalone === true,
    )

    // Safari has never implemented beforeinstallprompt, so this only ever fires
    // on Chromium. iOS gets the manual steps below.
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (installed) {
    return (
      <div className="card flex items-center gap-3 p-5">
        <CheckIcon size={22} className="text-good" />
        <p className="text-[16px] font-semibold">Already installed — you&rsquo;re all set.</p>
      </div>
    )
  }

  if (deferred) {
    return (
      <button type="button" className="btn-primary" onClick={() => void deferred.prompt()}>
        Install Cal AI
      </button>
    )
  }

  const steps =
    platform === 'ios'
      ? [
          'Tap the Share button in the Safari toolbar.',
          'Scroll down and tap "Add to Home Screen".',
          'Tap "Add" in the top right.',
          'Open Cal AI from your Home Screen — it runs full screen from now on.',
        ]
      : platform === 'android'
        ? [
            'Tap the three-dot menu in Chrome.',
            'Tap "Add to Home screen" or "Install app".',
            'Confirm, then open Cal AI from your launcher.',
          ]
        : [
            'Open this page in Chrome, Edge, or Safari on your phone.',
            'Use the browser menu to add it to your home screen.',
          ]

  return (
    <div className="flex flex-col gap-3">
      {platform === 'ios' && (
        <div className="card flex items-center gap-3 p-4">
          <ShareIcon size={22} />
          <p className="label-muted text-[14px]">
            Look for this icon in the Safari toolbar. It has to be Safari — other iOS browsers
            cannot install web apps.
          </p>
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <li key={i} className="card flex items-start gap-3 p-4">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-bold text-accent-ink">
              {i + 1}
            </span>
            <p className="text-[15px] leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
