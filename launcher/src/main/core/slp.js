'use strict';
// Server List Ping (Minecraft Java 1.7+): настоящий статус сервера — онлайн/офлайн, игроки, MOTD, задержка, иконка.
// Данные не выдумываются: если сервер не ответил, возвращается { online:false, error } без остальных полей.
// Иконка принимается только если это PNG 64×64 до 64 КБ (как в самой игре); всё остальное отбрасывается.
const net = require('net');
const dns = require('dns').promises;

const MAX_RESPONSE = 1024 * 1024;           // ответ больше 1 МБ — не сервер Minecraft
const MAX_ICON = 64 * 1024;
const TTL_OK = 60e3, TTL_FAIL = 20e3, MAX_CACHE = 100;
const cache = new Map();                    // 'host:port' -> { t, v }

// ---- varint ----
const wVarInt = n => { const o = []; n >>>= 0; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return Buffer.from(o); };
function rVarInt(buf, p) {                  // -> { v, n } или null, если данных ещё не хватает
  let v = 0, n = 0, b;
  do { if (p + n >= buf.length) return null; if (n >= 5) throw new Error('bad'); b = buf[p + n]; v |= (b & 0x7f) << (7 * n); n++; } while (b & 0x80);
  return { v: v >>> 0, n };
}
const wStr = s => { const b = Buffer.from(String(s), 'utf8'); return Buffer.concat([wVarInt(b.length), b]); };
const frame = data => Buffer.concat([wVarInt(data.length), data]);

// ---- адрес: «host», «host:25565», «[::1]:25565» ----
function parseAddress(addr) {
  const s = String(addr || '').trim();
  if (!/^[A-Za-z0-9.\-:\[\]_]{1,100}$/.test(s)) return null;
  let host = s, port = 0, m;
  if ((m = /^\[([0-9a-fA-F:.]+)\](?::(\d{1,5}))?$/.exec(s))) { host = m[1]; port = m[2] ? +m[2] : 0; }
  else if ((m = /^([^:]+):(\d{1,5})$/.exec(s))) { host = m[1]; port = +m[2]; }
  else if (s.includes(':')) return null;                                   // IPv6 без скобок — однозначно не разобрать
  if (!host || port > 65535 || (m && m[2] && port < 1)) return null;
  return { host, port };                                                    // port 0 = не указан (можно искать SRV)
}

// ---- разбор ответа ----
const strip = s => String(s).replace(/§[0-9a-fk-or]/gi, '');
function motdText(d) {                                                      // description: строка или компонент чата { text, extra:[…] }
  const walk = (c, depth) => {
    if (depth > 8 || c == null) return '';
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map(x => walk(x, depth + 1)).join('');
    if (typeof c === 'object') return (typeof c.text === 'string' ? c.text : '') + walk(c.extra, depth + 1);
    return '';
  };
  return strip(walk(d, 0)).replace(/\s*\n\s*/g, ' · ').replace(/\s+/g, ' ').trim().slice(0, 200);
}
function cleanIcon(fav) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(fav || '')); if (!m) return '';
  let b; try { b = Buffer.from(m[1].replace(/[\r\n]/g, ''), 'base64'); } catch (_) { return ''; }
  if (b.length < 33 || b.length > MAX_ICON || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) return '';
  if (b.readUInt32BE(16) !== 64 || b.readUInt32BE(20) !== 64) return '';     // игра принимает только 64×64
  return 'data:image/png;base64,' + b.toString('base64');
}
const num = (x, max = 1e7) => (Number.isFinite(+x) && +x >= 0 ? Math.min(Math.floor(+x), max) : null);
function parseStatus(json) {
  let j; try { j = JSON.parse(json); } catch (_) { throw new Error('bad'); }
  if (!j || typeof j !== 'object') throw new Error('bad');
  const pl = j.players || {}, ver = j.version || {};
  return { version: typeof ver.name === 'string' ? strip(ver.name).slice(0, 60) : '', protocol: num(ver.protocol, 1e6), players: { online: num(pl.online), max: num(pl.max) }, motd: motdText(j.description), icon: cleanIcon(j.favicon) };
}

// ---- сетевая часть ----
async function resolveTarget(host, port, srvTimeout = 2000) {
  if (port || net.isIP(host)) return { host, port: port || 25565 };
  try {
    const r = await Promise.race([dns.resolveSrv('_minecraft._tcp.' + host), new Promise((_, no) => setTimeout(() => no(new Error('t')), srvTimeout))]);
    if (r && r[0] && r[0].name && r[0].port) return { host: String(r[0].name).replace(/\.$/, ''), port: r[0].port };
  } catch (_) {}
  return { host, port: 25565 };
}
function query(host, port, hsHost, hsPort, timeout) {
  return new Promise(resolve => {
    let done = false, buf = Buffer.alloc(0), stage = 0, t0 = 0, ms = null, status = null; const sock = new net.Socket();
    const finish = r => { if (done) return; done = true; clearTimeout(timer); sock.destroy(); resolve(r); };
    const timer = setTimeout(() => finish(status ? { ok: true, status, ms } : { ok: false, error: 'timeout' }), timeout);
    sock.setNoDelay(true);
    sock.on('error', e => finish(status ? { ok: true, status, ms } : { ok: false, error: e.code === 'ECONNREFUSED' ? 'refused' : e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN' ? 'dns' : 'network' }));
    sock.on('close', () => finish(status ? { ok: true, status, ms } : { ok: false, error: 'closed' }));
    sock.on('connect', () => {
      const hs = Buffer.concat([wVarInt(0), wVarInt(0xffffffff), wStr(hsHost), Buffer.from([hsPort >> 8, hsPort & 255]), wVarInt(1)]);   // протокол -1: «версия неизвестна»
      t0 = Date.now(); sock.write(Buffer.concat([frame(hs), frame(wVarInt(0))]));
    });
    sock.on('data', d => {
      buf = Buffer.concat([buf, d]); if (buf.length > MAX_RESPONSE) return finish({ ok: false, error: 'bad' });
      try {
        for (;;) {
          const len = rVarInt(buf, 0); if (!len || buf.length < len.n + len.v) return;
          const pk = buf.subarray(len.n, len.n + len.v); buf = buf.subarray(len.n + len.v);
          const id = rVarInt(pk, 0); if (!id) throw new Error('bad');
          if (stage === 0 && id.v === 0) {
            const sl = rVarInt(pk, id.n); if (!sl || pk.length < id.n + sl.n + sl.v) throw new Error('bad');
            status = parseStatus(pk.toString('utf8', id.n + sl.n, id.n + sl.n + sl.v)); ms = Date.now() - t0; stage = 1;
            const payload = Buffer.alloc(8); payload.writeBigInt64BE(BigInt(Date.now())); t0 = Date.now();
            sock.write(frame(Buffer.concat([wVarInt(1), payload])));                           // ping → pong: точная задержка
          } else if (stage === 1 && id.v === 1) { ms = Date.now() - t0; return finish({ ok: true, status, ms }); }
          else throw new Error('bad');
        }
      } catch (_) { finish(status ? { ok: true, status, ms } : { ok: false, error: 'bad' }); }
    });
    sock.connect(port, host);
  });
}

// Один сервер. Результат кэшируется (успех — 60 с, ошибка — 20 с), чтобы не опрашивать сервер чаще, чем нужно.
async function ping(address, { timeout = 4000, force = false } = {}) {
  const a = parseAddress(address); if (!a) return { online: false, error: 'address' };
  const key = a.host.toLowerCase() + ':' + a.port, hit = cache.get(key);
  if (hit && !force && hit.t > Date.now()) return hit.v;
  const tg = await resolveTarget(a.host, a.port), r = await query(tg.host, tg.port, a.host, tg.port, timeout);
  const v = r.ok ? { online: true, ms: r.ms, ...r.status, at: Date.now() } : { online: false, error: r.error, at: Date.now() };
  cache.set(key, { t: Date.now() + (r.ok ? TTL_OK : TTL_FAIL), v });
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  return v;
}
// Несколько серверов параллельно (не больше 8 за раз). Ключ результата — исходная строка адреса.
async function many(addresses, o = {}) {
  const list = [...new Set((Array.isArray(addresses) ? addresses : []).map(String))].slice(0, 8), out = {};
  await Promise.all(list.map(async a => { out[a] = await ping(a, o).catch(() => ({ online: false, error: 'network' })); }));
  return out;
}
const clear = () => cache.clear();
module.exports = { ping, many, parseAddress, parseStatus, motdText, cleanIcon, clear, rVarInt, wVarInt };
