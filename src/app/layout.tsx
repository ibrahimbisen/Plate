import type { Metadata, Viewport } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Cal AI',
  description: 'Track calories and macros from a photo, a barcode, or your voice.',
  applicationName: 'Cal AI',
  appleWebApp: {
    capable: true,
    title: 'Cal AI',
    // Content runs under the status bar, which is why the shell applies
    // env(safe-area-inset-top).
    statusBarStyle: 'black-translucent',
  },
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false },
  // iOS never reads manifest icons. Without this it screenshots the page and
  // uses that as a blurry home-screen icon.
  icons: {
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Without viewport-fit=cover every env(safe-area-inset-*) resolves to 0px.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7f8' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  // Deliberately NOT user-scalable:false — that is a WCAG 1.4.4 violation and
  // iOS ignores it anyway.
}

/**
 * Applies the stored theme before first paint. Without this the app renders
 * light for one frame and then snaps to dark, which is very visible on an OLED
 * phone. Kept as a raw string so it runs synchronously in <head>.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem('calai-appearance') || 'system';
    var dark = pref === 'dark' ||
      (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
