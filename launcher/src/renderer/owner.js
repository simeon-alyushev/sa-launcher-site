/* SA Owner: Developer Mode, панель владельца (SA Owner Panel) и согласие на статистику. Подключается после tools.js.
 *
 * Важно: флаг «владелец» в интерфейсе — только подсказка, что показывать. Реальные права проверяет сервер при КАЖДОМ вызове
 * (UUID подтверждает Mojang, а не лаунчер); если сервер откажет, панель закроется. Ничего не имитируется: данные приходят с сервера,
 * а пока бэкенд не настроен, панель честно говорит об этом. Разделы появляются по мере появления реальных функций (SECTIONS). */
(function () {
  'use strict';
  const ru = () => S.settings.lang === 'ru' || S.settings.lang === 'uk';
  const TX = {
    ru: {
      panel: 'Панель владельца', dash: 'Обзор', dev: 'Инструменты разработчика', sys: 'Система',
      noAccess: 'Нет доступа', noAccessD: 'Панель доступна только владельцу SA Launcher (вход через Microsoft).',
      notCfg: 'Бэкенд не настроен', notCfgD: 'Панель владельца, блокировки и статистика требуют сервера (Firebase). Пока в package.json → firebase не заполнены projectId и apiKey, эти функции выключены. Инструкция: firebase/README.md.',
      users: 'Пользователей (дали согласие)', bans: 'Блокировок', audits: 'Записей аудита', reload: 'Обновить', loading: 'Загрузка…', backend: 'Бэкенд', project: 'Проект', region: 'Регион', session: 'Сессия',
      ping: 'Проверить связь', pingRes: 'Сервер ответил за', audit: 'Журнал аудита', auditD: 'Последние 50 действий владельца. Токены и секреты в журнал не попадают.', auditNone: 'Записей пока нет',
      devMode: 'Режим разработчика', devModeD: 'Показывает кнопку панели владельца. Сочетание клавиш — Ctrl+Shift+D. Права проверяет сервер, а не этот переключатель.',
      signOut: 'Выйти из режима администратора', signOutD: 'Права отключатся сразу, а сервер отзовёт сессию. Вернуться можно повторным входом через Microsoft.', signedOut: 'Права администратора отключены',
      stats: 'Статистика использования', statsD: 'По умолчанию выключено. Если включить, SA получит ваш ник, UUID, версию лаунчера и время последней активности — только для списка пользователей владельца. Блокировки проверяются независимо от этой настройки.',
      adminMode: 'Режим администратора', adminOn: 'Вы вошли как владелец (подтверждено сервером)', bannedT: 'Доступ ограничен', until: 'до', forever: 'бессрочно', reason: 'Причина', bk: 'Сервер SA', bkOn: 'Подключён', bkOff: 'Не настроен', bkSend: 'При входе через Microsoft одноразовый токен Minecraft отправляется на сервер SA, чтобы подтвердить, кто вы (он не сохраняется и не пишется в логи). Ely.by и офлайн-аккаунты на сервер не отправляются.'
    },
    en: {
      panel: 'Owner panel', dash: 'Overview', dev: 'Developer tools', sys: 'System',
      noAccess: 'No access', noAccessD: 'The panel is available only to the SA Launcher owner (Microsoft sign-in).',
      notCfg: 'Backend is not configured', notCfgD: 'The owner panel, bans and statistics need a server (Firebase). Until projectId and apiKey are filled in package.json → firebase, these features are off. Instructions: firebase/README.md.',
      users: 'Users (consented)', bans: 'Bans', audits: 'Audit entries', reload: 'Refresh', loading: 'Loading…', backend: 'Backend', project: 'Project', region: 'Region', session: 'Session',
      ping: 'Check connection', pingRes: 'Server replied in', audit: 'Audit log', auditD: 'Last 50 owner actions. Tokens and secrets never appear in the log.', auditNone: 'No entries yet',
      devMode: 'Developer mode', devModeD: 'Shows the owner panel button. Shortcut: Ctrl+Shift+D. Permissions are checked by the server, not by this switch.',
      signOut: 'Leave administrator mode', signOutD: 'Rights are removed at once and the server revokes the session. Sign in with Microsoft again to return.', signedOut: 'Administrator rights removed',
      stats: 'Usage statistics', statsD: 'Off by default. If enabled, SA receives your nickname, UUID, launcher version and last activity time — only for the owner’s user list. Bans are checked regardless of this setting.',
      adminMode: 'Administrator mode', adminOn: 'Signed in as owner (confirmed by the server)', bannedT: 'Access restricted', until: 'until', forever: 'permanent', reason: 'Reason', bk: 'SA server', bkOn: 'Connected', bkOff: 'Not configured', bkSend: 'When you sign in with Microsoft, a one-time Minecraft token is sent to the SA server to confirm who you are (it is not stored or logged). Ely.by and offline accounts are never sent to the server.'
    }
  };
  const X = k => (TX[ru() ? 'ru' : 'en'][k] !== undefined ? TX[ru() ? 'ru' : 'en'][k] : TX.en[k]);
  S.backend = S.backend || { configured: false, signedIn: false, owner: false, ban: null };
  const ownerOk = () => !!(S.backend && S.backend.owner);              // подсказка интерфейса; сервер проверяет всё сам
  const devOn = () => ownerOk() && S.settings.devMode === true;
  const when = ms => new Date(ms).toLocaleString();

  // ---------- состояние бэкенда ----------
  function onBackend() {
    if (S.view === 'owner' && !(ownerOk() && devOn())) go('home'); else if (S.view === 'owner') { renderRail(); } else renderRail();
    if (S.view === 'settings') viewSettings();
  }
  api('backend:status').then(st => { S.backend = st; onBackend(); }).catch(() => {});
  sa.on((ch, d) => { if (ch === 'backend') { S.backend = d; onBackend(); if (d && d.ban) showBan(d.ban); } });
  function showBan(b) { modal(`<h2>${esc(X('bannedT'))}</h2><p class="mu">${esc(X('reason'))}: <b>${esc(b.reason || '—')}</b></p><p class="mu sm">${b.until ? esc(X('until')) + ' ' + esc(when(b.until)) : esc(X('forever'))}</p><div class="foot"><button class="btn p" data-close>OK</button></div>`); }

  // ---------- кнопка в боковой панели (только владелец с включённым режимом разработчика) ----------
  const origRail = window.renderRail;
  window.renderRail = function () {
    origRail.apply(this, arguments);
    const rail = document.querySelector('#rail .rail-in'); if (!rail || !devOn() || rail.querySelector('[data-go="owner"]')) return;
    const b = document.createElement('button'); b.className = 'nav' + (S.view === 'owner' ? ' on' : ''); b.dataset.go = 'owner'; b.title = X('panel'); b.innerHTML = ic('bolt');
    rail.insertBefore(b, rail.querySelector('[data-acc]'));
  };
  const origView = window.renderView;
  window.renderView = function () { if (S.view === 'owner') return viewOwner(); return origView.apply(this, arguments); };

  // ---------- панель ----------
  // Разделы добавляются сюда по мере появления настоящих функций на сервере
  const SECTIONS = [['dash', 'dash'], ['dev', 'dev'], ['sys', 'sys']];
  function viewOwner() {
    if (!ownerOk() || !devOn()) return V(`<div class="hero"><div class="grow"><h1>${esc(X('noAccess'))}</h1><div class="mu">${esc(X('noAccessD'))}</div></div></div>`);
    if (!S.backend.configured) return V(`<h1>${ic('bolt')} ${esc(X('panel'))}</h1><div class="card"><b>${esc(X('notCfg'))}</b><p class="mu sm">${esc(X('notCfgD'))}</p></div>`);
    const tab = S.ownerTab || 'dash';
    V(`<h1>${ic('bolt')} ${esc(X('panel'))}</h1><div class="seg" style="margin:10px 0 14px">${SECTIONS.map(([k, n]) => `<button data-ownt="${k}" class="${tab === k ? 'on' : ''}">${esc(X(n))}</button>`).join('')}</div><div id="ownbody"></div>`);
    TABS[tab] ? TABS[tab]() : TABS.dash();
  }
  const body = () => $('#ownbody');
  const stillHere = tab => S.view === 'owner' && (S.ownerTab || 'dash') === tab && body();
  const srvErr = e => { if (/fbDenied|fbSignedOut/.test(String(e && e.message))) { toast(errText(e), 'err'); return; } };
  const errCard = (e, tab) => `<div class="card"><div style="color:#f87171">${esc(errText(e))}</div><div class="foot" style="justify-content:flex-start;margin-top:10px"><button class="btn" data-ownt="${tab}">${esc(X('reload'))}</button></div></div>`;
  const stat = (n, v) => `<div class="card" style="flex:1;min-width:150px"><div class="mu sm">${esc(n)}</div><div style="font-size:28px;font-weight:700">${esc(v)}</div></div>`;

  const TABS = {
    async dash() {
      body().innerHTML = `<div class="mu">${esc(X('loading'))}</div>`;
      try {
        const r = await api('backend:call', { name: 'ownerStats' }); if (!stillHere('dash')) return;
        body().innerHTML = `<div class="row gap wrap">${stat(X('users'), r.users)}${stat(X('bans'), r.bans)}${stat(X('audits'), r.audits)}</div>
          <div class="card" style="margin-top:12px"><div class="setrow"><div class="grow">${esc(X('project'))}<small>${esc(S.backend.projectId)}</small></div></div><div class="setrow"><div class="grow">${esc(X('region'))}<small>${esc(S.backend.region)}</small></div></div></div>
          <div class="foot" style="justify-content:flex-start"><button class="btn" data-ownt="dash">${esc(X('reload'))}</button></div>`;
      } catch (e) { srvErr(e); if (stillHere('dash')) body().innerHTML = errCard(e, 'dash'); }
    },
    async dev() {
      body().innerHTML = `<div class="card"><div class="setrow"><div class="grow">${esc(X('ping'))}<small id="ownpr"></small></div><button class="btn sm" data-ownping>${esc(X('ping'))}</button></div>
        <div class="setrow"><div class="grow">${esc(X('session'))}<small>${esc(S.backend.uid || '')}</small></div></div></div>
        <h2>${esc(X('audit'))}</h2><div class="mu sm" style="margin-bottom:8px">${esc(X('auditD'))}</div><div id="ownaud" class="mu">${esc(X('loading'))}</div>`;
      try {
        const r = await api('backend:call', { name: 'ownerAudit' }); if (!stillHere('dev')) return;
        $('#ownaud').innerHTML = r.items.length ? r.items.map(a => `<div class="card sm" style="margin-bottom:6px"><b>${esc(a.action)}</b> <span class="mu">${esc(a.target || '')}</span><div class="mu">${esc(when(a.at))} · ${esc(a.actor)}</div>${a.details && Object.keys(a.details).length ? `<div class="mu">${esc(JSON.stringify(a.details))}</div>` : ''}</div>`).join('') : `<div class="mu">${esc(X('auditNone'))}</div>`;
      } catch (e) { srvErr(e); if (stillHere('dev') && $('#ownaud')) $('#ownaud').innerHTML = `<div style="color:#f87171">${esc(errText(e))}</div>`; }
    },
    sys() {
      body().innerHTML = `<div class="card"><div class="setrow"><div class="grow">${esc(X('devMode'))}<small>${esc(X('devModeD'))}</small></div><button class="sw ${devOn() ? 'on' : ''}" data-owndev></button></div>
        <div class="setrow"><div class="grow">${esc(X('signOut'))}<small>${esc(X('signOutD'))}</small></div><button class="btn bad" data-ownout>${esc(X('signOut'))}</button></div></div>`;
    }
  };

  // ---------- Developer Mode: переключение (Ctrl+Shift+D) ----------
  // Не владельцу сочетание ничего не показывает и не говорит: существование панели не раскрывается
  function toggleDev(force) {
    if (!ownerOk()) return;
    const on = typeof force === 'boolean' ? force : !devOn();
    S.settings.devMode = on; api('settings:set', { devMode: on }).catch(() => {});
    if (on) go('owner'); else { if (S.view === 'owner') go('home'); else renderRail(); }
  }

  // ---------- блоки в настройках ----------
  const origSettings = window.viewSettings;
  window.viewSettings = function () {
    origSettings.apply(this, arguments);
    const main = document.querySelector('.setmain'); if (!main || $('#sx-own')) return;
    const b = S.backend; let html = '';
    if (b.configured) html += `<h2 id="sx-own">${esc(X('stats'))}</h2><div class="card"><div class="setrow"><div class="grow">${esc(X('stats'))}<small>${esc(X('statsD'))}</small></div><button class="sw ${S.settings.shareStats === true ? 'on' : ''}" data-ownstats></button></div><div class="mu sm" style="margin-top:8px">${esc(X('bkSend'))}</div></div>`;
    else html += `<h2 id="sx-own">${esc(X('bk'))}</h2><div class="card"><div class="mu sm">${esc(X('bkOff'))}. ${esc(X('notCfgD'))}</div></div>`;
    if (ownerOk()) html += `<h2>${esc(X('adminMode'))}</h2><div class="card"><div class="mu sm" style="margin-bottom:8px">${esc(X('adminOn'))}</div><div class="setrow"><div class="grow">${esc(X('devMode'))}<small>${esc(X('devModeD'))}</small></div><button class="sw ${devOn() ? 'on' : ''}" data-owndev></button></div></div>`;
    main.insertAdjacentHTML('beforeend', html);
  };

  // «О программе»: если сервер SA подключён, честно говорим, что именно на него уходит
  const origAbout = window.viewAbout;
  window.viewAbout = function () {
    origAbout.apply(this, arguments);
    if (!S.backend.configured) return;
    const foot = document.querySelector('#view .foot'); if (foot) foot.insertAdjacentHTML('beforebegin', `<h2>${esc(X('bk'))}</h2><div class="card"><div class="setrow"><div class="grow"><b>${esc(X('bkOn'))}</b><small>${esc(X('bkSend'))}</small></div></div></div>`);
  };

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-ownt],[data-ownping],[data-owndev],[data-ownout],[data-ownstats]'); if (!b) return;
    if (b.dataset.ownt) { S.ownerTab = b.dataset.ownt; return viewOwner(); }
    if (b.hasAttribute('data-owndev')) return toggleDev();
    if (b.hasAttribute('data-ownstats')) { const on = !(S.settings.shareStats === true); S.settings.shareStats = on; await api('settings:set', { shareStats: on }).catch(() => {}); api('backend:retry').catch(() => {}); return viewSettings(); }
    if (b.hasAttribute('data-ownout')) { try { await api('backend:logout'); } catch (_) {} toast(X('signedOut'), 'ok'); return go('home'); }
    if (b.hasAttribute('data-ownping')) { const t0 = performance.now(); b.disabled = true; try { await api('backend:call', { name: 'ownerPing' }); $('#ownpr').textContent = `${X('pingRes')} ${Math.round(performance.now() - t0)} ms`; } catch (e2) { srvErr(e2); $('#ownpr').textContent = errText(e2); } b.disabled = false; }
  });

  window.SAOwner = { toggleDev, ownerOk, devOn };
})();
