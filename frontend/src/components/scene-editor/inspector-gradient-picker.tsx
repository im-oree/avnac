// inspector-gradient-picker.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import ColorPicker from '../ui/color-picker/ColorPicker'

export type GradientStop = { color: string; offset: number; id: string }
export type GradientKind = 'linear' | 'radial' | 'conic'

export type GradientValue = {
  kind: GradientKind
  stops: GradientStop[]
  angle: number
  centerX?: number
  centerY?: number
}

const STORAGE_KEY = 'gradient-user-presets'

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function clampAngle(n: number) {
  if (!Number.isFinite(n)) return 0
  let v = n % 360
  if (v < 0) v += 360
  return Math.round(v)
}

export function gradientValueToCss(g: GradientValue): string {
  const sorted = [...g.stops].sort((a, b) => a.offset - b.offset)
  const stopStr = sorted
    .map(s => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(', ')
  const cx = Math.round((g.centerX ?? 0.5) * 100)
  const cy = Math.round((g.centerY ?? 0.5) * 100)

  if (g.kind === 'linear') return `linear-gradient(${g.angle}deg, ${stopStr})`
  if (g.kind === 'radial')
    return `radial-gradient(circle at ${cx}% ${cy}%, ${stopStr})`
  return `conic-gradient(from ${g.angle}deg at ${cx}% ${cy}%, ${stopStr})`
}

function genId() {
  return `s${Math.random().toString(36).slice(2, 9)}`
}

// ── Built-in presets per gradient type ────────────────────────────────────────

function makeStops(
  pairs: [string, number][],
): GradientStop[] {
  return pairs.map(([color, offset], i) => ({
    color,
    offset,
    id: genId(),
  }))
}

const LINEAR_PRESETS: GradientValue[] = [
  {
    kind: 'linear',
    angle: 135,
    stops: makeStops([['#667eea', 0], ['#764ba2', 1]]),
  },
  {
    kind: 'linear',
    angle: 90,
    stops: makeStops([['#f093fb', 0], ['#f5576c', 1]]),
  },
  {
    kind: 'linear',
    angle: 135,
    stops: makeStops([['#4facfe', 0], ['#00f2fe', 1]]),
  },
  {
    kind: 'linear',
    angle: 90,
    stops: makeStops([['#43e97b', 0], ['#38f9d7', 1]]),
  },
  {
    kind: 'linear',
    angle: 135,
    stops: makeStops([['#fa709a', 0], ['#fee140', 1]]),
  },
  {
    kind: 'linear',
    angle: 90,
    stops: makeStops([['#a18cd1', 0], ['#fbc2eb', 1]]),
  },
  {
    kind: 'linear',
    angle: 135,
    stops: makeStops([['#fccb90', 0], ['#d57eeb', 1]]),
  },
  {
    kind: 'linear',
    angle: 90,
    stops: makeStops([['#e0c3fc', 0], ['#8ec5fc', 1]]),
  },
  {
    kind: 'linear',
    angle: 180,
    stops: makeStops([['#0c0c0c', 0], ['#434343', 1]]),
  },
  {
    kind: 'linear',
    angle: 135,
    stops: makeStops([['#ff9a9e', 0], ['#fecfef', 0.5], ['#fecfef', 1]]),
  },
  {
    kind: 'linear',
    angle: 90,
    stops: makeStops([['#ff0844', 0], ['#ffb199', 1]]),
  },
  {
    kind: 'linear',
    angle: 135,
    stops: makeStops([['#30cfd0', 0], ['#330867', 1]]),
  },
]

const RADIAL_PRESETS: GradientValue[] = [
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#ffecd2', 0], ['#fcb69f', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#a1c4fd', 0], ['#c2e9fb', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.3,
    centerY: 0.3,
    stops: makeStops([['#ffffff', 0], ['#667eea', 0.5], ['#764ba2', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#f6d365', 0], ['#fda085', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#84fab0', 0], ['#8fd3f4', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.7,
    centerY: 0.3,
    stops: makeStops([['#fbc2eb', 0], ['#a6c1ee', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#fddb92', 0], ['#d1fdff', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#e6dee9', 0], ['#bdc2e8', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#fff1eb', 0], ['#ace0f9', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#c1dfc4', 0], ['#deecdd', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.2,
    centerY: 0.2,
    stops: makeStops([['#ffffff', 0], ['#f5576c', 0.6], ['#330867', 1]]),
  },
  {
    kind: 'radial',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#0c0c0c', 0], ['#1a1a2e', 0.5], ['#16213e', 1]]),
  },
]

const CONIC_PRESETS: GradientValue[] = [
  {
    kind: 'conic',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#ff6b6b', 0], ['#feca57', 0.25], ['#48dbfb', 0.5], ['#ff9ff3', 0.75], ['#ff6b6b', 1]]),
  },
  {
    kind: 'conic',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#f093fb', 0], ['#f5576c', 0.33], ['#4facfe', 0.66], ['#f093fb', 1]]),
  },
  {
    kind: 'conic',
    angle: 90,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#667eea', 0], ['#764ba2', 0.5], ['#667eea', 1]]),
  },
  {
    kind: 'conic',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#43e97b', 0], ['#38f9d7', 0.5], ['#43e97b', 1]]),
  },
  {
    kind: 'conic',
    angle: 45,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#fa709a', 0], ['#fee140', 0.25], ['#43e97b', 0.5], ['#4facfe', 0.75], ['#fa709a', 1]]),
  },
  {
    kind: 'conic',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#0c0c0c', 0], ['#434343', 0.5], ['#0c0c0c', 1]]),
  },
  {
    kind: 'conic',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#ff9a9e', 0], ['#fad0c4', 0.25], ['#a18cd1', 0.5], ['#fbc2eb', 0.75], ['#ff9a9e', 1]]),
  },
  {
    kind: 'conic',
    angle: 180,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#30cfd0', 0], ['#330867', 0.5], ['#30cfd0', 1]]),
  },
  {
    kind: 'conic',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#ff0844', 0], ['#ffb199', 0.33], ['#ff0844', 0.66], ['#ffb199', 1]]),
  },
  {
    kind: 'conic',
    angle: 0,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#e0c3fc', 0], ['#8ec5fc', 0.5], ['#e0c3fc', 1]]),
  },
  {
    kind: 'conic',
    angle: 0,
    centerX: 0.3,
    centerY: 0.3,
    stops: makeStops([['#ffecd2', 0], ['#fcb69f', 0.33], ['#f093fb', 0.66], ['#ffecd2', 1]]),
  },
  {
    kind: 'conic',
    angle: 270,
    centerX: 0.5,
    centerY: 0.5,
    stops: makeStops([['#84fab0', 0], ['#8fd3f4', 0.25], ['#a18cd1', 0.5], ['#fbc2eb', 0.75], ['#84fab0', 1]]),
  },
]

const PRESETS_BY_KIND: Record<GradientKind, GradientValue[]> = {
  linear: LINEAR_PRESETS,
  radial: RADIAL_PRESETS,
  conic: CONIC_PRESETS,
}

// ── User presets persistence ─────────────────────────────────────────────────

type UserPreset = {
  id: string
  name: string
  value: GradientValue
}

function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as UserPreset[]
  } catch {
    return []
  }
}

function saveUserPresets(presets: UserPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {
    // quota exceeded etc
  }
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  value: GradientValue
  onChange: (next: GradientValue) => void
}

export default function InspectorGradientPicker({ value, onChange }: Props) {
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    valueRef.current = value
  }, [value])
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const sortedStops = [...value.stops].sort((a, b) => a.offset - b.offset)
  const [activeStopId, setActiveStopId] = useState<string>(
    () => sortedStops[0]?.id ?? '',
  )

  useEffect(() => {
    if (!value.stops.some(s => s.id === activeStopId)) {
      setActiveStopId(value.stops[0]?.id ?? '')
    }
  }, [value.stops, activeStopId])

  const activeStop =
    value.stops.find(s => s.id === activeStopId) ?? value.stops[0] ?? null

  const [openCustom, setOpenCustom] = useState(false)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!openCustom) return
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current?.contains(e.target as Node)) return
      setOpenCustom(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openCustom])

  const trackRef = useRef<HTMLDivElement>(null)
  const draggingStopIdRef = useRef<string | null>(null)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const id = draggingStopIdRef.current
      const track = trackRef.current
      if (!id || !track) return
      e.preventDefault()
      const rect = track.getBoundingClientRect()
      const offset = clamp01((e.clientX - rect.left) / rect.width)
      const v = valueRef.current
      onChangeRef.current({
        ...v,
        stops: v.stops.map(s => (s.id === id ? { ...s, offset } : s)),
      })
    }
    const onUp = () => {
      draggingStopIdRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const handleStopPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.preventDefault()
      e.stopPropagation()
      setActiveStopId(id)
      draggingStopIdRef.current = id
      const track = trackRef.current
      if (track) {
        const rect = track.getBoundingClientRect()
        const offset = clamp01((e.clientX - rect.left) / rect.width)
        const v = valueRef.current
        onChangeRef.current({
          ...v,
          stops: v.stops.map(s => (s.id === id ? { ...s, offset } : s)),
        })
      }
    },
    [],
  )

  const handleTrackPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-stop-handle]')) return
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const offset = clamp01((e.clientX - rect.left) / rect.width)
    const v = valueRef.current
    const sorted = [...v.stops].sort((a, b) => a.offset - b.offset)
    const before = [...sorted].reverse().find(s => s.offset <= offset)
    const after = sorted.find(s => s.offset >= offset)
    const newColor = before?.color ?? after?.color ?? '#ffffff'
    const id = genId()
    const nextStops = [...v.stops, { color: newColor, offset, id }]
    onChangeRef.current({ ...v, stops: nextStops })
    setActiveStopId(id)
    draggingStopIdRef.current = id
  }, [])

  const updateActiveColor = useCallback(
    (color: string) => {
      if (!activeStop) return
      onChange({
        ...value,
        stops: value.stops.map(s =>
          s.id === activeStop.id ? { ...s, color } : s,
        ),
      })
    },
    [activeStop, onChange, value],
  )

  const removeActiveStop = useCallback(() => {
    if (!activeStop || value.stops.length <= 2) return
    const next = value.stops.filter(s => s.id !== activeStop.id)
    onChange({ ...value, stops: next })
    setActiveStopId(next[0]?.id ?? '')
  }, [activeStop, onChange, value])

  // ── Presets state ──────────────────────────────────────────────────────
  const [presetsExpanded, setPresetsExpanded] = useState(false)
  const [userPresets, setUserPresets] = useState<UserPreset[]>(loadUserPresets)
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const saveInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (savingPreset) {
      saveInputRef.current?.focus()
    }
  }, [savingPreset])

  const builtInPresets = PRESETS_BY_KIND[value.kind]
  const filteredUserPresets = userPresets.filter(p => p.value.kind === value.kind)

  const applyPreset = useCallback(
    (preset: GradientValue) => {
      // Re-generate stop IDs to avoid collisions
      const stops = preset.stops.map(s => ({ ...s, id: genId() }))
      onChange({ ...preset, stops })
      setActiveStopId(stops[0]?.id ?? '')
    },
    [onChange],
  )

  const handleSavePreset = useCallback(() => {
    const name = presetName.trim() || `Preset ${userPresets.length + 1}`
    const newPreset: UserPreset = {
      id: genId(),
      name,
      value: {
        ...value,
        stops: value.stops.map(s => ({ ...s })),
      },
    }
    const next = [...userPresets, newPreset]
    setUserPresets(next)
    saveUserPresets(next)
    setSavingPreset(false)
    setPresetName('')
  }, [presetName, userPresets, value])

  const handleDeleteUserPreset = useCallback(
    (id: string) => {
      const next = userPresets.filter(p => p.id !== id)
      setUserPresets(next)
      saveUserPresets(next)
    },
    [userPresets],
  )

  const previewCss = gradientValueToCss(value)

  return (
    <div className="grid gap-3">
      {/* Kind switcher */}
      <div className="grid gap-1">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          Gradient Type
        </span>
        <div className="flex gap-1">
          {(['linear', 'radial', 'conic'] as const).map(kind => (
            <button
              key={kind}
              type="button"
              onClick={() => onChange({ ...value, kind })}
              className={`flex h-7 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[0.6875rem] font-semibold uppercase transition ${
                value.kind === kind
                  ? 'border-[var(--border-strong)] bg-[var(--hover-strong)] text-[var(--text)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--hover)]'
              }`}
            >
              {kind}
            </button>
          ))}
        </div>
      </div>

      {/* Live preview */}
      <div
        className="h-16 w-full rounded-lg border border-[var(--border)] shadow-inner"
        style={{ backgroundImage: previewCss }}
      />

      {/* ── Presets section ──────────────────────────────────────────────── */}
      <div className="grid gap-1.5">
        <button
          type="button"
          onClick={() => setPresetsExpanded(p => !p)}
          className="flex items-center justify-between"
        >
          <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
            Presets
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className={`text-[var(--text-muted)] transition-transform ${presetsExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </button>

        {presetsExpanded && (
          <div className="grid gap-2">
            {/* Built-in presets */}
            <div className="grid grid-cols-6 gap-1.5">
              {builtInPresets.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  title={`${preset.kind} preset ${i + 1}`}
                  className="group relative aspect-square w-full cursor-pointer rounded-md border border-[var(--border)] shadow-sm transition hover:border-[var(--border-strong)] hover:shadow-md hover:scale-105 active:scale-95"
                  style={{ backgroundImage: gradientValueToCss(preset) }}
                >
                  <div className="absolute inset-0 rounded-[5px] opacity-0 transition group-hover:opacity-100 ring-1 ring-inset ring-white/20" />
                </button>
              ))}
            </div>

            {/* User presets */}
            {filteredUserPresets.length > 0 && (
              <div className="grid gap-1">
                <span className="text-[0.625rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
                  Your Presets
                </span>
                <div className="grid grid-cols-6 gap-1.5">
                  {filteredUserPresets.map(preset => (
                    <div key={preset.id} className="group relative aspect-square">
                      <button
                        type="button"
                        onClick={() => applyPreset(preset.value)}
                        title={preset.name}
                        className="size-full cursor-pointer rounded-md border border-[var(--border)] shadow-sm transition hover:border-[var(--border-strong)] hover:shadow-md hover:scale-105 active:scale-95"
                        style={{
                          backgroundImage: gradientValueToCss(preset.value),
                        }}
                      />
                      {/* Delete badge */}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          handleDeleteUserPreset(preset.id)
                        }}
                        title="Delete preset"
                        className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100 hover:bg-red-500 hover:text-white hover:border-red-500"
                      >
                        <svg
                          width="7"
                          height="7"
                          viewBox="0 0 7 7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        >
                          <path d="M1 1L6 6M6 1L1 6" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save preset */}
            {savingPreset ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={saveInputRef}
                  type="text"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSavePreset()
                    if (e.key === 'Escape') {
                      setSavingPreset(false)
                      setPresetName('')
                    }
                  }}
                  placeholder="Preset name…"
                  className="h-7 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[0.6875rem] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--focus-ring)]"
                />
                <button
                  type="button"
                  onClick={handleSavePreset}
                  className="h-7 shrink-0 rounded-md border border-[var(--border-strong)] bg-[var(--hover-strong)] px-2.5 text-[0.6875rem] font-semibold text-[var(--text)] transition hover:bg-[var(--hover)]"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSavingPreset(false)
                    setPresetName('')
                  }}
                  className="h-7 shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[0.6875rem] text-[var(--text-muted)] transition hover:bg-[var(--hover)]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSavingPreset(true)}
                className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--border)] bg-transparent text-[0.6875rem] font-medium text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M5 1V9M1 5H9" />
                </svg>
                Save Current as Preset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stop strip */}
      <div className="grid gap-1.5">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          Color Stops
        </span>
        <div className="relative">
          <div
            ref={trackRef}
            onPointerDown={handleTrackPointerDown}
            className="relative h-7 w-full cursor-copy rounded-md border border-[var(--border)]"
            style={{
              backgroundImage: gradientValueToCss({
                ...value,
                kind: 'linear',
                angle: 90,
              }),
            }}
          >
            {sortedStops.map(s => (
              <button
                key={s.id}
                type="button"
                data-stop-handle
                onPointerDown={e => handleStopPointerDown(e, s.id)}
                aria-label={`Stop at ${Math.round(s.offset * 100)}%`}
                className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 shadow-md transition-transform active:cursor-grabbing ${
                  s.id === activeStopId
                    ? 'z-10 border-white ring-2 ring-[var(--text)] scale-110'
                    : 'border-white hover:scale-110'
                }`}
                style={{
                  left: `${s.offset * 100}%`,
                  backgroundColor: s.color,
                }}
              />
            ))}
          </div>
          <p className="mt-1 text-[0.625rem] text-[var(--text-subtle)]">
            Click the bar to add a stop · Drag to move
          </p>
        </div>
      </div>

      {/* Active stop editor */}
      {activeStop ? (
        <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
              Active Stop
            </span>
            {value.stops.length > 2 ? (
              <button
                type="button"
                onClick={removeActiveStop}
                className="text-[0.6875rem] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]"
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative shrink-0" ref={pickerRef}>
              <button
                type="button"
                onClick={() => setOpenCustom(o => !o)}
                className="size-8 rounded-lg border border-[var(--border)] shadow-sm"
                aria-label="Open color picker"
                style={{ backgroundColor: activeStop.color }}
              />
              {openCustom ? (
                <div className="absolute left-0 z-50 mt-2">
                  <ColorPicker
                    value={activeStop.color}
                    onChange={hex => {
                      updateActiveColor(hex)
                    }}
                  />
                </div>
              ) : null}
            </div>
            <input
              type="text"
              value={activeStop.color}
              onChange={e => updateActiveColor(e.target.value)}
              className="h-8 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 font-mono text-[0.75rem] font-medium uppercase text-[var(--text)] outline-none focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--focus-ring)]"
              spellCheck={false}
            />
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(activeStop.offset * 100)}
              onChange={e => {
                const n = Number(e.target.value)
                if (!Number.isFinite(n)) return
                onChange({
                  ...value,
                  stops: value.stops.map(s =>
                    s.id === activeStop.id
                      ? { ...s, offset: clamp01(n / 100) }
                      : s,
                  ),
                })
              }}
              className="h-8 w-14 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-right text-[0.75rem] font-medium tabular-nums text-[var(--text)] outline-none focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--focus-ring)]"
            />
            <span className="shrink-0 text-[0.625rem] text-[var(--text-subtle)]">
              %
            </span>
          </div>
        </div>
      ) : null}

      {/* Angle (linear & conic) */}
      {value.kind === 'linear' || value.kind === 'conic' ? (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
              Angle
            </span>
            <span className="text-[0.6875rem] font-medium tabular-nums text-[var(--text-muted)]">
              {value.angle}°
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AngleDial
              angle={value.angle}
              onChange={a => onChange({ ...value, angle: clampAngle(a) })}
            />
            <input
              type="range"
              min={0}
              max={360}
              value={value.angle}
              onChange={e =>
                onChange({
                  ...value,
                  angle: clampAngle(Number(e.target.value)),
                })
              }
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border)] outline-none accent-[var(--text)] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[var(--border-strong)] [&::-webkit-slider-thumb]:bg-white"
            />
          </div>
        </div>
      ) : null}

      {/* Center position (radial & conic) */}
      {value.kind === 'radial' || value.kind === 'conic' ? (
        <CenterPicker
          x={value.centerX ?? 0.5}
          y={value.centerY ?? 0.5}
          onChange={(cx, cy) =>
            onChange({ ...value, centerX: cx, centerY: cy })
          }
        />
      ) : null}
    </div>
  )
}

// ── Angle dial ───────────────────────────────────────────────────────────────

function angleDegFromPointer(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): number {
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const dx = clientX - cx
  const dy = clientY - cy
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  if (deg < 0) deg += 360
  return Math.round(deg)
}

function AngleDial({
  angle,
  onChange,
}: {
  angle: number
  onChange: (a: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current || !ref.current) return
      e.preventDefault()
      onChangeRef.current(angleDegFromPointer(ref.current, e.clientX, e.clientY))
    }
    const onUp = () => {
      draggingRef.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const rad = ((angle - 90) * Math.PI) / 180
  const needleLen = 36

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Angle"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={angle}
      onPointerDown={e => {
        e.preventDefault()
        draggingRef.current = true
        if (ref.current) {
          onChange(angleDegFromPointer(ref.current, e.clientX, e.clientY))
        }
      }}
      className="relative size-8 shrink-0 cursor-grab touch-none rounded-full border border-[var(--border-strong)] bg-[var(--surface)] active:cursor-grabbing"
    >
      <div
        className="absolute left-1/2 top-1/2 h-3 w-px origin-top bg-[var(--text)]"
        style={{
          transform: `translate(-50%, 0) rotate(${angle}deg)`,
          transformOrigin: '50% 0%',
        }}
      />
      <div className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--text)]" />
      <div
        className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--text)]"
        style={{
          left: `${50 + Math.cos(rad) * needleLen}%`,
          top: `${50 + Math.sin(rad) * needleLen}%`,
        }}
      />
    </div>
  )
}

// ── Center picker (2D pad) ───────────────────────────────────────────────────

function CenterPicker({
  x,
  y,
  onChange,
}: {
  x: number
  y: number
  onChange: (x: number, y: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current || !ref.current) return
      e.preventDefault()
      const r = ref.current.getBoundingClientRect()
      onChangeRef.current(
        clamp01((e.clientX - r.left) / r.width),
        clamp01((e.clientY - r.top) / r.height),
      )
    }
    const onUp = () => {
      draggingRef.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          Center
        </span>
        <span className="text-[0.6875rem] font-medium tabular-nums text-[var(--text-muted)]">
          {Math.round(x * 100)}% · {Math.round(y * 100)}%
        </span>
      </div>
      <div
        ref={ref}
        onPointerDown={e => {
          e.preventDefault()
          draggingRef.current = true
          const el = ref.current
          if (!el) return
          const r = el.getBoundingClientRect()
          onChange(
            clamp01((e.clientX - r.left) / r.width),
            clamp01((e.clientY - r.top) / r.height),
          )
        }}
        className="relative h-20 w-full cursor-crosshair touch-none rounded-lg border border-[var(--border)] bg-[var(--surface)]"
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--border)]" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--border)]" />
        <div
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--text)] shadow-md"
          style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
        />
      </div>
    </div>
  )
}