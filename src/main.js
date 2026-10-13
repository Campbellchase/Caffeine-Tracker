'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { PRESETS, summarize, validateEntry, validateDailyLimit } = require('./core/caffeine');
const { loadData, saveData, addEntry, deleteEntry, setDailyLimit } = require('./core/store');

const DATA_FILE_NAME = 'caffeine-data.json';

let data = null;

function dataFilePath() {
  return path.join(app.getPath('userData'), DATA_FILE_NAME);
}

function persist() {
  saveData(dataFilePath(), data);
}

function currentState() {
  return { ...summarize(data.entries, data.settings), presets: PRESETS };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 440,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    title: 'Caffeine Tracker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function registerIpcHandlers() {
  ipcMain.handle('state:get', () => currentState());

  ipcMain.handle('entry:add', (_event, input) => {
    const result = validateEntry(input);
    if (!result.ok) {
      return { ok: false, errors: result.errors };
    }
    data = addEntry(data, result.entry);
    persist();
    return { ok: true, state: currentState() };
  });

  ipcMain.handle('entry:delete', (_event, id) => {
    if (typeof id !== 'string') {
      return { ok: false, errors: ['Invalid entry id.'] };
    }
    data = deleteEntry(data, id);
    persist();
    return { ok: true, state: currentState() };
  });

  ipcMain.handle('settings:setDailyLimit', (_event, value) => {
    const result = validateDailyLimit(value);
    if (!result.ok) {
      return { ok: false, errors: [result.error] };
    }
    data = setDailyLimit(data, result.mg);
    persist();
    return { ok: true, state: currentState() };
  });
}

app.whenReady().then(() => {
  data = loadData(dataFilePath());
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
