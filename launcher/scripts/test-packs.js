// Проверка интеграций ATLauncher и Technic без интернета:  node scripts/test-packs.js
// Сетевой fetch подменяется ответами по документированным схемам API; всё остальное (разбор, проверка адресов и MD5,
// распаковка, создание сборки, откат при ошибке) — настоящий код лаунчера. Скачивание Minecraft/загрузчика не выполняется (prepare подменён).
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const U = require('../src/main/core/util');
const { Instances } = require('../src/main/core/instances');

const mod = (s) => Buffer.from(s), json = o => Buffer.from(JSON.stringify(o));
const modA = mod('jar-A'), modB = mod('jar-B'), modC = mod('jar-C-server');
const cfgZip = U.writeZip([{ name: 'config/atl.cfg', data: mod('x=1') }, { name: '../evil.txt', data: mod('zip-slip') }]);
const versionJson = { id: '1.12.2-forge1.12.2-14.23.5.2860', inheritsFrom: '1.12.2', libraries: [{ name: 'net.minecraftforge:forge:1.12.2-14.23.5.2860' }, { name: 'org.ow2.asm:asm-all:5.2' }] };
const modpackJar = U.writeZip([{ name: 'version.json', data: json(versionJson) }]);
const technicDirect = U.writeZip([{ name: 'bin/modpack.jar', data: modpackJar }, { name: 'mods/tech.jar', data: mod('T') }, { name: 'config/t.cfg', data: mod('c') }]);
const nested = U.writeZip([{ name: 'MyPack/bin/modpack.jar', data: modpackJar }, { name: 'MyPack/mods/n.jar', data: mod('N') }]);
const solderZipA = U.writeZip([{ name: 'mods/s1.jar', data: mod('S1') }]);
const solderZipForge = U.writeZip([{ name: 'bin/modpack.jar', data: modpackJar }]);

const ok = (data) => ({ error: false, code: 200, message: null, data });
let badMd5 = false, evilUrl = false;
const routes = {
  'https://api.atlauncher.com/v1/packs/simple': () => json(ok([{ id: 1, name: 'All The Mods 9', safeName: 'AllTheMods9', type: 'public', __LINK: 'x' }, { id: 2, name: 'Secret', safeName: 'Secret', type: 'private' }, { id: 3, name: 'Bad/Name', safeName: '../x', type: 'public' }])),
  'https://api.atlauncher.com/v1/pack/AllTheMods9/latest': () => json(ok({ version: '1.2.3', minecraftVersion: '1.20.1', recommended: true, published: 1, serverZipURL: '', changelog: '' })),
  'https://download.nodecdn.net/containers/atl/packs/AllTheMods9/versions/1.2.3/Configs.json': () => json({
    minecraft: '1.20.1', loader: { type: 'forge', version: '47.2.0' }, mods: [
      { name: 'Direct', file: 'direct.jar', download: 'direct', url: 'https://cdn.modrinth.com/data/a/direct.jar', md5: U.md5(modA), type: 'mods' },
      { name: 'ServerHosted', file: 'srv.jar', download: 'server', url: 'mods/srv.jar', md5: U.md5(modC), type: 'mods' },
      { name: 'Browser', file: 'br.jar', download: 'browser', url: 'https://www.curseforge.com/minecraft/mc-mods/x', type: 'mods' },
      { name: 'Evil host', file: 'evil.jar', download: 'direct', url: 'https://evil.example.org/evil.jar', type: 'mods' },
      { name: 'BadMd5', file: 'bad.jar', download: 'direct', url: 'https://cdn.modrinth.com/data/b/bad.jar', md5: U.md5(modB), type: 'mods' },
      { name: 'Traversal', file: '../../escape.jar', download: 'direct', url: 'https://cdn.modrinth.com/data/a/direct.jar', type: 'mods' },
      { name: 'Pack', file: 'rp.zip', download: 'direct', url: 'https://cdn.modrinth.com/data/c/rp.zip', type: 'resourcepack' },
      { name: 'OptionalOff', file: 'opt.jar', download: 'direct', url: 'https://cdn.modrinth.com/data/a/direct.jar', optional: true, type: 'mods' },
      { name: 'ServerOnly', file: 'so.jar', download: 'direct', url: 'https://cdn.modrinth.com/data/a/direct.jar', client: false, type: 'mods' },
      { name: 'Patch', file: 'p.jar', download: 'direct', url: 'https://cdn.modrinth.com/data/a/direct.jar', type: 'jar' }
    ]
  }),
  'https://download.nodecdn.net/containers/atl/packs/AllTheMods9/versions/1.2.3/Configs.zip': () => cfgZip,
  'https://cdn.modrinth.com/data/a/direct.jar': () => modA,
  'https://cdn.modrinth.com/data/b/bad.jar': () => mod('CORRUPTED'),
  'https://cdn.modrinth.com/data/c/rp.zip': () => mod('rp'),
  'https://download.nodecdn.net/containers/atl/files/mods/srv.jar': () => ({ status: 404 }),
  'https://download.nodecdn.net/containers/atl/mods/srv.jar': () => modC,

  'https://api.technicpack.net/search?q=tekkit&build=999': () => json({ modpacks: [{ id: '1', name: 'Tekkit', slug: 'tekkit', url: 'x' }, { id: '2', name: 'Srv', slug: 'srvpack', url: 'x' }, { id: '3', name: 'x', slug: '../bad', url: 'x' }] }),
  'https://api.technicpack.net/modpack/tekkit?build=999': () => json({ id: 1, name: 'tekkit', displayName: 'Tekkit <b>Classic</b>', user: 'Slowpoke', url: 'http://mirror.technicpack.net/Technic/tekkit.zip', minecraft: '1.12.2', version: '1', downloads: 777, description: '<p>Big &nbsp;pack</p>', icon: { url: 'https://platform.technicpack.net/i.png', md5: '' }, solder: null, isServer: false }),
  'https://api.technicpack.net/modpack/srvpack?build=999': () => json({ id: 2, name: 'srvpack', displayName: 'Srv', isServer: true }),
  'https://mirror.technicpack.net/Technic/tekkit.zip': () => technicDirect,
  'https://api.technicpack.net/modpack/nestpack?build=999': () => json({ id: 4, name: 'nestpack', displayName: 'Nested', url: 'https://files.example.com/n.zip', minecraft: '1.12.2', solder: null }),
  'https://files.example.com/n.zip': () => nested,
  'https://api.technicpack.net/modpack/solderpack?build=999': () => json({ id: 5, name: 'solderpack', displayName: 'Solder Pack', url: null, minecraft: '1.12.2', solder: 'http://solder.example.com/api/' }),
  'https://solder.example.com/api/modpack/solderpack': () => json({ name: 'solderpack', recommended: '1.0', latest: '1.1', builds: ['1.0', '1.1'] }),
  'https://solder.example.com/api/modpack/solderpack/1.0?include=mods': () => json({ minecraft: '1.12.2', mods: [
    { name: 'forge', version: '14.23', md5: U.md5(solderZipForge), url: 'https://solder.example.com/mods/forge.zip' },
    { name: 'a', pretty_name: 'Mod A', version: '1', md5: badMd5 ? 'f'.repeat(32) : U.md5(solderZipA), url: 'https://solder.example.com/mods/a.zip' }] }),
  'https://solder.example.com/mods/forge.zip': () => solderZipForge,
  'https://solder.example.com/mods/a.zip': () => solderZipA,
  'https://api.technicpack.net/modpack/localpack?build=999': () => json({ id: 6, name: 'localpack', url: 'http://127.0.0.1:8080/x.zip', minecraft: '1.12.2', solder: null })
};
const hits = [];
globalThis.fetch = async (url) => {
  url = String(url); hits.push(url);
  const f = routes[url]; if (!f) return new Response('not found', { status: 404 });
  const r = f(); if (r && r.status) return new Response('nf', { status: r.status });
  return new Response(r, { status: 200, headers: { 'content-length': String(r.length) } });
};

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-pack-test-')); let pass = 0;
  const t = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.stack || e); process.exitCode = 1; } };
  const events = []; const inst = new Instances({ dataDir: dir, store: { settings: {} }, emit: (c, d) => events.push([c, d]) });
  let prepared = []; inst.prepareWithFallback = async id => { prepared.push(id); return inst.read(id); };
  const A = require('../src/main/core/atl'), T = require('../src/main/core/technic');

  console.log('ATLauncher');
  await t('каталог: только публичные паки с безопасным safeName', async () => {
    const r = await A.search({ query: '' }); assert.deepStrictEqual(r.hits.map(h => h.id), ['AllTheMods9']);
    assert.strictEqual((await A.search({ query: 'mods 9' })).hits.length, 1); assert.strictEqual((await A.search({ query: 'zzz' })).hits.length, 0);
  });
  await t('кэш списка: второй поиск не ходит в сеть', async () => { const n = hits.filter(u => u.endsWith('/packs/simple')).length; await A.search({ query: 'a' }); assert.strictEqual(hits.filter(u => u.endsWith('/packs/simple')).length, n); });
  let atl;
  await t('установка: версия, загрузчик, моды, ресурспаки, конфиги', async () => {
    atl = await inst.installModpack('AllTheMods9', '', 'atl', 'All The Mods 9');
    assert.strictEqual(atl.mc, '1.20.1'); assert.strictEqual(atl.loader, 'forge'); assert.strictEqual(atl.loaderVersion, '47.2.0');
    const g = inst.game(atl.id);
    assert.strictEqual(fs.readFileSync(path.join(g, 'mods/direct.jar'), 'utf8'), 'jar-A');
    assert.strictEqual(fs.readFileSync(path.join(g, 'mods/srv.jar'), 'utf8'), 'jar-C-server');   // со второго адреса CDN
    assert.ok(fs.existsSync(path.join(g, 'resourcepacks/rp.zip')));
    assert.strictEqual(fs.readFileSync(path.join(g, 'config/atl.cfg'), 'utf8'), 'x=1');
    assert.ok(prepared.includes(atl.id), 'prepare вызван');
  });
  await t('безопасность: чужой хост, битая MD5, обход пути, optional, server-only, неподдерживаемый тип', async () => {
    const g = inst.game(atl.id), mods = fs.readdirSync(path.join(g, 'mods')).sort();
    assert.deepStrictEqual(mods, ['direct.jar', 'escape.jar', 'srv.jar']);                      // evil/bad/opt/so/p отсутствуют; escape.jar — безопасное имя (путь срезан)
    assert.ok(!fs.existsSync(path.join(dir, 'instances', 'escape.jar')) && !fs.existsSync(path.join(dir, 'evil.txt')) && !fs.existsSync(path.join(g, '..', 'evil.txt')), 'zip-slip заблокирован');
    const by = Object.fromEntries(atl.manual.map(m => [m.name, m.reason]));
    assert.strictEqual(by['br.jar'], 'browser'); assert.strictEqual(by['evil.jar'], 'host'); assert.strictEqual(by['bad.jar'], 'failed'); assert.strictEqual(by['Patch'], 'unsupported');
    assert.ok(!('opt.jar' in by) && !('so.jar' in by));
  });
  await t('неизвестный загрузчик -> понятная ошибка, сборка не остаётся', async () => {
    const before = fs.readdirSync(path.join(dir, 'instances')).length;
    assert.throws(() => A.parse({ minecraft: '1.12.2', loader: { type: 'legacyfabric' }, mods: [] }), /atlLoader/);
    assert.throws(() => A.parse({ nope: 1 }), /atlBad/); assert.throws(() => A.parse({ minecraft: '1.20', mods: 'x' }), /atlBad/);
    assert.strictEqual(fs.readdirSync(path.join(dir, 'instances')).length, before);
  });
  await t('плохой safeName отвергается', async () => { await assert.rejects(() => A.version('../x'), /Bad ATLauncher/); await assert.rejects(() => inst.installModpack('../../x', '', 'atl', ''), /Bad ATLauncher/); });
  await t('ответ API с error=true -> ошибка, а не успех', async () => { routes['https://api.atlauncher.com/v1/pack/Broken/latest'] = () => json({ error: true, code: 404, message: 'Pack not found', data: null }); await assert.rejects(() => A.version('Broken'), /Pack not found/); });

  console.log('Technic');
  await t('поиск: HTML вычищен, серверные паки и плохие slug отброшены, http→https для иконок', async () => {
    const r = await T.search({ query: 'tekkit' }); assert.strictEqual(r.hits.length, 1);
    assert.strictEqual(r.hits[0].title, 'Tekkit Classic'); assert.strictEqual(r.hits[0].desc, 'Big pack'); assert.strictEqual(r.hits[0].downloads, 777); assert.strictEqual(r.hits[0].src, 'technic');
    assert.strictEqual((await T.search({ query: '' })).hint, 'techType');
  });
  await t('прямой zip: загрузчик Forge из bin/modpack.jar, bin/ не копируется', async () => {
    const i = await inst.installModpack('tekkit', '', 'technic', 'Tekkit'); const g = inst.game(i.id);
    assert.strictEqual(i.mc, '1.12.2'); assert.strictEqual(i.loader, 'forge'); assert.strictEqual(i.loaderVersion, '14.23.5.2860');
    assert.ok(fs.existsSync(path.join(g, 'mods/tech.jar')) && fs.existsSync(path.join(g, 'config/t.cfg'))); assert.ok(!fs.existsSync(path.join(g, 'bin')));
    assert.ok(hits.includes('https://mirror.technicpack.net/Technic/tekkit.zip'), 'http поднят до https');
  });
  await t('zip с одной корневой папкой распаковывается без неё', async () => { const i = await inst.installModpack('nestpack', '', 'technic', ''); assert.ok(fs.existsSync(path.join(inst.game(i.id), 'mods/n.jar'))); assert.ok(!fs.existsSync(path.join(inst.game(i.id), 'MyPack'))); });
  await t('Solder: рекомендованная сборка, MD5 проверена, загрузчик из архива forge', async () => {
    const i = await inst.installModpack('solderpack', '', 'technic', ''); const g = inst.game(i.id);
    assert.strictEqual(i.loader, 'forge'); assert.strictEqual(i.loaderVersion, '14.23.5.2860'); assert.ok(fs.existsSync(path.join(g, 'mods/s1.jar')));
    assert.ok(hits.some(u => u.includes('/solderpack/1.0?include=mods')), 'взята рекомендованная 1.0, а не latest');
  });
  await t('Solder: несовпадение MD5 прерывает установку и убирает сборку', async () => {
    badMd5 = true; const n = fs.readdirSync(path.join(dir, 'instances')).length;
    await assert.rejects(() => inst.installModpack('solderpack', '', 'technic', ''), /techMd5/);
    assert.strictEqual(fs.readdirSync(path.join(dir, 'instances')).length, n); badMd5 = false;
  });
  await t('адрес на 127.0.0.1 отвергается (SSRF)', async () => { const n = fs.readdirSync(path.join(dir, 'instances')).length; await assert.rejects(() => inst.installModpack('localpack', '', 'technic', ''), /techUrl/); assert.strictEqual(fs.readdirSync(path.join(dir, 'instances')).length, n); assert.ok(!hits.some(u => u.includes('127.0.0.1'))); });
  await t('лимит размера скачивания срабатывает', async () => { const big = new Response(new Uint8Array(2048), { headers: { 'content-length': '2048' } }); const f = globalThis.fetch; globalThis.fetch = async () => big; await assert.rejects(() => U.fetchBufMax('https://a.b.c/x', 1024), /tooBig/); globalThis.fetch = f; });
  console.log(process.exitCode ? 'FAIL' : `OK: ${pass} проверок`); fs.rmSync(dir, { recursive: true, force: true });
})();
