import { svgPathToPenAnchors, penAnchorsToSvgPath } from './avnac-path-anchors'
import type { ScenePath } from './avnac-scene'
import type { VectorPenAnchor } from './avnac-vector-pen-bezier'
import { ctrlInAbs, ctrlOutAbs } from './avnac-vector-pen-bezier'

// ---------------------------------------------------------------------------
// In-progress pen-draw state
// ---------------------------------------------------------------------------

export type PenDrawState = {
  /** Anchors in scene-space (so the user sees them where they click). */
  anchors: VectorPenAnchor[]
  /** True if the user is currently dragging out a bezier handle on the last anchor. */
  draggingHandle: boolean
}

export const EMPTY_PEN_DRAW: PenDrawState = { anchors: [], draggingHandle: false }

// ---------------------------------------------------------------------------
// Bounds + local-coordinate normalization
// ---------------------------------------------------------------------------

/**
 * Compute the bounding box of all anchors *and* their control handles.
 * Handles must be included so the path's bounding rect contains the full curve,
 * not just the on-curve points.
 */
export function computeAnchorBounds(anchors: VectorPenAnchor[]) {
  if (anchors.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const a of anchors) {
    const candidates: [number, number][] = [[a.x, a.y]]
    if (a.inX  !== undefined && a.inY  !== undefined) candidates.push([a.inX,  a.inY])
    if (a.outX !== undefined && a.outY !== undefined) candidates.push([a.outX, a.outY])
    for (const [x, y] of candidates) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Translate all anchors by (-dx, -dy) so the bounding box top-left lands at
 * (0, 0). Handles are translated alongside their anchor.
 */
export function translateAnchors(
  anchors: VectorPenAnchor[],
  dx: number,
  dy: number,
): VectorPenAnchor[] {
  return anchors.map(a => ({
    x: a.x + dx,
    y: a.y + dy,
    inX:  a.inX  !== undefined ? a.inX  + dx : undefined,
    inY:  a.inY  !== undefined ? a.inY  + dy : undefined,
    outX: a.outX !== undefined ? a.outX + dx : undefined,
    outY: a.outY !== undefined ? a.outY + dy : undefined,
  }))
}

// ---------------------------------------------------------------------------
// Pen-draw commit → ScenePath payload
// ---------------------------------------------------------------------------

/**
 * Finalise a pen-draw into a ScenePath payload (without an id; caller assigns).
 *
 * Coordinate spaces:
 *  - Input `anchors` are in **scene** space (artboard coordinates).
 *  - Output `pathData` + `width`/`height` are normalized to **local** space
 *    where (0, 0) = path bounding-box top-left.
 *  - Output `x`/`y` is the bounding box position in the scene.
 */
export function commitPenDraw(
  anchors: VectorPenAnchor[],
  closed: boolean,
): {
  x: number
  y: number
  width: number
  height: number
  pathData: string
} | null {
  if (anchors.length < 2) return null

  const { minX, minY, maxX, maxY } = computeAnchorBounds(anchors)
  const width  = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)
  const local  = translateAnchors(anchors, -minX, -minY)
  const pathData = penAnchorsToSvgPath(local, closed)
  if (!pathData) return null

  return { x: minX, y: minY, width, height, pathData }
}

// ---------------------------------------------------------------------------
// Read anchors back out of a ScenePath
// ---------------------------------------------------------------------------

export function scenePathToAnchors(path: ScenePath): {
  anchors: VectorPenAnchor[]
  closed: boolean
} | null {
  if (!path.pathData) return null
  const parsed = svgPathToPenAnchors(path.pathData)
  if (!parsed) return null
  return {
    anchors: parsed.anchors as VectorPenAnchor[],
    closed: parsed.closed,
  }
}

// ---------------------------------------------------------------------------
// Drawing helper (canvas preview during pen-draw)
// ---------------------------------------------------------------------------

/**
 * Stroke the current pen-draw path on a canvas context, in scene space.
 * Used by `PenDrawOverlay` while the user is drawing.
 */
export function strokeAnchorsOnContext(
  ctx: CanvasRenderingContext2D,
  anchors: VectorPenAnchor[],
  closed: boolean,
): void {
  if (anchors.length < 1) return
  ctx.beginPath()
  ctx.moveTo(anchors[0]!.x, anchors[0]!.y)
  const segCount = closed ? anchors.length : anchors.length - 1
  for (let i = 0; i < segCount; i++) {
    const a = anchors[i]!
    const b = anchors[(i + 1) % anchors.length]!
    const c1 = ctrlOutAbs(a)
    const c2 = ctrlInAbs(b)
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], b.x, b.y)
  }
  if (closed) ctx.closePath()
  ctx.stroke()
}