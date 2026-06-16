// canvas-element-toolbar.tsx
import {
  Add01Icon,
  AlignBottomIcon,
  AlignHorizontalCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignSelectionIcon,
  AlignTopIcon,
  AlignVerticalCenterIcon,
  ArrowRight01Icon,
  Copy01Icon,
  Delete02Icon,
  DistributeHorizontalCenterIcon,
  DistributeVerticalCenterIcon,
  FilePasteIcon,
  GroupItemsIcon,
  Layers02Icon,
  MinusSignIcon,
  More01Icon,
  SquareLock01Icon,
  SquareUnlock01Icon,
  UngroupItemsIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  type CSSProperties,
  forwardRef,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  measureHorizontalFlyoutInContainer,
  useContainedHorizontalPopoverPlacement,
} from '../hooks/use-viewport-aware-popover'
import {
  FloatingToolbarDivider,
  FloatingToolbarShell,
  floatingToolbarIconButton,
  floatingToolbarPopoverClass,
  floatingToolbarPopoverMenuClass,
} from './floating-toolbar-shell'

export type CanvasAlignKind =
  | 'left'
  | 'centerH'
  | 'right'
  | 'top'
  | 'centerV'
  | 'bottom'
export type CanvasSpacingAxis = 'horizontal' | 'vertical'

type CanvasGroupSpacingValues = Record<CanvasSpacingAxis, number | null>

const VIEWPORT_CONTAIN_PAD = 8
const GROUP_SPACING_STEP = 4
const GROUP_SPACING_MAX = 4000

function containmentDeltaForRect(
  rect: DOMRect,
  vp: DOMRect,
  pad: number,
): { x: number; y: number } {
  const innerL = vp.left + pad
  const innerR = vp.right - pad
  const innerT = vp.top + pad
  const innerB = vp.bottom - pad
  const maxW = innerR - innerL
  const maxH = innerB - innerT
  let dx = 0
  let dy = 0
  if (rect.width > maxW) {
    dx = innerL - rect.left
  } else {
    if (rect.left < innerL) dx = innerL - rect.left
    else if (rect.right > innerR) dx = innerR - rect.right
  }
  if (rect.height > maxH) {
    dy = innerT - rect.top
  } else {
    if (rect.top < innerT) dy = innerT - rect.top
    else if (rect.bottom > innerB) dy = innerB - rect.bottom
  }
  return { x: dx, y: dy }
}

function clampGroupSpacingValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(GROUP_SPACING_MAX, Math.round(value)))
}

// ── Shared class strings ──────────────────────────────────────────────────────
const menuItem = [
  'flex w-full items-center gap-2 px-3 py-2',
  'text-left text-[13px] font-medium',
  'text-[var(--text)]',
  'hover:bg-[var(--hover)]',
  'transition-colors',
].join(' ')

const menuItemSmall = [
  'flex w-full items-center gap-2 px-3 py-1.5',
  'text-left text-[13px]',
  'text-[var(--text)]',
  'hover:bg-[var(--hover)]',
  'transition-colors',
].join(' ')

const menuItemSmallDisabled = [
  menuItemSmall,
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
].join(' ')

const menuIcon = 'shrink-0 text-[var(--text-muted)]'
const menuDivider = 'my-1 h-px bg-[var(--border)]'

function subMenuChevron(isOpen: boolean) {
  return [
    'shrink-0 text-[var(--text-muted)] transition-transform',
    isOpen ? 'rotate-180' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

// ── SpacingGapControl ─────────────────────────────────────────────────────────
function SpacingGapControl({
  axis,
  icon,
  value,
  onChange,
}: {
  axis: CanvasSpacingAxis
  icon: ReactNode
  value: number | null
  onChange: (value: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const skipCommitRef = useRef(false)
  const label = axis === 'horizontal' ? 'Horizontal gap' : 'Vertical gap'
  const currentValue = value == null ? 0 : clampGroupSpacingValue(value)
  const displayValue = value == null ? 'Mixed' : String(currentValue)

  const commitDraft = useCallback(() => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false
      setEditing(false)
      return
    }
    const next = Number(draft.replace(/,/g, '').trim())
    if (Number.isFinite(next)) onChange(clampGroupSpacingValue(next))
    setEditing(false)
  }, [draft, onChange])

  const stepBy = useCallback(
    (delta: number) => {
      onChange(clampGroupSpacingValue(currentValue + delta))
    },
    [currentValue, onChange],
  )

  return (
    <div className="px-3 py-2">
      <div className="mb-1.5 flex items-center gap-2 text-[12px] font-medium text-[var(--text-muted)]">
        <span className="text-[var(--text-subtle)]">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="grid grid-cols-[1.75rem_minmax(3.75rem,1fr)_1.75rem] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <button
          type="button"
          className="flex h-8 items-center justify-center text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => stepBy(-GROUP_SPACING_STEP)}
        >
          <HugeiconsIcon icon={MinusSignIcon} size={14} strokeWidth={1.85} />
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={editing ? draft : displayValue}
          placeholder="Mixed"
          className={[
            'h-8 min-w-0 border-x border-[var(--border)]',
            'bg-transparent px-1.5 text-center text-[12px] font-medium tabular-nums',
            'text-[var(--text)]',
            'outline-none',
            'placeholder:text-[var(--text-subtle)]',
            'focus:bg-[var(--hover)]',
          ].join(' ')}
          aria-label={label}
          onFocus={e => {
            skipCommitRef.current = false
            setEditing(true)
            setDraft(value == null ? '' : String(currentValue))
            e.currentTarget.select()
          }}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              skipCommitRef.current = true
              setEditing(false)
              e.currentTarget.blur()
            }
          }}
        />
        <button
          type="button"
          className="flex h-8 items-center justify-center text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => stepBy(GROUP_SPACING_STEP)}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.85} />
        </button>
      </div>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
type CanvasElementToolbarProps = {
  style: CSSProperties
  placement: 'above' | 'below'
  viewportRef: RefObject<HTMLElement | null>
  locked: boolean
  onDuplicate: () => void
  onToggleLock: () => void
  onDelete: () => void
  onCopy: () => void
  onPaste: () => void
  onAlign: (kind: CanvasAlignKind) => void
  alignAlreadySatisfied: Record<CanvasAlignKind, boolean>
  canGroup: boolean
  canAlignElements: boolean
  canUngroup: boolean
  canSpaceGroup: boolean
  canDistributeGroupSpacing: boolean
  groupSpacingValues: CanvasGroupSpacingValues | null
  onGroup: () => void
  onAlignElements: (kind: CanvasAlignKind) => void
  onDistributeGroupSpacing: (axis: CanvasSpacingAxis) => void
  onSetGroupSpacing: (axis: CanvasSpacingAxis, gap: number) => void
  onUngroup: () => void
}

const CanvasElementToolbar = forwardRef<HTMLDivElement, CanvasElementToolbarProps>(
  function CanvasElementToolbar(
    {
      style,
      placement,
      viewportRef,
      locked,
      onDuplicate,
      onToggleLock,
      onDelete,
      onCopy,
      onPaste,
      onAlign,
      alignAlreadySatisfied,
      canGroup,
      canAlignElements,
      canUngroup,
      canSpaceGroup,
      canDistributeGroupSpacing,
      groupSpacingValues,
      onGroup,
      onAlignElements,
      onDistributeGroupSpacing,
      onSetGroupSpacing,
      onUngroup,
    },
    ref,
  ) {
    const [moreOpen, setMoreOpen] = useState(false)
    const [alignOpen, setAlignOpen] = useState(false)
    const [alignElementsOpen, setAlignElementsOpen] = useState(false)
    const [spacingOpen, setSpacingOpen] = useState(false)

    const moreWrapRef = useRef<HTMLDivElement>(null)
    const morePanelRef = useRef<HTMLDivElement>(null)
    const alignElementsFlyoutRef = useRef<HTMLDivElement>(null)
    const alignPageFlyoutRef = useRef<HTMLDivElement>(null)
    const spacingFlyoutRef = useRef<HTMLDivElement>(null)

    const pickMorePanel = useCallback(() => morePanelRef.current, [])
    const morePopoverShift = useContainedHorizontalPopoverPlacement(
      moreOpen,
      viewportRef,
      pickMorePanel,
    )

    const [alignElementsFlyoutShift, setAlignElementsFlyoutShift] = useState({ x: 0, y: 0 })
    const [alignPageFlyoutShift, setAlignPageFlyoutShift] = useState({ x: 0, y: 0 })
    const [spacingFlyoutShift, setSpacingFlyoutShift] = useState({ x: 0, y: 0 })
    const [viewportNudge, setViewportNudge] = useState({ x: 0, y: 0 })

    const rootRef = useRef<HTMLDivElement | null>(null)
    const prevAnchorRef = useRef<{
      left: CSSProperties['left']
      top: CSSProperties['top']
      placement: 'above' | 'below'
    } | null>(null)

    const assignRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ;(ref as MutableRefObject<HTMLDivElement | null>).current = node
        }
      },
      [ref],
    )

    useLayoutEffect(() => {
      const el = rootRef.current
      const vp = viewportRef.current
      if (!el || !vp) return

      const cur = { left: style.left, top: style.top, placement }
      const prev = prevAnchorRef.current
      const anchorMoved =
        !prev ||
        prev.left !== cur.left ||
        prev.top !== cur.top ||
        prev.placement !== cur.placement
      prevAnchorRef.current = cur

      if (anchorMoved) setViewportNudge({ x: 0, y: 0 })

      const rect = el.getBoundingClientRect()
      const vpRect = vp.getBoundingClientRect()
      const d = containmentDeltaForRect(rect, vpRect, VIEWPORT_CONTAIN_PAD)

      if (anchorMoved) {
        setViewportNudge({ x: d.x, y: d.y })
      } else if (d.x !== 0 || d.y !== 0) {
        setViewportNudge(prev => ({ x: prev.x + d.x, y: prev.y + d.y }))
      }

      const clamp = () => {
        const node = rootRef.current
        const vport = viewportRef.current
        if (!node || !vport) return
        const r = node.getBoundingClientRect()
        const vr = vport.getBoundingClientRect()
        const delta = containmentDeltaForRect(r, vr, VIEWPORT_CONTAIN_PAD)
        if (Math.abs(delta.x) < 0.25 && Math.abs(delta.y) < 0.25) return
        setViewportNudge(prev => ({ x: prev.x + delta.x, y: prev.y + delta.y }))
      }

      const ro = new ResizeObserver(clamp)
      ro.observe(el)
      vp.addEventListener('scroll', clamp, { passive: true })
      window.addEventListener('resize', clamp)
      return () => {
        ro.disconnect()
        vp.removeEventListener('scroll', clamp)
        window.removeEventListener('resize', clamp)
      }
    }, [
      viewportRef,
      placement,
      style.left,
      style.top,
      locked,
      canGroup,
      canUngroup,
      canAlignElements,
      canSpaceGroup,
      moreOpen,
      alignOpen,
      alignElementsOpen,
      spacingOpen,
    ])

    useLayoutEffect(() => {
      if (!moreOpen) {
        setAlignElementsFlyoutShift({ x: 0, y: 0 })
        setAlignPageFlyoutShift({ x: 0, y: 0 })
        setSpacingFlyoutShift({ x: 0, y: 0 })
        return
      }

      function sync() {
        const viewport = viewportRef.current
        if (!viewport) return
        if (alignElementsOpen) {
          const panel = alignElementsFlyoutRef.current
          if (panel) {
            const { shiftX, shiftY } = measureHorizontalFlyoutInContainer(viewport, panel)
            setAlignElementsFlyoutShift({ x: shiftX, y: shiftY })
          }
        } else {
          setAlignElementsFlyoutShift({ x: 0, y: 0 })
        }
        if (alignOpen) {
          const panel = alignPageFlyoutRef.current
          if (panel) {
            const { shiftX, shiftY } = measureHorizontalFlyoutInContainer(viewport, panel)
            setAlignPageFlyoutShift({ x: shiftX, y: shiftY })
          }
        } else {
          setAlignPageFlyoutShift({ x: 0, y: 0 })
        }
        if (spacingOpen) {
          const panel = spacingFlyoutRef.current
          if (panel) {
            const { shiftX, shiftY } = measureHorizontalFlyoutInContainer(viewport, panel)
            setSpacingFlyoutShift({ x: shiftX, y: shiftY })
          }
        } else {
          setSpacingFlyoutShift({ x: 0, y: 0 })
        }
      }

      sync()
      window.addEventListener('resize', sync)
      window.addEventListener('scroll', sync, true)
      return () => {
        window.removeEventListener('resize', sync)
        window.removeEventListener('scroll', sync, true)
      }
    }, [moreOpen, alignElementsOpen, alignOpen, spacingOpen, viewportRef])

    useEffect(() => {
      if (!moreOpen && !alignOpen && !alignElementsOpen && !spacingOpen) return
      const onDown = (e: MouseEvent) => {
        const t = e.target as Node
        if (moreWrapRef.current?.contains(t)) return
        setMoreOpen(false)
        setAlignOpen(false)
        setAlignElementsOpen(false)
        setSpacingOpen(false)
      }
      document.addEventListener('mousedown', onDown)
      return () => document.removeEventListener('mousedown', onDown)
    }, [moreOpen, alignOpen, alignElementsOpen, spacingOpen])

    useEffect(() => {
      if (!locked) return
      setMoreOpen(false)
      setAlignOpen(false)
      setAlignElementsOpen(false)
      setSpacingOpen(false)
    }, [locked])

    useEffect(() => {
      if (!canAlignElements) setAlignElementsOpen(false)
    }, [canAlignElements])

    useEffect(() => {
      if (!canSpaceGroup) setSpacingOpen(false)
    }, [canSpaceGroup])

    const transformY =
      placement === 'above'
        ? `calc(-100% - 10px + ${viewportNudge.y}px)`
        : `calc(10px + ${viewportNudge.y}px)`

    return (
      <div
        ref={assignRootRef}
        className="pointer-events-auto z-[35]"
        style={{
          position: 'absolute',
          transform: `translate(calc(-50% + ${viewportNudge.x}px), ${transformY})`,
          ...style,
        }}
      >
        <FloatingToolbarShell role="toolbar" aria-label="Element actions">
          <div ref={moreWrapRef} className="relative flex items-stretch overflow-visible">
            {locked ? (
              <button
                type="button"
                className={[
                  floatingToolbarIconButton(true, { wide: true }),
                  'gap-1.5 px-2.5',
                ].join(' ')}
                title="Unlock"
                aria-label="Unlock"
                aria-pressed={true}
                onClick={onToggleLock}
              >
                <HugeiconsIcon icon={SquareUnlock01Icon} size={18} strokeWidth={1.75} />
                <span className="text-[13px] font-medium">Unlock</span>
              </button>
            ) : (
              <>
                {canGroup ? (
                  <>
                    <button
                      type="button"
                      className={[
                        floatingToolbarIconButton(false, { wide: true }),
                        'gap-1.5 px-2.5',
                      ].join(' ')}
                      title="Group selection (Cmd/Ctrl+G)"
                      aria-label="Group selection"
                      onClick={onGroup}
                    >
                      <HugeiconsIcon icon={GroupItemsIcon} size={18} strokeWidth={1.75} />
                      <span className="text-[13px] font-medium">Group</span>
                    </button>
                    <FloatingToolbarDivider />
                  </>
                ) : null}

                {canUngroup ? (
                  <>
                    <button
                      type="button"
                      className={[
                        floatingToolbarIconButton(false, { wide: true }),
                        'gap-1.5 px-2.5',
                      ].join(' ')}
                      title="Ungroup (Cmd/Ctrl+Shift+G)"
                      aria-label="Ungroup selection"
                      onClick={onUngroup}
                    >
                      <HugeiconsIcon icon={UngroupItemsIcon} size={18} strokeWidth={1.75} />
                      <span className="text-[13px] font-medium">Ungroup</span>
                    </button>
                    <FloatingToolbarDivider />
                  </>
                ) : null}

                <button
                  type="button"
                  className={floatingToolbarIconButton(false)}
                  title="Duplicate"
                  aria-label="Duplicate"
                  onClick={onDuplicate}
                >
                  <HugeiconsIcon icon={Layers02Icon} size={18} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className={floatingToolbarIconButton(false)}
                  title="Lock"
                  aria-label="Lock"
                  aria-pressed={false}
                  onClick={onToggleLock}
                >
                  <HugeiconsIcon icon={SquareLock01Icon} size={18} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className={floatingToolbarIconButton(false)}
                  title="Delete"
                  aria-label="Delete"
                  onClick={onDelete}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={18} strokeWidth={1.75} />
                </button>

                <FloatingToolbarDivider />

                <div className="relative flex items-center pr-1">
                  <button
                    type="button"
                    className={floatingToolbarIconButton(moreOpen)}
                    title="More options"
                    aria-label="More options"
                    aria-expanded={moreOpen}
                    aria-haspopup="menu"
                    onClick={() => {
                      setMoreOpen(o => !o)
                      setAlignOpen(false)
                      setAlignElementsOpen(false)
                      setSpacingOpen(false)
                    }}
                  >
                    <HugeiconsIcon icon={More01Icon} size={18} strokeWidth={1.75} />
                  </button>

                  {moreOpen ? (
                    <div
                      ref={morePanelRef}
                      role="menu"
                      className={[
                        'absolute left-0 top-full z-[60] mt-1.5 min-w-[11rem] py-1',
                        floatingToolbarPopoverMenuClass,
                      ].join(' ')}
                      style={{
                        transform:
                          morePopoverShift.x !== 0 || morePopoverShift.y !== 0
                            ? `translate(${morePopoverShift.x}px, ${morePopoverShift.y}px)`
                            : undefined,
                      }}
                    >
                      {/* Copy */}
                      <button
                        type="button"
                        role="menuitem"
                        className={menuItem}
                        onClick={() => {
                          onCopy()
                          setMoreOpen(false)
                        }}
                      >
                        <HugeiconsIcon
                          icon={Copy01Icon}
                          size={18}
                          strokeWidth={1.75}
                          className={menuIcon}
                        />
                        Copy
                      </button>

                      {/* Paste */}
                      <button
                        type="button"
                        role="menuitem"
                        className={menuItem}
                        onClick={() => {
                          void onPaste()
                          setMoreOpen(false)
                        }}
                      >
                        <HugeiconsIcon
                          icon={FilePasteIcon}
                          size={18}
                          strokeWidth={1.75}
                          className={menuIcon}
                        />
                        Paste
                      </button>

                      <div className={menuDivider} aria-hidden />

                      {/* Align elements submenu */}
                      {canAlignElements ? (
                        <div className="relative w-full shrink-0">
                          <button
                            type="button"
                            className={`${menuItem} justify-between`}
                            aria-expanded={alignElementsOpen}
                            onClick={() => {
                              setAlignElementsOpen(a => !a)
                              setAlignOpen(false)
                              setSpacingOpen(false)
                            }}
                          >
                            <span className="flex items-center gap-2">
                              <HugeiconsIcon
                                icon={AlignSelectionIcon}
                                size={18}
                                strokeWidth={1.75}
                                className={menuIcon}
                              />
                              Align elements
                            </span>
                            <HugeiconsIcon
                              icon={ArrowRight01Icon}
                              size={14}
                              strokeWidth={1.75}
                              className={subMenuChevron(alignElementsOpen)}
                            />
                          </button>
                          {alignElementsOpen ? (
                            <div
                              ref={alignElementsFlyoutRef}
                              role="menu"
                              className={[
                                'absolute left-full top-0 z-[61] ml-1.5 min-w-[10.5rem] py-1',
                                floatingToolbarPopoverClass,
                              ].join(' ')}
                              style={{
                                transform:
                                  alignElementsFlyoutShift.x !== 0 ||
                                  alignElementsFlyoutShift.y !== 0
                                    ? `translate(${alignElementsFlyoutShift.x}px, ${alignElementsFlyoutShift.y}px)`
                                    : undefined,
                              }}
                            >
                              {(
                                [
                                  { kind: 'left', icon: AlignLeftIcon, label: 'Left' },
                                  {
                                    kind: 'centerH',
                                    icon: AlignHorizontalCenterIcon,
                                    label: 'Center',
                                  },
                                  { kind: 'right', icon: AlignRightIcon, label: 'Right' },
                                ] as const
                              ).map(({ kind, icon, label }) => (
                                <button
                                  key={kind}
                                  type="button"
                                  role="menuitem"
                                  className={menuItemSmall}
                                  onClick={() => {
                                    onAlignElements(kind)
                                    setAlignElementsOpen(false)
                                    setMoreOpen(false)
                                  }}
                                >
                                  <HugeiconsIcon
                                    icon={icon}
                                    size={16}
                                    strokeWidth={1.75}
                                    className={menuIcon}
                                  />
                                  {label}
                                </button>
                              ))}
                              <div className={menuDivider} aria-hidden />
                              {(
                                [
                                  { kind: 'top', icon: AlignTopIcon, label: 'Top' },
                                  {
                                    kind: 'centerV',
                                    icon: AlignVerticalCenterIcon,
                                    label: 'Middle',
                                  },
                                  { kind: 'bottom', icon: AlignBottomIcon, label: 'Bottom' },
                                ] as const
                              ).map(({ kind, icon, label }) => (
                                <button
                                  key={kind}
                                  type="button"
                                  role="menuitem"
                                  className={menuItemSmall}
                                  onClick={() => {
                                    onAlignElements(kind)
                                    setAlignElementsOpen(false)
                                    setMoreOpen(false)
                                  }}
                                >
                                  <HugeiconsIcon
                                    icon={icon}
                                    size={16}
                                    strokeWidth={1.75}
                                    className={menuIcon}
                                  />
                                  {label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Spacing submenu */}
                      {canSpaceGroup ? (
                        <div className="relative w-full shrink-0">
                          <button
                            type="button"
                            className={`${menuItem} justify-between`}
                            aria-expanded={spacingOpen}
                            onClick={() => {
                              setSpacingOpen(o => !o)
                              setAlignElementsOpen(false)
                              setAlignOpen(false)
                            }}
                          >
                            <span className="flex items-center gap-2">
                              <HugeiconsIcon
                                icon={DistributeHorizontalCenterIcon}
                                size={18}
                                strokeWidth={1.75}
                                className={menuIcon}
                              />
                              Spacing
                            </span>
                            <HugeiconsIcon
                              icon={ArrowRight01Icon}
                              size={14}
                              strokeWidth={1.75}
                              className={subMenuChevron(spacingOpen)}
                            />
                          </button>
                          {spacingOpen ? (
                            <div
                              ref={spacingFlyoutRef}
                              role="group"
                              aria-label="Group spacing"
                              className={[
                                'absolute left-full top-0 z-[61] ml-1.5 w-[13rem] py-1',
                                floatingToolbarPopoverClass,
                              ].join(' ')}
                              style={{
                                transform:
                                  spacingFlyoutShift.x !== 0 || spacingFlyoutShift.y !== 0
                                    ? `translate(${spacingFlyoutShift.x}px, ${spacingFlyoutShift.y}px)`
                                    : undefined,
                              }}
                            >
                              <button
                                type="button"
                                disabled={!canDistributeGroupSpacing}
                                className={menuItemSmallDisabled}
                                onClick={() => onDistributeGroupSpacing('horizontal')}
                              >
                                <HugeiconsIcon
                                  icon={DistributeHorizontalCenterIcon}
                                  size={16}
                                  strokeWidth={1.75}
                                  className={menuIcon}
                                />
                                Distribute horizontally
                              </button>
                              <button
                                type="button"
                                disabled={!canDistributeGroupSpacing}
                                className={menuItemSmallDisabled}
                                onClick={() => onDistributeGroupSpacing('vertical')}
                              >
                                <HugeiconsIcon
                                  icon={DistributeVerticalCenterIcon}
                                  size={16}
                                  strokeWidth={1.75}
                                  className={menuIcon}
                                />
                                Distribute vertically
                              </button>
                              <div className={menuDivider} aria-hidden />
                              <SpacingGapControl
                                axis="horizontal"
                                icon={
                                  <HugeiconsIcon
                                    icon={DistributeHorizontalCenterIcon}
                                    size={15}
                                    strokeWidth={1.75}
                                  />
                                }
                                value={groupSpacingValues?.horizontal ?? null}
                                onChange={gap => onSetGroupSpacing('horizontal', gap)}
                              />
                              <SpacingGapControl
                                axis="vertical"
                                icon={
                                  <HugeiconsIcon
                                    icon={DistributeVerticalCenterIcon}
                                    size={15}
                                    strokeWidth={1.75}
                                  />
                                }
                                value={groupSpacingValues?.vertical ?? null}
                                onChange={gap => onSetGroupSpacing('vertical', gap)}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Align to page submenu */}
                      <div className="relative w-full shrink-0">
                        <button
                          type="button"
                          className={`${menuItem} justify-between`}
                          aria-expanded={alignOpen}
                          onClick={() => {
                            setAlignOpen(a => !a)
                            setAlignElementsOpen(false)
                            setSpacingOpen(false)
                          }}
                        >
                          Align to page
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            size={14}
                            strokeWidth={1.75}
                            className={subMenuChevron(alignOpen)}
                          />
                        </button>
                        {alignOpen ? (
                          <div
                            ref={alignPageFlyoutRef}
                            role="menu"
                            className={[
                              'absolute left-full top-0 z-[61] ml-1.5 min-w-[11rem] py-1',
                              floatingToolbarPopoverClass,
                            ].join(' ')}
                            style={{
                              transform:
                                alignPageFlyoutShift.x !== 0 || alignPageFlyoutShift.y !== 0
                                  ? `translate(${alignPageFlyoutShift.x}px, ${alignPageFlyoutShift.y}px)`
                                  : undefined,
                            }}
                          >
                            {(
                              [
                                { kind: 'left', icon: AlignLeftIcon, label: 'Left' },
                                {
                                  kind: 'centerH',
                                  icon: AlignHorizontalCenterIcon,
                                  label: 'Center horizontally',
                                },
                                { kind: 'right', icon: AlignRightIcon, label: 'Right' },
                                { kind: 'top', icon: AlignTopIcon, label: 'Top' },
                                {
                                  kind: 'centerV',
                                  icon: AlignVerticalCenterIcon,
                                  label: 'Center vertically',
                                },
                                { kind: 'bottom', icon: AlignBottomIcon, label: 'Bottom' },
                              ] as const
                            ).map(({ kind, icon, label }) => (
                              <button
                                key={kind}
                                type="button"
                                role="menuitem"
                                disabled={alignAlreadySatisfied[kind]}
                                className={menuItemSmallDisabled}
                                onClick={() => {
                                  onAlign(kind)
                                  setAlignOpen(false)
                                  setMoreOpen(false)
                                }}
                              >
                                <HugeiconsIcon
                                  icon={icon}
                                  size={16}
                                  strokeWidth={1.75}
                                  className={menuIcon}
                                />
                                {label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </FloatingToolbarShell>
      </div>
    )
  },
)

export default CanvasElementToolbar