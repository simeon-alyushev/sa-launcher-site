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

// ---- ZIP (запись, для экспорта .mrpack) ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function writeZip(entries) {   // entries: [{ name, data: Buffer }]
  const parts = [], cd = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'), raw = e.data, def = zlib.deflateRawSync(raw), useDef = def.length < raw.length, body = useDef ? def : raw, crc = crc32(raw);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(useDef ? 8 : 0, 8); h.writeUInt32LE(0x21000000 >>> 0, 10);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(name.length, 26);
    parts.push(h, name, body);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(useDef ? 8 : 0, 10); c.writeUInt32LE(0x21000000 >>> 0, 12);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    cd.push(c, name); off += 30 + name.length + body.length;
  }
  const cdBuf = Buffer.concat(cd), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdBuf, end]);
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9а-яёіїєґ]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'instance';
const totalMemMB = () => Math.floor(os.totalmem() / 1048576);
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {} }

module.exports = { VERSION, UA, OS, ARCH, sleep, fetchJSON, fetchBuf, sha1, sha1File, exists, download, pool, readZip, extractZip, writeZip, slug, totalMemMB, rmrf };
