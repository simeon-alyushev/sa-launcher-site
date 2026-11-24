// Умный ремонт на подставных ответах Modrinth (без сети и Minecraft).   node scripts/test-smart.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const U = require('../src/main/core/util'), MR = require('../src/main/core/modrinth');

// ---- минимальный zip ----
const T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) {
  const parts = [], cen = []; let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const nm = Buffer.from(name), data = Buffer.from(text), h = Buffer.alloc(30), c = crc(data);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(c, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26);
    const e = Buffer.alloc(46); e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6); e.writeUInt32LE(c, 16); e.writeUInt32LE(data.length, 20); e.writeUInt32LE(data.length, 24); e.writeUInt16LE(nm.length, 28); e.writeUInt32LE(off, 42);
    parts.push(h, nm, data); cen.push(e, nm); off += 30 + nm.length + data.length;
  }
  const cb = Buffer.concat(cen), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(cen.length / 2, 8); end.writeUInt16LE(cen.length / 2, 10); end.writeUInt32LE(cb.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cb, end]);
}
const jar = (id, mc, deps = {}) => zip({ 'fabric.mod.json': JSON.stringify({ id, version: '1', depends: { minecraft: mc, ...deps } }) });

// ---- подставной Modrinth ----
const PROJ = { 'sodium-pid': { slug: 'sodium', title: 'Sodium' }, 'iris-pid': { slug: 'iris', title: 'Iris' }, 'old-pid': { slug: 'oldmod', title: 'Old Mod', description: 'tiny helper', categories: ['utility', 'fabric'] }, 'alt-pid': { slug: 'altmod', title: 'Alt Thing', description: 'x', categories: ['utility', 'fabric'] } };
const FILES = {};                                                          // url -> содержимое jar
const ver = (pid, file, mcRange) => { const url = 'http://x/' + file; FILES[url] = jar(PROJ[pid].slug, mcRange); return { id: 'v-' + file, version_number: '9', version_type: 'release', date_published: '2026-01-01', game_versions: ['26.1'], files: [{ primary: true, filename: file, url, hashes: { sha1: 'h-' + file }, size: FILES[url].length }], dependencies: [] }; };
const VERS = { 'sodium-pid': [ver('sodium-pid', 'sodium-26.jar', '26.1.x')], 'iris-pid': [], 'old-pid': [], 'alt-pid': [ver('alt-pid', 'alt-26.jar', '26.1.x')] };
MR.project = async id => { if (!PROJ[id]) throw new Error('404'); return { id, project_type: 'mod', icon_url: '', ...PROJ[id] }; };
MR.versions = async (id) => VERS[id] || [];
MR.version = async vid => Object.values(VERS).flat().find(v => v.id === vid);
MR.projects = async () => [];
MR.lookupHashes = async () => ({});
MR.search = async ({ query }) => ({ hits: /tiny helper|Old Mod/.test(query) ? [{ id: 'alt-pid', slug: 'altmod', title: 'Alt Thing', downloads: 50000, categories: ['utility', 'fabric'] }] : [] });
U.fetchJSON = async () => ({});
U.download = async (url, dest) => { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, FILES[url] || Buffer.from('x')); return true; };

const { Instances } = require('../src/main/core/instances');
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-'));
  const inst = new Instances({ dataDir: tmp, store: { settings: {}, account: () => null }, emit: () => {} });
  const i = inst.create({ name: 'T', mc: '26.1', loader: 'fabric' });
  const dir = inst.contentDir(i.id, 'mod'); fs.mkdirSync(dir, { recursive: true });
  const put = (f, buf, pid) => { fs.writeFileSync(path.join(dir, f), buf); const m = inst.meta(i.id); m['mod/' + f] = { size: buf.length, sha1: 'h-' + f, looked: true, project_id: pid, title: pid ? PROJ[pid].title : undefined }; inst.saveMeta(i.id, m); };
  put('fabric-api.jar', jar('fabric-api', '>=1.21'));
  put('sodium.jar', jar('sodium', '1.21.x'), 'sodium-pid');                  // под 1.21: есть версия под 26.1 → обновить
  put('iris.jar', jar('iris', '>=26.1', { sodium: '>=0.6' }));
  put('old.jar', jar('oldmod', '1.21.x'), 'old-pid');                       // версии под 26.1 нет → замена
  put('dead.jar', jar('dead', '1.16.5'));                                   // ни версии, ни замены → отключить
  put('needsdead.jar', jar('needsdead', '*', { dead: '*' }));              // зависит от отключённого → тоже отключить

  const r = await inst.smartRepair(i.id);
  const by = (id) => r.fixed.find(x => x.id === id);
  assert(by('sodium') && by('sodium').action === 'updated', 'sodium обновлён: ' + JSON.stringify(r));
  assert(by('oldmod') && by('oldmod').action === 'replaced' && by('oldmod').to === 'Alt Thing', 'oldmod заменён');
  assert(by('dead') && by('dead').action === 'disabled', 'dead отключён');
  const names = fs.readdirSync(dir);
  assert(names.includes('sodium-26.jar') && names.includes('sodium.jar.disabled'), 'старый sodium отключён: ' + names);
  assert(names.includes('alt-26.jar') && names.includes('old.jar.disabled'));
  assert(names.includes('dead.jar.disabled') && names.includes('needsdead.jar.disabled'), 'цепочка зависимостей: ' + names);
  assert(names.includes('iris.jar') && names.includes('fabric-api.jar') === false ? false : true);
  // после ремонта проблем не остаётся
  const after = inst.inspect(i.id); assert.deepStrictEqual(after.problems, [], JSON.stringify(after.problems));
  // повторный запуск ничего не меняет
  const r2 = await inst.smartRepair(i.id); assert(!r2.fixed.length && !r2.failed.length);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('OK smart');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
