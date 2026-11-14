'use strict';
// Загрузчики модов: Fabric, Quilt (через meta API) и Forge/NeoForge (через официальные установщики).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const U = require('./util');
const mc = require('./mc');
const { ensureJava } = require('./java');

const META = { fabric: 'https://meta.fabricmc.net/v2', quilt: 'https://meta.quiltmc.org/v3' };
const LOADERS = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'];

const cmpVer = (a, b) => { const x = a.split(/[.-]/).map(n => parseInt(n) || 0), y = b.split(/[.-]/).map(n => parseInt(n) || 0); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (y[i] || 0) - (x[i] || 0); return 0; };

// Список версий загрузчика для версии Minecraft (новые первыми)
async function loaderVersions(loader, mcv) {
  if (loader === 'vanilla') return [];
  try {
    if (loader === 'fabric' || loader === 'quilt') {
      const d = await U.fetchJSON(`${META[loader]}/versions/loader/${mcv}`);
      return d.map(x => x.loader.version);
    }
    if (loader === 'forge') {
      const d = await U.fetchJSON('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
      const out = []; for (const k in d.promos) { const m = k.match(/^(.+)-(latest|recommended)$/); if (m && m[1] === mcv && !out.includes(d.promos[k])) out.push(d.promos[k]); }
      return out.sort(cmpVer);
    }
    if (loader === 'neoforge') {
      const d = await U.fetchJSON('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
      const [, mi, pa] = mcv.match(/^1\.(\d+)(?:\.(\d+))?/) || []; if (!mi) return [];
      const pre = `${mi}.${pa || 0}.`;
      return d.versions.filter(v => v.startsWith(pre) && !/(alpha|beta|snapshot)/i.test(v)).sort(cmpVer);
    }
  } catch (_) {}
  return [];
}
async function supports(loader, mcv) { return loader === 'vanilla' || (await loaderVersions(loader, mcv)).length > 0; }

function runInstaller(java, jar, cwd, args, log) {
  return new Promise((ok, no) => {
    const javaExe = java.replace(/javaw\.exe$/i, 'java.exe');
    const c = spawn(javaExe, ['-jar', jar, ...args], { cwd, windowsHide: true });
    const out = d => d.toString().split(/\r?\n/).filter(Boolean).forEach(l => log(l));
    c.stdout.on('data', out); c.stderr.on('data', out);
    c.on('error', no); c.on('exit', code => code === 0 ? ok() : no(new Error('Установщик завершился с кодом ' + code)));
  });
}

// Возвращает id версии, которую нужно запускать
async function installLoader({ shared, loader, mcv, lv, progress, log }) {
  if (loader === 'vanilla') { await mc.installGame(shared, mcv, progress); return mcv; }
  if (loader === 'fabric' || loader === 'quilt') {
    if (!lv) lv = (await loaderVersions(loader, mcv))[0];
    if (!lv) throw new Error(`${loader} не поддерживает Minecraft ${mcv}`);
    const j = await U.fetchJSON(`${META[loader]}/versions/loader/${mcv}/${lv}/profile/json`);
    const f = path.join(shared, 'versions', j.id, j.id + '.json');
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(j));
    await mc.installGame(shared, j.id, progress);
    return j.id;
  }
  // Forge / NeoForge
  if (!lv) lv = (await loaderVersions(loader, mcv))[0];
  if (!lv) throw new Error(`${loader} не поддерживает Minecraft ${mcv}`);
  const id = loader === 'forge' ? `${mcv}-forge-${lv}` : `neoforge-${lv}`;
  if (U.exists(path.join(shared, 'versions', id, id + '.json'))) { await mc.installGame(shared, id, progress); return id; }
  const vj = await mc.installGame(shared, mcv, progress);
  const java = await ensureJava(shared, (vj.javaVersion || {}).component || 'java-runtime-gamma', progress);
  const url = loader === 'forge'
    ? `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcv}-${lv}/forge-${mcv}-${lv}-installer.jar`
    : `https://maven.neoforged.net/releases/net/neoforged/neoforge/${lv}/neoforge-${lv}-installer.jar`;
  const jar = path.join(shared, 'installers', `${loader}-${mcv}-${lv}.jar`);
  progress(loader, 0); await U.download(url, jar);
  fs.writeFileSync(path.join(shared, 'launcher_profiles.json'), JSON.stringify({ profiles: {}, selectedProfile: 'x', clientToken: 'x', launcherVersion: { name: 'sa', format: 21 } }));
  const before = new Set(fs.readdirSync(path.join(shared, 'versions')));
  await runInstaller(java, jar, shared, ['--installClient', shared], log);
  const after = fs.readdirSync(path.join(shared, 'versions')).filter(v => !before.has(v));
  const real = after.find(v => U.exists(path.join(shared, 'versions', v, v + '.json'))) || id;
  await mc.installGame(shared, real, progress);
  return real;
}

module.exports = { LOADERS, loaderVersions, supports, installLoader, cmpVer };
