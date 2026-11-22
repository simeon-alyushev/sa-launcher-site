// GET /api/skin?id=<uuid без дефисов> -> PNG скина игрока (тот же домен, кэшируется).
// Берёт ссылку на скин из sessionserver.mojang.com; если не вышло, пробует minotar.net.
const hdr = { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' };

async function mojangSkin(id) {
  const r = await fetch('https://sessionserver.mojang.com/session/minecraft/profile/' + id, { headers: { 'User-Agent': 'SA-Launcher-Site' } });
  if (!r.ok) return null;
  const p = await r.json();
  const prop = (p.properties || []).find(x => x.name === 'textures');
  if (!prop) return null;
  const t = JSON.parse(atob(prop.value));
  const url = t.textures && t.textures.SKIN && t.textures.SKIN.url;
  if (!url || !/^https?:\/\/textures\.minecraft\.net\//.test(url)) return null;
  const s = await fetch(url.replace(/^http:/, 'https:'));
  return s.ok ? s.arrayBuffer() : null;
}
async function fallback(id) {
  const r = await fetch('https://minotar.net/skin/' + id + '.png', { headers: { 'User-Agent': 'SA-Launcher-Site' } });
  return r.ok ? r.arrayBuffer() : null;
}

export async function onRequestGet({ request }) {
  const id = (new URL(request.url).searchParams.get('id') || '').replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(id)) return new Response('bad id', { status: 400 });
  const cache = caches.default, key = new Request(new URL('/api/skin?id=' + id, request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  let buf = null;
  try { buf = await mojangSkin(id); } catch (_) {}
  if (!buf) { try { buf = await fallback(id); } catch (_) {} }
  if (!buf) return new Response('no skin', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const res = new Response(buf, { headers: hdr });
  await cache.put(key, res.clone());
  return res;
}
