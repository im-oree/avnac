// model-window.tsx
import { useEffect, useRef, useId, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import ImageInspectorTabs from './image-inspector-tabs'
import { Button } from '../ui'
import type { SceneImage } from '../../lib/avnac-scene'

// ─── Constants ────────────────────────────────────────────────────────────────

const ZOOM_MIN = 0.05
const ZOOM_MAX = 8
const ZOOM_STEP = 0.1
const ZOOM_SCROLL_FACTOR = 0.002
const FIT_PADDING = 40

const ZOOM_PRESETS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '100%', value: 1 },
  { label: '200%', value: 2 },
  { label: '400%', value: 4 },
] as const

// ─── Zoomable / pannable image viewer ─────────────────────────────────────────

function ImageViewer({
  src,
  naturalWidth,
  naturalHeight,
  alphaMask,
}: {
  src: string
  naturalWidth: number
  naturalHeight: number
  alphaMask?: Uint8Array | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  // Fit image to container on mount and when image changes
  const fitToView = useCallback(() => {
    const container = containerRef.current
    if (!container || !naturalWidth || !naturalHeight) return
    const rect = container.getBoundingClientRect()
    const scaleX = (rect.width - FIT_PADDING * 2) / naturalWidth
    const scaleY = (rect.height - FIT_PADDING * 2) / naturalHeight
    const fitZoom = Math.min(scaleX, scaleY, 1)
    setZoom(Math.max(ZOOM_MIN, fitZoom))
    setPan({ x: 0, y: 0 })
  }, [naturalWidth, naturalHeight])

  useEffect(() => {
    fitToView()
  }, [fitToView])

  // Keyboard: space for pan mode, +/- for zoom, 0 for fit
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setSpaceHeld(true)
      }
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP))
      }
      if (e.key === '-') {
        e.preventDefault()
        setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP))
      }
      if (e.key === '0') {
        e.preventDefault()
        fitToView()
      }
      if (e.key === '1') {
        e.preventDefault()
        setZoom(1)
        setPan({ x: 0, y: 0 })
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [fitToView])

  // Scroll to zoom (pinch-to-zoom on trackpad)
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const cursorX = e.clientX - rect.left - rect.width / 2
      const cursorY = e.clientY - rect.top - rect.height / 2

      const delta = -e.deltaY * ZOOM_SCROLL_FACTOR
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * (1 + delta)))
      const scaleFactor = newZoom / zoom

      setPan(p => ({
        x: cursorX - scaleFactor * (cursorX - p.x),
        y: cursorY - scaleFactor * (cursorY - p.y),
      }))
      setZoom(newZoom)
    },
    [zoom],
  )

  // Pan with middle mouse or space+left click
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const isMiddle = e.button === 1
      const isSpaceDrag = e.button === 0 && spaceHeld
      if (!isMiddle && !isSpaceDrag) return
      e.preventDefault()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    },
    [spaceHeld, pan],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning || !panStart.current) return
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy })
    },
    [isPanning],
  )

  const onPointerUp = useCallback(() => {
    setIsPanning(false)
    panStart.current = null
  }, [])

  const zoomPercent = Math.round(zoom * 100)

  return (
    <div className="flex h-full flex-col">
      {/* Viewport */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        style={{
          cursor: isPanning ? 'grabbing' : spaceHeld ? 'grab' : 'default',
          touchAction: 'none',
        }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Checkerboard background layer */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #d4d4d4 25%, transparent 25%), linear-gradient(-45deg, #d4d4d4 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d4 75%), linear-gradient(-45deg, transparent 75%, #d4d4d4 75%)',
            backgroundSize: `${Math.max(8, 16 * zoom)}px ${Math.max(8, 16 * zoom)}px`,
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
            opacity: 0.3,
          }}
        />

        {/* Image */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
            willChange: 'transform',
          }}
        >
          <div
            className="relative"
            style={{
              width: naturalWidth * zoom,
              height: naturalHeight * zoom,
            }}
          >
            {/* Checkerboard behind image for transparency */}
            <div
              className="absolute inset-0 rounded-sm"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #e8e8e8 25%, #fff 25%, #fff 50%, #e8e8e8 50%, #e8e8e8 75%, #fff 75%)',
                backgroundSize: `${Math.max(6, 12 * zoom)}px ${Math.max(6, 12 * zoom)}px`,
              }}
            />
            <img
              src={src}
              alt="Preview"
              draggable={false}
              className="relative block select-none"
              style={{
                width: naturalWidth * zoom,
                height: naturalHeight * zoom,
                imageRendering: zoom > 3 ? 'pixelated' : 'auto',
              }}
            />
            {/* Pixel grid at high zoom */}
            {zoom >= 4 && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)
                  `,
                  backgroundSize: `${zoom}px ${zoom}px`,
                }}
              />
            )}
          </div>
        </div>

        {/* Crosshair */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
          <div className="absolute h-full w-px bg-[var(--text)]" />
          <div className="absolute h-px w-full bg-[var(--text)]" />
        </div>
      </div>

      {/* Zoom toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
        <div className="flex items-center gap-1">
          {/* Zoom out */}
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
            disabled={zoom <= ZOOM_MIN}
            className="flex size-6 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-30"
            title="Zoom out (−)"
          >
            <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 8h10" />
            </svg>
          </button>

          {/* Zoom slider */}
          <input
            type="range"
            min={ZOOM_MIN * 100}
            max={ZOOM_MAX * 100}
            value={zoom * 100}
            onChange={e => setZoom(Number(e.target.value) / 100)}
            className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-[var(--border)] outline-none [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--text)] [&::-webkit-slider-thumb]:shadow-sm"
          />

          {/* Zoom in */}
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
            disabled={zoom >= ZOOM_MAX}
            className="flex size-6 items-center justify-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-30"
            title="Zoom in (+)"
          >
            <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 8h10M8 3v10" />
            </svg>
          </button>

          {/* Percentage display */}
          <span className="ml-1 min-w-[3rem] text-center text-[0.6875rem] font-medium tabular-nums text-[var(--text-muted)]">
            {zoomPercent}%
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Presets */}
          {ZOOM_PRESETS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setZoom(p.value)
                setPan({ x: 0, y: 0 })
              }}
              className={`rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium transition ${
                Math.abs(zoom - p.value) < 0.01
                  ? 'bg-[var(--hover-strong)] text-[var(--text)]'
                  : 'text-[var(--text-subtle)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
              }`}
            >
              {p.label}
            </button>
          ))}

          {/* Fit */}
          <button
            type="button"
            onClick={fitToView}
            className="ml-1 rounded-md px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--text-subtle)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
            title="Fit to view (0)"
          >
            Fit
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function ModelWindow({
  open,
  onClose,
  selectedImage,
  updateSelected,
}: {
  open: boolean
  onClose: () => void
  selectedImage: SceneImage
  updateSelected: (fn: (o: SceneImage) => SceneImage) => void
}) {
  const portalRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousActiveRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)

  const imageSrc =
    (selectedImage as any).src ??
    (selectedImage as any).url ??
    (selectedImage as any).imageUrl ??
    ''

  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = imageSrc
  }, [imageSrc])

  const imgW = naturalSize?.w ?? selectedImage.width ?? 400
  const imgH = naturalSize?.h ?? selectedImage.height ?? 400

  if (portalRef.current === null && typeof document !== 'undefined') {
    const el = document.createElement('div')
    el.className = 'avnac-modal-window-portal'
    portalRef.current = el
  }

  useEffect(() => {
    const el = portalRef.current
    if (!el || typeof document === 'undefined') return
    document.body.appendChild(el)
    return () => {
      try {
        document.body.removeChild(el)
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    previousActiveRef.current = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    const raf = requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
      previousActiveRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open || !portalRef.current) return null

  const dimsLabel = `${imgW} × ${imgH}`

  const content = (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 h-full w-full cursor-default bg-black/50 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className="relative flex h-[min(92vh,880px)] w-[min(1280px,97vw)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_80px_rgba(0,0,0,0.32)]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <h3 id={titleId} className="text-[0.875rem] font-semibold text-[var(--text)] truncate">
                Image Tools
              </h3>
              <span className="shrink-0 rounded-md bg-[var(--hover)] px-1.5 py-0.5 text-[0.625rem] font-medium tabular-nums text-[var(--text-muted)]">
                {dimsLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <p id={descriptionId} className="text-[0.6875rem] text-[var(--text-subtle)] hidden sm:block">
                Scroll to zoom · Space+drag to pan
              </p>
              <Button onClick={onClose} ref={closeButtonRef as any}>
                Done
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left: zoomable image viewer */}
            <div className="flex flex-1 flex-col bg-[var(--surface-subtle)]">
              <ImageViewer
                src={imageSrc}
                naturalWidth={imgW}
                naturalHeight={imgH}
                alphaMask={selectedImage.alphaMask}
              />
            </div>

            {/* Right: tools panel */}
            <div className="w-[420px] shrink-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)]">
              <ImageInspectorTabs
                selectedImage={selectedImage}
                updateSelected={updateSelected}
                hidePreview
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, portalRef.current)
}