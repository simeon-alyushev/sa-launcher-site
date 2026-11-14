'use strict';
// Установка и запуск Minecraft: версии, библиотеки, ассеты, natives, аргументы.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const U = require('./util');
const { ensureJava } = require('./java');

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
let manifestCache = null;
async function manifest() {
  if (manifestCache && manifestCache.t > Date.now()) return manifestCache.v;
  const v = await U.fetchJSON(MANIFEST);
  manifestCache = { v, t: Date.now() + 10 * 60e3 };
  return v;
}

// ---- правила (rules) ----
function ruleOk(rules, features = {}) {
  if (!rules || !rules.length) return true;
  let ok = false;
  for (const r of rules) {
    let m = true;
    if (r.os) {
      if (r.os.name && r.os.name !== U.OS) m = false;
      if (r.os.arch && r.os.arch !== U.ARCH) m = false;
      if (r.os.version && !new RegExp(r.os.version).test(os.release())) m = false;
    }
    if (r.features) for (const k in r.features) if (!!features[k] !== r.features[k]) m = false;
    if (m) ok = r.action === 'allow';
  }
  return ok;
}

// ---- version.json (+ inheritsFrom) ----
const libKey = l => { const p = l.name.split(':'); return p.length > 3 ? `${p[0]}:${p[1]}:${p[3]}` : `${p[0]}:${p[1]}`; };
function merge(child, parent) {
  const seen = new Set(); const libs = [];
  for (const l of [...(child.libraries || []), ...(parent.libraries || [])]) { const k = libKey(l); if (!seen.has(k)) { seen.add(k); libs.push(l); } }
  const r = { ...parent, ...child, libraries: libs };
  if (parent.arguments || child.arguments) r.arguments = { game: [...((parent.arguments || {}).game || []), ...((child.arguments || {}).game || [])], jvm: [...((parent.arguments || {}).jvm || []), ...((child.arguments || {}).jvm || [])] };
  for (const k of ['assetIndex', 'assets', 'downloads', 'javaVersion', 'logging']) if (!child[k] && parent[k]) r[k] = parent[k];
  delete r.inheritsFrom;
  return r;
}
async function versionJSON(shared, id) {
  const f = path.join(shared, 'versions', id, id + '.json');
  let j;
  if (U.exists(f)) j = JSON.parse(fs.readFileSync(f, 'utf8'));
  else {
    const e = (await manifest()).versions.find(v => v.id === id);
    if (!e) throw new Error('Версия не найдена: ' + id);
    j = await U.fetchJSON(e.url); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(j));
  }
  return j.inheritsFrom ? merge(j, await versionJSON(shared, j.inheritsFrom)) : j;
}

// ---- библиотеки ----
const mavenPath = name => { const [g, a, v, c] = name.split(':'); return `${g.replace(/\./g, '/')}/${a}/${v}/${a}-${v}${c ? '-' + c : ''}.jar`; };
function libraryList(vj, shared) {
  const out = [];
  for (const l of vj.libraries) {
    if (!ruleOk(l.rules)) continue;
    const d = l.downloads || {};
    const add = (art, isNative) => out.push({ name: l.name, path: path.join(shared, 'libraries', art.path), url: art.url, sha1: art.sha1, size: art.size, native: isNative, exclude: (l.extract || {}).exclude || [] });
    if (l.natives && l.natives[U.OS]) {
      const k = l.natives[U.OS].replace('${arch}', U.ARCH === 'x86' ? '32' : '64');
      const a = (d.classifiers || {})[k]; if (a) add(a, true);
      if (d.artifact && d.artifact.path) add(d.artifact, false);
      continue;
    }
    if (d.artifact) add(d.artifact, /:natives-/.test(l.name) && !!l.extract);
    else add({ path: mavenPath(l.name), url: (l.url || 'https://libraries.minecraft.net/').replace(/\/?$/, '/') + mavenPath(l.name) }, false);
  }
  return out;
}

// ---- установка клиента ----
async function installGame(shared, id, progress = () => {}) {
  const vj = await versionJSON(shared, id);
  const jar = path.join(shared, 'versions', id, id + '.jar');
  const cj = vj.downloads && vj.downloads.client;
  if (cj) await U.download(cj.url, jar, { sha1: cj.sha1, size: cj.size });
  // библиотеки
  const libs = libraryList(vj, shared); let n = 0;
  await U.pool(libs, 10, async l => { if (l.url) await U.download(l.url, l.path, { sha1: l.sha1, size: l.size }); else if (!U.exists(l.path)) throw new Error('Нет библиотеки ' + l.name); progress('Libraries', ++n / libs.length); });
  // ассеты
  const ai = vj.assetIndex;
  if (ai) {
    const idx = path.join(shared, 'assets', 'indexes', ai.id + '.json');
    await U.download(ai.url, idx, { sha1: ai.sha1 });
    const objs = Object.values(JSON.parse(fs.readFileSync(idx, 'utf8')).objects);
    let k = 0;
    await U.pool(objs, 16, async o => {
      const h = o.hash, sub = h.slice(0, 2);
      await U.download(`https://resources.download.minecraft.net/${sub}/${h}`, path.join(shared, 'assets', 'objects', sub, h), { sha1: h, size: o.size });
      if (++k % 40 === 0 || k === objs.length) progress('Assets', k / objs.length);
    });
  }
  return vj;
}

// ---- аргументы ----
function flatten(list, features) {
  const out = [];
  for (const a of list || []) {
    if (typeof a === 'string') out.push(a);
    else if (ruleOk(a.rules, features)) out.push(...[].concat(a.value));
  }
  return out;
}
const fill = (s, m) => s.replace(/\$\{([^}]+)\}/g, (x, k) => (k in m ? m[k] : x));

async function authlibInjector(shared) {
  const f = path.join(shared, 'authlib-injector.jar');
  if (U.exists(f)) return f;
  const j = await U.fetchJSON('https://authlib-injector.yushi.moe/artifact/latest.json');
  await U.download(j.download_url, f);
  return f;
}

/**
 * Запуск. inst — объект экземпляра, account — {p,name,id,accessToken}, opts: {shared, instDir, versionId, javaPath, memory, jvmArgs, log, onExit}
 */
async function launch({ shared, instDir, versionId, inst, account, settings, progress, log, onExit }) {
  const vj = await installGame(shared, versionId, progress);
  const gameDir = path.join(instDir, '.minecraft'); fs.mkdirSync(gameDir, { recursive: true });
  let java = inst.javaPath || settings.javaPath;
  if (!java || !U.exists(java)) java = await ensureJava(shared, (vj.javaVersion || {}).component || 'java-runtime-gamma', progress);

  const libs = libraryList(vj, shared);
  const nativesDir = path.join(instDir, 'natives'); U.rmrf(nativesDir); fs.mkdirSync(nativesDir, { recursive: true });
  for (const l of libs) {
    if (!l.native || !U.exists(l.path)) continue;
    try { U.extractZip(fs.readFileSync(l.path), nativesDir, n => !n.startsWith('META-INF/') && !l.exclude.some(e => n.startsWith(e)) && /\.(dll|so|dylib|jnilib)$/i.test(n)); } catch (_) {}
  }
  const cp = [...new Set(libs.filter(l => !l.native).map(l => l.path)), path.join(shared, 'versions', versionId, versionId + '.jar')];
  const sep = path.delimiter;
  const mem = inst.memory || settings.memory || 4096;
  const map = {
    auth_player_name: account.name, version_name: versionId, game_directory: gameDir, assets_root: path.join(shared, 'assets'), assets_index_name: (vj.assetIndex || {}).id || vj.assets,
    auth_uuid: account.id, auth_access_token: account.accessToken || '0', clientid: '', auth_xuid: '', user_type: account.p === 'ms' ? 'msa' : 'mojang', version_type: vj.type || 'release',
    natives_directory: nativesDir, launcher_name: 'SA-Launcher', launcher_version: U.VERSION, classpath: cp.join(sep), library_directory: path.join(shared, 'libraries'), classpath_separator: sep,
    user_properties: '{}', resolution_width: '854', resolution_height: '480', game_assets: path.join(shared, 'assets', 'virtual', 'legacy'), auth_session: account.accessToken || '0'
  };
  let jvm = vj.arguments ? flatten(vj.arguments.jvm) : ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}'];
  if (!jvm.includes('-cp') && !jvm.some(a => a.includes('${classpath}'))) jvm.push('-cp', '${classpath}');
  if (!jvm.some(a => a.includes('java.library.path'))) jvm.unshift('-Djava.library.path=${natives_directory}');
  const game = vj.arguments ? flatten(vj.arguments.game, {}) : (vj.minecraftArguments || '').split(' ').filter(Boolean);
  const extra = [];
  if (account.p === 'ely') { const inj = await authlibInjector(shared); extra.push(`-javaagent:${inj}=https://authserver.ely.by/api/authlib-injector`, '-Dauthlibinjector.noShowServerName'); }
  const user = (inst.jvmArgs || settings.jvmArgs || '').split(/\s+/).filter(Boolean);
  const args = [`-Xmx${mem}m`, `-Xms${Math.min(512, mem)}m`, ...extra, ...user, ...jvm.map(a => fill(a, map)), vj.mainClass, ...game.map(a => fill(a, map))];

  log(`$ ${java} ${args.map(a => a === account.accessToken ? '***' : a).join(' ').slice(0, 600)}…`);
  const child = spawn(java, args, { cwd: gameDir, windowsHide: true });
  const pipe = d => d.toString().split(/\r?\n/).filter(Boolean).forEach(l => log(l));
  child.stdout.on('data', pipe); child.stderr.on('data', pipe);
  child.on('exit', code => onExit(code));
  child.on('error', e => { log('ERROR ' + e.message); onExit(-1); });
  return child;
}

module.exports = { manifest, versionJSON, installGame, launch, ruleOk, libraryList, flatten, fill };
