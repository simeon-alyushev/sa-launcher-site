// POST /api/cf/files { files: [{ projectID, fileID }] } -> { files: [...] }   (пакетный разбор манифеста модпака CurseForge)
import * as CF from '../../_cf.js';
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch (_) { return CF.json({ error: 'bad' }, 400, 'no-store'); }
  if (!Array.isArray(b.files)) return CF.json({ error: 'bad' }, 400, 'no-store');
  try { return CF.json(await CF.filesBatch(env, b.files.slice(0, 50)), 200, 'no-store'); } catch (e) { return CF.fail(e); }
}
