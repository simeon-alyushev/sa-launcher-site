// Горячие клавиши: разбор событий, настройка, конфликты, сброс.   node scripts/test-hotkeys.js
const assert = require('assert'), H = require('../src/renderer/hotkeys');
const ev = (key, o = {}) => ({ key, ctrlKey: !!o.ctrl, shiftKey: !!o.shift, altKey: !!o.alt, metaKey: !!o.meta });
assert.strictEqual(H.fromEvent(ev('r', { ctrl: true, shift: true })), 'Ctrl+Shift+R');
assert.strictEqual(H.fromEvent(ev('1', { ctrl: true })), 'Ctrl+1');
assert.strictEqual(H.fromEvent(ev(',', { ctrl: true })), 'Ctrl+,');
assert.strictEqual(H.fromEvent(ev('r', { meta: true })), 'Ctrl+R');                 // Cmd на macOS = Ctrl
assert.strictEqual(H.fromEvent(ev('Control', { ctrl: true })), '');                  // только модификатор
assert.strictEqual(H.fromEvent(ev('Escape')), '');
assert(H.valid('Ctrl+1') && H.valid('F5') && H.valid('Alt+X') && !H.valid('R') && !H.valid('Shift+R'));
// стандартные сочетания из ТЗ
const def = H.effective({});
assert.deepStrictEqual([def['play:vanilla-sa'], def['play:pvp-sa'], def['play:servers-sa'], def.refresh, def.settings, def.repairAll, def.checkAll], ['Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+R', 'Ctrl+,', 'Ctrl+Shift+R', 'Ctrl+Shift+A']);
assert.deepStrictEqual(H.conflicts(def), {});
// изменить, отключить, вернуть стандартное
let saved = H.assign({}, 'refresh', 'F5'); assert.deepStrictEqual(saved, { refresh: 'F5' });
assert.strictEqual(H.effective(saved).refresh, 'F5'); assert.strictEqual(H.match(H.effective(saved), ev('F5')), 'refresh'); assert.strictEqual(H.match(H.effective(saved), ev('r', { ctrl: true })), null);
saved = H.assign(saved, 'settings', ''); assert.strictEqual(H.effective(saved).settings, '');                       // отключено
assert.strictEqual(H.match(H.effective(saved), ev(',', { ctrl: true })), null);
saved = H.assign(saved, 'refresh', 'Ctrl+R'); assert(!('refresh' in saved), 'возврат к стандартному убирает запись');
// конфликт: два действия на одно сочетание (регистр не важен)
const c = H.conflicts(H.effective({ playLast: 'ctrl+1' })); assert.deepStrictEqual(c['ctrl+1'].sort(), ['play:vanilla-sa', 'playLast']);
// отключённые действия не считаются конфликтом и не срабатывают
assert.deepStrictEqual(H.conflicts(H.effective({ 'play:pvp-sa': '', 'play:servers-sa': '' })), {});
// раскладки: русская (key зависит от раскладки, code — физическая клавиша), Shift+цифра, знаки препинания
const evc = (key, code, o = {}) => ({ ...ev(key, o), code });
assert.strictEqual(H.fromEvent(evc('к', 'KeyR', { ctrl: true })), 'Ctrl+R', 'Ctrl+R на русской раскладке');
assert.strictEqual(H.fromEvent(evc('К', 'KeyR', { ctrl: true, shift: true })), 'Ctrl+Shift+R', 'Ctrl+Shift+R на русской раскладке');
assert.strictEqual(H.fromEvent(evc('ф', 'KeyA', { ctrl: true, shift: true })), 'Ctrl+Shift+A');
assert.strictEqual(H.fromEvent(evc('б', 'Comma', { ctrl: true })), 'Ctrl+,', 'Ctrl+, на русской раскладке');
assert.strictEqual(H.fromEvent(evc('1', 'Digit1', { ctrl: true })), 'Ctrl+1');
assert.strictEqual(H.fromEvent(evc('!', 'Digit1', { ctrl: true, shift: true })), 'Ctrl+Shift+1', 'Shift+1 даёт «!», но это клавиша 1');
assert.strictEqual(H.fromEvent(evc('r', 'KeyR', { ctrl: true })), 'Ctrl+R');
assert.strictEqual(H.fromEvent(evc('Dead', '', { ctrl: true })), '', 'мёртвая клавиша без кода игнорируется');
assert.strictEqual(H.fromEvent(evc('F5', 'F5')), 'F5'); assert.strictEqual(H.fromEvent(evc('ArrowUp', 'ArrowUp', { alt: true })), 'Alt+Up');
// Dvorak/Colemak: key — печатаемый символ раскладки, он и используется (code не подменяет)
assert.strictEqual(H.fromEvent(evc('p', 'KeyR', { ctrl: true })), 'Ctrl+P');
// сработает именно то действие, что назначено, и на русской раскладке
assert.strictEqual(H.match(H.effective({}), evc('к', 'KeyR', { ctrl: true })), 'refresh');
assert.strictEqual(H.match(H.effective({}), evc('ё', 'Digit2', { ctrl: true })), 'play:pvp-sa');
assert.strictEqual(def.devMode, 'Ctrl+Shift+D'); assert.strictEqual(H.match(def, ev('d', { ctrl: true, shift: true })), 'devMode'); assert.strictEqual(H.match(def, evc('в', 'KeyD', { ctrl: true, shift: true })), 'devMode', 'Ctrl+Shift+D на русской раскладке');
console.log('OK hotkeys');
