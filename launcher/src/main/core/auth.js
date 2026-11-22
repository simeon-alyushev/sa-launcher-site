'use strict';

const { clipboard, dialog } = require('electron');

// Публичный Client ID Minecraft (Switch), поддерживающий Device Code Flow
const CLIENT_ID = '00000000441cc96b';
const SCOPE = 'service::://xboxlive.com::MBI_SSL';

let currentController = null;

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
  // 1. Авторизация в Xbox Live (для этого Client ID без префикса d=)
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
  const uhs = xbl.DisplayClaims && xbl.DisplayClaims.xui && xbl.DisplayClaims.xui[0] && xbl.DisplayClaims.xui[0].uhs;
  if (!xblToken || !uhs) throw new Error('Ошибка получения токена Xbox Live');

  // 2. Получение XSTS токена для Minecraft
  const xsts = await postJson('https://xboxlive.com', {
    Properties: {
      SandboxId: 'RETAIL',
      UserTokens: [xblToken]
    },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT'
  });

  if (xsts.XErr) {
    if (xsts.XErr === 2148916233) throw new Error('На этом аккаунте Microsoft не создан профиль Xbox');
    if (xsts.XErr === 2148916238) throw new Error('Детский аккаунт: требуется добавление в семейную группу');
    throw new Error(`Ошибка XSTS: ${xsts.XErr}`);
  }

  // 3. Обмен XSTS на токен Minecraft Services
  const mcAuth = await postJson('https://minecraftservices.com', {
    identityToken: `XBL3.0 x=${uhs};${xsts.Token}`
  });

  if (!mcAuth.access_token) {
    throw new Error('Не удалось получить токен Minecraft Services');
  }

  // 4. Получение профиля игрока (ник, UUID, скин)
  const profileRes = await fetch('https://minecraftservices.com', {
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

async function login(siteUrl, openExternal) {
  if (currentController) currentController.abort();
  const controller = new AbortController();
  currentController = controller;

  try {
    // Запрашиваем Device Code у Microsoft
    const codeRes = await fetch('https://live.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        scope: SCOPE,
        response_type: 'device_code'
      }),
      signal: controller.signal
    });

    const codeData = await codeRes.json();
    if (!codeRes.ok || !codeData.device_code) {
      throw new Error(codeData.error_description || 'Не удалось запросить код входа у Microsoft');
    }

    const userCode = codeData.user_code;
    const verifyUrl = codeData.verification_uri || 'https://www.microsoft.com/link';
    const intervalMs = (codeData.interval || 5) * 1000;
    const expiresAt = Date.now() + (codeData.expires_in || 900) * 1000;

    // Копируем код в буфер обмена и показываем окно
    clipboard.writeText(userCode);
    dialog.showMessageBox({
      type: 'info',
      title: 'Вход через Microsoft',
      message: `Ваш код для входа: ${userCode}`,
      detail: `Код уже скопирован в буфер обмена.\n\nНажмите «Открыть браузер», вставьте код (Ctrl+V) на странице ${verifyUrl} и подтвердите вход.`,
      buttons: ['Открыть браузер']
    }).then(() => {
      if (!controller.signal.aborted) openExternal(verifyUrl);
    });

    // Опрашиваем сервер Microsoft, пока пользователь вводит код
    while (Date.now() < expiresAt) {
      if (controller.signal.aborted) throw new Error('cancelled');
      await new Promise((r) => setTimeout(r, intervalMs));
      if (controller.signal.aborted) throw new Error('cancelled');

      const pollRes = await fetch('https://login.live.com/oauth20_token.srf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: codeData.device_code
        }),
        signal: controller.signal
      });

      const pollData = await pollRes.json();

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

    const msRes = await fetch('https://login.live.com/oauth20_token.srf', {
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
