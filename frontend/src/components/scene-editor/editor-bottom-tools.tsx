// editor-bottom-tools.tsx
import { HelpCircleIcon } from '@hugeicons/core-free-icons'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import CanvasZoomSlider from '../canvas-zoom-slider'
import { IconButton } from '../ui'

export function EditorBottomTools({
  maxZoom,
  minZoom,
  onZoomFitRequest,
  onZoomSliderChange,
  ready,
  setShortcutsOpen,
  zoomPercent,
}: {
  maxZoom: number
  minZoom: number
  onZoomFitRequest: () => void
  onZoomSliderChange: (pct: number) => void
  ready: boolean
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>
  zoomPercent: number | null
}) {
  return (
    <>
      {/* Zoom slider (bottom-right) */}
      <div className="pointer-events-auto absolute bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] right-3 z-30 sm:right-4">
        {ready && zoomPercent !== null ? (
          <CanvasZoomSlider
            value={zoomPercent}
            min={minZoom}
            max={maxZoom}
            onChange={onZoomSliderChange}
            onFitRequest={onZoomFitRequest}
          />
        ) : null}
      </div>

      {/* Shortcuts help button (bottom-left) */}
      <div className="pointer-events-auto absolute bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] left-3 z-30">
        <IconButton
          icon={HelpCircleIcon}
          label="Keyboard shortcuts"
          disabled={!ready}
          size="md"
          className="rounded-full bg-[var(--surface-raised)]/90 backdrop-blur-md"
          onClick={() => setShortcutsOpen(true)}
          strokeWidth={1.75}
          title="Shortcuts (?)"
        />
      </div>
    </>
  )
}