'use strict';
// Smart Mod Resolver: выбор версии мода не «самая свежая», а «самая свежая из подходящих».
// Подходящая = после скачивания в самом jar (fabric.mod.json) подходят: версия Minecraft, версия загрузчика и Java.
// Если свежая версия не подходит (например, Sodium 0.9.6 заявлена для вашей версии, но на деле требует другое), берётся следующая (0.9.5b и т. д.).
const fs = require('fs');
const path = require('path');
const Compat = require('./compat');

const TYPE = { release: 0, beta: 1, alpha: 2 };
// Порядок перебора: релизы раньше бета и альфа, внутри — от новых к старым
function rank(list) {
  return [...list].sort((a, b) => ((TYPE[a.version_type] ?? 3) - (TYPE[b.version_type] ?? 3)) || (new Date(b.date_published) - new Date(a.date_published)));
}
// Версия установленного загрузчика: из настроек сборки или из имени версии «fabric-loader-0.16.14-1.21»
function loaderVersionOf(inst) {
  if (inst.loaderVersion) return String(inst.loaderVersion);
  const m = /(?:fabric-loader|quilt-loader)-(\d+(?:\.\d+)+)/.exec(String(inst.versionId || ''));
  return m ? m[1] : '';
}
function ctxOf(inst, java) { return { mc: inst.mc, loader: inst.loader, loaderVersion: loaderVersionOf(inst), java: java || null }; }
// Проверка скачанного jar по его собственным метаданным. Если метаданных нет (не Fabric/Quilt/Forge) — не блокируем.
function verifyJar(file, ctx) {
  const m = Compat.readJar(file).mods[0];
  if (!m) return { ok: true, nometa: true };
  const ok = m.kind === 'forge' ? Compat.forgeMatch(m.mc, ctx.mc) : Compat.fabricMatch(m.mc, ctx.mc);
  if (!ok) return { ok: false, reason: 'minecraft ' + [].concat(m.mc).join(' | '), mod: m };
  if (m.kind === 'fabric' && ctx.loaderVersion && m.loaderPred != null && !Compat.fabricMatch(m.loaderPred, ctx.loaderVersion)) return { ok: false, reason: 'fabric-loader ' + [].concat(m.loaderPred).join(' | '), mod: m };
  if (m.kind === 'fabric' && ctx.java && m.javaPred != null && !Compat.fabricMatch(m.javaPred, String(ctx.java))) return { ok: false, reason: 'java ' + [].concat(m.javaPred).join(' | '), mod: m };
  return { ok: true, mod: m };
}
// Совместимость скачанного мода с тем, что уже стоит в папке (в обе стороны):
//   • его зависимости: нужная версия уже установленного мода не подходит (Iris требует Sodium <=0.9.5, а стоит 0.9.6);
//   • чужие зависимости от него: установленные моды требуют иную версию именно этого мода;
//   • breaks: он ломается с установленным модом или наоборот.
// Старые файлы этого же мода (другая версия) не считаются: они будут заменены. Возвращает список проблем (пустой — всё в порядке).
// Это «мягкая» проверка: если подходящей версии без таких проблем нет, лучше поставить совместимую по Minecraft и честно показать проблему, чем ничего.
const okVer = v => v != null && /^\d/.test(String(v));
function depProblems(file, dir) {
  const me = Compat.readJar(file).mods[0]; if (!me || (me.kind !== 'fabric' && me.kind !== 'quilt')) return [];
  const self = path.basename(file), others = [];
  let names = []; try { names = fs.readdirSync(dir).filter(f => /\.jar$/i.test(f) && f !== self); } catch (_) {}
  for (const f of names) for (const m of Compat.readJar(path.join(dir, f)).mods) others.push({ file: f, mod: m });
  const same = new Set(others.filter(o => o.mod.id === me.id).map(o => o.file)), rest = others.filter(o => !same.has(o.file)), out = [];
  for (const d of me.deps || []) {
    const cur = rest.find(o => o.mod.id === d.id);
    if (cur && okVer(cur.mod.version) && d.pred != null && !Compat.fabricMatch(d.pred, cur.mod.version)) out.push({ kind: 'dep', id: d.id, need: [].concat(d.pred).join(' | '), have: String(cur.mod.version) });
  }
  for (const o of rest) {
    for (const d of o.mod.deps || []) if (d.id === me.id && okVer(me.version) && d.pred != null && !Compat.fabricMatch(d.pred, me.version)) out.push({ kind: 'rev', id: o.mod.id, need: [].concat(d.pred).join(' | '), have: String(me.version) });
    const bp = (o.mod.breaks || {})[me.id]; if (bp != null && okVer(me.version) && Compat.fabricMatch(bp, me.version)) out.push({ kind: 'breaks', id: o.mod.id, need: [].concat(bp).join(' | '), have: String(me.version) });
  }
  for (const [bid, bp] of Object.entries(me.breaks || {})) { const o = rest.find(x => x.mod.id === bid.toLowerCase()); if (o && okVer(o.mod.version) && Compat.fabricMatch(bp, o.mod.version)) out.push({ kind: 'breaks', id: bid.toLowerCase(), need: [].concat(bp).join(' | '), have: String(o.mod.version) }); }
  return out;
}
module.exports = { rank, verifyJar, loaderVersionOf, ctxOf, depProblems };
