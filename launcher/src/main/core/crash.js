'use strict';
// Анализ вылетов Minecraft: ищем причину в логе / crash-report и возвращаем список проблем.
const fs = require('fs');
const U = require('./util');

// id модов, лежащих в jar (Fabric / Quilt / Forge / NeoForge)
function jarMods(file) {
  try {
    const z = U.readZip(fs.readFileSync(file)); const out = [];
    let b;
    if ((b = z.read('fabric.mod.json'))) { const j = JSON.parse(b.toString('utf8').replace(/^﻿/, '')); out.push({ id: j.id, version: j.version, name: j.name }); }
    if ((b = z.read('quilt.mod.json'))) { const j = JSON.parse(b.toString('utf8')).quilt_loader || {}; out.push({ id: j.id, version: j.version, name: (j.metadata || {}).name }); }
    for (const n of ['META-INF/neoforge.mods.toml', 'META-INF/mods.toml']) if ((b = z.read(n))) {
      const t = b.toString('utf8'); const ids = [...t.matchAll(/^\s*modId\s*=\s*"([^"]+)"/gm)].map(m => m[1]);
      const ver = (t.match(/^\s*version\s*=\s*"([^"$]+)"/m) || [])[1];
      ids.slice(0, 1).forEach(id => out.push({ id, version: ver }));
    }
    return out.filter(m => m.id);
  } catch (_) { return []; }
}

const SKIP = new Set(['minecraft', 'java', 'fabricloader', 'fabric-loader', 'quilt_loader', 'quilt-loader', 'forge', 'neoforge', 'fml', 'javafml', 'mixin', 'fabric-api-base']);
const LOADER_IDS = new Set(['fabricloader', 'fabric-loader', 'quilt_loader', 'quilt-loader']);
const clean = s => String(s || '').trim().toLowerCase();

function analyze(text) {
  const P = [];
  const add = p => { p.id = clean(p.id); if (!p.id || P.some(x => x.type === p.type && x.id === p.id)) return; P.push(p); };

  for (const line of text.split(/\r?\n/)) {
    // Fabric / Quilt: «Mod 'X' (x) 1.0 requires version 0.5 or later of sodium, which is missing!»
    if (/ requires /i.test(line) && /(which is missing|wrong version is present|is not present)/i.test(line)) {
      const by = (line.match(/Mod '[^']*' \(([^)]+)\)/) || [])[1];
      const m = line.match(/ of (?:mod )?(?:'([^']*)'|"?([^\s,(]+))(?: \(([^)]+)\))?,? /i);
      const target = clean(m && (m[3] || m[2] || m[1]));
      if (!target) continue;
      if (target === 'minecraft') { if (by) add({ type: 'wrongmc', id: by }); }
      else if (LOADER_IDS.has(target)) add({ type: 'loader', id: 'loader' });
      else if (target === 'java') add({ type: 'java', id: 'java' });
      else add({ type: /missing|not present/i.test(line) ? 'missing' : 'wrong', id: target, by });
    }
    // Forge / NeoForge
    const f = line.match(/Mod ID: '([^']+)', Requested by: '([^']+)'[^\n]*?Actual version: '([^']*)'/);
    if (f && !SKIP.has(clean(f[1]))) add({ type: /MISSING/i.test(f[3]) ? 'missing' : 'wrong', id: f[1], by: f[2] });
    // Mixin
    const mx = line.match(/(?:Mixin|mixin)[^\n]*?from mod ([a-z0-9_.\-]+)/i) || line.match(/\[([a-z0-9_.\-]+)\.mixins?\.json[^\]]*\][^\n]*?(?:failed|Error)/i);
    if (mx) add({ type: 'suspect', id: mx[1] });
  }
  // «Suspected Mods» в crash-report
  const sm = text.match(/Suspected Mods?:\s*\n((?:[ \t]+.+\n?)+)/);
  if (sm) for (const l of sm[1].split('\n')) { const m = l.match(/\(([a-z0-9_.\-]+)\)/i); if (m && !SKIP.has(clean(m[1]))) add({ type: 'suspect', id: m[1] }); }
  if (/duplicate (mod|mods)|Duplicate mod/i.test(text)) add({ type: 'dup', id: 'dup' });
  if (/OutOfMemoryError|GC overhead limit|Java heap space/.test(text)) add({ type: 'oom', id: 'oom' });
  if (/Could not reserve enough space|Invalid maximum heap size|Could not create the Java Virtual Machine/.test(text)) add({ type: 'xmx', id: 'xmx' });
  if (/UnsupportedClassVersionError/.test(text)) add({ type: 'java', id: 'java' });
  return P.filter(p => !SKIP.has(p.id) || ['loader', 'java'].includes(p.type));
}

module.exports = { analyze, jarMods, SKIP };
