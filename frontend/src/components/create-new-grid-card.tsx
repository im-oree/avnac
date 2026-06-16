import { Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

type CreateNewGridCardProps = {
  onClick: () => void
  compact?: boolean
}

export default function CreateNewGridCard({ onClick, compact = false }: CreateNewGridCardProps) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onClick}
        className={[
          'group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-dashed text-left transition-[border-color,background-color,transform,box-shadow] duration-200',
          'border-[var(--border-strong)] bg-[var(--surface)]/40',
          'hover:border-[var(--duo-primary)] hover:bg-[var(--surface)]/70 hover:shadow-[var(--card-shadow-hover)]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text)]',
          compact ? 'min-h-[11rem]' : 'min-h-[14.5rem]',
        ].join(' ')}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8">
          <span
            className={[
              'flex items-center justify-center rounded-2xl bg-[var(--duo-accent-soft)] text-[var(--text)] transition-transform duration-200 group-hover:scale-105',
              compact ? 'size-12' : 'size-14',
            ].join(' ')}
            style={{
              background: `linear-gradient(135deg, var(--duo-accent-soft), var(--duo-accent-muted))`,
            }}
          >
            <HugeiconsIcon
              icon={Add01Icon}
              size={compact ? 22 : 26}
              strokeWidth={1.85}
              className="shrink-0"
            />
          </span>
          <div className="text-center">
            <div className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              Create new
            </div>
            {!compact ? (
              <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">
                Pick a size and start designing
              </p>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  )
}