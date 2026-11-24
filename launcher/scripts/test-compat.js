// Проверка статической проверки совместимости модов на поддельных jar (без Minecraft и сети).   node scripts/test-compat.js
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib'), assert = require('assert');
const C = require('../src/main/core/compat');

// версии: старые, новые («26.1») и диапазоны
assert(C.cmpVer('1.20.1', '1.20') > 0 && C.cmpVer('26.1', '1.21.11') > 0 && C.cmpVer('1.16.5', '1.16.5') === 0 && C.cmpVer('1.20', '1.20.0') === 0);
assert(C.fabricMatch('>=1.20 <1.21', '1.20.4') && !C.fabricMatch('>=1.20 <1.21', '1.21'));
assert(C.fabricMatch('1.21.x', '1.21.4') && !C.fabricMatch('1.21.x', '26.1'));
assert(C.fabricMatch('~1.20.1', '1.20.4') && !C.fabricMatch('~1.20.1', '1.21'));
assert(C.fabricMatch('^1.16', '1.16.5') && !C.fabricMatch('^1.16', '26.1'));
assert(C.fabricMatch(['1.16.5', '>=1.20'], '1.20.6') && !C.fabricMatch(['1.16.5', '1.17'], '1.18'));
assert(C.fabricMatch('*', '26.1') && C.fabricMatch(undefined, '26.1') && C.fabricMatch('>=26.1', '26.1'));
assert(C.forgeMatch('[1.20,1.21)', '1.20.1') && !C.forgeMatch('[1.20,1.21)', '1.21') && C.forgeMatch('[1.16.5]', '1.16.5') && !C.forgeMatch('[1.16.5]', '1.16.4'));

// поддельные jar (zip без сжатия)
const T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) {
  const parts = [], cen = []; let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const nm = Buffer.from(name), data = Buffer.from(text), h = Buffer.alloc(30); const c = crc(data);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(c, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26);
    const e = Buffer.alloc(46); e.writeUInt32LE(0x02014b50, 0); e.writeUInt16LE(20, 4); e.writeUInt16LE(20, 6); e.writeUInt32LE(c, 16); e.writeUInt32LE(data.length, 20); e.writeUInt32LE(data.length, 24); e.writeUInt16LE(nm.length, 28); e.writeUInt32LE(off, 42);
    parts.push(h, nm, data); cen.push(e, nm); off += 30 + nm.length + data.length;
  }
  const cb = Buffer.concat(cen), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(cen.length / 2, 8); end.writeUInt16LE(cen.length / 2, 10); end.writeUInt32LE(cb.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cb, end]);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-'));
const jar = (f, j) => fs.writeFileSync(path.join(tmp, f), zip({ 'fabric.mod.json': JSON.stringify(j) }));
jar('fabric-api.jar', { id: 'fabric-api', version: '0.1', depends: { minecraft: '>=1.21' } });
jar('sodium.jar', { id: 'sodium', version: '0.5', depends: { minecraft: '1.21.x', 'fabric-resource-loader-v0': '*' } });                    // под 1.21, а игра 26.1
jar('iris.jar', { id: 'iris', version: '1.8', depends: { minecraft: '>=26.1', sodium: '>=0.6' } });
jar('lithium.jar', { id: 'lithium', version: '1', depends: { minecraft: '*', 'some-lib': '*' } });                                              // нет some-lib
jar('lithium-copy.jar', { id: 'lithium', version: '1' });
fs.writeFileSync(path.join(tmp, 'old.jar.disabled'), 'x');
const r = C.scan(tmp, '26.1', 'fabric').problems;
const has = (type, id) => r.some(p => p.type === type && p.id === id);
assert(has('wrongmc', 'sodium') && has('wrongmc', 'fabric-api') === false || has('wrongmc', 'fabric-api'), 'sodium/fabric-api под 1.21');
assert(has('wrongmc', 'sodium') && !has('wrongmc', 'iris') && !has('wrongmc', 'lithium'));
assert(has('missing', 'some-lib') && !has('missing', 'fabric-resource-loader-v0'), 'модули Fabric API не считаются отсутствующими');
assert(has('dup', 'lithium'));
assert(C.scan(tmp, '1.21.4', 'fabric').problems.every(p => p.id !== 'sodium' || p.type !== 'wrongmc'), 'под 1.21.4 sodium подходит');
fs.rmSync(tmp, { recursive: true, force: true });
console.log('OK compat');
