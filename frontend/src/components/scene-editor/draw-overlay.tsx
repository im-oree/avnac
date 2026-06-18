import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

export default function DrawingOverlay({
  artboardRef,
  artboardW,
  artboardH,
  scale,
  points,
  preview,
}: {
  artboardRef: React.RefObject<HTMLDivElement | null>
  artboardW: number
  artboardH: number
  scale: number
  points: { x: number; y: number }[]
  preview: { x: number; y: number } | null
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useLayoutEffect(() => {
    const el = artboardRef.current
    if (!el) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.zIndex = '62'
    canvas.style.pointerEvents = 'none'
    canvas.style.touchAction = 'none'
    canvas.width = Math.max(1, Math.round(artboardW * dpr))
    canvas.height = Math.max(1, Math.round(artboardH * dpr))
    canvas.style.width = `${artboardW}px`
    canvas.style.height = `${artboardH}px`
    el.appendChild(canvas)
    canvasRef.current = canvas
    return () => {
      if (canvas.parentElement === el) el.removeChild(canvas)
      canvasRef.current = null
    }
  }, [artboardRef, artboardW, artboardH])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, artboardW, artboardH)
    if (!points || points.length === 0) return

    const sc = scale || 1
    const px = (n: number) => n / sc

    // Path
    ctx.save()
    ctx.lineWidth = px(2.5)
    ctx.strokeStyle = '#5B6CFF'
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    if (preview) ctx.lineTo(preview.x, preview.y)
    ctx.stroke()
    ctx.restore()

    // Anchors
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      ctx.beginPath()
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#5B6CFF'
      ctx.lineWidth = px(1.5)
      ctx.arc(p.x, p.y, px(6), 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    // Preview handle
    if (preview) {
      ctx.beginPath()
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#5B6CFF'
      ctx.lineWidth = px(1.5)
      ctx.arc(preview.x, preview.y, px(6), 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }, [artboardW, artboardH, points, preview, scale])

  useEffect(() => { draw() }, [draw, points, preview, scale])

  return null
}
