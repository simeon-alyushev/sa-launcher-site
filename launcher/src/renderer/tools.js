/* SA Tools: горячие клавиши, автозапуск, «Починить все сборки», проверка и история починок.
   Подключается после app.js и использует его функции (S, api, go, modal, toast…). Ничего в app.js не переписывает, кроме обёртки над viewSettings. */
(function () {
  'use strict';
  const H = window.SAHotkeys;
  const ru = () => S.settings.lang === 'ru' || S.settings.lang === 'uk';
  const TX = {
    ru: {
      hk: 'Горячие клавиши', hkD: 'Нажмите на сочетание, затем новые клавиши (Esc — отмена). Нужны Ctrl или Alt, либо клавиша F1–F12.', hkReset: 'Сбросить', hkOff: 'Отключить', hkAll: 'Сбросить все', hkPress: 'Нажмите клавиши…', hkNone: 'не назначено', hkConflict: 'Конфликт: это сочетание уже назначено', hkBad: 'Нужны Ctrl или Alt, либо клавиша F1–F12', hkNoBuild: 'Сборка не установлена. Установите её в разделе «Сборки SA»', hkNoInst: 'Выберите сборку', hkNoAcc: 'Сначала войдите в аккаунт',
      'a:play:vanilla-sa': ['Запустить Vanilla SA', 'Запускает установленную сборку Vanilla SA'], 'a:play:pvp-sa': ['Запустить PvP SA', 'Запускает установленную сборку PvP SA'], 'a:play:servers-sa': ['Запустить Servers SA (мультиплеер)', 'Запускает установленную сборку Servers SA'],
      'a:devMode': ['Режим разработчика', 'Панель владельца (только владелец)'],
      'a:refresh': ['Обновить данные', 'Перечитывает список сборок и каталог'], 'a:settings': ['Открыть настройки', 'Переходит в раздел «Настройки»'], 'a:repairAll': ['Починить все сборки', 'Проверяет и чинит все сборки по очереди'], 'a:checkAll': ['Проверить все сборки', 'Показывает состояние каждой сборки без изменений'],
      'a:playSelected': ['Запустить выбранную сборку', 'Запускает сборку, открытую сейчас'], 'a:playLast': ['Запустить последнюю сборку', 'Запускает сборку, в которую играли последней'], 'a:updateMods': ['Обновить моды', 'Ищет обновления модов выбранной сборки'], 'a:openMc': ['Открыть папку лаунчера', 'Папка данных SA Launcher'], 'a:openInst': ['Открыть папку сборки', 'Папка игры выбранной сборки'],
      'a:backup': ['Создать резервную копию', 'Копия миров выбранной сборки'], 'a:restore': ['Восстановить копию', 'Окно восстановления миров'], 'a:modManager': ['Менеджер модов', 'Вкладка модов выбранной сборки'], 'a:javaSettings': ['Настройки Java', 'Настройки выбранной сборки (память, Java)'], 'a:diagnostics': ['Центр диагностики', 'Состояние сборок и история починок'],
      st: 'Автозапуск при старте', stD: 'По умолчанию выключен. Перед запуском 5 секунд можно отменить клавишей Esc.', stMode: ['Ничего не делать', 'Запускать последнюю сборку', 'Запускать выбранную сборку', 'Сначала проверить и починить, затем запустить'], stInst: 'Сборка', stCancel: 'Автозапуск через 5 с (Esc — отмена)', stCanceled: 'Автозапуск отменён', stNoInst: 'Автозапуск: сборка не найдена',
      tools: 'Починка и диагностика', toolsD: 'Проверка модов по их файлам: версия игры, загрузчик, зависимости, конфликты. Перед изменениями делается копия модов; если починка не помогла, всё возвращается назад.', repairAll: 'Починить все сборки', checkAll: 'Проверить все сборки', diag: 'Диагностика сборок', hist: 'История починок', running: 'Идёт…', ok: 'В порядке', warn: 'Есть замечания', bad: 'Есть проблемы', none: 'Проблем нет', before: 'Было проблем', after: 'Осталось', fixed: 'Исправлено', failed: 'Не удалось', rolled: 'Починка не помогла — моды возвращены как были', backup: 'Копия', crash: 'Отчёт о вылете сохранён', offline: 'нет интернета', busy: 'сборка занята', clean: 'Проблем не найдено', repair1: 'Починить', noHist: 'Починок пока не было', close: 'Закрыть', gameFiles: 'Файлы игры',
      rConfirm: 'Починить все сборки?', rConfirmD: 'Затронуты только сборки с проблемами. Перед изменениями для каждой делается копия модов; файлы не удаляются, ненужные моды получают .disabled. Любую починку можно отменить.', rStart: 'Починить', rNothing: 'Проблем не найдено: чинить нечего', rClean: 'Без проблем', undo: 'Отменить починку', undoD: 'Вернёт моды в состояние до этой починки', undone: 'Починка отменена', undoFail: 'Копия для отмены не найдена', checking: 'Проверка…',
      act: { installed: 'установлен', updated: 'версия подобрана', disabled: 'отключён', replaced: 'заменён' }, why: 'из-за'
    },
    en: {
      hk: 'Hotkeys', hkD: 'Click a shortcut, then press the new keys (Esc cancels). Ctrl or Alt is required, or an F1–F12 key.', hkReset: 'Reset', hkOff: 'Disable', hkAll: 'Reset all', hkPress: 'Press keys…', hkNone: 'not set', hkConflict: 'Conflict: this shortcut is already assigned', hkBad: 'Ctrl or Alt is required, or an F1–F12 key', hkNoBuild: 'This build is not installed. Install it in “SA Builds”', hkNoInst: 'Select an instance first', hkNoAcc: 'Sign in first',
      'a:play:vanilla-sa': ['Launch Vanilla SA', 'Launches the installed Vanilla SA build'], 'a:play:pvp-sa': ['Launch PvP SA', 'Launches the installed PvP SA build'], 'a:play:servers-sa': ['Launch Servers SA (multiplayer)', 'Launches the installed Servers SA build'],
      'a:devMode': ['Developer mode', 'Owner panel (owner only)'],
      'a:refresh': ['Refresh data', 'Reloads the instance list and catalog'], 'a:settings': ['Open settings', 'Goes to Settings'], 'a:repairAll': ['Repair all instances', 'Checks and repairs every instance one by one'], 'a:checkAll': ['Check all instances', 'Shows the state of each instance without changes'],
      'a:playSelected': ['Launch selected instance', 'Launches the instance that is open now'], 'a:playLast': ['Launch last instance', 'Launches the instance you played last'], 'a:updateMods': ['Update mods', 'Looks for mod updates in the selected instance'], 'a:openMc': ['Open launcher folder', 'SA Launcher data folder'], 'a:openInst': ['Open instance folder', 'Game folder of the selected instance'],
      'a:backup': ['Create backup', 'Backup of the selected instance’s worlds'], 'a:restore': ['Restore backup', 'World restore window'], 'a:modManager': ['Mod manager', 'Mods tab of the selected instance'], 'a:javaSettings': ['Java settings', 'Selected instance settings (memory, Java)'], 'a:diagnostics': ['Diagnostics center', 'Instance status and repair history'],
      st: 'Launch on startup', stD: 'Off by default. You get 5 seconds to cancel with Esc.', stMode: ['Do nothing', 'Launch the last instance', 'Launch the selected instance', 'Check and repair first, then launch'], stInst: 'Instance', stCancel: 'Auto-launch in 5 s (Esc to cancel)', stCanceled: 'Auto-launch canceled', stNoInst: 'Auto-launch: instance not found',
      tools: 'Repair & diagnostics', toolsD: 'Mods are checked by their own files: game version, loader, dependencies, conflicts. A copy of the mods is made first; if a repair does not help, everything is restored.', repairAll: 'Repair all instances', checkAll: 'Check all instances', diag: 'Instance diagnostics', hist: 'Repair history', running: 'Working…', ok: 'OK', warn: 'Warnings', bad: 'Problems', none: 'No problems', before: 'Problems before', after: 'Left', fixed: 'Fixed', failed: 'Failed', rolled: 'The repair did not help — mods were restored as they were', backup: 'Backup', crash: 'Crash report saved', offline: 'offline', busy: 'instance is busy', clean: 'No problems found', repair1: 'Repair', noHist: 'No repairs yet', close: 'Close', gameFiles: 'Game files',
      rConfirm: 'Repair all instances?', rConfirmD: 'Only instances with problems are touched. A copy of the mods is made first; files are never deleted — unneeded mods get .disabled. Any repair can be undone.', rStart: 'Repair', rNothing: 'No problems found — nothing to repair', rClean: 'No problems', undo: 'Undo repair', undoD: 'Restores the mods to how they were before this repair', undone: 'Repair undone', undoFail: 'Undo copy not found', checking: 'Checking…',
      act: { installed: 'installed', updated: 'matching version chosen', disabled: 'disabled', replaced: 'replaced' }, why: 'because of'
    }
  };
  const X = k => (TX[ru() ? 'ru' : 'en'][k] !== undefined ? TX[ru() ? 'ru' : 'en'][k] : TX.en[k]);
  const dot = st => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;background:${{ ok: '#4ade80', warn: '#facc15', bad: '#f87171' }[st] || '#888'}"></span>`;
  const fail = e => toast(String(e && e.message || e).replace(/^Error: /, ''), 'err');

  // ---------- горячие клавиши ----------
  const hkMap = () => H.effective(S.settings.hotkeys);
  const hkSave = saved => { S.settings.hotkeys = saved; api('settings:set', { hotkeys: saved }).catch(() => {}); };
  const instFor = async buildId => {
    let list = S.instances || []; let hit = list.find(i => i.buildId === buildId);
    if (!hit) { try { S.builds = S.builds || await api('build:list'); } catch (_) {} const b = (S.builds || []).find(x => x.id === buildId); if (b) hit = list.find(i => i.name === b.name); }
    return hit || null;
  };
  const playInst = async i => {
    if (!i) return toast(X('hkNoInst'), '');
    if (!cur()) { toast(X('hkNoAcc'), ''); return accountsModal(); }
    try { await api('inst:play', i.id); } catch (e) { fail(e); }
  };
  const sel = () => (S.instances || []).find(i => i.id === S.instId) || null;
  const needSel = () => { const i = sel(); if (!i) toast(X('hkNoInst'), ''); return i; };
  const ACTIONS = {
    refresh: async () => { S.builds = null; await refresh(); renderRail(); renderView(); toast('✓', 'ok'); },
    settings: () => go('settings'),
    repairAll: () => repairAll(), checkAll: () => diagnostics(), diagnostics: () => diagnostics(),
    devMode: () => { if (window.SAOwner) window.SAOwner.toggleDev(); },          // только владелец: у остальных ничего не происходит и ничего не показывается
    playSelected: () => playInst(needSel()),
    playLast: () => playInst([...(S.instances || [])].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0]),
    openMc: () => api('app:openData').catch(fail),
    openInst: () => { const i = needSel(); if (i) api('inst:folder', { id: i.id }).catch(fail); },
    backup: async () => { const i = needSel(); if (!i) return; try { await api('inst:backup', i.id); toast('✓', 'ok'); } catch (e) { fail(e); } },
    restore: () => { const i = needSel(); if (i) restoreModal(i.id); },
    modManager: () => { const i = needSel(); if (i) { S.tab = 'mods'; go('inst', i.id); } },
    javaSettings: () => { const i = needSel(); if (i) { S.tab = 'settings'; go('inst', i.id); } },
    updateMods: async () => {
      const i = needSel(); if (!i) return;
      try { const up = await api('inst:modUpdates', i.id); if (!up.length) return toast(ru() ? 'Все моды актуальны' : 'All mods are up to date', 'ok');
        modal(`<h2>${esc(i.name)}</h2><p class="mu">${up.length} ${ru() ? 'обновлений' : 'updates'}: ${esc(up.map(u => u.title).join(', '))}</p><div class="foot"><button class="btn" data-close>${esc(X('close'))}</button><button class="btn p" id="hkupd">OK</button></div>`);
        $('#hkupd').onclick = async () => { closeModal(); try { await api('inst:updateMods', { id: i.id }); toast('✓', 'ok'); } catch (e) { fail(e); } };
      } catch (e) { fail(e); }
    }
  };
  let rec = null;                                                                   // id действия, для которого записываем сочетание
  async function runAction(id) {
    if (id.startsWith('play:')) { const i = await instFor(id.slice(5)); if (!i) { toast(X('hkNoBuild'), ''); return go('builds'); } return playInst(i); }
    if (ACTIONS[id]) return ACTIONS[id]();
  }
  document.addEventListener('keydown', e => {
    if (rec) {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { rec = null; return hkDraw(); }
      const c = H.fromEvent(e); if (!c) return;
      if (!H.valid(c)) return toast(X('hkBad'), '');
      const next = H.assign(S.settings.hotkeys, rec, c); const conf = H.conflicts(H.effective(next));
      hkSave(next); if (conf[c.toLowerCase()]) toast(X('hkConflict') + ': ' + c, ''); rec = null; return hkDraw();
    }
    const id = H.match(hkMap(), e); if (!id) return;
    if (document.querySelector('#modal:not(.hide)') && !/^(refresh|settings)$/.test(id)) return;   // при открытом окне запуск и починку не вызываем
    e.preventDefault(); runAction(id);
  }, true);

  // ---------- отчёты ----------
  const actText = x => (X('act')[x.action] || x.action) + (x.to ? ' → ' + x.to : '') + (x.why ? ` (${X('why')} ${x.why})` : '');
  const failText = x => x.error === 'offline' ? X('offline') : x.error === 'busy' ? X('busy') : (x.error || '');
  function reportHtml(r) {
    const rows = [...(r.fixed || []).map(x => `<div class="sm">✓ <b>${esc(x.title || x.id)}</b> — ${esc(actText(x))}</div>`), ...(r.failed || []).map(x => `<div class="sm" style="color:#f87171">✕ <b>${esc(x.id)}</b> — ${esc(failText(x))}</div>`)].join('');
    return `<div class="card" style="margin-bottom:10px"><b>${esc(r.name)}</b><div class="mu sm">${esc(X('before'))}: ${r.before.length} · ${esc(X('after'))}: ${r.after.length}${r.notes && r.notes.includes('clean') ? ' · ' + esc(X('clean')) : ''}</div>${rows}${r.rolledBack ? `<div class="sm" style="color:#facc15;margin-top:6px">↩ ${esc(X('rolled'))}</div>` : ''}${r.backup && !r.rolledBack && (r.fixed || []).length ? `<button class="btn sm" style="margin-top:8px" data-hkundo="${esc(r.id)}|${r.time}" title="${esc(X('undoD'))}">↩ ${esc(X('undo'))}</button>` : ''}${r.crashReport ? `<div class="mu sm">${esc(X('crash'))}</div>` : ''}${r.gameFiles && r.gameFiles !== 'ok' ? `<div class="mu sm">${esc(X('gameFiles'))}: ${esc(r.gameFiles)}</div>` : ''}</div>`;
  }
  // «Починить все»: сначала показываем, что именно будет затронуто, и только после подтверждения чиним
  async function repairAll() {
    modal(`<h2>${esc(X('rConfirm'))}</h2><p class="mu">${esc(X('checking'))}</p>`);
    let st; try { st = await api('inst:checkAll'); } catch (e) { closeModal(); return fail(e); }
    const bad = st.filter(s => s.problems.length);
    if (!bad.length) return modal(`<h2>${esc(X('repairAll'))}</h2><p class="mu">${esc(X('rNothing'))}</p><div class="foot"><button class="btn p" data-close>OK</button></div>`);
    modal(`<h2>${esc(X('rConfirm'))}</h2><p class="mu sm">${esc(X('rConfirmD'))}</p><div style="max-height:50vh;overflow:auto">${st.map(s => `<div class="card" style="margin-bottom:8px">${dot(s.status)}<b>${esc(s.name)}</b> <span class="mu sm">${s.problems.length ? esc(s.problems.map(p => (p.name || p.id) + ' (' + p.type + ')').join(', ')) : esc(X('rClean'))}</span></div>`).join('')}</div><div class="foot"><button class="btn" data-close>${esc(X('close'))}</button><button class="btn p" id="hkgo">${esc(X('rStart'))} (${bad.length})</button></div>`);
    $('#hkgo').onclick = () => doRepairAll();
  }
  async function doRepairAll() {
    modal(`<h2>${esc(X('repairAll'))}</h2><p class="mu">${esc(X('running'))}</p>`);
    try { const list = await api('inst:repairAll'); await refresh(); renderRail(); modal(`<h2>${esc(X('repairAll'))}</h2><div style="max-height:60vh;overflow:auto">${list.map(reportHtml).join('') || `<p class="mu">${esc(X('none'))}</p>`}</div><div class="foot"><button class="btn p" data-close>OK</button></div>`); }
    catch (e) { closeModal(); fail(e); }
  }
  async function diagnostics() {
    let st = []; try { st = await api('inst:checkAll'); } catch (e) { return fail(e); }
    const hist = await Promise.all(st.map(s => api('inst:repairHistory', s.id).catch(() => [])));
    const rows = st.map((s, n) => `<div class="card" style="margin-bottom:8px"><div class="row gap"><div class="grow">${dot(s.status)}<b>${esc(s.name)}</b> <span class="mu sm">${esc(X(s.status))}${s.problems.length ? ' · ' + s.problems.length : ''}</span></div><button class="btn sm" data-hkfix="${esc(s.id)}">${esc(X('repair1'))}</button></div>
      ${s.problems.length ? `<div class="mu sm" style="margin-top:6px">${esc(s.problems.map(p => (p.name || p.id) + ' (' + p.type + ')').join(', '))}</div>` : ''}
      ${hist[n].length ? `<details style="margin-top:6px"><summary class="sm mu">${esc(X('hist'))} (${hist[n].length})</summary>${hist[n].map(h => `<div class="sm mu" style="padding:3px 0">${new Date(h.time).toLocaleString()} — ${h.before} → ${h.after}${h.rolledBack ? ' ↩' : ''}; ${h.undo ? esc(X('undone')) : h.fixed.map(f => esc((f.title || f.id) + ': ' + actText(f))).join('; ') || esc(X('none'))}${h.backup && h.fixed.length && !h.rolledBack && !h.undone && !h.undo ? ` <button class="btn sm" data-hkundo="${esc(s.id)}|${h.time}" title="${esc(X('undoD'))}">↩ ${esc(X('undo'))}</button>` : ''}${h.undone ? ' ↩' : ''}</div>`).join('')}</details>` : ''}</div>`).join('');
    modal(`<h2>${esc(X('diag'))}</h2><div style="max-height:60vh;overflow:auto">${rows || `<p class="mu">${esc(X('noHist'))}</p>`}</div><div class="foot"><button class="btn" data-close>${esc(X('close'))}</button><button class="btn p" id="hkall">${esc(X('repairAll'))}</button></div>`);
    $('#hkall').onclick = () => repairAll();
    document.querySelectorAll('[data-hkfix]').forEach(b => b.onclick = async () => {
      b.disabled = true; b.textContent = X('running');
      try { const r = await api('inst:repairInstance', b.dataset.hkfix); await refresh(); modal(`<h2>${esc(r.name)}</h2>${reportHtml(r)}<div class="foot"><button class="btn p" data-close>OK</button></div>`); } catch (e) { b.disabled = false; b.textContent = X('repair1'); fail(e); }
    });
  }

  // ---------- блоки в настройках ----------
  function hkDraw() {
    const box = $('#hk-list'); if (!box) return;
    const map = hkMap(), conf = H.conflicts(map), saved = S.settings.hotkeys || {};
    box.innerHTML = H.ACTIONS.filter(([id]) => id !== 'devMode' || (window.SAOwner && window.SAOwner.ownerOk())).map(([id]) => {
      const c = map[id], bad = c && conf[c.toLowerCase()], [name, desc] = X('a:' + id) || [id, ''];
      return `<div class="setrow"><div class="grow">${esc(name)}<small>${esc(desc)}${bad ? ` · <span style="color:#f87171">${esc(X('hkConflict'))}</span>` : ''}</small></div>
        <button class="btn sm" data-hk="${esc(id)}" style="min-width:130px;${bad ? 'border-color:#f87171' : ''}">${rec === id ? esc(X('hkPress')) : c ? esc(c) : '<span class="mu">' + esc(X('hkNone')) + '</span>'}</button>
        <button class="btn sm" data-hkoff="${esc(id)}" title="${esc(X('hkOff'))}">✕</button><button class="btn sm" data-hkreset="${esc(id)}" title="${esc(X('hkReset'))}" ${id in saved ? '' : 'disabled'}>↺</button></div>`;
    }).join('');
  }
  async function injectSettings() {
    const main = document.querySelector('.setmain'); if (!main || $('#sx-keys')) return;
    const s = S.settings, insts = S.instances || [];
    main.insertAdjacentHTML('beforeend', `
      <h2 id="sx-tools">${esc(X('tools'))}</h2><div class="card"><div class="mu sm" style="margin-bottom:10px">${esc(X('toolsD'))}</div>
        <div class="row gap wrap"><button class="btn p" data-sxrepair>${ic('refresh')}${esc(X('repairAll'))}</button><button class="btn" data-sxdiag>${ic('tool')}${esc(X('checkAll'))}</button></div></div>
      <h2 id="sx-keys">${esc(X('hk'))}</h2><div class="card"><div class="mu sm" style="margin-bottom:8px">${esc(X('hkD'))}</div><div id="hk-list"></div><div class="row gap" style="margin-top:10px"><button class="btn sm" data-hkall>${esc(X('hkAll'))}</button></div></div>
      <h2 id="sx-start">${esc(X('st'))}</h2><div class="card"><div class="mu sm" style="margin-bottom:8px">${esc(X('stD'))}</div>
        <select id="stmode" style="width:100%">${X('stMode').map((n, k) => `<option value="${['none', 'last', 'selected', 'check'][k]}" ${(s.startupMode || 'none') === ['none', 'last', 'selected', 'check'][k] ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <label class="lab">${esc(X('stInst'))}</label><select id="stinst" style="width:100%"><option value="">—</option>${insts.map(i => `<option value="${esc(i.id)}" ${s.startupInst === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select></div>`);
    const nav = $('#setnav'); if (nav) { nav.insertAdjacentHTML('beforeend', `<button data-sx="sx-tools" title="${esc(X('tools'))}">${ic('tool')}<span>${esc(X('tools'))}</span></button><button data-sx="sx-keys" title="${esc(X('hk'))}">${ic('compass')}<span>${esc(X('hk'))}</span></button>`); }
    hkDraw();
    $('#stmode').onchange = e => { S.settings.startupMode = e.target.value; api('settings:set', { startupMode: e.target.value }).catch(() => {}); };
    $('#stinst').onchange = e => { S.settings.startupInst = e.target.value; api('settings:set', { startupInst: e.target.value }).catch(() => {}); };
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-hk],[data-hkoff],[data-hkreset],[data-hkall],[data-sxrepair],[data-sxdiag],[data-hkundo]'); if (!b) return;
    if (b.dataset.hkundo) { const [uid, time] = b.dataset.hkundo.split('|'); b.disabled = true; api('inst:undoRepair', { id: uid, time: Number(time) }).then(async () => { await refresh(); renderRail(); toast(X('undone'), 'ok'); diagnostics(); }, e => { b.disabled = false; toast(/nobackup/.test(String(e && e.message)) ? X('undoFail') : String(e && e.message || e).replace(/^Error: /, ''), 'err'); }); return; }
    if (b.dataset.hk) { rec = b.dataset.hk; return hkDraw(); }
    if (b.dataset.hkoff !== undefined) { hkSave(H.assign(S.settings.hotkeys, b.dataset.hkoff, '')); return hkDraw(); }
    if (b.dataset.hkreset !== undefined) { const s = Object.assign({}, S.settings.hotkeys); delete s[b.dataset.hkreset]; hkSave(s); return hkDraw(); }
    if (b.hasAttribute('data-hkall')) { hkSave({}); return hkDraw(); }
    if (b.hasAttribute('data-sxrepair')) return repairAll();
    if (b.hasAttribute('data-sxdiag')) return diagnostics();
  });
  const origSettings = window.viewSettings;
  window.viewSettings = function () { origSettings.apply(this, arguments); injectSettings(); };

  // ---------- автозапуск при старте лаунчера (по умолчанию выключен) ----------
  let started = false;
  async function autostart(force) {
    if (started && !force) return; started = true;
    const mode = S.settings.startupMode || 'none'; if (mode === 'none') return;
    const list = S.instances || [];
    const target = mode === 'last' ? [...list].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0] : (list.find(i => i.id === S.settings.startupInst) || (mode === 'check' ? [...list].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0] : null));
    if (!target) return toast(X('stNoInst'), '');
    let canceled = false; const onKey = e => { if (e.key === 'Escape') { canceled = true; toast(X('stCanceled'), ''); } };
    document.addEventListener('keydown', onKey, true); toast(X('stCancel'), '');
    await new Promise(r => setTimeout(r, 5000)); document.removeEventListener('keydown', onKey, true);
    if (canceled) return;
    try {
      if (mode === 'check') { const r = await api('inst:repairInstance', target.id); await refresh(); if (r.rolledBack || r.failed.length) { modal(`<h2>${esc(target.name)}</h2>${reportHtml(r)}<div class="foot"><button class="btn p" data-close>OK</button></div>`); if (r.rolledBack) return; } }
      await playInst(target);
    } catch (e) { fail(e); }
  }
  const origRecent = window.loadRecent;
  if (typeof origRecent === 'function') window.loadRecent = function () { const r = origRecent.apply(this, arguments); autostart(); return r; };

  window.SATools = { repairAll, diagnostics, runAction, autostart };
})();
