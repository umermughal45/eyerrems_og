export type LocationTreeNode = {
  id: string
  name: string
  type: string
  parentId: string | null
  propertyCount?: number
  children: LocationTreeNode[]
}

export type LocationSubtreePayload = {
  root: LocationTreeNode | null
  tree: LocationTreeNode[]
  propertyCount: number
}

export const LOCATION_LEVELS = ['country', 'state', 'city', 'area', 'phase', 'block', 'street', 'plot'] as const

export const formatLevelLabel = (type: string) => {
  if (!type) return ''
  return type
    .toString()
    .split(/[\s-_]/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

