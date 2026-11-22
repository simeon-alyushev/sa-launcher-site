// Проверка работы с папкой Bedrock на поддельных данных (без Windows и без игры).   node scripts/test-bedrock.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'br-'));
process.env.APPDATA = tmp; process.env.LOCALAPPDATA = path.join(tmp, 'local');
const BR = require('../src/main/core/bedrock');
const sh = path.join(tmp, 'Minecraft Bedrock', 'Users', 'Shared', 'games', 'com.mojang'), us = path.join(tmp, 'Minecraft Bedrock', 'Users', '123456', 'games', 'com.mojang');
fs.mkdirSync(path.join(us, 'minecraftWorlds', 'w1='), { recursive: true });
fs.writeFileSync(path.join(us, 'minecraftWorlds', 'w1=', 'levelname.txt'), 'Мой мир'); fs.writeFileSync(path.join(us, 'minecraftWorlds', 'w1=', 'level.dat'), 'x');
fs.mkdirSync(path.join(sh, 'resource_packs', 'rp'), { recursive: true });
fs.writeFileSync(path.join(sh, 'resource_packs', 'rp', 'manifest.json'), '// c\n{"header":{"name":"Test RP","version":[1,2,3],"description":"d"}}');
fs.mkdirSync(path.join(sh, 'behavior_packs', 'bp'), { recursive: true });
fs.writeFileSync(path.join(sh, 'behavior_packs', 'bp', 'manifest.json'), '{"header":{"name":"pack.name"}}');
const w = BR.worlds('release'); assert.equal(w.length, 1); assert.equal(w[0].name, 'Мой мир'); assert.equal(w[0].owner, '123456');
const p = BR.packs('release'); assert.equal(p.length, 2); assert.equal(p.find(x => x.kind === 'resource').name, 'Test RP'); assert.equal(p.find(x => x.kind === 'behavior').name, 'bp');
assert.equal(BR.mainDir('release'), sh);
// Определение установленных изданий: разные ответы PowerShell и папки
const env = { APPDATA: tmp, LOCALAPPDATA: path.join(tmp, 'local2'), SystemDrive: path.join(tmp, 'drv') };
assert.equal(BR.parsePs('мусор до\n{"pk":{"Name":"Microsoft.MinecraftUWP","Version":"1.21.1"},"sa":[]}\nмусор после').pk.length, 1);   // один объект вместо массива
assert.equal(BR.parsePs('нет json'), null);
let d = BR.detect('release', { pk: [{ Name: 'Microsoft.MinecraftUWP', Version: '1.21.1' }], sa: [] }, env);
assert(d.installed && d.via === 'package' && d.version === '1.21.1');
d = BR.detect('release', { pk: [], sa: [{ Name: 'Minecraft', AppID: 'Microsoft.MinecraftUWP_8wekyb3d8bbwe!Game' }] }, env);
assert(d.installed && d.via === 'start' && d.appId === 'Microsoft.MinecraftUWP_8wekyb3d8bbwe!Game');   // настоящий AppID из меню «Пуск»
d = BR.detect('preview', { pk: [], sa: [] }, env); assert(!d.installed && d.appId === 'Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe!App');
fs.mkdirSync(path.join(tmp, 'local2', 'Packages', BR.EDITIONS.preview.pfn), { recursive: true });
d = BR.detect('preview', { pk: [], sa: [] }, env); assert(d.installed && d.via === 'packages-folder');   // PowerShell ничего не нашёл, но папка пакета есть
d = BR.detect('release', null, env); assert(d.installed && d.via === 'data');   // PowerShell не ответил, есть папка данных
const b = BR.backupWorld('release', '123456', 'w1=', path.join(tmp, 'bk')); assert(fs.existsSync(path.join(b.path, 'level.dat')));
assert.throws(() => BR.backupWorld('release', '123456', '../x', path.join(tmp, 'bk')));
assert.throws(() => BR.removePack('release', 'resource', '..'));
BR.removePack('release', 'resource', 'rp'); assert.equal(BR.packs('release').length, 1);
assert.throws(() => BR.folderPath('release', '../..'));
assert(BR.importable('a.MCWORLD') && !BR.importable('a.exe'));
let url = ''; try { BR.launch('release', { host: 'bad host!' }, () => {}); } catch (e) { url = e.message; } assert(/brWinOnly|brBadHost/.test(url));
assert(BR.addServerLink('release', { name: 'A|B', host: 'play.x.net', port: 19133 }).startsWith('minecraft://?addExternalServer=A%20B%7Cplay.x.net%3A19133'));
assert.throws(() => BR.addServerLink('preview', { host: 'a b' }));

// ---- каталог аддонов (сеть подменена) ----
(async () => {
  const U = require('../src/main/core/util');
  const fetchJSON = U.fetchJSON, fetchBufMax = U.fetchBufMax; let asked = [];
  const pack = U.writeZip([{ name: 'manifest.json', data: Buffer.from('{}') }]);
  const addon = U.writeZip([{ name: 'readme.txt', data: Buffer.from('x') }, { name: 'My Addon.mcaddon', data: Buffer.from('ADDON') }, { name: '../evil.mcpack', data: Buffer.from('EVIL') }]);
  const files = [
    { id: '10', name: 'old', fileName: 'old.mcaddon', url: 'https://edge.forgecdn.net/files/old.mcaddon', sha1: '' },
    { id: '20', name: 'new', fileName: 'new.mcaddon', url: 'https://edge.forgecdn.net/files/new.mcaddon', sha1: U.sha1(Buffer.from('NEW')) },
    { id: '30', name: 'zip', fileName: 'z.zip', url: 'https://edge.forgecdn.net/files/z.zip', sha1: '' },
    { id: '40', name: 'evil host', fileName: 'e.mcaddon', url: 'https://evil.example.com/e.mcaddon', sha1: '' },
    { id: '50', name: 'exe', fileName: 'a.exe', url: 'https://edge.forgecdn.net/files/a.exe', sha1: '' }
  ];
  U.fetchJSON = async u => { asked.push(u); if (u.includes('/api/search')) return { more: true, results: [{ id: 5, title: 'T', desc: 'D', icon: 'javascript:1', downloads: 7, author: 'A', url: 'https://www.curseforge.com/minecraft-bedrock/addons/t' }] }; return { versions: files.map(f => ({ ...f })) }; };
  const bufs = { 'new.mcaddon': Buffer.from('NEW'), 'z.zip': addon, 'e.mcaddon': Buffer.from('E'), 'a.exe': Buffer.from('X') };
  U.fetchBufMax = async u => { const b = bufs[u.split('/').pop()]; if (!b) throw new Error('no ' + u); return b; };
  try {
    const r = await BR.catSearch('https://site.test', { query: 'dragon', type: 'maps', offset: 20 });
    assert(asked[0].includes('game=bedrock') && asked[0].includes('type=maps') && asked[0].includes('q=dragon') && asked[0].includes('offset=20'));
    assert.equal(r.more, true); assert.equal(r.hits[0].icon, ''); assert.equal(r.hits[0].type, 'maps');
    assert((await BR.catSearch('https://site.test', { type: 'bogus' })) && asked[1].includes('type=addons'));
    await assert.rejects(() => BR.catFiles('https://site.test', '../1'));
    assert.equal(BR.pickFile(files, '').id, '50'); assert.equal(BR.pickFile(files, '10').id, '10');
    const dir = path.join(tmp, 'dl'), opened = [], open = async f => { opened.push(f); return ''; };
    const r2 = await BR.catInstall('https://site.test', { project: '5', file: '20' }, dir, open);
    assert.equal(fs.readFileSync(path.join(dir, '5-new.mcaddon'), 'utf8'), 'NEW'); assert.equal(opened.length, 1);
    const r3 = await BR.catInstall('https://site.test', { project: '5', file: '30' }, dir, open);
    assert.deepEqual(r3.files, ['5-My Addon.mcaddon', '5-evil.mcpack']); assert(!fs.existsSync(path.join(tmp, 'evil.mcpack')));
    await assert.rejects(() => BR.catInstall('https://site.test', { project: '5', file: '40' }, dir, open), /brCatNoDl/);
    await assert.rejects(() => BR.catInstall('https://site.test', { project: '5', file: '50' }, dir, open), /brCatBadFile/);
    await assert.rejects(() => BR.catInstall('https://site.test', { project: '5', file: '20' }, dir, async () => 'boom'), /boom/);
    assert.equal(BR.unpackZip(pack, 'Pack.zip')[0].name, 'Pack.mcpack');
    assert.throws(() => BR.unpackZip(U.writeZip([{ name: 'a.txt', data: Buffer.from('x') }]), 'a.zip'), /brCatBadFile/);
    files[1].sha1 = 'a'.repeat(40);
    await assert.rejects(() => BR.catInstall('https://site.test', { project: '5', file: '20' }, dir, open), /brCatHash/);
  } finally { U.fetchJSON = fetchJSON; U.fetchBufMax = fetchBufMax; }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('OK bedrock');
})().catch(e => { console.error(e); process.exit(1); });
