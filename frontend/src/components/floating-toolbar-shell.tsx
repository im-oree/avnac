// floating-toolbar-shell.tsx
import { forwardRef, type ReactNode } from 'react'

const shellClass = [
  'pointer-events-auto z-10 inline-flex max-w-[min(100vw-2rem,720px)]',
  'items-stretch overflow-visible rounded-full',
  'border border-[var(--border)]',
  'bg-[var(--surface-overlay)]',
  'shadow-[0_4px_20px_rgba(0,0,0,0.08)]',
  'backdrop-blur-md',
  'text-[var(--text)]',
].join(' ')

type ShellProps = {
  children: ReactNode
  className?: string
  role?: string
  'aria-label'?: string
}

export const FloatingToolbarShell = forwardRef<HTMLDivElement, ShellProps>(
  function FloatingToolbarShell({ children, className = '', role, 'aria-label': ariaLabel }, ref) {
    return (
      <div
        ref={ref}
        data-avnac-chrome
        role={role}
        aria-label={ariaLabel}
        className={[shellClass, className].filter(Boolean).join(' ')}
      >
        {children}
      </div>
    )
  },
)

export function FloatingToolbarDivider() {
  return (
    <div
      className="mx-0.5 w-px shrink-0 self-center bg-[var(--border)]"
      style={{ height: '1.25rem' }}
      aria-hidden
    />
  )
}

export function floatingToolbarIconButton(
  active: boolean,
  opts?: { wide?: boolean },
): string {
  const base = [
    opts?.wide
      ? 'flex h-8 min-w-[2.75rem] shrink-0 items-center justify-center gap-0.5 rounded-lg px-1.5'
      : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
    'text-[var(--text-muted)]',
    'outline-none',
    'transition-colors',
    'hover:bg-[var(--hover)]',
    'hover:text-[var(--text)]',
  ].join(' ')

  return active
    ? `${base} bg-[var(--hover-strong)] text-[var(--text)]`
    : base
}

const floatingToolbarPopoverSurface = [
  'z-50 rounded-xl',
  'border border-[var(--border)]',
  'bg-[var(--surface-raised)]',
  'shadow-[var(--menu-shadow)]',
].join(' ')

/** Use when the panel has nested flyouts; `overflow-hidden` would clip them. */
export const floatingToolbarPopoverMenuClass = floatingToolbarPopoverSurface

export const floatingToolbarPopoverClass =
  `${floatingToolbarPopoverSurface} overflow-hidden`