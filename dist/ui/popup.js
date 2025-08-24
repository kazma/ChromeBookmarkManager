// src/ui/popup.ts
var status = document.getElementById("status");
function set(msg, cls) {
  status.className = "stat " + (cls || "");
  status.textContent = msg;
}
async function call(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (!res?.ok) throw new Error(res?.error || "failed");
  return res;
}
document.getElementById("scanBtn").addEventListener("click", async () => {
  try {
    set("Scanning...");
    const res = await call("SCAN");
    set(`Done. total=${res.total}, duplicates=${res.duplicates}`, "ok");
  } catch {
    set("Scan failed", "warn");
  }
});
document.getElementById("planBtn").addEventListener("click", async () => {
  try {
    set("Planning...");
    const res = await call("PLAN");
    set(`Plan ready. dupBuckets=${res.planStats.duplicateBuckets}, dupCount=${res.planStats.duplicatesCount}`, "ok");
  } catch {
    set("Plan failed", "warn");
  }
});
document.getElementById("applyDryBtn").addEventListener("click", async () => {
  try {
    set("Applying (dry-run)...");
    const res = await call("APPLY", { dryRun: true });
    set(`Dry-run applied=${res.applied}`, "ok");
  } catch {
    set("Apply failed", "warn");
  }
});
document.getElementById("applyBtn").addEventListener("click", async () => {
  try {
    set("Applying...");
    const res = await call("APPLY", { dryRun: false });
    set(`Applied=${res.applied}`, "ok");
  } catch {
    set("Apply failed", "warn");
  }
});
document.getElementById("rollbackBtn").addEventListener("click", async () => {
  try {
    set("Rolling back...");
    const res = await call("ROLLBACK");
    if (res.ok) set(`Restored=${res.restored}`, "ok");
    else set("Nothing to rollback", "warn");
  } catch {
    set("Rollback failed", "warn");
  }
});
//# sourceMappingURL=popup.js.map
