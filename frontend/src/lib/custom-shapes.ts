export type CustomShape = {
  id: string
  name: string
  pathData: string
}

const KEY = 'customShapes'

function readRaw(): CustomShape[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p: any) => p && typeof p.pathData === 'string' && typeof p.id === 'string')
  } catch {
    return []
  }
}

export function getCustomShapes(): CustomShape[] {
  return readRaw()
}

export function saveCustomShape(shape: { name: string; pathData: string }): CustomShape {
  const list = readRaw()
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `cs-${Math.random().toString(36).slice(2)}`
  const next: CustomShape = { id, name: shape.name.trim() || `Shape ${list.length + 1}`, pathData: shape.pathData }
  list.push(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
  return next
}

export function removeCustomShape(id: string) {
  const list = readRaw().filter(s => s.id !== id)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function clearCustomShapes() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
