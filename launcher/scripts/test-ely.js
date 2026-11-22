'use strict';
// Вход Ely.by, обновление токена, authlib-injector и хранение — на подставных ответах: node scripts/test-ely.js
const assert = require('assert'), crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path');
const JAR = Buffer.from('fake-jar-bytes'); const SHA = crypto.createHash('sha256').update(JAR).digest('hex');
let mode = 'ok', validate = 204, refresh = 200, offline = false;
global.fetch = async (url, o = {}) => {
  if (offline) throw new TypeError('network');
  const J = (d, status = 200) => ({ ok: status < 400, status, json: async () => d, arrayBuffer: async () => JAR });
  const body = o.body && typeof o.body === 'string' && o.body[0] === '{' ? JSON.parse(o.body) : {};
  if (url.endsWith('/auth/authenticate')) {
    if (mode === '2fa') return J({ error: 'ForbiddenOperationException', errorMessage: 'Account protected with two factor auth.' }, 401);
    if (mode === 'bad') return J({ error: 'ForbiddenOperationException', errorMessage: 'Invalid credentials.' }, 401);
    if (mode === 'rate') return J({}, 429);
    assert.equal(body.username, 'Steve'); assert.equal(body.password, mode === 'totp' ? 'pw:123456' : 'pw');
    return J({ accessToken: 'ACC1', clientToken: body.clientToken, selectedProfile: { id: 'AABBCCDD-0000-4000-8000-000000000001', name: 'Steve' } });
  }
  if (url.endsWith('/auth/validate')) return J({}, validate);
  if (url.endsWith('/auth/refresh')) { assert.equal(body.accessToken, 'ACC1'); assert.equal(body.clientToken, 'CT'); return refresh === 200 ? J({ accessToken: 'ACC2', clientToken: 'CT' }) : J({}, refresh); }
  if (url.endsWith('latest.json')) return J({ version: '1.2.5', download_url: 'https://authlib-injector.yushi.moe/artifact/55/authlib-injector-1.2.5.jar', checksums: { sha256: mode === 'badsha' ? '0'.repeat(64) : SHA } });
  if (url.endsWith('.jar')) return J({});
  throw new Error('unexpected ' + url);
};
const auth = require('../src/main/core/auth'), ely = require('../src/main/core/ely'), { Store } = require('../src/main/core/store');
const cfg = require('../src/main/config');
(async () => {
  const a = await auth.loginEly({ username: ' Steve ', password: 'pw' });
  assert.equal(a.p, 'ely'); assert.equal(a.id, 'aabbccdd000040008000000000000001'); assert.equal(a.name, 'Steve'); assert.ok(a.clientToken);
  mode = 'totp'; await auth.loginEly({ username: 'Steve', password: 'pw', totp: '123 456' });
  mode = '2fa'; await assert.rejects(() => auth.loginEly({ username: 'Steve', password: 'pw' }), /err:ely2fa/);
  mode = 'bad'; await assert.rejects(() => auth.loginEly({ username: 'Steve', password: 'x' }), /err:elyBad/);
  mode = 'rate'; await assert.rejects(() => auth.loginEly({ username: 'Steve', password: 'x' }), /err:elyRate/);
  await assert.rejects(() => auth.loginEly({ username: '', password: '' }), /err:elyBad/);

  // токен: жив -> без обновления; протух -> refresh; отказ -> relogin; нет сети -> старый токен
  const saved = [], store = { saveAccount: x => saved.push(x) }; const acc = { p: 'ely', id: 'x', name: 'Steve', accessToken: 'ACC1', clientToken: 'CT' };
  assert.equal((await auth.ensureFresh(cfg, store, acc)).accessToken, 'ACC1'); assert.equal(saved.length, 0);
  validate = 403; assert.equal((await auth.ensureFresh(cfg, store, acc)).accessToken, 'ACC2'); assert.equal(saved.length, 1);
  refresh = 401; await assert.rejects(() => auth.ensureFresh(cfg, store, acc), /relogin/);
  offline = true; assert.equal((await auth.ensureFresh(cfg, store, acc)).accessToken, 'ACC1'); offline = false;

  // authlib-injector: скачивание, проверка SHA-256, повторный запуск без сети
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-ely-')); mode = 'ok';
  const jar = await ely.ensureInjector(dir); assert.ok(jar.endsWith('authlib-injector-1.2.5.jar')); assert.deepEqual(fs.readFileSync(jar), JAR);
  offline = true; assert.equal(await ely.ensureInjector(dir), jar); offline = false;
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-ely-')); mode = 'badsha';
  await assert.rejects(() => ely.ensureInjector(dir2), /err:elyInjector/); assert.deepEqual(fs.readdirSync(path.join(dir2, 'authlib-injector')), []);
  offline = true; await assert.rejects(() => ely.ensureInjector(dir2), /err:elyInjector/); offline = false;

  // хранилище: clientToken шифруется вместе с токеном, Ely-аккаунт не удаляется при старте, прочие — удаляются
  const sd = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-st-')); const st = new Store(sd);
  st.saveAccount({ ...a, accessToken: 'ACC1', clientToken: 'CT' }); st.saveAccount({ p: 'offline', id: 'o1', name: 'Off', accessToken: '0' });
  st.purgeUnlicensed(); assert.deepEqual(st.accounts().map(x => x.p), ['ely']);
  const back = st.account(a.id); assert.equal(back.clientToken, 'CT'); assert.equal(back.accessToken, 'ACC1');
  assert.ok(!fs.readFileSync(path.join(sd, 'settings.json'), 'utf8').includes('"clientToken"'));
  console.log('ely: OK');
})().catch(e => { console.error(e); process.exit(1); });
