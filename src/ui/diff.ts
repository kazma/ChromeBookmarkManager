const tbody = document.getElementById('tbody') as HTMLTableSectionElement
const msg = document.getElementById('msg') as HTMLSpanElement
type PlanAction = { type: string, id: string, title?: string, url?: string, path?: string }

function rowForAction(a: PlanAction) {
  const tr = document.createElement('tr')
  const td0 = document.createElement('td')
  const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=true; cb.dataset['id']=a.id; td0.appendChild(cb)
  const td1 = document.createElement('td'); td1.textContent = a.type
  const td2 = document.createElement('td'); td2.textContent = a.title || ''
  const td3 = document.createElement('td'); td3.textContent = a.url || ''
  const td4 = document.createElement('td'); td4.textContent = a.path || ''
  tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4)
  return tr
}
async function load() {
  const { lastPlan } = await chrome.storage.local.get({ lastPlan: null })
  if (!lastPlan) { msg.textContent = 'No plan. Open Popup → Plan first.'; return }
  tbody.innerHTML = ''
  for (const a of lastPlan.actions as PlanAction[]) tbody.appendChild(rowForAction(a))
}
document.getElementById('selectAll')!.addEventListener('click', ()=> tbody.querySelectorAll('input[type="checkbox"]').forEach((el:any)=> el.checked=true))
document.getElementById('selectNone')!.addEventListener('click', ()=> tbody.querySelectorAll('input[type="checkbox"]').forEach((el:any)=> el.checked=false))
document.getElementById('applySelected')!.addEventListener('click', async ()=> {
  const ids = Array.from(tbody.querySelectorAll('input[type="checkbox"]')).filter((el:any)=> el.checked).map((el:any)=> el.dataset['id'])
  if (ids.length===0){ msg.textContent='No selection.'; return }
  msg.textContent='Applying...'
  const res = await chrome.runtime.sendMessage({ type: 'APPLY', dryRun: false, onlyIds: ids })
  msg.textContent = res?.ok ? `Applied ${res.applied}` : 'Apply failed'
})
load()
