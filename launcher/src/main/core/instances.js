'use strict';
// Сборки (instances): создание, контент, обновление версии, оптимизация, импорт .mrpack.
const fs = require('fs');
const path = require('path');
const U = require('./util');
const mc = require('./mc');
const L = require('./loaders');
const MR = require('./modrinth');
const Crash = require('./crash');
const CF = require('./curseforge');
const NBT = require('./nbt');
const Compat = require('./compat');
const Resolver = require('./resolver');
const Builds = require('./builds');

const FOLDERS = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' };
// Slug'и Modrinth. Что не подходит под версию/загрузчик сборки — пропускается (попадёт в skipped), это нормально.
const OPT_MODS = {
  fabric: ['fabric-api', 'sodium', 'sodium-extra', 'lithium', 'better-block-entities', 'entityculling', 'immediatelyfast', 'smart-particles', 'ferrite-core', 'modernfix', 'iris', 'voxy', 'chunky', 'ggtu'],
  quilt: ['sodium', 'sodium-extra', 'lithium', 'better-block-entities', 'entityculling', 'immediatelyfast', 'smart-particles', 'ferrite-core', 'modernfix', 'iris', 'voxy', 'chunky', 'ggtu'],
  forge: ['embeddium', 'modernfix', 'ferrite-core', 'entityculling', 'immediatelyfast', 'smart-particles', 'chunky'],
  neoforge: ['sodium', 'sodium-extra', 'lithium', 'entityculling', 'immediatelyfast', 'smart-particles', 'ferrite-core', 'modernfix', 'iris', 'chunky']
};
const AIKAR = '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1';
const modLoaders = loader => loader === 'quilt' ? ['quilt', 'fabric'] : [loader];

class Instances {
  constructor({ dataDir, store, emit }) {
    this.dir = path.join(dataDir, 'instances'); this.shared = path.join(dataDir, 'shared');
    this.bicons = path.join(dataDir, 'build-icons');
    this.store = store; this.emit = emit; this.running = new Map(); this.stopped = new Set();
    fs.mkdirSync(this.dir, { recursive: true }); fs.mkdirSync(this.shared, { recursive: true });
  }
  path(id) { return path.join(this.dir, id); }
  game(id) { return path.join(this.dir, id, '.minecraft'); }
  read(id) { return JSON.parse(fs.readFileSync(path.join(this.path(id), 'instance.json'), 'utf8')); }
  write(i) { fs.writeFileSync(path.join(this.path(i.id), 'instance.json'), JSON.stringify(i, null, 1)); return i; }
  list() {
    return fs.readdirSync(this.dir).map(id => { try { return { ...this.read(id), running: this.running.has(id), iconData: this.iconData(id) }; } catch (_) { return null; } }).filter(Boolean).sort((a, b) => (b.lastPlayed || b.created) - (a.lastPlayed || a.created));
  }
  // Иконки отдаём уменьшенными (миниатюра ~160 px, кэш по времени изменения) — большие картинки не раздувают память окна
  thumbData(f) {
    try {
      const st = fs.statSync(f), key = f + '|' + st.mtimeMs; this.thumbs = this.thumbs || new Map();
      if (this.thumbs.has(key)) return this.thumbs.get(key);
      let out = '';
      if (this.thumb) { try { out = this.thumb(f); } catch (_) {} }
      if (!out && st.size < 400e3) { const ext = path.extname(f).slice(1).toLowerCase().replace('jpg', 'jpeg'); out = `data:image/${ext};base64,` + fs.readFileSync(f).toString('base64'); }
      if (this.thumbs.size > 120) this.thumbs.delete(this.thumbs.keys().next().value);
      this.thumbs.set(key, out); return out;
    } catch (_) { return ''; }
  }
  trim() { this.thumbs = new Map(); }
  iconData(id) {
    try { const f = fs.readdirSync(this.path(id)).find(n => /^icon\.(png|jpe?g|webp|gif)$/i.test(n)); return f ? this.thumbData(path.join(this.path(id), f)) : ''; } catch (_) { return ''; }
  }
  setIcon(id, file) {
    if (fs.statSync(file).size > 3e6) throw new Error('Image is too large (max 3 MB)');
    const ext = path.extname(file).toLowerCase().replace('.', ''); if (!/^(png|jpe?g|webp|gif)$/.test(ext)) throw new Error('Unsupported image');
    this.clearIcon(id); fs.copyFileSync(file, path.join(this.path(id), 'icon.' + ext)); return true;
  }
  clearIcon(id) { for (const n of fs.readdirSync(this.path(id))) if (/^icon\./i.test(n)) fs.rmSync(path.join(this.path(id), n), { force: true }); return true; }
  progress(task, label) { return (name, pct) => this.emit('progress', { task, label: name ? `${label} · ${name}` : label, pct }); }
  done(task) { this.emit('progress', { task, done: true }); }

  create({ name, mc: mcv, loader = 'vanilla', loaderVersion = '', group = '' }) {
    let id = U.slug(name), n = 1; while (U.exists(this.path(id))) id = U.slug(name) + '-' + (++n);
    fs.mkdirSync(this.game(id), { recursive: true });
    return this.write({ id, name, mc: mcv, loader, loaderVersion, group: String(group || '').trim().slice(0, 40), memory: 0, jvmArgs: '', javaPath: '', created: Date.now(), lastPlayed: 0, playtime: 0, versionId: '' });
  }
  // Настройки сборки (как в Prism). Пустое значение = «как в общих настройках». Всё проверяем и ограничиваем по размеру.
  update(id, patch) {
    const i = this.read(id), P = patch || {};
    const str = (k, max) => { if (k in P) i[k] = String(P[k] == null ? '' : P[k]).replace(/\u0000/g, '').slice(0, max); };
    const int = (k, min, max) => { if (k in P) { const n = parseInt(P[k]); i[k] = Number.isFinite(n) && n >= min ? Math.min(n, max) : 0; } };
    const bool = k => { if (k in P) i[k] = !!P[k]; };
    str('name', 80); str('group', 40); str('jvmArgs', 2000); str('javaPath', 500); str('notes', 20000);
    str('envVars', 4000); str('wrapper', 300); str('preLaunch', 1000); str('postExit', 1000);
    if ('autoJoin' in P) i.autoJoin = /^[A-Za-z0-9.\-:\[\]]{1,100}$/.test(String(P.autoJoin || '').trim()) ? String(P.autoJoin).trim() : '';
    int('memory', 512, 131072); int('minMemory', 128, 131072); int('width', 320, 16384); int('height', 240, 16384);
    bool('fullscreen'); bool('recordPlaytime'); bool('openLogs');
    if ('boost' in P) i.boost = require('./boost').PRESETS.includes(P.boost) ? P.boost : '';
    return this.write(i);
  }
  remove(id) { if (this.running.has(id)) throw new Error('running'); U.rmrf(this.path(id)); }
  duplicate(id, o = {}) {
    const i = this.read(id);
    const opt = { saves: true, options: true, resourcepacks: true, shaders: true, mods: true, screenshots: false, servers: true, config: true, playtime: false, ...o };
    const n = this.create({ name: String(o.name || '').trim() || i.name + ' (copy)', mc: i.mc, loader: i.loader, loaderVersion: i.loaderVersion, group: o.group !== undefined ? o.group : i.group });
    const src = this.game(id), dst = this.game(n.id);
    const map = { saves: ['saves'], options: ['options.txt', 'optionsof.txt'], resourcepacks: ['resourcepacks'], shaders: ['shaderpacks'], mods: ['mods'], screenshots: ['screenshots'], servers: ['servers.dat'], config: ['config'] };
    for (const [k, paths] of Object.entries(map)) if (opt[k]) for (const p of paths) { const a = path.join(src, p); if (U.exists(a)) fs.cpSync(a, path.join(dst, p), { recursive: true }); }
    if ((opt.mods || opt.resourcepacks || opt.shaders) && U.exists(this.metaFile(id))) fs.copyFileSync(this.metaFile(id), this.metaFile(n.id));
    for (const f of fs.readdirSync(this.path(id))) if (/^icon\./i.test(f)) fs.copyFileSync(path.join(this.path(id), f), path.join(this.path(n.id), f));
    return this.write({ ...n, memory: i.memory, jvmArgs: i.jvmArgs, javaPath: i.javaPath, versionId: i.versionId, width: i.width, height: i.height, fullscreen: i.fullscreen, minMemory: i.minMemory, envVars: i.envVars, wrapper: i.wrapper, preLaunch: i.preLaunch, postExit: i.postExit, autoJoin: i.autoJoin, recordPlaytime: i.recordPlaytime, openLogs: i.openLogs, playtime: opt.playtime ? i.playtime || 0 : 0 });
  }

  // Подготовка: установка версии игры + загрузчика
  async prepare(id) {
    const i = this.read(id); const task = 'prep:' + id;
    const prog = this.progress(task, i.name);
    try {
      const vid = await L.installLoader({ shared: this.shared, loader: i.loader, mcv: i.mc, lv: i.loaderVersion, progress: prog, log: l => this.emit('log', { id, line: l }) });
      if (!i.loaderVersion && i.loader !== 'vanilla') i.loaderVersion = (await L.loaderVersions(i.loader, i.mc))[0] || '';
      i.versionId = vid; this.write(i); return i;
    } finally { this.done(task); }
  }

  async play(id, quick) {
    if (this.running.has(id)) return;
    const st = this.store.settings; const accId = st.selected;
    let acc = accId && this.store.account(accId);
    if (!acc) throw new Error('noaccount');
    const { ensureFresh } = require('./auth');
    acc = await ensureFresh(require('../config'), this.store, acc);
    if (acc.p !== 'ely') acc = await this.requireLicense(acc);   // Microsoft — проверка лицензии; Ely.by — проверка токена в ensureFresh
    await this.preflight(id).catch(() => {});                  // сверка модов с версией игры и CustomSkinLoader (быстро, если всё в порядке)
    let i = this.read(id);
    if (!i.versionId || !U.exists(path.join(this.shared, 'versions', i.versionId, i.versionId + '.json'))) i = await this.prepare(id);
    const task = 'play:' + id; const t0 = Date.now();
    this.running.set(id, null); this.emit('state', { id, running: true });
    const tail = []; const t1 = Date.now();
    try {
      const child = await mc.launch({
        shared: this.shared, instDir: this.path(id), versionId: i.versionId, inst: i, account: acc, settings: st,
        quick, progress: this.progress(task, i.name), log: line => { tail.push(line); if (tail.length > 600) tail.shift(); this.emit('log', { id, line }); },
        onExit: code => { this.running.delete(id); const j = this.read(id); if (j.recordPlaytime !== false) j.playtime = (j.playtime || 0) + Math.round((Date.now() - t0) / 1000); this.write(j); this.emit('state', { id, running: false, code }); if (code && code !== 0 && code !== 143 && code !== 130 && !this.stopped.delete(id)) this.handleCrash(id, tail.join('\n'), t1).catch(() => {}); }
      });
      this.running.set(id, child);
      const j = this.read(id); j.lastPlayed = Date.now(); this.write(j);
    } catch (e) { this.running.delete(id); this.emit('state', { id, running: false }); throw e; }
    finally { this.done(task); }
  }
  // Играть можно только с лицензионным аккаунтом Microsoft, на котором есть Minecraft: Java Edition.
  async requireLicense(acc) {
    if (!acc || acc.p !== 'ms' || !acc.accessToken || acc.accessToken === '0') throw new Error('nolicense');
    const st = this.store.settings; const lic = st.licensed || {}; const WEEK = 7 * 864e5;
    let r;
    try { r = await fetch('https://api.minecraftservices.com/minecraft/profile', { headers: { Authorization: 'Bearer ' + acc.accessToken, 'User-Agent': U.UA } }); }
    catch (_) { // нет сети: разрешаем только если лицензия подтверждалась в последние 7 дней
      if (lic[acc.id] && Date.now() - lic[acc.id] < WEEK) return acc; throw new Error('Нет соединения: не удалось подтвердить лицензию Minecraft');
    }
    if (r.status === 401) throw new Error('relogin');
    if (!r.ok) throw new Error('nolicense');
    const prof = await r.json().catch(() => ({}));
    if (!prof.id || prof.id !== acc.id) throw new Error('nolicense');
    this.store.set({ licensed: { ...lic, [acc.id]: Date.now() } });
    return { ...acc, name: prof.name || acc.name };
  }
  stop(id) { const c = this.running.get(id); if (c) { this.stopped.add(id); c.kill(); } }

  // ---- недавние миры и сервера ----
  recent() {
    const worlds = [], servers = []; const seen = new Set();
    for (const i of this.list()) {
      const sd = path.join(this.game(i.id), 'saves');
      try {
        for (const w of fs.readdirSync(sd)) {
          try {
            const lv = path.join(sd, w, 'level.dat'); const st = fs.statSync(lv); let name = w;
            try { name = NBT.gz(fs.readFileSync(lv)).Data.LevelName || w; } catch (_) {}
            let icon = ''; try { icon = 'data:image/png;base64,' + fs.readFileSync(path.join(sd, w, 'icon.png')).toString('base64'); } catch (_) {}
            worlds.push({ inst: i.id, instName: i.name, mc: i.mc, folder: w, name, icon, time: st.mtimeMs });
          } catch (_) {}
        }
      } catch (_) {}
      try {
        const d = NBT.parse(fs.readFileSync(path.join(this.game(i.id), 'servers.dat')));
        (d.servers || []).forEach((sv, k) => { const key = String(sv.ip).toLowerCase(); if (!sv.ip || seen.has(key)) return; seen.add(key); servers.push({ inst: i.id, instName: i.name, name: sv.name || sv.ip, ip: sv.ip, icon: sv.icon ? 'data:image/png;base64,' + sv.icon : '', order: k, last: i.lastPlayed || 0 }); });
      } catch (_) {}
    }
    worlds.sort((a, b) => b.time - a.time); servers.sort((a, b) => b.last - a.last || a.order - b.order);
    return { worlds: worlds.slice(0, 8), servers: servers.slice(0, 8) };
  }
  // подходит ли проект каждой сборке
  async compat(project, src, kind = 'mod') {
    const out = {};
    await Promise.all(this.list().map(async i => {
      try {
        if (src === 'curseforge') { const l = await CF.files(require('../config').siteUrl, project, kind === 'mod' ? i.loader : '', i.mc); out[i.id] = l.some(x => x.url); }
        else { const l = await MR.versions(project, { loaders: kind === 'mod' ? modLoaders(i.loader) : undefined, game_versions: [i.mc] }); out[i.id] = l.length > 0; }
      } catch (_) { out[i.id] = true; }
    }));
    return out;
  }
  // версии проекта для выбора перед установкой
  async projVersions(id, project, src, kind = 'mod', all = false) {
    const i = this.read(id);
    if (src === 'curseforge') {
      const l = await CF.files(require('../config').siteUrl, project, kind === 'mod' && !all ? i.loader : '', all ? '' : i.mc);
      return l.map(v => ({ id: v.id, number: v.name, type: 'release', mc: v.mc, loaders: v.loaders, date: v.date, ok: !!v.url }));
    }
    const l = await MR.versions(project, all ? {} : { loaders: kind === 'mod' ? modLoaders(i.loader) : undefined, game_versions: [i.mc] });
    return l.map(v => ({ id: v.id, number: v.version_number, name: v.name, type: v.version_type, mc: v.game_versions, loaders: v.loaders, date: v.date_published, ok: true }));
  }

  // ---- вылеты: анализ и авто-починка ----
  latestCrashReport(id, since) {
    try {
      const d = path.join(this.game(id), 'crash-reports');
      const f = fs.readdirSync(d).map(n => ({ n, t: fs.statSync(path.join(d, n)).mtimeMs })).filter(x => x.t >= since - 5000).sort((a, b) => b.t - a.t)[0];
      return f ? fs.readFileSync(path.join(d, f.n), 'utf8') : '';
    } catch (_) { return ''; }
  }
  async handleCrash(id, log, since) {
    const i = this.read(id);
    const problems = Crash.analyze(log + '\n' + this.latestCrashReport(id, since));
    const info = { id, problems, fixed: [], failed: [], auto: this.store.settings.autoFix !== false };
    if (!problems.length) {
      // в логе причина не найдена — всё равно сверяем моды с версией игры (не та версия Minecraft — частая причина вылета)
      if (info.auto) { const r = await this.smartRepair(id).catch(() => null); if (r && (r.fixed.length || r.failed.length)) Object.assign(info, { fixed: r.fixed, failed: r.failed }); }
      this.emit('crash', info); return info;
    }
    if (info.auto) Object.assign(info, await this.fixProblems(id, problems));
    this.emit('crash', info); return info;
  }
  // карта modId -> файлы в папке mods
  modIndex(id) {
    const dir = this.contentDir(id, 'mod'); const map = {};
    if (!U.exists(dir)) return map;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.jar(\.disabled)?$/i.test(f)) continue;
      for (const m of Crash.jarMods(path.join(dir, f))) (map[m.id.toLowerCase()] = map[m.id.toLowerCase()] || []).push({ file: f, version: m.version });
    }
    return map;
  }
  disableFile(id, file) { if (!file.endsWith('.disabled')) { const d = this.contentDir(id, 'mod'); fs.renameSync(path.join(d, file), path.join(d, file + '.disabled')); } }
  async findProject(slugOrId) { try { return await MR.project(slugOrId); } catch (_) { return null; } }
  async fixProblems(id, problems) {
    const fixed = [], failed = [];
    // Проблемы с модами (не та версия Minecraft, нет зависимости, дубли) чинит умный ремонт: ищет подходящую версию или замену, а не просто отключает
    if (problems.some(p => ['wrongmc', 'missing', 'wrong', 'dup'].includes(p.type))) {
      const r = await this.smartRepair(id).catch(e => ({ fixed: [], failed: [{ type: 'repair', id: 'repair', error: e.message }] }));
      fixed.push(...r.fixed); failed.push(...r.failed);
      problems = problems.filter(p => !['wrongmc', 'dup'].includes(p.type) && !(['missing', 'wrong'].includes(p.type) && r.fixed.some(f => f.id === p.id || f.why === p.id)));
    }
    const i = this.read(id); const idx = this.modIndex(id);
    for (const p of problems) {
      try {
        if (p.type === 'missing' || p.type === 'wrong') {
          const proj = await this.findProject(p.id);
          if (!proj) throw new Error('not found');
          const old = (idx[p.id] || []).map(x => x.file);
          await this.installProject(id, proj.id);
          // убираем старую версию того же мода
          const cur = this.meta(id); const keep = new Set(Object.entries(cur).filter(([k, m]) => m.project_id === proj.id).map(([k]) => k.split('/')[1]));
          const dir = this.contentDir(id, 'mod'); const newest = [...keep].sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs)[0];
          for (const f of old) if (f !== newest && U.exists(path.join(dir, f))) fs.rmSync(path.join(dir, f), { force: true });
          fixed.push({ ...p, action: p.type === 'missing' ? 'installed' : 'updated', title: proj.title });
        } else if (p.type === 'wrongmc') {
          const files = idx[p.id] || []; files.forEach(x => this.disableFile(id, x.file));
          if (!files.length) throw new Error('nofile'); fixed.push({ ...p, action: 'disabled' });
        } else if (p.type === 'suspect') {
          const files = idx[p.id] || []; if (!files.length) throw new Error('nofile');
          // сперва пробуем обновить мод до версии, подходящей под сборку, иначе отключаем
          let done = false; const proj = await this.findProject(p.id);
          if (proj) { try { const list = await MR.versions(proj.id, { loaders: modLoaders(i.loader), game_versions: [i.mc] }); const best = list.length && MR.best(list); const cur = (this.meta(id)['mod/' + files[0].file.replace(/\.disabled$/, '')] || {}).version_id; if (best && best.id !== cur) { await this.installProject(id, proj.id, best.id); files.forEach(x => fs.rmSync(path.join(this.contentDir(id, 'mod'), x.file), { force: true })); done = true; fixed.push({ ...p, action: 'updated', title: proj.title }); } } catch (_) {} }
          if (!done) { files.forEach(x => this.disableFile(id, x.file)); fixed.push({ ...p, action: 'disabled' }); }
        } else if (p.type === 'dup') {
          const seen = {}; const dir = this.contentDir(id, 'mod'); let n = 0;
          for (const [mid, arr] of Object.entries(idx)) if (arr.length > 1) arr.slice().sort((a, b) => fs.statSync(path.join(dir, b.file)).mtimeMs - fs.statSync(path.join(dir, a.file)).mtimeMs).slice(1).forEach(x => { this.disableFile(id, x.file); n++; });
          if (!n) throw new Error('none'); fixed.push({ ...p, action: 'disabled' });
        } else if (p.type === 'oom') {
          const cur = i.memory || this.store.settings.memory || 4096; const next = Math.min(Math.max(cur + 2048, 4096), Math.max(4096, Math.floor(U.totalMemMB() * 0.6)));
          if (next <= cur) throw new Error('max'); const j = this.read(id); j.memory = next; this.write(j); fixed.push({ ...p, action: 'memory', value: next });
        } else if (p.type === 'xmx') {
          const j = this.read(id); j.memory = 2048; this.write(j); fixed.push({ ...p, action: 'memory', value: 2048 });
        } else if (p.type === 'loader' || p.type === 'java') { failed.push(p); }
      } catch (e) {
        // поставить нужный мод/версию не вышло (под эту версию игры его нет) — отключаем мод, которому он нужен, чтобы игра запустилась
        const by = p.by && idx[String(p.by).toLowerCase()];
        if ((p.type === 'missing' || p.type === 'wrong') && by && by.length) { by.forEach(x => this.disableFile(id, x.file)); fixed.push({ type: p.type, id: String(p.by), action: 'disabled', why: p.id }); }
        else failed.push({ ...p, error: e.message });
      }
    }
    return { fixed, failed };
  }
  async fixCrash(id, problems) { const r = await this.fixProblems(id, problems); return r; }

  // ---- версии мода (выбор вручную) ----
  async modVersions(id, kind, file, all) {
    const i = this.read(id); const meta = this.meta(id); const m = meta[kind + '/' + file.replace(/\.disabled$/, '')];
    if (!m || !m.project_id) throw new Error('unknown');
    const isMod = kind === 'mod';
    if (String(m.project_id).startsWith('cf:')) {
      const l = await CF.files(require('../config').siteUrl, m.project_id.slice(3), isMod && !all ? i.loader : '', all ? '' : i.mc);
      return { project: m.project_id, current: m.version_id, mc: i.mc, versions: l.map(v => ({ id: v.id, name: v.name, number: v.name, type: 'release', mc: v.mc, loaders: v.loaders, date: v.date })) };
    }
    const list = await MR.versions(m.project_id, all ? {} : { loaders: isMod ? modLoaders(i.loader) : undefined, game_versions: [i.mc] });
    return { project: m.project_id, current: m.version_id, mc: i.mc, versions: list.map(v => ({ id: v.id, name: v.name, number: v.version_number, type: v.version_type, mc: v.game_versions, loaders: v.loaders, date: v.date_published })) };
  }
  async setModVersion(id, kind, file, versionId) {
    const meta = this.meta(id); const key = kind + '/' + file.replace(/\.disabled$/, ''); const m = meta[key];
    if (!m || !m.project_id) throw new Error('unknown');
    const wasOff = file.endsWith('.disabled'); const dir = this.contentDir(id, kind);
    if (String(m.project_id).startsWith('cf:')) {
      const lst = await CF.files(require('../config').siteUrl, m.project_id.slice(3), '', ''); const fv = lst.find(x => x.id === String(versionId)); if (!fv) throw new Error('unknown');
      await this.installCurseforge(id, m.project_id.slice(3), versionId, { title: m.title, icon: m.icon, type: kind });
      if (fv.file !== file.replace(/\.disabled$/, '')) { fs.rmSync(path.join(dir, file), { force: true }); const mm = this.meta(id); delete mm[key]; this.saveMeta(id, mm); }
      return true;
    }
    const v = await MR.version(versionId); const nf = MR.primaryFile(v).filename;
    await this.installProject(id, m.project_id, versionId);
    if (nf !== file.replace(/\.disabled$/, '')) { fs.rmSync(path.join(dir, file), { force: true }); const mm = this.meta(id); delete mm[key]; this.saveMeta(id, mm); }
    if (wasOff && U.exists(path.join(dir, nf))) fs.renameSync(path.join(dir, nf), path.join(dir, nf + '.disabled'));
    return true;
  }

  // ---- контент ----
  contentDir(id, kind) { return path.join(this.game(id), FOLDERS[kind] || 'mods'); }
  metaFile(id) { return path.join(this.path(id), 'content.json'); }
  meta(id) { try { return JSON.parse(fs.readFileSync(this.metaFile(id), 'utf8')); } catch (_) { return {}; } }
  saveMeta(id, m) { fs.writeFileSync(this.metaFile(id), JSON.stringify(m)); }

  async content(id, kind = 'mod') {
    const dir = this.contentDir(id, kind); fs.mkdirSync(dir, { recursive: true });
    const meta = this.meta(id); const files = fs.readdirSync(dir).filter(f => /\.(jar|zip|disabled)$/i.test(f) && fs.statSync(path.join(dir, f)).isFile());
    const rows = [];
    for (const f of files) {
      const p = path.join(dir, f), st = fs.statSync(p); const key = kind + '/' + f.replace(/\.disabled$/, '');
      let m = meta[key];
      if (!m || m.size !== st.size) { m = { size: st.size, sha1: await U.sha1File(p) }; meta[key] = m; }
      rows.push({ file: f, key, enabled: !f.endsWith('.disabled'), size: st.size, sha1: m.sha1, m });
    }
    // записи об удалённых файлах убираем — иначе лаунчер считает, что мод всё ещё стоит (ломало «Оптимизировать» после удаления модов)
    const present = new Set(files.map(f => kind + '/' + f.replace(/\.disabled$/, '')));
    for (const k of Object.keys(meta)) if (k.startsWith(kind + '/') && !present.has(k)) delete meta[k];
    // определяем неизвестные файлы по хэшу в Modrinth
    const unk = rows.filter(r => !r.m.looked);
    if (unk.length) {
      try {
        const found = await MR.lookupHashes(unk.map(r => r.sha1));
        const ids = [...new Set(Object.values(found).map(v => v.project_id))];
        const ps = Object.fromEntries((await MR.projects(ids)).map(p => [p.id, p]));
        for (const r of unk) { const v = found[r.sha1]; r.m.looked = true; if (v) { const p = ps[v.project_id] || {}; Object.assign(r.m, { project_id: v.project_id, version_id: v.id, title: p.title, icon: p.icon_url, version: v.version_number }); } }
      } catch (_) {}
    }
    this.saveMeta(id, meta);
    return rows.map(r => ({ file: r.file, enabled: r.enabled, size: r.size, title: r.m.title || r.file.replace(/\.(jar|zip|disabled)/g, ''), icon: r.m.icon || '', version: r.m.version || '', known: !!r.m.project_id, pid: r.m.project_id || '' }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }
  toggle(id, kind, file) {
    const dir = this.contentDir(id, kind), a = path.join(dir, file);
    const b = file.endsWith('.disabled') ? a.slice(0, -9) : a + '.disabled'; fs.renameSync(a, b); return true;
  }
  removeFile(id, kind, file) {
    const name = path.basename(file); fs.rmSync(path.join(this.contentDir(id, kind), name), { force: true });
    const m = this.meta(id); delete m[kind + '/' + name.replace(/\.disabled$/, '')]; this.saveMeta(id, m); return true;
  }

  // Установка проекта из Modrinth в сборку (с обязательными зависимостями)
  async installProject(id, projectId, versionId, _depth = 0, done = new Set()) {
    const i = this.read(id); if (done.has(projectId)) return []; done.add(projectId);
    const p = await MR.project(projectId);
    if (p.project_type === 'modpack') throw new Error('modpack');
    const kind = p.project_type; const isMod = kind === 'mod';
    // Подбор версии: перебираем подходящие по метаданным Modrinth от лучшей к худшей и проверяем КАЖДУЮ скачанную по её собственному
    // fabric.mod.json (версия игры, загрузчика). Не подошла — удаляем и берём следующую (так вместо Sodium 0.9.6 ставится 0.9.5b).
    let v, f, dest;
    const ctx = isMod ? Resolver.ctxOf(i) : null, dir = this.contentDir(id, kind);
    const task = 'inst:' + projectId; this.emit('progress', { task, label: p.title, pct: 0.2 });
    const place = async cand => {
      f = MR.primaryFile(cand); dest = path.join(dir, f.filename); const existed = U.exists(dest);
      await U.download(f.url, dest, { sha1: f.hashes.sha1, size: f.size });
      if (ctx) { const r = Resolver.verifyJar(dest, ctx); if (!r.ok) { if (!existed) fs.rmSync(dest, { force: true }); throw Object.assign(new Error('incompatible:' + p.title + ' (' + r.reason + ')'), { verify: true }); } }
      return cand;
    };
    if (versionId) v = await place(await MR.version(versionId));
    else {
      const list = await MR.versions(projectId, { loaders: isMod ? modLoaders(i.loader) : undefined, game_versions: [i.mc] });
      if (!list.length) throw new Error('incompatible:' + p.title);
      let last; for (const cand of Resolver.rank(list).slice(0, 8)) { try { v = await place(cand); break; } catch (e) { if (!e.verify) throw e; last = e; } }
      if (!v) throw last;
    }
    const meta = this.meta(id); meta[kind + '/' + f.filename] = { size: f.size, sha1: f.hashes.sha1, looked: true, project_id: p.id, slug: p.slug, version_id: v.id, title: p.title, icon: p.icon_url, version: v.version_number }; this.saveMeta(id, meta);
    const installed = [p.title];
    if (isMod && _depth < 3) {
      const have = new Set(Object.values(this.meta(id)).map(m => m.project_id));
      for (const d of v.dependencies || []) if (d.dependency_type === 'required' && d.project_id && !have.has(d.project_id)) {
        try { installed.push(...await this.installProject(id, d.project_id, undefined, _depth + 1, done)); } catch (_) {}   // версию подбираем под нашу игру (раньше бралась та, что указал автор, — она могла быть для другой версии Minecraft)
      }
    }
    this.done(task); return installed;
  }

  // Установка из CurseForge (через API сайта)
  async cfVersions(id, project, kind = 'mod') {
    const i = this.read(id); const site = require('../config').siteUrl;
    return CF.files(site, project, kind === 'mod' ? i.loader : '', i.mc);
  }
  async installCurseforge(id, project, fileId, meta = {}, _depth = 0) {
    const i = this.read(id); const kind = meta.type || 'mod'; const list = await this.cfVersions(id, project, kind);
    const f = fileId ? list.find(x => x.id === String(fileId)) : list.find(x => x.url);
    if (!f || !f.url) throw new Error('incompatible:' + (meta.title || project));
    const dest = path.join(this.contentDir(id, kind), f.file || (f.name + '.jar'));
    this.emit('progress', { task: 'inst:cf' + project, label: meta.title || f.name, pct: 0.2 });
    await U.download(f.url, dest, f.sha1 ? { sha1: f.sha1 } : {});
    const m = this.meta(id); m[kind + '/' + path.basename(dest)] = { size: fs.statSync(dest).size, sha1: await U.sha1File(dest), looked: true, project_id: 'cf:' + project, version_id: 'cf:' + f.id, title: meta.title || f.name, icon: meta.icon || '', version: f.name }; this.saveMeta(id, m);
    const installed = [meta.title || f.name];
    if (kind === 'mod' && _depth < 2) {
      const have = new Set(Object.values(this.meta(id)).map(x => x.project_id));
      for (const d of f.deps || []) if (!have.has('cf:' + d)) { try { installed.push(...await this.installCurseforge(id, d, null, { title: 'CurseForge #' + d }, _depth + 1)); } catch (_) {} }
    }
    this.done('inst:cf' + project); return installed;
  }

  // ---- обновление сборки на новую версию ----
  async hashes(id) {
    const rows = (await this.content(id, 'mod')).filter(r => r.enabled);
    const meta = this.meta(id);
    return rows.map(r => ({ file: r.file, title: r.title, icon: r.icon, sha1: meta['mod/' + r.file].sha1 }));
  }
  async checkUpdate(id) {
    const i = this.read(id); const mods = await this.hashes(id);
    const man = await mc.manifest();
    const rel = man.versions.filter(v => v.type === 'release'); const cur = rel.findIndex(v => v.id === i.mc);
    const newer = (cur < 0 ? rel.slice(0, 6) : rel.slice(0, cur)).slice(0, 8).map(v => v.id);   // новее текущей, новые первыми
    const older = cur < 0 ? [] : rel.slice(cur + 1, cur + 9).map(v => v.id);                    // старее текущей (откат назад), ближние первыми
    const cands = [...newer, ...older]; const dirOf = v => newer.includes(v) ? 'up' : 'down';
    const out = [];
    await Promise.all(cands.map(async v => {
      const ok = await L.supports(i.loader, v);
      if (!ok) return out.push({ mc: v, dir: dirOf(v), loaderOk: false, total: mods.length, ok: 0, missing: [] });
      let res = {};
      if (mods.length) try { res = await MR.updateHashes(mods.map(m => m.sha1), modLoaders(i.loader), [v]); } catch (_) {}
      const missing = mods.filter(m => !res[m.sha1]).map(m => ({ file: m.file, title: m.title, icon: m.icon }));
      out.push({ mc: v, dir: dirOf(v), loaderOk: true, total: mods.length, ok: mods.length - missing.length, missing });
    }));
    const order = Object.fromEntries(cands.map((v, k) => [v, k]));
    out.sort((a, b) => order[a.mc] - order[b.mc]);
    return { current: i.mc, loader: i.loader, candidates: out };
  }
  async applyUpdate(id, target, removeMissing) {
    if (this.running.has(id)) throw new Error('running');
    const i = this.read(id); const mods = await this.hashes(id); const task = 'upd:' + id;
    try {
      this.emit('progress', { task, label: i.name, pct: 0.02 });
      if (!(await L.supports(i.loader, target))) throw new Error('loader');
      if (this.store.settings.backupWorlds !== false) this.backupWorlds(id, 'before-' + target);   // миры сохраняем до любых изменений (особенно важно при откате)
      const res = mods.length ? await MR.updateHashes(mods.map(m => m.sha1), modLoaders(i.loader), [target]) : {};
      const missing = mods.filter(m => !res[m.sha1]);
      if (missing.length && !removeMissing) throw new Error('missing');
      // резервная копия модов
      const bk = path.join(this.path(id), 'backups', `mods-${i.mc}-${Date.now()}`); fs.mkdirSync(path.dirname(bk), { recursive: true });
      fs.cpSync(this.contentDir(id, 'mod'), bk, { recursive: true });
      const meta = this.meta(id); let n = 0;
      for (const m of missing) { fs.rmSync(path.join(this.contentDir(id, 'mod'), m.file), { force: true }); delete meta['mod/' + m.file]; }
      for (const m of mods) {
        const v = res[m.sha1]; if (!v) continue;
        const f = MR.primaryFile(v); const dest = path.join(this.contentDir(id, 'mod'), f.filename);
        await U.download(f.url, dest, { sha1: f.hashes.sha1, size: f.size });
        if (f.filename !== m.file) { fs.rmSync(path.join(this.contentDir(id, 'mod'), m.file), { force: true }); delete meta['mod/' + m.file]; }
        meta['mod/' + f.filename] = { size: f.size, sha1: f.hashes.sha1, looked: true, project_id: v.project_id, version_id: v.id, title: m.title, icon: m.icon, version: v.version_number };
        this.emit('progress', { task, label: i.name, pct: ++n / mods.length * 0.8 });
      }
      this.saveMeta(id, meta);
      i.mc = target; i.loaderVersion = ''; i.versionId = ''; this.write(i);
      await this.prepare(id);
      return { updated: mods.length - missing.length, removed: missing.length };
    } finally { this.done(task); }
  }

  // ---- оптимизация ----
  // ---- SA Boost: умные пресеты (память/JVM-флаги/options.txt). Всё — только по явной команде пользователя ----
  boostInfo(id, preset) {
    const B = require('./boost'), i = this.read(id), hw = B.hardware(), rec = B.recommend(hw);
    const p = preset || i.boost || rec, java = B.guessJava(i.mc);
    const pl = B.plan(p, { ...hw, java, loader: i.loader }), pv = B.preview(this.game(id), p);
    return { hw, rec, current: i.boost || '', preset: p, plan: { mem: pl.mem, xms: pl.xms, flags: pl.flags, gc: pl.gc, java }, opts: pv, userFlags: !!i.jvmArgs, userMem: !!i.memory, running: this.running.has(id) };
  }
  boostApply(id, { preset, options }) {
    const B = require('./boost'); if (!B.PRESETS.includes(preset)) throw new Error('err:badPreset');
    let n = 0;
    if (options) { if (this.running.has(id)) throw new Error('running'); n = B.applyOptions(this.game(id), preset).changed; }
    this.update(id, { boost: preset });
    return { ...this.boostInfo(id, preset), changed: n };
  }
  boostOff(id, { revert }) {
    const B = require('./boost'); if (revert) { if (this.running.has(id)) throw new Error('running'); B.revertOptions(this.game(id)); }
    this.update(id, { boost: '' }); return this.boostInfo(id);
  }

  async optimize(id) {
    const i = this.read(id);
    if (i.loader === 'vanilla') throw new Error('vanilla');
    await this.content(id, 'mod');                                      // синхронизирует meta с реальными файлами (удалённые моды убираются)
    const haveNow = () => new Set(Object.values(this.meta(id)).map(m => m.project_id).filter(Boolean));
    const slugs = OPT_MODS[i.loader] || [];
    const installed = [], skipped = [];
    const projs = await MR.projects(slugs).catch(() => []);
    const bySlug = Object.fromEntries(projs.map(p => [p.slug, p]));
    for (const s of slugs) {
      const p = bySlug[s]; if (!p) { skipped.push(s); continue; }
      if (haveNow().has(p.id)) continue;
      try { installed.push(...await this.installProject(id, p.id)); } catch (_) { skipped.push(p.title); }
    }
    const patch = {};
    if (!i.jvmArgs) patch.jvmArgs = AIKAR;
    if (!i.memory) patch.memory = Math.max(2048, Math.min(6144, Math.floor(U.totalMemMB() / 2 / 512) * 512));
    this.update(id, patch);
    return { installed: [...new Set(installed)], skipped };
  }

  // ---- «Сборки SA» ----
  // Картинки «Сборок SA»: своя (выбрана в лаунчере) важнее встроенной из renderer/builds/
  buildIconFile(b) {
    try { const f = fs.readdirSync(this.bicons).find(n => n.startsWith(b.id + '.') && /\.(png|jpe?g|webp|gif)$/i.test(n)); if (f) return path.join(this.bicons, f); } catch (_) {}
    if (b.icon && /^[a-z0-9._-]+\.(png|jpe?g|webp|gif)$/i.test(b.icon)) { const f = path.join(__dirname, '../../renderer/builds', b.icon); if (U.exists(f)) return f; }
    return '';
  }
  buildIconData(b) { const f = this.buildIconFile(b); return f ? this.thumbData(f) : ''; }
  builds() { return Builds.BUILDS.map(b => ({ ...Builds.info(b), icon: this.buildIconData(b) })); }
  setBuildIcon(bid, file) {
    const b = Builds.BUILDS.find(x => x.id === bid); if (!b) throw new Error('Unknown build');
    const ext = path.extname(file).toLowerCase().replace('.', ''); if (!/^(png|jpe?g|webp|gif)$/.test(ext)) throw new Error('Unsupported image');
    if (fs.statSync(file).size > 3e6) throw new Error('Image is too large (max 3 MB)');
    this.clearBuildIcon(bid); fs.mkdirSync(this.bicons, { recursive: true }); fs.copyFileSync(file, path.join(this.bicons, bid + '.' + ext)); return true;
  }
  clearBuildIcon(bid) { try { for (const n of fs.readdirSync(this.bicons)) if (n.startsWith(bid + '.')) fs.rmSync(path.join(this.bicons, n), { force: true }); } catch (_) {} return true; }
  // Версия Minecraft «Авто»: новейший релиз, для которого есть загрузчик и все базовые моды сборки
  // Версии для сборок SA: от 1.21 до актуальной (список Mojang идёт от новых к старым)
  async buildVersions() {
    const rel = (await mc.manifest()).versions.filter(v => v.type === 'release').map(v => v.id);
    const k = rel.indexOf('1.16.5'); return k < 0 ? rel.slice(0, 40) : rel.slice(0, k + 1);   // от актуальной до 1.16.5
  }
  async pickMc(b) {
    const rel = await this.buildVersions();
    for (const v of rel) {
      try {
        if (!(await L.supports(b.loader, v))) continue;
        const ok = await Promise.all(b.core.map(s => MR.versions(s, { loaders: modLoaders(b.loader), game_versions: [v] }).then(l => l.length > 0).catch(() => false)));
        if (ok.every(Boolean)) return v;
      } catch (_) {}
    }
    return rel[0];
  }
  // Название похоже на искомое? (опечатки в названиях не страшны, но чужой мод ставить нельзя)
  static similar(want, p) {
    const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9а-яё+ ]+/g, ' ').split(/\s+/).filter(Boolean);
    const toks = norm(want).filter(w => w.length > 1); if (!toks.length) return false;
    const hay = norm((p.title || '') + ' ' + (p.slug || '')).join(' ');
    const hit = toks.filter(w => hay.includes(w.length > 4 ? w.slice(0, 4) : w)).length;
    return hit / toks.length >= 0.67;
  }
  async resolveItem(item, type, mcv, loader) {
    if (item.s && item.s.length) {
      const ps = await MR.projects(item.s).catch(() => []);
      const p = item.s.map(s => ps.find(x => x.slug === s && x.project_type === type)).find(Boolean) || ps.find(x => x.project_type === type);
      if (p) return { id: p.id, title: p.title };
    }
    for (const filter of [{ version: mcv }, {}]) {            // сперва под нашу версию, потом любые (для ресурспаков/шейдеров)
      if (type === 'mod' && !filter.version) break;
      const r = await MR.search({ query: item.q, type, loader: type === 'mod' ? loader : undefined, version: filter.version, limit: 10 }).catch(() => null);
      const h = r && r.hits.find(x => Instances.similar(item.n, { title: x.title, slug: x.slug }) || Instances.similar(item.q, { title: x.title, slug: x.slug }));
      if (h) return { id: h.id, title: h.title };
    }
    return null;
  }
  // Похожий проект, если самого нужного нет под выбранную версию: ищем по смыслу (item.alt) среди совместимых с версией и загрузчиком.
  // Берём первый заметный проект (не меньше 10 000 загрузок — чтобы не ставить случайное), которого ещё нет в сборке и который не нужен как отдельный пункт.
  async resolveAlt(item, type, mcv, loader, have, reserved) {
    for (const query of item.alt || []) {
      const r = await MR.search({ query, type, loader: type === 'mod' ? loader : undefined, version: mcv, limit: 8 }).catch(() => null);
      const h = r && r.hits.find(x => x.downloads >= 10000 && !have.has(x.id) && !(reserved && reserved.has(x.id)) && !Instances.similar(item.n, { title: x.title, slug: x.slug }));
      if (h) return { id: h.id, title: h.title };
    }
    return null;
  }
  async installBuild(bid, opts = {}) {
    const b = Builds.BUILDS.find(x => x.id === bid); if (!b) throw new Error('Unknown build');
    const task = 'build:' + bid; const P = (label, pct) => this.emit('progress', { task, label, pct });
    let inst = null; const installed = [], skipped = [], other = [], alternatives = [], packFiles = [], shaderFiles = [], shaderLoose = [], notes = [];
    try {
      P(b.name, 0.01);
      const range = await this.buildVersions();
      if (opts.mc && opts.mc !== 'auto' && !range.includes(opts.mc)) throw new Error('Version not supported by this build (1.16.5 and newer only)');
      const mcv = opts.mc && opts.mc !== 'auto' ? opts.mc : await this.pickMc(b);
      inst = this.create({ name: (opts.name || '').trim() || b.name, mc: mcv, loader: b.loader });
      { const j = this.read(inst.id); j.buildId = b.id; this.write(j); }          // запоминаем, из какой сборки SA создана (для горячих клавиш и автозапуска)
      try { const ic = this.buildIconFile(b); if (ic) fs.copyFileSync(ic, path.join(this.path(inst.id), 'icon' + path.extname(ic).toLowerCase())); } catch (_) {}   // картинка сборки становится иконкой (меняется в настройках сборки)
      P(`${b.name} · Minecraft ${mcv}`, 0.05);
      await this.prepare(inst.id);
      const jobs = [...b.mods.map(x => ['mod', x]), ...b.resourcepacks.map(x => ['resourcepack', x]), ...b.shaders.map(x => ['shader', x])];
      const haveNow = () => new Set(Object.values(this.meta(inst.id)).map(m => m.project_id).filter(Boolean));
      let n = 0;
      for (const [kind, item] of jobs) {
        P(`${b.name} · ${item.n}`, 0.1 + (n++ / jobs.length) * 0.82);
        try {
          // ставит найденный проект; для ресурспаков/шейдеров без пометки нужной версии берёт самую свежую
          let loose = false;
          const put = async found => {
            loose = false;
            const dir = this.contentDir(inst.id, kind); fs.mkdirSync(dir, { recursive: true });
            const before = new Set(fs.readdirSync(dir));
            try { installed.push(...await this.installProject(inst.id, found.id)); }
            catch (e) {
              if (kind === 'mod' || !String(e.message).startsWith('incompatible')) throw e;
              const list = await MR.versions(found.id, {}); if (!list.length) throw e;
              installed.push(...await this.installProject(inst.id, found.id, MR.best(list).id)); other.push(found.title); loose = true;
            }
            const added = fs.readdirSync(dir).filter(f => !before.has(f));
            if (kind === 'resourcepack') packFiles.push(...added); if (kind === 'shader') (loose ? shaderLoose : shaderFiles).push(...added);   // шейдер «для другой версии» не включаем по умолчанию
          };
          const found = await this.resolveItem(item, kind, mcv, b.loader);
          if (found && haveNow().has(found.id)) { installed.push(found.title); continue; }
          if (found) { try { await put(found); continue; } catch (e) { if (!(item.alt || []).length) throw e; } }
          // нужного проекта нет (или он не встал на эту версию) — пробуем похожий
          const reserved = new Set(); const alt = await this.resolveAlt(item, kind, mcv, b.loader, haveNow(), reserved);
          if (!alt) { skipped.push(item.n); continue; }
          await put(alt); alternatives.push(item.n + ' → ' + alt.title);
        } catch (_) { skipped.push(item.n); }
      }
      P(`${b.name} · Optimization`, 0.94);
      const o = await this.optimizeStack(inst.id, { shaders: b.shaders.length > 0, parity: true }).catch(() => ({ installed: [], skipped: [], notes: [] }));
      installed.push(...o.installed); notes.push(...(o.notes || []));
      P(`${b.name} · Check`, 0.97);
      const rp = await this.smartRepair(inst.id).catch(() => ({ fixed: [], failed: [] }));
      for (const x of rp.fixed) { if (x.action === 'replaced') alternatives.push((x.title || x.id) + ' → ' + x.to); else if (x.action === 'disabled' && x.type !== 'dup') skipped.push(x.title || x.id); }
      await this.ensureSkinLoader(inst.id).catch(() => {});
      this.enableBuildContent(inst.id, packFiles, shaderFiles.length ? shaderFiles : shaderLoose, !!this.read(inst.id).optifine, b.opts, b.autoShader !== false);
    } catch (e) { if (inst) U.rmrf(this.path(inst.id)); throw e; }
    finally { this.done(task); }
    // «урезанная» сборка: часть модов/паков недоступна на этой версии — запоминаем, чтобы показывать в интерфейсе
    const trimmed = [...new Set(skipped)];
    if (trimmed.length) { const j = this.read(inst.id); j.trimmed = trimmed; this.write(j); }
    return { instance: this.read(inst.id), installed: [...new Set(installed)], skipped: [...new Set(skipped)], other: [...new Set(other)], alternatives: [...new Set(alternatives)], notes };
  }
  // Включаем ресурспаки (options.txt) и шейдер (Iris) в новой сборке, чтобы всё работало сразу
  // opts — настройки игры, которые сборка ставит при создании (например, дальность прорисовки для слабых ПК);
  // autoShader=false — шейдеры скачиваются, но по умолчанию не включаются (сборки для FPS и слабых ПК)
  enableBuildContent(id, packs, shaders, optifine, opts, autoShader = true) {
    const g = this.game(id);
    try {
      const f = path.join(g, 'options.txt'); fs.mkdirSync(g, { recursive: true });
      let cur = U.exists(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean) : [];
      const setKey = (k, v) => { cur = cur.filter(l => !l.startsWith(k + ':')); cur.push(k + ':' + v); };
      for (const [k, v] of Object.entries(opts || {})) if (/^[A-Za-z0-9_]+$/.test(k)) setKey(k, String(v));
      if (packs.length) setKey('resourcePacks', JSON.stringify(['vanilla', 'fabric', ...packs.map(x => 'file/' + x)]));
      if (packs.length || (opts && Object.keys(opts).length)) fs.writeFileSync(f, cur.join('\n') + '\n');
      if (shaders.length && autoShader) {
        fs.mkdirSync(path.join(g, 'config'), { recursive: true });
        if (optifine) fs.writeFileSync(path.join(g, 'optionsshaders.txt'), `shaderPack=${shaders[0]}\n`);           // OptiFine
        else fs.writeFileSync(path.join(g, 'config', 'iris.properties'), `enableShaders=true\nshaderPack=${shaders[0]}\n`);   // Iris
      }
    } catch (_) {}
  }


  // ---- резервные копии миров ----
  dirSize(p) { let n = 0; try { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); n += e.isDirectory() ? this.dirSize(f) : fs.statSync(f).size; } } catch (_) {} return n; }
  backupWorlds(id, reason = 'manual') {
    const saves = path.join(this.game(id), 'saves');
    if (!U.exists(saves) || !fs.readdirSync(saves).length) return null;
    const root = path.join(this.path(id), 'backups'); fs.mkdirSync(root, { recursive: true });
    const dest = path.join(root, `saves-${reason}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    fs.cpSync(saves, dest, { recursive: true });
    const all = fs.readdirSync(root).filter(n => n.startsWith('saves-')).sort();                 // хранится 5 последних
    while (all.length > 5) U.rmrf(path.join(root, all.shift()));
    return { path: dest, size: this.dirSize(dest) };
  }
  // Список копий миров (для окна «Восстановить из копии»)
  listBackups(id) {
    const root = this.backupsDir(id);
    return fs.readdirSync(root).filter(n => /^saves-[A-Za-z0-9._-]+$/.test(n)).map(n => {
      const f = path.join(root, n); let st; try { st = fs.statSync(f); } catch (_) { return null; }
      const m = /^saves-(.+?)-\d{4}-\d\d-\d\dT/.exec(n);
      return { name: n, reason: m ? m[1] : '', time: st.birthtimeMs || st.mtimeMs, size: this.dirSize(f), worlds: (() => { try { return fs.readdirSync(f).length; } catch (_) { return 0; } })() };
    }).filter(Boolean).sort((a, b) => b.time - a.time);
  }
  backupPath(id, name) { if (!/^saves-[A-Za-z0-9._-]+$/.test(String(name))) throw new Error('Bad backup name'); const f = path.join(this.backupsDir(id), name); if (!U.exists(f)) throw new Error('Backup not found'); return f; }
  // Восстановление: сначала копия текущих миров («before-restore»), потом замена. Выбранную копию сперва переносим во временную папку,
  // чтобы ротация (хранится 5 последних) не удалила её.
  restoreBackup(id, name) {
    if (this.running.has(id)) throw new Error('running');
    const src = this.backupPath(id, name), tmp = path.join(this.path(id), 'restore-tmp-' + Date.now()), saves = path.join(this.game(id), 'saves');
    try {
      fs.cpSync(src, tmp, { recursive: true });
      this.backupWorlds(id, 'before-restore');
      U.rmrf(saves); fs.cpSync(tmp, saves, { recursive: true });
    } finally { U.rmrf(tmp); }
    return true;
  }
  // Восстановление из облачной копии (zip с папкой saves/): текущие миры сначала сохраняются локально
  restoreFromZip(id, zip) {
    if (this.running.has(id)) throw new Error('running');
    this.backupWorlds(id, 'before-restore');
    const saves = path.join(this.game(id), 'saves'); U.rmrf(saves);
    U.extractZip(zip, this.game(id), n => n.startsWith('saves/'), '', { maxTotal: 2 * 1024 ** 3 });
    return true;
  }
  deleteBackup(id, name) { U.rmrf(this.backupPath(id, name)); return true; }
  backupsDir(id) { const d = path.join(this.path(id), 'backups'); fs.mkdirSync(d, { recursive: true }); return d; }

  // ---- «Обновить все моды» (без смены версии Minecraft) ----
  async modUpdates(id) {
    const i = this.read(id); const rows = await this.hashes(id); const meta = this.meta(id);
    const mods = rows.filter(m => { const x = meta['mod/' + m.file]; return x && x.project_id && !String(x.project_id).startsWith('cf:') && x.version_id; });
    if (!mods.length) return [];
    const res = await MR.updateHashes(mods.map(m => m.sha1), modLoaders(i.loader), [i.mc]);
    return mods.filter(m => { const v = res[m.sha1]; return v && v.id !== meta['mod/' + m.file].version_id; })
      .map(m => { const v = res[m.sha1], x = meta['mod/' + m.file]; return { file: m.file, title: m.title, icon: m.icon, from: x.version || '', to: v.version_number, versionId: v.id }; });
  }
  async updateMods(id, files) {
    if (this.running.has(id)) throw new Error('running');
    const task = 'updmods:' + id, i = this.read(id);
    try {
      const list = (await this.modUpdates(id)).filter(u => !files || files.includes(u.file)); if (!list.length) return { updated: 0 };
      this.emit('progress', { task, label: i.name, pct: 0.02 });
      const bk = path.join(this.path(id), 'backups', `mods-update-${Date.now()}`); fs.mkdirSync(path.dirname(bk), { recursive: true });
      fs.cpSync(this.contentDir(id, 'mod'), bk, { recursive: true });
      const dir = this.contentDir(id, 'mod'); const meta = this.meta(id); let n = 0;
      for (const u of list) {
        const v = await MR.version(u.versionId); const f = MR.primaryFile(v);
        await U.download(f.url, path.join(dir, f.filename), { sha1: f.hashes.sha1, size: f.size });
        if (f.filename !== u.file) { fs.rmSync(path.join(dir, u.file), { force: true }); delete meta['mod/' + u.file]; }
        meta['mod/' + f.filename] = { size: f.size, sha1: f.hashes.sha1, looked: true, project_id: v.project_id, version_id: v.id, title: u.title, icon: u.icon, version: v.version_number };
        this.saveMeta(id, meta); this.emit('progress', { task, label: `${i.name} · ${u.title}`, pct: ++n / list.length });
      }
      return { updated: list.length };
    } finally { this.done(task); }
  }

  // ---- проверка сборки: дубли и недостающие зависимости ----
  inspect(id) {
    const i = this.read(id), dir = this.contentDir(id, 'mod');
    if (!U.exists(dir)) return { mods: 0, problems: [] };
    const r = Compat.scan(dir, i.mc, i.loader, { ...Resolver.ctxOf(i), java: require('./boost').guessJava(i.mc) });
    const problems = r.problems.map(p => p.type === 'missing' ? { type: 'missing', id: p.id, by: [p.name || p.by] } : p);
    // одну и ту же зависимость, нужную нескольким модам, показываем одной строкой
    const merged = []; for (const p of problems) { const x = p.type === 'missing' && merged.find(y => y.type === 'missing' && y.id === p.id); if (x) x.by.push(...p.by); else merged.push(p); }
    return { mods: r.mods.length, problems: merged, mc: i.mc };
  }

  // ---- копирование настроек игры между сборками ----
  syncOptions(from, to, mode) {
    const a = path.join(this.game(from), 'options.txt');
    if (!U.exists(a)) throw new Error('The source build has no saved settings yet — launch it once first');
    const lines = f => U.exists(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean) : [];
    const src = lines(a), b = path.join(this.game(to), 'options.txt'), dst = lines(b);
    const keep = l => /^(resourcePacks|incompatibleResourcePacks|version|lastServer):/.test(l);   // это остаётся своим у каждой сборки
    let out;
    if (mode === 'keys') { const keys = src.filter(l => l.startsWith('key_')); const kn = new Set(keys.map(l => l.split(':')[0])); out = [...dst.filter(l => !kn.has(l.split(':')[0])), ...keys]; }
    else out = [...src.filter(l => !keep(l)), ...dst.filter(keep)];
    fs.mkdirSync(this.game(to), { recursive: true }); fs.writeFileSync(b, out.join('\n') + '\n'); return { lines: out.length };
  }

  // ---- экспорт в .mrpack ----
  async buildMrpack(id) {
    const i = this.read(id), task = 'exp:' + id;
    try {
      this.emit('progress', { task, label: i.name, pct: 0.05 });
      const kinds = [['mod', 'mods'], ['resourcepack', 'resourcepacks'], ['shader', 'shaderpacks']]; const items = [];
      for (const [k, folder] of kinds) { const rows = await this.content(id, k); const meta = this.meta(id); for (const r of rows) if (r.enabled) items.push({ k, folder, file: r.file, sha1: (meta[k + '/' + r.file] || {}).sha1 }); }
      let found = {}; try { found = await MR.lookupHashes(items.map(x => x.sha1).filter(Boolean)); } catch (_) {}
      const files = [], entries = [];
      for (const it of items) {
        const v = found[it.sha1], f = v && v.files.find(x => x.hashes && x.hashes.sha1 === it.sha1), rel = `${it.folder}/${it.file}`;
        if (f && f.url && f.hashes.sha512) files.push({ path: rel, hashes: { sha1: f.hashes.sha1, sha512: f.hashes.sha512 }, env: { client: 'required', server: 'required' }, downloads: [f.url], fileSize: f.size });
        else entries.push({ name: 'overrides/' + rel, data: fs.readFileSync(path.join(this.contentDir(id, it.k), it.file)) });   // не с Modrinth — кладём файл внутрь
      }
      this.emit('progress', { task, label: i.name, pct: 0.6 });
      const g = this.game(id); const walk = (dir, rel) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, rel + e.name + '/'); else if (fs.statSync(f).size < 2e6) entries.push({ name: 'overrides/' + rel + e.name, data: fs.readFileSync(f) }); } };
      if (U.exists(path.join(g, 'config'))) walk(path.join(g, 'config'), 'config/');
      for (const n of ['options.txt']) if (U.exists(path.join(g, n))) entries.push({ name: 'overrides/' + n, data: fs.readFileSync(path.join(g, n)) });
      const dep = { minecraft: i.mc }; const key = { fabric: 'fabric-loader', quilt: 'quilt-loader', neoforge: 'neoforge', forge: 'forge' }[i.loader];
      if (key) dep[key] = i.loaderVersion || (await L.loaderVersions(i.loader, i.mc))[0] || '';
      const index = { formatVersion: 1, game: 'minecraft', versionId: '1.0.0', name: i.name, summary: 'Exported from SA Launcher', files, dependencies: dep };
      const buf = U.writeZip([{ name: 'modrinth.index.json', data: Buffer.from(JSON.stringify(index, null, 1)) }, ...entries]);
      return { buf, linked: files.length, bundled: entries.filter(e => !/^overrides\/(config|options)/.test(e.name)).length };
    } finally { this.done(task); }
  }
  async exportMrpack(id, file) { const r = await this.buildMrpack(id); fs.writeFileSync(file, r.buf); return { file, linked: r.linked, bundled: r.bundled }; }

  // ---- импорт модпаков: .mrpack (Modrinth) и .zip (CurseForge) ----
  // Файл сам определяет формат: modrinth.index.json -> Modrinth, manifest.json -> CurseForge.
  async importPack(buf, nameHint) {
    const z = U.readZip(buf);
    if (z.entries.some(e => e.name === 'modrinth.index.json')) return this.importMrpack(buf, nameHint, z);
    if (z.entries.some(e => e.name === 'manifest.json')) return this.importCurseforgePack(buf, nameHint, z);
    throw new Error('This file is not a modpack (.mrpack or CurseForge .zip)');
  }
  // Ставим версию игры и загрузчик; если точной версии загрузчика из модпака нет — берём свежую и запоминаем это
  async prepareWithFallback(id) {
    try { return await this.prepare(id); }
    catch (e) {
      const i = this.read(id);
      if (i.loader === 'vanilla' || !i.loaderVersion || String(e.message).startsWith('noloader:')) throw e;
      const want = i.loaderVersion; i.loaderVersion = ''; this.write(i);
      await this.prepare(id); const j = this.read(id); j.loaderFallback = want; this.write(j); return j;
    }
  }
  static MR_HOSTS = ['cdn.modrinth.com', 'github.com', 'raw.githubusercontent.com', 'gitlab.com'];
  async importMrpack(buf, nameHint, z) {
    z = z || U.readZip(buf); const idx = z.read('modrinth.index.json'); if (!idx || idx.length > 5e6) throw new Error('bad mrpack');
    const d = JSON.parse(idx.toString('utf8')); const dep = d.dependencies || {};
    if (typeof dep.minecraft !== 'string' || !/^[0-9A-Za-z._+-]{1,40}$/.test(dep.minecraft)) throw new Error('bad mrpack');
    const loader = dep['fabric-loader'] ? 'fabric' : dep['quilt-loader'] ? 'quilt' : dep.neoforge ? 'neoforge' : dep.forge ? 'forge' : 'vanilla';
    const lv = String(dep['fabric-loader'] || dep['quilt-loader'] || dep.neoforge || dep.forge || '').slice(0, 60);
    const inst = this.create({ name: String(d.name || nameHint || 'Modpack').slice(0, 80), mc: dep.minecraft, loader, loaderVersion: /^[0-9A-Za-z._+-]*$/.test(lv) ? lv : '' });
    const task = 'pack:' + inst.id; const files = (Array.isArray(d.files) ? d.files : []).filter(f => f && typeof f.path === 'string' && !(f.env && f.env.client === 'unsupported')).slice(0, 5000);
    let n = 0; const g = this.game(inst.id); const manual = [];
    try {
      await U.pool(files, 8, async f => {
        const dest = path.resolve(g, f.path); if (!dest.startsWith(path.resolve(g) + path.sep)) return;           // path traversal
        const url = (Array.isArray(f.downloads) ? f.downloads : []).map(u => U.safeUrl(u, Instances.MR_HOSTS)).find(Boolean);
        const h = f.hashes || {};
        if (!url) manual.push({ name: path.basename(f.path), url: '', reason: 'host', kind: 'mod' });             // адрес не из разрешённого списка — не качаем
        else await U.download(url, dest, { sha1: /^[a-f0-9]{40}$/i.test(h.sha1 || '') ? h.sha1.toLowerCase() : undefined, size: Number.isInteger(f.fileSize) ? f.fileSize : undefined });
        this.emit('progress', { task, label: inst.name, pct: ++n / Math.max(1, files.length) * 0.7 });
      });
      for (const pre of ['overrides/', 'client-overrides/']) U.extractZip(buf, g, name => name.startsWith(pre), pre);
      await this.prepareWithFallback(inst.id);
    } catch (e) { U.rmrf(this.path(inst.id)); throw e; } finally { this.done(task); }
    const j = this.read(inst.id); if (manual.length) { j.manual = manual; this.write(j); }
    return j;
  }
  async importCurseforgePack(buf, nameHint, z) {
    z = z || U.readZip(buf); const site = require('../config').siteUrl;
    const mf = z.read('manifest.json'); if (!mf || mf.length > 5e6) throw new Error('bad curseforge manifest');
    const m = CF.parseManifest(mf);
    const inst = this.create({ name: m.name || nameHint || 'CurseForge modpack', mc: m.mc, loader: m.loader, loaderVersion: m.loaderVersion });
    const task = 'pack:' + inst.id, P = (pct, label) => this.emit('progress', { task, label: label || inst.name, pct });
    const manual = [], meta = this.meta(inst.id);
    try {
      P(0.02);
      const found = await CF.resolveFiles(site, m.refs, p => P(0.02 + p * 0.13));
      let n = 0; const total = Math.max(1, m.refs.length);
      await U.pool(m.refs, 6, async r => {
        const f = found.get(r.projectID + ':' + r.fileID);
        const fname = f && U.safeFileName(f.file || f.fileName || f.name || '');
        const name = fname ? (/\.(jar|zip)$/i.test(fname) ? fname : fname + '.jar') : '';
        const kind = f ? CF.kindOf(f, name) : 'mod';
        const link = `https://www.curseforge.com/projects/${r.projectID}`;
        try {
          if (!f) manual.push({ projectID: r.projectID, fileID: r.fileID, name: `Project ${r.projectID} · file ${r.fileID}`, url: link, reason: 'notfound', kind });
          else if (!name || !CF.safeUrl(site, f.url)) manual.push({ projectID: r.projectID, fileID: r.fileID, name: name || f.name || `Project ${r.projectID}`, url: link, reason: f.url ? 'host' : 'blocked', kind });
          else {
            const dir = this.contentDir(inst.id, kind), dest = path.join(dir, name);
            await U.download(CF.safeUrl(site, f.url), dest, /^[a-f0-9]{40}$/i.test(f.sha1 || '') ? { sha1: f.sha1.toLowerCase() } : {});
            meta[kind + '/' + name] = { size: fs.statSync(dest).size, sha1: await U.sha1File(dest), looked: true, project_id: 'cf:' + r.projectID, version_id: 'cf:' + r.fileID, title: String(f.title || f.name || name).replace(/\.(jar|zip)$/i, '').slice(0, 100), icon: '', version: String(f.name || '').slice(0, 60) };
          }
        } catch (_) { manual.push({ projectID: r.projectID, fileID: r.fileID, name, url: link, reason: 'failed', kind }); }
        P(0.15 + ++n / total * 0.7);
      });
      this.saveMeta(inst.id, meta);
      const g = this.game(inst.id), pre = m.overrides + '/';
      U.extractZip(buf, g, name => name.startsWith(pre), pre);
      P(0.9, inst.name + ' · Minecraft ' + m.mc);
      await this.prepareWithFallback(inst.id);
    } catch (e) { U.rmrf(this.path(inst.id)); throw e; } finally { this.done(task); }
    const j = this.read(inst.id); if (manual.length) { j.manual = manual.slice(0, 500); this.write(j); }
    return j;
  }
  // Пользователь скачал недостающие файлы вручную: кладём в нужные папки и убираем их из списка
  addManualFiles(id, paths) {
    const i = this.read(id); let manual = Array.isArray(i.manual) ? i.manual : []; let added = 0;
    for (const p of paths || []) {
      const name = U.safeFileName(path.basename(String(p))); if (!/\.(jar|zip)$/i.test(name) || !U.exists(p)) continue;
      const hit = manual.find(x => x.name && x.name.toLowerCase() === name.toLowerCase());
      const kind = hit ? hit.kind : /\.jar$/i.test(name) ? 'mod' : 'resourcepack';
      const dir = this.contentDir(id, kind); fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(p, path.join(dir, name)); added++;
      manual = manual.filter(x => x !== hit);
    }
    if (manual.length) i.manual = manual; else delete i.manual;
    this.write(i); return { added, left: manual.length, instance: i };
  }
  // ---- мастер создания сборки SA: план (что поставить и что нужно для работы) и создание по плану ----
  async planContent(mc, loader, items) {
    const ml = modLoaders(loader), out = new Map(), ID = /^[A-Za-z0-9]{8}$/;
    const add = async (pid, by, depth) => {
      if (!ID.test(String(pid))) return;
      if (out.has(pid)) { const e = out.get(pid); if (by && !e.neededBy.includes(by)) e.neededBy.push(by); return; }
      let p; try { p = await MR.project(pid); } catch (_) { return; }
      const isMod = p.project_type === 'mod', e = { project: p.id, title: String(p.title || '').slice(0, 100), icon: p.icon_url || '', type: p.project_type, neededBy: by ? [by] : [], ok: false, version: '', versionName: '' };
      out.set(pid, e);
      let list = []; try { list = await MR.versions(pid, { loaders: isMod ? ml : undefined, game_versions: [mc] }); } catch (_) {}
      if (!list.length) return;
      const v = MR.best(list); e.ok = true; e.version = v.id; e.versionName = String(v.version_number || '').slice(0, 40);
      if (isMod && depth < 3) for (const d of v.dependencies || []) if (d.dependency_type === 'required' && d.project_id) await add(d.project_id, e.title, depth + 1);
    };
    for (const it of (Array.isArray(items) ? items : []).slice(0, 100)) await add(it && it.project, '', 0);
    return [...out.values()];
  }
  async createFromPlan(o) {
    const plan = (await this.planContent(o.mc, o.loader, o.items)).filter(e => e.ok);          // план пересчитываем здесь: данным из интерфейса не доверяем
    const i = this.create({ name: o.name, mc: o.mc, loader: o.loader, loaderVersion: o.loaderVersion || '' });
    const task = 'wiz:' + i.id, failed = []; let n = 0;
    try {
      for (const e of plan) {
        this.emit('progress', { task, label: i.name + ' · ' + e.title, pct: n++ / Math.max(1, plan.length) * 0.9 });
        try { await this.installProject(i.id, e.project, e.version, 3); } catch (_) { failed.push(e.title); }    // зависимости уже в плане
      }
    } finally { this.done(task); }
    this.prepare(i.id).catch(err => this.emit('error', { id: i.id, message: err.message }));
    return { instance: this.read(i.id), installed: plan.length - failed.length, failed };
  }
  // ---- как в Prism: добавить файлы с диска и список миров ----
  addFiles(id, kind, paths) {
    const ext = kind === 'mod' ? /\.jar$/i : /\.zip$/i, dir = this.contentDir(id, kind); fs.mkdirSync(dir, { recursive: true }); const added = [];
    for (const p of paths || []) { const name = U.safeFileName(path.basename(String(p))); if (!ext.test(name) || !U.exists(p) || !fs.statSync(p).isFile()) continue; fs.copyFileSync(p, path.join(dir, name)); added.push(name); }
    return added;
  }
  listWorlds(id) {
    const d = path.join(this.game(id), 'saves');
    try { return fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => { const f = path.join(d, e.name); return { name: e.name, size: this.dirSize(f), time: fs.statSync(f).mtimeMs }; }).sort((a, b) => b.time - a.time); } catch (_) { return []; }
  }
  // ---- Feed The Beast ----
  async installFtb(packId, versionId, title) {
    const FTB = require('./ftb'), site = require('../config').siteUrl;
    const pk = await FTB.pack(packId), man = await FTB.version(packId, versionId || FTB.latest(pk)), tg = FTB.targets(man);
    const inst = this.create({ name: String(title || pk.name || 'FTB modpack').slice(0, 80), ...tg });
    const task = 'pack:' + inst.id, g = this.game(inst.id), manual = [];
    const files = man.files.filter(f => f && typeof f.name === 'string' && !f.serveronly).slice(0, 5000);
    try {
      const refs = files.filter(f => !FTB.safeUrl(f.url) && f.curseforge && Number.isInteger(+f.curseforge.project) && Number.isInteger(+f.curseforge.file)).map(f => ({ projectID: +f.curseforge.project, fileID: +f.curseforge.file }));
      const cf = refs.length ? await CF.resolveFiles(site, refs) : new Map(); let n = 0;
      await U.pool(files, 6, async f => {
        const name = U.safeFileName(f.name), rel = String(f.path || '').replace(/^[./\\]+/, ''), dest = path.resolve(g, rel, name);
        let url = FTB.safeUrl(f.url), sha1 = /^[a-f0-9]{40}$/i.test(f.sha1 || '') ? f.sha1.toLowerCase() : undefined;
        if (!url && f.curseforge) { const c = cf.get(+f.curseforge.project + ':' + +f.curseforge.file); url = c && CF.safeUrl(site, c.url); sha1 = undefined; }
        try {
          if (!name || !dest.startsWith(path.resolve(g) + path.sep)) return;                  // path traversal
          if (!url) manual.push({ name, url: f.curseforge ? `https://www.curseforge.com/projects/${+f.curseforge.project}` : '', reason: f.curseforge ? 'blocked' : 'host', kind: 'mod' });
          else await U.download(url, dest, sha1 ? { sha1 } : {});
        } catch (_) { manual.push({ name, url: '', reason: 'failed', kind: 'mod' }); }
        this.emit('progress', { task, label: inst.name, pct: ++n / Math.max(1, files.length) * 0.85 });
      });
      await this.prepareWithFallback(inst.id);
    } catch (e) { U.rmrf(this.path(inst.id)); throw e; } finally { this.done(task); }
    const j = this.read(inst.id); if (manual.length) { j.manual = manual.slice(0, 500); this.write(j); } return j;
  }
  // ---- ATLauncher ----
  async installAtl(safeName, versionId, title) {
    const A = require('./atl');
    const info = await A.version(safeName, versionId || 'latest');
    const man = A.parse(await A.manifest(safeName, info.version), info);
    const inst = this.create({ name: String(title || safeName).slice(0, 80), mc: man.mc, loader: man.loader, loaderVersion: man.loaderVersion });
    const task = 'pack:' + inst.id, g = this.game(inst.id), manual = [], P = (pct, label) => this.emit('progress', { task, label: label || inst.name, pct });
    try {
      let n = 0; const total = Math.max(1, man.mods.length);
      await U.pool(man.mods, 6, async m => {
        try {
          const dir = path.resolve(this.contentDir(inst.id, m.kind)), dest = path.resolve(dir, m.file);
          if (!dest.startsWith(dir + path.sep)) return;                                           // path traversal
          if (m.browser) manual.push({ name: m.file, url: m.page, reason: 'browser', kind: m.kind });  // автор разрешил только ручное скачивание
          else if (!m.urls.length) manual.push({ name: m.file, url: '', reason: 'host', kind: m.kind });
          else await A.fetchFile(m.urls, dest, m.md5);
        } catch (_) { manual.push({ name: m.file, url: '', reason: 'failed', kind: m.kind }); }
        P(++n / total * 0.8);
      });
      for (const s of man.skipped) manual.push({ name: s.name, url: '', reason: 'unsupported', kind: 'mod' });
      const cfg = await A.configs(safeName, info.version);
      if (cfg) U.extractZip(cfg, g, () => true);
      P(0.9, inst.name + ' · Minecraft ' + man.mc);
      await this.prepareWithFallback(inst.id);
    } catch (e) { U.rmrf(this.path(inst.id)); throw e; } finally { this.done(task); }
    const j = this.read(inst.id); if (manual.length) { j.manual = manual.slice(0, 500); this.write(j); } return j;
  }
  // ---- Technic Platform (прямой zip или Solder) ----
  async installTechnic(slug, _version, title) {
    const T = require('./technic'), d = await T.pack(slug);
    const name = String(title || d.displayName || d.name).replace(/<[^>]*>/g, '').slice(0, 80) || 'Technic modpack';
    const hint = typeof d.minecraft === 'string' && /^[0-9A-Za-z._+-]{1,40}$/.test(d.minecraft) ? d.minecraft : '';
    const task = 'pack:' + slug; let inst = null;
    const P = (pct, label) => this.emit('progress', { task: inst ? 'pack:' + inst.id : task, label: label || name, pct });
    try {
      if (d.solder) {
        const sb = await T.solderBuild(d.solder, d.name);
        const mc = sb.minecraft || hint; if (!mc) throw new Error('err:techNoMc');
        inst = this.create({ name, mc }); const g = this.game(inst.id); let found = null, n = 0;
        for (const m of sb.mods) {
          const buf = await T.solderZip(m), ins = T.inspect(buf, { strip: false });
          if (ins.info && ins.info.loader !== 'vanilla') found = ins.info;
          T.extract(buf, g, ins.strip); P(++n / sb.mods.length * 0.85);
        }
        if (found) { const j = this.read(inst.id); Object.assign(j, { loader: found.loader, loaderVersion: found.loaderVersion }); if (found.mc && found.mc !== mc) j.mc = found.mc; this.write(j); }
      } else {
        if (!d.url) throw new Error('err:techUrl');
        P(0.05); const buf = await T.download(d.url), ins = T.inspect(buf); if (!ins.files) throw new Error('err:techEmpty');
        const info = ins.info || { mc: hint, loader: 'vanilla', loaderVersion: '' }, mc = info.mc || hint; if (!mc) throw new Error('err:techNoMc');
        inst = this.create({ name, mc, loader: info.loader, loaderVersion: info.loaderVersion });
        T.extract(buf, this.game(inst.id), ins.strip); P(0.85);
      }
      P(0.9, name + ' · Minecraft ' + this.read(inst.id).mc);
      await this.prepareWithFallback(inst.id);
    } catch (e) { if (inst) U.rmrf(this.path(inst.id)); throw e; } finally { this.done(inst ? 'pack:' + inst.id : task); }
    return this.read(inst.id);
  }
  async installModpack(projectId, versionId, src, title) {
    const task = 'dl:' + projectId; this.emit('progress', { task, label: title || 'Modpack', pct: 0.1 });
    try {
      if (src === 'ftb') return await this.installFtb(projectId, versionId, title);
      if (src === 'atl') return await this.installAtl(projectId, versionId, title);
      if (src === 'technic') return await this.installTechnic(projectId, versionId, title);
      if (src === 'curseforge') {
        if (!/^\d{1,12}$/.test(String(projectId)) || (versionId && !/^\d{1,12}$/.test(String(versionId)))) throw new Error('Bad CurseForge id');
        const f = await CF.packFile(require('../config').siteUrl, projectId, versionId);
        const buf = await U.fetchBuf(f.url); if (f.sha1 && U.sha1(buf) !== f.sha1) throw new Error('sha1 mismatch');
        return await this.importPack(buf, title);
      }
      const p = await MR.project(projectId);
      const v = versionId ? await MR.version(versionId) : MR.best(await MR.versions(projectId));
      const f = MR.primaryFile(v); if (!U.safeUrl(f.url, Instances.MR_HOSTS)) throw new Error('Unsafe download address');
      return await this.importPack(await U.fetchBuf(f.url), p.title);
    } finally { this.done(task); }
  }
}
require('./smart')(Instances);
module.exports = { Instances, OPT_MODS, AIKAR };
