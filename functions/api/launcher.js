// GET /api/launcher -> { version, url: { windows, macos, linux } }  (последний GitHub Release)
import { latestRelease, pick, json } from '../_gh.js';
export async function onRequestGet({ env }) {
  try {
    const rel = await latestRelease(env), url = {};
    for (const os of Object.keys(pick)) { const a = (rel.assets || []).find(pick[os]); if (a) url[os] = a.browser_download_url; }
    return json({ version: String(rel.tag_name || '').replace(/^v/i, ''), url });
  } catch (e) { return json({ error: String(e.message || e) }, 502); }
}
