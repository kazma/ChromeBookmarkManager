import { normalizeUrl, NormalizeOptions } from './normalize.js'
import { groupByNormalizedUrl } from './dedupe.js'
import type { Plan, PlanAction, BookmarkItem } from '../types.js'

function scoreForKeeper(item: BookmarkItem, opts: NormalizeOptions): number[] {
  const pathLower = (item.path || '').toLowerCase()
  const folderPriority = (opts.keeper?.folderPriority || []).map(s => s.toLowerCase())
  const idx = folderPriority.findIndex(s => s && pathLower.includes(s))
  const folderRank = idx >= 0 ? idx : folderPriority.length + 1

  const depth = (item.path || '').split('/').length
  const shallowScore = opts.keeper?.preferShallow ? depth : 0

  const dateAdded = item.dateAdded || 0
  const olderScore = opts.keeper?.preferOlder ? (dateAdded) : 0

  return [folderRank, shallowScore, olderScore, Number(item.id)]
}

export async function getAllBookmarks(): Promise<BookmarkItem[]> {
  const tree = await chrome.bookmarks.getTree()
  const list: BookmarkItem[] = []
  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[] = []) => {
    for (const n of nodes) {
      const p = [...path, n.title || '']
      if (n.url) {
        list.push({ id: n.id, title: n.title || '', url: n.url, path: p.join(' / '), dateAdded: n.dateAdded })
      }
      if (n.children) walk(n.children, p)
    }
  }
  for (const root of tree) walk(root.children || [])
  return list
}

export async function createPlan(opts: NormalizeOptions): Promise<Plan> {
  const all = await getAllBookmarks()
  const withNorm = all.map(b => ({ ...b, norm: normalizeUrl(b.url, opts) }))
  const groups = groupByNormalizedUrl(withNorm)

  const dupBuckets = Object.values(groups).filter(arr => arr.length > 1)
  const actions: PlanAction[] = []

  for (const bucket of dupBuckets) {
    const sorted = bucket.slice().sort((a,b) => {
      const sa = scoreForKeeper(a, opts).join(':')
      const sb = scoreForKeeper(b, opts).join(':')
      return sa < sb ? -1 : sa > sb ? 1 : 0
    })
    const [keeper, ...dups] = sorted
    for (const item of dups) {
      actions.push({ type: 'MOVE_TO_TRASH', id: item.id, title: item.title, url: item.url, path: item.path })
    }
  }

  const plan: Plan = {
    id: `plan_${Date.now()}`,
    createdAt: Date.now(),
    actions,
    stats: {
      total: all.length,
      duplicateBuckets: dupBuckets.length,
      duplicatesCount: dupBuckets.reduce((acc, arr) => acc + (arr.length - 1), 0)
    }
  }
  return plan
}
