// SA Launcher backend (Cloudflare Pages advanced mode)
// Env vars: ELY_CLIENT_ID, ELY_CLIENT_SECRET, MS_CLIENT_ID, MS_CLIENT_SECRET, SESSION_SECRET,
//           GITHUB_REPO (owner/repo с релизами лаунчера), CF_API_KEY (optional), GITHUB_TOKEN (optional, для приватного репо)
const UA = 'SimeonAlyushev/SALauncher/0.1.0 (simeon.alyushev@gmail.com)';
const enc = new TextEncoder(), dec = new TextDecoder();
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const hk = env => crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET || 'unset'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
async function sign(env, o) { const p = b64(enc.encode(JSON.stringify(o))); return p + '.' + b64(await crypto.subtle.sign('HMAC', await hk(env), enc.encode(p))); }
async function verify(env, t) {
  try { const [p, s] = (t || '').split('.'); if (!s || !await crypto.subtle.verify('HMAC', await hk(env), ub64(s), enc.encode(p))) return null; return JSON.parse(dec.decode(ub64(p))); } catch { return null; }
}
const ck = (req, n) => ((req.headers.get('Cookie') || '').split(/;\s*/).map(c => c.split('=')).find(c => c[0] === n) || [])[1];
const setc = (n, v, age) => `${n}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const jwt = s => JSON.parse(dec.decode(ub64(s.split('.')[1])));
const get = async (url, t) => (await fetch(url, { headers: { Authorization: 'Bearer ' + t } })).json();
const html = (msg, ok, s = 200) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SA Launcher</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#f2f4f8;font:16px system-ui,sans-serif"><div style="max-width:420px;margin:20px;padding:36px;border-radius:28px;background:#181b22;border:1px solid #262b35;text-align:center"><div style="width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-size:32px;margin:0 auto 16px;background:${ok ? '#4ade80;color:#06220f' : '#f87171;color:#2a0707'}">${ok ? '✓' : '!'}</div><h2>${ok ? 'Готово' : 'Не получилось'}</h2><p style="color:#9aa3b2">${msg.replace(/[<>&]/g, '')}</p><a href="/" style="display:inline-block;margin-top:14px;padding:12px 26px;border-radius:99px;background:#4ade80;color:#06220f;font-weight:700;text-decoration:none">На сайт</a></div>`, { status: s, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

// ---------- Minecraft (Xbox) для входа из лаунчера ----------
const post = async (url, o) => { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(o) }); const d = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error('HTTP ' + r.status + ' ' + new URL(url).hostname + (d.errorMessage || d.Message || d.error ? ': ' + (d.errorMessage || d.Message || d.error) : '')); e.data = d; e.status = r.status; throw e; } return d; };
async function msChain(msAccess) {
  const xbl = await post('https://user.auth.xboxlive.com/user/authenticate', { Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: 'd=' + msAccess }, RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT' });
  let xsts;
  try { xsts = await post('https://xsts.auth.xboxlive.com/xsts/authorize', { Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] }, RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT' }); }
  catch (e) { const x = e.data && e.data.XErr; if (x === 2148916233) throw new Error('У аккаунта нет профиля Xbox. Создайте его на xbox.com.'); if (x === 2148916238) throw new Error('Детский аккаунт: добавьте его в семейную группу Microsoft.'); throw e; }
  const mc = await post('https://api.minecraftservices.com/authentication/login_with_xbox', { identityToken: `XBL3.0 x=${xsts.DisplayClaims.xui[0].uhs};${xsts.Token}` });
  const H = { Authorization: 'Bearer ' + mc.access_token };
  const pr = await fetch('https://api.minecraftservices.com/minecraft/profile', { headers: H });
  if (!pr.ok) throw new Error('На этом аккаунте нет лицензии Minecraft Java Edition. Войдите через Ely.by.');
  const prof = await pr.json();
  return { p: 'ms', id: prof.id, name: prof.name, accessToken: mc.access_token, expiresAt: Date.now() + (mc.expires_in || 86400) * 1000, skin: 'https://crafatar.com/skins/' + prof.id };
}

const P = {
  ely: {
    auth: 'https://account.ely.by/oauth2/v1', tok: 'https://account.ely.by/api/oauth2/v1/token', scope: 'account_info', lscope: 'account_info minecraft_server_session offline_access',
    id: e => e.ELY_CLIENT_ID, sec: e => e.ELY_CLIENT_SECRET,
    me: async t => { const r = await get('https://account.ely.by/api/account/v1/info', t.access_token); return { id: String(r.id), name: r.username, uuid: String(r.uuid || '').replace(/-/g, '') }; },
    pack: async (t, me) => ({ p: 'ely', id: me.uuid, name: me.name, accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + (t.expires_in || 3600) * 1000, skin: 'https://skinsystem.ely.by/skins/' + encodeURIComponent(me.name) + '.png' })
  },
  microsoft: {
    auth: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize', tok: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    scope: 'openid profile', lscope: 'openid profile offline_access XboxLive.signin', id: e => e.MS_CLIENT_ID, sec: e => e.MS_CLIENT_SECRET,
    me: async t => { const c = jwt(t.id_token || ''); return { id: c.oid || c.sub, name: c.name || c.preferred_username || 'Microsoft account' }; },
    pack: async t => { const a = await msChain(t.access_token); a.refreshToken = t.refresh_token; return a; }
  }
};

// Ссылка на лаунчер: cookie "lk" = подписанные {port,state,exp}. После входа браузер уходит на http://127.0.0.1:port/callback
const loopback = (l, q) => 'http://127.0.0.1:' + l.port + '/callback?' + new URLSearchParams({ state: l.state, ...q });
async function getLink(req, env) { const l = await verify(env, ck(req, 'lk')); return l && l.exp > Date.now() ? l : null; }

async function auth(req, env, u, name, start) {
  const p = P[name], ru = u.origin + '/auth/' + name;
  const need = { [name === 'ely' ? 'ELY_CLIENT_ID' : 'MS_CLIENT_ID']: p.id(env), [name === 'ely' ? 'ELY_CLIENT_SECRET' : 'MS_CLIENT_SECRET']: p.sec(env), SESSION_SECRET: env.SESSION_SECRET };
  const miss = Object.keys(need).filter(k => !need[k]);
  if (miss.length) return new Response('Provider is not configured. Missing variables: ' + miss.join(', '), { status: 503 });
  const link = await getLink(req, env);
  if (start) {
    const st = crypto.randomUUID();
    const q = new URLSearchParams({ client_id: p.id(env), redirect_uri: ru, response_type: 'code', scope: link ? p.lscope : p.scope, state: st });
    if (name === 'microsoft' && link) q.set('prompt', 'select_account');
    return new Response(null, { status: 302, headers: { Location: p.auth + '?' + q, 'Set-Cookie': setc('st', st, 600) } });
  }
  const code = u.searchParams.get('code');
  if (!code || u.searchParams.get('state') !== ck(req, 'st')) {
    if (link && u.searchParams.get('error')) return new Response(null, { status: 302, headers: { Location: loopback(link, { error: 'cancelled' }) } });
    return Response.redirect(u.origin + '/#login', 302);
  }
  const t = await (await fetch(p.tok, { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', client_id: p.id(env), client_secret: p.sec(env), code, redirect_uri: ru }) })).json();
  if (!t.access_token) return new Response('Sign-in failed at token exchange: ' + (t.error_description || t.error || 'unknown error'), { status: 502 });
  let me;
  try { me = await p.me(t); } catch { me = null; }
  if (!me || !me.id) return new Response('Sign-in failed: could not read your profile', { status: 502 });
  const s = (await verify(env, ck(req, 'sa'))) || { a: [] };
  s.a = s.a.filter(x => x && x.id);
  if (!s.a.some(x => x.p === name && x.id === me.id)) {
    if (s.a.length >= 10) return Response.redirect(u.origin + '/#account', 302); // limit: 10 accounts
    s.a.push({ p: name, id: me.id, name: me.name });
  }
  const h = new Headers({ Location: u.origin + '/#account' });
  h.append('Set-Cookie', setc('sa', await sign(env, s), 2592000));
  h.append('Set-Cookie', setc('st', '', 0));
  if (link) { // вход начат из лаунчера: отдаём аккаунт лаунчеру через localhost
    let acc;
    try { acc = await p.pack(t, me); } catch (e) { return html(e.message || 'Ошибка входа', false, 400); }
    h.set('Location', loopback(link, { data: b64(enc.encode(JSON.stringify(acc))) }));
    h.append('Set-Cookie', setc('lk', '', 0));
  }
  return new Response(null, { status: 302, headers: h });
}

async function launcherLogin(u, env) {
  const port = +u.searchParams.get('port'), state = u.searchParams.get('state') || '';
  if (!(port >= 1024 && port <= 65535) || !/^[A-Za-z0-9_-]{16,80}$/.test(state)) return html('Некорректная ссылка. Нажмите «Войти» в лаунчере ещё раз.', false, 400);
  const h = new Headers({ Location: '/#login' });
  h.append('Set-Cookie', setc('lk', await sign(env, { port, state, exp: Date.now() + 600000 }), 600));
  return new Response(null, { status: 302, headers: h });
}
async function refresh(req, env) {
  let b; try { b = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const name = b.p === 'ely' ? 'ely' : b.p === 'ms' ? 'microsoft' : null, p = name && P[name];
  if (!p || !b.refreshToken || !p.id(env)) return json({ error: 'bad request' }, 400);
  try {
    const t = await (await fetch(p.tok, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', client_id: p.id(env), client_secret: p.sec(env), refresh_token: b.refreshToken, scope: p.lscope }) })).json();
    if (!t.access_token) return json({ error: t.error_description || t.error || 'refresh failed' }, 401);
    if (!t.refresh_token) t.refresh_token = b.refreshToken;
    return json({ account: await p.pack(t, name === 'ely' ? await p.me(t) : null) });
  } catch (e) { return json({ error: e.message }, 401); }
}

// ---------- Скачивание лаунчера (GitHub Releases) ----------
const DL = { windows: /\.exe$/i, macos: /\.dmg$/i, linux: /\.AppImage$/i };
async function download(os, env) {
  const repo = env.GITHUB_REPO || 'simeon-alyushev/sa-launcher-site';
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json', ...(env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + env.GITHUB_TOKEN } : {}) }, cf: { cacheTtl: 300, cacheEverything: true } });
    if (r.ok) { const a = ((await r.json()).assets || []).find(x => DL[os].test(x.name)); if (a) return Response.redirect(a.browser_download_url, 302); }
  } catch (_) {}
  return html('Сборка для ' + os + ' пока не загружена. Попробуйте позже.', false, 404);
}

const CF = { mod: 6, modpack: 4471, resourcepack: 12, shader: 6552 }, LD = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
async function search(u, env) {
  const g = k => u.searchParams.get(k) || '', q = g('q'), t = CF[g('type')] ? g('type') : 'mod', l = g('loader'), v = g('version');
  let res;
  if (g('src') === 'curseforge') {
    if (!env.CF_API_KEY) return json({ error: 'CurseForge is not configured yet' }, 503);
    const p = new URLSearchParams({ gameId: '432', classId: CF[t], searchFilter: q, pageSize: '20' });
    if (v) p.set('gameVersion', v);
    if (LD[l] && t === 'mod') p.set('modLoaderType', LD[l]);
    const r = await fetch('https://api.curseforge.com/v1/mods/search?' + p, { headers: { 'x-api-key': env.CF_API_KEY, Accept: 'application/json' } });
    if (!r.ok) return json({ error: 'CurseForge error ' + r.status }, 502);
    res = (await r.json()).data.map(m => ({ id: m.id, src: 'curseforge', author: (m.authors && m.authors[0] || {}).name, title: m.name, desc: m.summary, icon: m.logo && m.logo.thumbnailUrl, downloads: m.downloadCount, url: m.links && m.links.websiteUrl }));
  } else {
    const f = [['project_type:' + t]];
    if (l && (t === 'mod' || t === 'modpack')) f.push(['categories:' + l]);
    if (v) f.push(['versions:' + v]);
    const r = await fetch('https://api.modrinth.com/v2/search?' + new URLSearchParams({ query: q, limit: '20', facets: JSON.stringify(f) }), { headers: { 'User-Agent': UA } });
    if (!r.ok) return json({ error: 'Modrinth error ' + r.status }, 502);
    res = (await r.json()).hits.map(h => ({ id: h.project_id, src: 'modrinth', author: h.author, title: h.title, desc: h.description, icon: h.icon_url, downloads: h.downloads, url: 'https://modrinth.com/' + h.project_type + '/' + h.slug }));
  }
  return json({ results: res.filter(x => /^https:\/\//.test(x.url || '')) });
}

async function versions(u, env) {
  const g = k => u.searchParams.get(k) || '', id = g('id'), l = g('loader'), v = g('version');
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return json({ error: 'bad id' }, 400);
  if (g('src') === 'curseforge') {
    if (!env.CF_API_KEY) return json({ error: 'CurseForge is not configured yet' }, 503);
    const p = new URLSearchParams({ pageSize: '20' });
    if (v) p.set('gameVersion', v);
    if (LD[l]) p.set('modLoaderType', LD[l]);
    const r = await fetch(`https://api.curseforge.com/v1/mods/${id}/files?` + p, { headers: { 'x-api-key': env.CF_API_KEY } });
    if (!r.ok) return json({ error: 'CurseForge error ' + r.status }, 502);
    return json({ versions: (await r.json()).data.map(f => ({ name: f.displayName, mc: f.gameVersions.filter(x => /^\d/.test(x)), loaders: f.gameVersions.filter(x => !/^\d/.test(x)), url: /^https:\/\//.test(f.downloadUrl || '') ? f.downloadUrl : '' })) });
  }
  const p = new URLSearchParams();
  if (l) p.set('loaders', JSON.stringify([l]));
  if (v) p.set('game_versions', JSON.stringify([v]));
  const r = await fetch(`https://api.modrinth.com/v2/project/${id}/version?` + p, { headers: { 'User-Agent': UA } });
  if (!r.ok) return json({ error: 'Modrinth error ' + r.status }, 502);
  return json({ versions: (await r.json()).slice(0, 25).map(x => { const f = x.files.find(f => f.primary) || x.files[0]; return { name: x.name || x.version_number, mc: x.game_versions, loaders: x.loaders, url: f && /^https:\/\/cdn\.modrinth\.com\//.test(f.url) ? f.url : '' }; }) });
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url), path = u.pathname, m = path.match(/^\/auth\/(ely|microsoft)(\/start)?$/);
    if (m) return auth(req, env, u, m[1], !!m[2]);
    const d = path.match(/^\/download\/(windows|macos|linux)\/?$/);
    if (d) return download(d[1], env);
    if (path === '/launcher/login') return launcherLogin(u, env);
    if (path === '/api/link/refresh' && req.method === 'POST') return refresh(req, env);
    if (path === '/api/me') { const s = await verify(env, ck(req, 'sa')); return json({ accounts: s ? s.a : [] }); }
    if (path === '/api/logout' && req.method === 'POST') return new Response(null, { status: 204, headers: { 'Set-Cookie': setc('sa', '', 0) } });
    if (path === '/api/versions') return versions(u, env);
    if (path === '/api/search') return search(u, env);
    return env.ASSETS.fetch(req);
  }
};
