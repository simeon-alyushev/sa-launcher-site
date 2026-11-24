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
  const latest = String((d && d.version) || '').replace(/^v/i, '');
  // Раньше пустой ответ сайта выглядел как «у вас последняя версия». Теперь это честная ошибка.
  if (!latest) throw new Error('Сайт не вернул номер версии (/api/launcher). Проверьте, что на сайте настроен последний релиз.');
  return { current, latest, available: cmp(latest, current) > 0 };
}

// Скачивание с прогрессом и проверкой, что пришёл именно установщик, а не HTML-страница с ошибкой.
async function fetchInstaller(url, progress) {
  const ctl = new AbortController();
  let idle = setTimeout(() => ctl.abort(), 30000);               // обрыв, если 30 с нет данных
  const bump = () => { clearTimeout(idle); idle = setTimeout(() => ctl.abort(), 30000); };
  try {
    const r = await fetch(url, { headers: { 'User-Agent': U.UA }, signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const type = String(r.headers.get('content-type') || '');
    if (/text\/html|application\/json/i.test(type)) throw new Error('сайт вернул страницу вместо установщика');
    const total = Number(r.headers.get('content-length')) || 0;
    const chunks = []; let got = 0;
    const rd = r.body.getReader();
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      chunks.push(value); got += value.length; bump();
      if (total) progress(0.02 + 0.96 * Math.min(1, got / total));
    }
    const buf = Buffer.concat(chunks.map(c => Buffer.from(c)));
    if (buf.length < 1e6) throw new Error('файл слишком маленький (' + buf.length + ' байт)');
    if (buf[0] !== 0x4d || buf[1] !== 0x5a) throw new Error('это не установщик Windows (.exe)');
    return buf;
  } finally { clearTimeout(idle); }
}

// Windows: скачиваем установщик и запускаем (обычный мастер установки поверх). Остальные ОС: открываем страницу загрузки.
// Если скачать внутри лаунчера не вышло — открываем страницу загрузки в браузере и сообщаем причину.
async function install(site, shell, quit, progress) {
  const plat = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
  const url = `${site}/download/${plat}`;
  if (plat !== 'windows') { shell.openExternal(url); return 'opened'; }
  progress(0.02);
  let buf;
  try { buf = await fetchInstaller(url, progress); }
  catch (e) {
    try { shell.openExternal(url); } catch (_) {}
    throw new Error('Не удалось скачать установщик в лаунчере (' + (e && e.message || e) + '). Страница загрузки открыта в браузере.');
  }
  const f = path.join(os.tmpdir(), `SA-Launcher-Setup-${Date.now()}.exe`);   // уникальное имя: старый файл мог быть занят
  fs.writeFileSync(f, buf); progress(1);
  spawn(f, [], { detached: true, stdio: 'ignore' }).unref(); setTimeout(quit, 400);
  return 'started';
}
module.exports = { check, install, cmp };
