'use strict';
// Вход через сайт: лаунчер поднимает локальный сервер на 127.0.0.1, открывает браузер на
//   <сайт>/launcher/login?port=..&state=..
// сайт авторизует (Microsoft / Ely.by) и перенаправляет браузер на http://127.0.0.1:port/callback?data=..
const http = require('http');
const crypto = require('crypto');
const { fetchJSON } = require('./util');

let current = null;
const PAGE = (ok, msg) => `<!doctype html><meta charset="utf-8"><title>SA Launcher</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#f2f4f8;font:16px system-ui,sans-serif"><div style="text-align:center;padding:36px;border-radius:28px;background:#181b22"><div style="font-size:40px">${ok ? '✓' : '!'}</div><h2>${msg}</h2><p style="color:#9aa3b2">${ok ? 'Можно закрыть эту вкладку и вернуться в SA Launcher.' : ''}</p></div>`;

function login(siteUrl, openExternal) {
  if (current) current.cancel();
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(24).toString('base64url');
    let done = false;
    const finish = (err, acc) => { if (done) return; done = true; clearTimeout(timer); srv.close(); current = null; err ? reject(err) : resolve(acc); };
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/callback') { res.writeHead(404); return res.end(); }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (u.searchParams.get('state') !== state) { res.writeHead(400); return res.end(PAGE(false, 'Неверный state')); }
      if (u.searchParams.get('error')) { res.end(PAGE(false, 'Вход отменён')); return finish(new Error('cancelled')); }
      try {
        const acc = JSON.parse(Buffer.from(u.searchParams.get('data') || '', 'base64url').toString('utf8'));
        if (!acc.id || !acc.name) throw new Error('bad data');
        res.end(PAGE(true, 'Вы вошли как ' + String(acc.name).replace(/[<>&]/g, '')));
        finish(null, acc);
      } catch (e) { res.writeHead(400); res.end(PAGE(false, 'Ошибка данных входа')); finish(e); }
    });
    const timer = setTimeout(() => finish(new Error('timeout')), 10 * 60e3);
    current = { cancel: () => finish(new Error('cancelled')) };
    srv.on('error', finish);
    srv.listen(0, '127.0.0.1', () => openExternal(`${siteUrl}/launcher/login?port=${srv.address().port}&state=${state}`));
  });
}
const cancel = () => { if (current) current.cancel(); };

// Обновляет токен, если он истекает в ближайшие 2 минуты
async function ensureFresh(siteUrl, store, acc) {
  if (acc.expiresAt && acc.expiresAt - Date.now() > 120000) return acc;
  if (!acc.refreshToken) { if (acc.expiresAt && acc.expiresAt < Date.now()) throw new Error('relogin'); return acc; }
  try {
    const r = await fetchJSON(`${siteUrl}/api/link/refresh`, { method: 'POST', body: { p: acc.p, refreshToken: acc.refreshToken } });
    const n = { ...acc, ...r.account }; store.saveAccount(n); return n;
  } catch (e) { if (acc.expiresAt && acc.expiresAt > Date.now()) return acc; throw new Error('relogin'); }
}
module.exports = { login, cancel, ensureFresh };
