// canvas-zoom-slider.tsx
import EditorRangeSlider from './editor-range-slider'

type CanvasZoomSliderProps = {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  onFitRequest?: () => void
  disabled?: boolean
}

export default function CanvasZoomSlider({
  value,
  min = 5,
  max = 100,
  onChange,
  onFitRequest,
  disabled,
}: CanvasZoomSliderProps) {
  const displayValue = Math.round(value)

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 sm:bg-[var(--surface)]/90"
      style={{ boxShadow: 'var(--card-shadow)' }}
      title="Drag to zoom. Click the percentage to fit the page in view."
    >
      <EditorRangeSlider
        min={min}
        max={max}
        step={1}
        value={displayValue}
        disabled={disabled}
        onChange={onChange}
        aria-label="Canvas zoom"
        trackClassName="w-[9.5rem] sm:w-40"
      />
      {onFitRequest ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onFitRequest}
          className="min-w-[2.75rem] text-left text-sm tabular-nums text-[var(--text-muted)] outline-none transition-colors hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40"
        >
          {displayValue}%
        </button>
      ) : (
        <span className="min-w-[2.75rem] text-sm tabular-nums text-[var(--text-muted)]">
          {displayValue}%
        </span>
      )}
    </div>
  )
}