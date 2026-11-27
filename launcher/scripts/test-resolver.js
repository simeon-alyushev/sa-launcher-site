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
MR.version = async id => Object.values(VERS).flat().find(v => v.id === id);
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

  // 7) Java: самая свежая версия мода требует Java 25, а у игры Java 21 → ставится предыдущая, которая подходит
  const vdir = path.join(inst.shared, 'versions', '26.1'); fs.mkdirSync(vdir, { recursive: true });
  fs.writeFileSync(path.join(vdir, '26.1.json'), JSON.stringify({ id: '26.1', javaVersion: { majorVersion: 21, component: 'java-runtime-delta' } }));
  PROJ['jv-pid'] = { slug: 'jv', title: 'JavaMod' };
  VERS['jv-pid'] = [mkver('jv-pid', 'jv-2.jar', '2', '2026-03-01', jar('jv', '2', '26.1.x', { java: '>=25' })), mkver('jv-pid', 'jv-1.jar', '1', '2026-02-01', jar('jv', '1', '26.1.x', { java: '>=17' }))];
  const g = mk('G'); assert.strictEqual(inst.javaMajor(g.id), 21, 'Java берётся из version.json');
  await inst.installProject(g.id, 'jv-pid'); assert.deepStrictEqual(mods(g), ['jv-1.jar'], 'версия, требующая Java 25, пропущена: ' + mods(g));
  // свой путь к Java: версию без запуска не узнать → проверка по Java не применяется
  const g2 = mk('G2'); { const j = inst.read(g2.id); j.javaPath = '/opt/java/bin/java'; inst.write(j); } assert.strictEqual(inst.javaMajor(g2.id), null);
  // уже стоящий мод, которому нужна Java новее игровой, находится и чинится (другая версия или отключение, файл не удаляется)
  const g3 = mk('G3'); put(g3, 'jv-2.jar', jar('jv', '2', '26.1.x', { java: '>=25' }), 'jv-pid');
  assert(inst.inspect(g3.id).problems.some(p => p.type === 'javaver'), 'javaver найден');
  const r7 = await inst.repairInstance(g3.id); assert(r7.after.length === 0 && !r7.rolledBack, JSON.stringify(r7)); assert(mods(g3).includes('jv-1.jar') && mods(g3).includes('jv-2.jar.disabled'), mods(g3));

  // 8) зависимости при установке: Iris требует Sodium <=0.9.5 → из двух подходящих по игре версий Sodium ставится 0.9.5b, а не свежая 0.9.6
  VERS['sodium-pid'] = [mkver('sodium-pid', 'sodium-0.9.6.jar', '0.9.6', '2026-03-01', jar('sodium', '0.9.6', '26.1.x')), mkver('sodium-pid', 'sodium-0.9.5b.jar', '0.9.5b', '2026-02-01', jar('sodium', '0.9.5b', '26.1.x'))];
  const h = mk('H'); put(h, 'iris.jar', jar('iris', '1.9', '26.1.x', { sodium: '<=0.9.5' }), 'iris-pid');
  await inst.installProject(h.id, 'sodium-pid'); assert.deepStrictEqual(mods(h), ['iris.jar', 'sodium-0.9.5b.jar'], 'учтено ограничение Iris: ' + mods(h));
  assert(!inst.inspect(h.id).problems.length);
  // 8b) подходящей без проблем нет — ставится лучшая по игре, а проверка честно показывает проблему (не «ничего не поставилось»)
  VERS['sodium-pid'] = [mkver('sodium-pid', 'sodium-0.9.6.jar', '0.9.6', '2026-03-01', jar('sodium', '0.9.6', '26.1.x'))];
  const h2 = mk('H2'); put(h2, 'iris.jar', jar('iris', '1.9', '26.1.x', { sodium: '<=0.9.5' }), 'iris-pid');
  await inst.installProject(h2.id, 'sodium-pid'); assert(mods(h2).includes('sodium-0.9.6.jar') && inst.inspect(h2.id).problems.some(p => p.type === 'depver'), 'запасная версия + проблема видна');
  // 8c) версию выбрал сам пользователь — зависимости её не блокируют
  const h3 = mk('H3'); put(h3, 'iris.jar', jar('iris', '1.9', '26.1.x', { sodium: '<=0.9.5' }), 'iris-pid');
  await inst.installProject(h3.id, 'sodium-pid', 'v-sodium-0.9.6.jar'); assert(mods(h3).includes('sodium-0.9.6.jar'));

  // 8d) кнопка «Исправить автоматически» (inspect → fixCrash) чинит и depver, а не только wrongmc/missing/dup
  VERS['sodium-pid'] = [mkver('sodium-pid', 'sodium-0.9.6.jar', '0.9.6', '2026-03-01', jar('sodium', '0.9.6', '26.1.x')), mkver('sodium-pid', 'sodium-0.9.5b.jar', '0.9.5b', '2026-02-01', jar('sodium', '0.9.5b', '26.1.x'))];
  const k = mk('K'); put(k, 'sodium-0.9.6.jar', jar('sodium', '0.9.6', '26.1.x'), 'sodium-pid'); put(k, 'iris.jar', jar('iris', '1.9', '26.1.x', { sodium: '<=0.9.5' }), 'iris-pid');
  const pr = inst.inspect(k.id).problems; assert(pr.some(x => x.type === 'depver'));
  const fx = await inst.fixCrash(k.id, pr); assert(fx.fixed.length >= 1 && !inst.inspect(k.id).problems.length && mods(k).includes('sodium-0.9.5b.jar'), JSON.stringify(fx) + mods(k));

  // 8e) чистая сборка: копия модов не создаётся (раньше создавалась при каждой проверке)
  const cl = mk('CLEAN'); put(cl, 'ok.jar', jar('okmod', '1', '26.1.x')); const rc = await inst.repairInstance(cl.id);
  assert(rc.notes.includes('clean') && !rc.backup && !fs.existsSync(path.join(inst.path(cl.id), 'backups')), 'чистая сборка без копии');
  // 8f) отмена починки возвращает моды как были; повторная отмена и подмена пути из истории невозможны
  const u = mk('U'); put(u, 'sodium-0.9.6.jar', jar('sodium', '0.9.6', '26.1.x'), 'sodium-pid'); put(u, 'iris.jar', jar('iris', '1.9', '26.1.x', { sodium: '<=0.9.5' }), 'iris-pid');
  const u0 = mods(u), ru = await inst.repairInstance(u.id); assert(ru.fixed.length && !ru.rolledBack && JSON.stringify(mods(u)) !== JSON.stringify(u0));
  await inst.undoRepair(u.id, ru.time); assert.deepStrictEqual(mods(u), u0, 'после отмены моды как до починки: ' + mods(u));
  await assert.rejects(inst.undoRepair(u.id, ru.time), /nobackup/);                                  // уже отменено
  const hf = path.join(inst.path(u.id), 'repair-history.json'), hh = JSON.parse(fs.readFileSync(hf, 'utf8'));
  hh.find(x => x.time === ru.time).undone = false; hh.find(x => x.time === ru.time).backup = path.join(inst.path(u.id), '..', '..', 'evil'); fs.writeFileSync(hf, JSON.stringify(hh));
  await assert.rejects(inst.undoRepair(u.id, ru.time), /nobackup/, 'путь вне backups/ отвергнут');
  assert(hh.some(x => x.undo), 'отмена записана в историю');
  // 8g) старые копии починок удаляются (остаётся не больше 8)
  const w = mk('W'); const bdir = path.join(inst.path(w.id), 'backups'); fs.mkdirSync(bdir, { recursive: true });
  for (let n = 0; n < 12; n++) fs.mkdirSync(path.join(bdir, 'repair-2020-01-' + String(n + 10) + 'T00-00-00-000Z', 'mods'), { recursive: true });
  put(w, 'old.jar', jar('oldmod', '1', '1.16.5')); await inst.repairInstance(w.id);
  assert(fs.readdirSync(bdir).filter(n => /^repair-/.test(n)).length <= 8, 'копий: ' + fs.readdirSync(bdir).length);

  // 9) кэш метаданных: повторный запрос из памяти; при сбое сети отдаётся последний ответ; 404 не маскируется
  const MR2 = (() => { delete require.cache[require.resolve('../src/main/core/modrinth')]; return require('../src/main/core/modrinth'); })();
  let calls = 0, mode = 'ok'; const real = U.fetchJSON;
  U.fetchJSON = async () => { calls++; if (mode === 'down') throw new Error('offline'); if (mode === '404') { const e = new Error('HTTP 404'); e.status = 404; throw e; } return [{ id: 'a' }]; };
  await MR2.versions('x', { loaders: ['fabric'], game_versions: ['26.1'] }); await MR2.versions('x', { loaders: ['fabric'], game_versions: ['26.1'] }); assert.strictEqual(calls, 1, 'второй запрос из кэша');
  const file = path.join(tmp, 'cache', 'mr.json'); MR2.persist(file); MR2.flush(); assert(fs.existsSync(file), 'кэш сохранён на диск');
  delete require.cache[require.resolve('../src/main/core/modrinth')]; const MR3 = require('../src/main/core/modrinth'); MR3.persist(file); mode = 'down';
  assert.deepStrictEqual(await MR3.versions('x', { loaders: ['fabric'], game_versions: ['26.1'] }), [{ id: 'a' }], 'без сети — ответ из дискового кэша');
  mode = '404'; await assert.rejects(MR3.project('nope'), /404/); U.fetchJSON = real;
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('OK resolver');
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
