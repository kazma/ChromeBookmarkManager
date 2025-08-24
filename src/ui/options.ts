type Opts = {
  trackingParams: string[]
  keepFragments: boolean
  keeper: {
    folderPriority: string[]
    preferShallow: boolean
    preferOlder: boolean
  }
}
const defaults: Opts = {
  trackingParams: ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','igshid'],
  keepFragments: false,
  keeper: { folderPriority: ['Bookmarks Bar','Other Bookmarks','Mobile'], preferShallow: true, preferOlder: false }
}
const trackingParamsEl = document.getElementById('trackingParams') as HTMLTextAreaElement
const keepFragmentsEl = document.getElementById('keepFragments') as HTMLSelectElement
const keeperFolderPriorityEl = document.getElementById('keeperFolderPriority') as HTMLTextAreaElement
const keeperPreferShallowEl = document.getElementById('keeperPreferShallow') as HTMLInputElement
const keeperPreferOlderEl = document.getElementById('keeperPreferOlder') as HTMLInputElement
const msgEl = document.getElementById('msg') as HTMLSpanElement
async function load() {
  const { opts } = await chrome.storage.local.get({ opts: defaults })
  const o: Opts = Object.assign({}, defaults, opts, { keeper: Object.assign({}, defaults.keeper, opts?.keeper || {}) })
  trackingParamsEl.value = (o.trackingParams || defaults.trackingParams).join(',')
  keepFragmentsEl.value = String(o.keepFragments ?? defaults.keepFragments)
  keeperFolderPriorityEl.value = (o.keeper.folderPriority || defaults.keeper.folderPriority).join(', ')
  keeperPreferShallowEl.checked = !!o.keeper.preferShallow
  keeperPreferOlderEl.checked = !!o.keeper.preferOlder
}
async function save() {
  const trackingParams = trackingParamsEl.value.split(',').map(s => s.trim()).filter(Boolean)
  const keepFragments = keepFragmentsEl.value === 'true'
  const folderPriority = keeperFolderPriorityEl.value.split(',').map(s => s.trim()).filter(Boolean)
  const preferShallow = keeperPreferShallowEl.checked
  const preferOlder = keeperPreferOlderEl.checked
  await chrome.storage.local.set({ opts: { trackingParams, keepFragments, keeper: { folderPriority, preferShallow, preferOlder } } })
  msgEl.textContent = 'Saved.'; setTimeout(() => msgEl.textContent = '', 1200)
}
document.getElementById('saveBtn')!.addEventListener('click', save); load()
