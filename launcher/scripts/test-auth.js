'use strict';
// Проверка цепочки входа на подставных ответах (без сети): node scripts/test-auth.js
const assert = require('assert');
const calls = [];
let xerr = null, profile404 = false;
global.fetch = async (url, o = {}) => {
  calls.push(url);
  const J = (d, status = 200) => ({ ok: status < 400, status, json: async () => d });
  if (url.includes('oauth20_token.srf')) { const b = new URLSearchParams(o.body); assert.equal(b.get('client_id'), '00000000402b5328'); return J({ access_token: 'MSA', refresh_token: 'RT2', expires_in: 3600 }); }
  if (url.includes('user/authenticate')) { assert.equal(JSON.parse(o.body).Properties.RpsTicket, 'MSA'); return J({ Token: 'XBL', DisplayClaims: { xui: [{ uhs: 'UHS' }] } }); }
  if (url.includes('xsts/authorize')) return xerr ? J({ XErr: xerr }, 401) : J({ Token: 'XSTS' });
  if (url.includes('login_with_xbox')) { assert.equal(JSON.parse(o.body).identityToken, 'XBL3.0 x=UHS;XSTS'); return J({ access_token: 'MCTOKEN', expires_in: 86400 }); }
  if (url.endsWith('/minecraft/profile')) { assert.equal(o.headers.Authorization, 'Bearer MCTOKEN'); return profile404 ? J({}, 404) : J({ id: 'abc123', name: 'Steve', skins: [{ state: 'ACTIVE', url: 'http://skin' }] }); }
  throw new Error('unexpected ' + url);
};
const auth = require('../src/main/core/auth');
const cfg = require('../src/main/config');
const saved = [];
const store = { saveAccount: a => saved.push(a) };
(async () => {
  assert.equal(cfg.msClientId, '00000000402b5328');
  const old = { p: 'ms', id: 'abc123', name: 'Old', refreshToken: 'RT1', expiresAt: Date.now() - 1000 };
  const n = await auth.ensureFresh(cfg, store, old);
  assert.equal(n.accessToken, 'MCTOKEN'); assert.equal(n.refreshToken, 'RT2'); assert.equal(n.name, 'Steve'); assert.equal(n.skin, 'http://skin'); assert.equal(saved.length, 1);
  assert.equal((await auth.ensureFresh(cfg, store, n)).accessToken, 'MCTOKEN'); // свежий токен — без запросов
  xerr = 2148916238; await assert.rejects(() => auth.ensureFresh(cfg, store, old), /детский/);
  xerr = 2148916233; await assert.rejects(() => auth.ensureFresh(cfg, store, old), /профиля Xbox/);
  xerr = null; profile404 = true; await assert.rejects(() => auth.ensureFresh(cfg, store, old), /nolicense/);
  await assert.rejects(() => auth.ensureFresh(cfg, store, { ...old, refreshToken: null }), /relogin/);
  console.log('auth: OK');
})().catch(e => { console.error(e); process.exit(1); });
