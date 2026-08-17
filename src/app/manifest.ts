import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cal AI — Calorie Tracker',
    short_name: 'Cal AI',
    description: 'Track calories and macros from a photo, a barcode, or your voice.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f7f8',
    theme_color: '#f7f7f8',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      // iOS ignores `maskable`, which is why an opaque, pre-padded icon is also
      // supplied via apple-touch-icon in the layout.
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Scan a meal', url: '/log/scan' },
      { name: 'Search food', url: '/log/search' },
      { name: 'Log weight', url: '/progress/weight' },
    ],
  }
}
