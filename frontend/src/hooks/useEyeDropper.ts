import { useCallback } from 'react'

export type PickResult = { sRGBHex: string } | null

export default function useEyeDropper() {
  const pick = useCallback(async (): Promise<PickResult> => {
    // Use native EyeDropper if available
    // @ts-ignore
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        // @ts-ignore
        const ed = new window.EyeDropper()
        // @ts-ignore
        const res = await ed.open()
        return res ?? null
      } catch (e) {
        return null
      }
    }

    // Fallback: wait for a user click and sample computed style color
    return await new Promise(resolve => {
      const onDown = (e: MouseEvent) => {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        if (!el) {
          cleanup();
          resolve(null)
          return
        }
        const style = getComputedStyle(el)
        // prefer background-color then color
        const col = style.backgroundColor !== 'transparent' && style.backgroundColor ? style.backgroundColor : style.color
        cleanup()
        // convert rgb(a) to hex
        const hex = rgbToHex(col || 'rgb(0,0,0)')
        resolve({ sRGBHex: hex })
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup()
          resolve(null)
        }
      }
      function cleanup() {
        document.removeEventListener('mousedown', onDown)
        document.removeEventListener('keydown', onKey)
      }
      document.addEventListener('mousedown', onDown)
      document.addEventListener('keydown', onKey)
    })
  }, [])

  return { pick }
}

function rgbToHex(rgb: string) {
  const m = /rgba?\(([^)]+)\)/.exec(rgb)
  if (!m) return '#000000'
  const parts = m[1].split(',').map(p => Number(p.trim()))
  const [r, g, b] = parts
  return ('#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join(''))
}
