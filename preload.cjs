const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getState: () => ipcRenderer.invoke("state:get"),
  addCasino: (name, weeklyLimit, monthlyLimit) =>
    ipcRenderer.invoke("casino:add", name, weeklyLimit, monthlyLimit),
  updateCasinoLimits: (id, weeklyLimit, monthlyLimit) =>
    ipcRenderer.invoke("casino:updateLimits", id, weeklyLimit, monthlyLimit),
  removeCasino: (id) => ipcRenderer.invoke("casino:remove", id),
  addEntry: (payload) => ipcRenderer.invoke("entry:add", payload),
  deleteEntry: (id) => ipcRenderer.invoke("entry:delete", id),
  setBudgets: (payload) => ipcRenderer.invoke("budgets:set", payload),
  setSettings: (payload) => ipcRenderer.invoke("settings:set", payload),
  clearAll: () => ipcRenderer.invoke("data:clear-all"),
  computeSummary: () => ipcRenderer.invoke("summary:compute"),
  saveCSV: (defaultName, contents) =>
    ipcRenderer.invoke("dialog:saveCSV", defaultName, contents),
  onExportCSV: (cb) => ipcRenderer.on("ui:exportCSV", cb),
});
