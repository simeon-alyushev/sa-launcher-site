'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme, Notification, nativeImage, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const cfg = require('./config');
// Экономия памяти Chromium: ленивая компиляция и компактный режим V8, без фоновых служб, которые лаунчеру не нужны
app.commandLine.appendSwitch('js-flags', '--max-lazy --optimize-for-size --expose-gc');   // gc() нужен, чтобы освобождать память интерфейса, когда окно не в фокусе
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-features', 'Translate,MediaRouter,OptimizationHints,SpareRendererForSitePerProcess');
const { Store, DEFAULTS } = require('./core/store');
const { Instances } = require('./core/instances');
const L = require('./core/loaders');
const MR = require('./core/modrinth');
const mc = require('./core/mc');
const auth = require('./core/auth');
const CFA = require('./core/curseforge');
const { Discord } = require('./core/discord');
const Upd = require('./core/updater');
const { Skins } = require('./core/skins');
const Cloud = require('./core/cloud');
const { Backgrounds } = require('./core/bg');
// sa-bg:// — отдача своих фонов из папки данных (иначе CSP интерфейса не пропустит локальные файлы)
protocol.registerSchemesAsPrivileged([{ scheme: 'sa-bg', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

app.setName('SA Launcher');
// «Экономия ресурсов» надо знать ДО старта Chromium (его флаги задаются один раз), поэтому читаем настройку прямо из файла.
// В этом режиме Chromium работает в экономном режиме (меньше кэшей и буферов); вступает в силу после перезапуска. На вид не влияет.
let LITE = false; try { LITE = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8')).settings.lite === true; } catch (_) {}
if (LITE) app.commandLine.appendSwitch('enable-low-end-device-mode');
// Принудительная сборка мусора в основном процессе (нужна только для фоновой очистки ниже)
let gcMain = null; try { require('v8').setFlagsFromString('--expose-gc'); gcMain = require('vm').runInNewContext('gc'); } catch (_) {}
// Только один экземпляр. Если предыдущий процесс «завис» после закрытия окна, он выходит сам (см. quitAll),
// поэтому повторный запуск всегда получает блокировку.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.exit(0); }

// ID приложения Discord (Rich Presence). Создайте приложение на https://discord.com/developers/applications
// и вставьте Application ID в launcher/package.json -> "discordClientId" (или в настройках лаунчера).
let win, store, inst, rpc, skins, bgs; const started = new Map();
// Deep link salauncher://install?... — ссылка из браузера/сайта. Если окно ещё не готово, ждёт в pendingLink.
const DL = require('./core/deeplink');
let pendingLink = DL.fromArgv(process.argv), rendererReady = false;
const showWin = () => { if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } };
function handleLink(raw) {
  const l = typeof raw === 'string' ? DL.parse(raw) : raw; if (!l) return;
  pendingLink = l; showWin();
  if (rendererReady) { emit('deeplink', l); pendingLink = null; }
}
try { if (app.isPackaged) app.setAsDefaultProtocolClient('salauncher'); } catch (_) {}
app.on('open-url', (e, url) => { e.preventDefault(); handleLink(url); }); // macOS
const emit = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send('sa:event', ch, data); };

// Лёгкая очистка памяти: интерфейс не меняется и ничего не сбрасывается — только сборка мусора в обоих процессах и кэш миниатюр.
function freeLight() {
  try { if (inst) inst.trim(); if (gcMain) gcMain(); if (win && !win.isDestroyed()) win.webContents.executeJavaScript('typeof gc==="function"&&gc()', true).catch(() => {}); } catch (_) {}
}
function createWindow() {
  rendererReady = false;
  const dark = true;
  win = new BrowserWindow({
    width: 1180, height: 760, minWidth: 940, minHeight: 600, show: false, title: 'SA Launcher',
    backgroundColor: '#0f1115', icon: path.join(__dirname, '../renderer/logo.png'),
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#00000000', symbolColor: '#9aa3b2', height: 44 },
    webPreferences: { preload: path.join(__dirname, '../preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, enableWebSQL: false, webgl: false }   // проверка орфографии и WebGL лаунчеру не нужны — не грузим их в память
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.once('ready-to-show', () => { try { win.webContents.setZoomFactor(((store && store.settings.uiScale) || 100) / 100); } catch (_) {} win.show(); });
  win.on('closed', () => { win = null; });
  // Окно свёрнуто/скрыто: освобождаем кэши (интерфейс загрузит нужное заново, когда окно вернётся)
  const trim = () => { emit('trim'); if (inst) inst.trim(); try { win.webContents.session.clearCache(); } catch (_) {} setTimeout(freeLight, 400); };
  win.on('minimize', trim); win.on('hide', trim);
  // Окно не в фокусе (например, идёт игра): через время чистим память и повторяем раз в 3 минуты, пока окно не вернули
  let idleT = null, idleI = null;
  win.on('blur', () => { clearTimeout(idleT); clearInterval(idleI); idleT = setTimeout(() => { freeLight(); idleI = setInterval(freeLight, 180000); }, LITE ? 15000 : 45000); });
  win.on('focus', () => { clearTimeout(idleT); clearInterval(idleI); });
  win.on('closed', () => { clearTimeout(idleT); clearInterval(idleI); });
  setTimeout(freeLight, 25000);   // после запуска: выбросить мусор, накопившийся при старте
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
}

const handlers = {
  'app:init': () => { if (!('uiMode' in store.settings)) store.set({ uiMode: store.fresh ? 'simple' : 'advanced', welcomed: !store.fresh }); return { settings: store.settings, accounts: store.accounts(), locale: app.getLocale(), site: cfg.siteUrl, platform: process.platform, version: app.getVersion(), dataDir: app.getPath('userData') }; },
  'settings:set': patch => { const s = store.set(patch); if (win && patch.titleOverlay) win.setTitleBarOverlay(patch.titleOverlay); if ('discord' in patch || 'discordClientId' in patch) setupRpc(); if ('startup' in patch) { try { app.setLoginItemSettings({ openAtLogin: !!patch.startup }); } catch (_) {} } if ('uiScale' in patch && win) win.webContents.setZoomFactor((+patch.uiScale || 100) / 100); return s; },

  'auth:login': async () => {
    const acc = await auth.login(cfg, BrowserWindow, win);
    store.saveAccount(acc); store.set({ selected: acc.id }); return { accounts: store.accounts(), selected: acc.id };
  },
  'auth:cancel': () => auth.cancel(),
  'auth:remove': id => { store.removeAccount(id); return { accounts: store.accounts(), selected: store.settings.selected }; },
  'auth:select': id => { store.set({ selected: id }); return id; },

  'mc:versions': async () => { const m = await mc.manifest(); return m.versions.map(v => ({ id: v.id, type: v.type, time: Date.parse(v.releaseTime) || 0 })); },
  'loader:fallback': ({ loader, mc: v }) => L.fallbackVersion(loader, v),
  'loader:versions': ({ loader, mc: v }) => L.loaderVersions(loader, v),

  'inst:list': () => inst.list(),
  'wizard:plan': ({ mc: v, loader, items }) => inst.planContent(String(v), String(loader), items),
  'wizard:create': o => inst.createFromPlan({ name: String(o.name || '').trim().slice(0, 80) || 'SA Build', mc: String(o.mc), loader: String(o.loader), loaderVersion: String(o.loaderVersion || ''), items: o.items }),
  'inst:create': async o => { const i = inst.create(o); inst.prepare(i.id).catch(e => emit('error', { id: i.id, message: e.message })); return i; },
  'inst:update': ({ id, patch }) => inst.update(id, patch),
  'inst:delete': id => inst.remove(id),
  'inst:duplicate': a => typeof a === 'string' ? inst.duplicate(a) : inst.duplicate(a.id, a),
  'inst:play': a => { const o = typeof a === 'string' ? { id: a } : a; if (store.settings.minimizeOnLaunch && win) setTimeout(() => win && !win.isDestroyed() && win.minimize(), 4000); return inst.play(o.id, o.quick); },
  'inst:recent': () => inst.recent(),
  'inst:compat': ({ project, src, kind }) => inst.compat(project, src, kind),
  'inst:projVersions': ({ id, project, src, kind, all }) => inst.projVersions(id, project, src, kind, all),
  'inst:setIcon': async id => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], properties: ['openFile'] }); if (r.canceled) return false; return inst.setIcon(id, r.filePaths[0]); },
  'inst:clearIcon': id => inst.clearIcon(id),
  'app:clearCache': () => { const d = path.join(app.getPath('userData'), 'shared', 'installers'); let n = 0; const walk = p => { try { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); e.isDirectory() ? walk(f) : n += fs.statSync(f).size; } } catch (_) {} }; walk(d); fs.rmSync(d, { recursive: true, force: true }); return n; },
  // Окно готово принимать ссылку: отдаём отложенную (однократно)
  'app:pendingLink': () => { rendererReady = true; const l = pendingLink; pendingLink = null; return l; },
  'app:openData': () => shell.openPath(app.getPath('userData')),
  'settings:reset': () => { for (const b of bgs.list()) bgs.unlink(b.id); const keep = { lang: store.settings.lang, selected: store.settings.selected }; for (const k of Object.keys(DEFAULTS)) delete store.settings[k]; return store.set({ ...DEFAULTS, ...keep }); },
  // ---- свой фон (тема «Своя») ----
  'bg:add': async replaceId => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Image (PNG, JPG, WEBP, GIF)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], properties: ['openFile'] }); if (r.canceled) return null; return bgs.add(r.filePaths[0], typeof replaceId === 'string' ? replaceId : ''); },
  'bg:remove': id => bgs.remove(String(id)),
  'inst:stop': id => inst.stop(id),
  'inst:folder': ({ id, sub }) => { const base = path.resolve(inst.game(id)), f = path.resolve(base, String(sub || '')); if (f !== base && !f.startsWith(base + path.sep)) throw new Error('Bad folder'); fs.mkdirSync(f, { recursive: true }); return shell.openPath(f); },
  'inst:content': ({ id, kind }) => inst.content(id, kind),
  'inst:toggle': ({ id, kind, file }) => inst.toggle(id, kind, file),
  'inst:removeFile': ({ id, kind, file }) => inst.removeFile(id, kind, file),
  'inst:install': ({ id, project, version }) => inst.installProject(id, project, version),
  'inst:checkUpdate': id => inst.checkUpdate(id),
  'inst:modVersions': ({ id, kind, file, all }) => inst.modVersions(id, kind || 'mod', file, all),
  'inst:setModVersion': ({ id, kind, file, version }) => inst.setModVersion(id, kind || 'mod', file, version),
  'inst:installCF': ({ id, project, file, meta }) => inst.installCurseforge(id, project, file, meta || {}),
  'inst:cfVersions': ({ id, project, kind }) => inst.cfVersions(id, project, kind),
  'inst:fixCrash': ({ id, problems }) => inst.fixCrash(id, problems),
  'inst:applyUpdate': ({ id, mc: v, removeMissing }) => inst.applyUpdate(id, v, removeMissing),
  'inst:optimize': id => inst.optimize(id),
  'boost:info': ({ id, preset }) => inst.boostInfo(id, preset),
  'boost:apply': ({ id, preset, options }) => inst.boostApply(id, { preset, options: !!options }),
  'boost:off': ({ id, revert }) => inst.boostOff(id, { revert: !!revert }),
  'build:list': () => inst.builds(),
  'build:setIcon': async id => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }], properties: ['openFile'] }); if (r.canceled) return false; return inst.setBuildIcon(id, r.filePaths[0]); },
  'build:clearIcon': id => inst.clearBuildIcon(id),
  'inst:export': async id => { const i = inst.read(id); const r = await dialog.showSaveDialog(win, { defaultPath: i.name.replace(/[\\/:*?"<>|]/g, '_') + '.mrpack', filters: [{ name: 'Modrinth modpack', extensions: ['mrpack'] }] }); if (r.canceled || !r.filePath) return null; return inst.exportMrpack(id, r.filePath); },
  'inst:modUpdates': id => inst.modUpdates(id),
  'inst:updateMods': ({ id, files }) => inst.updateMods(id, files),
  'inst:backup': id => inst.backupWorlds(id, 'manual'),
  'inst:backupsFolder': id => shell.openPath(inst.backupsDir(id)),
  'inst:inspect': id => inst.inspect(id),
  'inst:syncOptions': ({ from, to, mode }) => inst.syncOptions(from, to, mode),
  'build:versions': () => inst.buildVersions(),
  'build:install': ({ id, mc: v, name }) => inst.installBuild(id, { mc: v, name }),
  'inst:installModpack': ({ project, version, src, title }) => inst.installModpack(project, version, ['curseforge', 'ftb', 'atl', 'technic'].includes(src) ? src : 'modrinth', typeof title === 'string' ? title.slice(0, 80) : ''),
  // Импорт из файла: Modrinth .mrpack и CurseForge .zip (формат определяется по содержимому)
  'inst:importFile': async () => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Modpack (.mrpack, .zip)', extensions: ['mrpack', 'zip'] }], properties: ['openFile'] });
    if (r.canceled) return null;
    if (fs.statSync(r.filePaths[0]).size > 1.5e9) throw new Error('File is too large');
    return inst.importPack(fs.readFileSync(r.filePaths[0]), path.basename(r.filePaths[0]).replace(/\.(mrpack|zip)$/i, ''));
  },
  // Файлы CurseForge, которые нельзя скачать автоматически: пользователь выбирает скачанные вручную
  'inst:addManual': async id => {
    const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Mods (.jar, .zip)', extensions: ['jar', 'zip'] }], properties: ['openFile', 'multiSelections'] });
    if (r.canceled) return null; return inst.addManualFiles(id, r.filePaths);
  },


  // ---- скины (официальный API Mojang) ----
  'skin:profile': () => skins.profile(),
  'skin:head': id => skins.head(id),
  'skin:pick': async () => { const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Skin (PNG 64x64 / 64x32)', extensions: ['png'] }], properties: ['openFile'] }); if (r.canceled) return null; return skins.inspectFile(r.filePaths[0]); },
  'skin:apply': async ({ data, variant, save, name }) => { await skins.upload(null, data, variant); if (save) skins.save(null, data, name, variant); return true; },
  'skin:saved': () => skins.saved(),
  'skin:saveCurrent': name => skins.saveCurrent(null, typeof name === 'string' ? name : ''),
  'skin:use': id => skins.useSaved(null, id),
  'skin:delete': id => skins.remove(null, id),
  'skin:reset': () => skins.reset(),
  'skin:cape': id => skins.setCape(null, id || null),

  // ---- копии миров: локальные и облачные ----
  'inst:backups': id => inst.listBackups(id),
  'inst:restore': ({ id, name }) => inst.restoreBackup(id, name),
  'inst:delBackup': ({ id, name }) => inst.deleteBackup(id, name),
  'cloud:limits': () => ({ share: Cloud.SHARE, cloud: Cloud.CLOUD }),
  'cloud:list': async id => Cloud.cloudList(cfg.siteUrl, await skins.acc(), id),
  'cloud:upload': async ({ id, pass }) => { const t = 'cloud:' + id; try { return await Cloud.cloudUpload(cfg.siteUrl, await skins.acc(), id, path.join(inst.game(id), 'saves'), pass, p => emit('progress', { task: t, label: inst.read(id).name + ' · cloud', pct: p })); } finally { emit('progress', { task: t, done: true }); } },
  'cloud:restore': async ({ id, cloudId, pass }) => inst.restoreFromZip(id, await Cloud.cloudDownload(cfg.siteUrl, await skins.acc(), id, cloudId, pass)),
  'cloud:delete': async ({ id, cloudId }) => Cloud.cloudDelete(cfg.siteUrl, await skins.acc(), id, cloudId),

  // ---- обмен сборкой по коду ----
  'share:upload': async id => { const r = await inst.buildMrpack(id); return Cloud.shareUpload(cfg.siteUrl, r.buf, inst.read(id).name); },
  'share:download': async code => inst.importPack(await Cloud.shareDownload(cfg.siteUrl, code), 'Shared build'),

  'cat:search': o => o.src === 'curseforge' ? CFA.search(cfg.siteUrl, o) : o.src === 'ftb' ? require('./core/ftb').search(o) : o.src === 'atl' ? require('./core/atl').search(o) : o.src === 'technic' ? require('./core/technic').search(o) : MR.search(o),
  'inst:addFiles': async ({ id, kind }) => { const r = await dialog.showOpenDialog(win, { filters: [{ name: kind === 'mod' ? 'Mods (.jar)' : 'ZIP', extensions: [kind === 'mod' ? 'jar' : 'zip'] }], properties: ['openFile', 'multiSelections'] }); if (r.canceled) return null; return inst.addFiles(id, kind === 'mod' || kind === 'resourcepack' || kind === 'shader' ? kind : 'mod', r.filePaths); },
  'inst:worlds': id => inst.listWorlds(id),
  'cat:project': id => MR.project(id),
  'cat:versions': ({ id, loaders, game_versions }) => MR.versions(id, { loaders, game_versions }),
  'launcher:check': () => Upd.check(cfg.siteUrl, app.getVersion()),
  'launcher:update': () => Upd.install(cfg.siteUrl, shell, quitAll, pct => emit('progress', { task: 'launcher', label: 'SA Launcher', pct, done: pct >= 1 })),
  'shell:open': url => { if (/^https:\/\//.test(url)) shell.openExternal(url); },
  'shell:site': p => shell.openExternal(cfg.siteUrl + (p || ''))
};

function setupRpc() {
  const on = store.settings.discord !== false;
  const id = store.settings.discordClientId || require('../../package.json').discordClientId || '';
  if (rpc) { rpc.clear(); rpc.close(); rpc = null; }
  if (on && id) { rpc = new Discord(id); rpc.set({ details: 'В лаунчере', state: 'SA Launcher', timestamps: { start: Date.now() }, assets: { large_image: 'logo', large_text: 'SA Launcher' } }); }
}
// Presence: «Играет в <сборка>» на время игры
function presence() {
  if (!rpc) return;
  const run = inst.list().filter(i => i.running)[0];
  if (run) rpc.set({ details: 'Играет в Minecraft ' + run.mc, state: run.name + (run.loader !== 'vanilla' ? ' · ' + run.loader : ''), timestamps: { start: started.get(run.id) || Date.now() }, assets: { large_image: 'logo', large_text: 'SA Launcher' } });
  else rpc.set({ details: 'В лаунчере', state: 'SA Launcher', timestamps: { start: Date.now() }, assets: { large_image: 'logo', large_text: 'SA Launcher' } });
}
function quitAll() {
  try { if (rpc) { rpc.clear(); rpc.close(); } } catch (_) {}
  try { for (const c of inst ? inst.running.values() : []) if (c) c.kill(); } catch (_) {}
  app.exit(0);
}

if (gotLock) {
  app.whenReady().then(() => {
    nativeTheme.themeSource = 'dark';
    store = new Store(app.getPath('userData')); store.purgeUnlicensed();
    const bus = (ch, data) => { emit(ch, data); if (ch === 'state') {
      if (data.running) started.set(data.id, Date.now());
      else {
        const nm = (() => { try { return inst.read(data.id).name; } catch (_) { return ''; } })();
        if (store.settings.reopen && win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
        if (store.settings.notify !== false && Notification.isSupported() && !(win && win.isFocused())) new Notification({ title: 'SA Launcher', body: nm + ': ' + (data.code ? 'Minecraft crashed (exit code ' + data.code + ')' : 'game closed') }).show();
      } setTimeout(presence, 300); } };
    inst = new Instances({ dataDir: app.getPath('userData'), store, emit: bus });
    inst.thumb = f => { const im = nativeImage.createFromPath(f); if (im.isEmpty()) throw new Error('bad image'); const z = im.getSize(); return 'data:image/png;base64,' + (z.width > 160 || z.height > 160 ? im.resize({ width: 160, height: 160, quality: 'good' }) : im).toPNG().toString('base64'); };
    bgs = new Backgrounds(app.getPath('userData'), store);
    protocol.handle('sa-bg', req => { try { const u = new URL(req.url), f = u.hostname === 'f' && bgs.file(u.pathname.slice(1)); if (!f) return new Response('not found', { status: 404 }); return net.fetch(require('url').pathToFileURL(f).href); } catch (_) { return new Response('bad request', { status: 400 }); } });
    skins = new Skins({ store, dataDir: app.getPath('userData'), siteUrl: cfg.siteUrl });
    for (const [name, fn] of Object.entries(handlers)) {
      ipcMain.handle('sa:' + name, async (_e, arg) => { try { return { ok: true, data: await fn(arg) }; } catch (e) { return { ok: false, error: e.message || String(e) }; } });
    }
    createWindow(); setupRpc();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  // Повторный запуск: показываем окно (или создаём заново, если оно было закрыто, но процесс жив)
  app.on('second-instance', (_e, argv) => {
    const l = DL.fromArgv(argv); if (l) pendingLink = l;
    if (l && win && !win.isDestroyed() && rendererReady) { emit('deeplink', l); pendingLink = null; }
    if (!win || win.isDestroyed()) { if (app.isReady()) createWindow(); return; }
    if (win.isMinimized()) win.restore(); win.show(); win.focus();
  });
  // Закрыли окно — полностью завершаем процесс (игра при этом продолжает работать как отдельный процесс)
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') { try { if (rpc) { rpc.clear(); rpc.close(); } } catch (_) {} app.exit(0); } });
  app.on('before-quit', () => { try { if (rpc) rpc.close(); } catch (_) {} });
}
