// GET /api/search?src=modrinth|curseforge[&game=bedrock&type=addons|maps|textures|scripts|skins]&q=&type=mod|modpack|resourcepack|shader&loader=&version=&offset=  -> { results: [...] }
import * as CF from '../_cf.js';
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), g = k => u.searchParams.get(k) || '';
  try {
    if (g('src') === 'curseforge') return CF.json(g('game') === 'bedrock' ? await CF.searchBedrock(env, g) : await CF.search(env, g));
    const type = ['mod', 'modpack', 'resourcepack', 'shader'].includes(g('type')) ? g('type') : 'mod';
    const facets = [[`project_type:${type}`]];
    if (/^[a-z]+$/.test(g('loader'))) facets.push([`categories:${g('loader')}`]);
    if (/^[\w.-]+$/.test(g('version'))) facets.push([`versions:${g('version')}`]);
    const off = Math.max(0, parseInt(g('offset')) || 0);
    const r = await fetch('https://api.modrinth.com/v2/search?limit=20&offset=' + off + '&index=' + (g('q') ? 'relevance' : 'downloads') + '&query=' + encodeURIComponent(g('q')) + '&facets=' + encodeURIComponent(JSON.stringify(facets)), { headers: { 'User-Agent': 'SA-Launcher-Site' } });
    if (!r.ok) return CF.json({ error: 'Modrinth: HTTP ' + r.status }, 502, 'no-store');
    const d = await r.json();
    return CF.json({ results: (d.hits || []).map(h => ({ src: 'modrinth', id: h.project_id, title: h.title, desc: h.description, icon: h.icon_url, downloads: h.downloads, author: h.author, url: `https://modrinth.com/${type}/${h.slug}`, type })) });
  } catch (e) { return CF.fail(e); }
}
