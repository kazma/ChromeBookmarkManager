// src/ui/report.ts
async function load() {
  const { lastScan, lastPlan, lastApplyLog } = await chrome.storage.local.get({ lastScan: null, lastPlan: null, lastApplyLog: null });
  const meta = document.getElementById("meta");
  meta.textContent = `Apply status: ${lastApplyLog ? lastApplyLog.dryRun ? "Last apply was dry-run" : "Last apply was real apply" : "No apply yet"}`;
  document.getElementById("scan").textContent = lastScan ? JSON.stringify(lastScan, null, 2) : "N/A";
  document.getElementById("plan").textContent = lastPlan ? JSON.stringify(lastPlan, null, 2) : "N/A";
}
load();
//# sourceMappingURL=report.js.map
