export function supportsWebGPU(): boolean {
  try {
    return typeof navigator !== 'undefined' && 'gpu' in (navigator as any)
  } catch (e) {
    return false
  }
}

/**
 * Create a pre-scaled ImageBitmap from a source image/canvas using the fastest
 * available path. Modern browsers back `createImageBitmap` with GPU accelerated
 * resizing when available. This function falls back to an Offscreen/HTML canvas
 * when needed.
 */
export async function fastCreateImageBitmap(
  src: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Promise<ImageBitmap> {
  const outW = Math.max(1, Math.round(dw))
  const outH = Math.max(1, Math.round(dh))
  // Preferred: use createImageBitmap with resizing options (may be GPU-accelerated)
  if (typeof createImageBitmap === 'function') {
    try {
      const options: any = {}
      options.resizeWidth = outW
      options.resizeHeight = outH
      options.resizeQuality = 'high'
      return await createImageBitmap(src as any, sx, sy, sw, sh, options)
    } catch (err) {
      // fall through to canvas-based path
    }
  }

  // Try OffscreenCanvas when available
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const c = new OffscreenCanvas(outW, outH)
      const ctx = c.getContext('2d')
      if (ctx) {
        ctx.drawImage(src as any, sx, sy, sw, sh, 0, 0, outW, outH)
        return await (createImageBitmap as any)(c)
      }
    } catch (e) {
      // ignore and fall back
    }
  }

  // Last-resort: HTMLCanvasElement
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create canvas for image scaling.')
    ctx.drawImage(src as any, sx, sy, sw, sh, 0, 0, outW, outH)
    return await createImageBitmap(canvas)
  }

  throw new Error('No available path to create ImageBitmap')
}
