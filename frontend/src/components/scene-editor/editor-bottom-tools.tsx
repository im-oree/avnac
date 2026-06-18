// editor-bottom-tools.tsx
import { HelpCircleIcon, PenTool03Icon } from '@hugeicons/core-free-icons'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { PopoverShapeKind, ShapesQuickAddKind } from '../shapes-popover'
import CanvasZoomSlider from '../canvas-zoom-slider'
import { IconButton } from '../ui'

export function EditorBottomTools({
  addShapeFromKind,
  addText,
  imageInputRef,
  maxZoom,
  minZoom,
  onZoomFitRequest,
  onZoomSliderChange,
  ready,
  setShapesPopoverOpen,
  setShapesQuickAddKind,
  setShortcutsOpen,
  onStartDraw,
  shapeToolSplitRef,
  shapesPopoverOpen,
  shapesQuickAddKind,
  zoomPercent,
}: {
  addShapeFromKind?: (kind: PopoverShapeKind) => void
  addText?: () => void
  imageInputRef?: RefObject<HTMLInputElement | null>
  maxZoom: number
  minZoom: number
  onZoomFitRequest: () => void
  onZoomSliderChange: (pct: number) => void
  ready: boolean
  setShapesPopoverOpen?: (open: boolean) => void
  setShapesQuickAddKind?: (k: ShapesQuickAddKind) => void
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>
  onStartDraw?: () => void
  shapeToolSplitRef?: RefObject<HTMLDivElement | null>
  shapesPopoverOpen?: boolean
  shapesQuickAddKind?: ShapesQuickAddKind
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
        <div className="flex items-center gap-2">
          <IconButton
            icon={PenTool03Icon}
            label="Draw"
            disabled={!ready}
            size="md"
            className="rounded-full bg-[var(--surface-raised)]/90 backdrop-blur-md"
            onClick={() => onStartDraw?.()}
            strokeWidth={1.75}
            title="Start draw tool"
          />
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
      </div>
    </>
  )
}