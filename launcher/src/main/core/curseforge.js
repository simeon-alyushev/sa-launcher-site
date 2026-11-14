'use strict';
// CurseForge через API сайта (ключ CF_API_KEY хранится на сервере, в лаунчере его нет).
const U = require('./util');
const q = o => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))).toString();

async function search(site, { query = '', type = 'mod', loader, version }) {
  const d = await U.fetchJSON(`${site}/api/search?` + q({ src: 'curseforge', q: query, type, loader: loader === 'vanilla' ? '' : loader, version }));
  return { total: (d.results || []).length, hits: (d.results || []).map(r => ({ id: String(r.id), slug: '', title: r.title, desc: r.desc, icon: r.icon, downloads: r.downloads, author: r.author, type, url: r.url, src: 'curseforge', loaders: [] })) };
}
async function files(site, id, loader, version) {
  const d = await U.fetchJSON(`${site}/api/versions?` + q({ src: 'curseforge', id, loader: loader === 'vanilla' ? '' : loader, version }));
  return d.versions || [];
}
module.exports = { search, files };
