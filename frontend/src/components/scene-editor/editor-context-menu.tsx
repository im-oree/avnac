import {
  ArrowDown01Icon,
  ArrowDownDoubleIcon,
  ArrowUp01Icon,
  ArrowUpDoubleIcon,
  Copy01Icon,
  Delete02Icon,
  FilePasteIcon,
  LayerAddIcon,
  Layers02Icon,
  SquareLock01Icon,
  SquareUnlock01Icon,
} from '@hugeicons/core-free-icons'
import { useLayoutEffect, useRef, useState } from 'react'
import type { LayerReorderKind } from '../../scene-engine/primitives'
import { Divider, MenuItem, MenuList, PopoverSurface, SubMenu } from '../ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorContextMenuState = {
  x: number
  y: number
  sceneX: number
  sceneY: number
  hasSelection: boolean
  pageId: string | null
  showPageActions: boolean
  locked: boolean
  targetIds?: string[]
  aspectLockApplicable?: boolean
  aspectLocked?: boolean
}

type Props = {
  onAddPage: (afterPageId?: string) => void
  canDeletePage: boolean
  contextMenu: EditorContextMenuState | null
  onClose: () => void
  onCopy: () => void
  onDelete: () => void
  onDeletePage: (pageId?: string) => void
  onDuplicate: () => void
  onDuplicatePage: (sourcePageId?: string) => void
  onPaste: (point: { x: number; y: number }) => void
  onToggleLock: () => void
  onToggleAspectLock: (ids: string[]) => void
  onReorderSelection: (kind: LayerReorderKind) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWPORT_MARGIN = 8

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorContextMenu({
  onAddPage,
  canDeletePage,
  contextMenu,
  onClose,
  onCopy,
  onDelete,
  onDeletePage,
  onDuplicate,
  onDuplicatePage,
  onPaste,
  onToggleLock,
  onToggleAspectLock,
  onReorderSelection,
}: Props) {
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Position the popover within the viewport, flipping above the cursor
  // when there isn't enough space below.
  useLayoutEffect(() => {
    if (!contextMenu) return

    // Provisional placement so the popover can mount and be measured.
    setPos({
      left: Math.max(VIEWPORT_MARGIN, Math.min(contextMenu.x, window.innerWidth - VIEWPORT_MARGIN)),
      top:  Math.max(VIEWPORT_MARGIN, Math.min(contextMenu.y, window.innerHeight - VIEWPORT_MARGIN)),
    })

    const id = requestAnimationFrame(() => {
      const el = popoverRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()

      let left = contextMenu.x
      let top  = contextMenu.y

      // Vertical clamp / flip
      const availableBelow = window.innerHeight - contextMenu.y - VIEWPORT_MARGIN
      const availableAbove = contextMenu.y - VIEWPORT_MARGIN
      if (availableBelow < rect.height && availableAbove > rect.height) {
        top = Math.max(VIEWPORT_MARGIN, contextMenu.y - rect.height)
      } else if (availableBelow < rect.height) {
        top = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN)
      }

      // Horizontal clamp / flip
      if (left + rect.width + VIEWPORT_MARGIN > window.innerWidth) {
        left =
          contextMenu.x - rect.width > VIEWPORT_MARGIN
            ? contextMenu.x - rect.width
            : Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN)
      }
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN

      setPos({ left, top })
    })

    return () => cancelAnimationFrame(id)
  }, [contextMenu])

  if (!contextMenu) return null

  /** Invoke an action, then close the menu. */
  const run = (action: () => void) => () => {
    action()
    onClose()
  }

  const arrangeItems = [
    {
      icon: ArrowUpDoubleIcon,
      label: 'Bring to front',
      shortcut: '⌘]',
      onClick: run(() => onReorderSelection('front')),
    },
    {
      icon: ArrowUp01Icon,
      label: 'Bring forward',
      shortcut: ']',
      onClick: run(() => onReorderSelection('forward')),
    },
    {
      icon: ArrowDown01Icon,
      label: 'Send backward',
      shortcut: '[',
      onClick: run(() => onReorderSelection('backward')),
    },
    {
      icon: ArrowDownDoubleIcon,
      label: 'Send to back',
      shortcut: '⌘[',
      onClick: run(() => onReorderSelection('back')),
    },
  ]

  return (
    <PopoverSurface
      ref={popoverRef}
      role="menu"
      width="w-60"
      className="fixed z-[90] overflow-visible"
      style={{
        left: pos ? `${pos.left}px` : undefined,
        top:  pos ? `${pos.top}px`  : undefined,
      }}
      data-avnac-chrome
    >
      <MenuList>
        {/* ── Selection actions ─────────────────────────────────────────── */}
        {contextMenu.hasSelection && (
          <>
            <MenuItem
              role="menuitem"
              icon={Copy01Icon}
              label="Copy"
              shortcut="⌘C"
              onClick={run(onCopy)}
            />

            <MenuItem
              role="menuitem"
              icon={Layers02Icon}
              label="Duplicate"
              shortcut="⌘D"
              onClick={run(onDuplicate)}
            />

            <MenuItem
              role="menuitem"
              icon={contextMenu.locked ? SquareUnlock01Icon : SquareLock01Icon}
              label={contextMenu.locked ? 'Unlock' : 'Lock'}
              shortcut="⌘L"
              onClick={run(onToggleLock)}
            />

            {contextMenu.aspectLockApplicable && (
              <MenuItem
                role="menuitem"
                icon={contextMenu.aspectLocked ? SquareUnlock01Icon : SquareLock01Icon}
                label={contextMenu.aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                onClick={run(() => onToggleAspectLock(contextMenu.targetIds ?? []))}
              />
            )}

            <Divider />

            <SubMenu
              icon={Layers02Icon}
              label="Arrange"
              items={arrangeItems}
            />
          </>
        )}

        {/* ── Paste (always available) ──────────────────────────────────── */}
        {contextMenu.hasSelection && <Divider />}
        <MenuItem
          role="menuitem"
          icon={FilePasteIcon}
          label="Paste"
          shortcut="⌘V"
          onClick={run(() => onPaste({ x: contextMenu.sceneX, y: contextMenu.sceneY }))}
        />

        {/* ── Page actions ─────────────────────────────────────────────── */}
        {contextMenu.showPageActions && (
          <>
            <Divider />
            <MenuItem
              role="menuitem"
              icon={Copy01Icon}
              label="Duplicate page"
              onClick={run(() => onDuplicatePage(contextMenu.pageId ?? undefined))}
            />
            <MenuItem
              role="menuitem"
              icon={LayerAddIcon}
              label="Add new page"
              onClick={run(() => onAddPage(contextMenu.pageId ?? undefined))}
            />
            {canDeletePage && (
              <MenuItem
                role="menuitem"
                icon={Delete02Icon}
                label="Delete page"
                danger
                onClick={run(() => onDeletePage(contextMenu.pageId ?? undefined))}
              />
            )}
          </>
        )}

        {/* ── Destructive: delete selection ─────────────────────────────── */}
        {contextMenu.hasSelection && (
          <>
            <Divider />
            <MenuItem
              role="menuitem"
              icon={Delete02Icon}
              label="Delete"
              shortcut="⌫"
              danger
              onClick={run(onDelete)}
            />
          </>
        )}
      </MenuList>
    </PopoverSurface>
  )
}