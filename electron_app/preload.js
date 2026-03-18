const { clipboard, contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronShell', {
  apiBaseUrl: process.env.THAI_COMIC_READER_API_BASE_URL || 'http://127.0.0.1:8000',
  appVersion: process.env.THAI_COMIC_READER_APP_VERSION || '0.0.0',
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  selectDocument: (type) => ipcRenderer.invoke('dialog:selectDocument', type),
  readLibrary: () => ipcRenderer.invoke('storage:readLibrary'),
  writeLibrary: (items) => ipcRenderer.invoke('storage:writeLibrary', items),
  writeClipboardText: (text) => clipboard.writeText(String(text || '')),
})
