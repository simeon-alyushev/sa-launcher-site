'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sa', {
  call: async (name, arg) => { const r = await ipcRenderer.invoke('sa:' + name, arg); if (!r.ok) throw new Error(r.error); return r.data; },
  on: cb => { const h = (_e, ch, d) => cb(ch, d); ipcRenderer.on('sa:event', h); return () => ipcRenderer.removeListener('sa:event', h); }
});
