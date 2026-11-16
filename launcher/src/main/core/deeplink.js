'use strict';
// Разбор ссылок salauncher://install?src=modrinth|curseforge&project=<id>&version=<id>&type=mod|resourcepack|shader|modpack
// Всё из ссылки считается недоверенным: проверяем формат, лишнее отбрасываем.
const SRC = ['modrinth', 'curseforge'];
const TYPES = ['mod', 'resourcepack', 'shader', 'modpack'];
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function parse(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 400) return null;
    const u = new URL(raw);
    if (u.protocol !== 'salauncher:') return null;
    if ((u.hostname || '').toLowerCase() !== 'install') return null;
    const g = k => u.searchParams.get(k);
    const src = (g('src') || '').toLowerCase(), type = (g('type') || 'mod').toLowerCase();
    const project = g('project'), version = g('version');
    if (!SRC.includes(src) || !TYPES.includes(type) || !ID.test(project || '')) return null;
    if (version && !ID.test(version)) return null;
    if (src === 'curseforge' && !/^\d+$/.test(project)) return null;
    if (src === 'curseforge' && version && !/^\d+$/.test(version)) return null;
    if (src === 'curseforge' && type === 'modpack') return null; // сборки CurseForge не поддерживаются
    return { src, project, version: version || '', type };
  } catch (_) { return null; }
}
// Ищет ссылку среди аргументов командной строки
const fromArgv = argv => { for (const a of argv || []) if (typeof a === 'string' && a.toLowerCase().startsWith('salauncher:')) { const r = parse(a); if (r) return r; } return null; };
module.exports = { parse, fromArgv };
