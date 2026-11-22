'use strict';
// authlib-injector — официальный способ запускать Minecraft с аккаунтами Ely.by (-javaagent:...=ely.by).
// Скачивается один раз с authlib-injector.yushi.moe, целостность проверяется по SHA-256 из latest.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const U = require('./util');

const LATEST = 'https://authlib-injector.yushi.moe/artifact/latest.json';
const err = k => new Error('err:' + k);

async function ensureInjector(shared, log) {
  const dir = path.join(shared, 'authlib-injector'); fs.mkdirSync(dir, { recursive: true });
  let meta = null;
  try { meta = await U.fetchJSON(LATEST, { timeout: 15000 }); } catch (_) {}
  try { const u = new URL(String(meta && meta.download_url)); if (u.protocol !== 'https:' || u.hostname !== 'authlib-injector.yushi.moe') meta = null; } catch (_) { meta = null; }
  const ver = meta ? String(meta.version || '').replace(/[^0-9A-Za-z._-]/g, '') : '';
  const sha = meta && meta.checksums ? String(meta.checksums.sha256 || '').toLowerCase() : '';
  if (!ver || !/^[0-9a-f]{64}$/.test(sha)) {        // нет сети или странный ответ: берём уже скачанную версию
    const have = fs.readdirSync(dir).filter(f => /^authlib-injector-[0-9A-Za-z._-]+\.jar$/.test(f)).sort().pop();
    if (have) return path.join(dir, have);
    throw err('elyInjector');
  }
  const dest = path.join(dir, `authlib-injector-${ver}.jar`);
  if (!U.exists(dest)) {
    const buf = await U.fetchBuf(meta.download_url);
    if (crypto.createHash('sha256').update(buf).digest('hex') !== sha) throw err('elyInjector');
    fs.writeFileSync(dest + '.part', buf); fs.renameSync(dest + '.part', dest);
    if (log) log('authlib-injector ' + ver + ' скачан');
  }
  return dest;
}
module.exports = { ensureInjector };
