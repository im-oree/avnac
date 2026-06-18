import {
  type CSSProperties,
  createElement,
  type PointerEvent as ReactPointerEvent,
  useLayoutEffect,
  useRef,
} from 'react'

import { iconSvgNodeAttrs, sceneIconPaintValue } from '../../lib/avnac-icon'
import type { SceneArrow, SceneObject, SceneText } from '../../lib/avnac-scene'
import { findSceneObject, rotatePoint, getObjectCenter } from '../../lib/avnac-scene'
import { useEditorStore } from './editor-store'
import {
  blurPxFromPct,
  layoutSceneText,
  measureSceneTextWidth,
  renderVectorBoardDocumentToCanvas,
  sceneTextBaselineOffset,
  sceneTextLetterSpacing,
  sceneTextLineHeight,
  buildCssFilterForImage,
} from '../../lib/avnac-scene-render'
import type { VectorBoardDocument } from '../../lib/avnac-vector-board-document'
import type { BgValue } from '../background-popover'

function objectFilterCss(obj: SceneObject) {
  const filters: string[] = []
  const blur = blurPxFromPct(obj.blurPct)
  if (blur > 0) filters.push(`blur(${blur}px)`)
  if (obj.shadow) {
    const alpha = Math.max(0, Math.min(100, obj.shadow.opacityPct)) / 100
    const hex = obj.shadow.colorHex.replace('#', '')
    const r = Number.parseInt(hex.slice(0, 2), 16) || 0
    const g = Number.parseInt(hex.slice(2, 4), 16) || 0
    const b = Number.parseInt(hex.slice(4, 6), 16) || 0
    filters.push(
      `drop-shadow(${obj.shadow.offsetX}px ${obj.shadow.offsetY}px ${obj.shadow.blur}px rgba(${r},${g},${b},${alpha}))`,
    )
  }
  return filters.length > 0 ? filters.join(' ') : undefined
}

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

function svgGradientDef(id: string, value: BgValue) {
  if (value.type !== 'gradient') return null
  const ends = gradientEndpoints(value.angle)
  return (
    <linearGradient id={id} x1={ends.x1} y1={ends.y1} x2={ends.x2} y2={ends.y2}>
      {value.stops.map(stop => (
        <stop
          key={`${id}-${stop.offset}-${stop.color}`}
          offset={`${stop.offset * 100}%`}
          stopColor={stop.color}
        />
      ))}
    </linearGradient>
  )
}

function svgPaintUrl(id: string, value: BgValue) {
  return value.type === 'solid' ? value.color : `url(#${id})`
}

function objectTransformStyle(obj: SceneObject): CSSProperties {
  return {
    position: 'absolute',
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    transform: `rotate(${obj.rotation}deg)`,
    transformOrigin: 'center center',
    willChange: 'transform, opacity',
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
    opacity: obj.opacity,
    filter: objectFilterCss(obj),
    overflow: 'visible',
  }
}

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
  onObjectDoubleClick,
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
  onObjectDoubleClick?: (obj: SceneObject) => void
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
  const doc = useEditorStore(state => state.doc)

  if (obj.type === 'group') {
    return (
      <div
        style={style}
        data-avnac-scene-object
        data-avnac-scene-object-id={obj.id}
        onPointerDown={e => onObjectPointerDown(e, obj)}
        onDoubleClick={() => onObjectDoubleClick?.(obj)}
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

  if (obj.type === 'image') {
    const scaleX = obj.width / Math.max(1, obj.crop.width)
    const scaleY = obj.height / Math.max(1, obj.crop.height)
    const cropRotation = obj.crop.rotation || 0
    const cropCenterX = obj.crop.x + obj.crop.width / 2
    const cropCenterY = obj.crop.y + obj.crop.height / 2
    // For images: don't apply the scene-level filter on the container (that blurs the whole box).
    // Instead apply image effects directly to the <img> element so only the image pixels are affected.
    const containerStyle = { ...style } as CSSProperties
    if ('filter' in containerStyle) delete (containerStyle as any).filter

    const effects = (obj as any).imageEffects ?? {}
    const cssFilter = buildCssFilterForImage(effects, obj) // includes layer blur + color adjustments

    // Build shadow filter (drop-shadow) separately so it uses image alpha
    let shadowFilter: string | undefined
    if (obj.shadow) {
      const alpha = Math.max(0, Math.min(100, obj.shadow.opacityPct)) / 100
      const hex = obj.shadow.colorHex.replace('#', '')
      const r = Number.parseInt(hex.slice(0, 2), 16) || 0
      const g = Number.parseInt(hex.slice(2, 4), 16) || 0
      const b = Number.parseInt(hex.slice(4, 6), 16) || 0
      shadowFilter = `drop-shadow(${obj.shadow.offsetX}px ${obj.shadow.offsetY}px ${obj.shadow.blur}px rgba(${r},${g},${b},${alpha}))`
    }

    // Optionally include an SVG filter for sharpen and noise (pixel operations)
    const needsSvgFilter = !!((effects?.sharpen?.enabled && (effects.sharpen.amount ?? 0) > 0) || (effects?.noise?.amount && (effects.noise.amount ?? 0) > 0))
    const svgFilterId = `${defsIdBase}-img-effects`

    // Distort transforms (scale% and skew degrees)
    const distort = effects?.distort ?? {}
    const distortScaleX = ((distort.scaleX ?? 100) as number) / 100
    const distortScaleY = ((distort.scaleY ?? 100) as number) / 100
    const skewDeg = (distort.skew ?? 0) as number

    const imgFilterParts: string[] = []
    if (needsSvgFilter) imgFilterParts.push(`url(#${svgFilterId})`)
    if (cssFilter && cssFilter !== 'none') imgFilterParts.push(cssFilter)
    if (shadowFilter) imgFilterParts.push(shadowFilter)
    const imgFilter = imgFilterParts.length > 0 ? imgFilterParts.join(' ') : undefined

    const imgTransform = `rotate(${cropRotation}deg) scale(${distortScaleX}, ${distortScaleY}) skewX(${skewDeg}deg)`

    return (
      <div
        style={containerStyle}
        data-avnac-scene-object
        data-avnac-scene-object-id={obj.id}
        onPointerDown={e => onObjectPointerDown(e, obj)}
        onDoubleClick={() => onObjectDoubleClick?.(obj)}
        {...hoverProps}
        title={obj.locked ? 'Locked image' : undefined}
      >
        <div
          className="relative h-full w-full overflow-hidden"
          style={{ borderRadius: obj.cornerRadius }}
        >
          {needsSvgFilter ? (
            <svg aria-hidden style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                <filter id={svgFilterId} x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">
                  {/* Sharpen via feConvolveMatrix (simple 3x3 kernel) */}
                  {effects?.sharpen?.enabled && (effects.sharpen.amount ?? 0) > 0 ? (
                    (() => {
                      const s = Math.max(0, Math.min(2, (effects.sharpen.amount ?? 0) / 100))
                      const center = 1 + 4 * s
                      const k = [0, -s, 0, -s, center, -s, 0, -s, 0]
                      return (
                        <feConvolveMatrix
                          order="3"
                          kernelMatrix={k.join(' ')}
                          divisor="1"
                          preserveAlpha="true"
                        />
                      )
                    })()
                  ) : null}

                  {/* Noise via feTurbulence blended with source */}
                  {effects?.noise?.amount && (effects.noise.amount ?? 0) > 0 ? (
                    (() => {
                      const amt = Math.max(0, Math.min(100, effects.noise.amount ?? 0))
                      const strength = amt / 100
                      const baseFreq = Math.max(0.01, 0.6 * strength)
                      return (
                        <>
                          <feTurbulence type="fractalNoise" baseFrequency={String(baseFreq)} numOctaves="1" result="noise" />
                          <feColorMatrix type="saturate" values="0" in="noise" result="noiseGray" />
                          <feBlend in="SourceGraphic" in2="noiseGray" mode="overlay" />
                        </>
                      )
                    })()
                  ) : null}
                </filter>
              </defs>
            </svg>
          ) : null}

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
              transform: imgTransform,
              transformOrigin: `${cropCenterX * scaleX}px ${cropCenterY * scaleY}px`,
              filter: imgFilter,
            }}
          />
        </div>
      </div>
    )
  }

  if (obj.type === 'vector-board') {
    return (
      <div
        style={style}
        data-avnac-scene-object
        data-avnac-scene-object-id={obj.id}
        onPointerDown={e => onObjectPointerDown(e, obj)}
        onDoubleClick={() => onObjectDoubleClick?.(obj)}
        {...hoverProps}
        title={obj.locked ? 'Locked vector board' : undefined}
      >
        <VectorBoardObjectPreview
          doc={vectorBoardDocs[obj.boardId]}
          width={obj.width}
          height={obj.height}
        />
      </div>
    )
  }

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
              {svgGradientDef(textFillId, obj.fill)}
              {svgGradientDef(textStrokeId, obj.stroke)}
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

  if (obj.type === 'icon') {
    const iconFillId = `${defsIdBase}-icon-fill`
    const iconPaint = sceneIconPaintValue(obj.fill, iconFillId)
    return (
      <div
        style={style}
        data-avnac-scene-object
        onPointerDown={e => onObjectPointerDown(e, obj)}
        onDoubleClick={() => onObjectDoubleClick?.(obj)}
        {...hoverProps}
        title={obj.locked ? 'Locked icon' : undefined}
      >
        <svg
          width={obj.width}
          height={obj.height}
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>{svgGradientDef(iconFillId, obj.fill)}</defs>
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

  const fillId = `${defsIdBase}-fill`
  const strokeId = `${defsIdBase}-stroke`
  const strokeWidth = 'strokeWidth' in obj ? obj.strokeWidth : 0
  const shapeSvgStyle: CSSProperties = { display: 'block', overflow: 'visible' }

  // If an explicit SVG path is present on the object, render it directly
  const explicitPath = (obj as any).pathData
  const isShapePath =
    typeof explicitPath === 'string' &&
    explicitPath.trim() &&
    (obj.type === 'rect' ||
      obj.type === 'ellipse' ||
      obj.type === 'polygon' ||
      obj.type === 'star' ||
      obj.type === 'line' ||
      obj.type === 'arrow')

  if (isShapePath) {
    return (
      <div
        style={style}
        data-avnac-scene-object
        data-avnac-scene-object-id={obj.id}
        onPointerDown={e => onObjectPointerDown(e, obj)}
        onDoubleClick={() => onObjectDoubleClick?.(obj)}
        {...hoverProps}
      >
        <svg width={obj.width} height={obj.height} style={shapeSvgStyle} viewBox={`0 0 ${obj.width} ${obj.height}`}>
          <defs>
            {svgGradientDef(fillId, (obj as any).fill ?? { type: 'solid', color: '#000' })}
            {svgGradientDef(strokeId, (obj as any).stroke ?? { type: 'solid', color: 'transparent' })}
          </defs>
          <path
            d={explicitPath}
            fill={((obj as any).fill ?? { type: 'solid', color: 'transparent' }).type === 'solid' ? ((obj as any).fill ?? { type: 'solid', color: 'transparent' }).color : `url(#${fillId})`}
            stroke={strokeWidth > 0 ? (('stroke' in obj ? svgPaintUrl(strokeId, (obj as any).stroke) : 'transparent')) : 'transparent'}
            strokeWidth={strokeWidth}
          />
        </svg>
      </div>
    )
  }

  if (obj.type === 'rect') {
    const inset = strokeWidth > 0 ? strokeWidth / 2 : 0
    return (
      <div
        style={style}
        data-avnac-scene-object
        onPointerDown={e => onObjectPointerDown(e, obj)}
        onDoubleClick={() => onObjectDoubleClick?.(obj)}
        {...hoverProps}
        title={obj.locked ? 'Locked shape' : undefined}
      >
        <svg width={obj.width} height={obj.height} style={shapeSvgStyle}>
          <defs>
            {svgGradientDef(fillId, obj.fill)}
            {svgGradientDef(strokeId, obj.stroke)}
          </defs>
          <rect
            x={inset}
            y={inset}
            width={Math.max(1, obj.width - inset * 2)}
            height={Math.max(1, obj.height - inset * 2)}
            rx={Math.min(obj.cornerRadius, Math.min(obj.width, obj.height) / 2)}
            fill={svgPaintUrl(fillId, obj.fill)}
            stroke={strokeWidth > 0 ? svgPaintUrl(strokeId, obj.stroke) : 'transparent'}
            strokeWidth={strokeWidth}
          />
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
        onDoubleClick={() => onObjectDoubleClick?.(obj)}
        {...hoverProps}
      >
        <svg width={obj.width} height={obj.height} style={shapeSvgStyle}>
          <defs>
            {svgGradientDef(fillId, obj.fill)}
            {svgGradientDef(strokeId, obj.stroke)}
          </defs>
          <ellipse
            cx={obj.width / 2}
            cy={obj.height / 2}
            rx={rx}
            ry={ry}
            fill={svgPaintUrl(fillId, obj.fill)}
            stroke={strokeWidth > 0 ? svgPaintUrl(strokeId, obj.stroke) : 'transparent'}
            strokeWidth={strokeWidth}
          />
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
         onDoubleClick={() => onObjectDoubleClick?.(obj)}
        {...hoverProps}
      >
        <svg width={obj.width} height={obj.height} style={shapeSvgStyle}>
          <defs>
            {svgGradientDef(fillId, obj.fill)}
            {svgGradientDef(strokeId, obj.stroke)}
          </defs>
          <polygon
            points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
            fill={svgPaintUrl(fillId, obj.fill)}
            stroke={strokeWidth > 0 ? svgPaintUrl(strokeId, obj.stroke) : 'transparent'}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

    if (obj.type === 'path' || obj.type === 'custom') {
      const pathObj: any = obj
      const fillIdLocal = `${defsIdBase}-fill`
      const strokeIdLocal = `${defsIdBase}-stroke`
      const strokeWidth = 'strokeWidth' in obj ? (obj as any).strokeWidth : 0
      const isOpen = pathObj.open === true

      return (
        <div
          style={style}
          data-avnac-scene-object
          onPointerDown={e => onObjectPointerDown(e, obj)}
          {...hoverProps}
          title={obj.locked ? 'Locked shape' : undefined}
        >
          <svg width={obj.width} height={obj.height} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
              {pathObj.fill ? svgGradientDef(fillIdLocal, pathObj.fill) : null}
              {svgGradientDef(strokeIdLocal, pathObj.stroke)}
            </defs>
            <path
              d={pathObj.pathData}
              fill={isOpen ? 'none' : pathObj.fill ? svgPaintUrl(fillIdLocal, pathObj.fill) : 'transparent'}
              stroke={strokeWidth > 0 ? svgPaintUrl(strokeIdLocal, pathObj.stroke) : 'transparent'}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={pathObj.strokeDasharray ?? undefined}
            />
          </svg>
        </div>
      )
    }

    if (obj.type === 'connector') {
      const c: any = obj
      // Resolve absolute start/end coordinates (attach to shape ports when available)
      function portCoordFor(shape: any, port: string) {
        if (!shape) return { x: 0, y: 0 }
        const cx = shape.x + shape.width / 2
        const cy = shape.y + shape.height / 2
        let px = shape.x
        let py = shape.y
        switch (port) {
          case 'top-center':
            px = shape.x + shape.width / 2
            py = shape.y
            break
          case 'bottom-center':
            px = shape.x + shape.width / 2
            py = shape.y + shape.height
            break
          case 'left-center':
            px = shape.x
            py = shape.y + shape.height / 2
            break
          case 'right-center':
            px = shape.x + shape.width
            py = shape.y + shape.height / 2
            break
          case 'top-left':
            px = shape.x
            py = shape.y
            break
          case 'top-right':
            px = shape.x + shape.width
            py = shape.y
            break
          case 'bottom-left':
            px = shape.x
            py = shape.y + shape.height
            break
          case 'bottom-right':
            px = shape.x + shape.width
            py = shape.y + shape.height
            break
          default:
            px = shape.x + shape.width / 2
            py = shape.y + shape.height / 2
        }
        // account for rotation
        return rotatePoint(px, py, shape.rotation || 0, cx, cy)
      }

      const startAbs = c.startShapeId ? portCoordFor(findSceneObject(doc.objects, c.startShapeId), c.startPort) : { x: c.startX, y: c.startY }
      const endAbs = c.endShapeId ? portCoordFor(findSceneObject(doc.objects, c.endShapeId), c.endPort) : { x: c.endX, y: c.endY }

      // Local coordinates relative to this object's box
      const sx = startAbs.x - obj.x
      const sy = startAbs.y - obj.y
      const ex = endAbs.x - obj.x
      const ey = endAbs.y - obj.y

      // Build path
      let d = ''
      if (c.connectorStyle === 'elbow') {
        d = `M ${sx} ${sy} L ${ex} ${sy} L ${ex} ${ey}`
      } else if (c.connectorStyle === 'curved') {
        const cp1x = sx + (ex - sx) * 0.4
        const cp1y = sy
        const cp2x = ex - (ex - sx) * 0.4
        const cp2y = ey
        d = `M ${sx} ${sy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${ex} ${ey}`
      } else {
        // straight or freeform default
        if (Array.isArray(c.waypoints) && c.waypoints.length > 0) {
          const pts = [`M ${sx} ${sy}`]
          for (const wp of c.waypoints) pts.push(`L ${wp.x - obj.x} ${wp.y - obj.y}`)
          pts.push(`L ${ex} ${ey}`)
          d = pts.join(' ')
        } else {
          d = `M ${sx} ${sy} L ${ex} ${ey}`
        }
      }

      const strokeIdLocal = `${defsIdBase}-stroke`
      const markerStartId = `${defsIdBase}-marker-start`
      const markerEndId = `${defsIdBase}-marker-end`

      return (
        <div
          style={style}
          data-avnac-scene-object
          onPointerDown={e => onObjectPointerDown(e, obj)}
          {...hoverProps}
          title={obj.locked ? 'Locked connector' : undefined}
        >
          <svg width={obj.width} height={obj.height} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
              {svgGradientDef(strokeIdLocal, c.stroke)}
              <marker id={markerStartId} markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="strokeWidth">
                <path d="M10 0 L0 5 L10 10" fill="none" stroke="currentColor" />
              </marker>
              <marker id={markerEndId} markerWidth="10" markerHeight="10" refX="0" refY="5" orient="auto" markerUnits="strokeWidth">
                <path d="M0 0 L10 5 L0 10" fill="currentColor" />
              </marker>
            </defs>
            <path
              d={d}
              fill="none"
              stroke={svgPaintUrl(strokeIdLocal, c.stroke)}
              strokeWidth={c.strokeWidth}
              strokeDasharray={c.strokeDasharray ?? undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerStart={c.startArrow && c.startArrow !== 'none' ? `url(#${markerStartId})` : undefined}
              markerEnd={c.endArrow && c.endArrow !== 'none' ? `url(#${markerEndId})` : undefined}
            />
            {c.label ? (
              <text x={(sx + ex) / 2} y={(sy + ey) / 2 - 6} fontSize={12} textAnchor="middle" fill={svgPaintUrl(strokeIdLocal, c.stroke)}>
                {c.label}
              </text>
            ) : null}
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
        onDoubleClick={() => onObjectDoubleClick?.(obj)}
        {...hoverProps}
      >
        <svg width={obj.width} height={obj.height} style={shapeSvgStyle}>
          <defs>{svgGradientDef(strokeId, obj.stroke)}</defs>
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
        </svg>
      </div>
    )
  }

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
      onDoubleClick={() => onObjectDoubleClick?.(obj)}
      {...hoverProps}
    >
      <svg width={arrow.width} height={arrow.height} style={shapeSvgStyle}>
        <defs>{svgGradientDef(strokeId, arrow.stroke)}</defs>
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
      </svg>
    </div>
  )
}
