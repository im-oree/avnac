import {
  ArrowUpRight01Icon,
  CircleIcon,
  GeometricShapes02Icon,
  LinerIcon,
  PenTool03Icon,
  PolygonIcon,
  SquareIcon,
  StarIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { type RefObject, useCallback, useRef } from 'react'
import { useViewportAwarePopoverPlacement } from '../hooks/use-viewport-aware-popover'

export type PopoverShapeKind =
  | 'rect'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'line'
  | 'arrow'
  | 'pen'

export type ShapesQuickAddKind = PopoverShapeKind | 'generic'

export const SHAPE_KIND_ICONS: Record<PopoverShapeKind, IconSvgElement> = {
  rect:    SquareIcon,
  ellipse: CircleIcon,
  polygon: PolygonIcon,
  star:    StarIcon,
  line:    LinerIcon,
  arrow:   ArrowUpRight01Icon,
  pen:     PenTool03Icon,
}

export function iconForShapesQuickAdd(kind: ShapesQuickAddKind): IconSvgElement {
  return kind === 'generic' ? GeometricShapes02Icon : SHAPE_KIND_ICONS[kind]
}

type Item = {
  kind: PopoverShapeKind
  label: string
  icon: IconSvgElement
  hint?: string
}

const ITEMS: Item[] = [
  { kind: 'rect',    label: 'Square',  icon: SHAPE_KIND_ICONS.rect    },
  { kind: 'ellipse', label: 'Ellipse', icon: SHAPE_KIND_ICONS.ellipse },
  { kind: 'polygon', label: 'Polygon', icon: SHAPE_KIND_ICONS.polygon },
  { kind: 'star',    label: 'Star',    icon: SHAPE_KIND_ICONS.star    },
  { kind: 'line',    label: 'Line',    icon: SHAPE_KIND_ICONS.line    },
  { kind: 'arrow',   label: 'Arrow',   icon: SHAPE_KIND_ICONS.arrow   },
  { kind: 'pen',     label: 'Pen',     icon: SHAPE_KIND_ICONS.pen, hint: 'Draw' },
]

type Props = {
  open: boolean
  disabled?: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  onPick: (kind: PopoverShapeKind) => void
}

export default function ShapesPopover({ open, disabled, anchorRef, onClose, onPick }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const pickPanel = useCallback(() => panelRef.current, [])
  const { openUpward, shiftX } = useViewportAwarePopoverPlacement(
    open && !disabled,
    anchorRef,
    320,
    pickPanel,
    'left',
  )

  if (!open || disabled) return null

  return (
    <div
      ref={panelRef}
      role="menu"
      style={{ transform: `translateX(${shiftX}px)` }}
      className={[
        'absolute left-0 z-[60] min-w-[11rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1',
        openUpward ? 'bottom-full mb-2' : 'top-full mt-2',
      ].join(' ')}
      data-avnac-chrome
    >
      {ITEMS.map(({ kind, label, icon, hint }) => (
        <button
          key={kind}
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--text)] outline-none transition-colors hover:bg-[var(--hover)]"
          onClick={() => {
            onPick(kind)
            onClose()
          }}
        >
          <HugeiconsIcon
            icon={icon}
            size={18}
            strokeWidth={1.75}
            className="text-[var(--text-muted)]"
          />
          <span>{label}</span>
          {hint ? (
            <span className="ml-auto text-[10px] text-[var(--text-subtle)]">{hint}</span>
          ) : kind === 'rect' ? (
            <span className="ml-auto text-[10px] text-[var(--text-subtle)]">default</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}