// GET /api/versions?src=modrinth&id=  -> { versions: [{ id, name, mc, loaders, url }] }
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
export async function onRequestGet({ request }) {
  const u = new URL(request.url), id = u.searchParams.get('id') || '';
  if (u.searchParams.get('src') === 'curseforge') return json({ error: 'CurseForge не настроен на сервере' }, 501);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return json({ error: 'bad id' }, 400);
  const r = await fetch(`https://api.modrinth.com/v2/project/${id}/version`, { headers: { 'User-Agent': 'SA-Launcher-Site' } });
  if (!r.ok) return json({ error: 'Modrinth: HTTP ' + r.status }, 502);
  const d = await r.json();
  return json({ versions: d.map(v => { const f = (v.files || []).find(x => x.primary) || (v.files || [])[0]; return { id: v.id, name: v.name || v.version_number, mc: v.game_versions || [], loaders: v.loaders || [], url: f ? f.url : '' }; }) });
}
