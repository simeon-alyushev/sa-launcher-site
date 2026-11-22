// POST /api/ms/device -> { device_code, user_code, verification_uri, interval, expires_in }
// Вход Microsoft «по коду» (device code): ключи и секреты не нужны. Client ID можно заменить переменной MS_CLIENT_ID.
export const CID = env => String((env && env.MS_CLIENT_ID) || '00000000402b5328');
export const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'down' }, 403);
  let r, d = {};
  try {
    r = await fetch('https://login.live.com/oauth20_connect.srf', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SA-Launcher-Site' },
      body: new URLSearchParams({ client_id: CID(env), scope: SCOPE, response_type: 'device_code' }).toString()
    });
    try { d = await r.json(); } catch (_) {}
  } catch (_) { return json({ error: 'down' }, 502); }
  if (!r.ok || !d.device_code || !d.user_code) return json({ error: 'client', detail: d.error_description || d.error || 'HTTP ' + r.status }, 502);
  return json({ device_code: d.device_code, user_code: d.user_code, verification_uri: d.verification_uri || 'https://www.microsoft.com/link', interval: Number(d.interval) || 5, expires_in: Number(d.expires_in) || 900 });
}
