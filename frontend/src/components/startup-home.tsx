import {
  ArrowDown01Icon,
  CloudUploadIcon,
  GithubIcon,
  Home05Icon,
  Moon02Icon,
  SparklesIcon,
  Sun03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { usePostHog } from 'posthog-js/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import CreateNewGridCard from './create-new-grid-card'
import DeleteConfirmDialog from './delete-confirm-dialog'
import DocumentMigrationDialog from './document-migration-dialog'
import FileGridCard from './file-grid-card'
import FilesMultiselectBar from './files-multiselect-bar'
import NewCanvasDialog from './new-canvas-dialog'
import { parseAvnacDocument } from '../lib/avnac-document'
import { avnacDocumentPreviewEvictPersistId } from '../lib/avnac-document-preview'
import {
  type AvnacEditorIdbListItem,
  idbDeleteDocument,
  idbListDocuments,
  idbMigrateLegacyDocument,
  idbPutDocument,
} from '../lib/avnac-editor-idb'
import { downloadAvnacJsonForId } from '../lib/avnac-files-export'

function formatUpdatedAt(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString()
  }
}

function nameFromImportFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').trim()
  return base || 'Imported file'
}

function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('avnac-theme')
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('avnac-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggle = useCallback(() => setIsDark(prev => !prev), [])

  return { isDark, toggle }
}

type StartupHomeProps = {
  analyticsSurface?: string
}

export default function StartupHome({ analyticsSurface = 'startup_home' }: StartupHomeProps) {
  const [items, setItems] = useState<AvnacEditorIdbListItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [newCanvasOpen, setNewCanvasOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteDialog, setDeleteDialog] = useState<{
    ids: string[]
    title: string
    message: string
  } | null>(null)
  const [migrationDialog, setMigrationDialog] = useState<{
    ids: string[]
    title: string
    message: string
    confirmLabel: string
    triggerSource: 'thumbnail' | 'title' | 'menu' | 'banner'
    openFileId?: string
  } | null>(null)
  const [migrationBusy, setMigrationBusy] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const posthog = usePostHog()
  const navigate = useNavigate()
  const { isDark, toggle: toggleTheme } = useTheme()

  const clearSelection = useCallback(() => setSelectedIds([]), [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }, [])

  const refreshList = useCallback(() => {
    void idbListDocuments()
      .then(list => {
        setItems(list)
        setLoadError(null)
      })
      .catch(() => {
        setLoadError('Could not load your projects.')
        setItems([])
      })
  }, [])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  useEffect(() => {
    if (!items) return
    if (items.length === 0) {
      setSelectedIds(prev => (prev.length ? [] : prev))
      return
    }
    const valid = new Set(items.map(i => i.id))
    setSelectedIds(prev => {
      const next = prev.filter(id => valid.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [items])

  useEffect(() => {
    if (!actionsOpen) return
    const onDoc = (e: MouseEvent) => {
      const el = actionsRef.current
      if (el && !el.contains(e.target as Node)) setActionsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActionsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [actionsOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (deleteDialog) {
        e.preventDefault()
        setDeleteDialog(null)
        return
      }
      if (selectedIds.length > 0) clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteDialog, selectedIds.length, clearSelection])

  const bulkDownload = useCallback(() => {
    const ids = [...selectedIds]
    posthog.capture('files_bulk_downloaded', { file_count: ids.length, surface: analyticsSurface })
    void (async () => {
      try {
        for (const id of ids) {
          await downloadAvnacJsonForId(id)
          await new Promise(r => setTimeout(r, 140))
        }
      } catch (err) {
        posthog.captureException(err)
        console.error('[avnac] bulk download failed', err)
      }
    })()
  }, [selectedIds, posthog, analyticsSurface])

  const bulkTrash = useCallback(() => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const n = ids.length
    setDeleteDialog({
      ids,
      title: n === 1 ? 'Remove this project?' : 'Remove these projects?',
      message:
        n === 1
          ? 'This will permanently remove the project from this browser. This cannot be undone.'
          : `This will permanently remove ${n} projects from this browser. This cannot be undone.`,
    })
  }, [selectedIds])

  const confirmDelete = useCallback(() => {
    if (!deleteDialog) return
    const ids = [...deleteDialog.ids]
    setDeleteDialog(null)
    posthog.capture('file_deleted', {
      file_count: ids.length,
      file_ids: ids,
      surface: analyticsSurface,
    })
    void (async () => {
      try {
        for (const id of ids) {
          await idbDeleteDocument(id)
          avnacDocumentPreviewEvictPersistId(id)
        }
        setSelectedIds(prev => prev.filter(id => !ids.includes(id)))
        refreshList()
      } catch (err) {
        posthog.captureException(err)
        console.error('[avnac] delete failed', err)
      }
    })()
  }, [deleteDialog, refreshList, posthog, analyticsSurface])

  const requestDeleteFile = useCallback((id: string) => {
    setDeleteDialog({
      ids: [id],
      title: 'Remove this project?',
      message: 'This will permanently remove the project from this browser. This cannot be undone.',
    })
  }, [])

  const importFromJsonFile = useCallback(
    async (file: File) => {
      setImportError(null)
      setActionsOpen(false)
      try {
        let raw: unknown
        try {
          raw = JSON.parse(await file.text()) as unknown
        } catch (err) {
          posthog.captureException(err)
          setImportError(
            'That file is not valid JSON. Choose an exported Avnac JSON document and try again.',
          )
          return
        }
        const document = parseAvnacDocument(raw)
        if (!document) {
          setImportError(
            'This JSON file could not be imported. Try an Avnac export or a legacy Fabric-based Avnac file.',
          )
          return
        }
        const id = crypto.randomUUID()
        const name = nameFromImportFilename(file.name)
        await idbPutDocument(id, document, { name })
        posthog.capture('file_imported', {
          file_id: id,
          file_name: name,
          source_name: file.name,
          source_type: 'json',
          imported_version: document.v,
          surface: analyticsSurface,
        })
        refreshList()
        void navigate({ to: '/create', search: { id } })
      } catch (err) {
        posthog.captureException(err)
        setImportError(
          'The file could not be imported into this browser right now. Try again in a moment.',
        )
      }
    },
    [navigate, posthog, refreshList, analyticsSurface],
  )

  const onImportInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      void importFromJsonFile(file)
    },
    [importFromJsonFile],
  )

  const selectionCount = selectedIds.length
  const legacyItems = items?.filter(row => row.isLegacy) ?? []
  const legacyCount = legacyItems.length
  const projectCount = items?.length ?? 0

  const requestOpenFile = useCallback(
    (row: AvnacEditorIdbListItem, source: 'thumbnail' | 'title' | 'menu') => {
      if (row.isLegacy) {
        setMigrationDialog({
          ids: [row.id],
          title: 'Convert this file first',
          message: `"${row.name}" was made in an older version of Avnac. Convert it to the new editor before opening it.`,
          confirmLabel: 'Convert and open',
          triggerSource: source,
          openFileId: row.id,
        })
        posthog.capture('legacy_conversion_prompt_opened', {
          surface: analyticsSurface,
          trigger_source: source,
          file_count: 1,
          file_ids: [row.id],
          open_after_conversion: true,
        })
        return
      }
      posthog.capture('file_opened', {
        file_id: row.id,
        method: source,
        surface: analyticsSurface,
      })
      void navigate({ to: '/create', search: { id: row.id } })
    },
    [navigate, posthog, analyticsSurface],
  )

  const requestMigrateAll = useCallback(() => {
    if (legacyItems.length === 0) return
    setMigrationDialog({
      ids: legacyItems.map(row => row.id),
      title:
        legacyItems.length === 1
          ? 'Migrate 1 old file?'
          : `Migrate ${legacyItems.length} old files?`,
      message:
        legacyItems.length === 1
          ? 'This file was saved in an older version of Avnac. Convert it once and it will open normally in the new canvas.'
          : 'These files were saved in an older version of Avnac. Convert them once and they will open normally in the new canvas.',
      confirmLabel: legacyItems.length === 1 ? 'Convert file' : 'Migrate all files',
      triggerSource: 'banner',
    })
    posthog.capture('legacy_conversion_prompt_opened', {
      surface: analyticsSurface,
      trigger_source: 'banner',
      file_count: legacyItems.length,
      file_ids: legacyItems.map(row => row.id),
      open_after_conversion: false,
    })
  }, [legacyItems, posthog, analyticsSurface])

  const confirmMigration = useCallback(() => {
    if (!migrationDialog || migrationBusy) return
    const { ids, openFileId, triggerSource } = migrationDialog
    posthog.capture('legacy_conversion_started', {
      surface: analyticsSurface,
      trigger_source: triggerSource,
      file_count: ids.length,
      file_ids: ids,
      open_after_conversion: openFileId != null,
    })
    setMigrationBusy(true)
    void (async () => {
      try {
        for (const id of ids) {
          await idbMigrateLegacyDocument(id)
        }
        posthog.capture('legacy_conversion_completed', {
          surface: analyticsSurface,
          trigger_source: triggerSource,
          file_count: ids.length,
          file_ids: ids,
          open_after_conversion: openFileId != null,
          opened_file_id: openFileId ?? null,
        })
        setMigrationDialog(null)
        refreshList()
        if (openFileId) {
          void navigate({ to: '/create', search: { id: openFileId } })
        }
      } catch (err) {
        posthog.capture('legacy_conversion_failed', {
          surface: analyticsSurface,
          trigger_source: triggerSource,
          file_count: ids.length,
          file_ids: ids,
          open_after_conversion: openFileId != null,
        })
        posthog.captureException(err)
        setImportError('Those files could not be converted right now. Try again in a moment.')
      } finally {
        setMigrationBusy(false)
      }
    })()
  }, [migrationBusy, migrationDialog, navigate, posthog, refreshList, analyticsSurface])

  const openNewCanvas = useCallback(() => {
    posthog.capture('new_project_clicked', { surface: analyticsSurface })
    setNewCanvasOpen(true)
  }, [posthog, analyticsSurface])

  return (
    <main className="startup-screen relative flex min-h-[100dvh] overflow-hidden">
      {/* Background */}
      <div className="startup-screen-bg" aria-hidden="true">
        <div className="hero-bg-orb hero-bg-orb-a" />
        <div className="hero-bg-orb hero-bg-orb-b" />
        <div className="hero-grid" />
      </div>

      {/* Sidebar */}
      <aside
        className="relative z-[2] hidden w-[4.25rem] shrink-0 flex-col items-center border-r px-3 py-5 backdrop-blur-xl sm:flex"
        style={{
          borderColor: 'var(--sidebar-border)',
          backgroundColor: 'var(--sidebar-bg)',
        }}
      >
        <Link
          to="/"
          className="flex size-10 items-center justify-center rounded-xl transition-colors"
          style={{
            backgroundColor: 'var(--sidebar-active-bg)',
            color: 'var(--text)',
          }}
          aria-label="Home"
          title="Home"
        >
          <HugeiconsIcon icon={Home05Icon} size={18} strokeWidth={1.65} className="shrink-0" />
        </Link>

        <div
          className="my-4 h-px w-6"
          style={{ backgroundColor: 'var(--border)' }}
          aria-hidden="true"
        />
        {/* Spacer */}
        <div className="flex-1" />

        {/* Theme toggle in sidebar */}
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <svg
            className="icon-moon"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13.9 9.77a6 6 0 0 1-7.67-7.67A6 6 0 1 0 13.9 9.77Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <svg
            className="icon-sun"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="8"
              cy="8"
              r="3"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </aside>

      {/* Main content */}
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header
          className="startup-header shrink-0 border-b px-5 py-4 backdrop-blur-xl sm:px-8"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--header-bg)',
          }}
        >
          <div className="mx-auto flex w-full max-w-[88rem] items-center gap-4">
            <div className="min-w-0 flex-1">
              <Link to="/" className="inline-flex items-center gap-3 no-underline">
                <span className="startup-logo-mark" aria-hidden="true">
                  A
                </span>
                <span
                  className="display-title text-[1.35rem] font-medium tracking-[-0.03em] sm:text-[1.5rem]"
                  style={{ color: 'var(--text)' }}
                >
                  Avnac
                </span>
              </Link>
            </div>

            {/* Mobile theme toggle */}
            <button
              type="button"
              className="theme-toggle sm:hidden"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <svg
                className="icon-moon"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13.9 9.77a6 6 0 0 1-7.67-7.67A6 6 0 1 0 13.9 9.77Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <svg
                className="icon-sun"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {/* Actions */}
            <div ref={actionsRef} className="relative flex shrink-0">
              <button
                type="button"
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-l-full border-0 px-5 py-2 text-[14px] font-medium transition sm:min-h-11 sm:px-6 sm:py-2.5 sm:text-[15px]"
                style={{
                  backgroundColor: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                }}
                onMouseEnter={e =>
                  (e.currentTarget.style.backgroundColor = 'var(--btn-primary-hover)')
                }
                onMouseLeave={e =>
                  (e.currentTarget.style.backgroundColor = 'var(--btn-primary-bg)')
                }
                onClick={openNewCanvas}
              >
                Create new
              </button>
              <button
                type="button"
                aria-label="More actions"
                aria-expanded={actionsOpen}
                aria-haspopup="menu"
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-r-full border-0 px-3.5 py-2 text-[14px] font-medium transition sm:min-h-11 sm:px-4 sm:py-2.5 sm:text-[15px]"
                style={{
                  backgroundColor: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  borderLeft: '1px solid var(--duo-accent-muted)',
                }}
                onMouseEnter={e =>
                  (e.currentTarget.style.backgroundColor = 'var(--btn-primary-hover)')
                }
                onMouseLeave={e =>
                  (e.currentTarget.style.backgroundColor = 'var(--btn-primary-bg)')
                }
                onClick={() => setActionsOpen(open => !open)}
              >
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={18}
                  strokeWidth={1.85}
                  className="shrink-0"
                />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={onImportInputChange}
              />

              {actionsOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 min-w-[14rem] rounded-2xl border p-1.5"
                  style={{
                    borderColor: 'var(--menu-border)',
                    backgroundColor: 'var(--menu-bg)',
                    boxShadow: 'var(--menu-shadow)',
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[14px] font-medium transition-colors"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={e =>
                      (e.currentTarget.style.backgroundColor = 'var(--menu-item-hover)')
                    }
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <HugeiconsIcon
                      icon={CloudUploadIcon}
                      size={18}
                      strokeWidth={1.7}
                      className="shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    Import JSON
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {/* Content area */}
        <div
          className={`mx-auto w-full max-w-[88rem] flex-1 px-5 py-8 sm:px-8 sm:py-10 ${selectionCount > 0 ? 'pb-28 sm:pb-32' : ''}`}
        >
          <div className="rise-in">
            {/* Intro */}
            <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="startup-kicker mb-2">Welcome back</p>
                <h1
                  className="display-title text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.06] tracking-[-0.03em]"
                  style={{ color: 'var(--text)' }}
                >
                  Your projects
                </h1>
                <p
                  className="mt-3 max-w-2xl text-[15px] leading-relaxed sm:text-base"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Open a recent design or start something new. Everything autosaves in this browser.
                </p>
              </div>
              {projectCount > 0 ? (
                <div className="startup-count-chip shrink-0">
                  {projectCount} {projectCount === 1 ? 'project' : 'projects'}
                </div>
              ) : null}
            </div>

            {/* Errors */}
            {loadError ? (
              <p className="text-base leading-relaxed text-red-600 dark:text-red-400">
                {loadError}
              </p>
            ) : null}

            {importError ? (
              <p className="mt-4 text-base leading-relaxed text-red-600 dark:text-red-400">
                {importError}
              </p>
            ) : null}

            {/* Legacy banner */}
            {legacyCount > 0 ? (
              <div className="startup-legacy-banner mb-8">
                <div className="min-w-0">
                  <div
                    className="startup-kicker"
                    style={{ color: 'var(--banner-kicker)' }}
                  >
                    Old files found
                  </div>
                  <p
                    className="mt-2 max-w-2xl text-[15px] leading-relaxed sm:text-base"
                    style={{ color: 'var(--banner-text)' }}
                  >
                    {legacyCount === 1
                      ? 'There is 1 file from the older editor in this browser. Convert it once and it will open normally.'
                      : `There are ${legacyCount} files from the older editor. Convert them once and they will open normally.`}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border-0 px-6 py-2.5 text-[15px] font-medium transition sm:min-h-12"
                  style={{
                    backgroundColor: 'var(--btn-primary-bg)',
                    color: 'var(--btn-primary-text)',
                  }}
                  onMouseEnter={e =>
                    (e.currentTarget.style.backgroundColor = 'var(--btn-primary-hover)')
                  }
                  onMouseLeave={e =>
                    (e.currentTarget.style.backgroundColor = 'var(--btn-primary-bg)')
                  }
                  onClick={requestMigrateAll}
                >
                  {legacyCount === 1 ? 'Migrate old file' : 'Migrate all old files'}
                </button>
              </div>
            ) : null}

            {/* Grid */}
            {items === null ? (
              <div className="startup-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="startup-skeleton-card" aria-hidden="true" />
                ))}
              </div>
            ) : (
              <ul className="startup-grid m-0 list-none">
                <CreateNewGridCard onClick={openNewCanvas} />
                {items.map(row => (
                  <FileGridCard
                    key={row.id}
                    row={row}
                    formatUpdatedAt={formatUpdatedAt}
                    onListChange={refreshList}
                    selected={selectedIds.includes(row.id)}
                    onToggleSelect={toggleSelect}
                    onRequestDelete={requestDeleteFile}
                    onRequestOpen={requestOpenFile}
                  />
                ))}
              </ul>
            )}

            {/* Empty state */}
            {items !== null && items.length === 0 ? (
              <div
                className="mt-8 max-w-xl rounded-2xl border px-5 py-4 backdrop-blur-md"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--empty-bg)',
                }}
              >
                <p
                  className="m-0 text-[15px] leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No saved projects yet. Click{' '}
                  <strong className="font-medium" style={{ color: 'var(--text)' }}>
                    Create new
                  </strong>{' '}
                  to pick a canvas size and start designing.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <NewCanvasDialog open={newCanvasOpen} onClose={() => setNewCanvasOpen(false)} />
      <FilesMultiselectBar
        count={selectionCount}
        onClear={clearSelection}
        onDownload={bulkDownload}
        onTrash={bulkTrash}
      />
      <DeleteConfirmDialog
        open={deleteDialog !== null}
        title={deleteDialog?.title ?? ''}
        message={deleteDialog?.message ?? ''}
        onClose={() => setDeleteDialog(null)}
        onConfirm={confirmDelete}
      />
      <DocumentMigrationDialog
        open={migrationDialog !== null}
        title={migrationDialog?.title ?? ''}
        message={migrationDialog?.message ?? ''}
        confirmLabel={migrationDialog?.confirmLabel ?? 'Convert file'}
        busy={migrationBusy}
        onClose={() => {
          if (migrationBusy) return
          if (migrationDialog) {
            posthog.capture('legacy_conversion_cancelled', {
              surface: analyticsSurface,
              trigger_source: migrationDialog.triggerSource,
              file_count: migrationDialog.ids.length,
              file_ids: migrationDialog.ids,
              open_after_conversion: migrationDialog.openFileId != null,
            })
          }
          setMigrationDialog(null)
        }}
        onConfirm={confirmMigration}
      />
    </main>
  )
}