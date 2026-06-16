import { useCallback, useEffect, useRef, useState } from 'react'

export type GradientStop = { color: string; offset: number; id: string }
export type GradientKind = 'linear' | 'radial' | 'conic'

export type GradientValue = {
  kind: GradientKind
  stops: GradientStop[]
  angle: number
  centerX?: number
  centerY?: number
}

const HEX6 = /^#[0-9A-Fa-f]{6}$/

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

  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<string | null>(null)

  // ── Stop drag handlers — attached once ────────────────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const id = draggingRef.current
      const track = trackRef.current
      if (!id || !track) return
      const rect = track.getBoundingClientRect()
      const offset = clamp01((e.clientX - rect.left) / rect.width)
      const v = valueRef.current
      onChangeRef.current({
        ...v,
        stops: v.stops.map(s => (s.id === id ? { ...s, offset } : s)),
      })
    }
    const onUp = () => {
      draggingRef.current = null
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
      draggingRef.current = id
    },
    [],
  )

  // ── Add stop by clicking the track ─────────────────────────────────────
  // FIX: bail out if the pointerdown target is a stop button, so clicking
  // an existing stop doesn't also create a new one.
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
    onChangeRef.current({
      ...v,
      stops: [...v.stops, { color: newColor, offset, id }],
    })
    setActiveStopId(id)
    draggingRef.current = id
  }, [])

  const updateActiveColor = (color: string) => {
    if (!activeStop) return
    onChange({
      ...value,
      stops: value.stops.map(s =>
        s.id === activeStop.id ? { ...s, color } : s,
      ),
    })
  }

  const removeActiveStop = () => {
    if (!activeStop || value.stops.length <= 2) return
    const next = value.stops.filter(s => s.id !== activeStop.id)
    onChange({ ...value, stops: next })
    setActiveStopId(next[0]?.id ?? '')
  }

  const previewCss = gradientValueToCss(value)

  return (
    <div className="grid gap-3">
      {/* Kind switcher */}
      <div className="grid gap-1">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--text-subtle)]">
          Gradient Type
        </span>
        {/* FIX: use onPointerDown instead of onClick so the kind change fires
            before any ancestor pointerdown handler can interfere. */}
        <div className="flex gap-1">
          {(['linear', 'radial', 'conic'] as const).map(kind => (
            <button
              key={kind}
              type="button"
              onPointerDown={e => {
                e.preventDefault()
                e.stopPropagation()
                onChange({ ...value, kind })
              }}
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
                // FIX: data attribute so handleTrackPointerDown can detect
                // that the event originated from a stop and bail out.
                data-stop-handle
                onPointerDown={e => handleStopPointerDown(e, s.id)}
                onClick={e => {
                  e.stopPropagation()
                  setActiveStopId(s.id)
                }}
                aria-label={`Stop at ${Math.round(s.offset * 100)}%`}
                className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 shadow-md transition active:cursor-grabbing ${
                  s.id === activeStopId
                    ? 'border-white ring-2 ring-[var(--text)] scale-110'
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
        <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-2.5">
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
            <div className="relative shrink-0">
              <input
                type="color"
                value={HEX6.test(activeStop.color) ? activeStop.color : '#ffffff'}
                onChange={e => updateActiveColor(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div
                className="size-8 rounded-lg border border-[var(--border)] shadow-sm"
                style={{ backgroundColor: activeStop.color }}
              />
            </div>
            <input
              type="text"
              value={activeStop.color}
              onChange={e => {
                const v = e.target.value
                updateActiveColor(v)
              }}
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
                    s.id === activeStop.id ? { ...s, offset: clamp01(n / 100) } : s,
                  ),
                })
              }}
              className="h-8 w-14 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-right text-[0.75rem] font-medium tabular-nums text-[var(--text)] outline-none focus:border-[var(--border-strong)] focus:ring-1 focus:ring-[var(--focus-ring)]"
            />
            <span className="shrink-0 text-[0.625rem] text-[var(--text-subtle)]">%</span>
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
                onChange({ ...value, angle: clampAngle(Number(e.target.value)) })
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
          onChange={(x, y) => onChange({ ...value, centerX: x, centerY: y })}
        />
      ) : null}
    </div>
  )
}

// ── Angle dial ───────────────────────────────────────────────────────────────

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
      if (!draggingRef.current) return
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
      let final = deg
      if (final < 0) final += 360
      onChangeRef.current(Math.round(final))
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
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
        let final = deg
        if (final < 0) final += 360
        onChange(Math.round(final))
      }}
      className="relative size-8 shrink-0 cursor-grab touch-none rounded-full border border-[var(--border-strong)] bg-[var(--surface)] active:cursor-grabbing"
    >
      <div
        className="absolute left-1/2 top-1/2 h-3 w-px origin-top -translate-x-1/2 bg-[var(--text)]"
        style={{ transform: `translate(-50%, 0) rotate(${angle}deg)` }}
      />
      <div className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--text)]" />
      <div
        className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--text)]"
        style={{
          left: `${50 + Math.cos(rad) * 36}%`,
          top: `${50 + Math.sin(rad) * 36}%`,
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
      if (!draggingRef.current) return
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
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