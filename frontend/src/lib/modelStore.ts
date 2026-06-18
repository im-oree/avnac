const DB_NAME = 'avnac-models'
const DB_VERSION = 1
const STORE = 'models'

type ModelRow = {
  id: string
  buffer: ArrayBuffer
  size: number
  downloadedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
  })
}

export async function putModel(id: string, buffer: ArrayBuffer): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.onerror = () => reject(tx.error ?? new Error('idb write failed'))
      tx.oncomplete = () => resolve()
      tx.objectStore(STORE).put({ id, buffer, size: buffer.byteLength, downloadedAt: Date.now() } as ModelRow)
    })
  } finally {
    db.close()
  }
}

export async function getModel(id: string): Promise<ArrayBuffer | null> {
  const db = await openDb()
  try {
    return await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      tx.onerror = () => reject(tx.error ?? new Error('idb read failed'))
      const r = tx.objectStore(STORE).get(id)
      r.onerror = () => reject(r.error ?? new Error('idb get failed'))
      r.onsuccess = () => {
        const v = r.result as ModelRow | undefined
        resolve(v ? v.buffer : null)
      }
    })
  } finally {
    db.close()
  }
}

export async function deleteModel(id: string): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.onerror = () => reject(tx.error ?? new Error('idb delete failed'))
      tx.oncomplete = () => resolve()
      tx.objectStore(STORE).delete(id)
    })
  } finally {
    db.close()
  }
}

export async function listModels(): Promise<{ id: string; size: number; downloadedAt: number }[]> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      tx.onerror = () => reject(tx.error ?? new Error('idb list failed'))
      const r = tx.objectStore(STORE).getAll()
      r.onerror = () => reject(r.error ?? new Error('idb getAll failed'))
      r.onsuccess = () => {
        const rows = (r.result as ModelRow[])
        resolve(rows.map(r => ({ id: r.id, size: r.size, downloadedAt: r.downloadedAt })))
      }
    })
  } finally {
    db.close()
  }
}

export default {
  put: putModel,
  get: getModel,
  delete: deleteModel,
  list: listModels,
}
