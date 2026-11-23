'use strict';
// Статическая проверка совместимости модов с версией Minecraft — без запуска игры.
// Читает fabric.mod.json / quilt.mod.json / mods.toml внутри jar и сверяет:
//   • для какой версии Minecraft сделан мод (wrongmc);
//   • есть ли нужные моды-зависимости (missing; только Fabric/Quilt);
//   • нет ли двух копий одного мода (dup).
// Ничего не меняет на диске — только возвращает список проблем. Чинит их Instances.smartRepair().
const fs = require('fs');
const path = require('path');
const U = require('./util');

// ---- версии Minecraft: «1.20.1», «26.1», «1.21.4-pre1»… ----
function parseVer(v) {
  const s = String(v == null ? '' : v).trim().replace(/^v/i, '');
  const m = s.match(/^(\d+(?:\.\d+)*)(.*)$/);
  if (!m) return null;
  return { n: m[1].split('.').map(Number), pre: /^[-+]?(pre|rc|snapshot|alpha|beta)/i.test(m[2]) || /^[-+]\d*w\d/i.test(m[2]) };
}
function cmpVer(a, b) {
  const x = parseVer(a), y = parseVer(b); if (!x || !y) return 0;
  for (let i = 0; i < Math.max(x.n.length, y.n.length); i++) { const d = (x.n[i] || 0) - (y.n[i] || 0); if (d) return d < 0 ? -1 : 1; }
  if (x.pre !== y.pre) return x.pre ? -1 : 1;
  return 0;
}

// ---- Fabric / Quilt: предикаты версий («>=1.20 <1.21», «1.20.x», «~1.20.1», «*», массив = ИЛИ) ----
function matchOne(pred, mc) {
  const p = String(pred).trim(); if (!p || p === '*') return true;
  for (const part of p.split(/\s+/)) {
    let m;
    if (part === '*') continue;
    if ((m = part.match(/^(>=|<=|>|<|=)?\s*(.+)$/))) {
      const op = m[1] || '=', v = m[2];
      if (/[xX*]$/.test(v) && !m[1]) {                                  // «1.20.x»
        const base = v.replace(/\.?[xX*]$/, ''), a = parseVer(base), t = parseVer(mc); if (!a || !t) continue;
        for (let i = 0; i < a.n.length; i++) if ((t.n[i] || 0) !== a.n[i]) return false;
        continue;
      }
      if (/^[\^~]/.test(part)) {                                         // ^1.20 → >=1.20 <2 ; ~1.20 → >=1.20 <1.21
        const a = parseVer(part.slice(1)); if (!a) continue;
        const hi = part[0] === '^' ? [a.n[0] + 1] : [a.n[0], (a.n[1] || 0) + 1];
        if (cmpVer(mc, a.n.join('.')) < 0 || cmpVer(mc, hi.join('.')) >= 0) return false; continue;
      }
      if (!parseVer(v) || !parseVer(mc)) continue;                       // непонятное (снапшоты и т.п.) — не блокируем
      const c = cmpVer(mc, v);
      if (op === '>=' && c < 0) return false; if (op === '<=' && c > 0) return false;
      if (op === '>' && c <= 0) return false; if (op === '<' && c >= 0) return false; if (op === '=' && c !== 0) return false;
    }
  }
  return true;
}
function fabricMatch(pred, mc) {
  if (pred == null) return true;
  const list = Array.isArray(pred) ? pred : [pred]; if (!list.length) return true;
  return list.some(x => matchOne(x, mc));
}
// ---- Forge/NeoForge: диапазоны Maven «[1.20,1.21)», «[1.16.5]», «(,1.20]» ----
function forgeMatch(range, mc) {
  const r = String(range || '').trim(); if (!r) return true;
  const sets = r.match(/[\[(][^\])]*[\])]/g);
  if (!sets) return true;                                                 // «1.20.1» без скобок — «рекомендуемая», не строгая
  return sets.some(s => {
    const lo = s[0] === '[', hi = s[s.length - 1] === ']', parts = s.slice(1, -1).split(',').map(x => x.trim());
    if (parts.length === 1) return cmpVer(mc, parts[0]) === 0;
    const [a, b] = parts;
    if (a && (lo ? cmpVer(mc, a) < 0 : cmpVer(mc, a) <= 0)) return false;
    if (b && (hi ? cmpVer(mc, b) > 0 : cmpVer(mc, b) >= 0)) return false;
    return true;
  });
}

// ---- чтение jar ----
const SYSTEM = new Set(['minecraft', 'java', 'fabricloader', 'fabric-loader', 'quilt_loader', 'quilt-loader', 'forge', 'neoforge', 'fml', 'javafml', 'mixin']);
function readJar(file) {
  const out = { mods: [], provides: [] };
  let z; try { z = U.readZip(fs.readFileSync(file)); } catch (_) { return out; }
  let b;
  try {
    if ((b = z.read('fabric.mod.json'))) {
      const j = JSON.parse(b.toString('utf8').replace(/^\uFEFF/, '')), d = j.depends || {};
      out.mods.push({ kind: 'fabric', id: String(j.id || '').toLowerCase(), version: j.version, name: j.name || j.id, mc: d.minecraft == null ? null : d.minecraft,
        deps: Object.keys(d).filter(k => !SYSTEM.has(k.toLowerCase())).map(k => ({ id: k.toLowerCase(), pred: d[k] })) });
      for (const p of j.provides || []) out.provides.push(String(typeof p === 'string' ? p : p && p.id).toLowerCase());
    } else if ((b = z.read('quilt.mod.json'))) {
      const q = JSON.parse(b.toString('utf8').replace(/^\uFEFF/, '')), l = q.quilt_loader || {}, deps = (l.depends || []).map(x => typeof x === 'string' ? { id: x, versions: '*' } : x);
      const mcd = deps.find(x => x && String(x.id).toLowerCase() === 'minecraft');
      out.mods.push({ kind: 'quilt', id: String(l.id || '').toLowerCase(), version: l.version, name: (l.metadata || {}).name || l.id, mc: mcd ? (mcd.versions == null ? null : mcd.versions) : null,
        deps: deps.filter(x => x && x.id && !SYSTEM.has(String(x.id).toLowerCase()) && !x.optional).map(x => ({ id: String(x.id).toLowerCase(), pred: x.versions == null ? '*' : x.versions })) });
      for (const p of l.provides || []) out.provides.push(String(typeof p === 'string' ? p : p && p.id).toLowerCase());
    }
    for (const n of ['META-INF/neoforge.mods.toml', 'META-INF/mods.toml']) if ((b = z.read(n))) {
      const t = b.toString('utf8'), id = ((t.match(/^\s*modId\s*=\s*"([^"]+)"/m)) || [])[1];
      if (!id) continue;
      // блок зависимости от minecraft: [[dependencies.<id>]] … modId="minecraft" … versionRange="…"
      let mcRange = null;
      for (const blk of t.split(/\[\[dependencies\.[^\]]+\]\]/).slice(1)) {
        if (/modId\s*=\s*"minecraft"/.test(blk)) { const r = blk.match(/versionRange\s*=\s*"([^"]*)"/); if (r) mcRange = r[1]; break; }
      }
      out.mods.push({ kind: 'forge', id: id.toLowerCase(), version: ((t.match(/^\s*version\s*=\s*"([^"$]+)"/m)) || [])[1], name: id, mc: mcRange, deps: [] });
      break;
    }
  } catch (_) {}
  return out;
}

// Проверка папки mods. Возвращает { problems, mods }.
//   problems: { type:'wrongmc'|'missing'|'dup', id, file, name, need, by, byFile }
function scan(dir, mcv, loader) {
  const problems = [], files = [];
  let names = []; try { names = fs.readdirSync(dir).filter(f => /\.jar$/i.test(f)); } catch (_) {}   // отключённые (.disabled) не проверяем
  for (const f of names) files.push({ file: f, ...readJar(path.join(dir, f)) });
  const have = new Map(), provided = new Set(); let hasFabricApi = false;
  for (const x of files) for (const m of x.mods) {
    (have.get(m.id) || have.set(m.id, []).get(m.id)).push({ file: x.file, version: m.version }); provided.add(m.id);
    if (m.id === 'fabric-api') hasFabricApi = true;
  }
  for (const x of files) for (const p of x.provides) provided.add(p);
  for (const x of files) for (const m of x.mods) {
    const ok = m.kind === 'forge' ? forgeMatch(m.mc, mcv) : fabricMatch(m.mc, mcv);
    if (!ok) { problems.push({ type: 'wrongmc', id: m.id, file: x.file, name: m.name, need: Array.isArray(m.mc) ? m.mc.join(' | ') : String(m.mc) }); continue; }
    if (m.kind === 'fabric' || m.kind === 'quilt') for (const d of m.deps) {
      if (provided.has(d.id)) continue;
      if (hasFabricApi && /^fabric-/.test(d.id)) continue;               // модули Fabric API лежат внутри fabric-api.jar
      if (!problems.some(p => p.type === 'missing' && p.id === d.id && p.byFile === x.file)) problems.push({ type: 'missing', id: d.id, by: m.id, byFile: x.file, name: m.name });
    }
  }
  for (const [id, arr] of have) {
    const uniq = [...new Set(arr.map(a => a.file))];
    if (uniq.length > 1 && !SYSTEM.has(id)) problems.push({ type: 'dup', id, files: uniq });
  }
  return { problems, mods: files };
}

module.exports = { cmpVer, fabricMatch, forgeMatch, readJar, scan, SYSTEM };
