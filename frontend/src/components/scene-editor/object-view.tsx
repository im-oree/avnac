import {
  type CSSProperties,
  createElement,
  type PointerEvent as ReactPointerEvent,
  useLayoutEffect,
  useRef,
} from 'react'

import { iconSvgNodeAttrs, sceneIconPaintValue } from '../../lib/avnac-icon'
import {
  resolveCornerRadii,
  type SceneArrow,
  type SceneObject,
  type SceneText,
} from '../../lib/avnac-scene'
import {
  blurPxFromPct,
  layoutSceneText,
  measureSceneTextWidth,
  renderVectorBoardDocumentToCanvas,
  sceneTextBaselineOffset,
  sceneTextLetterSpacing,
  sceneTextLineHeight,
} from '../../lib/avnac-scene-render'
import type { VectorBoardDocument } from '../../lib/avnac-vector-board-document'
import type { BgValue } from '../background-popover'

// ─── Filter / blur helpers ───────────────────────────────────────────────────

function objectShadowFilterPart(obj: SceneObject): string | null {
  if (!obj.shadow) return null
  const alpha = Math.max(0, Math.min(100, obj.shadow.opacityPct)) / 100
  const hex = obj.shadow.colorHex.replace('#', '')
  const r = Number.parseInt(hex.slice(0, 2), 16) || 0
  const g = Number.parseInt(hex.slice(2, 4), 16) || 0
  const b = Number.parseInt(hex.slice(4, 6), 16) || 0
  return `drop-shadow(${obj.shadow.offsetX}px ${obj.shadow.offsetY}px ${obj.shadow.blur}px rgba(${r},${g},${b},${alpha}))`
}

/**
 * Compose `filter` for the wrapper.
 *  - layer blur  → `filter: blur(Npx)` (applies to the element + descendants)
 *  - motion blur → `filter: blur(Npx)` only along the motion axis, approximated
 *                  using an SVG filter referenced via url(#...) when possible;
 *                  CSS-only fallback uses a slightly stretched blur.
 *  - background  → no filter here, handled with `backdrop-filter` on an overlay.
 */
function objectFilterCss(obj: SceneObject): string | undefined {
  const filters: string[] = []
  const blur = blurPxFromPct(obj.blurPct)
  const blurType = obj.blurType ?? 'layer'

  if (blur > 0 && blurType === 'layer') {
    filters.push(`blur(${blur}px)`)
  }
  // motion blur uses an SVG filter referenced via url(#id) — composed in the
  // SVG defs of the object; for non-SVG wrappers (image, vector-board, group)
  // we fall back to a regular blur so users still see _something_.
  if (blur > 0 && blurType === 'motion') {
    filters.push(`blur(${blur * 0.7}px)`)
  }

  const shadow = objectShadowFilterPart(obj)
  if (shadow) filters.push(shadow)

  return filters.length > 0 ? filters.join(' ') : undefined
}

function objectBackdropFilterCss(obj: SceneObject): string | undefined {
  const blur = blurPxFromPct(obj.blurPct)
  const blurType = obj.blurType ?? 'layer'
  if (blur > 0 && blurType === 'background') {
    return `blur(${blur}px)`
  }
  return undefined
}

// ─── Border radius helpers ───────────────────────────────────────────────────

function cornerRadiusCss(obj: SceneObject): string | number {
  if (obj.type !== 'rect' && obj.type !== 'image') return 0
  const [tl, tr, br, bl] = resolveCornerRadii(obj)
  if (tl === tr && tr === br && br === bl) return tl
  return `${tl}px ${tr}px ${br}px ${bl}px`
}

/**
 * Returns an SVG path `d` string for a rounded rectangle with independent corner radii.
 * Order: [TL, TR, BR, BL]
 */
function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: [number, number, number, number],
): string {
  const maxR = Math.min(width, height) / 2
  const tl = Math.max(0, Math.min(radii[0], maxR))
  const tr = Math.max(0, Math.min(radii[1], maxR))
  const br = Math.max(0, Math.min(radii[2], maxR))
  const bl = Math.max(0, Math.min(radii[3], maxR))
  return [
    `M ${x + tl} ${y}`,
    `L ${x + width - tr} ${y}`,
    tr > 0 ? `Q ${x + width} ${y} ${x + width} ${y + tr}` : '',
    `L ${x + width} ${y + height - br}`,
    br > 0 ? `Q ${x + width} ${y + height} ${x + width - br} ${y + height}` : '',
    `L ${x + bl} ${y + height}`,
    bl > 0 ? `Q ${x} ${y + height} ${x} ${y + height - bl}` : '',
    `L ${x} ${y + tl}`,
    tl > 0 ? `Q ${x} ${y} ${x + tl} ${y}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ')
}

// ─── Gradient / paint helpers ────────────────────────────────────────────────

function gradientEndpoints(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const tx = dx !== 0 ? 0.5 / Math.abs(dx) : Number.POSITIVE_INFINITY
  const ty = dy !== 0 ? 0.5 / Math.abs(dy) : Number.POSITIVE_INFINITY
  const halfLen = Math.min(tx, ty)
  return {
    x1: `${(0.5 - dx * halfLen) * 100}%`,
    y1: `${(0.5 - dy * halfLen) * 100}%`,
    x2: `${(0.5 + dx * halfLen) * 100}%`,
    y2: `${(0.5 + dy * halfLen) * 100}%`,
  }
}

function svgGradientDef(id: string, value: BgValue, w: number, h: number) {
  if (value.type !== 'gradient') return null
  const kind = value.gradientKind ?? 'linear'
  const stops = [...value.stops].sort((a, b) => a.offset - b.offset)
  const stopEls = stops.map(stop => (
    <stop
      key={`${id}-${stop.offset}-${stop.color}`}
      offset={`${stop.offset * 100}%`}
      stopColor={stop.color}
    />
  ))

  if (kind === 'radial') {
    const cx = (value.centerX ?? 0.5) * 100
    const cy = (value.centerY ?? 0.5) * 100
    return (
      <radialGradient id={id} cx={`${cx}%`} cy={`${cy}%`} r="70%" fx={`${cx}%`} fy={`${cy}%`}>
        {stopEls}
      </radialGradient>
    )
  }

  if (kind === 'conic') {
    // SVG can't render conic natively; we use a <pattern> with a CSS-rendered
    // <foreignObject> as the source. The pattern is referenced via fill="url(#id)".
    const cx = Math.round((value.centerX ?? 0.5) * 100)
    const cy = Math.round((value.centerY ?? 0.5) * 100)
    const stopStr = stops
      .map(s => `${s.color} ${Math.round(s.offset * 100)}%`)
      .join(', ')
    const conicCss = `conic-gradient(from ${value.angle}deg at ${cx}% ${cy}%, ${stopStr})`
    return (
      <pattern id={id} x={0} y={0} width={w} height={h} patternUnits="userSpaceOnUse">
        <foreignObject x={0} y={0} width={w} height={h}>
          {/* @ts-expect-error xmlns prop on a foreign div */}
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              width: '100%',
              height: '100%',
              background: conicCss,
            }}
          />
        </foreignObject>
      </pattern>
    )
  }

  const ends = gradientEndpoints(value.angle)
  return (
    <linearGradient id={id} x1={ends.x1} y1={ends.y1} x2={ends.x2} y2={ends.y2}>
      {stopEls}
    </linearGradient>
  )
}

function svgPaintUrl(id: string, value: BgValue) {
  return value.type === 'solid' ? value.color : `url(#${id})`
}

// ─── Motion blur SVG filter ──────────────────────────────────────────────────

function motionBlurFilterDef(id: string, blur: number, angleDeg: number) {
  if (blur <= 0) return null
  // Apply a 1-D gaussian blur along the X axis, then rotate the whole filter
  // by `angleDeg` so the streak follows the motion direction.
  const dev = Math.max(0.001, blur)
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation={`${dev} 0`} />
    </filter>
  )
}

function motionBlurFilterRotationStyle(obj: SceneObject): CSSProperties | undefined {
  const blur = blurPxFromPct(obj.blurPct)
  if (!(blur > 0 && (obj.blurType ?? 'layer') === 'motion')) return undefined
  // Wrapper rotation applies the directional smear since the SVG filter only
  // blurs along X — we counter-rotate the inner contents so the artwork stays
  // oriented while the blur direction matches motionBlurAngle.
  return undefined // handled inside the SVG wrappers per-element if desired
}

// ─── Layout style ────────────────────────────────────────────────────────────

function objectTransformStyle(obj: SceneObject): CSSProperties {
  return {
    position: 'absolute',
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    transform: `rotate(${obj.rotation}deg)`,
    transformOrigin: 'center center',
    opacity: obj.opacity,
    filter: objectFilterCss(obj),
    overflow: 'visible',
  }
}

// ─── Background blur overlay ─────────────────────────────────────────────────
// Renders a sibling absolutely-positioned div that sits *behind* the object's
// painted content (z-index -1 within the same stacking context) and applies
// `backdrop-filter` to blur whatever sits beneath the artboard at that area.
// We clip it to the object's shape via border-radius / mask.

function BackgroundBlurLayer({
  obj,
  borderRadius,
}: {
  obj: SceneObject
  borderRadius?: string | number
}) {
  const backdropFilter = objectBackdropFilterCss(obj)
  if (!backdropFilter) return null
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backdropFilter,
        WebkitBackdropFilter: backdropFilter,
        borderRadius,
      }}
    />
  )
}

// ─── Vector board preview ────────────────────────────────────────────────────

function VectorBoardObjectPreview({
  doc,
  width,
  height,
}: {
  doc: VectorBoardDocument | undefined
  width: number
  height: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (!doc) return
    renderVectorBoardDocumentToCanvas(ctx, doc, width, height, {
      fillBackground: false,
    })
  }, [doc, width, height])

  return <canvas ref={ref} className="block h-full w-full rounded-xl" aria-hidden />
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function SceneObjectView({
  obj,
  vectorBoardDocs,
  textEditingId,
  textDraft,
  onObjectPointerDown,
  onObjectHoverChange,
  onTextDoubleClick,
  onTextDraftChange,
  onTextDraftCommit,
}: {
  obj: SceneObject
  vectorBoardDocs: Record<string, VectorBoardDocument>
  textEditingId: string | null
  textDraft: string
  onObjectPointerDown: (e: ReactPointerEvent<HTMLDivElement>, obj: SceneObject) => void
  onObjectHoverChange: (id: string, hovering: boolean) => void
  onTextDoubleClick: (obj: SceneText) => void
  onTextDraftChange: (value: string) => void
  onTextDraftCommit: () => void
}) {
  const isEditing = obj.type === 'text' && textEditingId === obj.id
  const style = objectTransformStyle(obj)
  const defsIdBase = obj.id.replace(/[^a-zA-Z0-9_-]/g, '')
  const hoverProps = {
    onPointerMove: () => onObjectHoverChange(obj.id, true),
    onPointerOver: () => onObjectHoverChange(obj.id, true),
    onPointerEnter: () => onObjectHoverChange(obj.id, true),
    onPointerLeave: () => onObjectHoverChange(obj.id, false),
  }

  // ── Group ──────────────────────────────────────────────────────────────
  if (obj.type === 'group') {
    return (
      <div
        style={style}
        data-avnac-scene-object
        data-avnac-scene-object-id={obj.id}
        onPointerDown={e => onObjectPointerDown(e, obj)}
        {...hoverProps}
        title={obj.locked ? 'Locked group' : undefined}
      >
        {obj.children.map(child => (
          <div key={child.id} style={{ pointerEvents: 'none' }}>
            <SceneObjectView
              obj={child}
              vectorBoardDocs={vectorBoardDocs}
              textEditingId={textEditingId}
              textDraft={textDraft}
              onObjectPointerDown={onObjectPointerDown}
              onObjectHoverChange={onObjectHoverChange}
              onTextDoubleClick={onTextDoubleClick}
              onTextDraftChange={onTextDraftChange}
              onTextDraftCommit={onTextDraftCommit}
            />
          </div>
        ))}
      </div>
    )
  }

  // ── Image ──────────────────────────────────────────────────────────────
  if (obj.type === 'image') {
    const scaleX = obj.width / Math.max(1, obj.crop.width)
    const scaleY = obj.height / Math.max(1, obj.crop.height)
    const cropRotation = obj.crop.rotation || 0
    const cropCenterX = obj.crop.x + obj.crop.width / 2
    const cropCenterY = obj.crop.y + obj.crop.height / 2
    const radius = cornerRadiusCss(obj)
    return (
      <div
        style={style}
        data-avnac-scene-object
        data-avnac-scene-object-id={obj.id}
        onPointerDown={e => onObjectPointerDown(e, obj)}
        {...hoverProps}
        title={obj.locked ? 'Locked image' : undefined}
      >
        <div
          className="relative h-full w-full overflow-hidden"
          style={{ borderRadius: radius }}
        >
          <BackgroundBlurLayer obj={obj} borderRadius={radius} />
          <img
            src={obj.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{
              left: obj.width / 2 - cropCenterX * scaleX,
              top: obj.height / 2 - cropCenterY * scaleY,
              width: obj.naturalWidth * scaleX,
              height: obj.naturalHeight * scaleY,
              maxWidth: 'none',
              transform: `rotate(${cropRotation}deg)`,
              transformOrigin: `${cropCenterX * scaleX}px ${cropCenterY * scaleY}px`,
            }}
          />
        </div>
      </div>
    )
  }

  // ── Vector board ───────────────────────────────────────────────────────
  if (obj.type === 'vector-board') {
    return (
      <div
        style={style}
        data-avnac-scene-object
        data-avnac-scene-object-id={obj.id}
        onPointerDown={e => onObjectPointerDown(e, obj)}
        {...hoverProps}
        title={obj.locked ? 'Locked vector board' : undefined}
      >
        <BackgroundBlurLayer obj={obj} />
        <VectorBoardObjectPreview
          doc={vectorBoardDocs[obj.boardId]}
          width={obj.width}
          height={obj.height}
        />
      </div>
    )
  }

  // ── Text ───────────────────────────────────────────────────────────────
  if (obj.type === 'text') {
    const layout = layoutSceneText(obj)
    const draftLayout = isEditing ? layoutSceneText({ ...obj, text: textDraft }) : layout
    const lineHeight = sceneTextLineHeight(obj)
    const letterSpacing = sceneTextLetterSpacing(obj)
    const lineHeightPx = obj.fontSize * lineHeight
    const baselineOffset = sceneTextBaselineOffset(obj)
    const textHeight = Math.max(layout.height, obj.height)
    const textFillId = `${defsIdBase}-text-fill`
    const textStrokeId = `${defsIdBase}-text-stroke`
    const textStrokeMaskId = `${defsIdBase}-text-stroke-mask`
    const textStrokeMaskPad = Math.ceil(Math.max(2, obj.strokeWidth * 2))
    const textAnchor =
      obj.textAlign === 'center' ? 'middle' : obj.textAlign === 'right' ? 'end' : 'start'
    const anchorX =
      obj.textAlign === 'center' ? obj.width / 2 : obj.textAlign === 'right' ? obj.width : 0
    return (
      <div
        style={
          isEditing
            ? {
                ...style,
                height: Math.max(obj.height, draftLayout.height),
              }
            : style
        }
        data-avnac-scene-object
        data-avnac-scene-object-id={obj.id}
        onPointerDown={isEditing ? undefined : e => onObjectPointerDown(e, obj)}
        onDoubleClick={() => onTextDoubleClick(obj)}
        {...hoverProps}
        title={obj.locked ? 'Locked text' : undefined}
      >
        <BackgroundBlurLayer obj={obj} />
        {isEditing ? (
          <textarea
            value={textDraft}
            onChange={e => onTextDraftChange(e.target.value)}
            onBlur={onTextDraftCommit}
            onPointerDown={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
            autoFocus
            spellCheck={false}
            className="h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none select-text"
            style={{
              fontFamily: `"${obj.fontFamily}", sans-serif`,
              fontSize: obj.fontSize,
              fontStyle: obj.fontStyle,
              fontWeight: String(obj.fontWeight),
              textAlign: obj.textAlign,
              letterSpacing,
              color: obj.fill.type === 'solid' ? obj.fill.color : '#171717',
              lineHeight: String(lineHeight),
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <svg
            className="pointer-events-none block"
            width={obj.width}
            height={textHeight}
            viewBox={`0 0 ${obj.width} ${textHeight}`}
            overflow="visible"
          >
            <defs>
              {svgGradientDef(textFillId, obj.fill, obj.width, textHeight)}
              {svgGradientDef(textStrokeId, obj.stroke, obj.width, textHeight)}
              {obj.strokeWidth > 0 ? (
                <mask
                  id={textStrokeMaskId}
                  maskUnits="userSpaceOnUse"
                  x={-textStrokeMaskPad}
                  y={-textStrokeMaskPad}
                  width={obj.width + textStrokeMaskPad * 2}
                  height={textHeight + textStrokeMaskPad * 2}
                >
                  <rect
                    x={-textStrokeMaskPad}
                    y={-textStrokeMaskPad}
                    width={obj.width + textStrokeMaskPad * 2}
                    height={textHeight + textStrokeMaskPad * 2}
                    fill="white"
                  />
                  {layout.lines.map((line, index) => {
                    const y = baselineOffset + index * lineHeightPx
                    return (
                      <text
                        key={`${obj.id}-stroke-mask-${index}`}
                        x={anchorX}
                        y={y}
                        xmlSpace="preserve"
                        fill="black"
                        fontFamily={obj.fontFamily}
                        fontSize={obj.fontSize}
                        fontStyle={obj.fontStyle}
                        fontWeight={String(obj.fontWeight)}
                        letterSpacing={letterSpacing}
                        textAnchor={textAnchor}
                      >
                        {line}
                      </text>
                    )
                  })}
                </mask>
              ) : null}
            </defs>
            {layout.lines.map((line, index) => {
              const y = baselineOffset + index * lineHeightPx
              const lineWidth = measureSceneTextWidth(obj, line)
              const lineStartX =
                obj.textAlign === 'center'
                  ? anchorX - lineWidth / 2
                  : obj.textAlign === 'right'
                    ? anchorX - lineWidth
                    : anchorX

              return (
                <g key={`${obj.id}-line-${index}`}>
                  {obj.strokeWidth > 0 ? (
                    <text
                      x={anchorX}
                      y={y}
                      xmlSpace="preserve"
                      fill="none"
                      stroke={svgPaintUrl(textStrokeId, obj.stroke)}
                      strokeWidth={obj.strokeWidth * 2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeMiterlimit={2}
                      mask={`url(#${textStrokeMaskId})`}
                      fontFamily={obj.fontFamily}
                      fontSize={obj.fontSize}
                      fontStyle={obj.fontStyle}
                      fontWeight={String(obj.fontWeight)}
                      letterSpacing={letterSpacing}
                      textAnchor={textAnchor}
                    >
                      {line}
                    </text>
                  ) : null}
                  <text
                    x={anchorX}
                    y={y}
                    xmlSpace="preserve"
                    fill={svgPaintUrl(textFillId, obj.fill)}
                    fontFamily={obj.fontFamily}
                    fontSize={obj.fontSize}
                    fontStyle={obj.fontStyle}
                    fontWeight={String(obj.fontWeight)}
                    letterSpacing={letterSpacing}
                    textAnchor={textAnchor}
                  >
                    {line}
                  </text>
                  {obj.underline && line.length > 0 ? (
                    <line
                      x1={lineStartX}
                      x2={lineStartX + lineWidth}
                      y1={y + obj.fontSize * 0.12}
                      y2={y + obj.fontSize * 0.12}
                      stroke={svgPaintUrl(textFillId, obj.fill)}
                      strokeWidth={Math.max(1, obj.fontSize * 0.06)}
                      strokeLinecap="round"
                    />
                  ) : null}
                </g>
              )
            })}
          </svg>
        )}
      </div>
    )
  }

  // ── Icon ───────────────────────────────────────────────────────────────
  if (obj.type === 'icon') {
    const iconFillId = `${defsIdBase}-icon-fill`
    const iconPaint = sceneIconPaintValue(obj.fill, iconFillId)
    return (
      <div
        style={style}
        data-avnac-scene-object
        onPointerDown={e => onObjectPointerDown(e, obj)}
        {...hoverProps}
        title={obj.locked ? 'Locked icon' : undefined}
      >
        <BackgroundBlurLayer obj={obj} />
        <svg
          width={obj.width}
          height={obj.height}
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>{svgGradientDef(iconFillId, obj.fill, obj.width, obj.height)}</defs>
          {obj.svg.map(([tag, attrs], index) =>
            createElement(tag, {
              ...iconSvgNodeAttrs(attrs, iconPaint, obj.strokeWidth),
              key: attrs.key ?? `${obj.id}-icon-${index}`,
            }),
          )}
        </svg>
      </div>
    )
  }

  // ── Shapes ─────────────────────────────────────────────────────────────
  const fillId = `${defsIdBase}-fill`
  const strokeId = `${defsIdBase}-stroke`
  const motionFilterId = `${defsIdBase}-motion`
  const strokeWidth = 'strokeWidth' in obj ? obj.strokeWidth : 0
  const shapeSvgStyle: CSSProperties = { display: 'block', overflow: 'visible' }
  const blur = blurPxFromPct(obj.blurPct)
  const motionActive = blur > 0 && (obj.blurType ?? 'layer') === 'motion'

  // Apply motion blur via an SVG filter on the wrapper <g>; rotate the filter
  // box so the 1-D blur points along motionBlurAngle.
  const motionAngle = obj.motionBlurAngle ?? 0
  const motionGroupTransform = motionActive
    ? `rotate(${motionAngle} ${obj.width / 2} ${obj.height / 2})`
    : undefined
  const motionGroupCounter = motionActive
    ? `rotate(${-motionAngle} ${obj.width / 2} ${obj.height / 2})`
    : undefined

  if (obj.type === 'rect') {
    const inset = strokeWidth > 0 ? strokeWidth / 2 : 0
    const radii = resolveCornerRadii(obj)
    // Adjust radii to account for stroke inset.
    const adjustedRadii: [number, number, number, number] = radii.map(r =>
      Math.max(0, r - inset),
    ) as [number, number, number, number]
    const pathD = roundedRectPath(
      inset,
      inset,
      Math.max(1, obj.width - inset * 2),
      Math.max(1, obj.height - inset * 2),
      adjustedRadii,
    )
    return (
      <div
        style={style}
        data-avnac-scene-object
        onPointerDown={e => onObjectPointerDown(e, obj)}
        {...hoverProps}
        title={obj.locked ? 'Locked shape' : undefined}
      >
        <BackgroundBlurLayer obj={obj} borderRadius={cornerRadiusCss(obj)} />
        <svg width={obj.width} height={obj.height} style={shapeSvgStyle}>
          <defs>
            {svgGradientDef(fillId, obj.fill, obj.width, obj.height)}
            {svgGradientDef(strokeId, obj.stroke, obj.width, obj.height)}
            {motionActive ? motionBlurFilterDef(motionFilterId, blur, motionAngle) : null}
          </defs>
          <g
            transform={motionGroupTransform}
            filter={motionActive ? `url(#${motionFilterId})` : undefined}
          >
            <g transform={motionGroupCounter}>
              <path
                d={pathD}
                fill={svgPaintUrl(fillId, obj.fill)}
                stroke={strokeWidth > 0 ? svgPaintUrl(strokeId, obj.stroke) : 'transparent'}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
              />
            </g>
          </g>
        </svg>
      </div>
    )
  }

  if (obj.type === 'ellipse') {
    const rx = Math.max(1, obj.width / 2 - strokeWidth / 2)
    const ry = Math.max(1, obj.height / 2 - strokeWidth / 2)
    return (
      <div
        style={style}
        data-avnac-scene-object
        onPointerDown={e => onObjectPointerDown(e, obj)}
        {...hoverProps}
      >
        <BackgroundBlurLayer obj={obj} borderRadius="50%" />
        <svg width={obj.width} height={obj.height} style={shapeSvgStyle}>
          <defs>
            {svgGradientDef(fillId, obj.fill, obj.width, obj.height)}
            {svgGradientDef(strokeId, obj.stroke, obj.width, obj.height)}
            {motionActive ? motionBlurFilterDef(motionFilterId, blur, motionAngle) : null}
          </defs>
          <g
            transform={motionGroupTransform}
            filter={motionActive ? `url(#${motionFilterId})` : undefined}
          >
            <g transform={motionGroupCounter}>
              <ellipse
                cx={obj.width / 2}
                cy={obj.height / 2}
                rx={rx}
                ry={ry}
                fill={svgPaintUrl(fillId, obj.fill)}
                stroke={strokeWidth > 0 ? svgPaintUrl(strokeId, obj.stroke) : 'transparent'}
                strokeWidth={strokeWidth}
              />
            </g>
          </g>
        </svg>
      </div>
    )
  }

  if (obj.type === 'polygon' || obj.type === 'star') {
    const pts =
      obj.type === 'polygon'
        ? Array.from({ length: Math.max(3, obj.sides) }, (_, i) => {
            const a = -Math.PI / 2 + (i / Math.max(3, obj.sides)) * Math.PI * 2
            return [
              obj.width / 2 + (Math.cos(a) * obj.width) / 2,
              obj.height / 2 + (Math.sin(a) * obj.height) / 2,
            ]
          })
        : Array.from({ length: Math.max(4, obj.points) * 2 }, (_, i) => {
            const a = -Math.PI / 2 + (i / (Math.max(4, obj.points) * 2)) * Math.PI * 2
            const r = i % 2 === 0 ? 1 : 0.45
            return [
              obj.width / 2 + ((Math.cos(a) * obj.width) / 2) * r,
              obj.height / 2 + ((Math.sin(a) * obj.height) / 2) * r,
            ]
          })
    return (
      <div
        style={style}
        data-avnac-scene-object
        onPointerDown={e => onObjectPointerDown(e, obj)}
        {...hoverProps}
      >
        <BackgroundBlurLayer obj={obj} />
        <svg width={obj.width} height={obj.height} style={shapeSvgStyle}>
          <defs>
            {svgGradientDef(fillId, obj.fill, obj.width, obj.height)}
            {svgGradientDef(strokeId, obj.stroke, obj.width, obj.height)}
            {motionActive ? motionBlurFilterDef(motionFilterId, blur, motionAngle) : null}
          </defs>
          <g
            transform={motionGroupTransform}
            filter={motionActive ? `url(#${motionFilterId})` : undefined}
          >
            <g transform={motionGroupCounter}>
              <polygon
                points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
                fill={svgPaintUrl(fillId, obj.fill)}
                stroke={strokeWidth > 0 ? svgPaintUrl(strokeId, obj.stroke) : 'transparent'}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
              />
            </g>
          </g>
        </svg>
      </div>
    )
  }

  if (obj.type === 'line') {
    return (
      <div
        style={style}
        data-avnac-scene-object
        onPointerDown={e => onObjectPointerDown(e, obj)}
        {...hoverProps}
      >
        <svg width={obj.width} height={obj.height} style={shapeSvgStyle}>
          <defs>
            {svgGradientDef(strokeId, obj.stroke, obj.width, obj.height)}
            {motionActive ? motionBlurFilterDef(motionFilterId, blur, motionAngle) : null}
          </defs>
          <g
            transform={motionGroupTransform}
            filter={motionActive ? `url(#${motionFilterId})` : undefined}
          >
            <g transform={motionGroupCounter}>
              <line
                x1={obj.strokeWidth / 2}
                y1={obj.height / 2}
                x2={obj.width - obj.strokeWidth / 2}
                y2={obj.height / 2}
                stroke={svgPaintUrl(strokeId, obj.stroke)}
                strokeWidth={obj.strokeWidth}
                strokeLinecap={obj.roundedEnds ? 'round' : 'square'}
                strokeDasharray={
                  obj.lineStyle === 'dashed'
                    ? `${obj.strokeWidth * 3} ${obj.strokeWidth * 2}`
                    : obj.lineStyle === 'dotted'
                      ? `${obj.strokeWidth * 0.5} ${obj.strokeWidth * 1.8}`
                      : undefined
                }
              />
            </g>
          </g>
        </svg>
      </div>
    )
  }

  // ── Arrow ──────────────────────────────────────────────────────────────
  const arrow = obj as SceneArrow
  const centerY = arrow.height / 2
  const tipX = arrow.width - arrow.strokeWidth * 0.6
  const tailX = arrow.strokeWidth / 2
  const shaftTipX = Math.max(tailX + 1, tipX - arrow.strokeWidth * 3.2 * arrow.headSize)
  const controlX = tailX + (shaftTipX - tailX) * arrow.curveT
  const controlY = centerY - arrow.curveBulge
  const headLen = Math.max(arrow.strokeWidth * 2, arrow.strokeWidth * 4 * arrow.headSize)
  const headSpread = Math.max(arrow.strokeWidth * 1.8, arrow.strokeWidth * 3 * arrow.headSize)
  const d =
    arrow.pathType === 'curved'
      ? `M ${tailX} ${centerY} Q ${controlX} ${controlY} ${shaftTipX} ${centerY}`
      : `M ${tailX} ${centerY} L ${shaftTipX} ${centerY}`

  return (
    <div
      style={style}
      data-avnac-scene-object
      onPointerDown={e => onObjectPointerDown(e, obj)}
      {...hoverProps}
    >
      <svg width={arrow.width} height={arrow.height} style={shapeSvgStyle}>
        <defs>
          {svgGradientDef(strokeId, arrow.stroke, arrow.width, arrow.height)}
          {motionActive ? motionBlurFilterDef(motionFilterId, blur, motionAngle) : null}
        </defs>
        <g
          transform={motionGroupTransform}
          filter={motionActive ? `url(#${motionFilterId})` : undefined}
        >
          <g transform={motionGroupCounter}>
            <path
              d={d}
              fill="none"
              stroke={svgPaintUrl(strokeId, arrow.stroke)}
              strokeWidth={arrow.strokeWidth}
              strokeLinecap={arrow.roundedEnds ? 'round' : 'square'}
              strokeLinejoin="round"
              strokeDasharray={
                arrow.lineStyle === 'dashed'
                  ? `${arrow.strokeWidth * 3} ${arrow.strokeWidth * 2}`
                  : arrow.lineStyle === 'dotted'
                    ? `${arrow.strokeWidth * 0.5} ${arrow.strokeWidth * 1.8}`
                    : undefined
              }
            />
            <polygon
              points={`${tipX},${centerY} ${tipX - headLen},${centerY - headSpread / 2} ${tipX - headLen * 0.82},${centerY} ${tipX - headLen},${centerY + headSpread / 2}`}
              fill={svgPaintUrl(strokeId, arrow.stroke)}
            />
          </g>
        </g>
      </svg>
    </div>
  )
}