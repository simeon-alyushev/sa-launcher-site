'use strict';
// Настройки и аккаунты. Токены шифруются через safeStorage (DPAPI / Keychain / libsecret), если доступно.
const fs = require('fs');
const path = require('path');

let safeStorage = null; try { ({ safeStorage } = require('electron')); } catch (_) {}
const DEFAULTS = { lang: null, theme: 'dark', accent: '#4ade80', customBg: '#12141a', customCard: '#1b1f29', memory: 4096, jvmArgs: '', javaPath: '', selected: null, closeOnLaunch: false };

class Store {
  constructor(dir) { this.file = path.join(dir, 'settings.json'); this.data = { settings: { ...DEFAULTS }, accounts: [] }; fs.mkdirSync(dir, { recursive: true }); try { const d = JSON.parse(fs.readFileSync(this.file, 'utf8')); this.data = { settings: { ...DEFAULTS, ...d.settings }, accounts: d.accounts || [] }; } catch (_) {} }
  flush() { fs.writeFileSync(this.file, JSON.stringify(this.data, null, 1)); }
  get settings() { return this.data.settings; }
  set(patch) { Object.assign(this.data.settings, patch); this.flush(); return this.data.settings; }
  seal(o) { const s = JSON.stringify(o); return safeStorage && safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(s).toString('base64') : 'raw:' + Buffer.from(s).toString('base64'); }
  unseal(s) { try { const [k, v] = [s.slice(0, 3), s.slice(4)]; const b = Buffer.from(v, 'base64'); return JSON.parse(k === 'enc' ? safeStorage.decryptString(b) : b.toString()); } catch (_) { return {}; } }
  accounts() { return this.data.accounts.map(a => ({ p: a.p, id: a.id, name: a.name, skin: a.skin, expiresAt: a.expiresAt })); }
  account(id) { const a = this.data.accounts.find(x => x.id === id); return a ? { ...a, ...this.unseal(a.sec) } : null; }
  saveAccount(acc) {
    const rec = { p: acc.p, id: acc.id, name: acc.name, skin: acc.skin, expiresAt: acc.expiresAt, sec: this.seal({ accessToken: acc.accessToken, refreshToken: acc.refreshToken }) };
    const i = this.data.accounts.findIndex(x => x.id === acc.id);
    if (i >= 0) this.data.accounts[i] = rec; else this.data.accounts.push(rec);
    if (!this.data.settings.selected) this.data.settings.selected = acc.id;
    this.flush();
  }
  removeAccount(id) { this.data.accounts = this.data.accounts.filter(a => a.id !== id); if (this.data.settings.selected === id) this.data.settings.selected = (this.data.accounts[0] || {}).id || null; this.flush(); }
}
module.exports = { Store, DEFAULTS };
