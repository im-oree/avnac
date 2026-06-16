// editor-icons-panel.tsx
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { hugeiconsBrandIcon } from '@/lib/hugeicons-brand-icon'
import { cloneIconSvg } from '../lib/avnac-icon'
import { AVNAC_ICON_DRAG_MIME, serializeIconDragPayload } from '../lib/avnac-icon-drag'
import type { SceneObject } from '../lib/avnac-scene'
import {
  editorSidebarPanelLeftClass,
  editorSidebarPanelTopClass,
} from '../lib/editor-sidebar-panel-layout'
import {
  getHugeiconsFreeCollection,
  type HugeiconsFreeIconItem,
} from '../lib/hugeicons-free-collection'
import { useEditorStore } from './scene-editor/editor-store'

type Props = {
  open: boolean
  onClose: () => void
}

const COLUMNS = 4
const ROW_HEIGHT = 82
const OVERSCAN_ROWS = 4
const ICON_PLACE_OFFSET = 24

function setIconDragPreview(button: HTMLButtonElement, dataTransfer: DataTransfer) {
  const svg = button.querySelector('svg')
  if (!svg) return
  const preview = document.createElement('div')
  const clone = svg.cloneNode(true) as SVGSVGElement
  preview.style.cssText = [
    'position:fixed',
    'top:-1000px',
    'left:-1000px',
    'width:32px',
    'height:32px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:transparent',
    'border:0',
    'box-shadow:none',
    'pointer-events:none',
  ].join(';')
  clone.setAttribute('width', '32')
  clone.setAttribute('height', '32')
  preview.appendChild(clone)
  document.body.appendChild(preview)
  dataTransfer.setDragImage(preview, 16, 16)
  window.setTimeout(() => preview.remove(), 0)
}

function IconTile({
  item,
  onAdd,
}: {
  item: HugeiconsFreeIconItem
  onAdd: (item: HugeiconsFreeIconItem) => void
}) {
  return (
    <button
      type="button"
      title={item.label}
      onClick={() => onAdd(item)}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData(
          AVNAC_ICON_DRAG_MIME,
          serializeIconDragPayload({
            iconName: item.name,
            label: item.label,
            svg: item.svg,
          }),
        )
        e.dataTransfer.setData('text/plain', item.label)
        e.dataTransfer.effectAllowed = 'copy'
        setIconDragPreview(e.currentTarget, e.dataTransfer)
      }}
      aria-label={item.label}
      className="group flex h-[74px] w-full min-w-0 cursor-grab items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--hover)] hover:text-[var(--text)] active:cursor-grabbing"
    >
      <HugeiconsIcon icon={item.icon} size={28} strokeWidth={1.65} className="shrink-0" />
    </button>
  )
}

function placeBox(docObjects: SceneObject[], artboardW: number, artboardH: number, size: number) {
  let box = {
    x: artboardW / 2 - size / 2,
    y: artboardH / 2 - size / 2,
    width: size,
    height: size,
  }
  const maxX = Math.max(0, artboardW - box.width)
  const maxY = Math.max(0, artboardH - box.height)
  const centerOccupied = () => {
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    return docObjects.some(obj => {
      const objCenterX = obj.x + obj.width / 2
      const objCenterY = obj.y + obj.height / 2
      return Math.abs(objCenterX - centerX) < 2 && Math.abs(objCenterY - centerY) < 2
    })
  }
  while (centerOccupied() && (box.x < maxX || box.y < maxY)) {
    box = {
      ...box,
      x: Math.min(maxX, box.x + ICON_PLACE_OFFSET),
      y: Math.min(maxY, box.y + ICON_PLACE_OFFSET),
    }
  }
  return box
}

export default function EditorIconsPanel({ open, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const doc = useEditorStore(state => state.doc)
  const setDoc = useEditorStore(state => state.setDoc)
  const setSelectedIds = useEditorStore(state => state.setSelectedIds)
  const [input, setInput] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const collection = useMemo(() => getHugeiconsFreeCollection(), [])
  const deferredQuery = useDeferredValue(input.trim().toLowerCase())
  const filteredIcons = useMemo(() => {
    if (!deferredQuery) return collection
    const terms = deferredQuery.split(/\s+/).filter(Boolean)
    return collection.filter(item => terms.every(term => item.keywords.includes(term)))
  }, [collection, deferredQuery])

  useLayoutEffect(() => {
    if (!open) return
    const node = scrollRef.current
    if (!node) return
    const update = () => setViewportHeight(node.clientHeight)
    update()
    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [open])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = 0
    setScrollTop(0)
  }, [deferredQuery])

  useEffect(() => {
    if (!open) {
      setInput('')
      setScrollTop(0)
    }
  }, [open])

  const addIcon = useCallback(
    (item: HugeiconsFreeIconItem) => {
      const size = Math.round(
        Math.max(96, Math.min(512, Math.min(doc.artboard.width, doc.artboard.height) * 0.12)),
      )
      const box = placeBox(doc.objects, doc.artboard.width, doc.artboard.height, size)
      const obj: SceneObject = {
        id: crypto.randomUUID(),
        type: 'icon',
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        name: item.label,
        blurPct: 0,
        shadow: null,
        iconName: item.name,
        svg: cloneIconSvg(item.svg),
        fill: { type: 'solid', color: '#262626' },
        strokeWidth: 1.5,
      }
      setDoc(prev => ({ ...prev, objects: [...prev.objects, obj] }))
      setSelectedIds([obj.id])
      onClose()
    },
    [doc.artboard.height, doc.artboard.width, doc.objects, onClose, setDoc, setSelectedIds],
  )

  if (!open) return null

  const totalRows = Math.ceil(filteredIcons.length / COLUMNS)
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS)
  const endRow = Math.min(
    totalRows,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS,
  )
  const visibleIcons = filteredIcons.slice(startRow * COLUMNS, endRow * COLUMNS)
  const topSpacer = startRow * ROW_HEIGHT
  const bottomSpacer = Math.max(0, (totalRows - endRow) * ROW_HEIGHT)
  const collectionCount = collection.length.toLocaleString('en-US')

  return (
    <div
      data-avnac-chrome
      className={[
        'pointer-events-auto fixed z-40 flex w-[min(100vw-1.5rem,360px)] max-h-[min(92dvh,720px)] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md',
        editorSidebarPanelLeftClass,
        editorSidebarPanelTopClass,
      ].join(' ')}
      role="dialog"
      aria-label="Icons"
    >
      {/* Panel header */}
      <div className="flex shrink-0 items-start justify-between border-b border-[var(--border)] px-3 py-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--text)]">Icons</div>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-subtle)]">
            <span>Powered by</span>
            <a
              href="https://hugeicons.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--text-muted)] underline-offset-2 hover:underline"
            >
              <HugeiconsIcon icon={hugeiconsBrandIcon} size={13} strokeWidth={1.75} />
              <span>Hugeicons</span>
            </a>
          </p>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--hover)] transition-colors"
          onClick={onClose}
          aria-label="Close icons"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Search bar */}
        <div className="shrink-0 border-b border-[var(--border)] p-2">
          <label className="relative block">
            <span className="sr-only">Search icons</span>
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
            />
            <input
              type="search"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Search ${collectionCount} icons...`}
              autoComplete="off"
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </label>
        </div>

        {/* Virtualized icon grid */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto p-2"
          onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
        >
          {filteredIcons.length === 0 ? (
            <p className="px-1 py-6 text-center text-[12px] text-[var(--text-subtle)]">
              No icons found.
            </p>
          ) : (
            <>
              <div style={{ height: topSpacer }} />
              <ul className="grid grid-cols-4 gap-2">
                {visibleIcons.map(item => (
                  <li key={item.name}>
                    <IconTile item={item} onAdd={addIcon} />
                  </li>
                ))}
              </ul>
              <div style={{ height: bottomSpacer }} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}