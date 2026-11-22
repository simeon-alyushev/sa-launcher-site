'use strict';
// Discord Rich Presence без зависимостей: локальный IPC (named pipe / unix socket).
const net = require('net');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

class Discord {
  constructor(clientId) { this.id = clientId; this.sock = null; this.ready = false; this.pending = null; this.connecting = false; this.enabled = !!clientId; }
  frame(op, data) { const b = Buffer.from(JSON.stringify(data)); const h = Buffer.alloc(8); h.writeInt32LE(op, 0); h.writeInt32LE(b.length, 4); return Buffer.concat([h, b]); }
  paths(n) {
    if (process.platform === 'win32') return [`\\\\?\\pipe\\discord-ipc-${n}`];
    const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
    return [path.join(base, `discord-ipc-${n}`), path.join(base, 'app', 'com.discordapp.Discord', `discord-ipc-${n}`), path.join(base, 'snap.discord', `discord-ipc-${n}`)];
  }
  tryConnect(n, paths, done) {
    if (n > 9) return done(null);
    const list = this.paths(n); let i = 0;
    const next = () => { if (i >= list.length) return this.tryConnect(n + 1, paths, done); const s = net.connect(list[i++]); s.once('connect', () => done(s)); s.once('error', () => { s.destroy(); next(); }); };
    next();
  }
  connect() {
    if (!this.enabled || this.connecting || this.sock) return;
    this.connecting = true;
    this.tryConnect(0, null, s => {
      this.connecting = false; if (!s) return;
      this.sock = s; s.unref && s.unref(); let buf = Buffer.alloc(0);
      s.on('data', d => {
        buf = Buffer.concat([buf, d]);
        while (buf.length >= 8) {
          const len = buf.readInt32LE(4); if (buf.length < 8 + len) break;
          let msg = {}; try { msg = JSON.parse(buf.subarray(8, 8 + len).toString()); } catch (_) {}
          buf = buf.subarray(8 + len);
          if (msg.evt === 'READY') { this.ready = true; this.flush(); }
        }
      });
      const drop = () => { this.sock = null; this.ready = false; };
      s.on('close', drop); s.on('error', drop);
      s.write(this.frame(0, { v: 1, client_id: this.id }));
    });
  }
  flush() { if (this.ready && this.sock && this.pending !== null) { this.send(this.pending.activity); this.pending = null; } }
  send(activity) { try { this.sock.write(this.frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: activity || null }, nonce: crypto.randomUUID() })); } catch (_) {} }
  set(activity) { if (!this.enabled) return; this.pending = { activity }; if (this.ready) this.flush(); else this.connect(); }
  clear() { if (this.ready) this.send(null); this.pending = null; }
  close() { try { if (this.sock) this.sock.destroy(); } catch (_) {} this.sock = null; this.ready = false; }
}
module.exports = { Discord };
