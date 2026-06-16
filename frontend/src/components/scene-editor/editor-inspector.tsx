import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  ArrowMoveDownLeftIcon,
  BlurIcon,
  BorderFullIcon,
  GridIcon,
  LeftToRightBlockQuoteIcon,
  LockIcon,
  PaintBoardIcon,
  RadiusIcon,
  RotateClockwiseIcon,
  TextFontIcon,
  TransparencyIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useEditorStore } from './editor-store'
import type { SceneObject, SceneText } from '../../lib/avnac-scene'
import {
  getObjectFill,
  getObjectStroke,
  getObjectStrokeWidth,
  maxCornerRadiusForObject,
  objectSupportsFill,
  objectSupportsOutlineStroke,
  setObjectCornerRadius,
  setObjectFill,
  setObjectStroke,
  setObjectStrokeWidth,
} from '../../lib/avnac-scene'
import { layoutSceneText, sceneTextLineHeight } from '../../lib/avnac-scene-render'
import { loadGoogleFontFamily } from '../../lib/load-google-font'
import type { BgValue, GradientStop } from '../background-popover'
import InspectorGradientPicker, {
  type GradientValue,
  gradientValueToCss,
} from './inspector-gradient-picker'

const INSPECTOR_MIN_WIDTH = 260
const INSPECTOR_MAX_WIDTH_RATIO = 0.5
const INSPECTOR_DEFAULT_WIDTH = 300
const INSPECTOR_STORAGE_KEY = 'avnac.inspector.width'

type InspectorTab = 'object' | 'design' | 'canvas'

const BLUR_TYPES = [
  { id: 'layer', label: 'Layer' },
  { id: 'background', label: 'Background' },
  { id: 'motion', label: 'Motion' },
] as const

type BlurType = (typeof BLUR_TYPES)[number]['id']

// ─── Primitives (NumericField, ToggleChip, etc.) — unchanged from previous ──
// (paste from your existing file)

function NumericField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}) {
  const clamp = (n: number) => {
    let v = n
    if (min != null) v = Math.max(min, v)
    if (max != null) v = Math.min(max, v)
    return v
  }
  return (
    <div className="grid gap-1 min-w-0">
      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
        {label}
      </span>
      <div className="relative flex items-center">
        <input
          type="number"
          disabled={disabled}
          className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 pr-7 text-[0.8125rem] font-medium tabular-nums text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--focus-ring)] disabled:opacity-40"
          value={Math.round(value)}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(clamp(n))
          }}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2.5 text-[0.6875rem] text-[var(--text-subtle)]">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ToggleChip({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean
  onClick: () => void
  icon: IconSvgElement
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[0.75rem] font-medium transition ${
        active
          ? 'border-[var(--border-strong)] bg-[var(--hover-strong)] text-[var(--text)]'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--hover)]'
      } disabled:pointer-events-none disabled:opacity-40`}
    >
      <HugeiconsIcon icon={icon} size={13} strokeWidth={1.8} />
      {label}
    </button>
  )
}

function InspectorSection({
  title,
  icon,
  children,
  defaultOpen = true,
  action,
}: {
  title: string
  icon: IconSvgElement
  children: React.ReactNode
  defaultOpen?: boolean
  action?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex flex-1 cursor-pointer items-center gap-2 px-4 py-2.5 text-left transition hover:bg-[var(--hover)]"
        >
          <HugeiconsIcon
            icon={icon}
            size={14}
            strokeWidth={1.8}
            className="shrink-0 text-[var(--text-subtle)]"
          />
          <span className="flex-1 text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[var(--text-subtle)]">
            {title}
          </span>
          <svg
            className={`size-3.5 shrink-0 text-[var(--text-subtle)] transition-transform duration-150 ${open ? 'rotate-0' : '-rotate-90'}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
        {action && open ? <div>{action}</div> : null}
      </div>
      {open ? <div className="px-4 pb-3.5 pt-0.5">{children}</div> : null}
    </div>
  )
}

function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = '%',
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
  disabled?: boolean
}) {
  return (
    <div className="grid gap-1.5 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          {label}
        </span>
        <span className="text-[0.6875rem] font-medium tabular-nums text-[var(--text-muted)]">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        disabled={disabled}
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[var(--border)] outline-none accent-[var(--text)] disabled:opacity-40 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[var(--border-strong)] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
      />
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="grid gap-1 min-w-0">
      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <div className="relative shrink-0">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={label}
          />
          <div
            className="size-8 rounded-lg border border-[var(--border)] shadow-sm transition hover:border-[var(--border-strong)]"
            style={{ backgroundColor: value }}
          />
        </div>
        <input
          type="text"
          className="h-8 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 font-mono text-[0.75rem] font-medium uppercase text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--focus-ring)]"
          value={value}
          onChange={e => {
            const v = e.target.value
            if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v)
          }}
        />
      </div>
    </div>
  )
}

function InspectorEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <div className="grid size-10 place-items-center rounded-xl bg-[var(--hover)] text-[var(--text-subtle)]">
        <HugeiconsIcon icon={ArrowMoveDownLeftIcon} size={18} strokeWidth={1.5} />
      </div>
      <p className="max-w-[14rem] text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
        Select an element on the canvas to inspect its properties.
      </p>
    </div>
  )
}

// ─── Paint section (fill / stroke / background) ──────────────────────────────
// Unified picker that handles solid + gradient w/ full controls.

function PaintSection({
  label,
  paint,
  onChange,
}: {
  label: string
  paint: BgValue
  onChange: (v: BgValue) => void
}) {
  const isSolid = paint.type === 'solid'
  const isGradient = paint.type === 'gradient'

  const toGradientValue = (): GradientValue => {
    if (isGradient) {
      // existing gradient has angle + stops
      return {
        kind: 'linear',
        angle: paint.angle,
        stops: paint.stops.map((s, i) => ({
          ...s,
          id: `s${i}-${s.offset}`,
        })),
      }
    }
    const base = isSolid ? paint.color : '#ffffff'
    return {
      kind: 'linear',
      angle: 135,
      stops: [
        { color: base, offset: 0, id: 's0' },
        { color: '#000000', offset: 1, id: 's1' },
      ],
    }
  }

  const handleGradientChange = (g: GradientValue) => {
    const css = gradientValueToCss(g)
    const flatStops: GradientStop[] = g.stops
      .sort((a, b) => a.offset - b.offset)
      .map(s => ({ color: s.color, offset: s.offset }))
    onChange({
      type: 'gradient',
      css,
      stops: flatStops,
      angle: g.angle,
    })
  }

  return (
    <div className="grid gap-3">
      {/* Type toggle */}
      <div className="grid gap-1">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          {label}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() =>
              onChange({
                type: 'solid',
                color: isSolid ? paint.color : '#262626',
              })
            }
            className={`flex h-7 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[0.6875rem] font-semibold uppercase transition ${
              isSolid
                ? 'border-[var(--border-strong)] bg-[var(--hover-strong)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--hover)]'
            }`}
          >
            Solid
          </button>
          <button
            type="button"
            onClick={() => handleGradientChange(toGradientValue())}
            className={`flex h-7 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[0.6875rem] font-semibold uppercase transition ${
              isGradient
                ? 'border-[var(--border-strong)] bg-[var(--hover-strong)] text-[var(--text)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--hover)]'
            }`}
          >
            Gradient
          </button>
        </div>
      </div>

      {isSolid ? (
        <ColorField
          label="Color"
          value={paint.color}
          onChange={c => onChange({ type: 'solid', color: c })}
        />
      ) : (
        <InspectorGradientPicker
          value={toGradientValue()}
          onChange={handleGradientChange}
        />
      )}
    </div>
  )
}

// ─── Corner radius section with uniform/individual toggle ────────────────────

function CornerRadiusSection({
  obj,
  onChange,
}: {
  obj: SceneObject
  onChange: (fn: (o: SceneObject) => SceneObject) => void
}) {
  const max = maxCornerRadiusForObject(obj)
  const uniform = (obj as any).cornerRadius ?? 0
  const tl = (obj as any).cornerRadiusTL ?? uniform
  const tr = (obj as any).cornerRadiusTR ?? uniform
  const br = (obj as any).cornerRadiusBR ?? uniform
  const bl = (obj as any).cornerRadiusBL ?? uniform

  // "individual" mode is on when any individual corner is set OR when user toggles it
  const hasIndividual =
    (obj as any).cornerRadiusTL !== undefined ||
    (obj as any).cornerRadiusTR !== undefined ||
    (obj as any).cornerRadiusBR !== undefined ||
    (obj as any).cornerRadiusBL !== undefined

  const [individual, setIndividual] = useState(hasIndividual)

  useEffect(() => {
    setIndividual(hasIndividual)
  }, [hasIndividual])

  const setUniform = (v: number) => {
    onChange(o => {
      const next = setObjectCornerRadius(o, v) as any
      // clear per-corner overrides
      delete next.cornerRadiusTL
      delete next.cornerRadiusTR
      delete next.cornerRadiusBR
      delete next.cornerRadiusBL
      return next
    })
  }

  const setCorner = (which: 'TL' | 'TR' | 'BR' | 'BL', v: number) => {
    onChange(o => ({ ...(o as any), [`cornerRadius${which}`]: v }) as SceneObject)
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          Corner Radius
        </span>
        <button
          type="button"
          onClick={() => {
            if (individual) {
              // collapse back to uniform using TL value
              setUniform(tl)
              setIndividual(false)
            } else {
              // seed individual fields with current uniform
              onChange(o => ({
                ...(o as any),
                cornerRadiusTL: uniform,
                cornerRadiusTR: uniform,
                cornerRadiusBR: uniform,
                cornerRadiusBL: uniform,
              }) as SceneObject)
              setIndividual(true)
            }
          }}
          className="text-[0.6875rem] font-medium text-[var(--text-muted)] underline-offset-2 transition hover:text-[var(--text)] hover:underline"
        >
          {individual ? 'Uniform' : 'Per corner'}
        </button>
      </div>

      {!individual ? (
        <NumericField
          label="All Corners"
          value={uniform}
          onChange={setUniform}
          min={0}
          max={max}
          suffix="px"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <NumericField
            label="Top L"
            value={tl}
            onChange={v => setCorner('TL', v)}
            min={0}
            max={max}
            suffix="px"
          />
          <NumericField
            label="Top R"
            value={tr}
            onChange={v => setCorner('TR', v)}
            min={0}
            max={max}
            suffix="px"
          />
          <NumericField
            label="Bot L"
            value={bl}
            onChange={v => setCorner('BL', v)}
            min={0}
            max={max}
            suffix="px"
          />
          <NumericField
            label="Bot R"
            value={br}
            onChange={v => setCorner('BR', v)}
            min={0}
            max={max}
            suffix="px"
          />
        </div>
      )}
    </div>
  )
}

// ─── Main inspector ──────────────────────────────────────────────────────────

export default function EditorInspector() {
  const doc = useEditorStore(s => s.doc)
  const selectedIds = useEditorStore(s => s.selectedIds)
  const setDoc = useEditorStore(s => s.setDoc)

  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<InspectorTab>('object')
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return INSPECTOR_DEFAULT_WIDTH
    const stored = Number(window.localStorage.getItem(INSPECTOR_STORAGE_KEY))
    if (Number.isFinite(stored) && stored >= INSPECTOR_MIN_WIDTH) return stored
    return INSPECTOR_DEFAULT_WIDTH
  })
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    const onResize = () => {
      setWidth(w => Math.min(w, window.innerWidth * INSPECTOR_MAX_WIDTH_RATIO))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(INSPECTOR_STORAGE_KEY, String(width))
  }, [width])

  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragStartRef.current = { startX: e.clientX, startWidth: width }
      setResizing(true)
      const onMove = (ev: PointerEvent) => {
        const ref = dragStartRef.current
        if (!ref) return
        const delta = ref.startX - ev.clientX
        const max = window.innerWidth * INSPECTOR_MAX_WIDTH_RATIO
        const next = Math.max(INSPECTOR_MIN_WIDTH, Math.min(max, ref.startWidth + delta))
        setWidth(next)
      }
      const onUp = () => {
        dragStartRef.current = null
        setResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [width],
  )

  const selectedSingle = useMemo(() => {
    if (selectedIds.length !== 1) return null
    return doc.objects.find(o => o.id === selectedIds[0]) ?? null
  }, [doc.objects, selectedIds])

  const selectedMultiple = useMemo(
    () => doc.objects.filter(o => selectedIds.includes(o.id)),
    [doc.objects, selectedIds],
  )

  const updateSelected = useCallback(
    (fn: (o: SceneObject) => SceneObject) => {
      if (selectedIds.length === 0) return
      setDoc(prev => ({
        ...prev,
        objects: prev.objects.map(o => (selectedIds.includes(o.id) ? fn(o) : o)),
      }))
    },
    [selectedIds, setDoc],
  )

  const hasSelection = selectedIds.length > 0
  const multiSelect = selectedIds.length > 1

  useEffect(() => {
    if (!hasSelection && tab !== 'canvas') setTab('canvas')
    if (hasSelection && tab === 'canvas') setTab('object')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSelection])

  const avgOpacity = multiSelect
    ? Math.round(
        (selectedMultiple.reduce((s, o) => s + o.opacity, 0) / selectedMultiple.length) * 100,
      )
    : Math.round((selectedSingle?.opacity ?? 1) * 100)

  const avgBlur = multiSelect
    ? Math.round(selectedMultiple.reduce((s, o) => s + o.blurPct, 0) / selectedMultiple.length)
    : (selectedSingle?.blurPct ?? 0)

  const objectTypeLabel = () => {
    if (!selectedSingle) return null
    const map: Record<string, string> = {
      rect: 'Rectangle',
      ellipse: 'Ellipse',
      polygon: 'Polygon',
      star: 'Star',
      text: 'Text',
      image: 'Image',
      icon: 'Icon',
      line: 'Line',
      arrow: 'Arrow',
      group: 'Group',
    }
    return map[selectedSingle.type] ?? selectedSingle.type
  }

  const tabs: { id: InspectorTab; label: string; icon: IconSvgElement; disabled?: boolean }[] = [
    { id: 'object', label: 'Object', icon: GridIcon, disabled: !hasSelection },
    { id: 'design', label: 'Design', icon: RotateClockwiseIcon, disabled: !hasSelection },
    { id: 'canvas', label: 'Canvas', icon: PaintBoardIcon },
  ]

  // ─── Background paint helpers ─────────────────────────────────────────────
  const setBg = (next: BgValue) => setDoc(prev => ({ ...prev, bg: next }))

  return (
    <div
      data-avnac-chrome
      className="pointer-events-none fixed inset-y-0 right-0 z-30 hidden xl:block"
    >
      {/* Side tab handle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Collapse inspector' : 'Expand inspector'}
        aria-expanded={open}
        className="pointer-events-auto absolute top-1/2 z-10 flex h-24 w-7 -translate-y-1/2 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-l-xl border border-r-0 border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--text-subtle)] shadow-[-2px_2px_8px_rgba(26,26,46,0.05)] backdrop-blur transition-[right,background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
        style={{ right: open ? width : 0 }}
      >
        <svg
          className={`size-3 transition-transform duration-300 ${open ? 'rotate-0' : 'rotate-180'}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <span
          className="text-[0.625rem] font-semibold uppercase tracking-[0.1em]"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          Inspector
        </span>
      </button>

      <aside
        className={`pointer-events-auto absolute inset-y-0 right-0 flex flex-col border-l border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] shadow-[-8px_0_24px_rgba(26,26,46,0.04)] backdrop-blur ${
          resizing ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
        }`}
        style={{
          width,
          transform: open ? 'translateX(0)' : `translateX(${width}px)`,
        }}
        aria-hidden={!open}
      >
        {/* Resize handle */}
        <div
          onPointerDown={onResizePointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector"
          className="group absolute inset-y-0 left-0 z-20 flex w-1.5 -translate-x-1/2 cursor-ew-resize items-center justify-center"
        >
          <div
            className={`h-12 w-[3px] rounded-full transition ${
              resizing
                ? 'bg-[var(--text-muted)]'
                : 'bg-transparent group-hover:bg-[var(--border-strong)]'
            }`}
          />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="grid size-6 place-items-center rounded-md bg-[var(--hover)] text-[var(--text-subtle)]">
            <HugeiconsIcon icon={LeftToRightBlockQuoteIcon} size={14} strokeWidth={1.8} />
          </div>
          <span className="text-[0.8125rem] font-semibold text-[var(--text)]">Inspector</span>
          {hasSelection ? (
            <span className="ml-auto rounded-md bg-[var(--hover-strong)] px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-[var(--text-muted)]">
              {multiSelect ? `${selectedIds.length} items` : objectTypeLabel()}
            </span>
          ) : null}
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5">
          {tabs.map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                disabled={t.disabled}
                onClick={() => !t.disabled && setTab(t.id)}
                className={`group relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  active
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
                }`}
              >
                <HugeiconsIcon
                  icon={t.icon}
                  size={12}
                  strokeWidth={active ? 2 : 1.6}
                  className="shrink-0"
                />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto">
          {!hasSelection && tab !== 'canvas' ? <InspectorEmptyState /> : null}

          {/* OBJECT TAB */}
          {hasSelection && tab === 'object' ? (
            <>
              <InspectorSection title="Transform" icon={GridIcon} defaultOpen>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <NumericField
                      label="X"
                      value={selectedSingle?.x ?? 0}
                      onChange={v => updateSelected(o => ({ ...o, x: v }))}
                      disabled={!selectedSingle}
                      suffix="px"
                    />
                    <NumericField
                      label="Y"
                      value={selectedSingle?.y ?? 0}
                      onChange={v => updateSelected(o => ({ ...o, y: v }))}
                      disabled={!selectedSingle}
                      suffix="px"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <NumericField
                      label="Width"
                      value={selectedSingle?.width ?? 0}
                      onChange={v => updateSelected(o => ({ ...o, width: Math.max(1, v) }))}
                      min={1}
                      disabled={!selectedSingle}
                      suffix="px"
                    />
                    <NumericField
                      label="Height"
                      value={selectedSingle?.height ?? 0}
                      onChange={v => updateSelected(o => ({ ...o, height: Math.max(1, v) }))}
                      min={1}
                      disabled={!selectedSingle}
                      suffix="px"
                    />
                  </div>
                  <NumericField
                    label="Rotation"
                    value={selectedSingle?.rotation ?? 0}
                    onChange={v => updateSelected(o => ({ ...o, rotation: v }))}
                    min={-360}
                    max={360}
                    disabled={!selectedSingle}
                    suffix="°"
                  />
                  {selectedSingle ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDoc(prev => ({
                          ...prev,
                          objects: prev.objects.map(o =>
                            selectedIds.includes(o.id)
                              ? {
                                  ...o,
                                  x: prev.artboard.width / 2 - o.width / 2,
                                  y: prev.artboard.height / 2 - o.height / 2,
                                }
                              : o,
                          ),
                        }))
                      }}
                      className="flex h-7 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[0.75rem] font-medium text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                    >
                      <HugeiconsIcon icon={ArrowMoveDownLeftIcon} size={12} strokeWidth={1.8} />
                      Center on artboard
                    </button>
                  ) : null}
                </div>
              </InspectorSection>

              <InspectorSection title="Visibility" icon={ViewIcon} defaultOpen={false}>
                <div className="flex flex-wrap gap-1.5">
                  <ToggleChip
                    icon={selectedSingle?.visible === false ? ViewOffSlashIcon : ViewIcon}
                    label={selectedSingle?.visible === false ? 'Hidden' : 'Visible'}
                    active={selectedSingle?.visible !== false}
                    onClick={() =>
                      updateSelected(o => ({ ...o, visible: o.visible === false }))
                    }
                    disabled={!selectedSingle}
                  />
                  <ToggleChip
                    icon={LockIcon}
                    label={selectedSingle?.locked ? 'Locked' : 'Unlocked'}
                    active={!!selectedSingle?.locked}
                    onClick={() => updateSelected(o => ({ ...o, locked: !o.locked }))}
                    disabled={!selectedSingle}
                  />
                </div>
              </InspectorSection>
            </>
          ) : null}

          {/* DESIGN TAB */}
          {hasSelection && tab === 'design' ? (
            <>
              <InspectorSection title="Transparency" icon={TransparencyIcon} defaultOpen>
                <SliderField
                  label="Opacity"
                  value={avgOpacity}
                  onChange={v =>
                    updateSelected(o => ({
                      ...o,
                      opacity: Math.max(0, Math.min(1, v / 100)),
                    }))
                  }
                />
              </InspectorSection>

              <InspectorSection title="Blur" icon={BlurIcon} defaultOpen>
                <div className="grid gap-3">
                  <SliderField
                    label="Amount"
                    value={avgBlur}
                    onChange={v => updateSelected(o => ({ ...o, blurPct: v }))}
                  />
                  {/* Blur type — NEW. Note: renderer needs to honor o.blurType */}
                  <div className="grid gap-1">
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
                      Type
                    </span>
                    <div className="flex gap-1">
                      {BLUR_TYPES.map(t => {
                        const active =
                          (((selectedSingle as any)?.blurType as BlurType) ?? 'layer') === t.id
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              updateSelected(o => ({ ...(o as any), blurType: t.id }) as SceneObject)
                            }
                            className={`flex h-7 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[0.6875rem] font-semibold uppercase transition ${
                              active
                                ? 'border-[var(--border-strong)] bg-[var(--hover-strong)] text-[var(--text)]'
                                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--hover)]'
                            }`}
                          >
                            {t.label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[0.625rem] text-[var(--text-subtle)]">
                      Layer blurs the object · Background blurs what's behind · Motion adds directional smear
                    </p>
                  </div>
                  {/* Motion angle only shown when motion */}
                  {((selectedSingle as any)?.blurType as BlurType) === 'motion' ? (
                    <NumericField
                      label="Motion Angle"
                      value={((selectedSingle as any)?.motionBlurAngle as number) ?? 0}
                      onChange={v =>
                        updateSelected(
                          o => ({ ...(o as any), motionBlurAngle: v }) as SceneObject,
                        )
                      }
                      min={0}
                      max={360}
                      suffix="°"
                    />
                  ) : null}
                </div>
              </InspectorSection>

              {/* Fill */}
              {selectedSingle && objectSupportsFill(selectedSingle) ? (
                <InspectorSection title="Fill" icon={PaintBoardIcon} defaultOpen>
                  <PaintSection
                    label="Fill"
                    paint={getObjectFill(selectedSingle) ?? { type: 'solid', color: '#262626' }}
                    onChange={paint => updateSelected(o => setObjectFill(o, paint))}
                  />
                </InspectorSection>
              ) : null}

              {/* Stroke */}
              {selectedSingle && objectSupportsOutlineStroke(selectedSingle) ? (
                <InspectorSection title="Stroke" icon={BorderFullIcon} defaultOpen={false}>
                  <div className="grid gap-3">
                    <NumericField
                      label="Width"
                      value={getObjectStrokeWidth(selectedSingle)}
                      onChange={v => updateSelected(o => setObjectStrokeWidth(o, v))}
                      min={0}
                      max={64}
                      suffix="px"
                    />
                    <PaintSection
                      label="Stroke Paint"
                      paint={
                        getObjectStroke(selectedSingle) ?? { type: 'solid', color: '#000000' }
                      }
                      onChange={paint => updateSelected(o => setObjectStroke(o, paint))}
                    />
                  </div>
                </InspectorSection>
              ) : null}

              {/* Corner radius */}
              {selectedSingle &&
              (selectedSingle.type === 'rect' || selectedSingle.type === 'image') ? (
                <InspectorSection title="Corners" icon={RadiusIcon} defaultOpen={false}>
                  <CornerRadiusSection obj={selectedSingle} onChange={updateSelected} />
                </InspectorSection>
              ) : null}

              {/* Shadow */}
              <InspectorSection
                title="Shadow"
                icon={PaintBoardIcon}
                defaultOpen={false}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      const enabled = !!selectedSingle?.shadow
                      updateSelected(o => ({
                        ...o,
                        shadow: enabled
                          ? null
                          : {
                              colorHex: '#000000',
                              blur: 8,
                              offsetX: 0,
                              offsetY: 4,
                              opacityPct: 25,
                            },
                      }))
                    }}
                    className={`mr-1 inline-flex h-6 items-center rounded-md border px-2 text-[0.625rem] font-semibold uppercase tracking-wide transition ${
                      selectedSingle?.shadow
                        ? 'border-[var(--border-strong)] bg-[var(--hover-strong)] text-[var(--text)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--hover)]'
                    }`}
                  >
                    {selectedSingle?.shadow ? 'On' : 'Off'}
                  </button>
                }
              >
                {selectedSingle?.shadow ? (
                  <div className="grid gap-3">
                    <ColorField
                      label="Color"
                      value={selectedSingle.shadow.colorHex}
                      onChange={hex =>
                        updateSelected(o =>
                          o.shadow
                            ? { ...o, shadow: { ...o.shadow, colorHex: hex } }
                            : o,
                        )
                      }
                    />
                    <SliderField
                      label="Opacity"
                      value={selectedSingle.shadow.opacityPct}
                      onChange={v =>
                        updateSelected(o =>
                          o.shadow
                            ? { ...o, shadow: { ...o.shadow, opacityPct: v } }
                            : o,
                        )
                      }
                    />
                    <SliderField
                      label="Blur"
                      value={selectedSingle.shadow.blur}
                      onChange={v =>
                        updateSelected(o =>
                          o.shadow ? { ...o, shadow: { ...o.shadow, blur: v } } : o,
                        )
                      }
                      max={50}
                      suffix="px"
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <NumericField
                        label="Offset X"
                        value={selectedSingle.shadow.offsetX}
                        onChange={v =>
                          updateSelected(o =>
                            o.shadow
                              ? { ...o, shadow: { ...o.shadow, offsetX: v } }
                              : o,
                          )
                        }
                        min={-40}
                        max={40}
                        suffix="px"
                      />
                      <NumericField
                        label="Offset Y"
                        value={selectedSingle.shadow.offsetY}
                        onChange={v =>
                          updateSelected(o =>
                            o.shadow
                              ? { ...o, shadow: { ...o.shadow, offsetY: v } }
                              : o,
                          )
                        }
                        min={-40}
                        max={40}
                        suffix="px"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[0.75rem] text-[var(--text-subtle)]">
                    Shadow is disabled. Toggle on to configure.
                  </p>
                )}
              </InspectorSection>

              {/* Typography */}
              {selectedSingle?.type === 'text' ? (
                <InspectorSection title="Typography" icon={TextFontIcon} defaultOpen>
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
                        Content
                      </span>
                      <textarea
                        className="min-h-[4.5rem] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[0.8125rem] leading-relaxed text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                        value={(selectedSingle as SceneText).text}
                        onChange={e => {
                          const text = e.target.value
                          updateSelected(o => {
                            if (o.type !== 'text') return o
                            const next: SceneText = { ...o, text }
                            const layout = layoutSceneText(next)
                            next.height = Math.max(
                              layout.height,
                              next.fontSize * sceneTextLineHeight(next),
                            )
                            return next
                          })
                        }}
                      />
                    </div>

                    <div className="grid gap-1">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
                        Font Family
                      </span>
                      <input
                        type="text"
                        className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[0.8125rem] font-medium text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                        value={(selectedSingle as SceneText).fontFamily}
                        onChange={e => {
                          const fontFamily = e.target.value
                          void loadGoogleFontFamily(fontFamily)
                          updateSelected(o => (o.type === 'text' ? { ...o, fontFamily } : o))
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <NumericField
                        label="Font Size"
                        value={(selectedSingle as SceneText).fontSize}
                        onChange={v =>
                          updateSelected(o => {
                            if (o.type !== 'text') return o
                            const next: SceneText = { ...o, fontSize: Math.max(1, v) }
                            const layout = layoutSceneText(next)
                            next.height = Math.max(
                              layout.height,
                              next.fontSize * sceneTextLineHeight(next),
                            )
                            return next
                          })
                        }
                        min={1}
                        max={999}
                        suffix="px"
                      />
                      <NumericField
                        label="Line Height"
                        value={Math.round(
                          ((selectedSingle as SceneText).lineHeight ?? 1.22) * 100,
                        )}
                        onChange={v =>
                          updateSelected(o => {
                            if (o.type !== 'text') return o
                            const lineHeight = Math.max(0.6, Math.min(4, v / 100))
                            const next: SceneText = { ...o, lineHeight }
                            const layout = layoutSceneText(next)
                            next.height = Math.max(
                              layout.height,
                              next.fontSize * sceneTextLineHeight(next),
                            )
                            return next
                          })
                        }
                        min={60}
                        max={400}
                        suffix="%"
                      />
                    </div>

                    <NumericField
                      label="Letter Spacing"
                      value={(selectedSingle as SceneText).letterSpacing}
                      onChange={v =>
                        updateSelected(o => (o.type === 'text' ? { ...o, letterSpacing: v } : o))
                      }
                      min={-10}
                      max={100}
                      suffix="px"
                    />

                    <div className="grid gap-1">
                      <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
                        Alignment
                      </span>
                      <div className="flex gap-1">
                        {(['left', 'center', 'right'] as const).map(align => (
                          <button
                            key={align}
                            type="button"
                            onClick={() =>
                              updateSelected(o =>
                                o.type === 'text' ? { ...o, textAlign: align } : o,
                              )
                            }
                            className={`flex h-7 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[0.6875rem] font-semibold uppercase transition ${
                              (selectedSingle as SceneText).textAlign === align
                                ? 'border-[var(--border-strong)] bg-[var(--hover-strong)] text-[var(--text)]'
                                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--hover)]'
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <ToggleChip
                        icon={TextFontIcon}
                        label="Bold"
                        active={
                          (selectedSingle as SceneText).fontWeight === 'bold' ||
                          (selectedSingle as SceneText).fontWeight === 700 ||
                          (selectedSingle as SceneText).fontWeight === 600
                        }
                        onClick={() =>
                          updateSelected(o =>
                            o.type === 'text'
                              ? {
                                  ...o,
                                  fontWeight:
                                    o.fontWeight === 'bold' || o.fontWeight === 700
                                      ? 'normal'
                                      : 'bold',
                                }
                              : o,
                          )
                        }
                      />
                      <ToggleChip
                        icon={TextFontIcon}
                        label="Italic"
                        active={(selectedSingle as SceneText).fontStyle === 'italic'}
                        onClick={() =>
                          updateSelected(o =>
                            o.type === 'text'
                              ? {
                                  ...o,
                                  fontStyle: o.fontStyle === 'italic' ? 'normal' : 'italic',
                                }
                              : o,
                          )
                        }
                      />
                      <ToggleChip
                        icon={TextFontIcon}
                        label="Underline"
                        active={!!(selectedSingle as SceneText).underline}
                        onClick={() =>
                          updateSelected(o =>
                            o.type === 'text' ? { ...o, underline: !o.underline } : o,
                          )
                        }
                      />
                    </div>
                  </div>
                </InspectorSection>
              ) : null}
            </>
          ) : null}

          {/* CANVAS TAB */}
          {tab === 'canvas' ? (
            <>
              <InspectorSection title="Background" icon={PaintBoardIcon} defaultOpen>
                <PaintSection label="Background" paint={doc.bg} onChange={setBg} />
              </InspectorSection>
              <InspectorSection title="Artboard" icon={GridIcon} defaultOpen>
                <div className="grid grid-cols-2 gap-2.5">
                  <NumericField
                    label="Width"
                    value={doc.artboard.width}
                    onChange={v =>
                      setDoc(prev => ({
                        ...prev,
                        artboard: { ...prev.artboard, width: Math.max(1, v) },
                      }))
                    }
                    min={1}
                    suffix="px"
                  />
                  <NumericField
                    label="Height"
                    value={doc.artboard.height}
                    onChange={v =>
                      setDoc(prev => ({
                        ...prev,
                        artboard: { ...prev.artboard, height: Math.max(1, v) },
                      }))
                    }
                    min={1}
                    suffix="px"
                  />
                </div>
              </InspectorSection>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border)] px-4 py-2.5">
          <p className="text-[0.625rem] tabular-nums text-[var(--text-subtle)]">
            {doc.artboard.width.toLocaleString()} × {doc.artboard.height.toLocaleString()}px
            <span className="mx-1.5 opacity-40">·</span>
            {doc.objects.length} object{doc.objects.length !== 1 ? 's' : ''}
          </p>
        </div>
      </aside>
    </div>
  )
}