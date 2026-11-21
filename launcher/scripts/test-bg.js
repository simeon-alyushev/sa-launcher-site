// Проверка хранилища своих фонов:  node scripts/test-bg.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const { Backgrounds } = require('../src/main/core/bg');
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-bg-')), src = path.join(d, 'src'); fs.mkdirSync(src);
const w = (n, b) => { const f = path.join(src, n); fs.writeFileSync(f, b); return f; };
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(20)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
const store = { settings: {}, set(p) { Object.assign(this.settings, p); } };
const B = new Backgrounds(d, store); let n = 0; const ok = (m, f) => { f(); n++; console.log('  ✓', m); };
for (const [name, buf, ext] of [['a.png', png, 'png'], ['b.jpeg', jpg, 'jpg'], ['c.gif', gif, 'gif'], ['d.webp', webp, 'webp']]) ok('принимает ' + ext, () => { const r = B.add(w(name, buf)); assert.strictEqual(r.item.ext, ext); assert.ok(B.file(r.item.id).endsWith('.' + ext)); assert.strictEqual(store.settings.customBgSel, r.item.id); });
ok('.exe под видом .png отвергается по сигнатуре', () => assert.throws(() => B.add(w('evil.png', Buffer.from('MZ' + 'x'.repeat(40)))), /bgBad/));
ok('SVG/HTML отвергаются', () => assert.throws(() => B.add(w('x.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))), /bgBad/));
ok('замена: старый файл удалён, выбор сохраняется на новом', () => { const old = B.list()[2]; const r = B.add(w('n.png', png), old.id); assert.strictEqual(B.file(old.id), null); assert.ok(B.file(r.item.id)); assert.strictEqual(B.list().length, 4); });
ok('удаление: файл стёрт, выбор переходит на другой', () => { const id = store.settings.customBgSel; const r = B.remove(id); assert.strictEqual(B.file(id), null); assert.strictEqual(r.list.length, 3); assert.ok(r.sel && r.sel !== id); });
ok('лимит 8 файлов', () => { while (B.list().length < 8) B.add(w('z.png', png)); assert.throws(() => B.add(w('z2.png', png)), /bgLimit/); });
ok('file(): обход пути невозможен', () => { assert.strictEqual(B.file('../../etc/passwd'), null); assert.strictEqual(B.file('ABCDEF123456'), null); });
console.log('OK:', n); fs.rmSync(d, { recursive: true, force: true });
