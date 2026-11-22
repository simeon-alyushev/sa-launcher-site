'use strict';
// Minecraft: Bedrock Edition (только Windows).
// Bedrock — это отдельная игра из Microsoft Store / Xbox: у неё свой вход (Xbox), свои файлы и без Java.
// Поэтому лаунчер не скачивает и не запускает игру сам, а аккуратно работает с установленной копией:
//   • находит Minecraft (релиз) и Minecraft Preview;
//   • запускает игру и подключается к серверу по адресу (minecraft://connect);
//   • показывает миры, ресурспаки и аддоны (behavior packs) из папки com.mojang;
//   • ставит .mcworld / .mcpack / .mcaddon / .mctemplate (открывает их самой игрой);
//   • делает копии миров и открывает нужные папки.
// Ничего не меняет внутри игры и не трогает её файлы без явной команды пользователя.
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const U = require('./util');

const EDITIONS = {
  release: {
    pfn: 'Microsoft.MinecraftUWP_8wekyb3d8bbwe', pkg: 'Microsoft.MinecraftUWP', gdk: 'Minecraft Bedrock',
    scheme: 'minecraft', store: 'ms-windows-store://pdp/?productid=9NBLGGH2JHXJ'
  },
  preview: {
    pfn: 'Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe', pkg: 'Microsoft.MinecraftWindowsBeta', gdk: 'Minecraft Bedrock Preview',
    scheme: 'minecraft-preview', store: 'ms-windows-store://pdp/?productid=9P5X4QVLC2XR'
  }
};
const IMPORT_EXT = ['.mcworld', '.mcpack', '.mcaddon', '.mctemplate'];
const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const isWin = () => process.platform === 'win32';
const ed = id => { const e = EDITIONS[id]; if (!e) throw new Error('Bad edition'); return e; };

// Все возможные папки com.mojang для издания: новая (GDK) и старая (UWP) раскладка
function dataDirs(id, env = process.env) {
  const e = ed(id), out = [];
  const roam = env.APPDATA, local = env.LOCALAPPDATA;
  if (roam) {
    const users = path.join(roam, e.gdk, 'Users');
    try {
      for (const u of fs.readdirSync(users, { withFileTypes: true })) if (u.isDirectory()) out.push({ dir: path.join(users, u.name, 'games', 'com.mojang'), user: u.name });
    } catch (_) {}
  }
  if (local) out.push({ dir: path.join(local, 'Packages', e.pfn, 'LocalState', 'games', 'com.mojang'), user: 'uwp' });
  return out.filter(d => { try { return fs.statSync(d.dir).isDirectory(); } catch (_) { return false; } });
}
// Основная папка (куда класть/откуда читать паки): «Shared» у GDK, иначе первая найденная
function mainDir(id, env) {
  const all = dataDirs(id, env);
  return (all.find(d => d.user === 'Shared') || all[0] || {}).dir || null;
}

// Определение установленных изданий через список пакетов Windows (Get-AppxPackage)
let cache = null;
function psJson(cmd) {
  return new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true, timeout: 20000, maxBuffer: 1 << 20 }, (err, out) => {
      if (err) return resolve(null);
      try { const j = JSON.parse(String(out).trim() || 'null'); resolve(j == null ? [] : Array.isArray(j) ? j : [j]); } catch (_) { resolve(null); }
    });
  });
}
async function info(force) {
  if (!isWin()) return { supported: false, editions: [] };
  if (cache && !force && Date.now() - cache.t < 60000) return cache.v;
  const names = Object.values(EDITIONS).map(e => "'" + e.pkg + "'").join(',');
  const pk = await psJson(`Get-AppxPackage -Name ${names} | Select-Object Name,Version | ConvertTo-Json -Compress`);
  const editions = Object.keys(EDITIONS).map(id => {
    const e = EDITIONS[id], p = (pk || []).find(x => x.Name === e.pkg);
    const dirs = dataDirs(id);
    // если PowerShell недоступен — считаем игру установленной, когда есть её папка с данными
    return { id, installed: !!p || (pk === null && dirs.length > 0), version: p ? p.Version : '', hasData: dirs.length > 0, dir: mainDir(id) };
  });
  const v = { supported: true, editions };
  cache = { t: Date.now(), v };
  return v;
}

// Запуск игры (через оболочку Windows, как из меню «Пуск»), по желанию — сразу на сервер
function launch(id, server, openExternal) {
  const e = ed(id);
  if (!isWin()) throw new Error('err:brWinOnly');
  let url = '';
  if (server) {
    const host = String(server.host || '').trim(), port = Number(server.port) || 19132;
    if (!HOST_RE.test(host) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) throw new Error('err:brBadHost');
    if (port < 1 || port > 65535) throw new Error('err:brBadHost');
    url = `${e.scheme}://connect/?serverUrl=${encodeURIComponent(host)}&serverPort=${port}`;
  }
  if (url && typeof openExternal === 'function') { openExternal(url); return true; }   // minecraft://connect — игра запустится и подключится
  const c = spawn('explorer.exe', [`shell:AppsFolder\\${e.pfn}!App`], { detached: true, stdio: 'ignore', windowsHide: true });
  c.on('error', () => {}); c.unref();
  return true;
}
// Команда «добавить сервер в список игры»
function addServerLink(id, server) {
  const e = ed(id), host = String(server.host || '').trim(), port = Number(server.port) || 19132;
  if (!HOST_RE.test(host) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) throw new Error('err:brBadHost');
  const name = String(server.name || host).replace(/[|&?#%\r\n]/g, ' ').trim().slice(0, 40) || host;
  return `${e.scheme}://?addExternalServer=${encodeURIComponent(name)}%7C${encodeURIComponent(host + ':' + port)}`;
}

const dirSize = p => { let n = 0; try { for (const f of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, f.name); n += f.isDirectory() ? dirSize(q) : fs.statSync(q).size; } } catch (_) {} return n; };
const safeName = n => { n = String(n || ''); if (!n || n.includes('/') || n.includes('\\') || n === '.' || n === '..' || n.includes('\0')) throw new Error('Bad name'); return n; };

function worlds(id) {
  const out = [];
  for (const d of dataDirs(id)) {
    const root = path.join(d.dir, 'minecraftWorlds');
    let list = []; try { list = fs.readdirSync(root, { withFileTypes: true }).filter(x => x.isDirectory()); } catch (_) {}
    for (const w of list) {
      const p = path.join(root, w.name); let name = w.name, time = 0, icon = '';
      try { name = fs.readFileSync(path.join(p, 'levelname.txt'), 'utf8').trim() || w.name; } catch (_) {}
      try { time = fs.statSync(path.join(p, 'level.dat')).mtimeMs; } catch (_) { try { time = fs.statSync(p).mtimeMs; } catch (_) {} }
      for (const f of ['world_icon.jpeg', 'world_icon.jpg', 'world_icon.png']) { try { const b = fs.readFileSync(path.join(p, f)); if (b.length < 400000) { icon = 'data:image/' + (f.endsWith('png') ? 'png' : 'jpeg') + ';base64,' + b.toString('base64'); break; } } catch (_) {} }
      out.push({ folder: w.name, owner: d.user, name, time, size: dirSize(p), icon });
    }
  }
  return out.sort((a, b) => b.time - a.time);
}

// Читает manifest.json пака (в нём бывают комментарии — вырезаем)
function manifest(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/^\s*\/\/.*$/gm, '');
    return JSON.parse(raw);
  } catch (_) { return null; }
}
function packs(id) {
  const dir = mainDir(id), out = [];
  if (!dir) return out;
  for (const [kind, sub] of [['resource', 'resource_packs'], ['behavior', 'behavior_packs'], ['skin', 'skin_packs']]) {
    let list = []; try { list = fs.readdirSync(path.join(dir, sub), { withFileTypes: true }).filter(x => x.isDirectory()); } catch (_) {}
    for (const f of list) {
      const p = path.join(dir, sub, f.name), m = manifest(path.join(p, 'manifest.json')) || {}, h = m.header || {};
      let name = String(h.name || f.name); if (/^pack\.name$|^[a-z]+\.[a-z.]+$/i.test(name) && name.includes('.')) name = f.name;
      let icon = ''; try { const b = fs.readFileSync(path.join(p, 'pack_icon.png')); if (b.length < 300000) icon = 'data:image/png;base64,' + b.toString('base64'); } catch (_) {}
      out.push({ kind, folder: f.name, name, version: Array.isArray(h.version) ? h.version.join('.') : '', desc: typeof h.description === 'string' && !h.description.startsWith('pack.') ? h.description.slice(0, 160) : '', size: dirSize(p), icon });
    }
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}
function removePack(id, kind, folder) {
  const sub = { resource: 'resource_packs', behavior: 'behavior_packs', skin: 'skin_packs' }[kind];
  const dir = mainDir(id); if (!sub || !dir) throw new Error('Bad pack');
  const base = path.resolve(dir, sub), p = path.resolve(base, safeName(folder));
  if (!p.startsWith(base + path.sep)) throw new Error('Bad pack');
  fs.rmSync(p, { recursive: true, force: true });
  return true;
}
// Копия мира в папку данных лаунчера (игру и сам мир не трогает)
function backupWorld(id, owner, folder, backupsRoot) {
  const d = dataDirs(id).find(x => x.user === owner); if (!d) throw new Error('Bad world');
  const base = path.resolve(d.dir, 'minecraftWorlds'), src = path.resolve(base, safeName(folder));
  if (!src.startsWith(base + path.sep) || !fs.existsSync(src)) throw new Error('Bad world');
  let nm = folder; try { nm = fs.readFileSync(path.join(src, 'levelname.txt'), 'utf8').trim() || folder; } catch (_) {}
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const dst = path.join(backupsRoot, id, nm.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) + ' ' + stamp);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
  return { path: dst, size: dirSize(dst) };
}
function folderPath(id, sub) {
  const dir = mainDir(id); if (!dir) throw new Error('err:brNoData');
  const base = path.resolve(dir), f = path.resolve(base, String(sub || ''));
  if (f !== base && !f.startsWith(base + path.sep)) throw new Error('Bad folder');
  return f;
}
// ---- Каталог аддонов Bedrock (CurseForge через API нашего сайта; ключ хранится на сервере) ----
// Лаунчер скачивает файл (.mcaddon/.mcpack/.mcworld/.mctemplate, либо .zip с ними) и открывает его игрой — импорт делает сама игра.
const CAT_TYPES = ['addons', 'maps', 'textures', 'scripts', 'skins'];
const CAT_HOSTS = ['forgecdn.net', 'curseforge.com'];
const CAT_MAX = 400e6;   // максимум на один файл
const hostOf = u => { try { return new URL(u).hostname.toLowerCase(); } catch (_) { return ''; } };
const qs = o => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))).toString();
async function catSearch(site, { query = '', type = 'addons', offset = 0 } = {}) {
  if (!CAT_TYPES.includes(type)) type = 'addons';
  const d = await U.fetchJSON(`${site}/api/search?` + qs({ src: 'curseforge', game: 'bedrock', type, q: String(query).slice(0, 100), offset: Math.max(0, Math.min(9980, parseInt(offset) || 0)) }));
  return { more: !!d.more, hits: (d.results || []).map(r => ({ id: String(r.id), title: String(r.title || ''), desc: String(r.desc || ''), icon: /^https:\/\//.test(r.icon || '') ? r.icon : '', downloads: +r.downloads || 0, author: String(r.author || ''), url: /^https:\/\//.test(r.url || '') ? r.url : '', type })) };
}
async function catFiles(site, project) {
  if (!/^\d{1,10}$/.test(String(project))) throw new Error('Bad project');
  const d = await U.fetchJSON(`${site}/api/versions?` + qs({ src: 'curseforge', id: project }));
  return (d.versions || []).map(f => ({ id: String(f.id), name: String(f.name || f.fileName || ''), fileName: String(f.fileName || f.file || ''), url: String(f.url || ''), sha1: /^[a-f0-9]{40}$/i.test(f.sha1 || '') ? f.sha1.toLowerCase() : '' }));
}
// Выбор файла: указанный или самый свежий (у новых файлов больший номер), у которого есть прямая ссылка
const pickFile = (list, fileId) => fileId ? list.find(f => f.id === String(fileId)) : list.filter(f => f.url).sort((a, b) => +b.id - +a.id)[0] || list[0];
// Из .zip достаёт файлы, которые игра умеет импортировать. Если внутри сразу сам пак (manifest.json в корне) — это и есть .mcpack.
function unpackZip(buf, baseName) {
  const z = U.readZip(buf), out = []; let total = 0;
  for (const en of z.entries) {
    if (en.name.endsWith('/') || en.name.includes('\0') || !importable(en.name)) continue;
    if (out.length >= 12 || (total += en.usize) > CAT_MAX) throw new Error('err:tooBig');
    out.push({ name: U.safeFileName(en.name), data: z.data(en) });
  }
  if (out.length) return out;
  if (z.entries.some(en => en.name === 'manifest.json')) return [{ name: U.safeFileName(baseName.replace(/\.zip$/i, '')) + '.mcpack', data: buf }];
  throw new Error('err:brCatBadFile');
}
async function catInstall(site, { project, file }, dir, openPath) {
  const list = await catFiles(site, project), f = pickFile(list, file);
  if (!f) throw new Error('err:brCatNoFiles');
  const url = U.safeUrl(f.url, [...CAT_HOSTS, hostOf(site)].filter(Boolean));
  if (!url) throw new Error('err:brCatNoDl');   // автор запретил скачивание вне сайта CurseForge
  const fname = U.safeFileName(f.fileName || f.name), ext = path.extname(fname).toLowerCase();
  if (!importable(fname) && ext !== '.zip') throw new Error('err:brCatBadFile');
  const buf = await U.fetchBufMax(url, CAT_MAX);
  if (f.sha1 && U.sha1(buf) !== f.sha1) throw new Error('err:brCatHash');
  const parts = ext === '.zip' ? unpackZip(buf, fname) : [{ name: fname, data: buf }];
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  for (const p of parts) { const dst = path.join(dir, project + '-' + p.name); fs.writeFileSync(dst, p.data); written.push(dst); }
  for (const w of written) { const e = await openPath(w); if (e) throw new Error(e); }
  return { files: written.map(w => path.basename(w)), name: f.name };
}
const importable = f => IMPORT_EXT.includes(path.extname(String(f)).toLowerCase());

module.exports = { CAT_TYPES, catSearch, catFiles, catInstall, pickFile, unpackZip, EDITIONS, IMPORT_EXT, info, launch, addServerLink, worlds, packs, removePack, backupWorld, folderPath, dataDirs, mainDir, importable, HOST_RE };
