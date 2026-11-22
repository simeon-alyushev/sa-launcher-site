// GET /api/search?src=modrinth&q=&type=mod&loader=&version=  -> { results: [...] }   (CurseForge здесь не поддержан: нужен ключ)
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
export async function onRequestGet({ request }) {
  const u = new URL(request.url), g = k => u.searchParams.get(k) || '';
  if (g('src') === 'curseforge') return json({ error: 'CurseForge не настроен на сервере' }, 501);
  const type = ['mod', 'modpack', 'resourcepack', 'shader'].includes(g('type')) ? g('type') : 'mod';
  const facets = [[`project_type:${type}`]];
  if (/^[a-z]+$/.test(g('loader'))) facets.push([`categories:${g('loader')}`]);
  if (/^[\w.-]+$/.test(g('version'))) facets.push([`versions:${g('version')}`]);
  const r = await fetch('https://api.modrinth.com/v2/search?limit=20&index=' + (g('q') ? 'relevance' : 'downloads') + '&query=' + encodeURIComponent(g('q')) + '&facets=' + encodeURIComponent(JSON.stringify(facets)), { headers: { 'User-Agent': 'SA-Launcher-Site' } });
  if (!r.ok) return json({ error: 'Modrinth: HTTP ' + r.status }, 502);
  const d = await r.json();
  return json({ results: (d.hits || []).map(h => ({ src: 'modrinth', id: h.project_id, title: h.title, desc: h.description, icon: h.icon_url, downloads: h.downloads, author: h.author, url: `https://modrinth.com/${type}/${h.slug}`, type })) });
}
