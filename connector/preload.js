const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("connectorApi", {
  getState: () => ipcRenderer.invoke("connector:get-state"),
  saveSettings: (payload) => ipcRenderer.invoke("connector:save-settings", payload),
  closeWindow: () => ipcRenderer.invoke("connector:close-window"),
  quitApp: () => ipcRenderer.invoke("connector:quit-app"),
  openExternal: (url) => ipcRenderer.invoke("connector:open-external", url),
});
