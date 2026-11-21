'use strict';
// Скачивание Java Runtime от Mojang (тот же, что использует официальный лаунчер).
const fs = require('fs');
const path = require('path');
const { fetchJSON, download, pool } = require('./util');

const ALL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';

function platformKey() {
  const a = process.arch;
  if (process.platform === 'win32') return a === 'arm64' ? 'windows-arm64' : a === 'ia32' ? 'windows-x86' : 'windows-x64';
  if (process.platform === 'darwin') return a === 'arm64' ? 'mac-os-arm64' : 'mac-os';
  return a === 'ia32' ? 'linux-i386' : 'linux';
}
function javaBin(root) {
  const c = process.platform === 'win32' ? ['bin/javaw.exe', 'bin/java.exe'] : process.platform === 'darwin' ? ['jre.bundle/Contents/Home/bin/java', 'bin/java'] : ['bin/java'];
  return c.map(x => path.join(root, x)).find(x => fs.existsSync(x));
}

// component: "java-runtime-delta" и т.п. (берётся из version.json -> javaVersion.component)
async function ensureJava(shared, component = 'java-runtime-gamma', progress = () => {}) {
  let root = path.join(shared, 'runtime', component);
  let ok = path.join(root, '.ok');
  if (fs.existsSync(ok) && javaBin(root)) return javaBin(root);
  progress('Java', 0);
  const all = await fetchJSON(ALL);
  const plat = all[platformKey()] || {};
  // Если Mojang указал runtime, которого нет в списке (новая версия Java), берём самый новый из доступных — Java обратно совместима
  const RANK = ['jre-legacy', 'java-runtime-alpha', 'java-runtime-beta', 'java-runtime-gamma', 'java-runtime-gamma-snapshot', 'java-runtime-delta', 'java-runtime-epsilon', 'java-runtime-zeta', 'java-runtime-eta'];
  if (!(plat[component] || [])[0]) { const best = RANK.filter(c => (plat[c] || [])[0]).pop(); if (best && RANK.indexOf(best) > RANK.indexOf(component)) component = best; }
  const entry = plat[component] || [];
  root = path.join(shared, 'runtime', component); ok = path.join(root, '.ok');
  if (fs.existsSync(ok) && javaBin(root)) return javaBin(root);
  if (!entry[0]) throw new Error('err:noJava|' + component + '|' + platformKey());
  const mf = await fetchJSON(entry[0].manifest.url);
  const files = Object.entries(mf.files).filter(([, f]) => f.type === 'file');
  let done = 0;
  for (const [p, f] of Object.entries(mf.files)) if (f.type === 'directory') fs.mkdirSync(path.join(root, p), { recursive: true });
  await pool(files, 12, async ([p, f]) => {
    const dest = path.join(root, p);
    await download(f.downloads.raw.url, dest, { sha1: f.downloads.raw.sha1, size: f.downloads.raw.size });
    if (f.executable && process.platform !== 'win32') fs.chmodSync(dest, 0o755);
    progress('Java', ++done / files.length);
  });
  fs.writeFileSync(ok, entry[0].version.name);
  return javaBin(root);
}

module.exports = { ensureJava };
