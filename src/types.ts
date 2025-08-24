export type NormalizeOptions = {
  trackingParams?: string[]
  keepFragments?: boolean
  keeper?: {
    folderPriority?: string[]
    preferShallow?: boolean
    preferOlder?: boolean
  }
}

export type BookmarkItem = {
  id: string
  title: string
  url: string
  path: string
  norm?: string
  dateAdded?: number
}

export type MoveToTrash = { type: 'MOVE_TO_TRASH', id: string, title?: string, url?: string, path?: string }
export type PlanAction = MoveToTrash

export type Plan = {
  id: string
  createdAt: number
  actions: PlanAction[]
  stats: { total: number; duplicateBuckets: number; duplicatesCount: number }
}

export type AppliedItem = { action: PlanAction; meta: { parentId: string; index: number } }
export type ApplyLog = {
  id: string
  planId: string
  createdAt: number
  dryRun: boolean
  trashFolderId: string
  count: number
  applied: AppliedItem[]
}
