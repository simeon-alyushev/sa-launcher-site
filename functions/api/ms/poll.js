// POST /api/ms/poll { device_code } -> { pending:true } | { id, name } | { error }
// После подтверждения проходит цепочку Microsoft -> Xbox Live -> XSTS -> Minecraft Services и возвращает ТОЛЬКО ник и UUID.
// Токены нигде не сохраняются и клиенту не отдаются.
import { CID } from './device.js';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const XERR = { 2148916233: 'noxbox', 2148916235: 'region', 2148916236: 'age', 2148916237: 'age', 2148916238: 'child' };

async function post(url, body, form) {
  const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': 'SA-Launcher-Site', Accept: 'application/json', 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: form ? new URLSearchParams(body).toString() : JSON.stringify(body) });
  let data = {}; try { data = await r.json(); } catch (_) {}
  return { ok: r.ok, status: r.status, data };
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'down' }, 403);
  let b; try { b = await request.json(); } catch (_) { return json({ error: 'bad' }, 400); }
  const code = String(b.device_code || '').slice(0, 4096);
  if (!code) return json({ error: 'bad' }, 400);
  try {
    const t = await post('https://login.live.com/oauth20_token.srf', { client_id: CID(env), grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: code }, true);
    if (!t.ok || !t.data.access_token) {
      const e = t.data.error;
      if (e === 'authorization_pending') return json({ pending: true });
      if (e === 'slow_down') return json({ pending: true, slow: true });
      if (e === 'authorization_declined') return json({ error: 'declined' });
      if (e === 'expired_token' || e === 'bad_verification_code') return json({ error: 'expired' });
      return json({ error: 'down', detail: t.data.error_description || e || 'HTTP ' + t.status }, 502);
    }
    const xbl = await post('https://user.auth.xboxlive.com/user/authenticate', { Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: t.data.access_token }, RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT' });
    if (!xbl.ok || !xbl.data.Token) return json({ error: 'xbox' }, 502);
    const uhs = xbl.data.DisplayClaims.xui[0].uhs;
    const xsts = await post('https://xsts.auth.xboxlive.com/xsts/authorize', { Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.data.Token] }, RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT' });
    if (!xsts.ok || !xsts.data.Token) return json({ error: XERR[xsts.data.XErr] || 'xbox' });
    const mc = await post('https://api.minecraftservices.com/authentication/login_with_xbox', { identityToken: `XBL3.0 x=${uhs};${xsts.data.Token}` });
    if (!mc.ok || !mc.data.access_token) return json({ error: mc.status === 403 ? 'client' : 'xbox' }, 502);
    const pr = await fetch('https://api.minecraftservices.com/minecraft/profile', { headers: { Authorization: 'Bearer ' + mc.data.access_token, 'User-Agent': 'SA-Launcher-Site' } });
    if (pr.status === 404) return json({ error: 'nolicense' });
    if (!pr.ok) return json({ error: 'xbox' }, 502);
    const p = await pr.json();
    if (!p.id || !p.name) return json({ error: 'nolicense' });
    return json({ id: String(p.id).replace(/-/g, '').toLowerCase(), name: p.name });
  } catch (_) { return json({ error: 'down' }, 502); }
}
