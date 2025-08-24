// src/core/normalize.ts
function normalizeUrl(raw, opts = {}) {
  try {
    const u = new URL(raw);
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const tp = new Set((opts.trackingParams || []).map((s) => s.toLowerCase()));
    const kept = [];
    for (const [k, v] of u.searchParams.entries()) {
      if (!tp.has(k.toLowerCase())) kept.push([k, v]);
    }
    u.search = "";
    for (const [k, v] of kept.sort((a, b) => a[0].localeCompare(b[0]))) {
      u.searchParams.append(k, v);
    }
    if (!opts.keepFragments) u.hash = "";
    if (!u.pathname) u.pathname = "/";
    if (!u.pathname.endsWith("/")) {
      if (!u.pathname.split("/").pop()?.includes(".")) {
        u.pathname += "/";
      }
    }
    return u.toString();
  } catch {
    return raw;
  }
}

// src/core/dedupe.ts
function groupByNormalizedUrl(list) {
  const m = /* @__PURE__ */ new Map();
  for (const item of list) {
    const key = item.norm || "";
    const arr = m.get(key) || [];
    arr.push(item);
    m.set(key, arr);
  }
  return Object.fromEntries(m);
}

// src/core/planner.ts
function scoreForKeeper(item, opts) {
  const pathLower = (item.path || "").toLowerCase();
  const folderPriority = (opts.keeper?.folderPriority || []).map((s) => s.toLowerCase());
  const idx = folderPriority.findIndex((s) => s && pathLower.includes(s));
  const folderRank = idx >= 0 ? idx : folderPriority.length + 1;
  const depth = (item.path || "").split("/").length;
  const shallowScore = opts.keeper?.preferShallow ? depth : 0;
  const dateAdded = item.dateAdded || 0;
  const olderScore = opts.keeper?.preferOlder ? dateAdded : 0;
  return [folderRank, shallowScore, olderScore, Number(item.id)];
}
async function getAllBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  const list = [];
  const walk = (nodes, path = []) => {
    for (const n of nodes) {
      const p = [...path, n.title || ""];
      if (n.url) {
        list.push({ id: n.id, title: n.title || "", url: n.url, path: p.join(" / "), dateAdded: n.dateAdded });
      }
      if (n.children) walk(n.children, p);
    }
  };
  for (const root of tree) walk(root.children || []);
  return list;
}
async function createPlan(opts) {
  const all = await getAllBookmarks();
  const withNorm = all.map((b) => ({ ...b, norm: normalizeUrl(b.url, opts) }));
  const groups = groupByNormalizedUrl(withNorm);
  const dupBuckets = Object.values(groups).filter((arr) => arr.length > 1);
  const actions = [];
  for (const bucket of dupBuckets) {
    const sorted = bucket.slice().sort((a, b) => {
      const sa = scoreForKeeper(a, opts).join(":");
      const sb = scoreForKeeper(b, opts).join(":");
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
    const [keeper, ...dups] = sorted;
    for (const item of dups) {
      actions.push({ type: "MOVE_TO_TRASH", id: item.id, title: item.title, url: item.url, path: item.path });
    }
  }
  const plan = {
    id: `plan_${Date.now()}`,
    createdAt: Date.now(),
    actions,
    stats: {
      total: all.length,
      duplicateBuckets: dupBuckets.length,
      duplicatesCount: dupBuckets.reduce((acc, arr) => acc + (arr.length - 1), 0)
    }
  };
  return plan;
}

// src/core/trash.ts
async function ensureTrashRootFolder() {
  const tree = await chrome.bookmarks.getTree();
  const roots = tree[0]?.children || [];
  const parent = roots.find((n) => !n.url && (n.title === "Other Bookmarks" || n.id === "2")) || roots.find((n) => !n.url) || tree[0];
  const parentId = parent?.id || "1";
  const children = await chrome.bookmarks.getChildren(parentId);
  const existing = children.find((n) => !n.url && n.title === "Bookmarkz Trash");
  if (existing) return existing.id;
  const created = await chrome.bookmarks.create({ parentId, title: "Bookmarkz Trash" });
  return created.id;
}
async function ensureTrashSubfolder(ts) {
  const rootId = await ensureTrashRootFolder();
  const stamp = ts ? new Date(ts) : /* @__PURE__ */ new Date();
  const label = stamp.toISOString().replace(/[:.]/g, "-");
  const sub = await chrome.bookmarks.create({ parentId: rootId, title: label });
  return sub.id;
}

// src/core/apply.ts
async function getNode(id) {
  const nodes = await chrome.bookmarks.get(id);
  return nodes?.[0];
}
async function applyPlan(plan, { dryRun = true } = {}) {
  const ts = Date.now();
  const trashFolderId = await ensureTrashSubfolder(ts);
  const applied = [];
  for (const act of plan.actions) {
    if (act.type === "MOVE_TO_TRASH") {
      const node = await getNode(act.id);
      if (!node) continue;
      const parentId = node.parentId;
      const index = node.index ?? 0;
      const meta = { parentId, index };
      if (!dryRun) {
        await chrome.bookmarks.move(node.id, { parentId: trashFolderId });
      }
      applied.push({ action: act, meta });
    }
  }
  const log = {
    id: `apply_${ts}`,
    planId: plan.id,
    createdAt: ts,
    dryRun,
    trashFolderId,
    count: applied.length,
    applied
  };
  const { applyHistory = [] } = await chrome.storage.local.get({ applyHistory: [] });
  const newHist = [log, ...applyHistory].slice(0, 10);
  await chrome.storage.local.set({ lastApplyLog: log, applyHistory: newHist });
  return log;
}
async function rollbackLastApply() {
  const { lastApplyLog } = await chrome.storage.local.get({ lastApplyLog: null });
  if (!lastApplyLog) return { ok: false, restored: 0 };
  const log = lastApplyLog;
  if (log.dryRun) return { ok: false, restored: 0 };
  let restored = 0;
  for (let i = log.applied.length - 1; i >= 0; i--) {
    const item = log.applied[i];
    const id = item.action.id;
    const { parentId, index } = item.meta;
    try {
      await chrome.bookmarks.move(id, { parentId, index });
      restored++;
    } catch {
    }
  }
  return { ok: true, restored };
}

// src/background.ts
async function getAllBookmarks2() {
  const tree = await chrome.bookmarks.getTree();
  const list = [];
  const walk = (nodes, path = []) => {
    for (const n of nodes) {
      const p = [...path, n.title || ""];
      if (n.url) {
        list.push({ id: n.id, title: n.title || "", url: n.url, path: p.join(" / ") });
      }
      if (n.children) walk(n.children, p);
    }
  };
  for (const root of tree) walk(root.children || []);
  return list;
}
async function head(url, timeoutMs = 6e3) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  } finally {
    clearTimeout(t);
  }
}
async function scan() {
  const { opts } = await chrome.storage.local.get({ opts: { trackingParams: [], keepFragments: false } });
  const all = await getAllBookmarks2();
  const withNorm = all.map((b) => ({ ...b, norm: normalizeUrl(b.url, opts) }));
  const groups = groupByNormalizedUrl(withNorm);
  const duplicates = Object.values(groups).filter((arr) => arr.length > 1);
  const sample = all.slice(0, 5);
  const checks = await Promise.all(sample.map((b) => head(b.url)));
  const deadSample = sample.filter((_, i) => !checks[i].ok || checks[i].status >= 400);
  const result = {
    total: all.length,
    duplicatesCount: duplicates.reduce((acc, arr) => acc + (arr.length - 1), 0),
    duplicateBuckets: duplicates.slice(0, 10),
    deadSample,
    ts: Date.now()
  };
  await chrome.storage.local.set({ lastScan: result });
  console.log("[Bookmarkz] Scan result", result);
  return result;
}
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      const { opts } = await chrome.storage.local.get({ opts: { trackingParams: [], keepFragments: false } });
      if (msg?.type === "SCAN") {
        const res = await scan();
        sendResponse({ ok: true, total: res.total, duplicates: res.duplicatesCount });
      } else if (msg?.type === "PLAN") {
        const plan = await createPlan(opts);
        await chrome.storage.local.set({ lastPlan: plan });
        sendResponse({ ok: true, planStats: plan.stats });
      } else if (msg?.type === "APPLY") {
        const { lastPlan } = await chrome.storage.local.get({ lastPlan: null });
        if (!lastPlan) throw new Error("No plan generated yet.");
        const onlyIds = msg.onlyIds;
        const filtered = onlyIds ? { ...lastPlan, actions: lastPlan.actions.filter((a) => onlyIds.includes(a.id)) } : lastPlan;
        const log = await applyPlan(filtered, { dryRun: !!msg.dryRun });
        sendResponse({ ok: true, applied: log.count, dryRun: log.dryRun });
      } else if (msg?.type === "ROLLBACK") {
        const r = await rollbackLastApply();
        sendResponse({ ok: r.ok, restored: r.restored });
      } else if (msg?.type === "GET_STATUS") {
        const data = await chrome.storage.local.get({ lastScan: null, lastPlan: null, lastApplyLog: null });
        sendResponse({ ok: true, ...data });
      }
    } catch (e) {
      console.error(e);
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});
//# sourceMappingURL=background.js.map
