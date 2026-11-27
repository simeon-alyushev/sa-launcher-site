/* SA Hotkeys — чистая логика горячих клавиш (без DOM, проверяется тестом scripts/test-hotkeys.js) */
(function (root) {
  // id действия, стандартное сочетание ('' = по умолчанию не назначено)
  const ACTIONS = [
    ['play:vanilla-sa', 'Ctrl+1'], ['play:pvp-sa', 'Ctrl+2'], ['play:servers-sa', 'Ctrl+3'],
    ['refresh', 'Ctrl+R'], ['settings', 'Ctrl+,'], ['repairAll', 'Ctrl+Shift+R'], ['checkAll', 'Ctrl+Shift+A'],
    ['devMode', 'Ctrl+Shift+D'], ['playSelected', ''], ['playLast', ''], ['updateMods', ''], ['openMc', ''], ['openInst', ''],
    ['backup', ''], ['restore', ''], ['modManager', ''], ['javaSettings', ''], ['diagnostics', '']
  ];
  const MOD_ONLY = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);
  const NAMES = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Escape: 'Esc', Delete: 'Del' };
  // Физическая клавиша (e.code) -> имя. Нужна, когда e.key зависит от раскладки: на русской раскладке Ctrl+R даёт key «к», а Shift+1 — «!».
  const PUNCT = { Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`' };
  function keyName(e) {
    const k = e.key, code = String(e.code || ''), plain = typeof k === 'string' && k.length === 1 && k.charCodeAt(0) < 128, m = /^Key([A-Z])$/.exec(code) || /^Digit(\d)$/.exec(code);
    if (typeof k === 'string' && k.length > 1 && (NAMES[k] || /^(F\d{1,2}|Arrow\w+|Home|End|Page\w+|Insert|Enter|Backspace|Tab)$/.test(k))) return NAMES[k] || k;   // именованные клавиши
    if (m && (!plain || (e.shiftKey && /^Digit/.test(code)) || (!/[a-z]/i.test(k) && /^Key/.test(code)))) return m[1];                                              // буква/цифра с другой раскладки или с Shift
    if (PUNCT[code] && (!plain || e.shiftKey)) return PUNCT[code];
    if (!plain && !PUNCT[code] && !m) return '';                                                                                                                    // «Dead», «Unidentified» и т. п. без физической клавиши
    return k.length === 1 ? k.toUpperCase() : k;
  }
  // Событие клавиатуры -> «Ctrl+Shift+R». Только модификатор или Esc/Backspace/Tab -> ''
  function fromEvent(e) {
    if (!e || MOD_ONLY.has(e.key) || ['Escape', 'Backspace', 'Tab', 'Enter'].includes(e.key)) return '';
    const k = keyName(e); if (!k) return '';
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
