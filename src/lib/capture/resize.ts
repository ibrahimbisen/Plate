/**
 * Client-side downscale before upload.
 *
 * The hard constraint is iOS: Safari caps a canvas at 16,777,216 px² (4096²),
 * and since iOS 17.5 exceeding it does not warn — it kills the tab with
 * "A problem repeatedly occurred", with no console output and no crash report.
 * A 48 MP iPhone photo is 8064x6048 = 48.8 M px, three times over the limit.
 *
 * Note what this deliberately does NOT do: rotate by EXIF. `image-orientation:
 * from-image` has been the initial value since 2020 and canvas drawImage honours
 * EXIF, so the widely-copied "fix rotated iPhone photos" snippets now rotate
 * correct images a second time.
 */

const MAX_CANVAS_AREA = 16_777_216
const DEFAULT_MAX_EDGE = 1568

export type ResizeResult = { blob: Blob; width: number; height: number }

function targetScale(width: number, height: number, maxEdge: number): number {
  return Math.min(
    1,
    Math.sqrt(MAX_CANVAS_AREA / (width * height)),
    maxEdge / Math.max(width, height),
  )
}

/**
 * Prefers a Worker-friendly path (createImageBitmap + OffscreenCanvas, Safari
 * 16.4+) so the decoded bitmap never lands in the main thread's memory budget
 * alongside the rest of the UI. Falls back to a main-thread canvas.
 */
export async function downscaleImage(
  file: File,
  maxEdge = DEFAULT_MAX_EDGE,
): Promise<ResizeResult> {
  // HEIC cannot be decoded by canvas in any browser. iOS transcodes it to JPEG
  // for us as long as `accept` does not name HEIC explicitly; if one still gets
  // through, hand the original to the server, which has sharp.
  if (/heic|heif/i.test(file.type)) {
    return { blob: file, width: 0, height: 0 }
  }

  try {
    if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function') {
      const probe = await createImageBitmap(file)
      const scale = targetScale(probe.width, probe.height, maxEdge)
      const w = Math.max(1, Math.round(probe.width * scale))
      const h = Math.max(1, Math.round(probe.height * scale))
      probe.close()

      // Re-decode straight to the target size so the full-resolution bitmap is
      // never materialised.
      const bitmap = await createImageBitmap(file, {
        resizeWidth: w,
        resizeHeight: h,
        resizeQuality: 'high',
      })
      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()

      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 })
      return { blob, width: w, height: h }
    }
  } catch {
    // Fall through to the canvas path.
  }

  return downscaleViaCanvas(file, maxEdge)
}

function downscaleViaCanvas(file: File, maxEdge: number): Promise<ResizeResult> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      try {
        let w = img.naturalWidth
        let h = img.naturalHeight
        const scale = targetScale(w, h, maxEdge)
        const targetW = Math.max(1, Math.round(w * scale))
        const targetH = Math.max(1, Math.round(h * scale))

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no 2d context')

        // Halve at a time. WebKit downscales with bilinear sampling, so one big
        // jump aliases badly; two or three halvings look markedly better.
        let src: CanvasImageSource = img
        while (w * 0.5 > targetW) {
          const nw = Math.max(targetW, Math.round(w * 0.5))
          const nh = Math.max(targetH, Math.round(h * 0.5))
          canvas.width = nw
          canvas.height = nh
          ctx.drawImage(src, 0, 0, nw, nh)
          const step = document.createElement('canvas')
          step.width = nw
          step.height = nh
          step.getContext('2d')!.drawImage(canvas, 0, 0)
          src = step
          w = nw
          h = nh
        }

        canvas.width = targetW
        canvas.height = targetH
        ctx.drawImage(src, 0, 0, targetW, targetH)

        canvas.toBlob(
          (blob) => {
            // WebKit does not reliably reclaim canvas backing stores.
            canvas.width = canvas.height = 0
            URL.revokeObjectURL(url)
            blob
              ? resolve({ blob, width: targetW, height: targetH })
              : reject(new Error('Could not encode that image.'))
          },
          'image/jpeg',
          0.82,
        )
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}
