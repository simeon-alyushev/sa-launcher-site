'use strict';
// Smart Mod Resolver: выбор версии мода не «самая свежая», а «самая свежая из подходящих».
// Подходящая = после скачивания в самом jar (fabric.mod.json) подходят: версия Minecraft, версия загрузчика и Java.
// Если свежая версия не подходит (например, Sodium 0.9.6 заявлена для вашей версии, но на деле требует другое), берётся следующая (0.9.5b и т. д.).
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
module.exports = { rank, verifyJar, loaderVersionOf, ctxOf };
