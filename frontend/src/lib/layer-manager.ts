// Lightweight LayerManager: creates stacked canvases inside a container
// so we can incrementally move rendering to separate layers / workers.

export type LayerName = 'background' | 'objects' | 'effects' | 'ui' | 'overlay'

export const DEFAULT_LAYERS: LayerName[] = [
  'background',
  'objects',
  'effects',
  'ui',
  'overlay',
]

export interface Layer {
  name: LayerName
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D | null
  zIndex: number
}

export class LayerManager {
  private container: HTMLElement
  private dpr: number
  private layers: Map<LayerName, Layer> = new Map()

  constructor(container: HTMLElement, width: number, height: number, layers: LayerName[] = DEFAULT_LAYERS) {
    if (!container) throw new Error('LayerManager requires a container element')
    this.container = container
    const computed = getComputedStyle(this.container)
    if (computed.position === 'static') this.container.style.position = 'relative'
    this.dpr = Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
    for (let i = 0; i < layers.length; i += 1) {
      this.createLayer(layers[i], i + 1)
    }
    this.resize(width, height)
  }

  createLayer(name: LayerName, zIndex: number) {
    if (this.layers.has(name)) return this.layers.get(name)!
    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.left = '0'
    canvas.style.top = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = name === 'ui' ? 'auto' : 'none'
    canvas.style.zIndex = String(zIndex)
    canvas.dataset.layerName = name
    this.container.appendChild(canvas)
    const ctx = canvas.getContext('2d')
    const layer: Layer = { name, canvas, ctx, zIndex }
    this.layers.set(name, layer)
    return layer
  }

  getContext(name: LayerName) {
    return this.layers.get(name)?.ctx ?? null
  }

  resize(width: number, height: number) {
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    for (const [, layer] of this.layers) {
      const canvas = layer.canvas
      canvas.width = Math.max(1, Math.round(w * this.dpr))
      canvas.height = Math.max(1, Math.round(h * this.dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = layer.ctx
      if (ctx) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    }
  }

  clear(name?: LayerName) {
    if (name) {
      const layer = this.layers.get(name)
      if (!layer) return
      const ctx = layer.ctx
      if (!ctx) return
      ctx.clearRect(0, 0, layer.canvas.width / this.dpr, layer.canvas.height / this.dpr)
      return
    }
    for (const [, layer] of this.layers) {
      const ctx = layer.ctx
      if (ctx) ctx.clearRect(0, 0, layer.canvas.width / this.dpr, layer.canvas.height / this.dpr)
    }
  }

  destroy() {
    for (const [, layer] of this.layers) {
      if (layer.canvas.parentElement === this.container) this.container.removeChild(layer.canvas)
    }
    this.layers.clear()
  }
}

export function createLayerManager(container: HTMLElement, width: number, height: number, layers?: LayerName[]) {
  return new LayerManager(container, width, height, layers)
}
