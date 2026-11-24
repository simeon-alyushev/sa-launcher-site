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
console.log('OK hotkeys');
