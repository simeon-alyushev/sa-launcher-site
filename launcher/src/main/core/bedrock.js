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

// Определение установленных изданий. Источники (любого достаточно):
//   1) пакеты Windows (Get-AppxPackage) по имени и по семейству пакета;
//   2) приложения меню «Пуск» (Get-StartApps): именно их запускает кнопка «Играть» в Microsoft Store;
//   3) папка пакета в %LOCALAPPDATA%\Packages, папка Xbox-установки и папка данных com.mojang.
// Раньше учитывался только первый источник, и если PowerShell отвечал пусто или с ошибкой, установленная игра считалась отсутствующей.
let cache = null;
const PS_EXE = () => {
  const p = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  try { return fs.existsSync(p) ? p : 'powershell.exe'; } catch (_) { return 'powershell.exe'; }
};
// Вытаскивает JSON из вывода PowerShell (на случай посторонних строк до и после него)
function parsePs(out) {
  const t = String(out || ''), i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i < 0 || j < i) return null;
  try {
    const o = JSON.parse(t.slice(i, j + 1)), arr = v => v == null ? [] : Array.isArray(v) ? v : [v];
    return { pk: arr(o.pk), sa: arr(o.sa) };
  } catch (_) { return null; }
}
function psScan() {
  const names = Object.values(EDITIONS).map(e => "'*" + e.pkg.replace('Microsoft.', '') + "*'").join(',');
  const cmd = "$ErrorActionPreference='SilentlyContinue';$ProgressPreference='SilentlyContinue';"
    + `$pk=@(Get-AppxPackage -Name ${names} | Select-Object Name,Version,PackageFamilyName);`
    + "$sa=@(Get-StartApps | Where-Object { $_.AppID -like '*Minecraft*' } | Select-Object Name,AppID);"
    + 'ConvertTo-Json -Compress -Depth 4 -InputObject @{pk=$pk;sa=$sa}';
  return new Promise(resolve => {
    execFile(PS_EXE(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
      { windowsHide: true, timeout: 30000, maxBuffer: 1 << 21 }, (err, out) => resolve(parsePs(out)));
  });
}
const exists = p => { try { return !!p && fs.existsSync(p); } catch (_) { return false; } };
// Склеивает результаты PowerShell и проверки папок в сведения об издании
function detect(id, ps, env = process.env) {
  const e = ed(id), dirs = dataDirs(id, env);
  const p = ps && ps.pk.find(x => x && (x.Name === e.pkg || x.PackageFamilyName === e.pfn));
  const sa = ps && ps.sa.find(x => x && String(x.AppID || '').toLowerCase().startsWith(e.pfn.toLowerCase()));
  const local = exists(env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Packages', e.pfn));
  const xbox = exists(path.join(env.SystemDrive ? env.SystemDrive + path.sep : 'C:' + path.sep, 'XboxGames', id === 'release' ? 'Minecraft for Windows' : 'Minecraft Preview for Windows'));
  const via = p ? 'package' : sa ? 'start' : local ? 'packages-folder' : xbox ? 'xboxgames' : dirs.length ? 'data' : '';
  return { id, installed: !!via, via, version: p ? p.Version : '', appId: sa ? sa.AppID : e.pfn + '!App', hasData: dirs.length > 0, dir: mainDir(id, env) };
}
async function info(force) {
  if (!isWin()) return { supported: false, editions: [] };
  if (cache && !force && Date.now() - cache.t < 60000) return cache.v;
  const ps = await psScan();
  const editions = Object.keys(EDITIONS).map(id => detect(id, ps));
  const v = { supported: true, editions, ps: !!ps };
  // не запоминаем «ничего не найдено», если PowerShell не ответил: следующая проверка попробует снова
  if (ps || editions.some(x => x.installed)) cache = { t: Date.now(), v };
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
  const found = cache && cache.v.editions.find(x => x.id === id), appId = (found && found.appId) || (e.pfn + '!App');
  const c = spawn('explorer.exe', [`shell:AppsFolder\\${appId}`], { detached: true, stdio: 'ignore', windowsHide: true });
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
const importable = f => IMPORT_EXT.includes(path.extname(String(f)).toLowerCase());

module.exports = { EDITIONS, IMPORT_EXT, parsePs, detect, info, launch, addServerLink, worlds, packs, removePack, backupWorld, folderPath, dataDirs, mainDir, importable, HOST_RE };
