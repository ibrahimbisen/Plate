'use client'

import { useEffect, useState } from 'react'

/**
 * Registers the service worker and surfaces updates as a prompt rather than
 * swapping the worker underneath a live page.
 */
export function ServiceWorkerBridge() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return

    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (registration.waiting) setWaiting(registration.waiting)
        registration.addEventListener('updatefound', () => {
          const next = registration.installing
          next?.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(next)
            }
          })
        })
      })
      .catch(() => {})

    // Ask the browser to keep local data rather than evicting it. Supported on
    // iOS 15.2+; the installed-to-home-screen case is what actually protects it.
    void navigator.storage?.persist?.().catch(() => {})
  }, [])

  if (!waiting) return null

  return (
    <div
      className="fixed inset-x-4 z-[60] mx-auto max-w-[480px]"
      style={{ bottom: 'calc(120px + env(safe-area-inset-bottom))' }}
    >
      <div className="card flex items-center gap-3 p-4 shadow-[var(--shadow-lift)]">
        <p className="flex-1 text-[15px] font-medium">A new version is ready.</p>
        <button
          type="button"
          className="btn-pill"
          onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}
        >
          Reload
        </button>
      </div>
    </div>
  )
}
