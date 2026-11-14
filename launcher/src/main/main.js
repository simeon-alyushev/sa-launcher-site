'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const cfg = require('./config');
const { Store } = require('./core/store');
const { Instances } = require('./core/instances');
const L = require('./core/loaders');
const MR = require('./core/modrinth');
const mc = require('./core/mc');
const auth = require('./core/auth');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setName('SA Launcher');

let win, store, inst;
const emit = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send('sa:event', ch, data); };

function createWindow() {
  const dark = true;
  win = new BrowserWindow({
    width: 1180, height: 760, minWidth: 940, minHeight: 600, show: false, title: 'SA Launcher',
    backgroundColor: '#0f1115', icon: path.join(__dirname, '../renderer/logo.png'),
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#00000000', symbolColor: '#9aa3b2', height: 44 },
    webPreferences: { preload: path.join(__dirname, '../preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
}

const handlers = {
  'app:init': () => ({ settings: store.settings, accounts: store.accounts(), locale: app.getLocale(), site: cfg.siteUrl, platform: process.platform, version: app.getVersion(), dataDir: app.getPath('userData') }),
  'settings:set': patch => { const s = store.set(patch); if (win && patch.titleOverlay) win.setTitleBarOverlay(patch.titleOverlay); return s; },

  'auth:login': async () => {
    const acc = await auth.login(cfg.siteUrl, url => shell.openExternal(url));
    store.saveAccount(acc); store.set({ selected: acc.id }); return { accounts: store.accounts(), selected: acc.id };
  },
  'auth:cancel': () => auth.cancel(),
  'auth:remove': id => { store.removeAccount(id); return { accounts: store.accounts(), selected: store.settings.selected }; },
  'auth:select': id => { store.set({ selected: id }); return id; },

  'mc:versions': async () => { const m = await mc.manifest(); return m.versions.map(v => ({ id: v.id, type: v.type })); },
  'loader:versions': ({ loader, mc: v }) => L.loaderVersions(loader, v),

  'inst:list': () => inst.list(),
  'inst:create': async o => { const i = inst.create(o); inst.prepare(i.id).catch(e => emit('error', { id: i.id, message: e.message })); return i; },
  'inst:update': ({ id, patch }) => inst.update(id, patch),
  'inst:delete': id => inst.remove(id),
  'inst:duplicate': id => inst.duplicate(id),
  'inst:play': id => inst.play(id),
  'inst:stop': id => inst.stop(id),
  'inst:folder': ({ id, sub }) => shell.openPath(path.join(inst.game(id), sub || '')),
  'inst:content': ({ id, kind }) => inst.content(id, kind),
  'inst:toggle': ({ id, kind, file }) => inst.toggle(id, kind, file),
  'inst:removeFile': ({ id, kind, file }) => inst.removeFile(id, kind, file),
  'inst:install': ({ id, project, version }) => inst.installProject(id, project, version),
  'inst:checkUpdate': id => inst.checkUpdate(id),
  'inst:applyUpdate': ({ id, mc: v, removeMissing }) => inst.applyUpdate(id, v, removeMissing),
  'inst:optimize': id => inst.optimize(id),
  'inst:installModpack': ({ project, version }) => inst.installModpack(project, version),
  'inst:importFile': async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Modrinth modpack', extensions: ['mrpack'] }], properties: ['openFile'] });
    if (r.canceled) return null; return inst.importMrpack(fs.readFileSync(r.filePaths[0]), path.basename(r.filePaths[0], '.mrpack'));
  },

  'cat:search': o => MR.search(o),
  'cat:project': id => MR.project(id),
  'cat:versions': ({ id, loaders, game_versions }) => MR.versions(id, { loaders, game_versions }),
  'shell:open': url => { if (/^https:\/\//.test(url)) shell.openExternal(url); },
  'shell:site': p => shell.openExternal(cfg.siteUrl + (p || ''))
};

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  store = new Store(app.getPath('userData'));
  inst = new Instances({ dataDir: app.getPath('userData'), store, emit });
  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle('sa:' + name, async (_e, arg) => { try { return { ok: true, data: await fn(arg) }; } catch (e) { return { ok: false, error: e.message || String(e) }; } });
  }
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
