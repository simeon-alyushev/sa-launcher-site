'use strict';
// Минимальный чтение NBT (servers.dat — без сжатия, level.dat — gzip).
const zlib = require('zlib');
function parse(buf) {
  let p = 0;
  const str = () => { const n = buf.readUInt16BE(p); p += 2; const s = buf.toString('utf8', p, p + n); p += n; return s; };
  const pay = t => {
    switch (t) {
      case 1: return buf.readInt8(p++);
      case 2: { const v = buf.readInt16BE(p); p += 2; return v; }
      case 3: { const v = buf.readInt32BE(p); p += 4; return v; }
      case 4: { const v = Number(buf.readBigInt64BE(p)); p += 8; return v; }
      case 5: { const v = buf.readFloatBE(p); p += 4; return v; }
      case 6: { const v = buf.readDoubleBE(p); p += 8; return v; }
      case 7: { const n = buf.readInt32BE(p); p += 4 + n; return null; }
      case 8: return str();
      case 9: { const it = buf[p++], n = buf.readInt32BE(p); p += 4; const a = []; for (let i = 0; i < n; i++) a.push(pay(it)); return a; }
      case 10: { const o = {}; for (;;) { const tt = buf[p++]; if (!tt) break; const k = str(); o[k] = pay(tt); } return o; }
      case 11: { const n = buf.readInt32BE(p); p += 4 + 4 * n; return null; }
      case 12: { const n = buf.readInt32BE(p); p += 4 + 8 * n; return null; }
      default: throw new Error('nbt');
    }
  };
  const t = buf[p++]; str(); return pay(t);
}
const gz = buf => parse(buf[0] === 0x1f ? zlib.gunzipSync(buf) : buf);
module.exports = { parse, gz };
