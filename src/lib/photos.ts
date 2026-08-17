import 'server-only'

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

/**
 * Photos live on a filesystem volume, never in `public/` and never in the
 * database.
 *
 * `public/` is catalogued at build time and copied as a build artifact, so a
 * file written there at runtime is not reliably served. A DB blob would bloat
 * the SQLite file and route every read through the JS heap.
 */

export const MAX_UPLOAD_BYTES = 15_000_000

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export function uploadDir(): string {
  return process.env.UPLOAD_DIR ?? './data/uploads'
}

/** Relative paths only, so a stored value can never escape the upload root. */
export function resolveStoredPath(stored: string): string | null {
  if (!/^[0-9]{4}\/[0-9]{2}\/[a-f0-9-]+\.(jpe?g|webp)$/i.test(stored)) return null
  return path.join(uploadDir(), stored)
}

export type StoredPhoto = { relativePath: string; width: number; height: number; bytes: number }

/**
 * Re-encodes every upload. This is not just compression:
 *   - normalises HEIC, which browsers cannot decode
 *   - strips EXIF, which removes GPS coordinates from the user's meal photos
 *   - `.rotate()` applies the EXIF orientation and then drops the tag, so the
 *     stored file is upright with no orientation metadata left to double-apply
 *   - caps dimensions so a 48 MP original never reaches a canvas
 */
export async function storePhoto(file: File): Promise<StoredPhoto> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That image is too large. Try again with a smaller photo.')
  }
  if (file.type && !ACCEPTED.has(file.type)) {
    throw new Error('That file type is not supported.')
  }

  const input = Buffer.from(await file.arrayBuffer())

  const maxEdge = Number(process.env.PHOTO_MAX_EDGE ?? 1568)
  const pipeline = sharp(input, { failOn: 'none' })
    .rotate()
    .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })

  const now = new Date()
  const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const relativePath = `${dir}/${randomUUID()}.jpg`
  const absolute = path.join(uploadDir(), relativePath)

  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, data)

  return { relativePath, width: info.width, height: info.height, bytes: data.byteLength }
}

/** Base64 for the Anthropic vision block, from the already-normalised file. */
export async function toBase64(absolutePath: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  return (await readFile(absolutePath)).toString('base64')
}
