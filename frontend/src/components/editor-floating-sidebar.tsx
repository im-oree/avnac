// editor-floating-sidebar.tsx
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type EditorSidebarIconId, editorSidebarIcons } from '@/lib/editor-sidebar-icons'

export type EditorSidebarPanelId = EditorSidebarIconId

type Item = {
  id: EditorSidebarPanelId
  label: string
  icon: IconSvgElement
  activeIcon: IconSvgElement
  fancy?: boolean
}

const ITEMS: Item[] = [
  {
    id: 'layers',
    label: 'Layers',
    icon: editorSidebarIcons.layers.icon,
    activeIcon: editorSidebarIcons.layers.activeIcon,
  },
  {
    id: 'uploads',
    label: 'Uploads',
    icon: editorSidebarIcons.uploads.icon,
    activeIcon: editorSidebarIcons.uploads.activeIcon,
  },
  {
    id: 'images',
    label: 'Images',
    icon: editorSidebarIcons.images.icon,
    activeIcon: editorSidebarIcons.images.activeIcon,
  },
  {
    id: 'objects',
    label: 'Objects',
    icon: editorSidebarIcons.objects.icon,
    activeIcon: editorSidebarIcons.objects.activeIcon,
  },
  {
    id: 'icons',
    label: 'Icons',
    icon: editorSidebarIcons.icons.icon,
    activeIcon: editorSidebarIcons.icons.activeIcon,
  },
  {
    id: 'vector-board',
    label: 'Vectors',
    icon: editorSidebarIcons['vector-board'].icon,
    activeIcon: editorSidebarIcons['vector-board'].activeIcon,
  },
  {
    id: 'apps',
    label: 'Extras',
    icon: editorSidebarIcons.apps.icon,
    activeIcon: editorSidebarIcons.apps.activeIcon,
  },
]

// Snap positions as fractions of available vertical space (0 = top, 1 = bottom)
const SNAP_POSITIONS = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1]
const SNAP_THRESHOLD = 24 // px proximity to snap

const SIDEBAR_TOP_OFFSET = 80 // base offset from top (header clearance)
const SIDEBAR_BOTTOM_MARGIN = 16

type Props = {
  activePanel: EditorSidebarPanelId | null
  onSelectPanel: (id: EditorSidebarPanelId) => void
  disabled?: boolean
}

type SidebarIndicatorState = {
  left: number
  top: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function findNearestSnap(y: number, minY: number, maxY: number): number {
  const range = maxY - minY
  if (range <= 0) return minY

  let nearest = SNAP_POSITIONS[0]
  let nearestDist = Infinity

  for (const frac of SNAP_POSITIONS) {
    const snapY = minY + frac * range
    const dist = Math.abs(y - snapY)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = frac
    }
  }

  return minY + nearest * range
}

export default function EditorFloatingSidebar({ activePanel, onSelectPanel, disabled }: Props) {
  const navRef = useRef<HTMLElement | null>(null)
  const buttonRefs = useRef<Partial<Record<EditorSidebarPanelId, HTMLButtonElement | null>>>({})
  const [indicator, setIndicator] = useState<SidebarIndicatorState | null>(null)
  const activeItem = activePanel ? (ITEMS.find(item => item.id === activePanel) ?? null) : null

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [isCtrlHeld, setIsCtrlHeld] = useState(false)
  const dragStartY = useRef(0)
  const dragStartTop = useRef(0)
  const sidebarY = useMotionValue(SIDEBAR_TOP_OFFSET)
  const smoothY = useSpring(sidebarY, { stiffness: 400, damping: 35, mass: 0.6 })
  const [hasDragMoved, setHasDragMoved] = useState(false)

  // Persist position
  const [initialPositionSet, setInitialPositionSet] = useState(false)

  // Calculate bounds
  const getBounds = useCallback(() => {
    const navEl = navRef.current
    const navHeight = navEl?.offsetHeight ?? 400
    const windowHeight = window.innerHeight
    const minY = SIDEBAR_TOP_OFFSET
    const maxY = windowHeight - navHeight - SIDEBAR_BOTTOM_MARGIN
    return { minY, maxY: Math.max(minY, maxY), navHeight }
  }, [])

  // Initialize position from localStorage or default snap
  useEffect(() => {
    if (initialPositionSet) return
    const stored = localStorage.getItem('editor-sidebar-y-frac')
    const { minY, maxY } = getBounds()
    if (stored !== null) {
      const frac = parseFloat(stored)
      if (!isNaN(frac)) {
        const y = minY + frac * (maxY - minY)
        sidebarY.set(clamp(y, minY, maxY))
      }
    } else {
      // Default: 15% from top
      const y = minY + 0.15 * (maxY - minY)
      sidebarY.set(clamp(y, minY, maxY))
    }
    setInitialPositionSet(true)
  }, [getBounds, initialPositionSet, sidebarY])

  // Keep within bounds on resize
  useEffect(() => {
    const handleResize = () => {
      const { minY, maxY } = getBounds()
      const current = sidebarY.get()
      sidebarY.set(clamp(current, minY, maxY))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [getBounds, sidebarY])

  // Track Ctrl key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlHeld(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlHeld(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Drag handle handlers
  const handleDragStart = useCallback(
    (clientY: number) => {
      setIsDragging(true)
      setHasDragMoved(false)
      dragStartY.current = clientY
      dragStartTop.current = sidebarY.get()
    },
    [sidebarY],
  )

  const handleDragMove = useCallback(
    (clientY: number, ctrlKey: boolean) => {
      if (!isDragging) return
      const delta = clientY - dragStartY.current
      if (Math.abs(delta) > 3) setHasDragMoved(true)
      const { minY, maxY } = getBounds()
      let newY = clamp(dragStartTop.current + delta, minY, maxY)

      // Snap unless Ctrl is held
      if (!ctrlKey) {
        const snapped = findNearestSnap(newY, minY, maxY)
        if (Math.abs(newY - snapped) < SNAP_THRESHOLD) {
          newY = snapped
        }
      }

      sidebarY.set(newY)
    },
    [isDragging, getBounds, sidebarY],
  )

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    const { minY, maxY } = getBounds()
    let finalY = sidebarY.get()

    // Snap on release if not holding Ctrl
    if (!isCtrlHeld) {
      const snapped = findNearestSnap(finalY, minY, maxY)
      if (Math.abs(finalY - snapped) < SNAP_THRESHOLD * 2) {
        finalY = snapped
      }
    }

    sidebarY.set(clamp(finalY, minY, maxY))

    // Persist as fraction
    const range = maxY - minY
    if (range > 0) {
      const frac = (finalY - minY) / range
      localStorage.setItem('editor-sidebar-y-frac', frac.toFixed(4))
    }
  }, [isDragging, getBounds, sidebarY, isCtrlHeld])

  // Mouse drag
  useEffect(() => {
    if (!isDragging) return
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientY, e.ctrlKey || e.metaKey)
    const onMouseUp = () => handleDragEnd()
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // Touch drag
  useEffect(() => {
    if (!isDragging) return
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleDragMove(e.touches[0].clientY, false)
      }
    }
    const onTouchEnd = () => handleDragEnd()
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)
    return () => {
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  // Indicator tracking
  useLayoutEffect(() => {
    if (!activeItem || activeItem.fancy) {
      setIndicator(null)
      return
    }
    const button = buttonRefs.current[activeItem.id]
    if (!button) {
      setIndicator(null)
      return
    }
    setIndicator({
      left: button.offsetLeft,
      top: button.offsetTop,
      width: button.offsetWidth,
      height: button.offsetHeight,
    })
  }, [activeItem])

  useEffect(() => {
    if (!activeItem || activeItem.fancy) return

    const updateIndicator = () => {
      const button = buttonRefs.current[activeItem.id]
      if (!button) return
      setIndicator({
        left: button.offsetLeft,
        top: button.offsetTop,
        width: button.offsetWidth,
        height: button.offsetHeight,
      })
    }

    updateIndicator()

    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', updateIndicator)
      return () => window.removeEventListener('resize', updateIndicator)
    }

    const observer = new ResizeObserver(updateIndicator)
    const nav = navRef.current
    if (nav) observer.observe(nav)
    Object.values(buttonRefs.current).forEach(button => {
      if (button) observer.observe(button)
    })
    window.addEventListener('resize', updateIndicator)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [activeItem])

  // Snap indicator dots — visual cues
  const [snapDots, setSnapDots] = useState<number[]>([])
  useEffect(() => {
    if (!isDragging) {
      setSnapDots([])
      return
    }
    const { minY, maxY } = getBounds()
    const range = maxY - minY
    if (range <= 0) return
    setSnapDots(SNAP_POSITIONS.map(frac => minY + frac * range))
  }, [isDragging, getBounds])

  return (
    <>
      {/* Snap position indicators — shown while dragging */}
      {isDragging && !isCtrlHeld && snapDots.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[44]" aria-hidden>
          {snapDots.map((dotY, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.4, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute left-[7px] h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]"
              style={{ top: dotY + (navRef.current?.offsetHeight ?? 0) / 2 - 3 }}
            />
          ))}
        </div>
      )}

      <motion.nav
        ref={navRef}
        data-avnac-chrome
        aria-label="Editor tools"
        style={{ y: smoothY }}
        className={[
          'pointer-events-auto fixed left-3 top-0 z-[45] flex flex-col items-center rounded-[22px] border border-[var(--border)] bg-[var(--surface-raised)]/95 shadow-lg shadow-black/[0.04] backdrop-blur-xl',
          isDragging ? 'cursor-grabbing' : '',
          disabled ? 'pointer-events-none opacity-40' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Drag handle */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Drag to reposition sidebar"
          className={[
            'group flex w-full cursor-grab items-center justify-center rounded-t-[22px] px-3 pb-1 pt-2.5 transition-colors hover:bg-[var(--hover)]',
            isDragging ? 'cursor-grabbing bg-[var(--hover)]' : '',
          ].join(' ')}
          onMouseDown={e => {
            e.preventDefault()
            handleDragStart(e.clientY)
          }}
          onTouchStart={e => {
            if (e.touches.length === 1) {
              handleDragStart(e.touches[0].clientY)
            }
          }}
        >
          <div className="flex flex-col gap-[3px]">
            <div className="h-[2px] w-5 rounded-full bg-[var(--text-muted)] opacity-30 transition-opacity group-hover:opacity-60" />
            <div className="h-[2px] w-5 rounded-full bg-[var(--text-muted)] opacity-30 transition-opacity group-hover:opacity-60" />
          </div>
        </div>

        {/* Items container */}
        <div className="relative flex flex-col gap-0.5 px-1.5 pb-2 pt-0.5">
          {indicator ? (
            <motion.span
              aria-hidden
              initial={false}
              animate={{
                x: indicator.left - 6, // offset for px-1.5 container padding
                y: indicator.top - 2, // offset for pt-0.5
                width: indicator.width,
                height: indicator.height,
                opacity: 1,
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.65 }}
              className="pointer-events-none absolute left-0 top-0 z-0 rounded-[14px] bg-[var(--surface)] ring-1 ring-[var(--border)]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
            />
          ) : null}

          {ITEMS.map(item => {
            const active = activePanel === item.id
            const icon = active ? item.activeIcon : item.icon

            if (item.fancy) {
              return (
                <button
                  key={item.id}
                  ref={node => {
                    buttonRefs.current[item.id] = node
                  }}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => {
                    if (!hasDragMoved || !isDragging) onSelectPanel(item.id)
                  }}
                  className={[
                    'avnac-ai-tile relative z-10 flex w-[3.75rem] flex-col items-center gap-1 rounded-[14px] px-1 py-2 text-[10.5px] font-medium leading-tight transition-[background,box-shadow]',
                    disabled ? 'cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  <HugeiconsIcon
                    icon={icon}
                    size={20}
                    strokeWidth={active ? undefined : 1.75}
                    className="avnac-ai-accent shrink-0"
                  />
                  <span className="avnac-ai-accent max-w-full truncate font-semibold">
                    {item.label}
                  </span>
                </button>
              )
            }

            return (
              <button
                key={item.id}
                ref={node => {
                  buttonRefs.current[item.id] = node
                }}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => {
                  if (!hasDragMoved || !isDragging) onSelectPanel(item.id)
                }}
                className={[
                  'relative z-10 flex w-[3.75rem] flex-col items-center gap-1 rounded-[14px] px-1 py-2 text-[10.5px] font-medium leading-tight transition-colors',
                  active
                    ? 'text-[var(--text)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]',
                  disabled ? 'cursor-not-allowed' : '',
                ].join(' ')}
              >
                <HugeiconsIcon
                  icon={icon}
                  size={20}
                  strokeWidth={active ? undefined : 1.65}
                  className={[
                    'shrink-0 transition-colors',
                    active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]',
                  ].join(' ')}
                />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Bottom grip — secondary drag zone */}
        <div
          aria-hidden
          className={[
            'group flex w-full cursor-grab items-center justify-center rounded-b-[22px] px-3 pb-2.5 pt-1 transition-colors hover:bg-[var(--hover)]',
            isDragging ? 'cursor-grabbing bg-[var(--hover)]' : '',
          ].join(' ')}
          onMouseDown={e => {
            e.preventDefault()
            handleDragStart(e.clientY)
          }}
          onTouchStart={e => {
            if (e.touches.length === 1) {
              handleDragStart(e.touches[0].clientY)
            }
          }}
        >
          <div className="h-[2.5px] w-5 rounded-full bg-[var(--text-muted)] opacity-25 transition-opacity group-hover:opacity-50" />
        </div>
      </motion.nav>
    </>
  )
}