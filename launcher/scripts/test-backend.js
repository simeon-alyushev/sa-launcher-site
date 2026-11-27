// Логика бэкенда (проверка владельца, блокировки, отзыв сессий) и правила Firestore — без сети.   node scripts/test-backend.js
// Ограничение: сами правила Firestore здесь проверяются статическим разбором; полную проверку даёт эмулятор Firebase (см. firebase/README.md).
const assert = require('assert'), fs = require('fs'), path = require('path');
const C = require('../../firebase/functions/lib/core');
const OWNER = '11111111-2222-4333-8444-555555555555', OWNER_N = OWNER.replace(/-/g, ''), OTHER = 'aaaaaaaabbbb4ccc8dddeeeeeeeeeeee';
// «Mojang»: токен -> профиль. Всё, чего нет в таблице, Mojang отвергает (так будет с токеном Ely.by и любым выдуманным).
const TOK = { 'owner-token': { id: OWNER_N, name: 'simeon1alyushev' }, 'other-token': { id: OTHER, name: 'simeon1alyushev' }, 'old-owner': { id: OWNER_N.toUpperCase(), name: 'simeon1alyushev' } };
const mojang = async (url, o) => { const t = String((o.headers.Authorization || '').replace('Bearer ', '')); assert(url.startsWith('https://api.minecraftservices.com/')); const p = TOK[t];
  if (t === 'no-license') return { status: 404, ok: false, json: async () => ({}) }; if (t === 'down') return { status: 503, ok: false, json: async () => ({}) }; if (t === 'garbage') return { status: 200, ok: true, json: async () => ({ id: 'zzz', name: '<script>' }) };
  return p ? { status: 200, ok: true, json: async () => p } : { status: 401, ok: false, json: async () => ({}) }; };
(async () => {
  const owner = C.ownerUuidFrom(OWNER);
  // 1) UUID: с дефисами и без, любой регистр; неверное значение настройки = владельца нет
  assert.strictEqual(owner, OWNER_N); assert.strictEqual(C.ownerUuidFrom(OWNER_N.toUpperCase()), OWNER_N);
  for (const bad of ['', undefined, 'simeon1alyushev', '123', OWNER_N + 'ab', 'zz' + OWNER_N.slice(2)]) assert.strictEqual(C.ownerUuidFrom(bad), '', 'не UUID: ' + bad);
  // 2) вход владельца: UUID берётся из ответа Mojang
  const p1 = await C.verifyMinecraft('owner-token', mojang); assert.deepStrictEqual(p1, { uuid: OWNER_N, name: 'simeon1alyushev' });
  const d1 = C.decideSession({ profile: p1, ownerUuid: owner, ban: null, now: 1 }); assert(d1.owner && d1.issueToken && d1.uid === 'mc-' + OWNER_N);
  assert((await C.verifyMinecraft('old-owner', mojang)).uuid === OWNER_N, 'регистр UUID нормализуется');
  // 3) ТОТ ЖЕ НИК, другой UUID (чужой аккаунт или Ely.by с таким же ником) — не владелец
  const d2 = C.decideSession({ profile: await C.verifyMinecraft('other-token', mojang), ownerUuid: owner, ban: null, now: 1 }); assert(!d2.owner && d2.issueToken, 'ник не даёт прав');
  // 4) токен, который Mojang не знает (Ely.by, офлайн, подделка), отвергается; кривые токены не уходят в сеть
  await assert.rejects(C.verifyMinecraft('ely-by-token', mojang), e => e.code === 'badtoken');
  let called = 0; const spy = async (...a) => { called++; return mojang(...a); };
  for (const bad of ['', null, undefined, 'a b', 'x'.repeat(5000), 'tok\nen', '<script>', {}]) await assert.rejects(C.verifyMinecraft(bad, spy), e => e.code === 'badtoken'); assert.strictEqual(called, 0, 'плохой токен не доходит до сети');
  await assert.rejects(C.verifyMinecraft('no-license', mojang), e => e.code === 'nolicense'); await assert.rejects(C.verifyMinecraft('down', mojang), e => e.code === 'upstream'); await assert.rejects(C.verifyMinecraft('garbage', mojang), e => e.code === 'upstream', 'мусорный ответ Mojang');
  await assert.rejects(C.verifyMinecraft('owner-token', async () => { throw new Error('net'); }), e => e.code === 'upstream');
  // 5) если OWNER_UUID не настроен, владельца нет, даже у «правильного» аккаунта
  assert(!C.decideSession({ profile: p1, ownerUuid: '', ban: null, now: 1 }).owner);
  // 6) блокировки: активная, истёкшая, снятая, бессрочная; заблокированный не получает токен; владельца заблокировать нельзя
  const now = 1e12, bn = (x) => ({ reason: 'cheats', ...x });
  assert(C.isBanActive(bn({ until: now + 1 }), now) && C.isBanActive(bn({ until: null }), now) && !C.isBanActive(bn({ until: now - 1 }), now) && !C.isBanActive(bn({ until: null, revoked: true }), now) && !C.isBanActive(null, now));
  const d3 = C.decideSession({ profile: { uuid: OTHER }, ownerUuid: owner, ban: bn({ until: null }), now }); assert(d3.banned && !d3.issueToken && d3.ban.reason === 'cheats' && d3.ban.until === null);
  const d4 = C.decideSession({ profile: { uuid: OTHER }, ownerUuid: owner, ban: bn({ until: now - 5 }), now }); assert(!d4.banned && d4.issueToken, 'срок истёк');
  const d5 = C.decideSession({ profile: p1, ownerUuid: owner, ban: bn({ until: null }), now }); assert(d5.owner && !d5.banned && d5.issueToken, 'владельца заблокировать нельзя');
  assert(C.decideSession({ profile: { uuid: OTHER }, ownerUuid: owner, ban: bn({ reason: 'x'.repeat(900), until: null }), now }).ban.reason.length === 300, 'причина урезана');
  // 7) вызовы владельца: UUID сверяется заново; выход отзывает сессию; чужие, пустые и «прошлые» сессии отвергаются
  const chk = o => C.checkOwnerCall({ ownerUuid: owner, uid: 'mc-' + OWNER_N, authTimeSec: 2000, tokensValidAfterMs: 0, ...o });
  assert(chk({}).ok); assert.strictEqual(chk({ uid: 'mc-' + OTHER }).code, 'denied'); assert.strictEqual(chk({ uid: undefined }).code, 'denied'); assert.strictEqual(chk({ uid: 'MC-' + OWNER_N }).code, 'denied');
  assert.strictEqual(chk({ ownerUuid: '' }).code, 'unconfigured'); assert.strictEqual(chk({ tokensValidAfterMs: 3000 * 1000 }).code, 'revoked', 'после выхода токен недействителен');
  assert(chk({ tokensValidAfterMs: 1000 * 1000 }).ok, 'вход после отзыва — действителен');
  assert.strictEqual(chk({ ownerUuid: C.ownerUuidFrom(OTHER) }).code, 'denied', 'владелец сменился в настройке — старый токен не проходит');
  // 8) аудит: секреты не попадают в журнал
  const a = C.auditEntry({ actor: OWNER, action: 'discord.set', target: 'x', details: { webhook: 'https://discord.com/api/webhooks/1/secret', token: 'abc', nested: { apiKey: 'k', ok: 'v' }, list: [{ password: 'p' }], note: 'n'.repeat(500) }, now: 5 });
  assert.strictEqual(a.details.webhook, '[скрыто]'); assert.strictEqual(a.details.token, '[скрыто]'); assert.strictEqual(a.details.nested.apiKey, '[скрыто]'); assert.strictEqual(a.details.nested.ok, 'v'); assert.strictEqual(a.details.list[0].password, '[скрыто]'); assert(a.details.note.length <= 301);
  assert(!JSON.stringify(a).includes('discord.com/api') && a.actor === OWNER_N);
  // 9) ограничение частоты входа
  const L = C.limiter(3, 1000); assert([1, 2, 3].every(() => L.hit('ip', 10)) && !L.hit('ip', 20) && L.hit('other', 20) && L.hit('ip', 2000), 'лимит и окно');

  // 10) правила Firestore (статически): любая запись с клиента закрыта, секреты закрыты, есть запрет по умолчанию
  const rules = fs.readFileSync(path.join(__dirname, '../../firebase/firestore.rules'), 'utf8').replace(/\/\/.*$/gm, '');
  const allows = [...rules.matchAll(/allow\s+([a-z, ]+?)\s*:\s*if\s+([^;]+);/g)].map(m => ({ ops: m[1].split(/\s*,\s*/), cond: m[2].trim() }));
  assert(allows.length > 5);
  for (const x of allows) if (x.ops.some(o => ['write', 'create', 'update', 'delete'].includes(o))) assert.strictEqual(x.cond, 'false', 'запись с клиента должна быть закрыта: ' + JSON.stringify(x));
  assert(!allows.some(x => /^true$/.test(x.cond)), 'нет открытого «if true»');
  assert(/match \/secrets\/\{doc\}\s*\{\s*allow read, write: if false;\s*\}/.test(rules), 'секреты закрыты');
  assert(/match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/.test(rules), 'запрет по умолчанию');
  assert(/function isOwner\(\) \{ return signedIn\(\) && request\.auth\.token\.owner == true; \}/.test(rules));
  assert(/match \/builds\/\{id\}\s*\{\s*allow read: if resource\.data\.status == 'published' \|\| isOwner\(\);/.test(rules), 'черновики сборок скрыты от посторонних');
  console.log('OK backend');
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
