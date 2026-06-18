import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import useEyeDropper from '../../../hooks/useEyeDropper'
import './ColorPicker.css'

type Props = {
  value?: string
  onChange: (hex: string) => void
}

type HSV = { h: number; s: number; v: number }

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function normalizeHex(input?: string): string | null {
  if (!input) return null

  let hex = input.trim().replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(c => c + c)
      .join('')
  }

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null
  return `#${hex.toUpperCase()}`
}

function coerceHex(input?: string, fallback = '#000000') {
  return normalizeHex(input) ?? fallback
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

function rgbToHsv(r: number, g: number, b: number): HSV {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255

  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / d) % 6)
    else if (max === gg) h = 60 * ((bb - rr) / d + 2)
    else h = 60 * ((rr - gg) / d + 4)
  }

  if (h < 0) h += 360

  return {
    h,
    s: max === 0 ? 0 : d / max,
    v: max,
  }
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s
  const hh = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))

  let r = 0
  let g = 0
  let b = 0

  if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0]
  else if (hh < 2) [r, g, b] = [x, c, 0]
  else if (hh < 3) [r, g, b] = [0, c, x]
  else if (hh < 4) [r, g, b] = [0, x, c]
  else if (hh < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  const m = v - c
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  }
}

function hexToHsv(hex: string): HSV {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHsv(r, g, b)
}

function hsvToHex(hsv: HSV) {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v)
  return rgbToHex(r, g, b)
}

export default function ColorPicker({ value, onChange }: Props) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(coerceHex(value)))
  const [text, setText] = useState(() => coerceHex(value))
  const [picking, setPicking] = useState(false)

  const svRef = useRef<HTMLDivElement | null>(null)
  const hueRef = useRef<HTMLDivElement | null>(null)

  const { pick } = useEyeDropper()

  const hex = useMemo(() => hsvToHex(hsv), [hsv])
  const hueColor = useMemo(
    () => hsvToHex({ h: hsv.h, s: 1, v: 1 }),
    [hsv.h]
  )

  useEffect(() => {
    const next = coerceHex(value)
    setHsv(hexToHsv(next))
    setText(next)
  }, [value])

  function applyHex(nextHex: string) {
    const normalized = normalizeHex(nextHex)
    if (!normalized) return
    setHsv(hexToHsv(normalized))
    setText(normalized)
    onChange(normalized)
  }

  function applyHsv(next: HSV) {
    const safe = {
      h: ((next.h % 360) + 360) % 360,
      s: clamp(next.s, 0, 1),
      v: clamp(next.v, 0, 1),
    }
    const nextHex = hsvToHex(safe)
    setHsv(safe)
    setText(nextHex)
    onChange(nextHex)
  }

  function bindDrag(onMove: (e: PointerEvent) => void) {
    const move = (e: PointerEvent) => onMove(e)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function updateSv(clientX: number, clientY: number) {
    const el = svRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()

    const s = clamp((clientX - rect.left) / rect.width, 0, 1)
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1)

    applyHsv({ ...hsv, s, v })
  }

  function updateHue(clientY: number) {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()

    const ratio = clamp((clientY - rect.top) / rect.height, 0, 0.999)
    applyHsv({ ...hsv, h: ratio * 360 })
  }

  function onSvPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault()
    updateSv(e.clientX, e.clientY)
    bindDrag(ev => updateSv(ev.clientX, ev.clientY))
  }

  function onHuePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault()
    updateHue(e.clientY)
    bindDrag(ev => updateHue(ev.clientY))
  }

  function commitText() {
    const normalized = normalizeHex(text)
    if (normalized) applyHex(normalized)
    else setText(hex)
  }

  async function handleEyeDropper() {
    if (picking) return
    setPicking(true)
    try {
      const result = await pick()
      const normalized = normalizeHex(result?.sRGBHex)
      if (normalized) applyHex(normalized)
    } catch {
      // cancelled / unsupported
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className="cp-square">
      <div
        ref={svRef}
        className="cp-sv"
        style={{ backgroundColor: hueColor }}
        onPointerDown={onSvPointerDown}
        tabIndex={0}
        aria-label="Saturation and brightness"
        onKeyDown={e => {
          const step = e.shiftKey ? 0.08 : 0.03
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            applyHsv({ ...hsv, s: hsv.s - step })
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            applyHsv({ ...hsv, s: hsv.s + step })
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            applyHsv({ ...hsv, v: hsv.v + step })
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            applyHsv({ ...hsv, v: hsv.v - step })
          }
        }}
      >
        <div className="cp-sv-white" />
        <div className="cp-sv-black" />
        <div
          className="cp-thumb"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            backgroundColor: hex,
          }}
        />
      </div>

      <div
        ref={hueRef}
        className="cp-hue"
        onPointerDown={onHuePointerDown}
        tabIndex={0}
        aria-label="Hue"
        onKeyDown={e => {
          const step = e.shiftKey ? 20 : 5
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            applyHsv({ ...hsv, h: hsv.h - step })
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            applyHsv({ ...hsv, h: hsv.h + step })
          }
        }}
      >
        <div
          className="cp-hue-thumb"
          style={{ top: `${(hsv.h / 360) * 100}%`, backgroundColor: hex }}
        />
      </div>

      <div className="cp-bottom">
        <label
          className="cp-swatch"
          style={{ backgroundColor: hex }}
          title="Open system color picker"
        >
          <input
            type="color"
            value={hex}
            onChange={e => applyHex(e.target.value)}
            aria-label="Open system color picker"
          />
        </label>

        <input
          className="cp-input"
          value={text}
          onChange={e => {
            const raw = e.target.value.toUpperCase()
            setText(raw)
            const normalized = normalizeHex(raw)
            if (normalized) {
              setHsv(hexToHsv(normalized))
              onChange(normalized)
            }
          }}
          onBlur={commitText}
          onKeyDown={e => {
            if (e.key === 'Enter') commitText()
            if (e.key === 'Escape') setText(hex)
          }}
          placeholder="#RRGGBB"
          spellCheck={false}
        />

        <button
          type="button"
          className="cp-eye"
          onClick={handleEyeDropper}
          aria-label="Pick from screen"
          aria-pressed={picking}
          title="Pick from screen"
        >
          {picking ? '...' : 'Pick'}
        </button>
      </div>
    </div>
  )
}