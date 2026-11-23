'use strict';
// Менеджер скинов: смена скина/плаща через официальный API Mojang (нужен вход Microsoft) и локальная коллекция скинов.
// Ошибки отдаются как 'err:<ключ перевода>' — интерфейс показывает их понятным текстом на выбранном языке.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const U = require('./util');

const API = 'https://api.minecraftservices.com/minecraft/profile';
const MAX_SKIN = 24 * 1024;                 // правило Mojang: PNG не больше 24 КБ
const MAX_SAVED = 100;
const E = (key, ...a) => new Error('err:' + [key, ...a].join('|'));
const ACC_ID = /^[0-9a-fA-F-]{32,36}$/;

// ---- проверка PNG ----
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function checkPng(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG) || buf.toString('latin1', 12, 16) !== 'IHDR') throw E('skinNotPng');
  if (buf.length > MAX_SKIN) throw E('skinSize', Math.ceil(buf.length / 1024), 24);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (w !== 64 || (h !== 64 && h !== 32)) throw E('skinDim', w, h);
  return { w, h, size: buf.length };
}
const dataUrl = buf => 'data:image/png;base64,' + buf.toString('base64');
function fromDataUrl(s) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(s || '')); if (!m || m[1].length > 60000) throw E('skinNotPng');
  return Buffer.from(m[1], 'base64');
}
// Текстуры отдаёт только textures.minecraft.net (ссылки из ответа API — недоверенные данные)
function textureUrl(u) {
  try { const x = new URL(String(u)); if (x.hostname !== 'textures.minecraft.net' || !/^\/texture\/[0-9a-f]{16,80}$/i.test(x.pathname)) return ''; return 'https://textures.minecraft.net' + x.pathname; } catch (_) { return ''; }
}
async function fetchTexture(u) {
  const url = textureUrl(u); if (!url) return null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': U.UA }, signal: AbortSignal.timeout(20000) }); if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 200 * 1024 || !buf.subarray(0, 8).equals(PNG_SIG)) return null; return buf;
  } catch (_) { return null; }
}

// Текстуры Ely.by: разрешены только https-адреса на ely.by и его поддоменах (ссылки из ответа — недоверенные данные)
function elyTextureUrl(u) {
  try { const x = new URL(String(u).replace(/^http:/, 'https:')); if (x.protocol !== 'https:' || !(x.hostname === 'ely.by' || x.hostname.endsWith('.ely.by'))) return ''; return x.toString(); } catch (_) { return ''; }
}
async function fetchPng(url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': U.UA }, signal: AbortSignal.timeout(15000) }); if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer()); return buf.length > 400 * 1024 || !buf.subarray(0, 8).equals(PNG_SIG) ? null : buf;
  } catch (_) { return null; }
}
// Скин и плащ игрока Ely.by по нику: skinsystem.ely.by/textures/<ник> (публичный, только чтение)
async function elyTextures(name) {
  let j = null;
  try { const r = await fetch('https://skinsystem.ely.by/textures/' + encodeURIComponent(name), { headers: { 'User-Agent': U.UA }, signal: AbortSignal.timeout(15000) }); if (r.ok) j = await r.json(); } catch (_) {}
  const skinUrl = elyTextureUrl(j && j.SKIN && j.SKIN.url) || 'https://skinsystem.ely.by/skins/' + encodeURIComponent(name) + '.png';
  const capeUrl = elyTextureUrl(j && j.CAPE && j.CAPE.url);
  const [skin, cape] = await Promise.all([fetchPng(skinUrl), fetchPng(capeUrl)]);
  return { skin, cape, variant: j && j.SKIN && j.SKIN.metadata && String(j.SKIN.metadata.model).toLowerCase() === 'slim' ? 'slim' : 'classic' };
}

class Skins {
  constructor({ store, dataDir, siteUrl }) { this.store = store; this.root = path.join(dataDir, 'skins'); this.site = siteUrl; }

  // ---- Mojang API ----
  async acc(accId) {
    const id = accId || this.store.settings.selected; let a = id && this.store.account(id);
    if (a && a.p === 'ely') throw E('skinEly');
    if (!a || a.p !== 'ms' || !a.accessToken || a.accessToken === '0') throw new Error('noaccount');
    return require('./auth').ensureFresh(require('../config'), this.store, a);
  }
  async call(a, method, sub, body) {
    const h = { Authorization: 'Bearer ' + a.accessToken, 'User-Agent': U.UA }; let payload;
    if (body instanceof FormData) payload = body; else if (body) { payload = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
    let r; try { r = await fetch(API + sub, { method, headers: h, body: payload, signal: AbortSignal.timeout(30000) }); } catch (_) { throw E('skinNet'); }
    if (r.ok) return r.status === 204 ? null : await r.json().catch(() => null);
    if (r.status === 401) throw new Error('relogin');
    if (r.status === 404) throw new Error('nolicense');
    if (r.status === 429) throw E('skinRate');
    if (r.status === 403) throw E('skinForbidden');
    if (r.status === 400) throw E('skinBad');
    throw E('skinServer', r.status);
  }
  async elyProfile(raw) {
    const t = await elyTextures(raw.name);
    return { id: raw.id, name: raw.name, ely: true, variant: t.variant, skin: t.skin ? dataUrl(t.skin) : '',
      capes: t.cape ? [{ id: 'ely', alias: 'Ely.by', active: true, data: dataUrl(t.cape) }] : [] };
  }
  async profile(accId) {
    const rid = accId || this.store.settings.selected; const raw = rid && this.store.account(rid);
    if (raw && raw.p === 'ely') return this.elyProfile(raw);
    const a = await this.acc(accId); const p = await this.call(a, 'GET', '');
    if (!p || !p.id) throw new Error('nolicense');
    const sk = (p.skins || []).find(x => x.state === 'ACTIVE') || (p.skins || [])[0];
    const tex = sk && await fetchTexture(sk.url);
    const capes = [];
    await U.pool((p.capes || []).slice(0, 30), 4, async c => {
      if (!/^[0-9a-f-]{36}$/i.test(c.id || '')) return; const b = await fetchTexture(c.url);
      capes.push({ id: c.id, alias: String(c.alias || '').slice(0, 40), active: c.state === 'ACTIVE', data: b ? dataUrl(b) : '' });
    });
    capes.sort((x, y) => x.alias.localeCompare(y.alias));
    return { id: p.id, name: p.name, variant: sk && String(sk.variant).toUpperCase() === 'SLIM' ? 'slim' : 'classic', skin: tex ? dataUrl(tex) : '', capes };
  }
  // Только текстура текущего скина — для аватарки аккаунта (без запросов к сторонним сервисам)
  async head(accId) {
    const rid = accId || this.store.settings.selected; const raw = rid && this.store.account(rid);
    if (raw && raw.p === 'ely') {           // скин Ely.by: публичная картинка skinsystem.ely.by
      const t = await elyTextures(raw.name); return t.skin ? dataUrl(t.skin) : '';
    }
    const a = await this.acc(accId); const p = await this.call(a, 'GET', '');
    const sk = p && (p.skins || []).find(x => x.state === 'ACTIVE'); const tex = sk && await fetchTexture(sk.url);
    return tex ? dataUrl(tex) : '';
  }
  // Выбор файла: возвращаем проверенный PNG для предпросмотра (на сервер Mojang ничего не уходит)
  inspectFile(file) {
    const st = fs.statSync(file); if (st.size > MAX_SKIN) throw E('skinSize', Math.ceil(st.size / 1024), 24);
    const buf = fs.readFileSync(file); const i = checkPng(buf);
    return { data: dataUrl(buf), w: i.w, h: i.h, size: i.size, name: path.basename(file, path.extname(file)).slice(0, 40) };
  }
  async upload(accId, dataURL, variant) {
    const buf = fromDataUrl(dataURL); checkPng(buf);                       // не доверяем тому, что прислал интерфейс
    const a = await this.acc(accId); const fd = new FormData();
    fd.append('variant', variant === 'slim' ? 'slim' : 'classic'); fd.append('file', new Blob([buf], { type: 'image/png' }), 'skin.png');
    await this.call(a, 'POST', '/skins', fd); return true;
  }
  async reset(accId) { const a = await this.acc(accId); await this.call(a, 'DELETE', '/skins/active'); return true; }
  async setCape(accId, capeId) {
    const a = await this.acc(accId);
    if (!capeId) await this.call(a, 'DELETE', '/capes/active');
    else { if (!/^[0-9a-f-]{36}$/i.test(String(capeId))) throw E('skinBad'); await this.call(a, 'PUT', '/capes/active', { capeId }); }
    return true;
  }

  // ---- локальная коллекция ----
  dir(accId) { const id = accId || this.store.settings.selected; if (!ACC_ID.test(String(id || ''))) throw new Error('noaccount'); return path.join(this.root, id); }
  index(accId) { try { const j = JSON.parse(fs.readFileSync(path.join(this.dir(accId), 'index.json'), 'utf8')); return Array.isArray(j) ? j : []; } catch (_) { return []; } }
  saveIndex(accId, list) { const d = this.dir(accId); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'index.json') + '.tmp', JSON.stringify(list)); fs.renameSync(path.join(d, 'index.json') + '.tmp', path.join(d, 'index.json')); }
  saved(accId) {
    const d = this.dir(accId);
    return this.index(accId).filter(x => /^[0-9a-f]{12}$/.test(x.id)).map(x => { try { return { id: x.id, name: x.name, variant: x.variant, added: x.added, data: dataUrl(fs.readFileSync(path.join(d, x.id + '.png'))) }; } catch (_) { return null; } }).filter(Boolean);
  }
  save(accId, dataURL, name, variant) {
    const buf = fromDataUrl(dataURL); checkPng(buf); const list = this.index(accId); const sha = U.sha1(buf);
    const dup = list.find(x => x.sha1 === sha && x.variant === (variant === 'slim' ? 'slim' : 'classic')); if (dup) return dup.id;
    if (list.length >= MAX_SAVED) throw E('skinLimit', MAX_SAVED);
    const id = crypto.randomBytes(6).toString('hex'), d = this.dir(accId); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, id + '.png'), buf);
    list.unshift({ id, name: String(name || 'Skin').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) || 'Skin', variant: variant === 'slim' ? 'slim' : 'classic', sha1: sha, added: Date.now() });
    this.saveIndex(accId, list); return id;
  }
  async saveCurrent(accId, name) { const p = await this.profile(accId); if (!p.skin) throw E('skinNone'); return this.save(p.id, p.skin, name, p.variant); }
  get(accId, id) {
    if (!/^[0-9a-f]{12}$/.test(String(id))) throw E('skinBad'); const x = this.index(accId).find(y => y.id === id); if (!x) throw E('skinBad');
    return { data: dataUrl(fs.readFileSync(path.join(this.dir(accId), id + '.png'))), variant: x.variant };
  }
  async useSaved(accId, id) { const s = this.get(accId, id); return this.upload(accId, s.data, s.variant); }
  remove(accId, id) {
    if (!/^[0-9a-f]{12}$/.test(String(id))) return false; U.rmrf(path.join(this.dir(accId), id + '.png'));
    this.saveIndex(accId, this.index(accId).filter(x => x.id !== id)); return true;
  }
}
module.exports = { Skins, checkPng, textureUrl, fromDataUrl, elyTextureUrl };
