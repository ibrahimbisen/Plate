import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'

import { NextResponse } from 'next/server'

import { resolveStoredPath } from '@/lib/photos'

/**
 * Serves user photos from the upload volume.
 *
 * This app has no authentication (see the README's "No built-in
 * authentication" warning) — anyone who can reach this server can reach these
 * pictures of someone's meals and their body. `resolveStoredPath` whitelists
 * the exact YYYY/MM/uuid.jpg shape, so a crafted path cannot walk out of the
 * upload root, but that's path-traversal safety, not access control.
 */
export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params
  const relative = decodeURIComponent(segments.join('/'))
  const absolute = resolveStoredPath(relative)
  if (!absolute) return new NextResponse(null, { status: 404 })

  try {
    const info = await stat(absolute)
    const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(info.size),
        // Filenames are UUIDs, so the content at a path never changes.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
