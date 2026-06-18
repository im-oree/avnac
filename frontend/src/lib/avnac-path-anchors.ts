import type { VectorPenAnchor } from './avnac-vector-pen-bezier'
import { penAnchorsToPathCommands } from './avnac-vector-pen-bezier'

function fmt(n: number) {
  if (!Number.isFinite(n)) return '0'
  // keep up to 3 decimal places, strip trailing zeros
  const s = n.toFixed(3)
  return s.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '')
}

/**
 * Serialize pen anchors to an SVG `d` path string using cubic commands.
 */
export function penAnchorsToSvgPath(anchors: VectorPenAnchor[], closed: boolean): string {
  const cmds = penAnchorsToPathCommands(anchors, 1, closed)
  if (!cmds) return ''
  const parts: string[] = []
  for (const cmd of cmds) {
    const [letter, ...args] = cmd
    if (letter === 'Z') {
      parts.push('Z')
      continue
    }
    parts.push(letter + ' ' + args.map(n => fmt(n)).join(' '))
  }
  return parts.join(' ')
}

/**
 * Lightweight SVG path parser -> pen anchors.
 * Supports absolute/relative M, L, H, V, C and Z commands.
 * Converts segments into an anchor array where C segments populate
 * the preceding anchor's out handle and the destination anchor's in handle.
 */
export function svgPathToPenAnchors(d: string): { anchors: VectorPenAnchor[]; closed: boolean } | null {
  if (!d || typeof d !== 'string') return null
  // Tokenize commands and numbers (allow scientific notation)
  const tokens = d.replace(/,/g, ' ').match(/[a-zA-Z]|-?\d*\.?\d+(?:e[+-]?\d+)?/gi) || []
  if (tokens.length === 0) return null
  let i = 0
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  let currentCmd: string | null = null
  const anchors: VectorPenAnchor[] = []
  let closed = false

  const isCmd = (t: string) => /^[a-zA-Z]$/.test(t)
  const nextNum = (): number => {
    const t = tokens[i++]
    const n = Number(t)
    return Number.isFinite(n) ? n : 0
  }

  while (i < tokens.length) {
    let t = tokens[i++]!
    if (!isCmd(t)) {
      if (!currentCmd) return null
      // number token continues previous command
      i--
      t = currentCmd
    } else {
      currentCmd = t
    }
    const cmd = t
    const rel = cmd === cmd.toLowerCase()
    switch (cmd.toUpperCase()) {
      case 'M': {
        // first pair is move; subsequent pairs are treated as L
        if (i + 1 > tokens.length) break
        const x = nextNum()
        if (i >= tokens.length) break
        const y = nextNum()
        const ax = rel ? cx + x : x
        const ay = rel ? cy + y : y
        cx = ax
        cy = ay
        startX = ax
        startY = ay
        anchors.push({ x: ax, y: ay })
        // trailing pairs -> implicit L
        while (i + 1 <= tokens.length && i < tokens.length && !isCmd(tokens[i]!)) {
          const x2 = nextNum()
          if (i >= tokens.length) break
          const y2 = nextNum()
          const ax2 = rel ? cx + x2 : x2
          const ay2 = rel ? cy + y2 : y2
          anchors.push({ x: ax2, y: ay2 })
          cx = ax2
          cy = ay2
        }
        break
      }
      case 'L': {
        while (i < tokens.length && !isCmd(tokens[i]!)) {
          const x = nextNum()
          if (i >= tokens.length) break
          const y = nextNum()
          const ax = rel ? cx + x : x
          const ay = rel ? cy + y : y
          anchors.push({ x: ax, y: ay })
          cx = ax
          cy = ay
        }
        break
      }
      case 'H': {
        while (i < tokens.length && !isCmd(tokens[i]!)) {
          const x = nextNum()
          const ax = rel ? cx + x : x
          anchors.push({ x: ax, y: cy })
          cx = ax
        }
        break
      }
      case 'V': {
        while (i < tokens.length && !isCmd(tokens[i]!)) {
          const y = nextNum()
          const ay = rel ? cy + y : y
          anchors.push({ x: cx, y: ay })
          cy = ay
        }
        break
      }
      case 'C': {
        while (i < tokens.length && !isCmd(tokens[i]!)) {
          if (i + 5 >= tokens.length) break
          const x1 = nextNum()
          const y1 = nextNum()
          const x2 = nextNum()
          const y2 = nextNum()
          const x = nextNum()
          const y = nextNum()
          const ax1 = rel ? cx + x1 : x1
          const ay1 = rel ? cy + y1 : y1
          const ax2 = rel ? cx + x2 : x2
          const ay2 = rel ? cy + y2 : y2
          const ax = rel ? cx + x : x
          const ay = rel ? cy + y : y
          const prev = anchors[anchors.length - 1]
          if (prev) {
            prev.outX = ax1
            prev.outY = ay1
          }
          const next: VectorPenAnchor = { x: ax, y: ay, inX: ax2, inY: ay2 }
          anchors.push(next)
          cx = ax
          cy = ay
        }
        break
      }
      case 'Z': {
        closed = true
        // set current point back to start
        cx = startX
        cy = startY
        break
      }
      default: {
        // unsupported command: consume following numeric tokens until next command
        while (i < tokens.length && !isCmd(tokens[i]!)) i++
        break
      }
    }
  }
  return anchors.length > 0 ? { anchors, closed } : null
}

export default null as unknown as void
