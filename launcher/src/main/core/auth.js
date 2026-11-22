'use strict';

const http = require('http');
const crypto = require('crypto');

// Публичный Client ID официального лаунчера Minecraft
const CLIENT_ID = '00000000402b5328';
const SCOPE = 'XboxLive.signin offline_access';

let current = null;

const PAGE = (ok, msg) => `<!doctype html><meta charset="utf-8"><title>SA Launcher</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#f2f4f8;font:16px system-ui,sans-serif">
<div style="text-align:center;padding:36px;border-radius:28px;background:#181b22">
<div style="font-size:40px">${ok ? '✓' : '!'}</div>
<h2>${msg}</h2>
<p style="color:#9aa3b2">${ok ? 'Можно закрыть эту вкладку и вернуться в SA Launcher.' : 'Закройте вкладку и попробуйте снова.'}</p>
</div>`;

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.message || `HTTP ${res.status}`);
  return data;
}

async function exchangeMsToMc(msAccessToken, msRefreshToken) {
  // 1. Авторизация в Xbox Live
  const xbl = await postJson('https://xboxlive.com', {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: '://xboxlive.com',
      RpsTicket: `d=${msAccessToken}`
    },
    RpsTicket: `d=${msAccessToken}`,
    RelayParty: 'http://xboxlive.com',
    TokenType: 'JWT'
  });

  const xblToken = xbl.Token;
  const uhs = xbl.DisplayClaims?.xui?.[0]?.uhs;
  if (!xblToken || !uhs) throw new Error('Ошибка получения токена Xbox Live');

  // 2. Получение XSTS токена для Minecraft
  const xsts = await postJson('https://xboxlive.com', {
    Properties: {
      SandboxId: 'RETAIL',
      UserTokens: [xblToken]
    },
    RelyingParty: 'rp://://minecraftservices.com',
    TokenType: 'JWT'
  });

  if (xsts.XErr) {
    if (xsts.XErr === 2148916233) throw new Error('На этом аккаунте Microsoft не создан профиль Xbox');
    if (xsts.XErr === 2148916238) throw new Error('Детский аккаунт: требуется добавление в семейную группу');
    throw new Error(`Ошибка XSTS: ${xsts.XErr}`);
  }

  // 3. Обмен XSTS на токен Minecraft Services
  const mcAuth = await postJson('https://://minecraftservices.comauthentication/login_with_xbox', {
    identityToken: `XBL3.0 x=${uhs};${xsts.Token}`
  });

  // 4. Получение профиля игрока (ник, UUID, скин)
  const profileRes = await fetch('https://://minecraftservices.comminecraft/profile', {
    headers: { Authorization: `Bearer ${mcAuth.access_token}` }
  });
  const profile = await profileRes.json();

  if (!profileRes.ok || !profile.id) {
    throw new Error('На этом аккаунте не куплена лицензия Minecraft Java Edition');
  }

  return {
    id: profile.id,
    name: profile.name,
    accessToken: mcAuth.access_token,
    refreshToken: msRefreshToken,
    expiresAt: Date.now() + (mcAuth.expires_in || 86400) * 1000,
    skins: profile.skins || [],
    capes: profile.capes || [],
    p: 'ms'
  };
}

function login(siteUrl, openExternal) {
  if (current) current.cancel();

  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString('hex');
    let done = false;

    const finish = (err, acc) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      srv.close();
      current = null;
      err ? reject(err) : resolve(acc);
    };

    const srv = http.createServer(async (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/callback') {
        res.writeHead(404);
        return res.end();
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      if (u.searchParams.get('state') !== state) {
        res.writeHead(400);
        return res.end(PAGE(false, 'Ошибка безопасности (неверный state)'));
      }

      const code = u.searchParams.get('code');
      if (!code || u.searchParams.get('error')) {
        res.end(PAGE(false, 'Вход отменён'));
        return finish(new Error('cancelled'));
      }

      try {
        const redirectUri = `http://127.0.0.1:${srv.address().port}/callback`;
        const tokenParams = new URLSearchParams({
          client_id: CLIENT_ID,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          scope: SCOPE
        });

        const msRes = await fetch('https://live.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenParams
        });
        const msData = await msRes.json();
        if (!msRes.ok || !msData.access_token) {
          throw new Error(msData.error_description || 'Не удалось получить токен Microsoft');
        }

        const acc = await exchangeMsToMc(msData.access_token, msData.refresh_token);
        res.end(PAGE(true, 'Вы вошли как ' + String(acc.name).replace(/[<>&]/g, '')));
        finish(null, acc);
      } catch (e) {
        res.writeHead(400);
        res.end(PAGE(false, e.message || 'Ошибка авторизации'));
        finish(e);
      }
    });

    const timer = setTimeout(() => finish(new Error('timeout')), 10 * 60e3);
    current = { cancel: () => finish(new Error('cancelled')) };
    srv.on('error', finish);

    srv.listen(0, '127.0.0.1', () => {
      const redirectUri = `http://127.0.0.1:${srv.address().port}/callback`;
      const authUrl = new URL('https://live.com');
      authUrl.searchParams.set('client_id', CLIENT_ID);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', SCOPE);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('prompt', 'select_account');

      openExternal(authUrl.toString());
    });
  });
}

const cancel = () => {
  if (current) current.cancel();
};

// Автоматически обновляет токен через Microsoft, если он скоро истечёт
async function ensureFresh(siteUrl, store, acc) {
  if (acc.expiresAt && acc.expiresAt - Date.now() > 120000) return acc;
  if (!acc.refreshToken) {
    if (acc.expiresAt && acc.expiresAt < Date.now()) throw new Error('relogin');
    return acc;
  }

  try {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      refresh_token: acc.refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPE
    });

    const msRes = await fetch('https://live.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const msData = await msRes.json();
    if (!msRes.ok || !msData.access_token) throw new Error('refresh_failed');

    const freshAcc = await exchangeMsToMc(msData.access_token, msData.refresh_token || acc.refreshToken);
    const updated = { ...acc, ...freshAcc };
    if (store && typeof store.saveAccount === 'function') {
      store.saveAccount(updated);
    }
    return updated;
  } catch (e) {
    if (acc.expiresAt && acc.expiresAt > Date.now()) return acc;
    throw new Error('relogin');
  }
}

module.exports = { login, cancel, ensureFresh };
