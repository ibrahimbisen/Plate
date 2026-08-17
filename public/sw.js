/**
 * Hand-rolled service worker.
 *
 * next-pwa has been unmaintained for years and Serwist is a webpack plugin in a
 * Turbopack-default world. What this app actually needs is an app shell and an
 * offline page — not precaching of a large static asset graph — so it is a few
 * dozen lines rather than a build-tool dependency.
 */

const VERSION = 'calai-v1'
const SHELL = `${VERSION}-shell`
const RUNTIME = `${VERSION}-runtime`

const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)))
  // Deliberately NOT skipWaiting() here — an unconditional skipWaiting while a
  // navigation is in flight is the top cause of "the app went weird until I
  // force-quit it". The page asks for it explicitly instead.
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never cache the API or user photos — a stale calorie total is worse than
  // an error, and photos are already immutable-cached by the browser.
  if (url.pathname.startsWith('/api/')) return

  // Navigations: network first, fall back to the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL)
        return cached ?? new Response('Offline', { status: 503 })
      }),
    )
    return
  }

  // Static assets: stale-while-revalidate. Cache-first would pin a broken build.
  if (/\.(js|css|woff2?|png|svg|webp|wasm)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
          .catch(() => cached)
        return cached ?? network
      }),
    )
  }
})
