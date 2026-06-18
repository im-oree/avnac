import type { MarqueeRect, ResizeHandleId } from './types'

const ROTATION_SNAP_DEG = 15
const MIN_SIZE = 1

export function clampDimension(v: number | undefined, fallback: number) {
  if (!Number.isFinite(v)) return fallback
  return Math.min(16000, Math.max(MIN_SIZE, Math.round(v!)))
}

export function angleFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
}

export function snapAngle(angle: number, step = ROTATION_SNAP_DEG) {
  return Math.round(angle / step) * step
}

export function sceneDeltaToLocal(
  dx: number,
  dy: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  }
}

export function localDeltaToScene(
  dx: number,
  dy: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  }
}

export const pointerSceneDelta = sceneDeltaToLocal
export const rotateDeltaToScene = localDeltaToScene

export function getHandleLocalPosition(
  handle: ResizeHandleId,
  width: number,
  height: number,
): { x: number; y: number } {
  const hw = width / 2
  const hh = height / 2
  switch (handle) {
    case 'nw': return { x: -hw, y: -hh }
    case 'n':  return { x: 0,   y: -hh }
    case 'ne': return { x: hw,  y: -hh }
    case 'e':  return { x: hw,  y: 0   }
    case 'se': return { x: hw,  y: hh  }
    case 's':  return { x: 0,   y: hh  }
    case 'sw': return { x: -hw, y: hh  }
    case 'w':  return { x: -hw, y: 0   }
  }
}

export function oppositeHandle(handle: ResizeHandleId): ResizeHandleId {
  switch (handle) {
    case 'nw': return 'se'
    case 'n':  return 's'
    case 'ne': return 'sw'
    case 'e':  return 'w'
    case 'se': return 'nw'
    case 's':  return 'n'
    case 'sw': return 'ne'
    case 'w':  return 'e'
  }
}

export function isCornerHandle(handle: ResizeHandleId): boolean {
  return handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw'
}

export function isSideHandle(handle: ResizeHandleId): boolean {
  return handle === 'n' || handle === 'e' || handle === 's' || handle === 'w'
}

export function handleAxes(handle: ResizeHandleId): {
  xDir: -1 | 0 | 1
  yDir: -1 | 0 | 1
} {
  switch (handle) {
    case 'nw': return { xDir: -1, yDir: -1 }
    case 'n':  return { xDir:  0, yDir: -1 }
    case 'ne': return { xDir:  1, yDir: -1 }
    case 'e':  return { xDir:  1, yDir:  0 }
    case 'se': return { xDir:  1, yDir:  1 }
    case 's':  return { xDir:  0, yDir:  1 }
    case 'sw': return { xDir: -1, yDir:  1 }
    case 'w':  return { xDir: -1, yDir:  0 }
  }
}

export function cursorForHandle(handle: ResizeHandleId, rotationDeg = 0): string {
  const baseAngles: Record<ResizeHandleId, number> = {
    n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315,
  }
  const cursors = [
    'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize',
    'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize',
  ] as const
  let angle = baseAngles[handle] + rotationDeg
  angle = ((angle % 360) + 360) % 360
  const index = Math.round(angle / 45) % 8
  return cursors[index]
}

export function computeResize(
  handle: ResizeHandleId,
  localPointer: { x: number; y: number },
  origWidth: number,
  origHeight: number,
  keepAspect: boolean,
  minW = MIN_SIZE,
  minH = MIN_SIZE,
): {
  width: number
  height: number
  centerDx: number
  centerDy: number
} {
  const { xDir, yDir } = handleAxes(handle)
  const hw = origWidth / 2
  const hh = origHeight / 2

  // ── Step 1: Raw new dimensions ────────────────────────────────────
  let newW = origWidth
  let newH = origHeight

  if (xDir === 1) {
    // Dragging right edge — anchor is left edge at -hw
    newW = localPointer.x + hw
  } else if (xDir === -1) {
    // Dragging left edge — anchor is right edge at +hw
    newW = hw - localPointer.x
  }
  // xDir === 0 (n or s handle): width is untouched

  if (yDir === 1) {
    // Dragging bottom edge — anchor is top edge at -hh
    newH = localPointer.y + hh
  } else if (yDir === -1) {
    // Dragging top edge — anchor is bottom edge at +hh
    newH = hh - localPointer.y
  }
  // yDir === 0 (e or w handle): height is untouched

  // ── Step 2: Clamp to minimums ─────────────────────────────────────
  newW = Math.max(minW, newW)
  newH = Math.max(minH, newH)

  // ── Step 3: Aspect ratio ──────────────────────────────────────────
  if (keepAspect && origWidth > 0 && origHeight > 0) {
    const aspect = origWidth / origHeight

    if (isCornerHandle(handle)) {
      const scaleX = newW / origWidth
      const scaleY = newH / origHeight
      const scale = Math.max(scaleX, scaleY)
      newW = Math.max(minW, origWidth * scale)
      newH = Math.max(minH, origHeight * scale)
      if (newW / newH > aspect) {
        newH = newW / aspect
      } else {
        newW = newH * aspect
      }
    } else if (xDir !== 0) {
      // e or w — width changed, height follows symmetrically (no centerDy)
      newH = newW / aspect
    } else if (yDir !== 0) {
      // n or s — height changed, width follows symmetrically (no centerDx)
      newW = newH * aspect
    }
  }

  // ── Step 4: Center shift ──────────────────────────────────────────
  // Only shift the center on axes the handle DIRECTLY controls.
  // The other axis always grows/shrinks symmetrically so center stays put.
  //
  //   e.g. dragging 'e' (xDir=1, yDir=0):
  //     centerDx = (newW - origWidth) / 2  ← right edge moved, left stayed
  //     centerDy = 0                        ← height grew symmetrically
  //
  //   e.g. dragging 'n' (xDir=0, yDir=-1):
  //     centerDx = 0                        ← width grew symmetrically
  //     centerDy = -(newH - origHeight) / 2 ← top edge moved, bottom stayed
  const centerDx = xDir !== 0 ? (xDir * (newW - origWidth)) / 2 : 0
  const centerDy = yDir !== 0 ? (yDir * (newH - origHeight)) / 2 : 0

  return {
    width: Math.round(newW),
    height: Math.round(newH),
    centerDx,
    centerDy,
  }
}

export function constrainAspectRatioBounds(
  handle: ResizeHandleId,
  anchor: { x: number; y: number },
  pointer: { x: number; y: number },
  width: number,
  height: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const baseW = Math.max(1, width)
  const baseH = Math.max(1, height)
  const aspect = baseW / baseH
  const { xDir, yDir } = handleAxes(handle)

  let dxAbs = Math.abs(pointer.x - anchor.x)
  let dyAbs = Math.abs(pointer.y - anchor.y)

  dxAbs = Math.max(MIN_SIZE, dxAbs)
  dyAbs = Math.max(MIN_SIZE, dyAbs)

  if (isCornerHandle(handle)) {
    if (dxAbs / dyAbs > aspect) {
      dyAbs = dxAbs / aspect
    } else {
      dxAbs = dyAbs * aspect
    }
  } else if (xDir !== 0) {
    dyAbs = dxAbs / aspect
  } else {
    dxAbs = dyAbs * aspect
  }

  const effXDir = xDir || 1
  const effYDir = yDir || 1

  return {
    minX: effXDir > 0 ? anchor.x : anchor.x - dxAbs,
    maxX: effXDir > 0 ? anchor.x + dxAbs : anchor.x,
    minY: effYDir > 0 ? anchor.y : anchor.y - dyAbs,
    maxY: effYDir > 0 ? anchor.y + dyAbs : anchor.y,
  }
}

export function rectFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): MarqueeRect {
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  return {
    left,
    top,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

export function boundsIntersect(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
): boolean {
  return (
    a.left <= b.left + b.width &&
    a.left + a.width >= b.left &&
    a.top <= b.top + b.height &&
    a.top + a.height >= b.top
  )
}

export function mergeUniqueIds(base: string[], extra: string[]): string[] {
  const seen = new Set(base)
  const next = [...base]
  for (const id of extra) {
    if (seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next
}