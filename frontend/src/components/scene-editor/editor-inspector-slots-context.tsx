import React, { createContext, useContext, useState, type ReactNode } from 'react'

export type InspectorSlots = {
  fillSlot?: React.ReactNode
  imageSlot?: React.ReactNode
  effectsSlot?: React.ReactNode
  textPathSlot?: React.ReactNode
}

type InspectorSlotsContextValue = {
  slots: InspectorSlots
  setSlots: (s: InspectorSlots | ((prev: InspectorSlots) => InspectorSlots)) => void
}

const EditorInspectorSlotsContext = createContext<InspectorSlotsContextValue | null>(null)

export function EditorInspectorSlotsProvider({ children }: { children: ReactNode }) {
  const [slots, setSlotsState] = useState<InspectorSlots>({
    fillSlot: null,
    imageSlot: null,
    effectsSlot: null,
    textPathSlot: null,
  })

  // Accept either a value or an updater so child components can patch one
  // slot at a time without stomping on the others.
  const setSlots = (s: InspectorSlots | ((prev: InspectorSlots) => InspectorSlots)) => {
    setSlotsState(prev => (typeof s === 'function' ? (s as any)(prev) : s))
  }

  return (
    <EditorInspectorSlotsContext.Provider value={{ slots, setSlots }}>
      {children}
    </EditorInspectorSlotsContext.Provider>
  )
}

export function useInspectorSlots() {
  const ctx = useContext(EditorInspectorSlotsContext)
  if (!ctx) throw new Error('useInspectorSlots must be used within EditorInspectorSlotsProvider')
  return ctx
}

export default EditorInspectorSlotsContext