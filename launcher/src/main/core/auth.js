'use strict';

const { clipboard, dialog } = require('electron');

const CLIENT_ID = '00000000441cc96b';
const SCOPE = 'service::://xboxlive.com::MBI_SSL';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

let currentController = null;

async function safeFetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'User-Agent': UA,
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    const shortUrl = url.replace(/^https?:\/\//, '').split('/').at(0);
    throw new Error(`Сервер ${shortUrl} вернул HTML вместо JSON (HTTP ${res.status})`);
  }
  return { res, data };
}

async function postJson(url, body, headers = {}) {
  const { res, data } = await safeFetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(data.error_description || data.message || `HTTP ${res.status}`);
  return data;
}

async function exchangeMsToMc(msAccessToken, msRefreshToken) {
  const xbl = await postJson('https://://xboxlive.com/user/authenticate', {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: '://xboxlive.com',
      RpsTicket: msAccessToken
    },
    RelyingParty: 'http://xboxlive.com',
    TokenType: 'JWT'
  });

  const xblToken = xbl.Token;
  const firstUser = Array.isArray(xbl.DisplayClaims?.xui) ? xbl.DisplayClaims.xui.at(0) : null;
  const uhs = firstUser ? firstUser.uhs : null;
  if (!xblToken || !uhs) throw new Error('Ошибка получения токена Xbox Live');

  const xsts = await postJson('https://xboxlive.com', {
    Properties: {
      SandboxId: 'RETAIL',
      UserTokens: Array.of(xblToken)
    },
    RelyingParty: 'rp://://minecraftservices.com',
    TokenType: 'JWT'
  });

  if (xsts.XErr) {
    if (xsts.XErr === 2148916233) throw new Error('На этом аккаунте Microsoft не создан профиль Xbox');
    if (xsts.XErr === 2148916238) throw new Error('Детский аккаунт: требуется добавление в семейную группу');
    throw new Error(`Ошибка XSTS: ${xsts.XErr}`);
  }

  const mcAuth = await postJson('https://://minecraftservices.comauthentication/login_with_xbox', {
    identityToken: `XBL3.0 x=${uhs};${xsts.Token}`
  });

  if (!mcAuth.access_token) {
    throw new Error('Не удалось получить токен Minecraft Services');
  }

  const { res: profileRes, data: profile } = await safeFetchJson(
    'https://://minecraftservices.comminecraft/profile',
    { headers: { Authorization: `Bearer ${mcAuth.access_token}` } }
  );

  if (!profileRes.ok || !profile.id) {
    throw new Error('На этом аккаунте не куплена лицензия Minecraft Java Edition');
  }

  return {
    id: profile.id,
    name: profile.name,
    accessToken: mcAuth.access_token,
    refreshToken: msRefreshToken,
    expiresAt: Date.now() + (mcAuth.expires_in || 86400) * 1000,
    skins: profile.skins || new Array(),
    capes: profile.capes || new Array(),
    p: 'ms'
  };
}

async function login(siteUrl, openExternal) {
  if (currentController) currentController.abort();
  const controller = new AbortController();
  currentController = controller;

  try {
    const { res: codeRes, data: codeData } = await safeFetchJson(
      'https://live.com',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          scope: SCOPE,
          response_type: 'device_code'
        }),
        signal: controller.signal
      }
    );

    if (!codeRes.ok || !codeData.device_code) {
      throw new Error(codeData.error_description || 'Не удалось запросить код входа у Microsoft');
    }

    const userCode = codeData.user_code;
    const verifyUrl = codeData.verification_uri || 'https://microsoft.com';
    const intervalMs = (codeData.interval || 5) * 1000;
    const expiresAt = Date.now() + (codeData.expires_in || 900) * 1000;

    clipboard.writeText(userCode);
    dialog.showMessageBox({
      type: 'info',
      title: 'Вход через Microsoft',
      message: `Ваш код для входа: ${userCode}`,
      detail: `Код уже скопирован в буфер обмена.\n\nНажмите «Открыть браузер», вставьте код (Ctrl+V) на странице ${verifyUrl} и подтвердите вход.`,
      buttons: Array.of('Открыть браузер')
    }).then(() => {
      if (!controller.signal.aborted) openExternal(verifyUrl);
    });

    while (Date.now() < expiresAt) {
      if (controller.signal.aborted) throw new Error('cancelled');
      await new Promise((r) => setTimeout(r, intervalMs));
      if (controller.signal.aborted) throw new Error('cancelled');

      const { res: pollRes, data: pollData } = await safeFetchJson(
        'https://live.com',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code: codeData.device_code
          }),
          signal: controller.signal
        }
      );

      if (pollRes.ok && pollData.access_token) {
        currentController = null;
        return await exchangeMsToMc(pollData.access_token, pollData.refresh_token);
      }

      if (pollData.error === 'authorization_pending' || pollData.error === 'slow_down') {
        continue;
      }

      if (pollData.error === 'authorization_declined') throw new Error('Вход отклонён пользователем');
      if (pollData.error === 'expired_token') throw new Error('Время действия кода истекло');
      throw new Error(pollData.error_description || pollData.error || 'Ошибка ожидания подтверждения');
    }

    throw new Error('timeout');
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('cancelled');
    throw err;
  } finally {
    if (currentController === controller) currentController = null;
  }
}

const cancel = () => {
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
};

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

    const { res: msRes, data: msData } = await safeFetchJson(
      'https://live.com',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      }
    );
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
