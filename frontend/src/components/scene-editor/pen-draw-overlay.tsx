import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  commitPenDraw,
  strokeAnchorsOnContext,
} from '../../lib/avnac-pen-tool'
import { ctrlInAbs, ctrlOutAbs, type VectorPenAnchor } from '../../lib/avnac-vector-pen-bezier'

// ---------------------------------------------------------------------------
// Visual constants (CSS pixels, divided by `scale` at draw time)
// ---------------------------------------------------------------------------

const ANCHOR_RADIUS_PX     = 5
const HANDLE_RADIUS_PX     = 4
const CLOSE_HIT_RADIUS_PX  = 12
const COLOR_PATH           = '#5B6CFF'
const COLOR_WHITE          = '#ffffff'
const COLOR_HANDLE         = '#FF6B6B'
const COLOR_HANDLE_LINE    = 'rgba(255,107,107,0.7)'
const COLOR_CLOSE_HINT     = '#22c55e'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawCircle(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  fill: string, stroke: string, lineWidth: number,
) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = stroke
  ctx.stroke()
}

function drawDiamond(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  fill: string, stroke: string, lineWidth: number,
) {
  ctx.beginPath()
  ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = stroke
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PenDrawOverlay({
  artboardRef,
  artboardW,
  artboardH,
  scale,
  pointerToScene,
  onCommit,
  onCancel,
}: {
  artboardRef: React.RefObject<HTMLDivElement | null>
  artboardW: number
  artboardH: number
  scale: number
  pointerToScene: (clientX: number, clientY: number) => { x: number; y: number }
  /** Called when the user finishes the path. */
  onCommit: (payload: {
    anchors: VectorPenAnchor[]
    closed: boolean
  }) => void
  /** Called on Escape with no commit. */
  onCancel: () => void
}) {
  const canvasRef    = useRef<HTMLCanvasElement | null>(null)
  // Mutable refs to avoid re-binding listeners on every state change.
  const anchorsRef   = useRef<VectorPenAnchor[]>([])
  const draggingRef  = useRef(false)
  const ghostRef     = useRef<{ x: number; y: number } | null>(null)

  const [, forceRedraw] = useState(0)
  const requestRedraw = useCallback(() => forceRedraw(n => n + 1), [])

  // ── Canvas lifecycle ─────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const host = artboardRef.current
    if (!host) return

    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const canvas = document.createElement('canvas')
    canvas.style.position      = 'absolute'
    canvas.style.inset         = '0'
    canvas.style.zIndex        = '60'
    canvas.style.cursor        = 'crosshair'
    canvas.style.pointerEvents = 'auto'
    canvas.style.touchAction   = 'none'
    canvas.width  = Math.max(1, Math.round(artboardW * dpr))
    canvas.height = Math.max(1, Math.round(artboardH * dpr))
    canvas.style.width  = `${artboardW}px`
    canvas.style.height = `${artboardH}px`
    host.appendChild(canvas)
    canvasRef.current = canvas

    return () => {
      if (canvas.parentElement === host) host.removeChild(canvas)
      canvasRef.current = null
    }
  }, [artboardRef, artboardW, artboardH])

  // ── Draw ─────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, artboardW, artboardH)

    const A = anchorsRef.current
    const ghost = ghostRef.current
    if (A.length === 0 && !ghost) return

    const px = (n: number) => n / scale

    // ── Path so far (anchors + dashed preview to ghost / first anchor) ─
    ctx.save()
    ctx.lineWidth   = px(1.5)
    ctx.strokeStyle = COLOR_PATH
    if (A.length > 0) {
      strokeAnchorsOnContext(ctx, A, false)
    }

    if (A.length > 0 && ghost) {
      // Preview segment from last anchor to ghost cursor.
      const last = A[A.length - 1]!
      ctx.beginPath()
      ctx.setLineDash([px(4), px(3)])
      const c1 = ctrlOutAbs(last)
      ctx.moveTo(last.x, last.y)
      ctx.bezierCurveTo(c1[0], c1[1], ghost.x, ghost.y, ghost.x, ghost.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.restore()

    // ── Bezier handles for the *last* anchor while dragging ──
    const last = A[A.length - 1]
    if (last && draggingRef.current && (last.outX !== undefined || last.inX !== undefined)) {
      ctx.save()
      ctx.lineWidth   = px(1)
      ctx.strokeStyle = COLOR_HANDLE_LINE
      ctx.setLineDash([px(4), px(3)])
      if (last.outX !== undefined && last.outY !== undefined) {
        ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(last.outX, last.outY); ctx.stroke()
      }
      if (last.inX !== undefined && last.inY !== undefined) {
        ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(last.inX, last.inY); ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.restore()
      if (last.outX !== undefined && last.outY !== undefined) {
        drawDiamond(ctx, last.outX, last.outY, px(HANDLE_RADIUS_PX), COLOR_WHITE, COLOR_HANDLE, px(1.5))
      }
      if (last.inX !== undefined && last.inY !== undefined) {
        drawDiamond(ctx, last.inX, last.inY, px(HANDLE_RADIUS_PX), COLOR_WHITE, COLOR_HANDLE, px(1.5))
      }
    }

    // ── Anchor dots ──
    for (let i = 0; i < A.length; i++) {
      const a = A[i]!
      drawCircle(ctx, a.x, a.y, px(ANCHOR_RADIUS_PX), COLOR_WHITE, COLOR_PATH, px(1.5))
    }

    // ── Close-hint ring around first anchor when cursor is near it ──
    if (A.length >= 2 && ghost) {
      const first = A[0]!
      const hitR  = CLOSE_HIT_RADIUS_PX / scale
      if (Math.hypot(first.x - ghost.x, first.y - ghost.y) <= hitR) {
        ctx.save()
        ctx.lineWidth   = px(2)
        ctx.strokeStyle = COLOR_CLOSE_HINT
        ctx.beginPath()
        ctx.arc(first.x, first.y, px(ANCHOR_RADIUS_PX + 4), 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }
  }, [artboardW, artboardH, scale])

  useEffect(() => { draw() })

  // ── Pointer + key handlers ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault(); e.stopPropagation()
      const p = pointerToScene(e.clientX, e.clientY)
      const A = anchorsRef.current

      // Close path: click near first anchor when 2+ anchors exist.
      if (A.length >= 2) {
        const first = A[0]!
        const hitR  = CLOSE_HIT_RADIUS_PX / scale
        if (Math.hypot(first.x - p.x, first.y - p.y) <= hitR) {
          onCommit({ anchors: A.slice(), closed: true })
          return
        }
      }

      // Otherwise start dropping a new anchor.
      anchorsRef.current = [...A, { x: p.x, y: p.y }]
      draggingRef.current = true
      try { canvas.setPointerCapture(e.pointerId) } catch { /* noop */ }
      requestRedraw()
    }

    const onPointerMove = (e: PointerEvent) => {
      const p = pointerToScene(e.clientX, e.clientY)
      const A = anchorsRef.current

      if (draggingRef.current && A.length > 0) {
        // Set out-handle on the last anchor by dragging, mirror in-handle for smoothness.
        const last = A[A.length - 1]!
        const dx = p.x - last.x
        const dy = p.y - last.y
        // Require a small drag distance before treating it as a handle drag.
        const DRAG_MIN = 2 / scale
        if (Math.hypot(dx, dy) >= DRAG_MIN) {
          A[A.length - 1] = {
            ...last,
            outX: p.x, outY: p.y,
            inX:  last.x - dx, inY: last.y - dy,
          }
          anchorsRef.current = A.slice()
        }
      } else {
        ghostRef.current = { x: p.x, y: p.y }
      }
      requestRedraw()
    }

    const onPointerUp = () => {
      draggingRef.current = false
      requestRedraw()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (anchorsRef.current.length >= 2) {
          onCommit({ anchors: anchorsRef.current.slice(), closed: false })
        } else {
          onCancel()
        }
        return
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && anchorsRef.current.length > 0) {
        e.preventDefault()
        anchorsRef.current = anchorsRef.current.slice(0, -1)
        requestRedraw()
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup',   onPointerUp)
    window.addEventListener('keydown',     onKey)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup',   onPointerUp)
      window.removeEventListener('keydown',     onKey)
    }
  }, [pointerToScene, scale, onCancel, onCommit, requestRedraw])

  // ── Hint toolbar ─────────────────────────────────────────────────────────
  return (
    <div
      data-avnac-chrome
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 70,
        pointerEvents: 'auto',
      }}
      className={[
        'flex items-center gap-2 rounded-xl px-3 py-1.5',
        'border border-[var(--border)] bg-[var(--surface)]/95 shadow-xl backdrop-blur-md',
        'text-[12px] font-medium text-[var(--text)] whitespace-nowrap',
      ].join(' ')}
    >
      <span className="select-none px-1 text-[var(--text-muted)]">
        Click to add point · Drag for curve · Click first point to close · Enter to finish · Esc to cancel
      </span>
      <div className="mx-1 h-4 w-px bg-[var(--border)]" />
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
        onClick={() => {
          if (anchorsRef.current.length >= 2) {
            onCommit({ anchors: anchorsRef.current.slice(), closed: false })
          } else {
            onCancel()
          }
        }}
      >
        Finish
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  )
}