/* SA Compatibility Checker (интерфейс): модальное окно отчёта, пункт меню «Совместимость», реакция на запуск.
   Тексты строятся по code/args из core/checker.js. Подключается после tools.js. */
(function () {
  'use strict';
  const L = () => (S.settings.lang === 'ru' || S.settings.lang === 'uk') ? 'ru' : 'en';
  const TX = {
    ru: {
      title: 'Проверка совместимости', ok: 'Совместимо', warn: 'Есть предупреждения', critical: 'Критические проблемы', runAnyway: 'Запустить всё равно', fix: 'Исправить автоматически', fixMem: 'Исправить память', fixPrep: 'Докачать файлы', recheck: 'Проверить снова', close: 'Закрыть', working: 'Исправляю…',
      okNote: 'Запуск разрешён.', warnNote: 'Запуск возможен: предупреждения не блокируют игру.', critNote: 'Игра, скорее всего, не запустится. Можно исправить автоматически (перед этим делается копия модов, любое исправление можно отменить) или запустить на свой риск.',
      suspectNote: 'Не подтверждено: это известная проблемная пара, а не доказанный конфликт.', fixed: 'Исправлено', stillBad: 'Не всё удалось исправить', failed: 'Не удалось',
      m: {
        env: p => `Игра ${p.mc}, загрузчик ${p.loader}${p.loaderVersion ? ' ' + p.loaderVersion : ''}`,
        javaCustom: p => `Указана своя Java${p.need ? ` (для этой версии нужна Java ${p.need})` : ''}: её версию без запуска проверить нельзя`, javaAuto: p => `Java ${p.need}: лаунчер подберёт сам`,
        memOver: p => `Выделено ${p.mb} МБ, а в компьютере всего ${p.ram} МБ. Рекомендуется ${p.rec} МБ`, memTiny: p => `Выделено только ${p.mb} МБ — игре не хватит. Рекомендуется ${p.rec} МБ`,
        memLow: p => `Памяти ${p.mb} МБ мало для ${p.mods} модов. Рекомендуется ${p.rec} МБ`, memHigh: p => `Выделено ${p.mb} МБ из ${p.ram} МБ — системе может не хватить. Рекомендуется ${p.rec} МБ`, memFree: p => `Сейчас свободно ${p.free} МБ, а игре выделено ${p.mb} МБ — закройте лишние программы`, memOk: p => `Память: ${p.mb} МБ`,
        filesFirst: () => 'Файлы игры ещё не скачаны — они загрузятся при первом запуске', jarMissing: () => 'Не найден файл игры — будет докачан', libsMissing: p => `Не хватает библиотек: ${p.n} из ${p.total} — будут докачаны`, filesOk: p => `Файлы игры на месте (библиотек: ${p.libs})`,
        wrongmc: p => `${p.name}: не подходит к Minecraft ${p.mc} (нужно ${p.need})`, loaderver: p => `${p.name}: нужен загрузчик ${p.need}, установлен ${p.have}`, javaver: p => `${p.name}: нужна Java ${p.need}, а будет ${p.have}`,
        depver: p => `${p.by}: нужен мод «${p.id}» версии ${p.need}, установлена ${p.have}`, missing: p => `Не хватает мода «${p.id}» (нужен для: ${[].concat(p.by).join(', ')})`, conflict: p => `${p.name} несовместим с «${p.with}»${p.withVersion ? ' ' + p.withVersion : ''}`, dup: p => `Мод «${p.id}» установлен дважды: ${[].concat(p.files).join(', ')}`,
        moreProblems: p => `…и ещё проблем: ${p.n}`, otherLoader: p => `Моды для другого загрузчика (не ${p.loader}): ${p.n} — ${p.names.join(', ')}`, suspect: p => `Возможный конфликт: ${p.a} и ${p.b} часто не работают вместе`, unknownMods: p => `Не удалось прочитать данные модов: ${p.n} (${p.names.join(', ')}) — совместимость не проверена`, modsOk: p => `Моды (${p.n}) совместимы по их собственным данным`
      }
    },
    en: {
      title: 'Compatibility check', ok: 'Compatible', warn: 'Warnings', critical: 'Critical problems', runAnyway: 'Launch anyway', fix: 'Fix automatically', fixMem: 'Fix memory', fixPrep: 'Download missing files', recheck: 'Check again', close: 'Close', working: 'Fixing…',
      okNote: 'Launch is allowed.', warnNote: 'You can launch: warnings never block the game.', critNote: 'The game will most likely not start. You can fix it automatically (a copy of the mods is made first and any fix can be undone) or launch at your own risk.',
      suspectNote: 'Unconfirmed: a known problematic pair, not a proven conflict.', fixed: 'Fixed', stillBad: 'Not everything could be fixed', failed: 'Failed',
      m: {
        env: p => `Game ${p.mc}, loader ${p.loader}${p.loaderVersion ? ' ' + p.loaderVersion : ''}`,
        javaCustom: p => `Custom Java is set${p.need ? ` (this version needs Java ${p.need})` : ''}: its version cannot be checked without launching`, javaAuto: p => `Java ${p.need}: the launcher picks it`,
        memOver: p => `${p.mb} MB allocated, but the computer has only ${p.ram} MB. Recommended: ${p.rec} MB`, memTiny: p => `Only ${p.mb} MB allocated — not enough. Recommended: ${p.rec} MB`,
        memLow: p => `${p.mb} MB is low for ${p.mods} mods. Recommended: ${p.rec} MB`, memHigh: p => `${p.mb} of ${p.ram} MB allocated — the system may run short. Recommended: ${p.rec} MB`, memFree: p => `${p.free} MB free right now but ${p.mb} MB allocated — close other programs`, memOk: p => `Memory: ${p.mb} MB`,
        filesFirst: () => 'Game files are not downloaded yet — they will be fetched on first launch', jarMissing: () => 'Game file missing — will be downloaded', libsMissing: p => `Missing libraries: ${p.n} of ${p.total} — will be downloaded`, filesOk: p => `Game files present (${p.libs} libraries)`,
        wrongmc: p => `${p.name}: not for Minecraft ${p.mc} (needs ${p.need})`, loaderver: p => `${p.name}: needs loader ${p.need}, installed ${p.have}`, javaver: p => `${p.name}: needs Java ${p.need}, will run on ${p.have}`,
        depver: p => `${p.by}: needs mod “${p.id}” ${p.need}, installed ${p.have}`, missing: p => `Missing mod “${p.id}” (needed by: ${[].concat(p.by).join(', ')})`, conflict: p => `${p.name} conflicts with “${p.with}”${p.withVersion ? ' ' + p.withVersion : ''}`, dup: p => `Mod “${p.id}” is installed twice: ${[].concat(p.files).join(', ')}`,
        moreProblems: p => `…and ${p.n} more problems`, otherLoader: p => `Mods for another loader (not ${p.loader}): ${p.n} — ${p.names.join(', ')}`, suspect: p => `Possible conflict: ${p.a} and ${p.b} often do not work together`, unknownMods: p => `Could not read mod data: ${p.n} (${p.names.join(', ')}) — compatibility not verified`, modsOk: p => `Mods (${p.n}) are compatible according to their own data`
      }
    }
  };
  const X = () => TX[L()];
  const text = it => { const f = X().m[it.code] || TX.en.m[it.code]; try { return f ? f(it.args || {}) : it.code; } catch (_) { return it.code; } };
  const MARK = { ok: '✓', warn: '!', critical: '✕' }, COL = { ok: 'var(--ok,#4ade80)', warn: '#fbbf24', critical: '#f87171' };
  const FIXLBL = { repair: 'fix', memory: 'fixMem', prepare: 'fixPrep' };

  function html(id, r, o = {}) {
    const x = X(), rows = r.items.filter(i => i.level !== 'ok' || o.all).concat(o.all ? [] : []);
    const list = (o.all ? r.items : r.items.filter(i => i.level !== 'ok').concat(r.items.filter(i => i.level === 'ok' && i.code === 'env')))
      .sort((a, b) => ({ critical: 0, warn: 1, ok: 2 }[a.level] - { critical: 0, warn: 1, ok: 2 }[b.level]));
    const note = r.level === 'critical' ? x.critNote : r.level === 'warn' ? x.warnNote : x.okNote;
    const btn = r.fixes.map(f => `<button class="btn pri" data-chkfix="${f}">${esc(x[FIXLBL[f]])}</button>`).join('');
    return `<h2>${ic('check')} ${esc(x.title)}</h2>
      <div class="row" style="gap:10px;align-items:center;margin:6px 0 10px"><span style="font-size:20px;color:${COL[r.level]}">${MARK[r.level]}</span><b style="color:${COL[r.level]}">${esc(x[r.level])}</b><span class="mu sm">${esc(note)}</span></div>
      <div id="chklist" style="display:grid;gap:6px;max-height:46vh;overflow:auto">${list.map(i => `<div class="row" style="gap:8px;align-items:flex-start"><span style="color:${COL[i.level]};min-width:14px;font-weight:700">${MARK[i.level]}</span><div>${esc(text(i))}${i.code === 'suspect' ? `<div class="mu sm">${esc(x.suspectNote)}</div>` : ''}</div></div>`).join('')}</div>
      <div class="foot">${o.blocked ? `<button class="btn" id="chkgo">${esc(x.runAnyway)}</button>` : ''}<button class="btn" id="chkre">${esc(x.recheck)}</button>${btn}<button class="btn" data-close>${esc(x.close)}</button></div>`;
  }
  async function doFix(id, kind, r) {
    if (kind === 'repair') return api('inst:repairInstance', id);
    if (kind === 'memory') { const it = r.items.find(i => i.fix === 'memory'); return api('inst:update', { id, patch: { memory: it.args.rec } }); }
    if (kind === 'prepare') return api('inst:prepare', id);
  }
  async function open(id, o = {}) {
    const x = X(); modal(`<h2>${ic('check')} ${esc(x.title)}</h2><div class="mu">${esc(t('loading'))}</div>`);
    let r; try { r = await api('inst:check', id); } catch (e) { closeModal(); return toast(String(e && e.message || e), 'err'); }
    modal(html(id, r, o));
    const box = $('#modal');
    box.querySelectorAll('[data-chkfix]').forEach(b => b.onclick = async () => {
      const kind = b.dataset.chkfix; box.querySelectorAll('button').forEach(z => z.disabled = true); b.textContent = x.working;
      try { await doFix(id, kind, r); await refresh(); } catch (e) { toast(`${x.failed}: ${String(e && e.message || e).replace(/^Error: /, '')}`, 'err'); }
      const r2 = await api('inst:check', id).catch(() => null); if (r2 && r2.level === 'ok') toast(x.fixed, 'ok'); open(id, o);
    });
    $('#chkre').onclick = () => open(id, o);
    const go = $('#chkgo'); if (go) go.onclick = () => { closeModal(); run(async () => { await api('inst:play', { id, quick: o.quick || undefined, force: true }); }); };
  }
  // Событие от play(): критичное — окно с выбором, предупреждения — спокойное уведомление
  function onEvent(d) {
    if (!d || !d.report) return;
    if (d.blocked) return open(d.id, { blocked: true, quick: d.quick });
    const n = d.report.counts.warn; toast(`${X().warn}: ${n}`, '');
  }
  window.SACheck = { open, onEvent, text, html };
})();
