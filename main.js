import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'node:path';
import url from 'node:url';
import {
  store,
  getState,
  addCasino,
  removeCasino,
  addEntry,
  deleteEntry,
  setBudgets,
  setSettings,
  clearAllData,
  helpers
} from './store.js';

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 980,
    minHeight: 640,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadURL(url.pathToFileURL(path.join(app.getAppPath(), 'renderer', 'index.html')).href);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Simple menu with a panic/help section
const template = [
  {
    label: 'File',
    submenu: [
      { label: 'Export CSV…', click: (_m, win) => win?.webContents.send('ui:exportCSV') },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'Safety',
    submenu: [
      { label: 'Open help resources', click: () => shell.openExternal('https://www.begambleaware.org/') },
      { label: 'Self-exclusion options (EU)', click: () => shell.openExternal('https://www.gamstop.co.uk/') }
    ]
  },
  { role: 'viewMenu' }
];
Menu.setApplicationMenu(Menu.buildFromTemplate(template));

// IPC — data
ipcMain.handle('state:get', () => getState());
ipcMain.handle('casino:add', (_e, name) => addCasino(name));
ipcMain.handle('casino:remove', (_e, id) => removeCasino(id));
ipcMain.handle('entry:add', (_e, payload) => addEntry(payload));
ipcMain.handle('entry:delete', (_e, id) => deleteEntry(id));
ipcMain.handle('budgets:set', (_e, payload) => setBudgets(payload));
ipcMain.handle('settings:set', (_e, payload) => setSettings(payload));
ipcMain.handle('data:clear-all', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const res = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Cancel', 'Erase Everything'],
    defaultId: 0,
    cancelId: 0,
    title: 'Confirm wipe',
    message: 'This will permanently delete all budgets, casinos, and entries.',
    detail: 'There is no undo. Are you sure?'
  });
  if (res.response === 1) {
    clearAllData();
    return true;
  }
  return false;
});

// IPC — helpers for summary
ipcMain.handle('summary:compute', (_e) => {
  const { entries, budgets } = getState();
  const now = new Date();
  const wkKey = helpers.weekKey(now);
  const moKey = helpers.monthKey(now);

  const byWeek = entries.filter(e => helpers.weekKey(e.dateISO) === wkKey);
  const byMonth = entries.filter(e => helpers.monthKey(e.dateISO) === moKey);

  const sum = arr => arr.reduce((acc, e) => {
    acc.spent += e.spent;
    acc.won += e.won;
    return acc;
  }, { spent: 0, won: 0 });

  const w = sum(byWeek);
  const m = sum(byMonth);

  return {
    week: { ...w, net: w.won - w.spent, budget: budgets.weekly },
    month: { ...m, net: m.won - m.spent, budget: budgets.monthly }
  };
});

ipcMain.handle('dialog:saveCSV', async (_e, defaultName, contents) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (!canceled && filePath) {
    const fs = await import('node:fs');
    await fs.promises.writeFile(filePath, contents, 'utf8');
    return filePath;
  }
  return null;
});
