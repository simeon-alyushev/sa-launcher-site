'use strict';
// Обновление самого лаунчера: версия и ссылки берутся с сайта (/api/launcher -> последний GitHub Release).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const U = require('./util');

const cmp = (a, b) => { const x = String(a).split(/[.-]/).map(n => parseInt(n) || 0), y = String(b).split(/[.-]/).map(n => parseInt(n) || 0); for (let i = 0; i < 4; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

async function check(site, current) {
  const d = await U.fetchJSON(`${site}/api/launcher`);
  const latest = String(d.version || '').replace(/^v/i, '');
  return { current, latest: latest || current, available: !!latest && cmp(latest, current) > 0 };
}
// Windows: скачиваем установщик и запускаем (обычный мастер установки поверх). Остальные ОС: открываем страницу загрузки.
async function install(site, shell, quit, progress) {
  const plat = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
  const url = `${site}/download/${plat}`;
  if (plat !== 'windows') { shell.openExternal(url); return 'opened'; }
  progress(0.1);
  const buf = await U.fetchBuf(url);
  if (buf.length < 1e6) throw new Error('Не удалось скачать установщик');
  const f = path.join(os.tmpdir(), 'SA-Launcher-Setup.exe'); fs.writeFileSync(f, buf); progress(1);
  spawn(f, [], { detached: true, stdio: 'ignore' }).unref(); setTimeout(quit, 400);
  return 'started';
}
module.exports = { check, install, cmp };
