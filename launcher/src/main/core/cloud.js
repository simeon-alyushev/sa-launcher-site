'use strict';
// Обмен сборкой по коду и облачные копии миров. Клиентская часть: серверные маршруты описаны в README («Что нужно на сервере»).
// Ничего не отправляется само: каждая отправка — явное действие пользователя в интерфейсе.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const U = require('./util');

const E = (key, ...a) => new Error('err:' + [key, ...a].join('|'));
// Лимиты, которые показываются в интерфейсе (сервер обязан проверять их сам)
const SHARE = { maxBytes: 25 * 1024 * 1024, ttlDays: 7 };
const CLOUD = { maxBytes: 150 * 1024 * 1024, keep: 5 };
const CODE = /^[A-Z2-9]{6,8}$/;             // без похожих символов (0/O, 1/I)
const MAGIC = Buffer.from('SACB1');

async function http(site, method, route, { headers = {}, body, raw } = {}) {
  let r;
  try { r = await fetch(site + route, { method, headers: { 'User-Agent': U.UA, ...headers }, body, signal: AbortSignal.timeout(300000) }); }
  catch (_) { throw E('cloudNet'); }
  if (r.status === 404 && raw !== 'allow404') throw E('cloudNoServer');
  if (r.status === 401 || r.status === 403) throw new Error('relogin');
  if (r.status === 413) throw E('cloudTooBig');
  if (r.status === 429) throw E('skinRate');
  if (!r.ok) throw E('skinServer', r.status);
  return r;
}

// ---- обмен сборкой по коду ----
async function shareUpload(site, buf, name) {
  if (buf.length > SHARE.maxBytes) throw E('shareTooBig', Math.round(SHARE.maxBytes / 1048576));
  const r = await http(site, 'POST', '/api/share', { headers: { 'Content-Type': 'application/octet-stream', 'X-Pack-Name': encodeURIComponent(String(name).slice(0, 60)) }, body: buf });
  const d = await r.json().catch(() => ({}));
  const code = String(d.code || '').toUpperCase(); if (!CODE.test(code)) throw E('skinServer', 'code');
  return { code, expiresAt: Number(d.expiresAt) || Date.now() + SHARE.ttlDays * 864e5 };
}
async function shareDownload(site, code) {
  code = String(code || '').trim().toUpperCase().replace(/[\s-]/g, ''); if (!CODE.test(code)) throw E('shareBadCode');
  const r = await http(site, 'GET', '/api/share/' + code, { raw: 'allow404' });
  if (r.status === 404) throw E('shareNotFound');
  const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > SHARE.maxBytes * 1.2) throw E('shareTooBig', Math.round(SHARE.maxBytes / 1048576));
  return buf;
}

// ---- шифрование: AES-256-GCM, ключ из пароля (scrypt). Пароль никуда не отправляется и не хранится. ----
function encrypt(plain, pass) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), key = crypto.scryptSync(pass, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const c = crypto.createCipheriv('aes-256-gcm', key, iv), enc = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), enc]);
}
function decrypt(buf, pass) {
  if (buf.length < 49 || !buf.subarray(0, 5).equals(MAGIC)) throw E('cloudBadFile');
  const salt = buf.subarray(5, 21), iv = buf.subarray(21, 33), tag = buf.subarray(33, 49);
  try {
    const key = crypto.scryptSync(pass, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag); return Buffer.concat([d.update(buf.subarray(49)), d.final()]);
  } catch (_) { throw E('cloudBadPass'); }
}
const checkPass = p => { if (typeof p !== 'string' || p.length < 8) throw E('cloudShortPass'); return p; };

// Имя сборки на сервере не раскрываем: используем хэш (аккаунт + id сборки)
const slot = (accId, instId) => crypto.createHash('sha256').update(accId + ':' + instId).digest('hex').slice(0, 32);
const auth = a => ({ Authorization: 'Bearer ' + a.accessToken });

function zipSaves(saves) {
  const entries = []; let total = 0;
  const walk = (dir, rel) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, rel + e.name + '/'); else if (e.isFile()) { total += fs.statSync(f).size; if (total > CLOUD.maxBytes) throw E('cloudTooBig'); entries.push({ name: 'saves/' + rel + e.name, data: fs.readFileSync(f) }); } } };
  walk(saves, ''); if (!entries.length) throw E('bkpNone');
  return U.writeZip(entries);
}
async function cloudList(site, acc, instId) {
  const r = await http(site, 'GET', `/api/cloud/worlds/${slot(acc.id, instId)}`, { headers: auth(acc) });
  const d = await r.json().catch(() => ({}));
  return (Array.isArray(d.items) ? d.items : []).filter(x => /^[A-Za-z0-9_-]{4,64}$/.test(String(x.id))).map(x => ({ id: String(x.id), created: Number(x.created) || 0, size: Number(x.size) || 0 })).slice(0, 50);
}
async function cloudUpload(site, acc, instId, savesDir, pass, progress = () => {}) {
  checkPass(pass); progress(0.1); const zip = zipSaves(savesDir); progress(0.4); const enc = encrypt(zip, pass); progress(0.6);
  const r = await http(site, 'PUT', `/api/cloud/worlds/${slot(acc.id, instId)}`, { headers: { ...auth(acc), 'Content-Type': 'application/octet-stream', 'X-Keep': String(CLOUD.keep) }, body: enc });
  progress(1); const d = await r.json().catch(() => ({})); return { id: String(d.id || ''), size: enc.length };
}
async function cloudDownload(site, acc, instId, id, pass) {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(String(id))) throw E('cloudBadFile'); checkPass(pass);
  const r = await http(site, 'GET', `/api/cloud/worlds/${slot(acc.id, instId)}/${id}`, { headers: auth(acc) });
  const buf = Buffer.from(await r.arrayBuffer()); return decrypt(buf, pass);        // zip с папкой saves/
}
async function cloudDelete(site, acc, instId, id) {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(String(id))) throw E('cloudBadFile');
  await http(site, 'DELETE', `/api/cloud/worlds/${slot(acc.id, instId)}/${id}`, { headers: auth(acc) }); return true;
}
module.exports = { SHARE, CLOUD, shareUpload, shareDownload, cloudList, cloudUpload, cloudDownload, cloudDelete, encrypt, decrypt };
