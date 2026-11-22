'use strict';
// Вход через Microsoft прямо в лаунчере (без сайта и сервера):
//   Microsoft OAuth -> Xbox Live -> XSTS -> Minecraft Services -> профиль.
// Окно входа — официальная страница login.live.com внутри Electron; пароль лаунчер не видит,
// он получает только одноразовый код из адреса перенаправления.
// Client ID берётся из config.js (package.json -> "msClientId" или переменная SA_MS_CLIENT_ID).
const crypto = require('crypto');
const { UA } = require('./util');

const REDIRECT = 'https://login.live.com/oauth20_desktop.srf';
const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';
const AUTH = 'https://login.live.com/oauth20_authorize.srf';
const TOKEN = 'https://login.live.com/oauth20_token.srf';

let current = null;

// Понятные сообщения для кодов ошибок Xbox (XSTS)
const XERR = {
  2148916233: 'У этой учётной записи Microsoft нет профиля Xbox. Откройте minecraft.net, войдите этим аккаунтом и создайте профиль, затем повторите вход.',
  2148916235: 'Xbox Live недоступен в вашей стране или регионе.',
  2148916236: 'Для этой учётной записи нужно пройти проверку возраста на xbox.com.',
  2148916237: 'Для этой учётной записи нужно пройти проверку возраста на xbox.com.',
  2148916238: 'Это детский аккаунт. Добавьте его в семейную группу Microsoft и разрешите играть в Minecraft (account.microsoft.com/family).'
};

async function post(url, body, form) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
    signal: AbortSignal.timeout(25000)
  });
  let data = null; try { data = await r.json(); } catch (_) {}
  return { ok: r.ok, status: r.status, data: data || {} };
}

// Код или refresh-token Microsoft -> access/refresh token
async function msToken(cfg, params) {
  const r = await post(TOKEN, { client_id: cfg.msClientId, redirect_uri: REDIRECT, scope: SCOPE, ...params }, true);
  if (!r.ok || !r.data.access_token) {
    const e = new Error(r.data.error === 'invalid_grant' ? 'relogin' : 'Microsoft отклонил вход: ' + (r.data.error_description || r.data.error || 'HTTP ' + r.status));
    throw e;
  }
  return r.data;
}

// Microsoft access token -> Minecraft access token + профиль
async function minecraftChain(msAccess) {
  const xbl = await post('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: msAccess },
    RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT'
  });
  if (!xbl.ok || !xbl.data.Token) throw new Error('Xbox Live не ответил (HTTP ' + xbl.status + ')');
  const uhs = xbl.data.DisplayClaims.xui[0].uhs;

  const xsts = await post('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.data.Token] },
    RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT'
  });
  if (!xsts.ok || !xsts.data.Token) throw new Error(XERR[xsts.data.XErr] || 'XSTS отклонил вход (код ' + (xsts.data.XErr || xsts.status) + ')');

  const mc = await post('https://api.minecraftservices.com/authentication/login_with_xbox', { identityToken: `XBL3.0 x=${uhs};${xsts.data.Token}` });
  if (!mc.ok || !mc.data.access_token) {
    if (mc.status === 403) throw new Error('Minecraft Services отклонил вход (403). Если это повторяется — Mojang ограничил этот Client ID: укажите свой в package.json → msClientId.');
    throw new Error('Minecraft Services не ответил (HTTP ' + mc.status + ')');
  }

  const pr = await fetch('https://api.minecraftservices.com/minecraft/profile', { headers: { Authorization: 'Bearer ' + mc.data.access_token, 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
  if (pr.status === 404) throw new Error('nolicense');
  if (!pr.ok) throw new Error('Не удалось получить профиль Minecraft (HTTP ' + pr.status + ')');
  const prof = await pr.json();
  if (!prof.id || !prof.name) throw new Error('nolicense');
  const skin = (prof.skins || []).find(s => s.state === 'ACTIVE') || (prof.skins || [])[0];
  return {
    p: 'ms', id: prof.id, name: prof.name, skin: skin ? skin.url : null,
    accessToken: mc.data.access_token, expiresAt: Date.now() + (Number(mc.data.expires_in) || 86400) * 1000
  };
}

// Открывает окно входа Microsoft и возвращает одноразовый код
function askCode(cfg, BrowserWindow, parent) {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString('hex');
    const url = `${AUTH}?` + new URLSearchParams({ client_id: cfg.msClientId, response_type: 'code', redirect_uri: REDIRECT, scope: SCOPE, prompt: 'select_account', state }).toString();
    const w = new BrowserWindow({
      width: 520, height: 700, parent: parent || undefined, modal: false, autoHideMenuBar: true, title: 'Вход через Microsoft',
      webPreferences: { partition: 'sa-ms-' + state, contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    let done = false;
    const finish = (err, code) => { if (done) return; done = true; current = null; try { w.destroy(); } catch (_) {} err ? reject(err) : resolve(code); };
    current = { cancel: () => finish(new Error('cancelled')) };
    const check = (e, u) => {
      if (!u.startsWith(REDIRECT)) return;
      if (e && e.preventDefault) e.preventDefault();
      const q = new URL(u).searchParams;
      if (q.get('state') !== state) return finish(new Error('Неверный state'));
      if (q.get('error')) return finish(new Error('cancelled'));
      q.get('code') ? finish(null, q.get('code')) : finish(new Error('Microsoft не вернул код входа'));
    };
    w.webContents.on('will-redirect', check);
    w.webContents.on('will-navigate', check);
    w.webContents.on('did-navigate', (_e, u) => check(null, u));
    w.webContents.setWindowOpenHandler(({ url: u }) => { if (u.startsWith('https://')) w.loadURL(u); return { action: 'deny' }; });
    w.on('closed', () => finish(new Error('cancelled')));
    w.loadURL(url).catch(err => finish(err));
  });
}

async function login(cfg, BrowserWindow, parent) {
  if (current) current.cancel();
  const code = await askCode(cfg, BrowserWindow, parent);
  const t = await msToken(cfg, { grant_type: 'authorization_code', code });
  const acc = await minecraftChain(t.access_token);
  acc.refreshToken = t.refresh_token;
  return acc;
}
const cancel = () => { if (current) current.cancel(); };

// Обновляет токен, если он истекает в ближайшие 2 минуты (без повторного входа)
async function ensureFresh(cfg, store, acc) {
  if (acc.expiresAt && acc.expiresAt - Date.now() > 120000) return acc;
  if (!acc.refreshToken) throw new Error('relogin');
  try {
    const t = await msToken(cfg, { grant_type: 'refresh_token', refresh_token: acc.refreshToken });
    const n = await minecraftChain(t.access_token);
    if (n.id !== acc.id) throw new Error('relogin');
    const out = { ...acc, ...n, refreshToken: t.refresh_token || acc.refreshToken };
    store.saveAccount(out); return out;
  } catch (e) {
    if (e.message === 'relogin' || e.message === 'nolicense') throw e;
    if (acc.expiresAt && acc.expiresAt > Date.now()) return acc; // нет сети — работаем со старым токеном, пока он жив
    throw e;
  }
}
module.exports = { login, cancel, ensureFresh };
