import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import {
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  forwardRef,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { cx } from './utils'

// ---------------------------------------------------------------------------
// Inline chevron (avoids depending on a specific icon-pack export)
// ---------------------------------------------------------------------------

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor" strokeWidth={1.6}
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// MenuList
// ---------------------------------------------------------------------------

export const MenuList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  function MenuList({ className, ...props }, ref) {
    return <div ref={ref} className={cx('grid gap-1 p-1.5', className)} {...props} />
  },
)

// ---------------------------------------------------------------------------
// MenuItem
// ---------------------------------------------------------------------------

export type MenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconSvgElement
  label: ReactNode
  description?: ReactNode
  shortcut?: ReactNode
  active?: boolean
  danger?: boolean
}

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  { className, icon, label, description, shortcut, active, danger, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-[background-color,color,box-shadow] hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/45 disabled:cursor-not-allowed disabled:opacity-45',
        active && 'bg-black/[0.055]',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-neutral-800',
        className,
      )}
      {...props}
    >
      {icon ? (
        <HugeiconsIcon
          icon={icon}
          size={18}
          strokeWidth={1.75}
          className={cx('shrink-0', danger ? 'text-red-500' : 'text-neutral-500')}
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-[12px] leading-5 text-neutral-500">
            {description}
          </span>
        ) : null}
      </span>
      {shortcut ? (
        <span className="shrink-0 rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">
          {shortcut}
        </span>
      ) : null}
    </button>
  )
})

// ---------------------------------------------------------------------------
// SubMenu
// ---------------------------------------------------------------------------

export type SubMenuItem = {
  key?: string | number
  label: ReactNode
  icon?: IconSvgElement
  description?: ReactNode
  shortcut?: ReactNode
  danger?: boolean
  onClick?: () => void
  items?: SubMenuItem[]
}

/**
 * Hover/click-driven submenu (flyout) used inside MenuList.
 *
 * Behaviour:
 *  - Opens on hover *or* click on the trigger row.
 *  - Stays open as long as the cursor is over either the trigger OR the
 *    flyout — implemented via a shared `hoverRef` counter + close timeout
 *    so the small gap between them doesn't dismiss the menu.
 *  - Closes on outside click or Escape.
 *  - The flyout carries `data-avnac-chrome` so the editor's outside-click
 *    handlers don't treat clicks on it as "outside" and dismiss the parent
 *    context menu.
 *  - Flips to the left side of the trigger when the right edge would
 *    overflow the viewport.
 */
export function SubMenu({
  icon,
  label,
  items,
  className,
}: {
  icon?: IconSvgElement
  label: ReactNode
  items: SubMenuItem[]
  className?: string
}) {
  const [open, setOpen]   = useState(false)
  const [flip, setFlip]   = useState(false)
  const buttonRef         = useRef<HTMLButtonElement | null>(null)
  const panelRef          = useRef<HTMLDivElement | null>(null)
  const closeTimerRef     = useRef<number | null>(null)

  // ── Open / close with a small grace period so the cursor can travel
  //    across the gap between the trigger row and the flyout panel.
  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 140)
  }

  // ── Dismiss on outside mousedown / Escape ────────────────────────────
  useEffect(() => {
    if (!open) return

    const onDocPointer = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (buttonRef.current?.contains(target)) return
      if (panelRef.current?.contains(target))  return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown',   onKey)
    }
  }, [open])

  // Clear any pending close timer on unmount
  useEffect(() => () => cancelClose(), [])

  // ── Flip left/right based on viewport space ──────────────────────────
  useLayoutEffect(() => {
    if (!open) {
      setFlip(false)
      return
    }
    const btn   = buttonRef.current
    const panel = panelRef.current
    if (!btn || !panel) return

    const btnRect = btn.getBoundingClientRect()
    // Use the panel's measured width once it has rendered.
    const panelWidth = panel.offsetWidth || 200
    const margin = 8
    setFlip(btnRect.right + panelWidth + margin > window.innerWidth)
  }, [open])

  return (
    <div
      className="relative w-full shrink-0"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        ref={buttonRef}
        className={cx(
          'flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left outline-none',
          'transition-[background-color,color,box-shadow] hover:bg-black/[0.04]',
          'focus-visible:ring-2 focus-visible:ring-[var(--accent)]/45',
          open && 'bg-black/[0.055]',
          className,
        )}
        onMouseEnter={() => { cancelClose(); setOpen(true) }}
        onFocus={()      => { cancelClose(); setOpen(true) }}
        onClick={()      => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex min-w-0 items-center gap-3">
          {icon ? (
            <HugeiconsIcon
              icon={icon}
              size={18}
              strokeWidth={1.75}
              className="shrink-0 text-neutral-500"
            />
          ) : null}
          <span className="block truncate text-[13px] font-medium text-neutral-800">
            {label}
          </span>
        </span>
        <ChevronRight className="ml-2 shrink-0 text-neutral-400" />
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="menu"
          data-avnac-chrome
          className={cx(
            'absolute top-0 z-[61] min-w-[11rem] rounded-xl border border-black/[0.08]',
            'bg-white py-1 shadow-[0_18px_48px_rgba(0,0,0,0.14)]',
            // Position: default to the right of the trigger; flip to its left
            // when the right edge would clip the viewport. Small horizontal
            // gap is kept so the panel visually separates from the trigger,
            // but the wrapper's hover bridge prevents close-on-gap.
            flip ? 'right-full mr-1.5' : 'left-full ml-1.5',
          )}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="grid max-h-[60vh] gap-1 overflow-y-auto overflow-x-visible p-1.5">
            {items.map((it, i) =>
              it.items ? (
                <SubMenu
                  key={it.key ?? i}
                  icon={it.icon}
                  label={it.label}
                  items={it.items}
                />
              ) : (
                <MenuItem
                  key={it.key ?? i}
                  icon={it.icon}
                  label={it.label}
                  description={it.description}
                  shortcut={it.shortcut}
                  danger={it.danger}
                  onClick={() => {
                    setOpen(false)
                    it.onClick?.()
                  }}
                />
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}