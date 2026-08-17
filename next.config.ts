import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Self-hosting: emit a minimal server bundle for the Docker image.
  output: 'standalone',

  // better-sqlite3 and sharp are native addons — they must not be bundled.
  // NOTE: this is exactly the combination broken by vercel/next.js#88844 under
  // Turbopack, which is why package.json builds with `next build --webpack`.
  serverExternalPackages: ['better-sqlite3', 'sharp'],

  // The migrations folder is read at runtime by instrumentation.ts but is not
  // traced automatically into .next/standalone.
  outputFileTracingIncludes: {
    '/**': ['./drizzle/**', './data/seed/**'],
  },

  images: {
    // User photos are already normalized by sharp at upload time, so there is
    // nothing for the optimizer to do and every pass costs memory.
    unoptimized: true,
  },

  async headers() {
    return [
      {
        // Never let a proxy buffer RSC streaming responses.
        source: '/:path*',
        headers: [{ key: 'X-Accel-Buffering', value: 'no' }],
      },
      {
        // A stale service worker is forever. Always revalidate it.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
