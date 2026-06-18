export function isGpuLayersEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = localStorage.getItem('avnac.gpuLayers')
    if (v === '0' || v === 'false') return false
    return true
  } catch (e) {
    return true
  }
}
