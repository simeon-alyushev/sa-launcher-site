// SA Compatibility Checker: оценка, сбор данных на настоящей сборке, остановка запуска и «запустить всё равно».   node scripts/test-checker.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
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
const C = require('../src/main/core/checker'), mc = require('../src/main/core/mc');
const jar = (id, version, mcv, deps = {}, extra = {}) => zip({ 'fabric.mod.json': JSON.stringify({ id, version, depends: { minecraft: mcv, ...deps }, ...extra }) });
const base = (o = {}) => ({ mc: '1.21.1', loader: 'fabric', loaderVersion: '0.16.0', hw: { ram: 16384, freeMB: 8000 }, memoryMB: 4096, javaNeeded: 21, files: { versionJson: true, libsTotal: 50, libsMissing: 0 }, problems: [], modsCount: 30, modNames: [], ...o });
const codes = r => r.items.map(i => i.code);

// ---- чистая оценка ----
let r = C.evaluate(base()); assert.strictEqual(r.level, 'ok'); assert(codes(r).includes('modsOk') && !r.fixes.length);
r = C.evaluate(base({ problems: [{ type: 'wrongmc', id: 'x', name: 'X', need: '1.20' }] })); assert.strictEqual(r.level, 'critical'); assert.deepStrictEqual(r.fixes, ['repair']);
r = C.evaluate(base({ memoryMB: 20000 })); assert.strictEqual(r.level, 'critical'); assert(codes(r).includes('memOver')); assert.deepStrictEqual(r.fixes, ['memory']);
r = C.evaluate(base({ memoryMB: 512 })); assert.strictEqual(r.level, 'critical');
r = C.evaluate(base({ memoryMB: 2048, modsCount: 120 })); assert.strictEqual(r.level, 'warn'); assert(codes(r).includes('memLow'));
r = C.evaluate(base({ memoryMB: 14000 })); assert.strictEqual(r.level, 'warn'); assert(codes(r).includes('memHigh'));
r = C.evaluate(base({ hw: { ram: 16384, freeMB: 1000 } })); assert(codes(r).includes('memFree') && r.level === 'warn');
r = C.evaluate(base({ javaCustom: true })); assert.strictEqual(r.level, 'warn'); assert(codes(r).includes('javaCustom'));   // честно: «не проверено», а не «всё хорошо»
r = C.evaluate(base({ files: { versionJson: false } })); assert.strictEqual(r.level, 'ok'); assert(codes(r).includes('filesFirst'));
r = C.evaluate(base({ files: { versionJson: true, libsTotal: 50, libsMissing: 3 } })); assert.strictEqual(r.level, 'warn'); assert.deepStrictEqual(r.fixes, ['prepare']);
r = C.evaluate(base({ modNames: ['optifine-hd.jar', 'sodium'] })); assert.strictEqual(r.level, 'warn'); assert(codes(r).includes('suspect'));   // подозрение — только предупреждение
r = C.evaluate(base({ otherLoader: ['a.jar'], unknownMods: ['b.jar'] })); assert.strictEqual(r.level, 'warn');
r = C.evaluate(base({ problems: [{ type: 'missing', id: 'lib', by: 'a', name: 'A' }, { type: 'missing', id: 'lib', by: 'b', name: 'B' }] }));
assert.strictEqual(r.items.filter(i => i.code === 'missing').length, 1); assert.deepStrictEqual(r.items.find(i => i.code === 'missing').args.by, ['A', 'B']);   // одна строка на одну зависимость
r = C.evaluate(base({ problems: Array.from({ length: 30 }, (_, n) => ({ type: 'dup', id: 'm' + n, files: ['a', 'b'] })) })); assert(codes(r).includes('moreProblems') && r.items.filter(i => i.code === 'dup').length === 20);
r = C.evaluate(base({ loader: 'vanilla', problems: [{ type: 'wrongmc' }], memoryMB: 2048 })); assert.strictEqual(r.level, 'ok'); assert(!codes(r).includes('wrongmc'));  // у ванили моды не проверяются
assert(C.recommendMem(0, 16384) === 2048 && C.recommendMem(200, 16384) === 6144 && C.recommendMem(200, 4096) <= 2048 && C.recommendMem(200, 2048) === 1536);
// все коды имеют текст в интерфейсе (и ru, и en)
const src = fs.readFileSync(path.join(__dirname, '../src/renderer/checker-ui.js'), 'utf8');
for (const code of ['env','javaCustom','javaAuto','memOver','memTiny','memLow','memHigh','memFree','memOk','filesFirst','jarMissing','libsMissing','filesOk','wrongmc','loaderver','javaver','depver','missing','conflict','dup','moreProblems','otherLoader','suspect','unknownMods','modsOk'])
  assert.strictEqual((src.match(new RegExp('\\b' + code + ': (p|\\(\\)) =>', 'g')) || []).length, 2, 'нет перевода для ' + code);

// ---- на настоящей сборке ----
const { Instances } = require('../src/main/core/instances');
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-')), events = [];
  const st = { settings: { selected: 'a1', memory: 4096 }, account: () => ({ id: 'u', name: 'N', p: 'ely' }) };
  const inst = new Instances({ dataDir: tmp, store: st, emit: (ch, d) => events.push([ch, d]) });
  require('../src/main/core/auth').ensureFresh = async (c, s, a) => a; inst.requireLicense = async a => a; inst.preflight = async () => {};
  let launched = 0; mc.launch = async () => { launched++; return { kill() {} }; };
  const i = inst.create({ name: 'T', mc: '1.21.1', loader: 'fabric', loaderVersion: '0.16.0' });
  const mdir = inst.contentDir(i.id, 'mod'); fs.mkdirSync(mdir, { recursive: true });
  // версия игры ещё не скачана → не критично
  let rep = inst.compatReport(i.id); assert.strictEqual(rep.level, 'ok', JSON.stringify(rep.items)); assert(codes(rep).includes('filesFirst'));
  // положим version.json с библиотекой, которой нет на диске → предупреждение «докачать»
  const sh = inst.shared, vid = '1.21.1'; fs.mkdirSync(path.join(sh, 'versions', vid), { recursive: true });
  fs.writeFileSync(path.join(sh, 'versions', vid, vid + '.json'), JSON.stringify({ id: vid, javaVersion: { majorVersion: 21 }, libraries: [{ name: 'a:b:1', downloads: { artifact: { path: 'a/b/1/b-1.jar', url: 'http://x' } } }] }));
  const j = inst.read(i.id); j.versionId = vid; inst.write(j);
  rep = inst.compatReport(i.id); assert.strictEqual(rep.level, 'warn'); assert(codes(rep).includes('libsMissing') && codes(rep).includes('jarMissing'));
  fs.mkdirSync(path.join(sh, 'libraries/a/b/1'), { recursive: true }); fs.writeFileSync(path.join(sh, 'libraries/a/b/1/b-1.jar'), 'x'); fs.writeFileSync(path.join(sh, 'versions', vid, vid + '.jar'), 'x');
  rep = inst.compatReport(i.id); assert.strictEqual(rep.level, 'ok', JSON.stringify(rep.items)); assert(rep.items.some(x => x.code === 'javaAuto' && x.args.need === 21));
  // мод для другой версии игры → критично, запуск останавливается
  fs.writeFileSync(path.join(mdir, 'bad.jar'), jar('badmod', '1.0', '1.19'));
  rep = inst.compatReport(i.id); assert.strictEqual(rep.level, 'critical'); assert(codes(rep).includes('wrongmc'));
  let res = await inst.play(i.id); assert.deepStrictEqual([res && res.blocked, launched], [true, 0]);
  const ev = events.filter(e => e[0] === 'compat').pop(); assert(ev && ev[1].blocked && ev[1].report.level === 'critical');
  // «Запустить всё равно» (force) — запускает
  await inst.play(i.id, null, { force: true }); assert.strictEqual(launched, 1);
  inst.running.clear();
  // проверка выключена в настройках → не блокирует
  st.settings.compatCheck = false; await inst.play(i.id); assert.strictEqual(launched, 2); inst.running.clear(); st.settings.compatCheck = true;
  // мод для другого загрузчика и неизвестный jar — предупреждения, запуск не блокируется
  fs.rmSync(path.join(mdir, 'bad.jar')); fs.writeFileSync(path.join(mdir, 'forge.jar'), zip({ 'META-INF/mods.toml': 'modLoader="javafml"\n[[mods]]\nmodId="fm"\nversion="1"\n' })); fs.writeFileSync(path.join(mdir, 'mystery.jar'), zip({ 'x.txt': 'y' }));
  rep = inst.compatReport(i.id); assert.strictEqual(rep.level, 'warn', JSON.stringify(rep.items)); assert(codes(rep).includes('otherLoader') && codes(rep).includes('unknownMods'));
  res = await inst.play(i.id); assert.strictEqual(res, undefined); assert.strictEqual(launched, 3); assert(events.filter(e => e[0] === 'compat').pop()[1].blocked === false);
  inst.running.clear();
  // память больше, чем есть в компьютере → критично; починка памяти выводит её в норму
  inst.update(i.id, { memory: 999999 }); rep = inst.compatReport(i.id); assert.strictEqual(rep.level, 'critical'); assert(rep.fixes.includes('memory'));
  inst.update(i.id, { memory: rep.items.find(x => x.fix === 'memory').args.rec }); assert.notStrictEqual(inst.compatReport(i.id).level, 'critical');
  // сбой самой проверки не мешает играть
  inst.compatReport = () => { throw new Error('boom'); }; await inst.play(i.id); assert.strictEqual(launched, 4);
  console.log('checker: ok');
})().catch(e => { console.error(e); process.exit(1); });
