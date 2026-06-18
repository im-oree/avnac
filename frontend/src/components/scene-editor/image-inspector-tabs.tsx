// image-inspector-tabs.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import MODEL_REGISTRY from '../../lib/modelRegistry'
import modelStore from '../../lib/modelStore'
import CheckerboardPreview from './checkerboard-preview'
import { Button } from '../ui'
import type { SceneImage } from '../../lib/avnac-scene'

type SubTab = 'remove' | 'mask'

function formatSizeMB(n: number) {
  return `${(n ?? 0).toFixed(0)} MB`
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = e => reject(e)
    img.src = src
  })
}

async function extractCropImageData(
  imgSrc: string,
  crop: { x: number; y: number; width: number; height: number },
) {
  const img = await loadImageElement(imgSrc)
  const canvas = document.createElement('canvas')
  const w = Math.max(1, Math.round(crop.width))
  const h = Math.max(1, Math.round(crop.height))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  try {
    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } catch {
    ctx.drawImage(img, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  }
}

// ─── Model card ───────────────────────────────────────────────────────────────

function ModelCard({
  model,
  isSelected,
  isCached,
  progress,
  error,
  onSelect,
  onDownload,
  onUpload,
  stats,
  onPause,
  onResume,
  onCancel,
}: {
  model: (typeof MODEL_REGISTRY)[number]
  isSelected: boolean
  isCached: boolean
  progress: number | null
  error: string | null
  onSelect: () => void
  onDownload: () => void
  onUpload: () => void
  stats?: { downloaded: number; total?: number; percent: number; speed: number; running: boolean; paused: boolean }
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
}) {
  const isDownloading = (stats && (stats.running || stats.paused)) || (progress !== null && progress < 100)

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        isSelected
          ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5'
          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[0.8125rem] font-semibold text-[var(--text)]">
              {model.name}
            </span>
            <span
              className={`rounded-full px-1.5 py-px text-[0.5625rem] font-semibold uppercase tracking-wider ${
                model.quality === 'best'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : model.quality === 'balanced'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-gray-500/10 text-gray-500'
              }`}
            >
              {model.quality}
            </span>
          </div>
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
            {model.description}
          </p>
          <p className="mt-1 text-[0.625rem] font-medium text-[var(--text-subtle)]">
            {formatSizeMB(model.sizeMB)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {isCached ? (
            <button
              type="button"
              onClick={onSelect}
              className={`rounded-lg px-3 py-1.5 text-[0.6875rem] font-semibold transition ${
                isSelected
                  ? 'bg-[var(--accent)] text-white'
                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
              }`}
            >
              {isSelected ? '✓ Selected' : 'Select'}
            </button>
          ) : isDownloading ? (
            <div className="grid gap-1 text-right min-w-[12rem]">
              <div className="text-[0.6875rem] font-medium tabular-nums text-[var(--text-muted)]">
                {stats ? `${stats.percent}%` : progress ? `${progress}%` : '0%'}
              </div>
              <div className="h-2 w-44 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200"
                  style={{ width: `${stats ? stats.percent : progress ?? 0}%` }}
                />
              </div>
              {stats ? (
                <div className="text-[0.6875rem] text-[var(--text-muted)]">
                  {`${(stats.downloaded / (1024 * 1024)).toFixed(2)} / ${(stats.total ? (stats.total / (1024 * 1024)).toFixed(2) : (model.sizeMB || 0).toFixed(2))} MB`} • {`${(stats.speed / (1024 * 1024)).toFixed(2)} MB/s`}
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-2">
                {stats && stats.running ? (
                  <button type="button" onClick={onPause} className="text-[0.6875rem] rounded px-2 py-1 bg-[var(--surface)] border border-[var(--border)]">Pause</button>
                ) : stats && stats.paused ? (
                  <button type="button" onClick={onResume} className="text-[0.6875rem] rounded px-2 py-1 bg-[var(--surface)] border border-[var(--border)]">Resume</button>
                ) : null}
                <button type="button" onClick={onCancel} className="text-[0.6875rem] rounded px-2 py-1 bg-[var(--surface)] border border-[var(--border)]">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onDownload}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                Download
              </button>
              <button
                type="button"
                onClick={onUpload}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--text-muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                Upload
              </button>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <p className="mt-2 rounded-md bg-red-500/8 px-2 py-1 text-[0.6875rem] text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-[var(--border)]/60 px-4 py-3">
      <h4 className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
        {title}
      </h4>
      {children}
    </div>
  )
}

// ─── Main tabs component ─────────────────────────────────────────────────────

export default function ImageInspectorTabs({
  selectedImage,
  updateSelected,
  hidePreview = false,
}: {
  selectedImage: SceneImage
  updateSelected: (fn: (o: SceneImage) => SceneImage) => void
  hidePreview?: boolean
}) {
  const [tab, setTab] = useState<SubTab>('remove')
  const [selectedModelId, setSelectedModelId] = useState<string | null>(MODEL_REGISTRY[0]?.id ?? null)
  const [cachedModels, setCachedModels] = useState<Record<string, { size: number; downloadedAt: number }>>({})
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({})
  const [running, setRunning] = useState(false)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string | null>>({})
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadTargetRef = useRef<string | null>(null)
  const sessionsRef = useRef<Record<string, any>>({})
  const [downloadStats, setDownloadStats] = useState<Record<string, { downloaded: number; total?: number; percent: number; speed: number; running: boolean; paused: boolean }>>({})

  // Mask brush state
  const [brushSize, setBrushSize] = useState(32)
  const [brushMode, setBrushMode] = useState<'add' | 'subtract'>('add')

  // Load cached models on mount
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const rows = await modelStore.list()
      if (!mounted) return
      const map: Record<string, { size: number; downloadedAt: number }> = {}
      for (const r of rows) map[r.id] = { size: r.size, downloadedAt: r.downloadedAt }
      setCachedModels(map)
    })()
    return () => {
      mounted = false
    }
  }, [])

  const modelCards = useMemo(
    () => MODEL_REGISTRY.map(m => ({ ...m, ready: Boolean(cachedModels[m.id]) })),
    [cachedModels],
  )

  // --- Chunked download with pause/resume and stats ---
  function formatMB(bytes: number) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  async function checkQuota(sizeBytes: number) {
    try {
      if ((navigator as any).storage && typeof (navigator as any).storage.estimate === 'function') {
        const { quota, usage } = await (navigator as any).storage.estimate()
        if (typeof quota === 'number' && typeof usage === 'number') {
          const free = Math.max(0, quota - usage)
          return { ok: free >= sizeBytes, free, quota, usage }
        }
      }
    } catch (err) {
      // ignore
    }
    return { ok: true }
  }

  async function startDownload(modelId: string, url: string) {
    if (cachedModels[modelId]) return

    const entry = MODEL_REGISTRY.find(m => m.id === modelId)
    const expectedBytes = entry ? Math.round((entry.sizeMB || 0) * 1024 * 1024) : undefined
    if (expectedBytes) {
      const q = await checkQuota(expectedBytes)
      if (!q.ok) {
        setDownloadErrors(d => ({ ...d, [modelId]: `Not enough storage (need ${formatMB(expectedBytes)}, free ${formatMB(q.free || 0)})` }))
        return
      }
    }

    const sessions = sessionsRef.current
    if (!sessions[modelId]) sessions[modelId] = { chunks: [], received: 0, total: expectedBytes ?? undefined, paused: false }
    const session = sessions[modelId]
    session.paused = false

    const rangeStart = session.received || 0
    const headers: Record<string, string> = {}
    if (rangeStart > 0) headers['Range'] = `bytes=${rangeStart}-`

    const controller = new AbortController()
    session.controller = controller
    setDownloadStats(s => ({ ...s, [modelId]: { downloaded: session.received, total: session.total, percent: session.total ? Math.round((session.received / session.total) * 100) : 0, speed: 0, running: true, paused: false } }))

    try {
      const res = await fetch(url, { headers, signal: controller.signal, mode: 'cors', credentials: 'omit' })
      if (res.status === 401) {
        setDownloadErrors(d => ({ ...d, [modelId]: `Download failed 401 (unauthorized). Use Upload or check the model URL.` }))
        setDownloadStats(s => ({ ...s, [modelId]: { ...(s[modelId] ?? {}), running: false } }))
        session.controller = undefined
        return
      }

      let total = session.total
      const contentRange = res.headers.get('Content-Range')
      if (contentRange) {
        const m = contentRange.match(/\/(\d+)$/)
        if (m) total = Number(m[1])
      }
      if (!total) {
        const cl = Number(res.headers.get('Content-Length'))
        if (cl) total = (rangeStart || 0) + cl
      }
      session.total = total

      if (rangeStart > 0 && res.status === 200) {
        // server ignored Range — restart
        session.chunks = []
        session.received = 0
      }

      const reader = (res.body as any)?.getReader()
      const startTime = Date.now()
      let lastTime = startTime
      let lastBytes = session.received

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          session.chunks.push(value)
          session.received += value.byteLength
          const now = Date.now()
          const elapsed = (now - lastTime) / 1000 || 0.001
          const delta = session.received - lastBytes
          const speed = Math.round(delta / elapsed)
          lastTime = now
          lastBytes = session.received
          const percent = session.total ? Math.round((session.received / session.total) * 100) : 0
          setDownloadStats(s => ({ ...s, [modelId]: { downloaded: session.received, total: session.total, percent, speed, running: true, paused: false } }))
        }
      }

      const finalTotal = session.total ?? session.received
      const out = new Uint8Array(finalTotal)
      let off = 0
      for (const c of session.chunks) {
        out.set(c, off)
        off += c.byteLength
      }
      await modelStore.put(modelId, out.buffer)
      setCachedModels(s => ({ ...s, [modelId]: { size: out.byteLength, downloadedAt: Date.now() } }))
      setDownloadStats(s => ({ ...s, [modelId]: { downloaded: out.byteLength, total: out.byteLength, percent: 100, speed: 0, running: false, paused: false } }))
      setDownloadErrors(d => ({ ...d, [modelId]: null }))
      delete sessions[modelId]
    } catch (err: any) {
      const msg = err?.name === 'AbortError' ? 'paused' : err?.message ?? String(err)
      const sess = sessionsRef.current[modelId]
      if (sess) sess.paused = true
      setDownloadStats(s => ({ ...s, [modelId]: { ...(s[modelId] ?? {}), running: false, paused: true } }))
      setDownloadErrors(d => ({ ...d, [modelId]: msg }))
    }
  }

  function pauseDownload(modelId: string) {
    const s = sessionsRef.current[modelId]
    if (!s || !s.controller) return
    try { s.controller.abort() } catch {}
    s.paused = true
    setDownloadStats(st => ({ ...st, [modelId]: { ...(st[modelId] ?? {}), running: false, paused: true } }))
  }

  function resumeDownload(modelId: string, url: string) {
    const s = sessionsRef.current[modelId]
    if (!s) return void startDownload(modelId, url)
    if (!s.paused) return
    void startDownload(modelId, url)
  }

  function cancelDownload(modelId: string) {
    const s = sessionsRef.current[modelId]
    if (s?.controller) try { s.controller.abort() } catch {}
    delete sessionsRef.current[modelId]
    setDownloadStats(st => { const copy = { ...st }; delete copy[modelId]; return copy })
    setDownloadProgress(p => ({ ...p, [modelId]: 0 }))
    setDownloadErrors(d => ({ ...d, [modelId]: null }))
  }

  // Convenience wrapper kept for compatibility
  function downloadModel(modelId: string, url: string) {
    void startDownload(modelId, url)
  }

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const id = uploadTargetRef.current ?? file.name
    try {
      const ab = await file.arrayBuffer()
      await modelStore.put(id, ab)
      setCachedModels(s => ({ ...s, [id]: { size: ab.byteLength, downloadedAt: Date.now() } }))
      setDownloadErrors(d => ({ ...d, [id]: null }))
    } catch (err) {
      setDownloadErrors(d => ({ ...d, [id]: String(err) }))
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      uploadTargetRef.current = null
    }
  }

  async function runModel() {
    if (!selectedModelId) return
    setRunning(true)
    setProgressMsg('Preparing…')
    try {
      const modelBuf = await modelStore.get(selectedModelId)
      if (!modelBuf) {
        setProgressMsg('Model not downloaded')
        setRunning(false)
        return
      }
      setProgressMsg('Extracting image…')
      const id = await extractCropImageData(selectedImage.src, selectedImage.crop)

      setProgressMsg('Starting inference…')
      const worker = new Worker('/workers/maskWorker.js')
      worker.onmessage = e => {
        const m = e.data
        if (!m?.type) return
        if (m.type === 'PROGRESS') setProgressMsg(`Running… ${m.percent}%`)
        if (m.type === 'MASK_RESULT') {
          const mask = m.maskData as Uint8Array
          updateSelected(obj => ({
            ...obj,
            alphaMask: new Uint8Array(mask),
            maskMeta: { ...(obj.maskMeta ?? {}), source: 'auto' },
          }))
          setProgressMsg(null)
          setRunning(false)
          worker.terminate()
        }
      }
      worker.onerror = () => {
        setProgressMsg('Worker error')
        setRunning(false)
      }
      worker.postMessage(
        {
          type: 'RUN_MODEL',
          modelBuffer: modelBuf,
          modelId: selectedModelId,
          imageData: { data: id.data.buffer, width: id.width, height: id.height },
          inputSize: MODEL_REGISTRY.find(m => m.id === selectedModelId)?.inputSize,
          width: selectedImage.width,
          height: selectedImage.height,
        },
        [modelBuf, id.data.buffer],
      )
    } catch (e) {
      console.error(e)
      setProgressMsg('Failed')
      setRunning(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-[var(--border)]">
        {(
          [
            { id: 'remove', label: 'Remove Background' },
            { id: 'mask', label: 'Mask Editor' },
          ] as const
        ).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative flex-1 px-4 py-2.5 text-[0.75rem] font-semibold transition ${
              tab === t.id
                ? 'text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-[var(--text)]" />
            )}
          </button>
        ))}
      </div>

      {/* Preview — only when not in modal with separate viewer */}
      {!hidePreview && (
        <div className="border-b border-[var(--border)] p-3">
          <CheckerboardPreview
            src={selectedImage.src}
            width={selectedImage.crop.width}
            height={selectedImage.crop.height}
            alphaMask={selectedImage.alphaMask ?? null}
            maskMeta={selectedImage.maskMeta ?? undefined}
          />
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'remove' ? (
          <>
            {/* Model selection */}
            <Section title="Model">
              <div className="grid gap-2">
                {modelCards.map(m => (
                  <ModelCard
                    key={m.id}
                    model={m}
                    isSelected={selectedModelId === m.id}
                    isCached={m.ready}
                    progress={
                      downloadProgress[m.id] !== undefined && downloadProgress[m.id] < 100
                        ? downloadProgress[m.id]
                        : null
                    }
                    error={downloadErrors[m.id] ?? null}
                    onSelect={() => setSelectedModelId(m.id)}
                    onDownload={() => downloadModel(m.id, m.url)}
                    onUpload={() => {
                      uploadTargetRef.current = m.id
                      fileInputRef.current?.click()
                    }}
                    stats={downloadStats[m.id]}
                    onPause={() => pauseDownload(m.id)}
                    onResume={() => resumeDownload(m.id, m.url)}
                    onCancel={() => cancelDownload(m.id)}
                  />
                ))}
              </div>
            </Section>

            {/* Run */}
            <Section title="Process">
              <div className="grid gap-2.5">
                <Button
                  onClick={runModel}
                  disabled={running || !selectedModelId || !cachedModels[selectedModelId!]}
                >
                  {running ? (progressMsg ?? 'Running…') : 'Remove Background'}
                </Button>

                {!cachedModels[selectedModelId!] && selectedModelId && (
                  <p className="text-[0.6875rem] text-amber-600">
                    Download the model first before running.
                  </p>
                )}

                {progressMsg && running && (
                  <div className="flex items-center gap-2">
                    <div className="size-3 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text)]" />
                    <span className="text-[0.6875rem] text-[var(--text-muted)]">{progressMsg}</span>
                  </div>
                )}

                {selectedImage.alphaMask && (
                  <div className="flex items-center justify-between">
                    <span className="text-[0.6875rem] text-[var(--text-subtle)]">
                      Mask applied ({selectedImage.maskMeta?.source ?? 'unknown'})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSelected(obj => ({
                          ...obj,
                          alphaMask: undefined as any,
                          maskMeta: undefined as any,
                        }))
                      }
                      className="text-[0.6875rem] font-medium text-red-500 transition hover:text-red-600"
                    >
                      Clear mask
                    </button>
                  </div>
                )}
              </div>
            </Section>
          </>
        ) : (
          <>
            {/* Brush controls */}
            <Section title="Brush">
              <div className="grid gap-3">
                <div className="flex gap-1">
                  {(
                    [
                      { id: 'add', label: 'Add (reveal)' },
                      { id: 'subtract', label: 'Subtract (hide)' },
                    ] as const
                  ).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setBrushMode(m.id)}
                      className={`flex h-7 flex-1 items-center justify-center rounded-lg border text-[0.6875rem] font-semibold transition ${
                        brushMode === m.id
                          ? 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--hover)]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.6875rem] font-medium text-[var(--text-subtle)]">
                      Brush Size
                    </span>
                    <span className="text-[0.6875rem] font-medium tabular-nums text-[var(--text-muted)]">
                      {brushSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={800}
                    value={brushSize}
                    onChange={e => setBrushSize(Number(e.target.value))}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[var(--border)] outline-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[var(--border-strong)] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
                  />
                </div>
              </div>
            </Section>

            {/* Brush canvas */}
            <Section title="Paint Mask">
              <div className="grid gap-2">
                <p className="text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">
                  Paint on the canvas below to edit the mask. Changes save when you release.
                </p>
                <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                  <MaskBrushCanvas
                    selectedImage={selectedImage}
                    brushSize={brushSize}
                    brushMode={brushMode}
                    updateSelected={updateSelected}
                  />
                </div>
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".onnx"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  )
}

// ─── Mask brush canvas ────────────────────────────────────────────────────────

function MaskBrushCanvas({
  selectedImage,
  brushSize,
  brushMode,
  updateSelected,
}: {
  selectedImage: SceneImage
  brushSize: number
  brushMode: 'add' | 'subtract'
  updateSelected: (fn: (o: SceneImage) => SceneImage) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = Math.min(400, Math.round(selectedImage.crop.width))
    canvas.height = Math.min(400, Math.round(selectedImage.crop.height))

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Overlay mask as semi-transparent red
      if (selectedImage.alphaMask) {
        try {
          const maskCanvas = document.createElement('canvas')
          maskCanvas.width = selectedImage.crop.width
          maskCanvas.height = selectedImage.crop.height
          const mctx = maskCanvas.getContext('2d')!
          const id = mctx.createImageData(selectedImage.crop.width, selectedImage.crop.height)
          for (let i = 0; i < selectedImage.crop.width * selectedImage.crop.height; i++) {
            const a = selectedImage.alphaMask[i]
            const j = i * 4
            id.data[j] = 255
            id.data[j + 1] = 0
            id.data[j + 2] = 0
            id.data[j + 3] = 255 - a
          }
          mctx.putImageData(id, 0, 0)
          ctx.globalAlpha = 0.45
          ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height)
          ctx.globalAlpha = 1
        } catch {}
      }
    }
    img.src = selectedImage.src
  }, [selectedImage])

  const getCanvasPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const drawDab = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.save()
    ctx.globalCompositeOperation =
      brushMode === 'add' ? 'source-over' : 'destination-out'
    const scaleFactor = canvas.width / canvasRef.current!.getBoundingClientRect().width
    const rad = (brushSize / 2) * scaleFactor
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drawing.current = true
    const pos = getCanvasPos(e)
    drawDab(pos.x, pos.y)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const pos = getCanvasPos(e)
    drawDab(pos.x, pos.y)
  }

  const commitMask = () => {
    drawing.current = false
    try {
      const canvas = canvasRef.current!
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = selectedImage.crop.width
      maskCanvas.height = selectedImage.crop.height
      const mctx = maskCanvas.getContext('2d')!

      if (selectedImage.alphaMask) {
        const id = mctx.createImageData(selectedImage.crop.width, selectedImage.crop.height)
        for (let i = 0; i < selectedImage.crop.width * selectedImage.crop.height; i++) {
          const a = selectedImage.alphaMask[i]
          const j = i * 4
          id.data[j] = 255
          id.data[j + 1] = 255
          id.data[j + 2] = 255
          id.data[j + 3] = a
        }
        mctx.putImageData(id, 0, 0)
      } else {
        mctx.fillStyle = 'rgba(255,255,255,1)'
        mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
      }

      const prevCanvas = document.createElement('canvas')
      prevCanvas.width = canvas.width
      prevCanvas.height = canvas.height
      const pctx = prevCanvas.getContext('2d')!
      pctx.drawImage(canvas, 0, 0)

      mctx.globalCompositeOperation =
        brushMode === 'add' ? 'source-over' : 'destination-out'
      mctx.drawImage(prevCanvas, 0, 0, maskCanvas.width, maskCanvas.height)

      const final = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
      const out = new Uint8Array(maskCanvas.width * maskCanvas.height)
      for (let i = 0; i < out.length; i++) out[i] = final.data[i * 4 + 3]

      updateSelected(obj => ({
        ...obj,
        alphaMask: out,
        maskMeta: { ...(obj.maskMeta ?? {}), source: 'brush' },
      }))
    } catch (err) {
      console.error('Commit brush failed:', err)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={commitMask}
      onPointerCancel={commitMask}
      className="w-full"
      style={{ touchAction: 'none', cursor: 'crosshair', aspectRatio: `${selectedImage.crop.width} / ${selectedImage.crop.height}` }}
    />
  )
}