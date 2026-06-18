// types.ts
import type { SceneObject } from '../../lib/avnac-scene'

export type ResizeHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const RESIZE_HANDLES: ResizeHandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export type TransformDimensionUi = {
  left: number
  top: number
  text: string
  mode?: 'move' | 'rotate' | 'scale'
  values?: { dx?: number; dy?: number; angle?: number; scaleX?: number; scaleY?: number }
  allowInput?: boolean
  inputValue?: string
  inputMode?: 'move' | 'rotate' | 'scale'
}

export type SceneBounds = {
  left: number
  top: number
  width: number
  height: number
}

export type MarqueeRect = {
  left: number
  top: number
  width: number
  height: number
}

export type LayerReorderKind = 'front' | 'back' | 'forward' | 'backward'
export type SceneSnapGuide = { axis: 'v' | 'h'; pos: number }

export type DragState =
  | {
      kind: 'move'
      ids: string[]
      startSceneX: number
      startSceneY: number
      initial: Map<string, { x: number; y: number }>
      initialBounds: SceneBounds | null
      snapTargets: SceneBounds[]
    }
  | {
      kind: 'resize'
      id: string
      handle: ResizeHandleId
      initial: SceneObject
      /** Scene-space pointer position when the drag started */
      startSceneX: number
      startSceneY: number
    }
  | {
      kind: 'rotate'
      id: string
      initialRotation: number
      center: { x: number; y: number }
      startAngle: number
    }
  | {
      kind: 'rotate-multi'
      ids: string[]
      initialRotations: Map<string, number>
      center: { x: number; y: number }
      startAngle: number
    }
  | {
      kind: 'scale'
      ids: string[]
      startSceneX: number
      startSceneY: number
      initialObjects: Map<string, SceneObject>
      initialBounds: SceneBounds | null
      handle?: ResizeHandleId
    }
  | {
      kind: 'marquee'
      startSceneX: number
      startSceneY: number
      additive: boolean
      initialSelection: string[]
      objects: SceneObject[]
    }
  | {
      kind: 'uv'
      id: string
      startSceneX: number
      startSceneY: number
      initialUv: {
        offsetX?: number
        offsetY?: number
        scaleX?: number
        scaleY?: number
        rotation?: number
        anchorX?: number
        anchorY?: number
      }
      initialObject: SceneObject
      mode?: 'move' | 'scale' | 'rotate'
    }