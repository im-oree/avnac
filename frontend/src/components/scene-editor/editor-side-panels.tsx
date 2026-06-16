import { lazy, Suspense } from 'react'

import { emptyVectorBoardDocument } from '../../lib/avnac-vector-board-document'
import {
  editorSidebarPanelLeftClass,
  editorSidebarPanelTopClass,
} from '../../lib/editor-sidebar-panel-layout'
import EditorAppsPanel from '../editor-apps-panel'
import EditorObjectsPanel from '../editor-objects-panel'
import EditorFloatingSidebar, { type EditorSidebarPanelId } from '../editor-floating-sidebar'
import EditorImagesPanel from '../editor-images-panel'
import EditorLayersPanel from '../editor-layers-panel'
import EditorUploadsPanel from '../editor-uploads-panel'
import EditorVectorBoardPanel from '../editor-vector-board-panel'
import type { PopoverShapeKind } from '../shapes-popover'
import VectorBoardWorkspace from '../vector-board-workspace'
import { useEditorLayerControls } from './use-editor-layer-controls'
import { useVectorBoardControlsContext } from './use-vector-board-controls'

const EditorIconsPanel = lazy(() => import('../editor-icons-panel'))

function EditorIconsPanelLoading() {
  return (
    <div
      data-avnac-chrome
      className={[
        'pointer-events-auto fixed z-40 flex w-[min(100vw-1.5rem,360px)] max-h-[min(92dvh,720px)] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md',
        editorSidebarPanelLeftClass,
        editorSidebarPanelTopClass,
      ].join(' ')}
      role="status"
    >
      <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
        Icons
      </div>
      <div className="px-3 py-8 text-center text-sm text-[var(--text-subtle)]">Loading...</div>
    </div>
  )
}

export function EditorSidePanels({
  activePanel,
  onClosePanel,
  onSelectPanel,
  ready,
  onAddShape,
  onAddText,
  onAddImage,
}: {
  activePanel: EditorSidebarPanelId | null
  onClosePanel: () => void
  onSelectPanel: (id: EditorSidebarPanelId) => void
  ready: boolean
  onAddShape?: (kind: PopoverShapeKind) => void
  onAddText?: () => void
  onAddImage?: () => void
}) {
  const {
    layerRows,
    onLayerBringForward,
    onLayerReorder,
    onLayerSendBackward,
    onRenameLayer,
    onSelectLayer,
    onToggleLayerVisible,
  } = useEditorLayerControls()
  const {
    boardDocs,
    boards,
    closeVectorWorkspace,
    createVectorBoard,
    deleteVectorBoard,
    onVectorBoardDocumentChange,
    openVectorBoardWorkspace,
    placeActiveVectorBoardAtArtboardCenter,
    vectorWorkspaceId,
    vectorWorkspaceName,
  } = useVectorBoardControlsContext()

  return (
    <>
      {ready ? (
        <EditorFloatingSidebar activePanel={activePanel} onSelectPanel={onSelectPanel} />
      ) : null}

      <EditorLayersPanel
        open={ready && activePanel === 'layers'}
        onClose={onClosePanel}
        rows={layerRows}
        onSelectLayer={onSelectLayer}
        onToggleVisible={onToggleLayerVisible}
        onBringForward={onLayerBringForward}
        onSendBackward={onLayerSendBackward}
        onReorder={onLayerReorder}
        onRenameLayer={onRenameLayer}
      />
      <EditorUploadsPanel open={ready && activePanel === 'uploads'} onClose={onClosePanel} />
      <EditorImagesPanel open={ready && activePanel === 'images'} onClose={onClosePanel} />
      <EditorObjectsPanel
        open={ready && activePanel === 'objects'}
        onClose={onClosePanel}
        onAddShape={onAddShape}
        onAddText={onAddText}
        onAddImage={onAddImage}
      />
      {ready && activePanel === 'icons' ? (
        <Suspense fallback={<EditorIconsPanelLoading />}>
          <EditorIconsPanel open onClose={onClosePanel} />
        </Suspense>
      ) : null}
      <EditorVectorBoardPanel
        open={ready && activePanel === 'vector-board'}
        onClose={onClosePanel}
        boards={boards}
        boardDocs={boardDocs}
        onCreateNew={createVectorBoard}
        onOpenBoard={openVectorBoardWorkspace}
        onDeleteBoard={deleteVectorBoard}
      />
      <EditorAppsPanel open={ready && activePanel === 'apps'} onClose={onClosePanel} />
      {vectorWorkspaceId ? (
        <VectorBoardWorkspace
          open
          boardName={vectorWorkspaceName}
          document={boardDocs[vectorWorkspaceId] ?? emptyVectorBoardDocument()}
          onDocumentChange={next => onVectorBoardDocumentChange(vectorWorkspaceId, next)}
          onSave={closeVectorWorkspace}
          onSaveAndPlace={() => {
            placeActiveVectorBoardAtArtboardCenter()
            closeVectorWorkspace()
          }}
          onClose={closeVectorWorkspace}
        />
      ) : null}
    </>
  )
}