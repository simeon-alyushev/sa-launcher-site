// Клиент бэкенда в лаунчере против «поддельного Firebase» (сервером служит настоящая логика firebase/functions/lib/core.js).   node scripts/test-fb.js
const assert = require('assert'), fs = require('fs');
const C = require('../../firebase/functions/lib/core'), { Backend, okCfg } = require('../src/main/core/fb');
const OWNER = '11111111-2222-4333-8444-555555555555', OWNER_N = OWNER.replace(/-/g, ''), OTHER = 'aaaaaaaabbbb4ccc8dddeeeeeeeeeeee', BANNED = 'bbbbbbbbbbbb4ccc8dddffffffffffff';
const CFG = { projectId: 'sa-test-project', apiKey: 'AIzaSyTestKeyTestKeyTestKey123456', region: 'europe-central2' };
let clock = 1e12; const now = () => clock;
function makeServer() {
  const log = [], revoked = {}, bans = { [BANNED]: { reason: 'cheats', until: null } }, mcTokens = { 'tok-owner': { id: OWNER_N, name: 'simeon1alyushev' }, 'tok-other': { id: OTHER, name: 'simeon1alyushev' }, 'tok-banned': { id: BANNED, name: 'bad' } };
  const mojang = async (url, o) => { const p = mcTokens[String(o.headers.Authorization).replace('Bearer ', '')]; return p ? { status: 200, ok: true, json: async () => p } : { status: 401, ok: false, json: async () => ({}) }; };
  const res = (status, body) => ({ status, ok: status < 400, json: async () => body });
  const idOf = (uid, owner, authTime) => `id|${uid}|${owner}|${authTime}`, parseId = t => { const m = /^id\|([^|]+)\|(true|false)\|(\d+)$/.exec(String(t || '').replace('Bearer ', '')); return m ? { uid: m[1], owner: m[2] === 'true', authTime: +m[3] } : null; };
  const f = async (url, o = {}) => {
    const u = new URL(url); log.push({ host: u.hostname, path: u.pathname, body: o.body });
    const body = o.body && !/x-www-form/.test(o.headers['Content-Type']) ? JSON.parse(o.body) : {};
    if (u.hostname === 'identitytoolkit.googleapis.com') { const m = /^custom\|([^|]+)\|(true|false)$/.exec(body.token || ''); return m ? res(200, { idToken: idOf(m[1], m[2], clock), refreshToken: 'rt|' + m[1] + '|' + m[2] + '|' + clock, expiresIn: '3600' }) : res(400, {}); }
    if (u.hostname === 'securetoken.googleapis.com') { const m = /^rt\|([^|]+)\|(true|false)\|(\d+)$/.exec(new URLSearchParams(o.body).get('refresh_token')); if (!m || (revoked[m[1]] && +m[3] < revoked[m[1]])) return res(400, { error: 'TOKEN_EXPIRED' }); return res(200, { id_token: idOf(m[1], m[2], clock), refresh_token: m[0], expires_in: '3600' }); }
    if (!u.hostname.endsWith('.cloudfunctions.net')) return res(404, {});
    const fn = u.pathname.slice(1), auth = parseId(o.headers.Authorization);
    if (fn === 'sessionLogin') {
      let profile; try { profile = await C.verifyMinecraft(body.data.mcToken, mojang); } catch (e) { return res(401, { error: { status: 'UNAUTHENTICATED' } }); }
      const d = C.decideSession({ profile, ownerUuid: C.ownerUuidFrom(OWNER), ban: bans[profile.uuid], now: clock });
      return res(200, { result: d.issueToken ? { ok: true, token: `custom|${d.uid}|${d.owner}`, uid: d.uid, owner: d.owner } : { ok: true, banned: true, ban: d.ban, owner: false } });
    }
    if (!auth) return res(401, { error: { status: 'UNAUTHENTICATED' } });
    if (fn === 'sessionLogout') { revoked[auth.uid] = clock; return res(200, { result: { ok: true } }); }
    if (fn === 'ownerPing' || fn === 'ownerStats') { const r = C.checkOwnerCall({ uid: auth.uid, authTimeSec: auth.authTime / 1000, tokensValidAfterMs: revoked[auth.uid] || 0, ownerUuid: C.ownerUuidFrom(OWNER) }); return r.ok ? res(200, { result: { ok: true, owner: true } }) : res(r.code === 'revoked' ? 401 : 403, { error: { status: r.code === 'revoked' ? 'UNAUTHENTICATED' : 'PERMISSION_DENIED' } }); }
    return res(404, {});
  };
  return { f, log, revoked, parseId, idOf };
}
const msAcc = (tok, id) => ({ p: 'ms', id, name: 'simeon1alyushev', accessToken: tok });
(async () => {
  // 0) без записи на диск: никакие токены не сохраняются
  const writes = []; const ow = fs.writeFileSync, oa = fs.appendFileSync; fs.writeFileSync = (...a) => { writes.push(a[0]); return ow(...a); }; fs.appendFileSync = (...a) => { writes.push(a[0]); return oa(...a); };

  // 1) не настроен: ничего не делает и в сеть не ходит; неверная конфигурация считается ненастроенной
  let hits = 0; const none = new Backend({ cfg: {}, fetchImpl: async () => { hits++; } });
  assert(!none.status().configured); await none.login(msAcc('tok-owner', OWNER_N)); await assert.rejects(none.call('ownerPing'), /fbNotConfigured/); assert.strictEqual(hits, 0);
  for (const bad of [{ ...CFG, apiKey: 'short' }, { ...CFG, projectId: 'Bad Project' }, { ...CFG, region: 'x' }, null]) assert(!okCfg(bad));
  assert(okCfg(CFG));

  // 2) владелец через Microsoft: сервер подтвердил UUID → панель доступна
  const S = makeServer(), ev = []; const b = new Backend({ cfg: CFG, version: '1.9.7', fetchImpl: S.f, now, onChange: s => ev.push(s) });
  let st = await b.login(msAcc('tok-owner', OWNER_N), { consent: true }); assert(st.signedIn && st.owner && st.uid === 'mc-' + OWNER_N, JSON.stringify(st));
  assert.deepStrictEqual(await b.call('ownerPing'), { ok: true, owner: true });
  const sent = JSON.parse(S.log.find(x => x.path === '/sessionLogin').body).data; assert(sent.consent === true && sent.version === '1.9.7');
  // 3) токен Minecraft уходит только на нашу функцию; больше никуда
  assert(S.log.every(x => /\.cloudfunctions\.net$|^identitytoolkit\.googleapis\.com$|^securetoken\.googleapis\.com$/.test(x.host)), 'хосты: ' + [...new Set(S.log.map(x => x.host))]);
  assert(!S.log.filter(x => x.host !== 'europe-central2-sa-test-project.cloudfunctions.net').some(x => (x.body || '').includes('tok-owner')), 'токен Minecraft не уходит третьим лицам');

  // 4) обычный игрок с тем же ником: не владелец; сервер отказывает, даже если подделать локальный флаг
  const S2 = makeServer(), o = new Backend({ cfg: CFG, fetchImpl: S2.f, now });
  st = await o.login(msAcc('tok-other', OTHER)); assert(st.signedIn && !st.owner);
  o.session.owner = true;                                             // «взлом»: правим флаг в памяти
  assert(o.status().owner === true, 'флаг подделан'); await assert.rejects(o.call('ownerPing'), /fbDenied/, 'сервер не доверяет флагу'); assert.strictEqual(o.status().owner, false, 'после отказа сервера флаг гаснет');
  // 5) Ely.by и офлайн-аккаунты: на сервер не отправляются, прав нет даже при совпадении ника
  const S3 = makeServer(), e = new Backend({ cfg: CFG, fetchImpl: S3.f, now });
  for (const acc of [{ p: 'ely', id: OWNER_N, name: 'simeon1alyushev', accessToken: 'tok-owner' }, { p: 'offline', id: OWNER_N, name: 'simeon1alyushev' }, { p: 'ms', id: OWNER_N, name: 'simeon1alyushev' }, null]) { st = await e.login(acc); assert(!st.signedIn && !st.owner); }
  assert.strictEqual(S3.log.length, 0, 'ничего не отправлено'); await assert.rejects(e.call('ownerPing'), /fbSignedOut/);
  // 6) чужой/подделанный токен Minecraft: сервер отвергает, прав нет
  st = await e.login(msAcc('tok-forged', OWNER_N)); assert(!st.signedIn && st.error === 'fbToken');
  // 7) смена аккаунта отключает права сразу, без сети
  const before = S.log.length; b.bind('other-account'); assert(!b.status().signedIn && !b.status().owner && S.log.length === before); await assert.rejects(b.call('ownerPing'), /fbSignedOut/);
  // 8) выход: права пропадают мгновенно, сервер отзывает сессию → старый токен, украденный до выхода, не работает
  await b.login(msAcc('tok-owner', OWNER_N)); const stolen = b.session.idToken; clock += 10; const lo = b.logout(); assert(!b.status().signedIn, 'права сняты сразу, до ответа сервера'); await lo;
  const replay = await S.f('https://europe-central2-sa-test-project.cloudfunctions.net/ownerPing', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + stolen }, body: '{"data":{}}' });
  assert.strictEqual(replay.status, 401, 'украденный токен после выхода отвергнут');
  clock += 10; st = await b.login(msAcc('tok-owner', OWNER_N)); assert(st.owner, 'новый вход после выхода работает'); assert.deepStrictEqual(await b.call('ownerPing'), { ok: true, owner: true });
  // 9) блокировка: токен Firebase не выдаётся, причина доступна для показа
  const bb = new Backend({ cfg: CFG, fetchImpl: makeServer().f, now }); st = await bb.login(msAcc('tok-banned', BANNED)); assert(!st.signedIn && st.ban && st.ban.reason === 'cheats' && st.ban.until === null);
  // 10) обновление токена по времени; провал обновления снимает сессию
  clock += 3600e3 - 30e3; const old = b.session.idToken; await b.call('ownerPing'); assert.notStrictEqual(b.session.idToken, old, 'токен обновлён');
  clock += 5; S.revoked['mc-' + OWNER_N] = clock; clock += 3600e3; await assert.rejects(b.call('ownerPing'), /fbSignedOut/); assert(!b.status().signedIn);
  // 11) сеть недоступна; функции вне списка не вызываются
  const nb = new Backend({ cfg: CFG, fetchImpl: async () => { throw new Error('net'); }, now }); st = await nb.login(msAcc('tok-owner', OWNER_N)); assert(!st.signedIn && st.error === 'fbNet');
  const S4 = makeServer(), c = new Backend({ cfg: CFG, fetchImpl: S4.f, now }); await c.login(msAcc('tok-owner', OWNER_N)); const n0 = S4.log.length;
  for (const bad of ['sessionLogin', 'deleteEverything', '../x', 'ownerPing/../x']) await assert.rejects(c.call(bad), /fbDenied/); assert.strictEqual(S4.log.length, n0, 'вне списка — без запроса');
  assert(ev.length > 0 && ev.every(x => !('idToken' in x) && !('session' in x)), 'в событиях для интерфейса нет токенов');
  assert(!JSON.stringify(c.status()).includes('id|'), 'status() не содержит токенов');
  // 12) на диск ничего не писалось
  fs.writeFileSync = ow; fs.appendFileSync = oa; assert.deepStrictEqual(writes.filter(w => typeof w === 'string' && !/^\/dev\//.test(w)), [], 'токены не записываются на диск');
  console.log('OK fb');
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
