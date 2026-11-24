/* SA Hotkeys — чистая логика горячих клавиш (без DOM, проверяется тестом scripts/test-hotkeys.js) */
(function (root) {
  // id действия, стандартное сочетание ('' = по умолчанию не назначено)
  const ACTIONS = [
    ['play:vanilla-sa', 'Ctrl+1'], ['play:pvp-sa', 'Ctrl+2'], ['play:servers-sa', 'Ctrl+3'],
    ['refresh', 'Ctrl+R'], ['settings', 'Ctrl+,'], ['repairAll', 'Ctrl+Shift+R'], ['checkAll', 'Ctrl+Shift+A'],
    ['playSelected', ''], ['playLast', ''], ['updateMods', ''], ['openMc', ''], ['openInst', ''],
    ['backup', ''], ['restore', ''], ['modManager', ''], ['javaSettings', ''], ['diagnostics', '']
  ];
  const MOD_ONLY = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);
  const NAMES = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Escape: 'Esc', Delete: 'Del' };
  // Событие клавиатуры -> «Ctrl+Shift+R». Только модификатор или Esc/Backspace/Tab -> ''
  function fromEvent(e) {
    if (!e || MOD_ONLY.has(e.key) || ['Escape', 'Backspace', 'Tab', 'Enter'].includes(e.key)) return '';
    let k = NAMES[e.key] || e.key; if (k.length === 1) k = k.toUpperCase();
    const p = []; if (e.ctrlKey || e.metaKey) p.push('Ctrl'); if (e.altKey) p.push('Alt'); if (e.shiftKey) p.push('Shift');
    return [...p, k].join('+');
  }
  // Допустимо: с Ctrl или Alt (чтобы не перехватывать обычный набор текста) либо функциональная клавиша
  function valid(c) { return /^(Ctrl|Alt)\+/.test(c) || /^(Shift\+)?F([1-9]|1[0-2])$/.test(c); }
  // Итоговая карта действие -> сочетание: сохранённое значение ('' = отключено) или стандартное
  function effective(saved) {
    const m = {}; for (const [id, def] of ACTIONS) m[id] = saved && Object.prototype.hasOwnProperty.call(saved, id) ? String(saved[id] || '') : def; return m;
  }
  // Конфликты: сочетание -> список действий, которым оно назначено (больше одного)
  function conflicts(map) {
    const by = {}; for (const [id, c] of Object.entries(map)) if (c) (by[c.toLowerCase()] = by[c.toLowerCase()] || []).push(id);
    const out = {}; for (const [c, ids] of Object.entries(by)) if (ids.length > 1) out[c] = ids; return out;
  }
  // Действие по событию (или null)
  function match(map, e) { const c = fromEvent(e).toLowerCase(); if (!c) return null; for (const [id, v] of Object.entries(map)) if (v && v.toLowerCase() === c) return id; return null; }
  // Обновить сохранённый набор: хранится только то, что отличается от стандартного
  function assign(saved, id, combo) {
    const s = Object.assign({}, saved || {}), def = (ACTIONS.find(a => a[0] === id) || [])[1] || '';
    if (combo === def) delete s[id]; else s[id] = combo; return s;
  }
  const api = { ACTIONS, fromEvent, valid, effective, conflicts, match, assign };
  if (typeof module !== 'undefined') module.exports = api; else root.SAHotkeys = api;
})(typeof window !== 'undefined' ? window : globalThis);
