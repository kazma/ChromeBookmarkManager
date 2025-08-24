export function groupByNormalizedUrl(list: Array<{ norm: string } & Record<string, any>>) {
  const m = new Map<string, any[]>()
  for (const item of list) {
    const key = item.norm || ''
    const arr = m.get(key) || []
    arr.push(item)
    m.set(key, arr)
  }
  return Object.fromEntries(m)
}
