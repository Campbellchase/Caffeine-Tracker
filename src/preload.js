'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The only surface the renderer can reach. It exposes named actions, not raw ipcRenderer.
contextBridge.exposeInMainWorld('caffeine', {
  getState: () => ipcRenderer.invoke('state:get'),
  addEntry: (input) => ipcRenderer.invoke('entry:add', input),
  deleteEntry: (id) => ipcRenderer.invoke('entry:delete', id),
  setDailyLimit: (mg) => ipcRenderer.invoke('settings:setDailyLimit', mg),
});
