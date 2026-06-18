import { ctrlInAbs, ctrlOutAbs, type VectorPenAnchor } from './avnac-vector-pen-bezier'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArcLengthTable = {
  /** Flattened polyline points in object-local coordinates. */
  pts: { x: number; y: number }[]
  /** Cumulative arc length at each point. `lengths[i]` = distance from pts[0] to pts[i]. */
  lengths: number[]
  /** Total arc length of the entire path. */
  total: number
  /** True when the path is closed (last point loops back to the first). */
  closed: boolean
}

export type PointOnPath = {
  x: number
  y: number
  /** Tangent angle in radians (atan2 of segment direction). */
  tangent: number
}

// ---------------------------------------------------------------------------
// Bezier flattening
// ---------------------------------------------------------------------------

function cubicAt(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): [number, number] {
  const u  = 1 - t
  const u2 = u * u
  const u3 = u2 * u
  const t2 = t * t
  const t3 = t2 * t
  return [
    u3 * p0[0] + 3 * u2 * t * p1[0] + 3 * u * t2 * p2[0] + t3 * p3[0],
    u3 * p0[1] + 3 * u2 * t * p1[1] + 3 * u * t2 * p2[1] + t3 * p3[1],
  ]
}

/**
 * Flatten a sequence of pen anchors into a polyline together with cumulative
 * arc-length data. Used by text-on-path and any future "place along path"
 * features.
 *
 * @param segmentsPerCurve  How many straight segments to use per cubic bezier.
 *                          Higher = smoother curves but more memory.
 */
export function flattenAnchorsToArcLengthTable(
  anchors: VectorPenAnchor[],
  closed: boolean,
  segmentsPerCurve = 32,
): ArcLengthTable | null {
  if (!anchors || anchors.length < 2) return null

  const pts: { x: number; y: number }[] = []
  const lengths: number[] = []
  let total = 0

  const pushPoint = (x: number, y: number) => {
    if (pts.length === 0) {
      pts.push({ x, y })
      lengths.push(0)
      return
    }
    const prev = pts[pts.length - 1]!
    const dx = x - prev.x
    const dy = y - prev.y
    const segLen = Math.hypot(dx, dy)
    // Skip near-zero segments (duplicate flattening points produce no tangent).
    if (segLen < 1e-4) return
    total += segLen
    pts.push({ x, y })
    lengths.push(total)
  }

  const segCount = closed ? anchors.length : anchors.length - 1
  pushPoint(anchors[0]!.x, anchors[0]!.y)

  for (let i = 0; i < segCount; i++) {
    const a = anchors[i]!
    const b = anchors[(i + 1) % anchors.length]!
    const p0: [number, number] = [a.x, a.y]
    const p1 = ctrlOutAbs(a) as [number, number]
    const p2 = ctrlInAbs(b)  as [number, number]
    const p3: [number, number] = [b.x, b.y]

    // Step 1..n; t=0 was already pushed by previous segment's terminal.
    for (let s = 1; s <= segmentsPerCurve; s++) {
      const t = s / segmentsPerCurve
      const [x, y] = cubicAt(t, p0, p1, p2, p3)
      pushPoint(x, y)
    }
  }

  if (pts.length < 2) return null
  return { pts, lengths, total, closed }
}

// ---------------------------------------------------------------------------
// Arc-length lookup
// ---------------------------------------------------------------------------

/**
 * Resolve the (x, y, tangent) of a point a given distance along the path.
 * Out-of-range distances are clamped (open paths) or wrapped (closed paths).
 *
 * Uses binary search over the cumulative-length table for O(log n) lookup.
 */
export function pointAtArcLength(table: ArcLengthTable, distance: number): PointOnPath {
  const { pts, lengths, total, closed } = table
  if (pts.length < 2) return { x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0, tangent: 0 }

  let d = distance
  if (closed && total > 0) {
    d = ((d % total) + total) % total      // wrap
  } else {
    d = Math.max(0, Math.min(total, d))    // clamp
  }

  // Binary search for the segment containing `d`.
  let lo = 0
  let hi = lengths.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (lengths[mid]! <= d) lo = mid
    else                    hi = mid
  }

  const a = pts[lo]!
  const b = pts[hi]!
  const la = lengths[lo]!
  const lb = lengths[hi]!
  const segLen = Math.max(1e-6, lb - la)
  const t = (d - la) / segLen

  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    tangent: Math.atan2(b.y - a.y, b.x - a.x),
  }
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

/**
 * Compute the total arc length of an anchor sequence without keeping the full
 * lookup table around. Handy for UI display.
 */
export function totalArcLength(
  anchors: VectorPenAnchor[],
  closed: boolean,
  segmentsPerCurve = 32,
): number {
  const tbl = flattenAnchorsToArcLengthTable(anchors, closed, segmentsPerCurve)
  return tbl?.total ?? 0
}