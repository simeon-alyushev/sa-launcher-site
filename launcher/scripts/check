// Быстрая проверка: синтаксис и полнота переводов.   node scripts/check.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
let bad = 0;
for (const f of walk(path.join(__dirname, '../src')).filter(f => f.endsWith('.js'))) { try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad++; console.error('SYNTAX', f, String(e.stderr)); } }
const { KEYS, RAW } = require('../src/renderer/i18n.js');
for (const c in RAW) { const n = RAW[c][1].split('|').length; if (n !== KEYS.length) { bad++; console.error('i18n', c, n, '!=', KEYS.length); } }
console.log(bad ? 'FAIL' : `OK: ${Object.keys(RAW).length} языков, ${KEYS.length} ключей`); process.exit(bad ? 1 : 0);
