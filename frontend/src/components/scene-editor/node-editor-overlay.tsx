import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { SceneObject } from '../../lib/avnac-scene'
import {
  findNearestPointOnPenPath,
  splitPenBezierSegment,
  type VectorPenAnchor,
} from '../../lib/avnac-vector-pen-bezier'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DragTarget =
  | { kind: 'anchor'; idx: number }
  | { kind: 'inHandle'; idx: number }
  | { kind: 'outHandle'; idx: number }

type HoverTarget =
  | { kind: 'anchor'; idx: number }
  | { kind: 'inHandle'; idx: number }
  | { kind: 'outHandle'; idx: number }
  | { kind: 'segment'; segmentIndex: number; x: number; y: number }
  | null

// ---------------------------------------------------------------------------
// Visual constants — CSS pixel sizes, divided by `scale` when drawing so they
// stay the same visual size at any zoom level.
// ---------------------------------------------------------------------------

const ANCHOR_RADIUS_PX         = 5.5
const HANDLE_RADIUS_PX         = 4
const HIT_RADIUS_ANCHOR_PX     = 10
const HIT_RADIUS_HANDLE_PX     = 9
const SEGMENT_ADD_THRESHOLD_PX = 8

const COLOR_PATH          = '#5B6CFF'
const COLOR_WHITE         = '#ffffff'
const COLOR_HANDLE        = '#FF6B6B'
const COLOR_HANDLE_LINE   = 'rgba(255,107,107,0.7)'
const COLOR_ADD           = '#22c55e'
const COLOR_SEGMENT_HOVER = 'rgba(91,108,255,0.55)'

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

const degToRad = (deg: number) => (deg * Math.PI) / 180

/** Object-local → artboard (scene) space. Honours translation + rotation about centre. */
function localToScene(
  lx: number,
  ly: number,
  obj: { x: number; y: number; width: number; height: number; rotation: number },
): { x: number; y: number } {
  const cx = obj.x + obj.width / 2
  const cy = obj.y + obj.height / 2
  const rad = degToRad(obj.rotation)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const rx = lx - obj.width / 2
  const ry = ly - obj.height / 2
  return {
    x: cx + rx * cos - ry * sin,
    y: cy + rx * sin + ry * cos,
  }
}

/** Inverse of localToScene. */
function sceneToLocal(
  sx: number,
  sy: number,
  obj: { x: number; y: number; width: number; height: number; rotation: number },
): { x: number; y: number } {
  const cx = obj.x + obj.width / 2
  const cy = obj.y + obj.height / 2
  const rad = degToRad(-obj.rotation)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = sx - cx
  const dy = sy - cy
  return {
    x: dx * cos - dy * sin + obj.width / 2,
    y: dx * sin + dy * cos + obj.height / 2,
  }
}

/**
 * Resolve the "neighbour" anchor used when auto-generating symmetric handles.
 * For open paths, endpoints fall back to themselves on the missing side so we
 * never index past the array.
 */
function neighbourAnchors(
  anchors: VectorPenAnchor[],
  idx: number,
  closed: boolean,
): { prev: VectorPenAnchor; next: VectorPenAnchor } {
  const a = anchors[idx]!
  let prev = a
  let next = a
  if (closed) {
    prev = anchors[(idx - 1 + anchors.length) % anchors.length] ?? a
    next = anchors[(idx + 1) % anchors.length] ?? a
  } else {
    if (idx > 0)                    prev = anchors[idx - 1] ?? a
    if (idx < anchors.length - 1)   next = anchors[idx + 1] ?? a
  }
  return { prev, next }
}

// ---------------------------------------------------------------------------
// Canvas drawing helpers
// ---------------------------------------------------------------------------

function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
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
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  fill: string, stroke: string, lineWidth: number,
) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r, y)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r, y)
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

export default function NodeEditorOverlay({
  artboardRef,
  artboardW,
  artboardH,
  scale,
  object,
  anchors,
  closed,
  onChange,
  onCommit,
  onCancel,
  pointerToScene,
}: {
  artboardRef: React.RefObject<HTMLDivElement | null>
  artboardW: number
  artboardH: number
  scale: number
  object: SceneObject
  anchors: VectorPenAnchor[]
  closed: boolean
  onChange: (next: VectorPenAnchor[]) => void
  onCommit: (next: VectorPenAnchor[]) => void
  onCancel: () => void
  pointerToScene: (clientX: number, clientY: number) => { x: number; y: number }
}) {
  const canvasRef  = useRef<HTMLCanvasElement | null>(null)
  const dragRef    = useRef<DragTarget | null>(null)

  // Refs so event handlers always see fresh values without re-binding.
  const anchorsRef = useRef<VectorPenAnchor[]>(anchors); anchorsRef.current = anchors
  const objectRef  = useRef(object);                     objectRef.current  = object
  const closedRef  = useRef(closed);                     closedRef.current  = closed
  const scaleRef   = useRef(scale);                      scaleRef.current   = scale

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [hover, setHover]             = useState<HoverTarget>(null)
  const hoverRef = useRef<HoverTarget>(null); hoverRef.current = hover

  // ── Canvas lifecycle ─────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = artboardRef.current
    if (!el) return

    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const canvas = document.createElement('canvas')
    canvas.style.position      = 'absolute'
    canvas.style.inset         = '0'
    canvas.style.zIndex        = '60'
    canvas.style.cursor        = 'default'
    canvas.style.pointerEvents = 'auto'
    canvas.style.touchAction   = 'none'
    canvas.width  = Math.max(1, Math.round(artboardW * dpr))
    canvas.height = Math.max(1, Math.round(artboardH * dpr))
    canvas.style.width  = `${artboardW}px`
    canvas.style.height = `${artboardH}px`

    el.appendChild(canvas)
    canvasRef.current = canvas

    return () => {
      if (canvas.parentElement === el) el.removeChild(canvas)
      canvasRef.current = null
    }
  }, [artboardRef, artboardW, artboardH])

  // ── Drawing ───────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, artboardW, artboardH)

    const A   = anchorsRef.current
    const obj = objectRef.current
    const cls = closedRef.current
    const sc  = scaleRef.current
    if (!A || A.length === 0 || !obj) return

    // Transform every anchor + handle into scene space once.
    const sceneAnchors = A.map(a => ({
      p:    localToScene(a.x, a.y, obj),
      inP:  a.inX  !== undefined && a.inY  !== undefined ? localToScene(a.inX,  a.inY,  obj) : null,
      outP: a.outX !== undefined && a.outY !== undefined ? localToScene(a.outX, a.outY, obj) : null,
    }))

    const sel = selectedIdx
    const hov = hoverRef.current
    const px = (n: number) => n / sc

    // ── 1. Bezier path ──
    if (sceneAnchors[0]) {
      ctx.save()
      ctx.lineWidth   = px(1.5)
      ctx.strokeStyle = COLOR_PATH
      ctx.beginPath()
      ctx.moveTo(sceneAnchors[0].p.x, sceneAnchors[0].p.y)
      const segCount = cls ? A.length : A.length - 1
      for (let i = 0; i < segCount; i++) {
        const a = sceneAnchors[i]
        const b = sceneAnchors[(i + 1) % A.length]
        if (!a || !b) continue
        const c1 = a.outP ?? a.p
        const c2 = b.inP  ?? b.p
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.p.x, b.p.y)
      }
      if (cls) ctx.closePath()
      ctx.stroke()
      ctx.restore()
    }

    // ── 2. Segment-add indicator ──
    if (hov?.kind === 'segment') {
      const ghost = localToScene(hov.x, hov.y, obj)
      ctx.save()
      ctx.lineWidth   = px(2)
      ctx.strokeStyle = COLOR_SEGMENT_HOVER
      ctx.beginPath()
      ctx.arc(ghost.x, ghost.y, px(ANCHOR_RADIUS_PX), 0, Math.PI * 2)
      ctx.stroke()
      const r = px(ANCHOR_RADIUS_PX + 4)
      ctx.lineWidth   = px(1.5)
      ctx.strokeStyle = COLOR_ADD
      ctx.beginPath()
      ctx.moveTo(ghost.x - r, ghost.y)
      ctx.lineTo(ghost.x + r, ghost.y)
      ctx.moveTo(ghost.x, ghost.y - r)
      ctx.lineTo(ghost.x, ghost.y + r)
      ctx.stroke()
      ctx.restore()
    }

    // ── 3. Handles for selected anchor ──
    if (sel !== null && sceneAnchors[sel]) {
      const a = sceneAnchors[sel]
      ctx.save()
      ctx.lineWidth   = px(1)
      ctx.strokeStyle = COLOR_HANDLE_LINE
      ctx.setLineDash([px(4), px(3)])
      if (a.outP) { ctx.beginPath(); ctx.moveTo(a.p.x, a.p.y); ctx.lineTo(a.outP.x, a.outP.y); ctx.stroke() }
      if (a.inP)  { ctx.beginPath(); ctx.moveTo(a.p.x, a.p.y); ctx.lineTo(a.inP.x,  a.inP.y);  ctx.stroke() }
      ctx.setLineDash([])
      ctx.restore()

      if (a.outP) {
        const isHov = hov?.kind === 'outHandle' && hov.idx === sel
        drawDiamond(
          ctx, a.outP.x, a.outP.y,
          px(isHov ? HANDLE_RADIUS_PX + 1.5 : HANDLE_RADIUS_PX),
          isHov ? COLOR_HANDLE : COLOR_WHITE, COLOR_HANDLE, px(1.5),
        )
      }
      if (a.inP) {
        const isHov = hov?.kind === 'inHandle' && hov.idx === sel
        drawDiamond(
          ctx, a.inP.x, a.inP.y,
          px(isHov ? HANDLE_RADIUS_PX + 1.5 : HANDLE_RADIUS_PX),
          isHov ? COLOR_HANDLE : COLOR_WHITE, COLOR_HANDLE, px(1.5),
        )
      }
    }

    // ── 4. Anchor circles ──
    for (let i = 0; i < sceneAnchors.length; i++) {
      const a = sceneAnchors[i]
      if (!a) continue
      const isSel = i === sel
      const isHov = hov?.kind === 'anchor' && hov.idx === i
      const r = px(isSel || isHov ? ANCHOR_RADIUS_PX + 1.5 : ANCHOR_RADIUS_PX)
      drawCircle(
        ctx, a.p.x, a.p.y, r,
        isSel ? COLOR_PATH : COLOR_WHITE, COLOR_PATH, px(1.5),
      )
    }
  }, [artboardW, artboardH, selectedIdx])

  useEffect(() => { draw() }, [draw, anchors, hover, selectedIdx, scale, object])

  // ── Hit testing (local space) ────────────────────────────────────────────
  const hitTest = useCallback(
    (localP: { x: number; y: number }): HoverTarget => {
      const A   = anchorsRef.current
      const sc  = scaleRef.current
      const cls = closedRef.current
      if (!A || A.length === 0) return null
      const hitAnchorL = HIT_RADIUS_ANCHOR_PX / sc
      const hitHandleL = HIT_RADIUS_HANDLE_PX / sc

      for (let i = 0; i < A.length; i++) {
        const a = A[i]
        if (!a) continue
        if (Math.hypot(a.x - localP.x, a.y - localP.y) <= hitAnchorL)
          return { kind: 'anchor', idx: i }
      }

      if (selectedIdx !== null) {
        const a = A[selectedIdx]
        if (a) {
          if (a.outX !== undefined && a.outY !== undefined &&
              Math.hypot(a.outX - localP.x, a.outY - localP.y) <= hitHandleL)
            return { kind: 'outHandle', idx: selectedIdx }
          if (a.inX !== undefined && a.inY !== undefined &&
              Math.hypot(a.inX - localP.x, a.inY - localP.y) <= hitHandleL)
            return { kind: 'inHandle', idx: selectedIdx }
        }
      }

      const hit = findNearestPointOnPenPath(A, cls, localP.x, localP.y, sc, sc)
      if (hit && hit.dist <= HIT_RADIUS_ANCHOR_PX)
        return { kind: 'segment', segmentIndex: hit.segmentIndex, x: hit.x, y: hit.y }

      return null
    },
    [selectedIdx],
  )

  // ── Pointer + keyboard ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const screenToLocal = (clientX: number, clientY: number) => {
      const scene = pointerToScene(clientX, clientY)
      return sceneToLocal(scene.x, scene.y, objectRef.current)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const localP = screenToLocal(e.clientX, e.clientY)
      const hit = hitTest(localP)

      if (!hit) {
        setSelectedIdx(null)
        return
      }

      if (hit.kind === 'segment') {
        const exact = findNearestPointOnPenPath(
          anchorsRef.current, closedRef.current,
          localP.x, localP.y, scaleRef.current, scaleRef.current,
        )
        const next = splitPenBezierSegment(
          anchorsRef.current, hit.segmentIndex, exact?.t ?? 0.5, closedRef.current,
        )
        if (next) {
          onChange(next)
          onCommit(next)
          setSelectedIdx(hit.segmentIndex + 1)
        }
        return
      }

      if (hit.kind === 'anchor') {
        setSelectedIdx(hit.idx)
        dragRef.current = hit
        try { canvas.setPointerCapture(e.pointerId) } catch { /* noop */ }
        return
      }

      dragRef.current = hit
      try { canvas.setPointerCapture(e.pointerId) } catch { /* noop */ }
    }

    const onPointerMove = (e: PointerEvent) => {
      const localP = screenToLocal(e.clientX, e.clientY)

      if (dragRef.current) {
        const d = dragRef.current
        const A = anchorsRef.current
        if (!A || A.length === 0) return

        if (d.kind === 'anchor') {
          const target = A[d.idx]
          if (!target) return
          const dx = localP.x - target.x
          const dy = localP.y - target.y
          const next = A.map((a, i) => {
            if (i !== d.idx) return a
            return {
              ...a,
              x: localP.x,
              y: localP.y,
              inX:  a.inX  !== undefined ? a.inX  + dx : undefined,
              inY:  a.inY  !== undefined ? a.inY  + dy : undefined,
              outX: a.outX !== undefined ? a.outX + dx : undefined,
              outY: a.outY !== undefined ? a.outY + dy : undefined,
            }
          })
          onChange(next)
          return
        }

        // Handle drag
        const next = A.map((an, i) => {
          if (i !== d.idx) return an
          if (d.kind === 'outHandle') {
            const updated: VectorPenAnchor = { ...an, outX: localP.x, outY: localP.y }
            if (!e.altKey) {
              const dxOut = localP.x - an.x
              const dyOut = localP.y - an.y
              updated.inX = an.x - dxOut
              updated.inY = an.y - dyOut
            }
            return updated
          }
          const updated: VectorPenAnchor = { ...an, inX: localP.x, inY: localP.y }
          if (!e.altKey) {
            const dxIn = localP.x - an.x
            const dyIn = localP.y - an.y
            updated.outX = an.x - dxIn
            updated.outY = an.y - dyIn
          }
          return updated
        })
        onChange(next)
        return
      }

      // Hover
      const hit = hitTest(localP)
      setHover(hit)
      if      (hit?.kind === 'anchor')   canvas.style.cursor = 'move'
      else if (hit?.kind === 'inHandle' ||
               hit?.kind === 'outHandle') canvas.style.cursor = 'crosshair'
      else if (hit?.kind === 'segment')  canvas.style.cursor = 'cell'
      else                                canvas.style.cursor = 'default'
    }

    const onPointerUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      onCommit(anchorsRef.current)
    }

    const onDoubleClick = (e: MouseEvent) => {
      const localP = screenToLocal(e.clientX, e.clientY)
      const A = anchorsRef.current
      const hitL = HIT_RADIUS_ANCHOR_PX / scaleRef.current
      for (let i = 0; i < A.length; i++) {
        const a = A[i]
        if (!a) continue
        if (Math.hypot(a.x - localP.x, a.y - localP.y) <= hitL) {
          const hasHandles = a.outX !== undefined || a.inX !== undefined
          let next: VectorPenAnchor[]
          if (hasHandles) {
            next = A.map((an, j) => (j !== i ? an : { x: an.x, y: an.y }))
          } else {
            const { prev, next: nxt } = neighbourAnchors(A, i, closedRef.current)
            const tx = (nxt.x - prev.x) * 0.25
            const ty = (nxt.y - prev.y) * 0.25
            next = A.map((an, j) =>
              j !== i
                ? an
                : { ...an, outX: an.x + tx, outY: an.y + ty, inX: an.x - tx, inY: an.y - ty },
            )
          }
          onChange(next)
          onCommit(next)
          return
        }
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdx !== null) {
        e.preventDefault()
        const A = anchorsRef.current
        if (!A || A.length <= 2) return
        const next = A.filter((_, i) => i !== selectedIdx)
        setSelectedIdx(prev => (prev === null ? null : Math.min(prev, next.length - 1)))
        onChange(next); onCommit(next)
        return
      }
      if (selectedIdx !== null) {
        const NUDGE = e.shiftKey ? 10 : 1
        let dx = 0, dy = 0
        if (e.key === 'ArrowLeft')  { dx = -NUDGE; e.preventDefault() }
        if (e.key === 'ArrowRight') { dx =  NUDGE; e.preventDefault() }
        if (e.key === 'ArrowUp')    { dy = -NUDGE; e.preventDefault() }
        if (e.key === 'ArrowDown')  { dy =  NUDGE; e.preventDefault() }
        if (dx !== 0 || dy !== 0) {
          const A = anchorsRef.current
          if (!A) return
          const next = A.map((a, i) =>
            i !== selectedIdx
              ? a
              : {
                  ...a,
                  x: a.x + dx, y: a.y + dy,
                  inX:  a.inX  !== undefined ? a.inX  + dx : undefined,
                  inY:  a.inY  !== undefined ? a.inY  + dy : undefined,
                  outX: a.outX !== undefined ? a.outX + dx : undefined,
                  outY: a.outY !== undefined ? a.outY + dy : undefined,
                },
          )
          onChange(next); onCommit(next)
        }
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup',   onPointerUp)
    canvas.addEventListener('dblclick',    onDoubleClick)
    window.addEventListener('keydown',     onKeyDown)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup',   onPointerUp)
      canvas.removeEventListener('dblclick',    onDoubleClick)
      window.removeEventListener('keydown',     onKeyDown)
    }
  }, [hitTest, onCancel, onChange, onCommit, pointerToScene, selectedIdx])

  // ── Toolbar callbacks ────────────────────────────────────────────────────
  const setSelectedToSmooth = useCallback(() => {
    if (selectedIdx === null) return
    const A = anchorsRef.current
    const a = A?.[selectedIdx]
    if (!a) return
    const { prev, next: nxt } = neighbourAnchors(A, selectedIdx, closedRef.current)
    const tx = (nxt.x - prev.x) * 0.25
    const ty = (nxt.y - prev.y) * 0.25
    const next = A.map((an, j) =>
      j !== selectedIdx
        ? an
        : { ...an, outX: an.x + tx, outY: an.y + ty, inX: an.x - tx, inY: an.y - ty },
    )
    onChange(next); onCommit(next)
  }, [onChange, onCommit, selectedIdx])

  const setSelectedToCorner = useCallback(() => {
    if (selectedIdx === null) return
    const A = anchorsRef.current
    if (!A?.[selectedIdx]) return
    const next = A.map((an, j) => (j !== selectedIdx ? an : { x: an.x, y: an.y }))
    onChange(next); onCommit(next)
  }, [onChange, onCommit, selectedIdx])

  const deleteSelected = useCallback(() => {
    if (selectedIdx === null) return
    const A = anchorsRef.current
    if (!A || A.length <= 2) return
    const next = A.filter((_, i) => i !== selectedIdx)
    setSelectedIdx(prev => (prev === null ? null : Math.min(prev, next.length - 1)))
    onChange(next); onCommit(next)
  }, [onChange, onCommit, selectedIdx])

  const selectedAnchor = selectedIdx !== null ? anchors[selectedIdx] ?? null : null
  const selectedIsSmooth = selectedAnchor
    ? selectedAnchor.outX !== undefined || selectedAnchor.inX !== undefined
    : false

  // ── Toolbar UI ───────────────────────────────────────────────────────────
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
        'flex items-center gap-1 rounded-xl px-2 py-1.5',
        'border border-[var(--border)] bg-[var(--surface)]/95 shadow-xl backdrop-blur-md',
        'text-[12px] font-medium text-[var(--text)] whitespace-nowrap',
      ].join(' ')}
    >
      {selectedIdx !== null && selectedAnchor && (
        <>
          <button
            type="button"
            title="Smooth (handles mirror)"
            className={[
              'flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors',
              selectedIsSmooth
                ? 'bg-[var(--hover-strong)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--hover)]',
            ].join(' ')}
            onClick={setSelectedToSmooth}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 9 Q7 1 12 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <circle cx="7" cy="5" r="1.5" fill="currentColor"/>
            </svg>
            Smooth
          </button>

          <button
            type="button"
            title="Corner (handles independent)"
            className={[
              'flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors',
              !selectedIsSmooth
                ? 'bg-[var(--hover-strong)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--hover)]',
            ].join(' ')}
            onClick={setSelectedToCorner}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 11 L7 3 L12 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <circle cx="7" cy="3" r="1.5" fill="currentColor"/>
            </svg>
            Corner
          </button>

          <div className="mx-1 h-4 w-px bg-[var(--border)]" />

          <button
            type="button"
            title="Delete point (Backspace)"
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-red-500 transition-colors hover:bg-red-50"
            onClick={deleteSelected}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Delete
          </button>

          <div className="mx-1 h-4 w-px bg-[var(--border)]" />
        </>
      )}

      <span className="select-none px-1 text-[var(--text-muted)]">
        {selectedIdx !== null
          ? 'Drag handles to curve · Alt = break symmetry · Dbl-click anchor to toggle'
          : 'Click path to add point · Click anchor to select'}
      </span>

      <div className="mx-1 h-4 w-px bg-[var(--border)]" />

      <button
        type="button"
        className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
        onClick={onCancel}
        title="Exit point editing (Esc)"
      >
        Done
      </button>
    </div>
  )
}