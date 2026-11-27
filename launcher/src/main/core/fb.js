'use strict';
// Клиент бэкенда SA (Firebase) без SDK: вход через Identity Toolkit REST и вызов Cloud Functions по протоколу callable.
//
// • Бэкенд опционален: пока в package.json -> "firebase" не заполнены projectId/apiKey/region, status().configured === false,
//   и функции владельца недоступны (ничего не имитируется).
// • Вход: только для аккаунтов Microsoft. Minecraft-токен уходит на ВАШУ функцию sessionLogin, где Mojang подтверждает UUID.
//   Ely.by и офлайн-аккаунты на сервер не отправляются вообще — владельцами они стать не могут.
// • Сессия Firebase хранится ТОЛЬКО в памяти: на диск не пишется. После перезапуска вход выполняется заново из аккаунта Microsoft.
// • Флаг owner из ответа — подсказка для интерфейса. Права проверяет сервер при каждом вызове; локальному флагу доверять нельзя.
const U = require('./util');

const E = (k, ...a) => new Error('err:' + [k, ...a].join('|'));
const okCfg = c => !!c && /^[a-z][a-z0-9-]{4,29}$/.test(c.projectId || '') && /^[A-Za-z0-9_-]{20,60}$/.test(c.apiKey || '') && /^[a-z]+-[a-z]+\d+$/.test(c.region || '');
// Функции, которые лаунчер вообще разрешает вызывать (список растёт вместе с разделами панели)
const CALLABLE = new Set(['ownerPing', 'ownerStats', 'ownerAudit']);

class Backend {
  constructor({ cfg, version = '', fetchImpl = (...a) => fetch(...a), now = () => Date.now(), onChange = () => {} } = {}) {
    this.cfg = okCfg(cfg) ? cfg : null; this.version = String(version); this.f = fetchImpl; this.now = now; this.onChange = onChange;
    this.session = null; this.ban = null; this.error = ''; this.busy = null;
  }
  get configured() { return !!this.cfg; }
  status() {
    const s = this.session;
    return { configured: this.configured, signedIn: !!s, owner: !!(s && s.owner), uid: s ? s.uid : '', ban: this.ban, error: this.error, region: this.cfg ? this.cfg.region : '', projectId: this.cfg ? this.cfg.projectId : '' };
  }
  _emit() { try { this.onChange(this.status()); } catch (_) {} }
  _drop(error = '') { const had = !!this.session || !!this.ban; this.session = null; this.ban = null; this.error = error; if (had || error) this._emit(); }

  // Права привязаны к выбранному аккаунту: сменили или удалили аккаунт — права исчезают немедленно (до любого сетевого запроса)
  bind(accountId) { if (this.session && this.session.accountId !== accountId) this._drop(''); if (!accountId && this.ban) this._drop(''); }

  async _post(url, body, form) {
    let r;
    try { r = await this.f(url, { method: 'POST', headers: { 'User-Agent': U.UA, 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: form ? new URLSearchParams(body).toString() : JSON.stringify(body), signal: AbortSignal.timeout(20000) }); }
    catch (_) { throw E('fbNet'); }
    let data = null; try { data = await r.json(); } catch (_) {}
    return { status: r.status, ok: r.ok, data: data || {} };
  }
  _fnUrl(name) { return `https://${this.cfg.region}-${this.cfg.projectId}.cloudfunctions.net/${name}`; }

  // Вход. acc — аккаунт из хранилища (с токеном). Ничего не делает для не-Microsoft аккаунтов.
  async login(acc, { consent = false } = {}) {
    if (!this.configured) return this.status();
    if (!acc || acc.p !== 'ms' || !acc.accessToken) { this._drop(''); return this.status(); }
    if (this.busy) return this.busy;
    this.busy = (async () => {
      try {
        const r = await this._fn('sessionLogin', { mcToken: acc.accessToken, consent: consent === true, version: this.version }, '');
        if (!r.ok) { const st = r.errStatus; this._drop(st === 'UNAUTHENTICATED' ? 'fbToken' : st === 'RESOURCE_EXHAUSTED' ? 'fbRate' : st === 'NOT_FOUND' || r.status === 404 ? 'fbNoFunc' : 'fbDown'); return this.status(); }
        const res = r.result || {};
        if (res.banned) { this.session = null; this.ban = res.ban || { reason: '', until: null }; this.error = ''; this._emit(); return this.status(); }
        if (!res.token || !res.uid) { this._drop('fbDown'); return this.status(); }
        const s = await this._post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${this.cfg.apiKey}`, { token: res.token, returnSecureToken: true });
        if (!s.ok || !s.data.idToken || !s.data.refreshToken) { this._drop('fbDown'); return this.status(); }
        this.session = { accountId: acc.id, uid: String(res.uid), owner: res.owner === true, idToken: s.data.idToken, refreshToken: s.data.refreshToken, expires: this.now() + (Number(s.data.expiresIn) || 3600) * 1000 };
        this.ban = null; this.error = ''; this._emit(); return this.status();
      } catch (e) { this._drop(String(e.message || '').replace(/^err:/, '') || 'fbDown'); return this.status(); }
      finally { this.busy = null; }
    })();
    return this.busy;
  }

  // Выход: права пропадают сразу, затем сервер отзывает сессии (если связь есть)
  async logout() {
    const s = this.session; this._drop('');
    if (!s || !this.configured) return this.status();
    try { await this._fn('sessionLogout', {}, s.idToken); } catch (_) {}
    return this.status();
  }
  async _token() {
    const s = this.session; if (!s) throw E('fbSignedOut');
    if (s.expires - this.now() > 60000) return s.idToken;
    const r = await this._post(`https://securetoken.googleapis.com/v1/token?key=${this.cfg.apiKey}`, { grant_type: 'refresh_token', refresh_token: s.refreshToken }, true);
    if (!r.ok || !r.data.id_token) { this._drop('fbSignedOut'); throw E('fbSignedOut'); }
    s.idToken = r.data.id_token; s.refreshToken = r.data.refresh_token || s.refreshToken; s.expires = this.now() + (Number(r.data.expires_in) || 3600) * 1000;
    return s.idToken;
  }
  // Один вызов функции (протокол callable). token — токен Firebase текущей сессии или '' для входа.
  async _fn(name, data, token) {
    let r;
    try { r = await this.f(this._fnUrl(name), { method: 'POST', headers: { 'User-Agent': U.UA, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ data: data || {} }), signal: AbortSignal.timeout(20000) }); }
    catch (_) { throw E('fbNet'); }
    let j = null; try { j = await r.json(); } catch (_) {}
    return { status: r.status, ok: r.ok, result: j && 'result' in j ? j.result : undefined, errStatus: j && j.error && j.error.status };
  }
  // Вызов функции владельца. Только из разрешённого списка; сервер всё равно перепроверяет UUID.
  async call(name, data) {
    if (!this.configured) throw E('fbNotConfigured');
    if (!CALLABLE.has(name)) throw E('fbDenied');
    const r = await this._fn(name, data, await this._token());
    if (r.ok && r.result !== undefined) return r.result;
    if (r.status === 401 || r.errStatus === 'UNAUTHENTICATED') { this._drop('fbSignedOut'); throw E('fbSignedOut'); }
    if (r.status === 403 || r.errStatus === 'PERMISSION_DENIED') { if (this.session && this.session.owner) { this.session.owner = false; this._emit(); } throw E('fbDenied'); }   // сервер сказал «нет»: локальный флаг владельца гасим
    if (r.errStatus === 'FAILED_PRECONDITION') throw E('fbOwnerUnset');
    if (r.status === 404) throw E('fbNoFunc');
    if (r.status === 429 || r.errStatus === 'RESOURCE_EXHAUSTED') throw E('fbRate');
    throw E('fbDown');
  }
}
module.exports = { Backend, okCfg, CALLABLE };
