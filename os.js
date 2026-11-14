// Cloudflare Pages Function: /download/windows | /download/macos | /download/linux
// Перенаправляет на файл из последнего GitHub Release.
// Настройка: Pages -> Settings -> Variables -> GITHUB_REPO = "ваш-ник/репозиторий"
const PATTERN = { windows: /\.exe$/i, macos: /\.dmg$/i, linux: /\.AppImage$/i };

export async function onRequestGet({ params, env }) {
  const os = params.os;
  if (!PATTERN[os]) return new Response('Unknown platform', { status: 404 });
  const repo = env.GITHUB_REPO || 'OWNER/REPO';
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { 'User-Agent': 'sa-launcher-site', Accept: 'application/vnd.github+json', ...(env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + env.GITHUB_TOKEN } : {}) },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    if (r.ok) {
      const rel = await r.json();
      const a = (rel.assets || []).find(x => PATTERN[os].test(x.name));
      if (a) return Response.redirect(a.browser_download_url, 302);
    }
  } catch (_) {}
  return new Response(`<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;background:#0f1115;color:#f2f4f8;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center;max-width:420px"><h2>Сборка для ${os} пока не загружена</h2><p style="color:#9aa3b2">Попробуйте позже.</p><a style="color:#4ade80" href="/">← На главную</a></div>`, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
