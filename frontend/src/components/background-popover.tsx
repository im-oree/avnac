import { type CSSProperties, useState } from 'react'
import ColorPicker from './ui/color-picker/ColorPicker'

export type GradientKind = 'linear' | 'radial' | 'conic'

export type GradientStop = { color: string; offset: number }

export type BgValue =
  | { type: 'solid'; color: string }
  | {
      type: 'gradient'
      css: string
      stops: GradientStop[]
      angle: number
      gradientKind?: GradientKind // defaults to 'linear' for backwards compat
      centerX?: number // 0..1 — for radial & conic, defaults 0.5
      centerY?: number
    }
  | {
      type: 'image'
      src: string
      fit?: 'fill' | 'fit' | 'crop' | 'tile'
      uv?: {
        offsetX?: number
        offsetY?: number
        scaleX?: number
        scaleY?: number
        rotation?: number
        repeatX?: boolean
        repeatY?: boolean
        anchorX?: number
        anchorY?: number
      }
      opacity?: number
    }

export function isTransparentCssColor(value: string): boolean {
  const s = value.trim().toLowerCase()
  if (s === 'transparent' || s === 'none') return true
  const m =
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/.exec(s)
  if (m && m[4] !== undefined) {
    const a = parseFloat(m[4])
    return Number.isFinite(a) && a === 0
  }
  if (/^#[0-9a-f]{8}$/i.test(s)) return s.slice(7, 9).toLowerCase() === '00'
  return false
}

export function solidPaintColorsEquivalent(a: string, b: string): boolean {
  if (a === b) return true
  return isTransparentCssColor(a) && isTransparentCssColor(b)
}

const TRANSPARENT_SWATCH_STYLE: CSSProperties = {
  background: 'repeating-conic-gradient(#e2e2e2 0% 25%, #fafafa 0% 50%)',
  backgroundSize: '8px 8px',
}

export const PRESET_SOLIDS = [
  'transparent',
  '#ffffff',
  '#f8f9fa',
  '#f1f3f5',
  '#e9ecef',
  '#dee2e6',
  '#212529',
  '#0c8ce9',
  '#339af0',
  '#51cf66',
  '#fcc419',
  '#ff922b',
  '#ff6b6b',
  '#cc5de8',
  '#845ef7',
  '#5c7cfa',
  '#22b8cf',
  '#20c997',
  '#94d82d',
]

export const PRESET_GRADIENTS: {
  stops: GradientStop[]
  angle: number
  gradientKind?: GradientKind
}[] = [
  { stops: [{ color: '#667eea', offset: 0 }, { color: '#764ba2', offset: 1 }], angle: 135 },
  { stops: [{ color: '#f093fb', offset: 0 }, { color: '#f5576c', offset: 1 }], angle: 135 },
  { stops: [{ color: '#4facfe', offset: 0 }, { color: '#00f2fe', offset: 1 }], angle: 135 },
  { stops: [{ color: '#43e97b', offset: 0 }, { color: '#38f9d7', offset: 1 }], angle: 135 },
  { stops: [{ color: '#fa709a', offset: 0 }, { color: '#fee140', offset: 1 }], angle: 135 },
  { stops: [{ color: '#a18cd1', offset: 0 }, { color: '#fbc2eb', offset: 1 }], angle: 135 },
  { stops: [{ color: '#fccb90', offset: 0 }, { color: '#d57eeb', offset: 1 }], angle: 135 },
  { stops: [{ color: '#e0c3fc', offset: 0 }, { color: '#8ec5fc', offset: 1 }], angle: 135 },
  {
    stops: [{ color: '#ff9a9e', offset: 0 }, { color: '#fecfef', offset: 1 }],
    angle: 0,
    gradientKind: 'radial',
  },
  {
    stops: [
      { color: '#ff0080', offset: 0 },
      { color: '#7928ca', offset: 0.5 },
      { color: '#2afadf', offset: 1 },
    ],
    angle: 0,
    gradientKind: 'conic',
  },
  { stops: [{ color: '#0c0c0c', offset: 0 }, { color: '#3a3a3a', offset: 1 }], angle: 135 },
  { stops: [{ color: '#f5f7fa', offset: 0 }, { color: '#c3cfe2', offset: 1 }], angle: 135 },
]

export function gradientStopsToCss(stops: GradientStop[]): string {
  return [...stops]
    .sort((a, b) => a.offset - b.offset)
    .map(s => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(', ')
}

export function gradientToCss(
  stops: GradientStop[],
  angle: number,
  kind: GradientKind = 'linear',
  centerX = 0.5,
  centerY = 0.5,
): string {
  const stopStr = gradientStopsToCss(stops)
  const cx = Math.round(centerX * 100)
  const cy = Math.round(centerY * 100)
  if (kind === 'radial') {
    return `radial-gradient(circle at ${cx}% ${cy}%, ${stopStr})`
  }
  if (kind === 'conic') {
    return `conic-gradient(from ${angle}deg at ${cx}% ${cy}%, ${stopStr})`
  }
  return `linear-gradient(${angle}deg, ${stopStr})`
}

export function gradientCss(stops: GradientStop[], angle: number): string {
  // legacy alias — assumes linear
  return gradientToCss(stops, angle, 'linear')
}

export function bgValueToCss(v: BgValue): string {
  if (v.type === 'solid') return v.color
  if (v.type === 'gradient') {
    // Always re-derive css so any in-memory mutations to stops/angle/kind are reflected
    return gradientToCss(
      v.stops,
      v.angle,
      v.gradientKind ?? 'linear',
      v.centerX ?? 0.5,
      v.centerY ?? 0.5,
    )
  }
  if (v.type === 'image') {
    // Used for simple CSS previews only.
    return `url("${v.src}")`
  }
  return ''
}

export function bgValueToSwatch(v: BgValue): CSSProperties {
  if (v.type === 'solid' && isTransparentCssColor(v.color)) return TRANSPARENT_SWATCH_STYLE
  if (v.type === 'solid') return { backgroundColor: v.color }
  if (v.type === 'gradient') return { backgroundImage: bgValueToCss(v) }
  if (v.type === 'image')
    return {
      backgroundImage: `url(${v.src})`,
      backgroundSize: v.fit === 'fit' ? 'contain' : 'cover',
      backgroundPosition:
        v.uv && (v.uv.offsetX || v.uv.offsetY)
          ? `${v.uv.offsetX || 0}px ${v.uv.offsetY || 0}px`
          : 'center',
      backgroundRepeat: v.fit === 'tile' ? 'repeat' : 'no-repeat',
    }
  return {}
}

export { TRANSPARENT_SWATCH_STYLE }

// ─── Backwards compat default export ────────────────────────────────────────
// The old popover is no longer used by the inspector. Anything still importing
// the default `BackgroundPopover` gets a tiny shim — solid presets only — so
// we don't break existing callers while the inspector takes over.

type Props = { value: BgValue; onChange: (v: BgValue) => void }

export default function BackgroundPopover({ value, onChange }: Props) {
  const [openCustom, setOpenCustom] = useState(false)

  return (
    <div className="p-2">
      <div className="grid grid-cols-6 gap-2 mb-2">
        {PRESET_SOLIDS.map(hex => (
          <button
            key={hex}
            type="button"
            aria-label={hex}
            onClick={() => onChange({ type: 'solid', color: hex })}
            className={`size-8 rounded-full border transition ${
              value.type === 'solid' && solidPaintColorsEquivalent(value.color, hex)
                ? 'border-[var(--duo-primary)] ring-2 ring-[var(--focus-ring)]'
                : 'border-[var(--border)] hover:border-[var(--border-strong)]'
            }`}
            style={
              isTransparentCssColor(hex)
                ? TRANSPARENT_SWATCH_STYLE
                : { backgroundColor: hex }
            }
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn"
          onClick={() => setOpenCustom(o => !o)}
        >
          Custom
        </button>
        {openCustom ? (
          <ColorPicker
            value={value.type === 'solid' ? value.color : '#000000'}
            onChange={hex => onChange({ type: 'solid', color: hex })}
          />
        ) : null}
      </div>
    </div>
  )
}