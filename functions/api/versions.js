// GET /api/versions?src=modrinth|curseforge&id=&loader=&version=  -> { versions: [{ id, name, mc, loaders, url, sha1 }] }
import * as CF from '../_cf.js';
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), g = k => u.searchParams.get(k) || '';
  try {
    if (g('src') === 'curseforge') return CF.json(await CF.versions(env, g));
    const id = g('id');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return CF.json({ error: 'bad id' }, 400, 'no-store');
    const r = await fetch(`https://api.modrinth.com/v2/project/${id}/version`, { headers: { 'User-Agent': 'SA-Launcher-Site' } });
    if (!r.ok) return CF.json({ error: 'Modrinth: HTTP ' + r.status }, 502, 'no-store');
    const d = await r.json();
    return CF.json({ versions: d.map(v => { const f = (v.files || []).find(x => x.primary) || (v.files || [])[0]; return { id: v.id, name: v.name || v.version_number, mc: v.game_versions || [], loaders: v.loaders || [], url: f ? f.url : '', sha1: f && f.hashes ? f.hashes.sha1 : '' }; }) });
  } catch (e) { return CF.fail(e); }
}
