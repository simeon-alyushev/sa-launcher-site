'use strict';
// SA Compatibility Checker: итоговый отчёт «можно ли запускать эту сборку» из трёх уровней — ok (совместимо), warn (предупреждение), critical (критично).
// Чистая функция evaluate(): на вход — уже собранные данные (см. Instances.compatReport), на выход — структурированный отчёт.
// Тексты строит интерфейс по code/args (так отчёт можно перевести и проверить тестами). Ничего не меняет и в сеть не ходит.
//
// Принципы: предупреждения запуск не блокируют; критично только то, что почти наверняка не даст игре запуститься.
// Подтверждённое (мод сам заявил о несовместимости) и подозреваемое (наш список известных проблемных пар) разделены:
// подозрение всегда подаётся как «возможный конфликт», не как факт.

// Известные проблемные пары. Это НЕ подтверждённые конфликты, а предупреждение «часто не работают вместе».
const SUSPECT = [
  [/optifine/i, /sodium|rubidium|embeddium/i, 'optifine'],
  [/optifine/i, /\biris\b|oculus/i, 'optifine'],
  [/sodium/i, /embeddium|rubidium/i, 'engine'],
  [/starlight/i, /phosphor|lazydfu-?light/i, 'light']
];
const rnd512 = n => Math.round(n / 512) * 512;

// Рекомендуемая память под количество модов, но не больше, чем можно отдать, оставив системе 2,5 ГБ
function recommendMem(mods, ramMB) {
  const want = mods <= 0 ? 2048 : mods < 50 ? 3072 : mods < 150 ? 4096 : 6144, cap = Math.max(1536, rnd512(ramMB - 2560));
  return Math.max(1536, Math.min(want, cap));
}

function evaluate(x) {
  const items = [], modded = !!x.loader && x.loader !== 'vanilla';
  const add = (level, code, args = {}, fix = null) => items.push({ level, code, args, fix });
  const hw = x.hw || { ram: 0, freeMB: 0 };

  // 1) версия и загрузчик (что проверяется)
  add('ok', 'env', { mc: x.mc, loader: x.loader || 'vanilla', loaderVersion: x.loaderVersion || '' });

  // 2) Java
  if (x.javaCustom) add('warn', 'javaCustom', { need: x.javaNeeded || null });                 // свою Java без запуска не проверить: честно говорим «не проверено»
  else if (x.javaNeeded) add('ok', 'javaAuto', { need: x.javaNeeded });

  // 3) память
  const mb = Number(x.memoryMB) || 0, rec = recommendMem(modded ? x.modsCount || 0 : 0, hw.ram || 8192);
  if (mb > 0 && hw.ram && mb > hw.ram) add('critical', 'memOver', { mb, ram: hw.ram, rec }, 'memory');
  else if (mb > 0 && mb < 1024) add('critical', 'memTiny', { mb, rec }, 'memory');
  else if (mb > 0 && modded && mb < rec && mb < 4096 && (x.modsCount || 0) >= 20) add('warn', 'memLow', { mb, rec, mods: x.modsCount }, 'memory');
  else if (mb > 0 && hw.ram && mb > hw.ram * 0.75) add('warn', 'memHigh', { mb, ram: hw.ram, rec }, 'memory');
  else if (mb > 0 && hw.freeMB && hw.freeMB < mb * 0.75) add('warn', 'memFree', { mb, free: hw.freeMB });
  else if (mb > 0) add('ok', 'memOk', { mb, ram: hw.ram });

  // 4) файлы игры (проверка без скачивания: только то, что уже есть на диске)
  const f = x.files || {};
  if (f.versionJson === false) add('ok', 'filesFirst', {});                                      // свежая сборка: файлы скачаются при первом запуске
  else {
    if (f.jarMissing) add('warn', 'jarMissing', {}, 'prepare');
    if (f.libsMissing > 0) add('warn', 'libsMissing', { n: f.libsMissing, total: f.libsTotal || 0 }, 'prepare');
    if (!f.jarMissing && !(f.libsMissing > 0)) add('ok', 'filesOk', { libs: f.libsTotal || 0 });
  }

  // 5) моды
  if (modded) {
    const probs = x.problems || [], MAX = 20; let shown = 0;
    // «Не хватает» с одним id, нужным нескольким модам, показываем одной строкой
    const merged = [];
    for (const p of probs) { const m = p.type === 'missing' && merged.find(y => y.type === 'missing' && y.id === p.id); if (m) m.by.push(p.name || p.by); else merged.push({ ...p, by: p.type === 'missing' ? [p.name || p.by] : p.by }); }
    for (const p of merged) {
      if (shown++ >= MAX) break;
      if (p.type === 'wrongmc') add('critical', 'wrongmc', { name: p.name || p.id, need: p.need, mc: x.mc }, 'repair');
      else if (p.type === 'loaderver') add('critical', 'loaderver', { name: p.name || p.id, need: p.need, have: p.have }, 'repair');
      else if (p.type === 'javaver') add('critical', 'javaver', { name: p.name || p.id, need: p.need, have: p.have }, 'repair');
      else if (p.type === 'depver') add('critical', 'depver', { id: p.id, by: p.name || p.by, need: p.need, have: p.have }, 'repair');
      else if (p.type === 'missing') add('critical', 'missing', { id: p.id, by: p.by }, 'repair');
      else if (p.type === 'conflict') add('critical', 'conflict', { name: p.name || p.id, with: p.with, withVersion: p.withVersion || '' }, 'repair');
      else if (p.type === 'dup') add('critical', 'dup', { id: p.id, files: p.files }, 'repair');
    }
    if (merged.length > MAX) add('critical', 'moreProblems', { n: merged.length - MAX }, 'repair');
    const other = x.otherLoader || [];
    if (other.length) add('warn', 'otherLoader', { n: other.length, names: other.slice(0, 5), loader: x.loader });
    // возможные конфликты (не подтверждённые)
    const names = (x.modNames || []).map(s => String(s).toLowerCase()), seen = new Set();
    for (const [a, b, kind] of SUSPECT) {
      const ma = names.find(n => a.test(n)), mbn = names.find(n => b.test(n) && n !== ma);
      if (ma && mbn && !seen.has(ma + '|' + mbn)) { seen.add(ma + '|' + mbn); add('warn', 'suspect', { a: ma, b: mbn, kind }); }
    }
    if ((x.unknownMods || []).length) add('warn', 'unknownMods', { n: x.unknownMods.length, names: x.unknownMods.slice(0, 5) });
    if (!merged.length) add('ok', 'modsOk', { n: x.modsCount || 0 });
  }

  const counts = { ok: 0, warn: 0, critical: 0 }; for (const i of items) counts[i.level]++;
  const level = counts.critical ? 'critical' : counts.warn ? 'warn' : 'ok';
  // Что можно починить одним нажатием (без повторов), в порядке пользы
  const fixes = [...new Set(items.filter(i => i.fix).map(i => i.fix))];
  return { level, items, counts, fixes, mc: x.mc, loader: x.loader || 'vanilla', mods: x.modsCount || 0, time: x.time || Date.now() };
}
module.exports = { evaluate, recommendMem, SUSPECT };
