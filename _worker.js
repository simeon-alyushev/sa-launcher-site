// SA Launcher backend (Cloudflare Pages advanced mode)
// Env vars: ELY_CLIENT_ID, ELY_CLIENT_SECRET, MS_CLIENT_ID, MS_CLIENT_SECRET, SESSION_SECRET, CF_API_KEY (optional)
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
 
const P = {
  ely: {
    auth: 'https://account.ely.by/oauth2/v1', tok: 'https://account.ely.by/api/oauth2/v1/token', scope: 'account_info',
    id: e => e.ELY_CLIENT_ID, sec: e => e.ELY_CLIENT_SECRET,
    me: async t => { const r = await get('https://account.ely.by/api/account/v1/info', t.access_token); return { id: String(r.id), name: r.username }; }
  },
  microsoft: {
    auth: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize', tok: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    scope: 'openid profile', id: e => e.MS_CLIENT_ID, sec: e => e.MS_CLIENT_SECRET,
    me: async t => { const c = jwt(t.id_token || ''); return { id: c.oid || c.sub, name: c.name || c.preferred_username || 'Microsoft account' }; }
  }
};
 
async function auth(req, env, u, name, start) {
  const p = P[name], ru = u.origin + '/auth/' + name;
  const need = { [name === 'ely' ? 'ELY_CLIENT_ID' : 'MS_CLIENT_ID']: p.id(env), [name === 'ely' ? 'ELY_CLIENT_SECRET' : 'MS_CLIENT_SECRET']: p.sec(env), SESSION_SECRET: env.SESSION_SECRET };
  const miss = Object.keys(need).filter(k => !need[k]);
  if (miss.length) return new Response('Provider is not configured. Missing variables: ' + miss.join(', '), { status: 503 });
  if (start) {
    const st = crypto.randomUUID();
    const q = new URLSearchParams({ client_id: p.id(env), redirect_uri: ru, response_type: 'code', scope: p.scope, state: st });
    return new Response(null, { status: 302, headers: { Location: p.auth + '?' + q, 'Set-Cookie': setc('st', st, 600) } });
  }
  const code = u.searchParams.get('code');
  if (!code || u.searchParams.get('state') !== ck(req, 'st')) return Response.redirect(u.origin + '/#login', 302);
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
  return new Response(null, { status: 302, headers: h });
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
    res = (await r.json()).data.map(m => ({ title: m.name, desc: m.summary, icon: m.logo && m.logo.thumbnailUrl, downloads: m.downloadCount, url: m.links && m.links.websiteUrl }));
  } else {
    const f = [['project_type:' + t]];
    if (l && (t === 'mod' || t === 'modpack')) f.push(['categories:' + l]);
    if (v) f.push(['versions:' + v]);
    const r = await fetch('https://api.modrinth.com/v2/search?' + new URLSearchParams({ query: q, limit: '20', facets: JSON.stringify(f) }), { headers: { 'User-Agent': UA } });
    if (!r.ok) return json({ error: 'Modrinth error ' + r.status }, 502);
    res = (await r.json()).hits.map(h => ({ title: h.title, desc: h.description, icon: h.icon_url, downloads: h.downloads, url: 'https://modrinth.com/' + h.project_type + '/' + h.slug }));
  }
  return json({ results: res.filter(x => /^https:\/\//.test(x.url || '')) });
}
 
export default {
  async fetch(req, env) {
    const u = new URL(req.url), path = u.pathname, m = path.match(/^\/auth\/(ely|microsoft)(\/start)?$/);
    if (m) return auth(req, env, u, m[1], !!m[2]);
    if (path === '/api/me') { const s = await verify(env, ck(req, 'sa')); return json({ accounts: s ? s.a : [] }); }
    if (path === '/api/logout' && req.method === 'POST') return new Response(null, { status: 204, headers: { 'Set-Cookie': setc('sa', '', 0) } });
    if (path === '/api/search') return search(u, env);
    return env.ASSETS.fetch(req);
  }
};
 
