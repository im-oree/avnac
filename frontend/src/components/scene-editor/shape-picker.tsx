import React, { useEffect, useState } from 'react'
import { Button, Tabs, Text, Field, TextInput, Surface } from '../ui'
import { getCustomShapes, saveCustomShape, removeCustomShape, type CustomShape } from '../../lib/custom-shapes'

const BUILT_INS: { id: string; name: string; pathData: string }[] = [
  { id: 'rect', name: 'Rectangle', pathData: 'M 0 0 H 100 V 100 H 0 Z' },
  { id: 'circle', name: 'Circle', pathData: 'M50 0 A50 50 0 1 0 50.001 0 Z' },
  { id: 'triangle', name: 'Triangle', pathData: 'M50 0 L100 100 L0 100 Z' },
  { id: 'diamond', name: 'Diamond', pathData: 'M50 0 L100 50 L50 100 L0 50 Z' },
]

export default function ShapePicker({ onSelect }: { onSelect?: (pathData: string) => void }) {
  const [tab, setTab] = useState<'built' | 'mine'>('built')
  const [myShapes, setMyShapes] = useState<CustomShape[]>([])
  const [name, setName] = useState('')
  const [pathData, setPathData] = useState('')

  useEffect(() => {
    setMyShapes(getCustomShapes())
  }, [])

  function refresh() {
    setMyShapes(getCustomShapes())
  }

  function onSave() {
    if (!pathData.trim()) return
    saveCustomShape({ name: name || 'Shape', pathData: pathData.trim() })
    setName('')
    setPathData('')
    refresh()
  }

  function onRemove(id: string) {
    removeCustomShape(id)
    refresh()
  }

  function select(p: string) {
    if (onSelect) onSelect(p)
    try {
      navigator.clipboard?.writeText(p)
    } catch {
      // ignore
    }
    // minimal feedback via console
    // in a full integration this would activate stamp tool
    console.log('Selected shape path copied to clipboard')
  }

  return (
    <Surface padding="sm" radius="sm" className="max-w-sm">
      <Tabs
        items={[{ id: 'built', label: 'Built-in' }, { id: 'mine', label: 'My Shapes' }]}
        value={tab}
        onValueChange={v => setTab(v as any)}
      />
      <div className="grid gap-3 p-3">
        {tab === 'built' ? (
          <div className="grid grid-cols-4 gap-2">
            {BUILT_INS.map(s => (
              <button
                key={s.id}
                onClick={() => select(s.pathData)}
                aria-label={s.name}
                className="rounded border p-1 text-sm"
              >
                <svg viewBox="0 0 100 100" width="56" height="56">
                  <path d={s.pathData} fill="#262626" />
                </svg>
                <div className="text-xs mt-1">{s.name}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              {myShapes.map(s => (
                <div key={s.id} className="rounded border p-2">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 100 100" width="48" height="48">
                      <path d={s.pathData} fill="#262626" />
                    </svg>
                    <div className="flex-1">
                      <div className="text-sm">{s.name}</div>
                      <div className="text-xs text-neutral-500">{s.id}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="xs" onClick={() => select(s.pathData)}>Use</Button>
                    <Button size="xs" variant="ghost" onClick={() => onRemove(s.id)}>Delete</Button>
                  </div>
                </div>
              ))}
              {myShapes.length === 0 ? <div className="text-sm text-neutral-500">No custom shapes yet.</div> : null}
            </div>
            <div>
              <Text className="mb-1">Create / Paste</Text>
              <Field label="Name">
                <TextInput value={name} onChange={e => setName(e.target.value)} />
              </Field>
              <Field label="SVG path data">
                <TextInput value={pathData} onChange={e => setPathData(e.target.value)} />
              </Field>
              <div className="flex justify-end">
                <Button size="sm" onClick={onSave}>Save shape</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Surface>
  )
}
