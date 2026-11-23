// GET /download/windows|macos|linux -> редирект на файл из последнего GitHub Release
import { latestRelease, pick, json } from '../_gh.js';
export async function onRequestGet({ env, params }) {
  const os = String(params.os || '').toLowerCase();
  if (!pick[os]) return json({ error: 'unknown os' }, 404);
  try {
    const rel = await latestRelease(env), a = (rel.assets || []).find(pick[os]);
    if (!a) return json({ error: 'В последнем релизе нет файла для ' + os }, 404);
    return Response.redirect(a.browser_download_url, 302);
  } catch (e) { return json({ error: String(e.message || e) }, 502); }
}
