// POST /api/ely/login  { username, password, totp? }  ->  { id, name }
// Cloudflare Pages Function. Проверяет логин и пароль на authserver.ely.by (Yggdrasil API) и возвращает ТОЛЬКО ник и UUID.
// Токен доступа сразу отзывается и нигде не сохраняется, пароль не пишется в журнал. client_id/secret не нужны.
const ELY = 'https://authserver.ely.by';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request }) {
  // Только со страниц этого же сайта (защита от чужих форм)
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'down' }, 403);
  let b; try { b = await request.json(); } catch (_) { return json({ error: 'bad' }, 400); }
  const username = String(b.username || '').trim().slice(0, 254), password = String(b.password || '').slice(0, 512), totp = String(b.totp || '').replace(/\s+/g, '').slice(0, 8);
  if (!username || !password) return json({ error: 'bad' }, 400);

  const clientToken = crypto.randomUUID().replace(/-/g, '');
  let r, d = {};
  try {
    r = await fetch(ELY + '/auth/authenticate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'SA-Launcher-Site' },
      body: JSON.stringify({ username, password: totp ? `${password}:${totp}` : password, clientToken, requestUser: false })
    });
    try { d = await r.json(); } catch (_) {}
  } catch (_) { return json({ error: 'down' }, 502); }

  if (!r.ok) {
    if (/two factor/i.test(String(d.errorMessage || ''))) return json({ error: 'tfa' }, 401);
    if (r.status === 401 || r.status === 403) return json({ error: 'bad' }, 401);
    if (r.status === 429) return json({ error: 'rate' }, 429);
    return json({ error: 'down' }, 502);
  }
  const p = d.selectedProfile || (d.availableProfiles || [])[0];
  // Токен нужен был только для проверки пароля — отзываем сразу
  try { await fetch(ELY + '/auth/invalidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: d.accessToken, clientToken: d.clientToken || clientToken }) }); } catch (_) {}
  if (!p || !p.id || !p.name) return json({ error: 'nop' }, 404);
  return json({ id: String(p.id).replace(/-/g, '').toLowerCase(), name: p.name });
}
