// canvas-zoom-slider.tsx
import { useEffect, useMemo, useState } from 'react'
import EditorRangeSlider from './editor-range-slider'

type CanvasZoomSliderProps = {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  onFitRequest?: () => void
  disabled?: boolean
}

const ZOOM_SNAP_POINTS = [5, 10, 25, 33, 50, 67, 75, 90, 100]
const ZOOM_STEP = 5
const ZOOM_FAST_STEP = 10
const SNAP_THRESHOLD = 2

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function maybeSnap(value: number, snapPoints: number[]) {
  let closest = value
  let closestDistance = Infinity

  for (const point of snapPoints) {
    const distance = Math.abs(value - point)
    if (distance < closestDistance) {
      closest = point
      closestDistance = distance
    }
  }

  return closestDistance <= SNAP_THRESHOLD ? closest : value
}

export default function CanvasZoomSlider({
  value,
  min = 5,
  max = 100,
  onChange,
  onFitRequest,
  disabled,
}: CanvasZoomSliderProps) {
  const [freeZoomMode, setFreeZoomMode] = useState(false)

  useEffect(() => {
    const updateModifierState = (event: KeyboardEvent) => {
      setFreeZoomMode(event.ctrlKey || event.metaKey)
    }

    const resetModifierState = () => setFreeZoomMode(false)

    window.addEventListener('keydown', updateModifierState)
    window.addEventListener('keyup', updateModifierState)
    window.addEventListener('blur', resetModifierState)

    return () => {
      window.removeEventListener('keydown', updateModifierState)
      window.removeEventListener('keyup', updateModifierState)
      window.removeEventListener('blur', resetModifierState)
    }
  }, [])

  const clampedValue = clamp(value, min, max)
  const displayValue = Math.round(clampedValue)

  const snapPoints = useMemo(
    () => ZOOM_SNAP_POINTS.filter(point => point >= min && point <= max),
    [min, max],
  )

  const applyValue = (nextValue: number) => {
    const clamped = clamp(nextValue, min, max)
    onChange(freeZoomMode ? clamped : maybeSnap(clamped, snapPoints))
  }

  const handleNudge = (direction: -1 | 1, accelerated: boolean) => {
    const step = accelerated ? ZOOM_FAST_STEP : ZOOM_STEP
    applyValue(displayValue + direction * step)
  }

  return (
    <div
      className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)]/95 px-2.5 py-2 backdrop-blur-md sm:gap-2.5"
      style={{ boxShadow: 'var(--card-shadow)' }}
      title={
        onFitRequest
          ? 'Drag to zoom. Click the percentage to fit the page in view. Hold Ctrl to bypass zoom snapping.'
          : 'Drag to zoom. Hold Ctrl to bypass zoom snapping.'
      }
    >
      <button
        type="button"
        disabled={disabled}
        onClick={event => handleNudge(-1, event.shiftKey)}
        aria-label="Zoom out"
        className="flex h-8 w-8 items-center justify-center rounded-xl text-base text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40"
      >
        −
      </button>

      <EditorRangeSlider
        min={min}
        max={max}
        step={1}
        value={displayValue}
        disabled={disabled}
        onChange={applyValue}
        aria-label="Canvas zoom"
        trackClassName="w-[8.5rem] sm:w-40"
      />

      <button
        type="button"
        disabled={disabled}
        onClick={event => handleNudge(1, event.shiftKey)}
        aria-label="Zoom in"
        className="flex h-8 w-8 items-center justify-center rounded-xl text-base text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40"
      >
        +
      </button>

      <div
        className={[
          'hidden rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] sm:block',
          freeZoomMode
            ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]'
            : 'border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]',
        ].join(' ')}
        aria-hidden
      >
        {freeZoomMode ? 'Free' : 'Snap'}
      </div>

      {onFitRequest ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onFitRequest}
          className="min-w-[3.25rem] rounded-xl px-2 py-1 text-left text-sm font-medium tabular-nums text-[var(--text-muted)] outline-none transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40"
          title="Fit page in view"
        >
          {displayValue}%
        </button>
      ) : (
        <span className="min-w-[3.25rem] px-2 py-1 text-sm tabular-nums text-[var(--text-muted)]">
          {displayValue}%
        </span>
      )}
    </div>
  )
}