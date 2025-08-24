export type NormalizeOptions = {
  trackingParams?: string[]
  keepFragments?: boolean
  keeper?: {
    folderPriority?: string[]
    preferShallow?: boolean
    preferOlder?: boolean
  }
}

export function normalizeUrl(raw: string, opts: NormalizeOptions = {}): string {
  try {
    const u = new URL(raw)
    u.protocol = u.protocol.toLowerCase()
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    const tp = new Set((opts.trackingParams || []).map(s => s.toLowerCase()))
    const kept: [string,string][] = []
    for (const [k, v] of u.searchParams.entries()) {
      if (!tp.has(k.toLowerCase())) kept.push([k, v])
    }
    u.search = ''
    for (const [k, v] of kept.sort((a,b) => a[0].localeCompare(b[0]))) {
      u.searchParams.append(k, v)
    }
    if (!opts.keepFragments) u.hash = ''
    if (!u.pathname) u.pathname = '/'
    if (!u.pathname.endsWith('/')) {
      if (!u.pathname.split('/').pop()?.includes('.')) {
        u.pathname += '/'
      }
    }
    return u.toString()
  } catch {
    return raw
  }
}
