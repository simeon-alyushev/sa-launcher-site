'use strict';
// Сборки (instances): создание, контент, обновление версии, оптимизация, импорт .mrpack.
const fs = require('fs');
const path = require('path');
const U = require('./util');
const mc = require('./mc');
const L = require('./loaders');
const MR = require('./modrinth');

const FOLDERS = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' };
const OPT_MODS = {
  fabric: ['fabric-api', 'sodium', 'lithium', 'ferrite-core', 'modernfix', 'entityculling', 'immediatelyfast', 'dynamic-fps'],
  quilt: ['sodium', 'lithium', 'ferrite-core', 'modernfix', 'entityculling', 'immediatelyfast'],
  forge: ['embeddium', 'modernfix', 'ferrite-core', 'entityculling', 'immediatelyfast'],
  neoforge: ['modernfix', 'ferrite-core', 'entityculling', 'immediatelyfast', 'sodium']
};
const AIKAR = '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1';
const modLoaders = loader => loader === 'quilt' ? ['quilt', 'fabric'] : [loader];

class Instances {
  constructor({ dataDir, store, emit }) {
    this.dir = path.join(dataDir, 'instances'); this.shared = path.join(dataDir, 'shared');
    this.store = store; this.emit = emit; this.running = new Map();
    fs.mkdirSync(this.dir, { recursive: true }); fs.mkdirSync(this.shared, { recursive: true });
  }
  path(id) { return path.join(this.dir, id); }
  game(id) { return path.join(this.dir, id, '.minecraft'); }
  read(id) { return JSON.parse(fs.readFileSync(path.join(this.path(id), 'instance.json'), 'utf8')); }
  write(i) { fs.writeFileSync(path.join(this.path(i.id), 'instance.json'), JSON.stringify(i, null, 1)); return i; }
  list() {
    return fs.readdirSync(this.dir).map(id => { try { return { ...this.read(id), running: this.running.has(id) }; } catch (_) { return null; } }).filter(Boolean).sort((a, b) => (b.lastPlayed || b.created) - (a.lastPlayed || a.created));
  }
  progress(task, label) { return (name, pct) => this.emit('progress', { task, label: name ? `${label} · ${name}` : label, pct }); }
  done(task) { this.emit('progress', { task, done: true }); }

  create({ name, mc: mcv, loader = 'vanilla', loaderVersion = '' }) {
    let id = U.slug(name), n = 1; while (U.exists(this.path(id))) id = U.slug(name) + '-' + (++n);
    fs.mkdirSync(this.game(id), { recursive: true });
    return this.write({ id, name, mc: mcv, loader, loaderVersion, memory: 0, jvmArgs: '', javaPath: '', created: Date.now(), lastPlayed: 0, playtime: 0, versionId: '' });
  }
  update(id, patch) { const i = this.read(id); const allowed = ['name', 'memory', 'jvmArgs', 'javaPath']; for (const k of allowed) if (k in patch) i[k] = patch[k]; return this.write(i); }
  remove(id) { if (this.running.has(id)) throw new Error('running'); U.rmrf(this.path(id)); }
  duplicate(id) {
    const i = this.read(id); const n = this.create({ name: i.name + ' (copy)', mc: i.mc, loader: i.loader, loaderVersion: i.loaderVersion });
    fs.cpSync(this.game(id), this.game(n.id), { recursive: true }); return this.write({ ...n, memory: i.memory, jvmArgs: i.jvmArgs, javaPath: i.javaPath, versionId: i.versionId });
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

  async play(id) {
    if (this.running.has(id)) return;
    const st = this.store.settings; const accId = st.selected;
    let acc = accId && this.store.account(accId);
    if (!acc) throw new Error('noaccount');
    const { ensureFresh } = require('./auth');
    acc = await ensureFresh(require('../config').siteUrl, this.store, acc);
    let i = this.read(id);
    if (!i.versionId || !U.exists(path.join(this.shared, 'versions', i.versionId, i.versionId + '.json'))) i = await this.prepare(id);
    const task = 'play:' + id; const t0 = Date.now();
    this.running.set(id, null); this.emit('state', { id, running: true });
    try {
      const child = await mc.launch({
        shared: this.shared, instDir: this.path(id), versionId: i.versionId, inst: i, account: acc, settings: st,
        progress: this.progress(task, i.name), log: line => this.emit('log', { id, line }),
        onExit: code => { this.running.delete(id); const j = this.read(id); j.playtime = (j.playtime || 0) + Math.round((Date.now() - t0) / 1000); this.write(j); this.emit('state', { id, running: false, code }); }
      });
      this.running.set(id, child);
      const j = this.read(id); j.lastPlayed = Date.now(); this.write(j);
    } catch (e) { this.running.delete(id); this.emit('state', { id, running: false }); throw e; }
    finally { this.done(task); }
  }
  stop(id) { const c = this.running.get(id); if (c) c.kill(); }

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
    return rows.map(r => ({ file: r.file, enabled: r.enabled, size: r.size, title: r.m.title || r.file.replace(/\.(jar|zip|disabled)/g, ''), icon: r.m.icon || '', version: r.m.version || '', known: !!r.m.project_id }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }
  toggle(id, kind, file) {
    const dir = this.contentDir(id, kind), a = path.join(dir, file);
    const b = file.endsWith('.disabled') ? a.slice(0, -9) : a + '.disabled'; fs.renameSync(a, b); return true;
  }
  removeFile(id, kind, file) { fs.rmSync(path.join(this.contentDir(id, kind), path.basename(file)), { force: true }); return true; }

  // Установка проекта из Modrinth в сборку (с обязательными зависимостями)
  async installProject(id, projectId, versionId, _depth = 0, done = new Set()) {
    const i = this.read(id); if (done.has(projectId)) return []; done.add(projectId);
    const p = await MR.project(projectId);
    if (p.project_type === 'modpack') throw new Error('modpack');
    const kind = p.project_type; const isMod = kind === 'mod';
    let v;
    if (versionId) v = await MR.version(versionId);
    else {
      const list = await MR.versions(projectId, { loaders: isMod ? modLoaders(i.loader) : undefined, game_versions: [i.mc] });
      if (!list.length) throw new Error('incompatible:' + p.title);
      v = MR.best(list);
    }
    const f = MR.primaryFile(v); const dest = path.join(this.contentDir(id, kind), f.filename);
    const task = 'inst:' + projectId; this.emit('progress', { task, label: p.title, pct: 0.2 });
    await U.download(f.url, dest, { sha1: f.hashes.sha1, size: f.size });
    const meta = this.meta(id); meta[kind + '/' + f.filename] = { size: f.size, sha1: f.hashes.sha1, looked: true, project_id: p.id, version_id: v.id, title: p.title, icon: p.icon_url, version: v.version_number }; this.saveMeta(id, meta);
    const installed = [p.title];
    if (isMod && _depth < 3) {
      const have = new Set(Object.values(this.meta(id)).map(m => m.project_id));
      for (const d of v.dependencies || []) if (d.dependency_type === 'required' && d.project_id && !have.has(d.project_id)) {
        try { installed.push(...await this.installProject(id, d.project_id, d.version_id, _depth + 1, done)); } catch (_) {}
      }
    }
    this.done(task); return installed;
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
    const cands = (cur < 0 ? rel.slice(0, 6) : rel.slice(0, cur)).slice(0, 8).map(v => v.id);   // новее текущей, новые первыми
    const out = [];
    await Promise.all(cands.map(async v => {
      const ok = await L.supports(i.loader, v);
      if (!ok) return out.push({ mc: v, loaderOk: false, total: mods.length, ok: 0, missing: [] });
      let res = {};
      if (mods.length) try { res = await MR.updateHashes(mods.map(m => m.sha1), modLoaders(i.loader), [v]); } catch (_) {}
      const missing = mods.filter(m => !res[m.sha1]).map(m => ({ file: m.file, title: m.title, icon: m.icon }));
      out.push({ mc: v, loaderOk: true, total: mods.length, ok: mods.length - missing.length, missing });
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
  async optimize(id) {
    const i = this.read(id);
    if (i.loader === 'vanilla') throw new Error('vanilla');
    const have = new Set(Object.values(this.meta(id)).map(m => m.project_id));
    (await this.content(id, 'mod')).forEach(() => {});                 // обновит meta (определит уже установленные)
    const have2 = new Set(Object.values(this.meta(id)).map(m => m.project_id));
    const slugs = OPT_MODS[i.loader] || [];
    const installed = [], skipped = [];
    const projs = await MR.projects(slugs).catch(() => []);
    const bySlug = Object.fromEntries(projs.map(p => [p.slug, p]));
    for (const s of slugs) {
      const p = bySlug[s]; if (!p) { skipped.push(s); continue; }
      if (have.has(p.id) || have2.has(p.id)) continue;
      try { installed.push(...await this.installProject(id, p.id)); } catch (_) { skipped.push(p.title); }
    }
    const patch = {};
    if (!i.jvmArgs) patch.jvmArgs = AIKAR;
    if (!i.memory) patch.memory = Math.max(2048, Math.min(6144, Math.floor(U.totalMemMB() / 2 / 512) * 512));
    this.update(id, patch);
    return { installed: [...new Set(installed)], skipped };
  }

  // ---- .mrpack ----
  async importMrpack(buf, nameHint) {
    const z = U.readZip(buf); const idx = z.read('modrinth.index.json'); if (!idx) throw new Error('bad mrpack');
    const d = JSON.parse(idx.toString('utf8')); const dep = d.dependencies || {};
    const loader = dep['fabric-loader'] ? 'fabric' : dep['quilt-loader'] ? 'quilt' : dep.neoforge ? 'neoforge' : dep.forge ? 'forge' : 'vanilla';
    const lv = dep['fabric-loader'] || dep['quilt-loader'] || dep.neoforge || dep.forge || '';
    const inst = this.create({ name: d.name || nameHint || 'Modpack', mc: dep.minecraft, loader, loaderVersion: lv });
    const task = 'pack:' + inst.id; const files = (d.files || []).filter(f => !(f.env && f.env.client === 'unsupported'));
    let n = 0; const g = this.game(inst.id);
    try {
      await U.pool(files, 8, async f => {
        const dest = path.resolve(g, f.path); if (!dest.startsWith(path.resolve(g) + path.sep)) return;
        await U.download(f.downloads[0], dest, { sha1: f.hashes.sha1, size: f.fileSize });
        this.emit('progress', { task, label: inst.name, pct: ++n / files.length * 0.7 });
      });
      for (const pre of ['overrides/', 'client-overrides/']) U.extractZip(buf, g, name => name.startsWith(pre), pre);
      await this.prepare(inst.id);
    } catch (e) { U.rmrf(this.path(inst.id)); throw e; } finally { this.done(task); }
    return this.read(inst.id);
  }
  async installModpack(projectId, versionId) {
    const p = await MR.project(projectId);
    const v = versionId ? await MR.version(versionId) : MR.best(await MR.versions(projectId));
    const f = MR.primaryFile(v);
    this.emit('progress', { task: 'dl:' + projectId, label: p.title, pct: 0.1 });
    try { return await this.importMrpack(await U.fetchBuf(f.url), p.title); } finally { this.done('dl:' + projectId); }
  }
}
module.exports = { Instances, OPT_MODS };
