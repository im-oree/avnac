import React, { useEffect, useRef } from 'react'

export default function CheckerboardPreview({
  src,
  width,
  height,
  alphaMask,
  maskMeta,
  bg = 'checker',
  maxPreview = 400,
}: {
  src: string
  width: number
  height: number
  alphaMask?: Uint8Array | null
  maskMeta?: { feather?: number; opacity?: number; inverted?: boolean }
  bg?: 'checker' | 'white' | 'black'
  maxPreview?: number
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    img.onload = () => {
      if (cancelled) return
      const aspect = width / Math.max(1, height)
      let pw = Math.min(maxPreview, width)
      let ph = Math.round(pw / Math.max(0.0001, aspect))
      if (ph > maxPreview) {
        ph = maxPreview
        pw = Math.round(ph * aspect)
      }
      canvas.width = pw
      canvas.height = ph

      // Draw background
      if (bg === 'checker') {
        const cell = 8
        for (let y = 0; y < ph; y += cell) {
          for (let x = 0; x < pw; x += cell) {
            const isLight = ((x / cell) | 0) % 2 === ((y / cell) | 0) % 2
            ctx.fillStyle = isLight ? '#ddd' : '#eee'
            ctx.fillRect(x, y, cell, cell)
          }
        }
      } else if (bg === 'white') {
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, pw, ph)
      } else {
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, pw, ph)
      }

      // Draw image scaled to preview
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(img, 0, 0, pw, ph)

      if (alphaMask && alphaMask.length > 0) {
        try {
          // Create mask canvas from alphaMask (assumes mask size matches original width/height)
          const maskSrc = document.createElement('canvas')
          maskSrc.width = width
          maskSrc.height = height
          const mctx = maskSrc.getContext('2d')
          if (mctx) {
            const id = mctx.createImageData(width, height)
            for (let i = 0; i < width * height; i++) {
              const a = alphaMask[i]
              const j = i * 4
              id.data[j] = 255
              id.data[j + 1] = 255
              id.data[j + 2] = 255
              id.data[j + 3] = a
            }
            mctx.putImageData(id, 0, 0)

            // Apply feather via canvas filter if requested
            ctx.globalCompositeOperation = 'destination-in'
            if (maskMeta?.feather && maskMeta.feather > 0) {
              // draw via temporary canvas to apply blur
              const tmp = document.createElement('canvas')
              tmp.width = pw
              tmp.height = ph
              const tctx = tmp.getContext('2d')
              if (tctx) {
                tctx.filter = `blur(${maskMeta.feather}px)`
                tctx.drawImage(maskSrc, 0, 0, pw, ph)
                ctx.drawImage(tmp, 0, 0, pw, ph)
              } else {
                ctx.drawImage(maskSrc, 0, 0, pw, ph)
              }
            } else {
              ctx.drawImage(maskSrc, 0, 0, pw, ph)
            }
            ctx.globalCompositeOperation = 'source-over'
          }
        } catch (e) {
          // ignore mask draw errors
        }
      }

      ctx.restore()
    }

    return () => {
      cancelled = true
    }
  }, [src, width, height, alphaMask, maskMeta, bg, maxPreview])

  return <canvas ref={ref} className="w-full h-auto rounded-md border border-[var(--border)]" />
}
