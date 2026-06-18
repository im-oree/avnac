import { Cancel01Icon, Tick02Icon, RotateClockwiseIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './ui'

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_SIDE = 12
const HANDLE_PX = 8
const ROTATION_MIN = -180
const ROTATION_MAX = 180
const ASPECT_MATCH_TOLERANCE = 0.015

type CropRect = { x: number; y: number; w: number; h: number; rotation: number }
type FrameSize = { width: number; height: number }

export type ImageCropModalApplyPayload = {
  cropX: number
  cropY: number
  width: number
  height: number
  cropRotation: number
}

type Props = {
  open: boolean
  imageSrc: string
  initialCrop: CropRect
  initialFrame: FrameSize
  onCancel: () => void
  onApply: (rect: ImageCropModalApplyPayload) => void
}

type DragKind = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

type AspectPreset = {
  id: string
  label: string
  ratio: number | 'original' | 'frame' | null
}

const ASPECT_PRESETS: readonly AspectPreset[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'square', label: '1:1', ratio: 1 },
  { id: 'landscape', label: '16:9', ratio: 16 / 9 },
  { id: 'story', label: '9:16', ratio: 9 / 16 },
  { id: 'portrait', label: '4:5', ratio: 4 / 5 },
  { id: 'post', label: '5:4', ratio: 5 / 4 },
  { id: 'photo', label: '3:2', ratio: 3 / 2 },
  { id: 'classic', label: '4:3', ratio: 4 / 3 },
  { id: 'current', label: 'Frame', ratio: 'frame' },
  { id: 'original', label: 'Original', ratio: 'original' },
]

// ─── Math helpers ─────────────────────────────────────────────────────────────

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function safeMinSide(nw: number, nh: number) {
  return Math.max(1, Math.min(MIN_SIDE, nw, nh))
}

function clampRotation(value: number) {
  if (!Number.isFinite(value)) return 0
  return clampNumber(Math.round(value * 10) / 10, ROTATION_MIN, ROTATION_MAX)
}

function clampCrop(r: CropRect, nw: number, nh: number): CropRect {
  const minSide = safeMinSide(nw, nh)
  let { x, y, w, h } = r
  x = clampNumber(x, 0, Math.max(0, nw - minSide))
  y = clampNumber(y, 0, Math.max(0, nh - minSide))
  w = clampNumber(w, minSide, Math.max(minSide, nw - x))
  h = clampNumber(h, minSide, Math.max(minSide, nh - y))
  return { x, y, w, h, rotation: clampRotation(r.rotation) }
}

function clampAspectCrop(r: CropRect, nw: number, nh: number, aspect: number): CropRect {
  const safeAspect = Math.max(0.001, aspect)
  const maxWidth = Math.max(1, Math.min(nw, nh * safeAspect))
  const maxHeight = Math.max(1, maxWidth / safeAspect)
  let width = clampNumber(r.w, 1, maxWidth)
  let height = width / safeAspect

  if (height > maxHeight) {
    height = maxHeight
    width = height * safeAspect
  }

  const minSide = Math.min(safeMinSide(nw, nh), maxWidth, maxHeight)
  if (width < minSide || height < minSide) {
    if (safeAspect >= 1) {
      height = Math.min(maxHeight, minSide)
      width = height * safeAspect
    } else {
      width = Math.min(maxWidth, minSide)
      height = width / safeAspect
    }
  }

  return {
    x: clampNumber(r.x, 0, Math.max(0, nw - width)),
    y: clampNumber(r.y, 0, Math.max(0, nh - height)),
    w: width,
    h: height,
    rotation: clampRotation(r.rotation),
  }
}

function fitCropToAspect(crop: CropRect, nw: number, nh: number, aspect: number): CropRect {
  const safeAspect = Math.max(0.001, aspect)
  const maxWidth = Math.min(nw, nh * safeAspect)
  const maxHeight = Math.min(nh, nw / safeAspect)
  let width = crop.w
  let height = crop.h

  if (width / Math.max(1, height) > safeAspect) {
    width = height * safeAspect
  } else {
    height = width / safeAspect
  }
  if (width > maxWidth) { width = maxWidth; height = width / safeAspect }
  if (height > maxHeight) { height = maxHeight; width = height * safeAspect }

  const cx = crop.x + crop.w / 2
  const cy = crop.y + crop.h / 2
  return clampAspectCrop(
    { x: cx - width / 2, y: cy - height / 2, w: width, h: height, rotation: crop.rotation },
    nw, nh, safeAspect,
  )
}

function fitRotatedCropInsideImage(crop: CropRect, nw: number, nh: number): CropRect {
  const clamped = clampCrop(crop, nw, nh)
  const rotation = clampRotation(clamped.rotation)
  if (Math.abs(rotation) < 0.001) return { ...clamped, rotation }

  const aspect = Math.max(0.001, clamped.w / Math.max(1, clamped.h))
  const cx = clamped.x + clamped.w / 2
  const cy = clamped.y + clamped.h / 2
  const ax = Math.max(0, Math.min(cx, nw - cx))
  const ay = Math.max(0, Math.min(cy, nh - cy))
  const rad = (rotation * Math.PI) / 180
  const ac = Math.abs(Math.cos(rad))
  const as_ = Math.abs(Math.sin(rad))
  const wfx = (2 * ax) / Math.max(0.0001, ac + as_ / aspect)
  const wfy = (2 * ay) / Math.max(0.0001, as_ + ac / aspect)
  const maxW = Math.max(1, Math.min(nw, nh * aspect, wfx, wfy))
  const width = Math.max(1, Math.min(clamped.w, maxW))
  const height = Math.max(1, width / aspect)

  return {
    x: clampNumber(cx - width / 2, 0, Math.max(0, nw - width)),
    y: clampNumber(cy - height / 2, 0, Math.max(0, nh - height)),
    w: width,
    h: height,
    rotation,
  }
}

function resolvePresetRatio(
  preset: AspectPreset,
  natural: { w: number; h: number },
  frame: FrameSize,
) {
  if (preset.ratio === null) return null
  if (preset.ratio === 'original') return natural.w > 0 && natural.h > 0 ? natural.w / natural.h : null
  if (preset.ratio === 'frame') return frame.width > 0 && frame.height > 0 ? frame.width / frame.height : null
  return preset.ratio
}

function findMatchingPresetId(aspect: number, natural: { w: number; h: number }, frame: FrameSize) {
  if (!Number.isFinite(aspect) || aspect <= 0) return 'free'
  for (const preset of ASPECT_PRESETS) {
    if (preset.ratio === null) continue
    const ratio = resolvePresetRatio(preset, natural, frame)
    if (ratio && Math.abs(ratio - aspect) <= ASPECT_MATCH_TOLERANCE) return preset.id
  }
  return 'free'
}

function resizeCropFromHandle(
  start: CropRect, kind: DragKind, dx: number, dy: number,
  nw: number, nh: number, aspect: number | null,
): CropRect {
  if (kind === 'move') {
    return clampCrop({ ...start, x: start.x + dx, y: start.y + dy }, nw, nh)
  }

  if (!aspect) {
    const next = { ...start }
    if (kind.includes('e')) next.w = start.w + dx
    if (kind.includes('w')) { next.x = start.x + dx; next.w = start.w - dx }
    if (kind.includes('s')) next.h = start.h + dy
    if (kind.includes('n')) { next.y = start.y + dy; next.h = start.h - dy }
    if (next.w < MIN_SIDE) {
      if (kind.includes('w')) next.x = start.x + start.w - MIN_SIDE
      next.w = MIN_SIDE
    }
    if (next.h < MIN_SIDE) {
      if (kind.includes('n')) next.y = start.y + start.h - MIN_SIDE
      next.h = MIN_SIDE
    }
    return clampCrop(next, nw, nh)
  }

  const cx = start.x + start.w / 2
  const cy = start.y + start.h / 2
  const hasH = kind.includes('e') || kind.includes('w')
  const hasV = kind.includes('n') || kind.includes('s')
  let width = start.w
  let height = start.h

  if (hasH) width = kind.includes('w') ? start.w - dx : start.w + dx
  if (hasV) height = kind.includes('n') ? start.h - dy : start.h + dy

  if (hasH && !hasV) height = width / aspect
  else if (hasV && !hasH) width = height * aspect
  else {
    if (Math.abs(width - start.w) >= Math.abs(height - start.h) * aspect) height = width / aspect
    else width = height * aspect
  }

  width = Math.max(MIN_SIDE, width)
  height = Math.max(MIN_SIDE, height)

  const x = kind.includes('w') ? start.x + start.w - width : kind.includes('e') ? start.x : cx - width / 2
  const y = kind.includes('n') ? start.y + start.h - height : kind.includes('s') ? start.y : cy - height / 2

  return clampAspectCrop({ x, y, w: width, h: height, rotation: start.rotation }, nw, nh, aspect)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageCropModal({
  open, imageSrc, initialCrop, initialFrame, onCancel, onApply,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const initialCropRef = useRef(initialCrop)
  initialCropRef.current = initialCrop

  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [crop, setCrop] = useState<CropRect>(initialCrop)
  const [boxPx, setBoxPx] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const [aspectPresetId, setAspectPresetId] = useState('free')
  const [showRotation, setShowRotation] = useState(false)
  const [renderedImgSize, setRenderedImgSize] = useState({ w: 0, h: 0 })
  const [, layoutBump] = useReducer((n: number) => n + 1, 0)

  const dragRef = useRef<{
    kind: DragKind
    startClientX: number
    startClientY: number
    start: CropRect
    scale: number
    aspect: number | null
  } | null>(null)

  const selectedPreset = ASPECT_PRESETS.find(p => p.id === aspectPresetId) ?? ASPECT_PRESETS[0]
  const selectedAspect = resolvePresetRatio(selectedPreset, natural, initialFrame)

  // ── Compute how large the image should render to fit the canvas ──

  const computeFitSize = useCallback(() => {
    const container = canvasRef.current
    if (!container || natural.w <= 0 || natural.h <= 0) return

    const padding = 48
    const rect = container.getBoundingClientRect()
    const availW = Math.max(100, rect.width - padding * 2)
    const availH = Math.max(100, rect.height - padding * 2)

    const scaleX = availW / natural.w
    const scaleY = availH / natural.h
    // Never upscale past 100%, and fit within available space
    const fitScale = Math.min(1, scaleX, scaleY)

    setRenderedImgSize({
      w: Math.round(natural.w * fitScale),
      h: Math.round(natural.h * fitScale),
    })
  }, [natural.w, natural.h])

  // ── Effects ──

  useEffect(() => {
    if (!open) {
      setNatural({ w: 0, h: 0 })
      setRenderedImgSize({ w: 0, h: 0 })
      setShowRotation(false)
      return
    }
    const nextCrop = { ...initialCrop, rotation: clampRotation(initialCrop.rotation) }
    const initialAspect =
      initialFrame.width > 0 && initialFrame.height > 0
        ? initialFrame.width / initialFrame.height
        : nextCrop.w / Math.max(1, nextCrop.h)
    setCrop(nextCrop)
    setAspectPresetId(findMatchingPresetId(initialAspect, { w: 0, h: 0 }, initialFrame))
    if (Math.abs(nextCrop.rotation) > 0.01) setShowRotation(true)
  }, [open, initialCrop.x, initialCrop.y, initialCrop.w, initialCrop.h, initialCrop.rotation, initialFrame.width, initialFrame.height])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && natural.w > 0) {
        onApply({ cropX: crop.x, cropY: crop.y, width: crop.w, height: crop.h, cropRotation: crop.rotation })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel, onApply, natural.w, crop])

  useEffect(() => {
    if (!open) return
    const onResize = () => {
      computeFitSize()
      layoutBump()
    }
    window.addEventListener('resize', onResize)
    const el = canvasRef.current
    let ro: ResizeObserver | null = null
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        computeFitSize()
        layoutBump()
      })
      ro.observe(el)
    }
    return () => { window.removeEventListener('resize', onResize); ro?.disconnect() }
  }, [open, computeFitSize])

  useEffect(() => {
    if (!open || natural.w <= 0 || natural.h <= 0 || !selectedAspect) return
    setCrop(current =>
      fitRotatedCropInsideImage(
        fitCropToAspect(current, natural.w, natural.h, selectedAspect),
        natural.w, natural.h,
      ),
    )
  }, [open, natural.w, natural.h, selectedAspect])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Recompute fit whenever natural size is known
  useEffect(() => {
    computeFitSize()
  }, [computeFitSize])

  const onImgLoad = useCallback(() => {
    const el = imgRef.current
    if (!el) return
    const nw = el.naturalWidth
    const nh = el.naturalHeight
    if (nw <= 0 || nh <= 0) return
    setNatural({ w: nw, h: nh })
    const ic = initialCropRef.current
    setCrop(clampCrop({ x: ic.x, y: ic.y, w: ic.w, h: ic.h, rotation: ic.rotation }, nw, nh))
    layoutBump()
  }, [])

  // Compute the pixel-space crop overlay box
  useLayoutEffect(() => {
    if (!open || natural.w <= 0 || renderedImgSize.w <= 0) {
      setBoxPx({ left: 0, top: 0, width: 0, height: 0 })
      return
    }
    const scale = renderedImgSize.w / natural.w
    setBoxPx({
      left: crop.x * scale,
      top: crop.y * scale,
      width: crop.w * scale,
      height: crop.h * scale,
    })
  }, [open, natural.w, renderedImgSize.w, crop.x, crop.y, crop.w, crop.h, layoutBump])

  const onPointerDownCrop = useCallback(
    (e: React.PointerEvent, kind: DragKind) => {
      e.preventDefault()
      e.stopPropagation()
      if (natural.w <= 0 || renderedImgSize.w <= 0) return
      const scale = renderedImgSize.w / natural.w
      dragRef.current = {
        kind, startClientX: e.clientX, startClientY: e.clientY,
        start: { ...crop }, scale, aspect: selectedAspect,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [crop, natural.w, renderedImgSize.w, selectedAspect],
  )

  useEffect(() => {
    if (!open) return
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d || natural.w <= 0 || natural.h <= 0) return
      const dx = (e.clientX - d.startClientX) / d.scale
      const dy = (e.clientY - d.startClientY) / d.scale
      setCrop(fitRotatedCropInsideImage(
        resizeCropFromHandle(d.start, d.kind, dx, dy, natural.w, natural.h, d.aspect),
        natural.w, natural.h,
      ))
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [open, natural.w, natural.h])

  const chooseAspectPreset = useCallback(
    (preset: AspectPreset) => {
      setAspectPresetId(preset.id)
      const ratio = resolvePresetRatio(preset, natural, initialFrame)
      if (ratio && natural.w > 0 && natural.h > 0) {
        setCrop(current => fitRotatedCropInsideImage(
          fitCropToAspect(current, natural.w, natural.h, ratio), natural.w, natural.h,
        ))
      }
    },
    [natural, initialFrame],
  )

  const updateCropRotation = useCallback(
    (value: number) => {
      const next = clampRotation(value)
      setCrop(current =>
        natural.w > 0 && natural.h > 0
          ? fitRotatedCropInsideImage({ ...current, rotation: next }, natural.w, natural.h)
          : { ...current, rotation: next },
      )
    },
    [natural.w, natural.h],
  )

  const applyCrop = useCallback(() => {
    onApply({ cropX: crop.x, cropY: crop.y, width: crop.w, height: crop.h, cropRotation: crop.rotation })
  }, [crop, onApply])

  if (!open || typeof document === 'undefined') return null

  const imgReady = natural.w > 0 && natural.h > 0 && renderedImgSize.w > 0
  const cropDims = `${Math.round(crop.w)} × ${Math.round(crop.h)}`

  const boxStyle: CSSProperties = imgReady
    ? { left: boxPx.left, top: boxPx.top, width: boxPx.width, height: boxPx.height }
    : { display: 'none' }

  const imageStyle: CSSProperties = imgReady
    ? {
        width: renderedImgSize.w,
        height: renderedImgSize.h,
        transform: `rotate(${crop.rotation}deg)`,
        transformOrigin: `${boxPx.left + boxPx.width / 2}px ${boxPx.top + boxPx.height / 2}px`,
      }
    : {}

  const handle = (kind: DragKind, pos: string) => (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      className={`absolute z-10 rounded-full border-[1.5px] border-white bg-[var(--accent)] shadow-sm ${pos}`}
      style={{ width: HANDLE_PX, height: HANDLE_PX, margin: -HANDLE_PX / 2 }}
      onPointerDown={e => onPointerDownCrop(e, kind)}
    />
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[56rem] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_80px_rgba(0,0,0,0.3)]">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[0.9rem] font-semibold text-[var(--text)]">Crop Image</h2>
            {imgReady && (
              <>
                <span className="rounded-md bg-[var(--hover)] px-1.5 py-0.5 text-[0.625rem] font-medium tabular-nums text-[var(--text-muted)]">
                  {cropDims}
                </span>
                <span className="rounded-md bg-[var(--hover)] px-1.5 py-0.5 text-[0.625rem] font-medium tabular-nums text-[var(--text-muted)]">
                  {natural.w} × {natural.h} original
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
            aria-label="Close"
            onClick={onCancel}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 py-2 overflow-x-auto">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-0.5">
            {ASPECT_PRESETS.map(preset => {
              const active = aspectPresetId === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  aria-pressed={active}
                  onClick={() => chooseAspectPreset(preset)}
                  className={`rounded-md px-2 py-1 text-[0.625rem] font-semibold tracking-wide transition ${
                    active
                      ? 'bg-[var(--text)] text-[var(--surface)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          <div className="mx-1 h-5 w-px bg-[var(--border)]" />

          <button
            type="button"
            onClick={() => setShowRotation(v => !v)}
            className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[0.6875rem] font-medium transition ${
              showRotation
                ? 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
            }`}
          >
            <HugeiconsIcon icon={RotateClockwiseIcon} size={12} strokeWidth={1.8} />
            Rotate
            {Math.abs(crop.rotation) > 0.01 && (
              <span className="ml-0.5 tabular-nums">{crop.rotation.toFixed(1)}°</span>
            )}
          </button>
        </div>

        {/* Rotation panel */}
        {showRotation && (
          <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-2.5">
            <span className="shrink-0 text-[0.6875rem] font-medium text-[var(--text-subtle)]">
              Rotation
            </span>
            <input
              type="range"
              min={ROTATION_MIN}
              max={ROTATION_MAX}
              step={0.5}
              value={crop.rotation}
              onChange={e => updateCropRotation(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border)] outline-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[var(--border-strong)] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={ROTATION_MIN}
                max={ROTATION_MAX}
                step={1}
                value={Math.round(crop.rotation)}
                onChange={e => updateCropRotation(Number(e.target.value))}
                className="h-7 w-14 rounded-md border border-[var(--border)] bg-[var(--surface)] text-center text-[0.75rem] font-medium tabular-nums text-[var(--text)] outline-none focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/20"
              />
              <span className="text-[0.6875rem] text-[var(--text-subtle)]">°</span>
              <button
                type="button"
                onClick={() => updateCropRotation(0)}
                className="ml-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.625rem] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Canvas area */}
        <div
          ref={canvasRef}
          className="relative min-h-0 flex-1 overflow-hidden bg-neutral-900/90"
        >
          <div
            ref={wrapRef}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="relative" style={{ width: renderedImgSize.w || 'auto', height: renderedImgSize.h || 'auto' }}>
              <img
                key={imageSrc}
                ref={imgRef}
                src={imageSrc}
                alt=""
                className="block select-none"
                style={imageStyle}
                draggable={false}
                onLoad={onImgLoad}
              />
              {imgReady && (
                <div
                  className="pointer-events-none absolute left-0 top-0"
                  style={{ width: renderedImgSize.w, height: renderedImgSize.h }}
                >
                  {/* Crop overlay */}
                  <div
                    className="pointer-events-auto absolute z-[1] cursor-move border border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                    style={boxStyle}
                    onPointerDown={e => onPointerDownCrop(e, 'move')}
                  >
                    {/* Rule of thirds */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-40"
                      style={{
                        backgroundImage:
                          'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
                        backgroundSize: '33.333% 100%, 100% 33.333%',
                      }}
                      aria-hidden
                    />

                    {handle('nw', 'left-0 top-0 cursor-nwse-resize')}
                    {handle('n', 'left-1/2 top-0 -translate-x-1/2 cursor-ns-resize')}
                    {handle('ne', 'right-0 top-0 cursor-nesw-resize')}
                    {handle('e', 'right-0 top-1/2 -translate-y-1/2 cursor-ew-resize')}
                    {handle('se', 'right-0 bottom-0 cursor-nwse-resize')}
                    {handle('s', 'bottom-0 left-1/2 -translate-x-1/2 cursor-ns-resize')}
                    {handle('sw', 'bottom-0 left-0 cursor-nesw-resize')}
                    {handle('w', 'left-0 top-1/2 -translate-y-1/2 cursor-ew-resize')}

                    {/* Size badge */}
                    <div className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-1.5 py-0.5 text-[0.5625rem] font-medium tabular-nums text-white/80 backdrop-blur-sm">
                      {cropDims}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-2 text-[0.6875rem] text-[var(--text-subtle)]">
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-1 py-0.5 text-[0.5625rem] font-semibold">⌘↵</kbd>
            <span>to apply</span>
            <span className="mx-1 opacity-30">·</span>
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-1 py-0.5 text-[0.5625rem] font-semibold">Esc</kbd>
            <span>to cancel</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!imgReady}
              onClick={applyCrop}
              iconBefore={<HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={2} />}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}