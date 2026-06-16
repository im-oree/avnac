import {
  Copy01Icon,
  Delete02Icon,
  FilePasteIcon,
  LayerAddIcon,
  Layers02Icon,
  SquareLock01Icon,
  SquareUnlock01Icon,
} from '@hugeicons/core-free-icons'

import { Divider, MenuItem, MenuList, PopoverSurface } from '../ui'
import type { LayerReorderKind } from '../../scene-engine/primitives'

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
}: {
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
}) {
  if (!contextMenu) return null

  const closeAfter = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <PopoverSurface
      role="menu"
      width="w-auto"
      className="fixed z-[90] min-w-48 rounded-2xl py-1 backdrop-blur-md"
      style={{
        left: `min(${contextMenu.x}px, calc(100vw - 12.5rem))`,
        top: `min(${contextMenu.y}px, calc(100vh - 18rem))`,
      }}
      data-avnac-chrome
    >
      <MenuList className="p-0">
        {contextMenu.hasSelection ? (
          <>
            <MenuItem
              role="menuitem"
              icon={Copy01Icon}
              label="Copy"
              onClick={() => closeAfter(onCopy)}
            />

            <MenuItem
              role="menuitem"
              icon={Layers02Icon}
              label="Duplicate"
              onClick={() => closeAfter(onDuplicate)}
            />

            <MenuItem
              role="menuitem"
              icon={contextMenu.locked ? SquareUnlock01Icon : SquareLock01Icon}
              label={contextMenu.locked ? 'Unlock' : 'Lock'}
              onClick={() => closeAfter(onToggleLock)}
            />

            {/* Bring/Send and aspect-lock actions moved to Inspector panel */}

            <Divider />
          </>
        ) : null}

        <MenuItem
          role="menuitem"
          icon={FilePasteIcon}
          label="Paste"
          onClick={() =>
            closeAfter(() => onPaste({ x: contextMenu.sceneX, y: contextMenu.sceneY }))
          }
        />

        {contextMenu.showPageActions ? (
          <>
            <MenuItem
              role="menuitem"
              icon={Copy01Icon}
              label="Duplicate page"
              onClick={() => closeAfter(() => onDuplicatePage(contextMenu.pageId ?? undefined))}
            />
            <MenuItem
              role="menuitem"
              icon={LayerAddIcon}
              label="Add new page"
              onClick={() => closeAfter(() => onAddPage(contextMenu.pageId ?? undefined))}
            />
            {canDeletePage ? (
              <MenuItem
                role="menuitem"
                icon={Delete02Icon}
                label="Delete page"
                onClick={() => closeAfter(() => onDeletePage(contextMenu.pageId ?? undefined))}
              />
            ) : null}
          </>
        ) : null}

        {contextMenu.hasSelection ? (
          <>
            <Divider />
            <MenuItem
              role="menuitem"
              icon={Delete02Icon}
              label="Delete"
              onClick={() => closeAfter(onDelete)}
            />
          </>
        ) : null}
      </MenuList>
    </PopoverSurface>
  )
}