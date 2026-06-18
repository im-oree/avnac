import { useEffect } from 'react'
import { AiMagicIcon, CropIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import ArtboardResizeToolbarControl from '../artboard-resize-toolbar-control'
import BackgroundPopover, { bgValueToSwatch } from '../background-popover'
import PaintPopoverControl from '../paint-popover-control'
import ShapeOptionsToolbar from '../shape-options-toolbar'
import TextFormatToolbar from '../text-format-toolbar'
import CornerRadiusToolbarControl from '../corner-radius-toolbar-control'
import { Button, Divider, Toolbar } from '../ui'
import { useEditorSelectionToolbar } from './editor-selection-toolbar-context'
import { useEditorStore } from './editor-store'
import { useInspectorSlots } from './editor-inspector-slots-context'

export function EditorSelectionToolbar() {
  const { actions, refs, state } = useEditorSelectionToolbar()
  const { setSlots } = useInspectorSlots()

  const artboard = useEditorStore(storeState => storeState.doc.artboard)
  const bg = useEditorStore(storeState => storeState.doc.bg)
  const selectedIds = useEditorStore(storeState => storeState.selectedIds)
  const doc = useEditorStore(storeState => storeState.doc)
  const setDoc = useEditorStore(storeState => storeState.setDoc)

  const {
    applyArrowLineStyle,
    applyArrowPathType,
    applyArrowRoundedEnds,
    applyArrowStrokeWidth,
    applyBackgroundPicked,
    applyImageCornerRadius,
    applyPaintToSelection,
    applyPolygonSides,
    applyRectCornerRadius,
    applyStarPoints,
    onArtboardResize,
    onTextFormatChange,
    openImageCropModal,
    removeImageBackground,
    toggleBackgroundPopover,
  } = actions

  const {
    backgroundPopoverAnchorRef,
    backgroundPopoverPanelRef,
    selectionToolsRef,
    viewportRef,
  } = refs

  const {
    backgroundActive,
    backgroundPopoverOpenUpward,
    backgroundPopoverShiftX,
    bgPopoverOpen,
    elementToolbarLockedDisplay,
    hasObjectSelected,
    imageCornerToolbar,
    imageRemovalState,
    ready,
    selectionFillPaint,
    selectionEffectsFooterSlot,
    shapeToolbarModel,
    textToolbarValues,
  } = state

  // ── Push inspector slots whenever toolbar state changes ───────────────────
  useEffect(() => {
    // Fill slot
    const fillSlot = selectionFillPaint ? (
      <PaintPopoverControl
        compact
        value={selectionFillPaint}
        onChange={applyPaintToSelection}
        title="Fill color and gradient"
        ariaLabel="Fill color and gradient"
      />
    ) : null

    // Image slot
    const selectedImages = doc.objects.filter(o => selectedIds.includes(o.id) && o.type === 'image')
    const stretchActive =
      selectedImages.length > 0 && selectedImages.every(i => (i as any).stretchWhenUnlocked ?? true)

    const imageSlot = imageCornerToolbar ? (
      <div className="grid gap-4">
        {/* Crop */}
        <div className="grid gap-1.5">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
            Crop
          </span>
          <button
            type="button"
            disabled={elementToolbarLockedDisplay}
            onClick={openImageCropModal}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[0.8125rem] font-medium text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-40"
          >
            <HugeiconsIcon icon={CropIcon} size={14} strokeWidth={1.75} />
            Open Crop Tool
          </button>
        </div>

        {/* Remove background */}
        <div className="grid gap-1.5">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
            AI Background Removal
          </span>
          <button
            type="button"
            disabled={elementToolbarLockedDisplay || imageRemovalState === 'running'}
            onClick={removeImageBackground}
            className={[
              'flex h-8 w-full items-center justify-center gap-2 rounded-lg border text-[0.8125rem] font-medium transition',
              elementToolbarLockedDisplay ? 'pointer-events-none opacity-40' : '',
              imageRemovalState !== 'idle'
                ? 'border-[var(--border-strong)] bg-[var(--hover-strong)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--hover)] hover:text-[var(--text)]',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <HugeiconsIcon icon={AiMagicIcon} size={14} strokeWidth={1.75} />
            {imageRemovalState === 'running'
              ? 'Removing…'
              : imageRemovalState === 'success'
                ? 'Background Removed'
                : 'Remove Background'}
          </button>
          {imageRemovalState === 'success' ? (
            <p className="text-[0.625rem] text-[var(--text-subtle)]">
              Background removed successfully.
            </p>
          ) : null}
        </div>

        {/* Corner radius */}
        <div className="grid gap-1.5">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
            Corner Radius
          </span>
          <CornerRadiusToolbarControl
            value={imageCornerToolbar.radius}
            max={imageCornerToolbar.max}
            onChange={applyImageCornerRadius}
            disabled={elementToolbarLockedDisplay}
          />
        </div>
        {/* Stretch when unlocked */}
        <div className="grid gap-1.5">
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
            Stretch when unlocked
          </span>
          <button
            type="button"
            disabled={elementToolbarLockedDisplay || selectedImages.length === 0}
            onClick={() => {
              const nextVal = !stretchActive
              setDoc(prev => ({
                ...prev,
                objects: prev.objects.map(o =>
                  selectedIds.includes(o.id) && o.type === 'image' ? { ...o, stretchWhenUnlocked: nextVal } : o,
                ),
              }))
            }}
            className={[
              'flex h-8 w-full items-center justify-center gap-2 rounded-lg border text-[0.8125rem] font-medium transition',
              elementToolbarLockedDisplay ? 'pointer-events-none opacity-40' : '',
              stretchActive
                ? 'border-[var(--border-strong)] bg-[var(--hover-strong)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--hover)] hover:text-[var(--text)]',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {stretchActive ? 'On' : 'Off'}
          </button>
          <p className="text-[0.625rem] text-[var(--text-subtle)]">
            When unlocked, images will stretch instead of cropping.
          </p>
        </div>
      </div>
    ) : null

    // Effects slot
    const effectsSlot = selectionEffectsFooterSlot ?? null

    setSlots({ fillSlot, imageSlot, effectsSlot })
  }, [
    selectionFillPaint,
    imageCornerToolbar,
    imageRemovalState,
    elementToolbarLockedDisplay,
    selectionEffectsFooterSlot,
    applyPaintToSelection,
    openImageCropModal,
    removeImageBackground,
    applyImageCornerRadius,
    setSlots,
    doc,
    selectedIds,
    setDoc,
  ])

  // ── Visibility logic ──────────────────────────────────────────────────────
  const showTextToolbar = ready && !!textToolbarValues
  const showShapeToolbar = ready && !textToolbarValues && !!shapeToolbarModel
  const showBackgroundToolbar =
    ready && backgroundActive && !hasObjectSelected && !textToolbarValues && !shapeToolbarModel

  if (!showTextToolbar && !showShapeToolbar && !showBackgroundToolbar) {
    return null
  }

  return (
    <div
      ref={selectionToolsRef}
      className="pointer-events-none absolute left-1/2 -top-3 z-30 -translate-x-1/2"
    >
      {showTextToolbar ? (
        <div className="pointer-events-auto">
          <TextFormatToolbar
            values={textToolbarValues}
            onChange={onTextFormatChange}
            footerSlot={selectionEffectsFooterSlot}
          />
        </div>
      ) : null}

      {showShapeToolbar ? (
        <div className="pointer-events-auto">
          <ShapeOptionsToolbar
            meta={shapeToolbarModel.meta}
            paintValue={shapeToolbarModel.paint}
            onPaintChange={applyPaintToSelection}
            onPolygonSides={applyPolygonSides}
            onStarPoints={applyStarPoints}
            onArrowLineStyle={applyArrowLineStyle}
            onArrowRoundedEnds={applyArrowRoundedEnds}
            onArrowStrokeWidth={applyArrowStrokeWidth}
            onArrowPathType={applyArrowPathType}
            rectCornerRadius={shapeToolbarModel.rectCornerRadius}
            rectCornerRadiusMax={shapeToolbarModel.rectCornerRadiusMax}
            onRectCornerRadius={
              shapeToolbarModel.meta.kind === 'rect' ? applyRectCornerRadius : undefined
            }
            footerSlot={selectionEffectsFooterSlot}
          />
        </div>
      ) : null}

      {showBackgroundToolbar ? (
        <div ref={backgroundPopoverAnchorRef} className="pointer-events-auto relative">
          <Toolbar compact className="px-2 py-1">
            <ArtboardResizeToolbarControl
              width={artboard.width}
              height={artboard.height}
              onResize={onArtboardResize}
              viewportRef={viewportRef}
            />
            <Divider orientation="vertical" />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-2 rounded-lg px-3 text-sm"
              onClick={toggleBackgroundPopover}
              aria-label="Page background"
              aria-expanded={bgPopoverOpen}
              iconBefore={
                <span
                  className="size-4 rounded-full border border-black/10"
                  style={bgValueToSwatch(bg)}
                />
              }
            >
              Background
            </Button>
          </Toolbar>
          {bgPopoverOpen ? (
            <div
              ref={backgroundPopoverPanelRef}
              className={[
                'absolute left-1/2 z-[60]',
                backgroundPopoverOpenUpward ? 'bottom-full mb-2' : 'top-full mt-2',
              ].join(' ')}
              style={{
                transform: `translateX(calc(-50% + ${backgroundPopoverShiftX}px))`,
              }}
            >
              <BackgroundPopover value={bg} onChange={applyBackgroundPicked} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}