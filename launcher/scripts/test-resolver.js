// Smart Mod Resolver и полная починка на подставных ответах Modrinth (без сети и Minecraft).   node scripts/test-resolver.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const U = require('../src/main/core/util'), MR = require('../src/main/core/modrinth');
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
const jar = (id, version, mc, deps = {}, extra = {}) => zip({ 'fabric.mod.json': JSON.stringify({ id, version, depends: { minecraft: mc, ...deps }, ...extra }) });
const FILES = {}, PROJ = { 'sodium-pid': { slug: 'sodium', title: 'Sodium' }, 'iris-pid': { slug: 'iris', title: 'Iris' } }, VERS = {};
const mkver = (pid, file, vn, date, jarBuf) => { const url = 'http://x/' + file; FILES[url] = jarBuf; return { id: 'v-' + file, version_number: vn, version_type: 'release', date_published: date, game_versions: ['26.1'], files: [{ primary: true, filename: file, url, hashes: { sha1: 'h-' + file }, size: jarBuf.length }], dependencies: [] }; };
let online = true;
MR.project = async id => { if (!PROJ[id]) throw new Error('404'); return { id, project_type: 'mod', icon_url: '', ...PROJ[id] }; };
MR.versions = async id => VERS[id] || [];
MR.projects = async () => []; MR.lookupHashes = async () => ({}); MR.search = async () => ({ hits: [] });
U.fetchJSON = async () => { if (!online) throw new Error('offline'); return {}; };
U.download = async (url, dest) => { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, FILES[url] || Buffer.from('x')); return true; };
const { Instances } = require('../src/main/core/instances');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-'));
  const inst = new Instances({ dataDir: tmp, store: { settings: {}, account: () => null }, emit: () => {} });
  const mk = name => { const i = inst.create({ name, mc: '26.1', loader: 'fabric' }); fs.mkdirSync(inst.contentDir(i.id, 'mod'), { recursive: true }); return i; };
  const put = (i, f, buf, pid) => { const dir = inst.contentDir(i.id, 'mod'); fs.writeFileSync(path.join(dir, f), buf); const m = inst.meta(i.id); m['mod/' + f] = { size: buf.length, sha1: 'h-' + f, looked: true, project_id: pid, version_id: 'v-' + f, title: pid ? PROJ[pid].title : undefined, version: '0' }; inst.saveMeta(i.id, m); };
  const mods = i => fs.readdirSync(inst.contentDir(i.id, 'mod')).sort();

  // 1) Sodium: свежая 0.9.6 по метаданным «для 26.1», но в jar требует другую версию игры; 0.9.5b подходит → ставится 0.9.5b
  VERS['sodium-pid'] = [mkver('sodium-pid', 'sodium-0.9.6.jar', '0.9.6', '2026-03-01', jar('sodium', '0.9.6', '1.21.x')), mkver('sodium-pid', 'sodium-0.9.5b.jar', '0.9.5b', '2026-02-01', jar('sodium', '0.9.5b', '26.1.x'))];
  const a = mk('A'); await inst.installProject(a.id, 'sodium-pid');
  assert.deepStrictEqual(mods(a), ['sodium-0.9.5b.jar'], 'выбрана 0.9.5b, а не 0.9.6: ' + mods(a));
  assert(!inst.inspect(a.id).problems.length);

  // 2) зависимость по версии: Iris требует Sodium <=0.9.5, а стоит 0.9.6 → подбирается 0.9.5b
  const b = mk('B');
  put(b, 'sodium-0.9.6.jar', jar('sodium', '0.9.6', '26.1.x'), 'sodium-pid');
  put(b, 'iris.jar', jar('iris', '1.9', '26.1.x', { sodium: '<=0.9.5' }), 'iris-pid');
  assert(inst.inspect(b.id).problems.some(p => p.type === 'depver' && p.id === 'sodium'), 'проблема версии зависимости найдена');
  const r2 = await inst.repairInstance(b.id);
  assert(r2.before.length === 1 && r2.after.length === 0 && !r2.rolledBack, JSON.stringify(r2));
  assert(mods(b).includes('sodium-0.9.5b.jar') && mods(b).includes('sodium-0.9.6.jar.disabled'), mods(b));
  assert(inst.repairHistory(b.id).length === 1 && fs.existsSync(path.join(r2.backup, 'mods')), 'история и копия сохранены');

  // 3) откат: исправление ухудшает ситуацию → моды возвращаются как были
  const c = mk('C'); put(c, 'old.jar', jar('oldmod', '1', '1.16.5'));
  const before = mods(c), orig = inst.smartRepair;
  inst.smartRepair = async id => { const d = inst.contentDir(id, 'mod'); fs.rmSync(path.join(d, 'old.jar')); for (const n of ['x1', 'x2', 'x3']) fs.writeFileSync(path.join(d, n + '.jar'), jar(n, '1', '1.16.5')); return { fixed: [], failed: [{ type: 'wrongmc', id: 'oldmod', error: 'x' }] }; };
  const r3 = await inst.repairInstance(c.id); inst.smartRepair = orig;
  assert(r3.rolledBack && JSON.stringify(mods(c)) === JSON.stringify(before), 'откат: ' + mods(c));

  // 4) нет интернета: моды не отключаются «на всякий случай», в отчёте причина offline
  const d = mk('D'); put(d, 'old.jar', jar('oldmod', '1', '1.16.5'));
  online = false; const r4 = await inst.repairInstance(d.id); online = true;
  assert(mods(d).includes('old.jar') && r4.failed.some(f => f.error === 'offline'), 'offline: ' + JSON.stringify(r4.failed));

  // 5) блокировка: параллельная починка той же сборки запрещена
  const e = mk('E'); put(e, 'old.jar', jar('oldmod', '1', '1.16.5'));
  const p1 = inst.repairInstance(e.id), p2 = inst.repairInstance(e.id).then(() => 'ok', x => x.message);
  assert.strictEqual(await p2, 'busy'); await p1;

  // 6) «Починить все» и индикатор состояния
  const f = mk('F'); put(f, 'sodium-0.9.6.jar', jar('sodium', '0.9.6', '26.1.x'), 'sodium-pid'); put(f, 'iris.jar', jar('iris', '1.9', '26.1.x', { sodium: '<=0.9.5' }), 'iris-pid');
  const st = inst.checkAll(); assert(st.find(x => x.id === f.id).status === 'warn' || st.find(x => x.id === f.id).status === 'bad');
  const all = await inst.repairAll(); assert(all.length === inst.list().length && all.find(x => x.id === f.id).after.length === 0);
  assert(inst.checkAll().find(x => x.id === f.id).status === 'ok');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('OK resolver');
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
