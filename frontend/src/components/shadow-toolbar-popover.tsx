// shadow-toolbar-popover.tsx
import { BackgroundIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ColorPicker from './ui/color-picker/ColorPicker'
import { useViewportAwarePopoverPlacement } from '../hooks/use-viewport-aware-popover'
import type { ShadowUi } from '../lib/avnac-shadow'
import EditorRangeSlider from './editor-range-slider'
import {
  floatingToolbarIconButton,
  floatingToolbarPopoverClass,
} from './floating-toolbar-shell'

const PANEL_ESTIMATE_H = 380
const BLUR_MAX = 50
const OFFSET_MAX = 40

type Props = {
  value: ShadowUi
  shadowActive: boolean
  onChange: (next: ShadowUi) => void
}

export default function ShadowToolbarPopover({ value, shadowActive, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [openColor, setOpenColor] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const colorRef = useRef<HTMLDivElement | null>(null)
  const pickPanel = useCallback(() => panelRef.current, [])

  const { openUpward, shiftX } = useViewportAwarePopoverPlacement(
    open,
    rootRef,
    PANEL_ESTIMATE_H,
    pickPanel,
    'center',
  )

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!openColor) return
    const onDown = (e: MouseEvent) => {
      if (colorRef.current?.contains(e.target as Node)) return
      setOpenColor(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openColor])

  const blur = Math.max(0, Math.min(BLUR_MAX, Math.round(value.blur)))
  const ox = Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, Math.round(value.offsetX)))
  const oy = Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, Math.round(value.offsetY)))
  const op = Math.max(0, Math.min(100, Math.round(value.opacityPct)))

  // Shared row label + value class
  const rowLabel = 'text-[12px] font-medium text-[var(--text-muted)]'
  const rowValue = 'text-[12px] tabular-nums text-[var(--text-subtle)]'

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={[floatingToolbarIconButton(open, { wide: true }), 'gap-1 px-2'].join(' ')}
        aria-label={shadowActive ? `Drop shadow, ${blur}px blur` : 'Drop shadow, off'}
        title="Shadow"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(o => !o)}
      >
        <HugeiconsIcon icon={BackgroundIcon} size={18} strokeWidth={1.75} />
        <span className="min-w-[2.25rem] text-left text-xs font-medium tabular-nums text-[var(--text-muted)]">
          {shadowActive ? `${blur}` : '—'}
        </span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          className={[
            'absolute left-1/2 z-[70] min-w-[15.5rem] p-3',
            openUpward ? 'bottom-full mb-2' : 'top-full mt-2',
            floatingToolbarPopoverClass,
          ].join(' ')}
          style={{ transform: `translateX(calc(-50% + ${shiftX}px))` }}
        >
          {/* Header row with color picker */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-[var(--text)]">Shadow</span>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-subtle)]">Color</span>
              <div className="relative" ref={colorRef}>
                <button
                  type="button"
                  onClick={() => setOpenColor(o => !o)}
                  className={[
                    'h-7 w-9 cursor-pointer rounded p-0',
                    'border border-[var(--border)]',
                    'bg-[var(--surface)]',
                  ].join(' ')}
                  aria-label="Shadow color"
                  style={{ backgroundColor: value.colorHex }}
                />
                {openColor ? (
                  <div className="absolute right-0 z-50 mt-2">
                    <ColorPicker
                      value={value.colorHex}
                      onChange={hex => onChange({ ...value, colorHex: hex })}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Blur */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={rowLabel}>Blur</span>
            <span className={rowValue}>{blur}px</span>
          </div>
          <EditorRangeSlider
            min={0}
            max={BLUR_MAX}
            value={blur}
            onChange={n => onChange({ ...value, blur: n })}
            aria-label="Shadow blur"
            trackClassName="mb-3 w-full"
          />

          {/* Opacity */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={rowLabel}>Opacity</span>
            <span className={rowValue}>{op}%</span>
          </div>
          <EditorRangeSlider
            min={0}
            max={100}
            value={op}
            onChange={n => onChange({ ...value, opacityPct: n })}
            aria-label="Shadow opacity"
            trackClassName="mb-3 w-full"
          />

          {/* Offset X */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={rowLabel}>Offset X</span>
            <span className={rowValue}>{ox}px</span>
          </div>
          <EditorRangeSlider
            min={-OFFSET_MAX}
            max={OFFSET_MAX}
            value={ox}
            onChange={n => onChange({ ...value, offsetX: n })}
            aria-label="Shadow offset X"
            trackClassName="mb-3 w-full"
          />

          {/* Offset Y */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={rowLabel}>Offset Y</span>
            <span className={rowValue}>{oy}px</span>
          </div>
          <EditorRangeSlider
            min={-OFFSET_MAX}
            max={OFFSET_MAX}
            value={oy}
            onChange={n => onChange({ ...value, offsetY: n })}
            aria-label="Shadow offset Y"
            trackClassName="w-full"
          />
        </div>
      ) : null}
    </div>
  )
}