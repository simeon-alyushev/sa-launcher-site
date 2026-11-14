'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');

const VERSION = require('../../../package.json').version;
const UA = `SALauncher/${VERSION}`;
const OS = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
const ARCH = process.arch === 'ia32' ? 'x86' : 'x64';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, o = {}) {
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        method: o.method, headers: { 'User-Agent': UA, Accept: 'application/json', ...(o.body ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) },
        body: o.body ? JSON.stringify(o.body) : undefined, signal: AbortSignal.timeout(o.timeout || 25000)
      });
      if (!r.ok) { const e = new Error(`HTTP ${r.status} ${url}`); e.status = r.status; if (r.status < 500 && r.status !== 429) throw e; err = e; await sleep(600 * (i + 1)); continue; }
      return await r.json();
    } catch (e) { err = e; if (e.status && e.status < 500 && e.status !== 429) throw e; await sleep(600 * (i + 1)); }
  }
  throw err;
}
async function fetchBuf(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
const sha1 = buf => crypto.createHash('sha1').update(buf).digest('hex');
function sha1File(p) {
  return new Promise((ok, no) => { const h = crypto.createHash('sha1'); fs.createReadStream(p).on('data', d => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', no); });
}
const exists = p => { try { fs.accessSync(p); return true; } catch (_) { return false; } };

// Скачивает файл (если его нет или не совпадает размер/хэш). Пишет через .part.
async function download(url, dest, { sha1: want, size } = {}) {
  try { const st = fs.statSync(dest); if ((!size || st.size === size) && (!want || size || (await sha1File(dest)) === want)) return false; } catch (_) {}
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let err;
  for (let i = 0; i < 4; i++) {
    try {
      const buf = await fetchBuf(url);
      if (want && sha1(buf) !== want) throw new Error('sha1 mismatch ' + url);
      fs.writeFileSync(dest + '.part', buf); fs.renameSync(dest + '.part', dest);
      return true;
    } catch (e) { err = e; await sleep(500 * (i + 1)); }
  }
  throw err;
}
async function pool(items, limit, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

// ---- ZIP (чтение/распаковка без зависимостей) ----
function readZip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = [];
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    out.push({ name: buf.toString('utf8', p + 46, p + 46 + nl), method: buf.readUInt16LE(p + 10), csize: buf.readUInt32LE(p + 20), lho: buf.readUInt32LE(p + 42) });
    p += 46 + nl + el + cl;
  }
  const data = en => {
    const s = en.lho + 30 + buf.readUInt16LE(en.lho + 26) + buf.readUInt16LE(en.lho + 28);
    const raw = buf.subarray(s, s + en.csize);
    return en.method === 0 ? raw : zlib.inflateRawSync(raw);
  };
  return { entries: out, data, read: name => { const en = out.find(x => x.name === name); return en ? data(en) : null; } };
}
function extractZip(buf, dest, filter = () => true, strip = '') {
  const z = readZip(buf);
  for (const en of z.entries) {
    if (en.name.endsWith('/') || !filter(en.name)) continue;
    const rel = strip && en.name.startsWith(strip) ? en.name.slice(strip.length) : en.name;
    const f = path.resolve(dest, rel);
    if (!f.startsWith(path.resolve(dest) + path.sep)) continue; // zip-slip
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, z.data(en));
  }
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9а-яёіїєґ]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'instance';
const totalMemMB = () => Math.floor(os.totalmem() / 1048576);
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {} }

module.exports = { VERSION, UA, OS, ARCH, sleep, fetchJSON, fetchBuf, sha1, sha1File, exists, download, pool, readZip, extractZip, slug, totalMemMB, rmrf };
