// Ensure a 'Bookmarkz Trash' under an available root (heuristic)
export async function ensureTrashRootFolder(): Promise<string> {
  const tree = await chrome.bookmarks.getTree()
  const roots = tree[0]?.children || []
  const parent = roots.find(n => !n.url && (n.title === 'Other Bookmarks' || n.id === '2')) || roots.find(n => !n.url) || tree[0]
  const parentId = parent?.id || '1'
  const children = await chrome.bookmarks.getChildren(parentId)
  const existing = children.find(n => !n.url && n.title === 'Bookmarkz Trash')
  if (existing) return existing.id
  const created = await chrome.bookmarks.create({ parentId, title: 'Bookmarkz Trash' })
  return created.id
}

export async function ensureTrashSubfolder(ts?: number): Promise<string> {
  const rootId = await ensureTrashRootFolder()
  const stamp = ts ? new Date(ts) : new Date()
  const label = stamp.toISOString().replace(/[:.]/g,'-')
  const sub = await chrome.bookmarks.create({ parentId: rootId, title: label })
  return sub.id
}
