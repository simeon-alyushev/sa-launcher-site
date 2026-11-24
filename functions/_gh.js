// Общие помощники: последний GitHub Release. Репозиторий задаётся переменной GITHUB_REPO (например "user/sa-launcher").
// Необязательно: GITHUB_TOKEN (поднимает лимит GitHub API с 60 до 5000 запросов в час).
export async function latestRelease(env) {
  const repo = String(env.GITHUB_REPO || '').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('GITHUB_REPO не задан (Pages → Settings → Environment variables), пример: user/sa-launcher');
  const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { 'User-Agent': 'SA-Launcher-Site', Accept: 'application/vnd.github+json', ...(env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + env.GITHUB_TOKEN } : {}) },
    cf: { cacheTtl: 300, cacheEverything: true }
  });
  if (!r.ok) throw new Error('GitHub: HTTP ' + r.status + (r.status === 404 ? ' (нет опубликованного релиза или репозиторий приватный)' : ''));
  return r.json();
}
export const pick = {
  windows: a => /\.exe$/i.test(a.name) && !/blockmap/i.test(a.name),
  macos: a => /\.dmg$/i.test(a.name),
  linux: a => /\.AppImage$/i.test(a.name) || /\.deb$/i.test(a.name)
};
export const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
