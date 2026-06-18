/* maskWorker.js
 * Runs ONNX inference and mask post-processing in a dedicated worker.
 * Expects messages of type:
 *  { type: 'RUN_MODEL', modelBuffer, imageData, width, height, inputSize }
 * Responds with:
 *  { type: 'PROGRESS', percent }
 *  { type: 'MASK_RESULT', maskData } where maskData is Uint8Array (transferable)
 */

self.sessionCache = self.sessionCache || new Map()

function sendProgress(p) {
  self.postMessage({ type: 'PROGRESS', percent: Math.max(0, Math.min(100, Math.round(p))) })
}

async function ensureOrt() {
  if (typeof self.ort !== 'undefined') return
  try {
    importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js')
  } catch (e) {
    // ignore — ort may not be available
  }
}

function floatToUint8ClampedFloatMask(data, w, h) {
  // data is Float32Array length w*h or [1,1,H,W]
  const out = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h && i < data.length; i++) {
    let v = data[i]
    if (!Number.isFinite(v)) v = 0
    out[i] = Math.max(0, Math.min(255, Math.round(v * 255)))
  }
  return out
}

function resizeMaskUsingOffscreen(srcData, srcW, srcH, dstW, dstH) {
  // srcData is Uint8ClampedArray gray values
  try {
    const srcCanvas = new OffscreenCanvas(srcW, srcH)
    const sctx = srcCanvas.getContext('2d')
    const img = sctx.createImageData(srcW, srcH)
    for (let i = 0; i < srcW * srcH; i++) {
      const a = srcData[i]
      const j = i * 4
      img.data[j] = 255
      img.data[j + 1] = 255
      img.data[j + 2] = 255
      img.data[j + 3] = a
    }
    sctx.putImageData(img, 0, 0)
    const dstCanvas = new OffscreenCanvas(dstW, dstH)
    const dctx = dstCanvas.getContext('2d')
    // Use bilinear scaling via drawImage
    dctx.drawImage(srcCanvas, 0, 0, dstW, dstH)
    const outImg = dctx.getImageData(0, 0, dstW, dstH)
    const out = new Uint8ClampedArray(dstW * dstH)
    for (let i = 0; i < dstW * dstH; i++) out[i] = outImg.data[i * 4 + 3]
    return out
  } catch (e) {
    // Fallback: nearest-neighbour resize
    const out = new Uint8ClampedArray(dstW * dstH)
    for (let y = 0; y < dstH; y++) {
      for (let x = 0; x < dstW; x++) {
        const sx = Math.floor((x / dstW) * srcW)
        const sy = Math.floor((y / dstH) * srcH)
        out[y * dstW + x] = srcData[sy * srcW + sx]
      }
    }
    return out
  }
}

self.onmessage = async function (ev) {
  const msg = ev.data
  if (!msg || !msg.type) return

  if (msg.type === 'RUN_MODEL') {
    const { modelBuffer, imageData, inputSize, width: origW, height: origH } = msg
    sendProgress(5)
    await ensureOrt()
    sendProgress(10)
    // Try to create or reuse session
    let session = null
    try {
      const id = msg.modelId || 'model'
      if (self.sessionCache.has(id)) {
        session = self.sessionCache.get(id)
      } else if (typeof ort !== 'undefined' && modelBuffer) {
        session = await ort.InferenceSession.create(modelBuffer, { executionProviders: ['webgpu', 'wasm'] })
        self.sessionCache.set(id, session)
      }
    } catch (e) {
      // session creation failed
      session = null
    }

    sendProgress(25)

    // imageData expected to be { data: Uint8ClampedArray, width, height }
    let inW = inputSize && inputSize[0] ? inputSize[0] : msg.inputW || 320
    let inH = inputSize && inputSize[1] ? inputSize[1] : msg.inputH || 320
    // Preprocess: normalize to Float32 CHW
    let floatInput = null
    try {
      const rgba = new Uint8ClampedArray(imageData.data)
      const w = imageData.width
      const h = imageData.height
      // Resize source to model input using OffscreenCanvas for speed
      let srcCanvas = new OffscreenCanvas(w, h)
      let sctx = srcCanvas.getContext('2d')
      const srcImg = sctx.createImageData(w, h)
      srcImg.data.set(rgba)
      sctx.putImageData(srcImg, 0, 0)
      if (w !== inW || h !== inH) {
        const tmp = new OffscreenCanvas(inW, inH)
        const tctx = tmp.getContext('2d')
        tctx.drawImage(srcCanvas, 0, 0, inW, inH)
        const resized = tctx.getImageData(0, 0, inW, inH)
        floatInput = new Float32Array(3 * inW * inH)
        // Normalize using ImageNet mean/std
        let idx = 0
        for (let c = 0; c < 3; c++) {
          for (let y = 0; y < inH; y++) {
            for (let x = 0; x < inW; x++) {
              const r = resized.data[(y * inW + x) * 4 + 0] / 255
              const g = resized.data[(y * inW + x) * 4 + 1] / 255
              const b = resized.data[(y * inW + x) * 4 + 2] / 255
              if (c === 0) floatInput[idx++] = (r - 0.485) / 0.229
              else if (c === 1) floatInput[idx++] = (g - 0.456) / 0.224
              else floatInput[idx++] = (b - 0.406) / 0.225
            }
          }
        }
      } else {
        const resized = { data: rgba, width: w, height: h }
        floatInput = new Float32Array(3 * inW * inH)
        let idx = 0
        for (let c = 0; c < 3; c++) {
          for (let y = 0; y < inH; y++) {
            for (let x = 0; x < inW; x++) {
              const r = resized.data[(y * inW + x) * 4 + 0] / 255
              const g = resized.data[(y * inW + x) * 4 + 1] / 255
              const b = resized.data[(y * inW + x) * 4 + 2] / 255
              if (c === 0) floatInput[idx++] = (r - 0.485) / 0.229
              else if (c === 1) floatInput[idx++] = (g - 0.456) / 0.224
              else floatInput[idx++] = (b - 0.406) / 0.225
            }
          }
        }
      }
    } catch (e) {
      // fallback: create fully opaque mask
      const fallback = new Uint8ClampedArray(origW * origH)
      fallback.fill(255)
      self.postMessage({ type: 'MASK_RESULT', maskData: fallback }, [fallback.buffer])
      return
    }

    sendProgress(45)

    let rawMask = null
    if (session && typeof ort !== 'undefined') {
      try {
        const tensor = new ort.Tensor('float32', floatInput, [1, 3, inH, inW])
        const feeds = {}
        // Attempt to find input name
        const inputName = session.inputNames && session.inputNames[0] ? session.inputNames[0] : 'input'
        feeds[inputName] = tensor
        const res = await session.run(feeds)
        // Take first output
        for (const k in res) {
          const out = res[k]
          rawMask = out.data
          break
        }
      } catch (e) {
        rawMask = null
      }
    }

    sendProgress(70)

    if (!rawMask) {
      // fallback: simple heuristic using alpha channel if present
      const rgba = new Uint8ClampedArray(imageData.data)
      const fallback = new Uint8ClampedArray(imageData.width * imageData.height)
      for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
          const a = rgba[(y * imageData.width + x) * 4 + 3]
          fallback[y * imageData.width + x] = a
        }
      }
      // Resize to original if needed
      const resized = resizeMaskUsingOffscreen(fallback, imageData.width, imageData.height, origW, origH)
      self.postMessage({ type: 'MASK_RESULT', maskData: new Uint8Array(resized.buffer) }, [resized.buffer])
      return
    }

    // rawMask often contains float values for [1,1,H,W] or H*W
    let floatArray = null
    if (rawMask instanceof Float32Array || ArrayBuffer.isView(rawMask)) {
      floatArray = rawMask
    } else if (rawMask.data && rawMask.data instanceof Float32Array) {
      floatArray = rawMask.data
    }

    if (!floatArray) {
      const fallback = new Uint8ClampedArray(origW * origH)
      fallback.fill(255)
      self.postMessage({ type: 'MASK_RESULT', maskData: fallback }, [fallback.buffer])
      return
    }

    // Determine output spatial dims. If shape available, try to infer
    const outLen = floatArray.length
    const maybeH = inH
    const maybeW = inW
    const floatMask = floatToUint8ClampedFloatMask(floatArray, maybeW, maybeH)
    const finalMask = resizeMaskUsingOffscreen(floatMask, maybeW, maybeH, origW, origH)

    sendProgress(95)
    // Transferable
    const outArr = new Uint8Array(finalMask.buffer)
    self.postMessage({ type: 'MASK_RESULT', maskData: outArr }, [outArr.buffer])
  }
}
