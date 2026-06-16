import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  forwardRef,
  type ReactNode,
} from 'react'
import { cx } from './utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'magic'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const buttonBase =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border font-medium no-underline outline-none transition-[background-color,border-color,color,box-shadow,opacity,transform] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-45'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-[var(--btn-primary-hover)] hover:border-[var(--btn-primary-hover)]',
  secondary:
    'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--card-shadow)] hover:border-[var(--text-subtle)]/20 hover:bg-[var(--hover)]',
  ghost:
    'border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]',
  subtle:
    'border-[var(--border)] bg-[var(--hover)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--hover-strong)]',
  danger:
    'border-red-300/40 bg-red-500/8 text-red-600 hover:border-red-300/60 hover:bg-red-500/14 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:border-red-400/30 dark:hover:bg-red-500/16',
  magic:
    'border-[#8B3DFF]/20 bg-[linear-gradient(135deg,rgba(139,61,255,0.1),rgba(232,213,183,0.16))] text-[#5d2fc2] hover:border-[#8B3DFF]/32 hover:bg-[linear-gradient(135deg,rgba(139,61,255,0.14),rgba(232,213,183,0.22))] dark:border-[#8B3DFF]/25 dark:bg-[linear-gradient(135deg,rgba(139,61,255,0.15),rgba(232,213,183,0.08))] dark:text-[#b88aff] dark:hover:border-[#8B3DFF]/38 dark:hover:bg-[linear-gradient(135deg,rgba(139,61,255,0.2),rgba(232,213,183,0.12))]',
}

const buttonSizes: Record<ButtonSize, string> = {
  xs: 'h-8 rounded-lg px-2.5 text-[12px]',
  sm: 'h-9 rounded-lg px-3 text-[13px]',
  md: 'h-10 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-xl px-5 text-base',
}

export function buttonClassName({
  className,
  fullWidth,
  size = 'md',
  variant = 'secondary',
}: {
  className?: string
  fullWidth?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
} = {}) {
  return cx(
    buttonBase,
    buttonVariants[variant],
    buttonSizes[size],
    fullWidth && 'w-full',
    className,
  )
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  iconBefore?: ReactNode
  iconAfter?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    children,
    variant = 'secondary',
    size = 'md',
    fullWidth,
    iconBefore,
    iconAfter,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ className, fullWidth, size, variant })}
      {...props}
    >
      {iconBefore}
      {children}
      {iconAfter}
    </button>
  )
})

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  iconBefore?: ReactNode
  iconAfter?: ReactNode
}

export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(function LinkButton(
  {
    className,
    children,
    variant = 'secondary',
    size = 'md',
    fullWidth,
    iconBefore,
    iconAfter,
    ...props
  },
  ref,
) {
  return (
    <a ref={ref} className={buttonClassName({ className, fullWidth, size, variant })} {...props}>
      {iconBefore}
      {children}
      {iconAfter}
    </a>
  )
})

type IconButtonVariant = 'chrome' | 'ghost' | 'subtle' | 'primary' | 'danger' | 'magic'
type IconButtonSize = 'sm' | 'md' | 'lg'

const iconButtonVariants: Record<IconButtonVariant, string> = {
  chrome:
    'border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]',
  ghost:
    'border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]',
  subtle:
    'border-[var(--border)] bg-[var(--hover)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--hover-strong)] hover:text-[var(--text)]',
  primary:
    'border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] hover:border-[var(--btn-primary-hover)]',
  danger:
    'border-transparent bg-transparent text-red-600 hover:bg-red-500/8 dark:text-red-400 dark:hover:bg-red-500/12',
  magic:
    'border-[#8B3DFF]/18 bg-[#8B3DFF]/8 text-[#6838ce] hover:border-[#8B3DFF]/28 hover:bg-[#8B3DFF]/12 dark:border-[#8B3DFF]/22 dark:bg-[#8B3DFF]/12 dark:text-[#b88aff] dark:hover:border-[#8B3DFF]/34 dark:hover:bg-[#8B3DFF]/18',
}

const iconButtonSizes: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-9 w-9 rounded-xl',
  lg: 'h-10 w-10 rounded-xl',
}

export function iconButtonClassName({
  active,
  className,
  size = 'sm',
  variant = 'chrome',
}: {
  active?: boolean
  className?: string
  size?: IconButtonSize
  variant?: IconButtonVariant
} = {}) {
  return cx(
    'inline-flex shrink-0 cursor-pointer items-center justify-center border outline-none transition-[background-color,border-color,color,box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-45',
    iconButtonVariants[variant],
    iconButtonSizes[size],
    active && 'border-[var(--border-strong)] bg-[var(--hover-strong)] text-[var(--text)]',
    className,
  )
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconSvgElement
  label: string
  variant?: IconButtonVariant
  size?: IconButtonSize
  active?: boolean
  strokeWidth?: number
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    className,
    icon,
    label,
    variant = 'chrome',
    size = 'sm',
    active,
    strokeWidth = 1.75,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonClassName({ active, className, size, variant })}
      {...props}
    >
      <HugeiconsIcon icon={icon} size={size === 'lg' ? 20 : 18} strokeWidth={strokeWidth} />
    </button>
  )
})