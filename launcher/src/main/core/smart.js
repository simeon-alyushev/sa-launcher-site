'use strict';
// Умный ремонт и подбор модов под версию Minecraft. Подключается к классу Instances (см. конец instances.js).
//   smartRepair   — сверяет файлы модов с версией игры и чинит несовместимые: обновляет до подходящей версии,
//                   ищет замену, подтягивает недостающие зависимости, а если ничего нет — отключает (игра запустится).
//   optimizeStack — набор оптимизации под версию: Sodium+Iris, а где их нет (старые версии) — запасные моды и OptiFine.
//   ensureSkinLoader — CustomSkinLoader: показывает скины и плащи Ely.by (и Mojang) у других игроков.
//   preflight     — быстрая проверка перед запуском игры.
const fs = require('fs');
const path = require('path');
const U = require('./util');
const MR = require('./modrinth');
const Compat = require('./compat');
const Resolver = require('./resolver');
const B = require('./boost');

const modLoaders = l => l === 'quilt' ? ['quilt', 'fabric'] : [l];
// id зависимости в файле мода ≠ slug на Modrinth
const DEP_ALIAS = { fabric: 'fabric-api', 'fabric-api': 'fabric-api', modmenu: 'modmenu', 'cloth-config': 'cloth-config', 'cloth-config2': 'cloth-config', architectury: 'architectury-api', fabric_language_kotlin: 'fabric-language-kotlin' };
// Моды-конфликтники OptiFine (он заменяет их всех)
const OF_CONFLICT = ['sodium', 'sodium-extra', 'iris', 'indium', 'reeses-sodium-options', 'sodium-options', 'immediatelyfast', 'embeddium', 'rubidium', 'oculus', 'canvas', 'vulkanmod', 'nvidium', 'optifine-compat'];
// Запасные моды оптимизации для версий, где нет свежих Sodium/Lithium и др. (пробуются по очереди, недоступные пропускаются)
const OLD_ALT = ['starlight', 'phosphor', 'lazydfu', 'smoothboot', 'krypton', 'ferrite-core', 'lithium', 'dynamic-fps'];
// То, за что многие любят OptiFine, но отдельными модами (ставятся в сборки SA, если OptiFine не нужен)
const PARITY = ['dynamic-fps', 'continuity', 'lambdynamiclights', 'cull-leaves'];

module.exports = Instances => {
  const P = Instances.prototype;
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  const projSlugs = (inst, id) => new Set(Object.values(inst.meta(id)).map(m => m.slug).filter(Boolean));
  const projIds = (inst, id) => new Set(Object.values(inst.meta(id)).map(m => m.project_id).filter(Boolean));

  // ---------- замена мода, который не подходит под версию игры ----------
  P.findReplacement = async function (id, { pid, title, mc, loader }) {
    const have = projIds(this, id);
    // 1) если мод из «Сборок SA» — берём запросы «по смыслу» из сборки
    const proj = pid ? await MR.project(pid).catch(() => null) : null;
    const items = require('./builds').BUILDS.flatMap(b => b.mods);
    const item = items.find(x => (proj && (x.s || []).includes(proj.slug)) || Instances.similar(x.n, { title: title || '', slug: proj ? proj.slug : '' }));
    if (item) { const a = await this.resolveAlt(item, 'mod', mc, loader, have, new Set()); if (a) return a; }
    // 2) общий поиск: по описанию проекта среди совместимых с нашей версией; нужна общая категория и заметная популярность
    if (proj) {
      const cats = new Set([...(proj.categories || []), ...(proj.additional_categories || [])].filter(c => !['fabric', 'forge', 'neoforge', 'quilt'].includes(c)));
      for (const query of [String(proj.description || '').slice(0, 90), proj.title].filter(Boolean)) {
        const r = await MR.search({ query, type: 'mod', loader, version: mc, limit: 10 }).catch(() => null);
        const h = r && r.hits.find(x => x.id !== pid && !have.has(x.id) && x.downloads >= 20000 && (!cats.size || (x.categories || []).some(c => cats.has(c))) && !Instances.similar(proj.title, { title: x.title, slug: x.slug }));
        if (h) return { id: h.id, title: h.title };
      }
    }
    return null;
  };
  P.replaceMod = async function (id, file) {
    const i = this.read(id), meta = this.meta(id), m = meta['mod/' + file.replace(/\.disabled$/, '')] || {};
    const title = m.title || file.replace(/\.jar$/i, '');
    const dir = this.contentDir(id, 'mod');
    const off = f => { try { if (U.exists(path.join(dir, f))) this.disableFile(id, f); } catch (_) {} };
    // 1) тот же мод, но версия под нашу игру
    if (m.project_id) {
      try {
        await this.installProject(id, m.project_id);                         // перебирает версии и проверяет каждую по её jar
        const now = this.meta(id); const keep = Object.entries(now).filter(([k, x]) => x.project_id === m.project_id).map(([k]) => k.split('/')[1]);
        if (!keep.includes(file)) off(file);
        return { action: 'updated', title };
      } catch (_) { /* подходящей версии нет — ищем замену */ }
    }
    // 2) похожий мод
    const alt = await this.findReplacement(id, { pid: m.project_id, title, mc: i.mc, loader: i.loader }).catch(() => null);
    if (alt) { try { await this.installProject(id, alt.id); off(file); return { action: 'replaced', title, to: alt.title }; } catch (_) {} }
    // 3) замены нет — отключаем, чтобы игра запустилась
    off(file); return { action: 'disabled', title };
  };
  // Подбирает у проекта другую версию, которая подходит под условие accept (например, версия зависимости в нужном диапазоне).
  // Каждая версия скачивается, проверяется по своему jar; не подошла — удаляется, берётся следующая. Возвращает { file, version } или null.
  P.retarget = async function (id, pid, accept, curVersionId) {
    const i = this.read(id), ctx = Resolver.ctxOf(i), dir = this.contentDir(id, 'mod');
    const p = await MR.project(pid).catch(() => null); if (!p) return null;
    const list = Resolver.rank(await MR.versions(pid, { loaders: modLoaders(i.loader), game_versions: [i.mc] }).catch(() => []));
    for (const v of list.slice(0, 10)) {
      if (v.id === curVersionId) continue;
      const f = MR.primaryFile(v), dest = path.join(dir, f.filename), existed = U.exists(dest);
      try { await U.download(f.url, dest, { sha1: f.hashes.sha1, size: f.size }); } catch (_) { continue; }
      const r = Resolver.verifyJar(dest, ctx);
      if (r.ok && accept(dest, r.mod || {}, v)) {
        const meta = this.meta(id); meta['mod/' + f.filename] = { size: f.size, sha1: f.hashes.sha1, looked: true, project_id: p.id, slug: p.slug, version_id: v.id, title: p.title, icon: p.icon_url, version: v.version_number }; this.saveMeta(id, meta);
        return { file: f.filename, version: v };
      }
      if (!existed) fs.rmSync(dest, { force: true });
    }
    return null;
  };
  // Недостающая зависимость: ищем проект по id мода, ставим версию под нашу игру
  P.resolveDep = async function (id, dep) {
    const i = this.read(id), slug = DEP_ALIAS[dep] || dep;
    let p = await MR.project(slug).catch(() => null);
    if (!p || p.project_type !== 'mod') {
      const r = await MR.search({ query: dep.replace(/[-_]+/g, ' '), type: 'mod', loader: i.loader, version: i.mc, limit: 6 }).catch(() => null);
      const h = r && r.hits.find(x => Instances.similar(dep.replace(/[-_]+/g, ' '), { title: x.title, slug: x.slug }));
      p = h ? await MR.project(h.id).catch(() => null) : null;
    }
    if (!p) return null;
    const list = await MR.versions(p.id, { loaders: modLoaders(i.loader), game_versions: [i.mc] }).catch(() => []);
    if (!list.length) return null;
    await this.installProject(id, p.id);
    return { title: p.title };
  };

  // Есть ли связь с Modrinth. Без неё замены и обновления искать нельзя, а отключать моды «на всякий случай» не нужно.
  P.online = async function () { return (await withTimeout(U.fetchJSON('https://api.modrinth.com/v2/').then(() => true, () => false), 6000)) === true; };

  // ---------- главная функция: проверить и починить моды сборки ----------
  P.smartRepair = async function (id) {
    const i = this.read(id), fixed = [], failed = [];
    if (i.loader === 'vanilla') return { fixed, failed };
    const dir = this.contentDir(id, 'mod'); if (!U.exists(dir)) return { fixed, failed };
    const tried = new Set(), key = p => p.type + ':' + p.id + ':' + (p.file || p.byFile || '');
    for (let pass = 0; pass < 4; pass++) {
      await this.content(id, 'mod').catch(() => {});                          // синхронизирует список с файлами и узнаёт проекты по хэшу
      const todo = Compat.scan(dir, i.mc, i.loader, Resolver.ctxOf(i)).problems.filter(p => p.type !== 'javaver' && !tried.has(key(p)));
      if (!todo.length) break;
      if (todo.some(p => p.type !== 'dup') && !(await this.online())) {   // нет интернета: локальные дубли чиним, остальное честно откладываем
        for (const p of todo.filter(p => p.type !== 'dup')) { tried.add(key(p)); failed.push({ type: p.type, id: p.id, error: 'offline' }); }
        todo.splice(0, todo.length, ...todo.filter(p => p.type === 'dup'));
        if (!todo.length) break;
      }
      for (const p of todo) {
        tried.add(key(p));
        try {
          if (p.type === 'dup') {
            const newest = [...p.files].sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
            newest.slice(1).forEach(f => this.disableFile(id, f)); fixed.push({ type: 'dup', id: p.id, action: 'disabled' });
          } else if (p.type === 'wrongmc') {
            if (!U.exists(path.join(dir, p.file))) continue;
            const r = await this.replaceMod(id, p.file); fixed.push({ type: 'wrongmc', id: p.id, title: r.title, to: r.to, action: r.action });
          } else if (p.type === 'loaderver' || p.type === 'depver' || p.type === 'conflict') {
            const prot = new Set(['fabric-api', 'sodium', 'lithium', 'iris']);
            const meta = this.meta(id), pidOf = f => (meta['mod/' + f] || {}).project_id, verOf = f => (meta['mod/' + f] || {}).version_id;
            const off = f => { if (U.exists(path.join(dir, f))) this.disableFile(id, f); };
            let ok = null;
            if (p.type === 'loaderver') {                                   // мод требует более новый Fabric Loader — ищем его версию, которая подходит
              if (pidOf(p.file)) ok = await this.retarget(id, pidOf(p.file), () => true, verOf(p.file));
              if (ok) { off(p.file); fixed.push({ type: p.type, id: p.id, title: p.name, action: 'updated' }); }
              else { off(p.file); fixed.push({ type: p.type, id: p.id, title: p.name, action: 'disabled', why: 'fabric-loader ' + p.need }); }
            } else if (p.type === 'depver') {
              const pred = p.need.split(' | ');                              // 1) другая версия самой зависимости (например, Sodium 0.9.5b вместо 0.9.6)
              if (pidOf(p.file)) ok = await this.retarget(id, pidOf(p.file), (d, mod) => Compat.fabricMatch(pred, mod.version), verOf(p.file));
              if (ok) { off(p.file); fixed.push({ type: p.type, id: p.id, title: (meta['mod/' + p.file] || {}).title || p.id, action: 'updated' }); }
              else {                                                         // 2) другая версия мода, которому она нужна
                if (pidOf(p.byFile)) ok = await this.retarget(id, pidOf(p.byFile), (d, mod) => { const dep = (mod.deps || []).find(x => x.id === p.id); return !dep || Compat.fabricMatch(dep.pred, p.have); }, verOf(p.byFile));
                if (ok) { off(p.byFile); fixed.push({ type: p.type, id: p.by, title: p.name, action: 'updated' }); }
                else { off(p.byFile); fixed.push({ type: p.type, id: p.by, title: p.name, action: 'disabled', why: p.id + ' ' + p.need }); }
              }
            } else {                                                         // конфликт (breaks): другая версия виновника или отключаем одного из двух
              const withMeta = Object.keys(meta).find(k => k === 'mod/' + p.withFile.replace(/\.disabled$/, ''));
              if (pidOf(p.file)) ok = await this.retarget(id, pidOf(p.file), (d, mod) => { const bp = (mod.breaks || {})[p.with]; return !bp || !Compat.fabricMatch(bp, p.withVersion); }, verOf(p.file));
              if (ok) { off(p.file); fixed.push({ type: p.type, id: p.id, title: p.name, action: 'updated' }); }
              else { const victim = prot.has(p.id) ? p.withFile : p.file; off(victim); fixed.push({ type: p.type, id: prot.has(p.id) ? p.with : p.id, title: prot.has(p.id) ? p.with : p.name, action: 'disabled', why: (prot.has(p.id) ? p.id : p.with) }); }
            }
          } else if (p.type === 'missing') {
            let r = null; try { r = await this.resolveDep(id, p.id); } catch (_) {}
            if (r) fixed.push({ type: 'missing', id: p.id, title: r.title, action: 'installed' });
            else if (U.exists(path.join(dir, p.byFile))) { this.disableFile(id, p.byFile); fixed.push({ type: 'missing', id: p.by, title: p.name, action: 'disabled', why: p.id }); }   // зависимости под эту версию нет — отключаем тех, кому она нужна
          }
        } catch (e) { failed.push({ type: p.type, id: p.id, error: e.message }); }
      }
    }
    return { fixed, failed };
  };


  // ---------- полный цикл починки одной сборки ----------
  // 1) диагностика  2) копия папки mods  3) исправление  4) повторная проверка  5) если стало хуже — откат из копии и сохранение отчёта о вылете
  // Чтобы две операции не писали в одну сборку одновременно, на время работы сборка блокируется.
  P.withLock = async function (id, fn) {
    this._locks = this._locks || new Set();
    if (this._locks.has(id) || this.running.has(id)) throw new Error('busy');
    this._locks.add(id); try { return await fn(); } finally { this._locks.delete(id); }
  };
  const histFile = (inst, id) => path.join(inst.path(id), 'repair-history.json');
  P.repairHistory = function (id) { try { return JSON.parse(fs.readFileSync(histFile(this, id), 'utf8')); } catch (_) { return []; } };
  const pushHist = (inst, id, rec) => { const h = inst.repairHistory(id); h.unshift(rec); fs.writeFileSync(histFile(inst, id), JSON.stringify(h.slice(0, 30), null, 1)); };
  const scanOf = (inst, id) => { const i = inst.read(id); return Compat.scan(inst.contentDir(id, 'mod'), i.mc, i.loader, Resolver.ctxOf(i)).problems.filter(p => p.type !== 'javaver'); };

  P.repairInstance = async function (id, o = {}) {
    return this.withLock(id, async () => {
      const i = this.read(id), report = { id, name: i.name, time: Date.now(), before: [], after: [], fixed: [], failed: [], rolledBack: false, backup: '', crashReport: '', gameFiles: 'ok', notes: [] };
      if (i.loader === 'vanilla') { report.notes.push('vanilla'); return report; }
      const dir = this.contentDir(id, 'mod');
      // 1) диагностика: файлы игры (библиотеки, версия, загрузчик) и моды
      try { await this.prepare(id); } catch (e) { report.gameFiles = e.message; report.notes.push('gamefiles: ' + e.message); }
      await this.content(id, 'mod').catch(() => {});
      report.before = scanOf(this, id).map(p => ({ type: p.type, id: p.id, name: p.name, need: p.need }));
      // 2) резервная копия модов и списка (для отката)
      const bk = path.join(this.path(id), 'backups', 'repair-' + new Date().toISOString().replace(/[:.]/g, '-'));
      if (U.exists(dir)) { fs.mkdirSync(path.dirname(bk), { recursive: true }); fs.cpSync(dir, path.join(bk, 'mods'), { recursive: true }); const mf = path.join(this.path(id), 'content.json'); if (U.exists(mf)) fs.copyFileSync(mf, path.join(bk, 'content.json')); report.backup = bk; }
      if (!report.before.length && !o.force) { report.notes.push('clean'); pushHist(this, id, summarize(report)); return report; }
      // 3) исправление
      const r = await this.smartRepair(id).catch(e => ({ fixed: [], failed: [{ type: 'repair', id: 'repair', error: e.message }] }));
      report.fixed = r.fixed; report.failed = r.failed;
      // 4) повторная проверка
      await this.content(id, 'mod').catch(() => {});
      report.after = scanOf(this, id).map(p => ({ type: p.type, id: p.id, name: p.name, need: p.need }));
      // 5) стало хуже или остались проблемы после ошибок — возвращаем всё, как было
      if (report.after.length > report.before.length || (r.failed.length && report.after.length >= report.before.length && report.before.length)) {
        if (report.backup) { U.rmrf(dir); fs.cpSync(path.join(report.backup, 'mods'), dir, { recursive: true }); const mf = path.join(report.backup, 'content.json'); if (U.exists(mf)) fs.copyFileSync(mf, path.join(this.path(id), 'content.json')); }
        report.rolledBack = true;
        const cr = path.join(this.game(id), 'crash-reports');
        try { const f = fs.readdirSync(cr).filter(n => /\.txt$/.test(n)).sort().pop(); if (f) { fs.copyFileSync(path.join(cr, f), path.join(report.backup || this.path(id), f)); report.crashReport = path.join(report.backup || this.path(id), f); } } catch (_) {}
      }
      pushHist(this, id, summarize(report));
      return report;
    });
  };
  // Компактная запись для истории
  const summarize = r => ({ time: r.time, before: r.before.length, after: r.after.length, fixed: r.fixed.map(x => ({ type: x.type, id: x.id, title: x.title, action: x.action, to: x.to, why: x.why })), failed: r.failed.map(x => ({ type: x.type, id: x.id, error: x.error })), rolledBack: r.rolledBack, backup: r.backup, notes: r.notes });

  // Починить все сборки по очереди (не запуская игру); у каждой свой отчёт и своя копия
  P.repairAll = async function (onProgress) {
    const out = []; const list = this.list();
    for (let n = 0; n < list.length; n++) {
      const i = list[n]; if (onProgress) onProgress({ index: n, total: list.length, name: i.name });
      try { out.push(await this.repairInstance(i.id)); }
      catch (e) { out.push({ id: i.id, name: i.name, time: Date.now(), before: [], after: [], fixed: [], failed: [{ type: 'repair', id: 'repair', error: e.message }], rolledBack: false, notes: [e.message === 'busy' ? 'busy' : 'error'] }); }
    }
    return out;
  };
  // Быстрая проверка всех сборок без изменений: статус для индикатора (ok / warn / bad / loader / busy)
  P.checkAll = function () {
    return this.list().map(i => {
      if (i.loader === 'vanilla') return { id: i.id, name: i.name, status: 'ok', problems: [] };
      try { const r = this.inspect(i.id); const bad = r.problems.some(p => ['wrongmc', 'conflict', 'loaderver'].includes(p.type)); return { id: i.id, name: i.name, status: !r.problems.length ? 'ok' : bad ? 'bad' : 'warn', problems: r.problems.map(p => ({ type: p.type, id: p.id, name: p.name })) }; }
      catch (e) { return { id: i.id, name: i.name, status: 'bad', problems: [], error: e.message }; }
    });
  };

  // ---------- OptiFine вместо Sodium/Iris (только Fabric через OptiFabric) ----------
  P.optifineRoute = async function (id) {
    const i = this.read(id);
    if (i.loader !== 'fabric') return { ok: false, reason: 'loader' };
    let list = []; try { list = await U.fetchJSON('https://bmclapi2.bangbang93.com/optifine/' + encodeURIComponent(i.mc)); } catch (_) {}
    const rank = x => { const m = String(x.patch || '').match(/^([A-Za-z])(\d+)/); return m ? m[1].toUpperCase().charCodeAt(0) * 100 + (+m[2]) : 0; };
    const pick = (Array.isArray(list) ? list : []).filter(x => x && x.mcversion === i.mc && x.type && x.patch && /^[A-Za-z0-9_]+$/.test(x.type + x.patch)).sort((a, b) => (+(b.type === 'HD_U') - +(a.type === 'HD_U')) || rank(b) - rank(a))[0];
    if (!pick) return { ok: false, reason: 'noOptifine' };
    const of = await MR.versions('optifabric', { loaders: ['fabric'], game_versions: [i.mc] }).catch(() => []);
    if (!of.length) return { ok: false, reason: 'noOptifabric' };
    await this.content(id, 'mod').catch(() => {});
    const meta = this.meta(id), dir = this.contentDir(id, 'mod');
    for (const [k, m] of Object.entries(meta)) if (k.startsWith('mod/') && OF_CONFLICT.includes(m.slug)) { try { this.disableFile(id, k.slice(4)); } catch (_) {} }
    const name = `OptiFine_${i.mc}_${pick.type}_${pick.patch}.jar`;
    await U.download(`https://bmclapi2.bangbang93.com/optifine/${encodeURIComponent(i.mc)}/${pick.type}/${pick.patch}`, path.join(dir, name));
    await this.installProject(id, 'optifabric', MR.best(of).id);
    const j = this.read(id); j.optifine = pick.patch; this.write(j);
    return { ok: true, installed: ['OptiFine ' + pick.type.replace('_', ' ') + ' ' + pick.patch, 'OptiFabric'] };
  };

  // ---------- набор оптимизации под версию ----------
  // Сначала обычный набор (Sodium, Lithium, Iris…). Если Sodium или Iris под эту версию нет, подбираем запасные моды;
  // для сборок с шейдерами — OptiFine (через OptiFabric), он работает «так себе», зато играбельно и даёт шейдеры.
  P.optimizeStack = async function (id, o = {}) {
    const base = await this.optimize(id);                                   // OPT_MODS: ставится то, что есть под версию
    const installed = [...base.installed], skipped = [...base.skipped], notes = [];
    const i = this.read(id);
    if (i.loader === 'fabric' || i.loader === 'quilt') {
      await this.content(id, 'mod').catch(() => {});
      let slugs = projSlugs(this, id);
      const wantShaders = o.shaders !== false;
      const noSodium = !slugs.has('sodium'), noIris = !slugs.has('iris');
      if (i.loader === 'fabric' && (noSodium || (wantShaders && noIris))) {
        const r = await this.optifineRoute(id).catch(e => ({ ok: false, reason: e.message }));
        if (r.ok) { installed.push(...r.installed); notes.push({ key: 'noteOptifine', v: i.mc }); }
        else notes.push({ key: 'noteNoOptifine', v: i.mc });
      }
      slugs = projSlugs(this, id);
      // запасные моды оптимизации для старых версий
      if (noSodium || !slugs.has('lithium')) {
        const got = new Set();
        for (const s of OLD_ALT) {
          if (s === 'phosphor' && got.has('starlight')) continue;           // два движка света конфликтуют
          const p = (await MR.projects([s]).catch(() => []))[0]; if (!p || projIds(this, id).has(p.id)) { if (p) got.add(s); continue; }
          try { installed.push(...await this.installProject(id, p.id)); got.add(s); } catch (_) {}
        }
      }
      // «как у OptiFine» отдельными модами — для сборок SA и только если настоящий OptiFine не ставили
      if (o.parity && !this.read(id).optifine) for (const s of PARITY) {
        const p = (await MR.projects([s]).catch(() => []))[0]; if (!p || projIds(this, id).has(p.id)) continue;
        try { installed.push(...await this.installProject(id, p.id)); } catch (_) {}
      }
    }
    return { installed: [...new Set(installed)], skipped, notes };
  };

  // ---------- CustomSkinLoader: чужие скины и плащи Ely.by (и Mojang) в игре ----------
  P.ensureSkinLoader = async function (id) {
    if (this.store.settings.skinLoader === false) return null;
    const i = this.read(id); if (i.loader === 'vanilla' || i.cslTried === i.mc) return null;
    await this.content(id, 'mod').catch(() => {});
    if (projSlugs(this, id).has('customskinloader')) return null;
    const j = this.read(id); j.cslTried = i.mc; this.write(j);                // одна попытка на версию игры
    const list = await MR.versions('customskinloader', { loaders: modLoaders(i.loader), game_versions: [i.mc] }).catch(() => []);
    if (!list.length) return null;
    await this.installProject(id, 'customskinloader', MR.best(list).id);
    return { title: 'CustomSkinLoader' };
  };

  // ---------- проверка перед запуском игры (быстрая, без сети, если всё в порядке) ----------
  P.preflight = async function (id) {
    const st = this.store.settings, out = { fixed: [], failed: [] };
    if (st.preflight === false) return out;
    try {
      const r = await withTimeout(this.smartRepair(id), 45000); if (r) { out.fixed.push(...r.fixed); out.failed.push(...r.failed); }
    } catch (_) {}
    try { const s = await withTimeout(this.ensureSkinLoader(id), 30000); if (s) out.fixed.push({ type: 'skin', id: 'customskinloader', title: s.title, action: 'installed' }); } catch (_) {}
    if (out.fixed.length) this.emit('repair', { id, ...out });
    return out;
  };
};
module.exports.OPT_CONFLICT = OF_CONFLICT;
