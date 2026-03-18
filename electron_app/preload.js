const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronShell', {
  apiBaseUrl: 'http://127.0.0.1:8000',
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  selectDocument: (type) => ipcRenderer.invoke('dialog:selectDocument', type),
  readLibrary: () => ipcRenderer.invoke('storage:readLibrary'),
  writeLibrary: (items) => ipcRenderer.invoke('storage:writeLibrary', items),
})
