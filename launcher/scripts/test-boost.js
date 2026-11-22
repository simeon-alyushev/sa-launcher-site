'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const B = require('../src/main/core/boost');
for (const p of B.PRESETS) for (const hw of [{ ram: 4096, cores: 2 }, { ram: 8192, cores: 4 }, { ram: 16384, cores: 8 }, { ram: 65536, cores: 16 }]) for (const java of [8, 17, 21, 22, 23, 25]) {
  const r = B.plan(p, { ...hw, java, loader: 'fabric' });
  assert(r.mem >= 1536 && r.mem <= hw.ram - 2048 + 512 && r.xms <= r.mem, JSON.stringify([p, hw, r.mem]));
  if (java !== 21 && java !== 22) assert(!/ZGenerational/.test(r.flags), 'zgc on java ' + java);
  assert(!/AlwaysPreTouch/.test(r.flags));
}
assert.strictEqual(B.plan('fps', { ram: 32768, cores: 16, java: 21 }).gc, 'ZGC');
assert.strictEqual(B.recommend({ ram: 4096, cores: 8 }), 'weak'); assert.strictEqual(B.recommend({ ram: 32768, cores: 12 }), 'fps');
assert.strictEqual(B.guessJava('1.16.5'), 8); assert.strictEqual(B.guessJava('1.20.1'), 17); assert.strictEqual(B.guessJava('1.21.4'), 21);
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sab-')), f = path.join(d, 'options.txt');
assert.throws(() => B.applyOptions(d, 'fps'), /noOptions/);
const orig = 'renderDistance:16\r\nparticles:0\r\nsimulationDistance:5\r\nfancyGraphics:true\r\nlang:ru_ru\r\n';
fs.writeFileSync(f, orig);
const pv = B.preview(d, 'fps'); assert(pv.changes.some(c => c.key === 'renderDistance' && c.to === '8'));
assert(!pv.changes.some(c => c.key === 'simulationDistance'), 'must not raise');
assert.strictEqual(fs.readFileSync(f, 'utf8'), orig, 'preview must not write');
B.applyOptions(d, 'fps'); const now = fs.readFileSync(f, 'utf8');
assert(/renderDistance:8\r\n/.test(now) && /fancyGraphics:false/.test(now) && /lang:ru_ru/.test(now) && /simulationDistance:5/.test(now));
B.applyOptions(d, 'weak'); B.revertOptions(d);
assert.strictEqual(fs.readFileSync(f, 'utf8'), orig, 'revert restores original'); assert(!fs.existsSync(path.join(d, B.BAK)));
assert.throws(() => B.revertOptions(d), /noBackup/);
console.log('boost ok');
