export type ModelEntry = {
  id: string
  name: string
  description: string
  sizeMB: number
  quality: 'fast' | 'balanced' | 'best'
  url: string
  inputSize: [number, number]
  backend: 'webgpu' | 'wasm'
  supportsStrokes?: boolean
}

export const MODEL_REGISTRY: ModelEntry[] = [
  {
    id: 'briaai-rmbg-1.4',
    name: 'BRIA RMBG 1.4',
    description: 'General purpose, high quality.',
    sizeMB: 176,
    quality: 'best',
    url: 'https://huggingface.co/briaai/RMBG-1.4/resolve/main/model.onnx',
    inputSize: [1024, 1024],
    backend: 'webgpu',
  },
  {
    id: 'isnet-dis',
    name: 'IS-Net (DIS)',
    description: 'Dichotomous image segmentation for fine edges.',
    sizeMB: 178,
    quality: 'best',
    url: 'https://huggingface.co/isnet/DIS/resolve/main/model.onnx',
    inputSize: [1024, 1024],
    backend: 'webgpu',
  },
  {
    id: 'u2net',
    name: 'U2-Net',
    description: 'Lightweight classic. Fast, good for simple subjects.',
    sizeMB: 44,
    quality: 'fast',
    url: 'https://huggingface.co/u2net/u2net/resolve/main/u2net.onnx',
    inputSize: [320, 320],
    backend: 'wasm',
  },
  {
    id: 'u2net-portrait',
    name: 'U2-Net Portrait',
    description: 'Fine-tuned for human portraits and hair.',
    sizeMB: 44,
    quality: 'balanced',
    url: 'https://huggingface.co/u2net/u2net-portrait/resolve/main/model.onnx',
    inputSize: [512, 512],
    backend: 'wasm',
  },
  {
    id: 'modnet-portrait',
    name: 'MODNet (portrait)',
    description: 'Portrait matting with soft hair/transparency.',
    sizeMB: 25,
    quality: 'balanced',
    url: 'https://huggingface.co/modnet/portrait/resolve/main/model.onnx',
    inputSize: [512, 512],
    backend: 'wasm',
  },
  {
    id: 'birefnet',
    name: 'BiRefNet',
    description: 'State-of-the-art bilateral reference network.',
    sizeMB: 390,
    quality: 'best',
    url: 'https://huggingface.co/birefnet/birefnet/resolve/main/model.onnx',
    inputSize: [1024, 1024],
    backend: 'webgpu',
  },
]

export default MODEL_REGISTRY
