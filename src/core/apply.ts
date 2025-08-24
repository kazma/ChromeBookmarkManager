import type { ApplyLog, Plan } from '../types.js'
import { ensureTrashSubfolder } from './trash.js'

async function getNode(id: string) {
  const nodes = await chrome.bookmarks.get(id)
  return nodes?.[0]
}

export async function applyPlan(plan: Plan, { dryRun = true } = {}): Promise<ApplyLog> {
  const ts = Date.now()
  const trashFolderId = await ensureTrashSubfolder(ts)
  const applied: ApplyLog['applied'] = []

  for (const act of plan.actions) {
    if (act.type === 'MOVE_TO_TRASH') {
      const node = await getNode(act.id)
      if (!node) continue
      const parentId = node.parentId!
      const index = node.index ?? 0
      const meta = { parentId, index }
      if (!dryRun) { await chrome.bookmarks.move(node.id, { parentId: trashFolderId }) }
      applied.push({ action: act, meta })
    }
  }

  const log: ApplyLog = {
    id: `apply_${ts}`,
    planId: plan.id,
    createdAt: ts,
    dryRun,
    trashFolderId,
    count: applied.length,
    applied
  }
  const { applyHistory = [] } = await chrome.storage.local.get({ applyHistory: [] })
  const newHist = [log, ...applyHistory].slice(0, 10)
  await chrome.storage.local.set({ lastApplyLog: log, applyHistory: newHist })
  return log
}

export async function rollbackLastApply(): Promise<{ ok: boolean; restored: number }> {
  const { lastApplyLog } = await chrome.storage.local.get({ lastApplyLog: null })
  if (!lastApplyLog) return { ok: false, restored: 0 }
  const log: ApplyLog = lastApplyLog
  if (log.dryRun) return { ok: false, restored: 0 }
  let restored = 0
  for (let i = log.applied.length - 1; i >= 0; i--) {
    const item = log.applied[i]
    const id = (item.action as any).id as string
    const { parentId, index } = item.meta
    try { await chrome.bookmarks.move(id, { parentId, index }); restored++ } catch {}
  }
  return { ok: true, restored }
}
