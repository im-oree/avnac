import { type BgValue, bgValueToCss } from '../components/background-popover'
import {
  type AvnacDocument,
  getObjectAnchors,
  type ResolvedTextPath,
  resolveCornerRadii,
  resolveTextPathSource,
  type SceneArrow,
  type SceneLine,
  type SceneObject,
  type SceneText,
} from './avnac-scene'
import { flattenAnchorsToArcLengthTable, pointAtArcLength } from './avnac-path-arc-length'
import { iconSvgToDataUrl } from './avnac-icon'
import { getExportSafeImageUrl } from './avnac-image-proxy'
import { shadowColorString } from './avnac-shadow'
import {
  flattenVisibleStrokes,
  type VectorBoardDocument,
  type VectorBoardStroke,
} from './avnac-vector-board-document'
import { samplePenAnchorsToPolyline } from './avnac-vector-pen-bezier'
import { loadGoogleFontFamily } from './load-google-font'
import { fastCreateImageBitmap } from './webgpu-image'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINE_HEIGHT_DEFAULT       = 1.22
const LINE_HEIGHT_MIN           = 0.6
const LINE_HEIGHT_MAX           = 4.0
const SHARPEN_SCALE_MAX         = 2
const MOTION_BLUR_PASSES_MIN    = 6
const MOTION_BLUR_PASSES_MAX    = 20
const MAX_BLUR_PX               = 28

// ---------------------------------------------------------------------------
// Module-level caches
// ---------------------------------------------------------------------------

const imageElementCache  = new Map<string, Promise<HTMLImageElement>>()
let   measureCanvas:     HTMLCanvasElement | null = null
let   textStrokeCanvas:  HTMLCanvasElement | null = null

// ---------------------------------------------------------------------------
// Utility / guard helpers
// ---------------------------------------------------------------------------

const clamp01           = (v: number) => Math.max(0, Math.min(1, v))
const clamp             = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const isFiniteNumber    = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const degToRad          = (deg: number) => (deg * Math.PI) / 180

// ---------------------------------------------------------------------------
// Lazy singleton canvases
// ---------------------------------------------------------------------------

function getOrCreateCanvas(
  ref: { current: HTMLCanvasElement | null },
  label: string,
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  if (!ref.current) {
    ref.current = document.createElement('canvas')
    ref.current.setAttribute('data-purpose', label)
  }
  return ref.current
}

const measureCanvasRef    = { current: measureCanvas }
const textStrokeCanvasRef = { current: textStrokeCanvas }

function getMeasureContext(): CanvasRenderingContext2D | null {
  return getOrCreateCanvas(measureCanvasRef, 'text-measure')?.getContext('2d') ?? null
}

function getTextStrokeCanvas(): HTMLCanvasElement | null {
  return getOrCreateCanvas(textStrokeCanvasRef, 'text-stroke')
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function sceneTextLineHeight(obj: SceneText): number {
  return isFiniteNumber(obj.lineHeight)
    ? clamp(obj.lineHeight, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX)
    : LINE_HEIGHT_DEFAULT
}

export function sceneTextLetterSpacing(obj: SceneText): number {
  return isFiniteNumber(obj.letterSpacing) ? obj.letterSpacing : 0
}

function setTextFont(ctx: CanvasRenderingContext2D, obj: SceneText): void {
  ctx.font = `${obj.fontStyle} ${obj.fontWeight} ${obj.fontSize}px "${obj.fontFamily}", sans-serif`
}

export function measureSceneTextWidth(
  obj: SceneText,
  line: string,
  ctx?: CanvasRenderingContext2D | null,
): number {
  const measure = ctx ?? getMeasureContext()
  if (!measure) return Math.max(0, Array.from(line).length * (obj.fontSize * 0.6))
  setTextFont(measure, obj)
  return measureSceneTextLineWidth(measure, obj, line)
}

function measureSceneTextLineWidth(
  ctx: CanvasRenderingContext2D,
  obj: SceneText,
  line: string,
): number {
  if (!line) return 0
  const spacing = sceneTextLetterSpacing(obj)
  if (spacing === 0) return ctx.measureText(line).width

  const chars = Array.from(line)
  const base  = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0)
  const gap   = Math.max(0, chars.length - 1) * spacing
  return Math.max(0, base + gap)
}

function cssLineBoxBaselineOffset(
  ctx: CanvasRenderingContext2D,
  obj: SceneText,
  lineHeight: number,
): number {
  const m = ctx.measureText('Mg') as TextMetrics & {
    fontBoundingBoxAscent?: number
    fontBoundingBoxDescent?: number
  }
  const ascent = isFiniteNumber(m.fontBoundingBoxAscent)
    ? m.fontBoundingBoxAscent
    : (m.actualBoundingBoxAscent || obj.fontSize * 0.8)
  const descent = isFiniteNumber(m.fontBoundingBoxDescent)
    ? m.fontBoundingBoxDescent
    : (m.actualBoundingBoxDescent || obj.fontSize * 0.2)
  const fontBox = Math.max(1, ascent + descent)
  return (lineHeight - fontBox) / 2 + ascent
}

export function sceneTextBaselineOffset(
  obj: SceneText,
  ctx?: CanvasRenderingContext2D | null,
): number {
  const measure = ctx ?? getMeasureContext()
  if (!measure) return obj.fontSize * 0.8
  setTextFont(measure, obj)
  return cssLineBoxBaselineOffset(measure, obj, obj.fontSize * sceneTextLineHeight(obj))
}

// ---------------------------------------------------------------------------
// Text layout
// ---------------------------------------------------------------------------

export interface SceneTextLayout {
  lines: string[]
  lineHeight: number
  height: number
}

export function layoutSceneText(
  obj: SceneText,
  ctx?: CanvasRenderingContext2D | null,
): SceneTextLayout {
  const lineHeight = obj.fontSize * sceneTextLineHeight(obj)
  const measure = ctx ?? getMeasureContext()

  if (!measure) {
    const rough = obj.text.split(/\r?\n/)
    return { lines: rough, lineHeight, height: rough.length * lineHeight }
  }

  setTextFont(measure, obj)
  const maxWidth = Math.max(8, obj.width)
  const paragraphs = obj.text.split(/\r?\n/)
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) { lines.push(''); continue }

    const tokens = paragraph.split(/(\s+)/).filter(Boolean)
    let current = ''

    for (const token of tokens) {
      const candidate = current ? `${current}${token}` : token

      if (measureSceneTextLineWidth(measure, obj, candidate) <= maxWidth) {
        current = candidate
        continue
      }

      if (!current) {
        const parts = splitTokenToFit(measure, obj, token.trimStart(), maxWidth)
        current = parts.pop() ?? ''
        lines.push(...parts)
        continue
      }

      lines.push(current.trimEnd())
      const remainder = token.trimStart()

      if (!remainder) { current = ''; continue }

      if (measureSceneTextLineWidth(measure, obj, remainder) <= maxWidth) {
        current = remainder
      } else {
        const parts = splitTokenToFit(measure, obj, remainder, maxWidth)
        current = parts.pop() ?? ''
        lines.push(...parts)
      }
    }

    lines.push(current.trimEnd())
  }

  return {
    lines,
    lineHeight,
    height: Math.max(lineHeight, lines.length * lineHeight),
  }
}

function splitTokenToFit(
  ctx: CanvasRenderingContext2D,
  obj: SceneText,
  token: string,
  maxWidth: number,
): string[] {
  if (!token) return ['']
  const parts: string[] = []
  let current = ''

  for (const char of Array.from(token)) {
    const next = current + char
    if (measureSceneTextLineWidth(ctx, obj, next) <= maxWidth || !current) {
      current = next
    } else {
      parts.push(current)
      current = char
    }
  }
  if (current) parts.push(current)
  return parts
}

// ---------------------------------------------------------------------------
// Text drawing
// ---------------------------------------------------------------------------

function drawTextLine(
  ctx: CanvasRenderingContext2D,
  obj: SceneText,
  line: string,
  x: number,
  y: number,
  mode: 'fill' | 'stroke',
): void {
  const spacing = sceneTextLetterSpacing(obj)
  if (spacing === 0 || line.length <= 1) {
    mode === 'stroke' ? ctx.strokeText(line, x, y) : ctx.fillText(line, x, y)
    return
  }

  let cursor = x
  for (const [i, char] of Array.from(line).entries()) {
    mode === 'stroke' ? ctx.strokeText(char, cursor, y) : ctx.fillText(char, cursor, y)
    cursor += ctx.measureText(char).width
    if (i < line.length - 1) cursor += spacing
  }
}

function drawTextLayout(
  ctx: CanvasRenderingContext2D,
  obj: SceneText,
  layout: SceneTextLayout,
  baselineOffset: number,
  mode: 'fill' | 'stroke',
): void {
  const align = obj.textAlign === 'justify' ? 'left' : obj.textAlign
  const anchorX = align === 'center' ? obj.width / 2 : align === 'right' ? obj.width : 0

  for (const [i, line] of layout.lines.entries()) {
    const baselineY = i * layout.lineHeight + baselineOffset
    const lineW = measureSceneTextLineWidth(ctx, obj, line)
    const startX =
      align === 'center'
        ? anchorX - lineW / 2
        : align === 'right'
          ? anchorX - lineW
          : 0
    drawTextLine(ctx, obj, line, startX, baselineY, mode)
  }
}

function drawTextOutsideStroke(
  ctx: CanvasRenderingContext2D,
  obj: SceneText,
  layout: SceneTextLayout,
  baselineOffset: number,
): void {
  if (typeof document === 'undefined') {
    ctx.strokeStyle = bgValueToCanvasPaint(ctx, obj.stroke, obj.width, obj.height)
    ctx.lineWidth = obj.strokeWidth
    drawTextLayout(ctx, obj, layout, baselineOffset, 'stroke')
    return
  }

  const strokeCanvas = getTextStrokeCanvas()
  if (!strokeCanvas) return

  const pad = Math.ceil(Math.max(2, obj.strokeWidth * 2))
  const transform = ctx.getTransform()
  const dpr = Math.max(1, Math.hypot(transform.a, transform.b) || 1)
  const pw = Math.max(1, Math.ceil((obj.width + pad * 2) * dpr))
  const ph = Math.max(1, Math.ceil((Math.max(obj.height, layout.height) + pad * 2) * dpr))

  strokeCanvas.width = pw
  strokeCanvas.height = ph
  const sc = strokeCanvas.getContext('2d')
  if (!sc) return

  sc.setTransform(dpr, 0, 0, dpr, 0, 0)
  sc.clearRect(0, 0, pw / dpr, ph / dpr)
  sc.translate(pad, pad)

  setTextFont(sc, obj)
  sc.textBaseline = 'alphabetic'
  sc.textAlign    = 'left'
  sc.lineJoin     = 'round'
  sc.lineCap      = 'round'
  sc.miterLimit   = 2

  sc.strokeStyle = bgValueToCanvasPaint(sc, obj.stroke, obj.width, obj.height)
  sc.lineWidth   = obj.strokeWidth * 2
  drawTextLayout(sc, obj, layout, baselineOffset, 'stroke')

  sc.globalCompositeOperation = 'destination-out'
  sc.fillStyle = '#000000'
  drawTextLayout(sc, obj, layout, baselineOffset, 'fill')
  sc.globalCompositeOperation = 'source-over'

  ctx.drawImage(strokeCanvas, -pad, -pad, pw / dpr, ph / dpr)
}

function drawTextObject(ctx: CanvasRenderingContext2D, obj: SceneText): void {
  // ── Text-on-path branch ─────────────────────────────────────────────
  if (obj.textPath) {
    const resolver = (ctx as any).__avnacPathResolver as
      | ((text: SceneText) => ResolvedTextPath | null)
      | undefined
    const resolved = resolver?.(obj) ?? null
    if (resolved) {
      drawTextAlongPath(ctx, obj, resolved)
      return
    }
    // Falls through to normal layout when path can't be resolved.
  }

  // ── Standard wrapped/aligned text ───────────────────────────────────
  const layout = layoutSceneText(obj, ctx)
  setTextFont(ctx, obj)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign    = 'left'

  const baselineOffset = cssLineBoxBaselineOffset(ctx, obj, layout.lineHeight)
  const fillPaint = bgValueToCanvasPaint(ctx, obj.fill, obj.width, obj.height)
  const align     = obj.textAlign === 'justify' ? 'left' : obj.textAlign
  const anchorX   = align === 'center' ? obj.width / 2 : align === 'right' ? obj.width : 0

  if (obj.strokeWidth > 0) {
    drawTextOutsideStroke(ctx, obj, layout, baselineOffset)
  }

  for (const [i, line] of layout.lines.entries()) {
    const baselineY = i * layout.lineHeight + baselineOffset
    const lineW = measureSceneTextLineWidth(ctx, obj, line)
    const startX =
      align === 'center'
        ? anchorX - lineW / 2
        : align === 'right'
          ? anchorX - lineW
          : 0

    ctx.fillStyle = fillPaint
    drawTextLine(ctx, obj, line, startX, baselineY, 'fill')

    if (obj.underline && line.length > 0) {
      const underlineY = baselineY + obj.fontSize * 0.12
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(startX, underlineY)
      ctx.lineTo(startX + lineW, underlineY)
      ctx.lineWidth = Math.max(1, obj.fontSize * 0.06)
      ctx.strokeStyle = fillPaint
      ctx.setLineDash([])
      ctx.stroke()
      ctx.restore()
    }
  }
}

/**
 * Render text along a resolved path.
 *
 * The renderer is already positioned in the text object's *own local frame*
 * (translated/rotated to the text's x/y/rotation). The path anchors live in
 * the source object's local frame, so for each character we:
 *
 *   1. Find the (x, y, tangent) at the current arc length in source-local.
 *   2. Convert that point into text-local space (via source → scene → text).
 *   3. Draw the glyph rotated to the tangent.
 */
function drawTextAlongPath(
  ctx: CanvasRenderingContext2D,
  obj: SceneText,
  resolved: ResolvedTextPath,
): void {
  setTextFont(ctx, obj)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign    = 'left'

  const table = flattenAnchorsToArcLengthTable(resolved.anchors, resolved.closed)
  if (!table || table.total <= 0) return

  // Pre-build source-local → text-local mapping.
  const toTextLocal = (px: number, py: number): { x: number; y: number } => {
    if (resolved.source.kind === 'snapshot' || !resolved.source.object) {
      return { x: px, y: py }
    }
    const src = resolved.source.object
    // 1. source-local → scene
    const cx = src.x + src.width / 2
    const cy = src.y + src.height / 2
    const sr = degToRad(src.rotation)
    const scos = Math.cos(sr), ssin = Math.sin(sr)
    const rx = px - src.width / 2
    const ry = py - src.height / 2
    const sceneX = cx + rx * scos - ry * ssin
    const sceneY = cy + rx * ssin + ry * scos
    // 2. scene → text-local
    const tcx = obj.x + obj.width / 2
    const tcy = obj.y + obj.height / 2
    const tr  = degToRad(-obj.rotation)
    const tcos = Math.cos(tr), tsin = Math.sin(tr)
    const dx = sceneX - tcx
    const dy = sceneY - tcy
    return {
      x: dx * tcos - dy * tsin + obj.width / 2,
      y: dx * tsin + dy * tcos + obj.height / 2,
    }
  }

  // Total text width (single line; line-breaks within text-on-path are ignored).
  const flatText = obj.text.replace(/\r?\n/g, ' ')
  const chars = Array.from(flatText)
  if (chars.length === 0) return

  const spacing = sceneTextLetterSpacing(obj)
  let totalWidth = 0
  for (let i = 0; i < chars.length; i++) {
    totalWidth += ctx.measureText(chars[i]!).width
    if (i < chars.length - 1) totalWidth += spacing
  }

  const startOffset = clamp01(obj.textPath?.startOffset ?? 0)
  const align       = obj.textPath?.align ?? 'start'
  const sideFlip    = obj.textPath?.side === 'bottom'

  // Compute starting arc-length distance based on align mode.
  let cursor = startOffset * table.total
  if (align === 'center') cursor += Math.max(0, (table.total - totalWidth) / 2)
  else if (align === 'end') cursor += Math.max(0, table.total - totalWidth)

  const fillPaint = bgValueToCanvasPaint(ctx, obj.fill, obj.width, obj.height)
  ctx.fillStyle = fillPaint

  // Baseline shift: characters sit slightly above the line so they look "on" it.
  const baselineNudge = obj.fontSize * 0.25

  for (const ch of chars) {
    const charWidth = ctx.measureText(ch).width
    const midDist   = cursor + charWidth / 2
    const sample    = pointAtArcLength(table, midDist)
    const local     = toTextLocal(sample.x, sample.y)

    ctx.save()
    ctx.translate(local.x, local.y)
    ctx.rotate(sample.tangent + (sideFlip ? Math.PI : 0))
    ctx.fillText(ch, -charWidth / 2, sideFlip ? -baselineNudge * -1 : baselineNudge)
    ctx.restore()

    cursor += charWidth + spacing
    if (!table.closed && cursor > table.total) break
  }
}

// ---------------------------------------------------------------------------
// Gradient / paint helpers
// ---------------------------------------------------------------------------

function makeLinearGradient(
  ctx: CanvasRenderingContext2D,
  stops: { color: string; offset: number }[],
  angleDeg: number,
  width: number,
  height: number,
): CanvasGradient {
  const rad = degToRad(angleDeg)
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const cx = width / 2
  const cy = height / 2
  const tx = dx !== 0 ? width / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY
  const ty = dy !== 0 ? height / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY
  const halfLen = Math.min(tx, ty)

  const gradient = ctx.createLinearGradient(
    cx - dx * halfLen, cy - dy * halfLen,
    cx + dx * halfLen, cy + dy * halfLen,
  )
  for (const stop of stops) gradient.addColorStop(stop.offset, stop.color)
  return gradient
}

function makeRadialGradient(
  ctx: CanvasRenderingContext2D,
  stops: { color: string; offset: number }[],
  width: number,
  height: number,
  centerX = 0.5,
  centerY = 0.5,
): CanvasGradient {
  const cx = width * centerX
  const cy = height * centerY
  const radius = Math.max(
    1,
    Math.hypot(cx, cy),
    Math.hypot(width - cx, cy),
    Math.hypot(cx, height - cy),
    Math.hypot(width - cx, height - cy),
  )
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  for (const stop of stops) gradient.addColorStop(stop.offset, stop.color)
  return gradient
}

function makeConicGradient(
  ctx: CanvasRenderingContext2D,
  stops: { color: string; offset: number }[],
  width: number,
  height: number,
  startAngleDeg: number,
  centerX = 0.5,
  centerY = 0.5,
): CanvasGradient | string {
  if (typeof (ctx as any).createConicGradient !== 'function') {
    return stops[0]?.color ?? '#000000'
  }
  const cx = width * centerX
  const cy = height * centerY
  const startRad = degToRad(startAngleDeg - 90)
  const gradient = (ctx as any).createConicGradient(startRad, cx, cy) as CanvasGradient
  for (const stop of stops) gradient.addColorStop(stop.offset, stop.color)
  return gradient
}

export function bgValueToCanvasPaint(
  ctx: CanvasRenderingContext2D,
  value: BgValue,
  width: number,
  height: number,
): string | CanvasGradient {
  if (value.type === 'solid') return value.color
  const kind = value.gradientKind ?? 'linear'
  switch (kind) {
    case 'radial':
      return makeRadialGradient(ctx, value.stops, width, height, value.centerX, value.centerY)
    case 'conic':
      return makeConicGradient(ctx, value.stops, width, height, value.angle, value.centerX, value.centerY)
    default:
      return makeLinearGradient(ctx, value.stops, value.angle, width, height)
  }
}

export function bgValueToSceneCss(value: BgValue): string {
  return bgValueToCss(value)
}

// ---------------------------------------------------------------------------
// Blur helpers
// ---------------------------------------------------------------------------

export function blurPxFromPct(blurPct: number): number {
  return Math.max(0, Math.min(MAX_BLUR_PX, (clamp(blurPct, 0, 100) / 100) * MAX_BLUR_PX))
}

function composeLayerFilter(obj: SceneObject): string {
  const blur = blurPxFromPct(obj.blurPct)
  const type = obj.blurType ?? 'layer'
  if (blur <= 0 || type !== 'layer') return 'none'
  return `blur(${blur}px)`
}

// ---------------------------------------------------------------------------
// Image effects
// ---------------------------------------------------------------------------

export function buildCssFilterForImage(effects: any, obj: SceneObject): string {
  const parts: string[] = []
  const brightness = effects?.color?.brightness ?? 0
  const contrast = effects?.color?.contrast ?? 0
  const saturation = effects?.color?.saturation ?? 0
  const blurPx = blurPxFromPct((obj as any).blurPct ?? 0)
  const blurType = (obj as any).blurType ?? 'layer'

  if (blurPx > 0 && blurType === 'layer') parts.push(`blur(${blurPx}px)`)
  if (brightness !== 0) parts.push(`brightness(${100 + brightness}%)`)
  if (contrast !== 0) parts.push(`contrast(${100 + contrast}%)`)
  if (saturation !== 0) parts.push(`saturate(${100 + saturation}%)`)
  return parts.length > 0 ? parts.join(' ') : 'none'
}

function applySharpenToImageData(imageData: ImageData, amount: number): void {
  const { width: w, height: h, data: src } = imageData
  const out = new Uint8ClampedArray(src.length)
  const s = clamp(amount / 100, 0, SHARPEN_SCALE_MAX)
  const kernel = [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0]

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4
      let r = 0, g = 0, b = 0, ki = 0
      for (let ky = -1; ky <= 1; ky++) {
        const sy = clamp(y + ky, 0, h - 1)
        for (let kx = -1; kx <= 1; kx++) {
          const sx = clamp(x + kx, 0, w - 1)
          const si = (sy * w + sx) * 4
          const kv = kernel[ki++]!
          r += src[si]!     * kv
          g += src[si + 1]! * kv
          b += src[si + 2]! * kv
        }
      }
      out[di]     = clamp(Math.round(r), 0, 255)
      out[di + 1] = clamp(Math.round(g), 0, 255)
      out[di + 2] = clamp(Math.round(b), 0, 255)
      out[di + 3] = src[di + 3]!
    }
  }
  imageData.data.set(out)
}

function applyNoiseToImageData(imageData: ImageData, amount: number): void {
  const { data } = imageData
  const range = Math.round(128 * clamp01(amount / 100))
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() * 2 - 1) * range
    data[i]!     = clamp(Math.round(data[i]!     + n), 0, 255)
    data[i + 1]! = clamp(Math.round(data[i + 1]! + n), 0, 255)
    data[i + 2]! = clamp(Math.round(data[i + 2]! + n), 0, 255)
  }
}

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

export async function loadSceneImageElement(rawUrl: string): Promise<HTMLImageElement> {
  const safeUrl = getExportSafeImageUrl(rawUrl)
  const cacheKey = safeUrl || rawUrl
  const cached = imageElementCache.get(cacheKey)
  if (cached) return cached

  const task = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    const isDataOrBlob = safeUrl.startsWith('data:') || safeUrl.startsWith('blob:')
    if (!isDataOrBlob) img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${rawUrl}`))
    img.src = safeUrl
  })

  imageElementCache.set(cacheKey, task)
  try {
    return await task
  } catch (err) {
    imageElementCache.delete(cacheKey)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Shape drawing helpers
// ---------------------------------------------------------------------------

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number,
  radii: number | [number, number, number, number],
): void {
  const maxR = Math.min(width, height) / 2
  const [tl, tr, br, bl] = (Array.isArray(radii) ? radii : [radii, radii, radii, radii]).map(
    r => clamp(r, 0, maxR),
  ) as [number, number, number, number]

  ctx.beginPath()
  if ('roundRect' in ctx) {
    ;(ctx as any).roundRect(x, y, width, height, [tl, tr, br, bl])
    return
  }
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + width - tr, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + tr)
  ctx.lineTo(x + width, y + height - br)
  ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height)
  ctx.lineTo(x + bl, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - bl)
  ctx.lineTo(x, y + tl)
  ctx.quadraticCurveTo(x, y, x + tl, y)
  ctx.closePath()
}

type FillableShape = Extract<SceneObject, { fill: BgValue; stroke: BgValue; strokeWidth: number }>

function fillAndStrokeShape(ctx: CanvasRenderingContext2D, obj: FillableShape): void {
  ctx.fillStyle = bgValueToCanvasPaint(ctx, obj.fill, obj.width, obj.height)
  ctx.fill()
  if (obj.strokeWidth > 0) {
    ctx.lineWidth = obj.strokeWidth
    ctx.strokeStyle = bgValueToCanvasPaint(ctx, obj.stroke, obj.width, obj.height)
    ctx.stroke()
  }
}

function polygonPoints(sides: number, width: number, height: number): [number, number][] {
  const count = Math.max(3, sides)
  const rx = width / 2
  const ry = height / 2
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i / count) * Math.PI * 2
    return [rx + Math.cos(a) * rx, ry + Math.sin(a) * ry]
  })
}

function starPoints(points: number, width: number, height: number): [number, number][] {
  const count = Math.max(4, points)
  const rx = width / 2
  const ry = height / 2
  const inner = 0.45
  return Array.from({ length: count * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (i / (count * 2)) * Math.PI * 2
    const r = i % 2 === 0 ? 1 : inner
    return [rx + Math.cos(a) * rx * r, ry + Math.sin(a) * ry * r]
  })
}

function drawPointPath(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  close = true,
): void {
  if (pts.length === 0) return
  ctx.beginPath()
  ctx.moveTo(pts[0]![0], pts[0]![1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1])
  if (close) ctx.closePath()
}

// ---------------------------------------------------------------------------
// Line / Arrow helpers
// ---------------------------------------------------------------------------

function applyShadow(ctx: CanvasRenderingContext2D, obj: SceneObject): void {
  if (!obj.shadow) {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    return
  }
  ctx.shadowColor = shadowColorString(obj.shadow)
  ctx.shadowBlur = obj.shadow.blur
  ctx.shadowOffsetX = obj.shadow.offsetX
  ctx.shadowOffsetY = obj.shadow.offsetY
}

function applyDash(ctx: CanvasRenderingContext2D, obj: SceneLine | SceneArrow): void {
  const w = obj.strokeWidth
  if (obj.lineStyle === 'dashed') ctx.setLineDash([w * 3, w * 2])
  else if (obj.lineStyle === 'dotted') ctx.setLineDash([w * 0.5, w * 1.8])
  else ctx.setLineDash([])
}

function drawArrowPath(ctx: CanvasRenderingContext2D, obj: SceneArrow): void {
  const pad = obj.strokeWidth / 2
  const tailX = pad
  const tipX = Math.max(pad + 1, obj.width - obj.strokeWidth * 1.8)
  const midY = obj.height / 2
  ctx.beginPath()
  if (obj.pathType === 'curved') {
    const cx = tailX + (tipX - tailX) * obj.curveT
    const cy = midY - obj.curveBulge
    ctx.moveTo(tailX, midY)
    ctx.quadraticCurveTo(cx, cy, tipX, midY)
  } else {
    ctx.moveTo(tailX, midY)
    ctx.lineTo(tipX, midY)
  }
}

function drawArrowHead(ctx: CanvasRenderingContext2D, obj: SceneArrow): void {
  const headLen = Math.max(obj.strokeWidth * 2, obj.strokeWidth * 4 * obj.headSize)
  const spread  = Math.max(obj.strokeWidth * 1.6, obj.strokeWidth * 3.2 * obj.headSize)
  const tipX    = obj.width - obj.strokeWidth * 0.5
  const midY    = obj.height / 2
  ctx.beginPath()
  ctx.moveTo(tipX, midY)
  ctx.lineTo(tipX - headLen, midY - spread / 2)
  ctx.lineTo(tipX - headLen * 0.82, midY)
  ctx.lineTo(tipX - headLen, midY + spread / 2)
  ctx.closePath()
  ctx.fill()
}

// ---------------------------------------------------------------------------
// Vector-board drawing
// ---------------------------------------------------------------------------

function drawVectorStroke(
  ctx: CanvasRenderingContext2D,
  stroke: VectorBoardStroke,
  width: number,
  height: number,
): void {
  const lineWidth = Math.max(0.5, stroke.strokeWidthN * Math.min(width, height))
  ctx.strokeStyle = stroke.stroke || '#1a1a1a'
  ctx.fillStyle   = stroke.fill   || 'transparent'
  ctx.lineWidth   = lineWidth
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'

  const hasPenAnchors =
    stroke.kind === 'pen' && stroke.penAnchors && stroke.penAnchors.length >= 2
  const rawPoints = hasPenAnchors
    ? samplePenAnchorsToPolyline(stroke.penAnchors!, 18, stroke.penClosed === true)
    : stroke.points

  if (rawPoints.length < 2) return

  const px = rawPoints.map(([x, y]) => [x * width, y * height] as const)
  const hasFill = !!stroke.fill && stroke.fill !== 'transparent'

  switch (stroke.kind) {
    case 'rect': {
      const [a, b] = [px[0]!, px[px.length - 1]!]
      ctx.beginPath()
      ctx.rect(
        Math.min(a[0], b[0]), Math.min(a[1], b[1]),
        Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]),
      )
      if (hasFill) ctx.fill()
      ctx.stroke()
      return
    }
    case 'ellipse': {
      const [a, b] = [px[0]!, px[px.length - 1]!]
      ctx.beginPath()
      ctx.ellipse(
        (a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
        Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2,
        0, 0, Math.PI * 2,
      )
      if (hasFill) ctx.fill()
      ctx.stroke()
      return
    }
    case 'polygon':
      drawPointPath(ctx, px as [number, number][])
      if (hasFill) ctx.fill()
      ctx.stroke()
      return
    case 'arrow': {
      const [a, b] = [px[0]!, px[px.length - 1]!]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const angle = Math.atan2(dy, dx)
      const head = Math.max(lineWidth * 3.2, 12)
      const spread = Math.max(lineWidth * 2.2, 8)
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(b[0], b[1])
      ctx.lineTo(
        b[0] - head * Math.cos(angle) + spread * Math.sin(angle) * 0.5,
        b[1] - head * Math.sin(angle) - spread * Math.cos(angle) * 0.5,
      )
      ctx.lineTo(
        b[0] - head * Math.cos(angle) - spread * Math.sin(angle) * 0.5,
        b[1] - head * Math.sin(angle) + spread * Math.cos(angle) * 0.5,
      )
      ctx.closePath()
      ctx.fillStyle = stroke.stroke || '#1a1a1a'
      ctx.fill()
      return
    }
    default: {
      ctx.beginPath()
      ctx.moveTo(px[0]![0], px[0]![1])
      for (let i = 1; i < px.length; i++) ctx.lineTo(px[i]![0], px[i]![1])
      if (stroke.kind === 'pen' && stroke.penClosed) ctx.closePath()
      if (hasFill && stroke.kind === 'pen') ctx.fill()
      ctx.stroke()
    }
  }
}

export function renderVectorBoardDocumentToCanvas(
  ctx: CanvasRenderingContext2D,
  doc: VectorBoardDocument,
  width: number,
  height: number,
  opts?: { fillBackground?: boolean },
): void {
  if (opts?.fillBackground !== false) {
    ctx.fillStyle = '#f8f8f7'
    ctx.fillRect(0, 0, width, height)
  }
  for (const stroke of flattenVisibleStrokes(doc)) {
    drawVectorStroke(ctx, stroke, width, height)
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function containSquareInRect(
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const size = Math.max(0, Math.min(width, height))
  return { x: (width - size) / 2, y: (height - size) / 2, width: size, height: size }
}

// ---------------------------------------------------------------------------
// Motion + background blur
// ---------------------------------------------------------------------------

async function drawWithMotionBlur(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  drawInner: () => Promise<void> | void,
): Promise<void> {
  const blur = blurPxFromPct(obj.blurPct)
  if (blur <= 0) { await drawInner(); return }

  const rad = degToRad(obj.motionBlurAngle ?? 0)
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const passes = clamp(Math.round(blur * 1.5), MOTION_BLUR_PASSES_MIN, MOTION_BLUR_PASSES_MAX)
  const baseAlpha = (ctx as any).globalAlpha ?? 1

  ctx.save()
  for (let i = 0; i < passes; i++) {
    const t = (i / (passes - 1)) * 2 - 1
    const offset = t * blur * 1.5
    ctx.save()
    ctx.translate(dx * offset, dy * offset)
    ;(ctx as any).globalAlpha = baseAlpha * (2 / passes)
    await drawInner()
    ctx.restore()
  }
  ctx.restore()
}

async function drawWithBackgroundBlur(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  drawInner: () => Promise<void> | void,
): Promise<void> {
  const blur = blurPxFromPct(obj.blurPct)
  if (blur <= 0 || typeof document === 'undefined') { await drawInner(); return }

  const transform = ctx.getTransform()
  const dpr = Math.max(1, Math.hypot(transform.a, transform.b) || 1)
  const pad = Math.ceil(blur * 2)
  const logW = Math.ceil(obj.width + pad * 2)
  const logH = Math.ceil(obj.height + pad * 2)
  const snapW = Math.max(1, Math.round(logW * dpr))
  const snapH = Math.max(1, Math.round(logH * dpr))

  const tmp = document.createElement('canvas')
  tmp.width = snapW
  tmp.height = snapH
  const tmpCtx = tmp.getContext('2d')
  if (!tmpCtx) { await drawInner(); return }

  const tl = transform.transformPoint(new DOMPoint(-pad, -pad))
  const sx = Math.max(0, Math.floor(tl.x))
  const sy = Math.max(0, Math.floor(tl.y))

  try {
    tmpCtx.drawImage(ctx.canvas, sx, sy, snapW, snapH, 0, 0, snapW, snapH)
    tmpCtx.filter = `blur(${blur * dpr}px)`
    tmpCtx.drawImage(tmp, 0, 0)
    tmpCtx.filter = 'none'
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, obj.width, obj.height)
    ctx.clip()
    ctx.drawImage(tmp, -pad, -pad, logW, logH)
    ctx.restore()
  } catch {
    // tainted canvas — silently skip
  }
  await drawInner()
}

// ---------------------------------------------------------------------------
// Image object rendering
// ---------------------------------------------------------------------------

async function drawImageObject(
  ctx: CanvasRenderingContext2D,
  obj: Extract<SceneObject, { type: 'image' }>,
): Promise<void> {
  const img = await loadSceneImageElement(obj.src)
  const cropRot = obj.crop.rotation || 0
  const radii = resolveCornerRadii(obj)

  ctx.save()
  drawRoundedRectPath(ctx, 0, 0, obj.width, obj.height, radii)
  ctx.clip()

  const w = Math.max(1, Math.round(obj.width))
  const h = Math.max(1, Math.round(obj.height))

  if (typeof document !== 'undefined') {
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    const tctx = tmp.getContext('2d')

    if (tctx) {
      const effects = (obj as any).imageEffects ?? {}
      const cssFilter = buildCssFilterForImage(effects, obj)

      try {
        const bitmap = await fastCreateImageBitmap(
          img,
          obj.crop.x, obj.crop.y,
          Math.max(1, obj.crop.width),
          Math.max(1, obj.crop.height),
          w, h,
        )
        tctx.save()
        tctx.filter = cssFilter
        if (Math.abs(cropRot) < 0.001) {
          tctx.drawImage(bitmap, 0, 0, w, h)
        } else {
          tctx.translate(w / 2, h / 2)
          tctx.rotate(degToRad(cropRot))
          tctx.drawImage(bitmap, -w / 2, -h / 2, w, h)
        }
        tctx.restore()
        if (typeof (bitmap as any).close === 'function') (bitmap as any).close()
      } catch {
        tctx.save()
        tctx.filter = cssFilter
        if (Math.abs(cropRot) < 0.001) {
          tctx.drawImage(img, obj.crop.x, obj.crop.y, obj.crop.width, obj.crop.height, 0, 0, w, h)
        } else {
          const scaleX = obj.width / Math.max(1, obj.crop.width)
          const scaleY = obj.height / Math.max(1, obj.crop.height)
          const cropCX = obj.crop.x + obj.crop.width / 2
          const cropCY = obj.crop.y + obj.crop.height / 2
          tctx.translate(w / 2, h / 2)
          tctx.scale(scaleX, scaleY)
          tctx.rotate(degToRad(cropRot))
          tctx.drawImage(img, -cropCX, -cropCY)
        }
        tctx.restore()
      }

      try {
        if (effects?.sharpen?.enabled && (effects.sharpen.amount ?? 0) > 0) {
          const id = tctx.getImageData(0, 0, w, h)
          applySharpenToImageData(id, effects.sharpen.amount)
          tctx.putImageData(id, 0, 0)
        }
        if ((effects?.noise?.amount ?? 0) > 0) {
          const id = tctx.getImageData(0, 0, w, h)
          applyNoiseToImageData(id, effects.noise.amount)
          tctx.putImageData(id, 0, 0)
        }
      } catch {
        // tainted canvas
      }

      const distort = effects?.distort ?? {}
      const sx = ((distort.scaleX ?? 100) as number) / 100
      const sy = ((distort.scaleY ?? 100) as number) / 100
      const skew = degToRad(distort.skew ?? 0)

      ctx.save()
      ctx.translate(obj.width / 2, obj.height / 2)
      ctx.transform(sx, Math.tan(skew), 0, sy, 0, 0)
      ctx.drawImage(tmp, -obj.width / 2, -obj.height / 2, obj.width, obj.height)
      ctx.restore()
    } else {
      ctx.drawImage(img, obj.crop.x, obj.crop.y, obj.crop.width, obj.crop.height, 0, 0, w, h)
    }
  } else {
    await drawImageNonBrowser(ctx, img, obj, cropRot, w, h)
  }

  ctx.restore()
}

async function drawImageNonBrowser(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  obj: Extract<SceneObject, { type: 'image' }>,
  cropRot: number,
  w: number,
  h: number,
): Promise<void> {
  const tryBitmap = async (rotate: boolean) => {
    const bitmap = await fastCreateImageBitmap(
      img,
      obj.crop.x, obj.crop.y,
      Math.max(1, obj.crop.width),
      Math.max(1, obj.crop.height),
      w, h,
    )
    if (rotate) {
      ctx.translate(obj.width / 2, obj.height / 2)
      ctx.rotate(degToRad(cropRot))
      ctx.drawImage(bitmap, -obj.width / 2, -obj.height / 2, obj.width, obj.height)
    } else {
      ctx.drawImage(bitmap, 0, 0, obj.width, obj.height)
    }
    if (typeof (bitmap as any).close === 'function') (bitmap as any).close()
  }

  if (Math.abs(cropRot) < 0.001) {
    try { await tryBitmap(false) }
    catch {
      ctx.drawImage(img, obj.crop.x, obj.crop.y, obj.crop.width, obj.crop.height, 0, 0, w, h)
    }
  } else {
    try { await tryBitmap(true) }
    catch {
      const scaleX = obj.width / Math.max(1, obj.crop.width)
      const scaleY = obj.height / Math.max(1, obj.crop.height)
      ctx.translate(obj.width / 2, obj.height / 2)
      ctx.scale(scaleX, scaleY)
      ctx.rotate(degToRad(cropRot))
      ctx.drawImage(img, -(obj.crop.x + obj.crop.width / 2), -(obj.crop.y + obj.crop.height / 2))
    }
  }
}

// ---------------------------------------------------------------------------
// Font preloading
// ---------------------------------------------------------------------------

export async function preloadFontsForDocument(doc: AvnacDocument): Promise<void> {
  const fonts = new Set<string>()
  const visit = (obj: SceneObject) => {
    if (obj.type === 'text') fonts.add(obj.fontFamily)
    if (obj.type === 'group') obj.children.forEach(visit)
  }
  for (const obj of doc.objects) visit(obj)
  await Promise.all([...fonts].map(f => loadGoogleFontFamily(f)))
}

// ---------------------------------------------------------------------------
// Scene object dispatcher
// ---------------------------------------------------------------------------

async function drawSceneObject(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  vectorBoardDocs: Record<string, VectorBoardDocument>,
): Promise<void> {
  if (!obj.visible) return

  ctx.save()
  ;(ctx as any).globalAlpha = ((ctx as any).globalAlpha ?? 1) * obj.opacity

  applyShadow(ctx, obj)
  ctx.filter = composeLayerFilter(obj)

  ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2)
  ctx.rotate(degToRad(obj.rotation))
  ctx.translate(-obj.width / 2, -obj.height / 2)

  const innerDraw = async () => {
    switch (obj.type) {
      case 'rect': {
        drawRoundedRectPath(ctx, 0, 0, obj.width, obj.height, resolveCornerRadii(obj))
        fillAndStrokeShape(ctx, obj)
        break
      }
      case 'ellipse': {
        ctx.beginPath()
        ctx.ellipse(obj.width / 2, obj.height / 2, obj.width / 2, obj.height / 2, 0, 0, Math.PI * 2)
        fillAndStrokeShape(ctx, obj)
        break
      }
      case 'polygon': {
        drawPointPath(ctx, polygonPoints(obj.sides, obj.width, obj.height))
        fillAndStrokeShape(ctx, obj)
        break
      }
      case 'star': {
        drawPointPath(ctx, starPoints(obj.points, obj.width, obj.height))
        fillAndStrokeShape(ctx, obj)
        break
      }
      case 'line': {
        ctx.strokeStyle = bgValueToCanvasPaint(ctx, obj.stroke, obj.width, obj.height)
        ctx.lineWidth = obj.strokeWidth
        ctx.lineCap = obj.roundedEnds ? 'round' : 'butt'
        applyDash(ctx, obj)
        ctx.beginPath()
        ctx.moveTo(obj.strokeWidth / 2, obj.height / 2)
        ctx.lineTo(obj.width - obj.strokeWidth / 2, obj.height / 2)
        ctx.stroke()
        ctx.setLineDash([])
        break
      }
      case 'arrow': {
        const arrowPaint = bgValueToCanvasPaint(ctx, obj.stroke, obj.width, obj.height)
        ctx.strokeStyle = arrowPaint
        ctx.fillStyle   = arrowPaint
        ctx.lineWidth   = obj.strokeWidth
        ctx.lineCap     = obj.roundedEnds ? 'round' : 'butt'
        ctx.lineJoin    = 'round'
        applyDash(ctx, obj)
        drawArrowPath(ctx, obj)
        ctx.stroke()
        ctx.setLineDash([])
        drawArrowHead(ctx, obj)
        break
      }
      case 'path': {
        const a = getObjectAnchors(obj)
        if (!a) break
        ctx.strokeStyle = bgValueToCanvasPaint(ctx, obj.stroke, obj.width, obj.height)
        ctx.lineWidth = obj.strokeWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        if (a.anchors[0]) ctx.moveTo(a.anchors[0].x, a.anchors[0].y)
        const segCount = a.closed ? a.anchors.length : a.anchors.length - 1
        for (let i = 0; i < segCount; i++) {
          const p = a.anchors[i]!
          const q = a.anchors[(i + 1) % a.anchors.length]!
          const c1x = p.outX ?? p.x
          const c1y = p.outY ?? p.y
          const c2x = q.inX  ?? q.x
          const c2y = q.inY  ?? q.y
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, q.x, q.y)
        }
        if (a.closed) ctx.closePath()
        if (a.closed && obj.fill) {
          ctx.fillStyle = bgValueToCanvasPaint(ctx, obj.fill, obj.width, obj.height)
          ctx.fill()
        }
        if (obj.strokeWidth > 0) ctx.stroke()
        break
      }
      case 'text': {
        drawTextObject(ctx, obj)
        break
      }
      case 'image': {
        await drawImageObject(ctx, obj)
        break
      }
      case 'icon': {
        const iconImg = await loadSceneImageElement(
          iconSvgToDataUrl(obj.svg, { fill: obj.fill, strokeWidth: obj.strokeWidth }),
        )
        const box = containSquareInRect(obj.width, obj.height)
        ctx.drawImage(iconImg, box.x, box.y, box.width, box.height)
        break
      }
      case 'vector-board': {
        const vbDoc = vectorBoardDocs[obj.boardId]
        if (vbDoc) {
          renderVectorBoardDocumentToCanvas(ctx, vbDoc, obj.width, obj.height, {
            fillBackground: false,
          })
        }
        break
      }
      case 'group': {
        for (const child of obj.children) {
          await drawSceneObject(ctx, child, vectorBoardDocs)
        }
        break
      }
    }
  }

  const blurType = obj.blurType ?? 'layer'
  const blur = blurPxFromPct(obj.blurPct)
  if (blur > 0 && blurType === 'motion') {
    await drawWithMotionBlur(ctx, obj, innerDraw)
  } else if (blur > 0 && blurType === 'background') {
    await drawWithBackgroundBlur(ctx, obj, innerDraw)
  } else {
    await innerDraw()
  }

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Public rendering API
// ---------------------------------------------------------------------------

export async function renderAvnacDocumentToCanvas(
  ctx: CanvasRenderingContext2D,
  doc: AvnacDocument,
  vectorBoardDocs: Record<string, VectorBoardDocument>,
  opts?: { transparent?: boolean },
): Promise<void> {
  const { width, height } = doc.artboard
  ctx.clearRect(0, 0, width, height)
  if (!opts?.transparent) {
    ctx.fillStyle = bgValueToCanvasPaint(ctx, doc.bg, width, height)
    ctx.fillRect(0, 0, width, height)
  }

  await preloadFontsForDocument(doc)

  // Path resolver for text-on-path. Attached to the context so drawTextObject
  // can read it without changing every renderer signature.
  ;(ctx as any).__avnacPathResolver = (text: SceneText) =>
    resolveTextPathSource(text, doc.objects)

  try {
    for (const obj of doc.objects) {
      await drawSceneObject(ctx, obj, vectorBoardDocs)
    }
  } finally {
    delete (ctx as any).__avnacPathResolver
  }
}

export async function renderAvnacDocumentToDataUrl(
  doc: AvnacDocument,
  vectorBoardDocs: Record<string, VectorBoardDocument>,
  opts?: {
    format?: 'png' | 'jpg' | 'webp'
    multiplier?: number
    transparent?: boolean
  },
): Promise<string> {
  const multiplier = Math.max(1, Math.round(opts?.multiplier ?? 1))
  const format = opts?.format ?? 'png'
  const mimeType =
    format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(doc.artboard.width * multiplier))
  canvas.height = Math.max(1, Math.round(doc.artboard.height * multiplier))

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not acquire 2-D context for export canvas.')

  ctx.setTransform(multiplier, 0, 0, multiplier, 0, 0)
  await renderAvnacDocumentToCanvas(ctx, doc, vectorBoardDocs, { transparent: opts?.transparent })
  return canvas.toDataURL(mimeType)
}