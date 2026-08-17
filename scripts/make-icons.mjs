/**
 * Generates the PWA icon set from the app's own mark.
 *
 * Icons are opaque and pre-padded on purpose: iOS applies its own squircle mask
 * and does not composite a background, so a transparent icon renders black.
 * The maskable variant carries a larger safe zone because Android crops it.
 *
 * Run with: node scripts/make-icons.mjs
 */
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const MARK = `
  <path d="M12.2 6.6c2.9-1.4 5.6.3 6.4 2.4 1 2.6.1 6.5-1.7 9-.9 1.2-1.8 2.4-3.1 2.4-1.2 0-1.7-.8-3.1-.8s-1.9.8-3.1.8c-1.3 0-2.3-1.3-3.2-2.5-2-2.9-2.6-7.6-.6-10 1-1.2 2.4-1.9 3.9-1.9 1.4 0 2.3.9 3.5.9.4 0 .6-.1 1-.3Z"/>
  <path d="M13.9 2c.2 1-.2 2-.8 2.7-.6.7-1.6 1.3-2.6 1.2-.2-1 .3-2 .9-2.7.6-.7 1.7-1.2 2.5-1.2Z"/>`

const svg = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#f7f7f8"/>
  <g transform="translate(${pad},${pad}) scale(${(size - pad * 2) / 24})" fill="#101012">${MARK}</g>
</svg>`

await mkdir('public/icons', { recursive: true })

for (const [path, size, padRatio] of [
  ['public/icons/icon-192.png', 192, 0.18],
  ['public/icons/icon-512.png', 512, 0.18],
  ['public/icons/icon-maskable-512.png', 512, 0.28],
  ['public/icons/apple-touch-icon.png', 180, 0.16],
]) {
  await sharp(Buffer.from(svg(size, Math.round(size * padRatio)))).png().toFile(path)
  console.log('wrote', path)
}
