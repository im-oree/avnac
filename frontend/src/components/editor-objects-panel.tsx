import {
  Add01Icon,
  Cancel01Icon,
  Image02Icon,
  RectangularIcon,
  ShapesIcon,
  StarIcon,
  TextFontIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useRef, useState } from 'react'
import ShapesPopover, { type PopoverShapeKind } from './shapes-popover'
import {
  editorSidebarPanelLeftClass,
  editorSidebarPanelTopClass,
} from '../lib/editor-sidebar-panel-layout'

type Props = {
  open: boolean
  onClose: () => void
  onAddShape?: (kind: PopoverShapeKind) => void
  onAddText?: () => void
  onAddImage?: () => void
}

type ObjectAction = {
  id: string
  label: string
  description: string
  icon: IconSvgElement
  onClick: () => void
  shortcut?: string
}

export default function EditorObjectsPanel({
  open,
  onClose,
  onAddShape,
  onAddText,
  onAddImage,
}: Props) {
  const [shapesOpen, setShapesOpen] = useState(false)
  const shapesBtnRef = useRef<HTMLButtonElement | null>(null)

  if (!open) return null

  const handleShapePick = (kind: PopoverShapeKind) => {
    onAddShape?.(kind)
    setShapesOpen(false)
  }

  const actions: ObjectAction[] = [
    {
      id: 'rect',
      label: 'Rectangle',
      description: 'A flat rectangle or square',
      icon: RectangularIcon,
      onClick: () => onAddShape?.('rect'),
      shortcut: 'R',
    },
    {
      id: 'ellipse',
      label: 'Ellipse',
      description: 'A circle or oval',
      icon: ShapesIcon,
      onClick: () => onAddShape?.('ellipse'),
      shortcut: 'O',
    },
    {
      id: 'star',
      label: 'Star',
      description: 'A configurable star',
      icon: StarIcon,
      onClick: () => onAddShape?.('star'),
    },
    {
      id: 'text',
      label: 'Text',
      description: 'Heading, body or caption',
      icon: TextFontIcon,
      onClick: () => onAddText?.(),
      shortcut: 'T',
    },
    {
      id: 'image',
      label: 'Image',
      description: 'Upload from your device',
      icon: Image02Icon,
      onClick: () => onAddImage?.(),
    },
  ]

  const listClass = 'max-h-[min(60vh,360px)] overflow-auto p-1'

  return (
    <div
      data-avnac-chrome
      className={[
        'pointer-events-auto fixed z-40 flex w-[min(100vw-1.5rem,280px)] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md',
        editorSidebarPanelLeftClass,
        editorSidebarPanelTopClass,
      ].join(' ')}
      role="dialog"
      aria-label="Objects"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="text-sm font-semibold text-[var(--text)]">Objects</span>
        <div className="flex items-center gap-1">
          <button
            ref={shapesBtnRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={shapesOpen}
            onClick={() => setShapesOpen(v => !v)}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[0.75rem] font-medium text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] transition-colors"
            title="More shapes"
          >
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.9} />
            More
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--hover)] transition-colors"
            onClick={onClose}
            aria-label="Close objects"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.75} />
          </button>
        </div>
        <ShapesPopover
          open={shapesOpen}
          anchorRef={shapesBtnRef}
          onClose={() => setShapesOpen(false)}
          onPick={handleShapePick}
        />
      </div>

      <ul className={listClass}>
        {actions.map(action => (
          <li key={action.id}>
            <button
              type="button"
              onClick={action.onClick}
              className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--hover)] transition-colors"
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--hover)] text-[var(--text-muted)] group-hover:bg-[var(--surface)] group-hover:text-[var(--text)] transition-colors">
                <HugeiconsIcon icon={action.icon} size={16} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-[var(--text)]">{action.label}</div>
                <div className="truncate text-[0.6875rem] text-[var(--text-subtle)]">
                  {action.description}
                </div>
              </div>
              {action.shortcut ? (
                <kbd className="hidden h-5 shrink-0 items-center rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-[0.625rem] font-medium text-[var(--text-subtle)] group-hover:inline-flex">
                  {action.shortcut}
                </kbd>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}