import { normalizeUrl } from './core/normalize.js'
import { groupByNormalizedUrl } from './core/dedupe.js'
import { createPlan } from './core/planner.js'
import { applyPlan, rollbackLastApply } from './core/apply.js'

async function getAllBookmarks() {
  const tree = await chrome.bookmarks.getTree()
  const list: any[] = []
  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[] = []) => {
    for (const n of nodes) {
      const p = [...path, n.title || '']
      if (n.url) { list.push({ id: n.id, title: n.title || '', url: n.url, path: p.join(' / ') }) }
      if (n.children) walk(n.children, p)
    }
  }
  for (const root of tree) walk(root.children || [])
  return list
}

async function head(url: string, timeoutMs = 6000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal })
    return { ok: true, status: res.status }
  } catch (e) {
    return { ok: false, error: String(e) }
  } finally {
    clearTimeout(t)
  }
}

async function scan() {
  const { opts } = await chrome.storage.local.get({ opts: { trackingParams: [], keepFragments: false } })
  const all = await getAllBookmarks()
  const withNorm = all.map(b => ({ ...b, norm: normalizeUrl(b.url, opts) }))
  const groups = groupByNormalizedUrl(withNorm)
  const duplicates = Object.values(groups).filter((arr: any[]) => arr.length > 1)

  const sample = all.slice(0, 5)
  const checks = await Promise.all(sample.map(b => head(b.url)))
  const deadSample = sample.filter((_, i) => !checks[i].ok || (checks[i].status >= 400))

  const result = {
    total: all.length,
    duplicatesCount: duplicates.reduce((acc: number, arr: any[]) => acc + (arr.length - 1), 0),
    duplicateBuckets: duplicates.slice(0, 10),
    deadSample: deadSample,
    ts: Date.now()
  }

  await chrome.storage.local.set({ lastScan: result })
  console.log('[Bookmarkz] Scan result', result)
  return result
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      const { opts } = await chrome.storage.local.get({ opts: { trackingParams: [], keepFragments: false } })
      if (msg?.type === 'SCAN') {
        const res = await scan()
        sendResponse({ ok: true, total: res.total, duplicates: res.duplicatesCount })
      } else if (msg?.type === 'PLAN') {
        const plan = await createPlan(opts)
        await chrome.storage.local.set({ lastPlan: plan })
        sendResponse({ ok: true, planStats: plan.stats })
      } else if (msg?.type === 'APPLY') {
        const { lastPlan } = await chrome.storage.local.get({ lastPlan: null })
        if (!lastPlan) throw new Error('No plan generated yet.')
        const onlyIds = msg.onlyIds as string[] | undefined
        const filtered = onlyIds ? { ...lastPlan, actions: lastPlan.actions.filter((a:any)=> onlyIds.includes(a.id)) } : lastPlan
        const log = await applyPlan(filtered, { dryRun: !!msg.dryRun })
        sendResponse({ ok: true, applied: log.count, dryRun: log.dryRun })
      } else if (msg?.type === 'ROLLBACK') {
        const r = await rollbackLastApply()
        sendResponse({ ok: r.ok, restored: r.restored })
      } else if (msg?.type === 'GET_STATUS') {
        const data = await chrome.storage.local.get({ lastScan: null, lastPlan: null, lastApplyLog: null })
        sendResponse({ ok: true, ...data })
      }
    } catch (e) {
      console.error(e)
      sendResponse({ ok: false, error: String(e) })
    }
  })()
  return true
})
