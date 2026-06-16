import { idbGetEditorRecord } from './avnac-editor-idb'

export function safeAvnacFileBaseName(name: string): string {
  const t = name.trim() || 'untitled'
  const s = t
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return s || 'untitled'
}

export async function downloadAvnacJsonForId(id: string): Promise<boolean> {
  const record = await idbGetEditorRecord(id)
  if (!record) return false
  const blob = new Blob([JSON.stringify(record.document, null, 2)], {
    type: 'application/json',
  })
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = `${safeAvnacFileBaseName(record.name ?? 'Untitled')}.lumio.json`
  a.click()
  URL.revokeObjectURL(u)
  return true
}
