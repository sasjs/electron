const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  setSasPath: (title) => ipcRenderer.send('set-sas-path', title)
})
