'use strict';
const { fetchJSON } = require('./util');
const API = 'https://api.modrinth.com/v2';
const q = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v)}`).join('&');

async function search({ query = '', type = 'mod', loader, version, offset = 0, limit = 24 }) {
  const facets = [[`project_type:${type}`]];
  if (loader && loader !== 'vanilla' && (type === 'mod' || type === 'modpack')) facets.push([`categories:${loader}`]);
  if (version) facets.push([`versions:${version}`]);
  const d = await fetchJSON(`${API}/search?` + q({ query, facets, limit, offset, index: query ? 'relevance' : 'downloads' }));
  return { total: d.total_hits, hits: d.hits.map(h => ({ id: h.project_id, slug: h.slug, title: h.title, desc: h.description, icon: h.icon_url, downloads: h.downloads, author: h.author, type: h.project_type, url: `https://modrinth.com/${h.project_type}/${h.slug}`, loaders: h.display_categories })) };
}
const project = id => fetchJSON(`${API}/project/${encodeURIComponent(id)}`);
const projects = ids => ids.length ? fetchJSON(`${API}/projects?` + q({ ids })) : Promise.resolve([]);
const versions = (id, { loaders, game_versions } = {}) => fetchJSON(`${API}/project/${encodeURIComponent(id)}/version?` + q({ loaders, game_versions }));
const version = id => fetchJSON(`${API}/version/${id}`);
const lookupHashes = hashes => hashes.length ? fetchJSON(`${API}/version_files`, { method: 'POST', body: { hashes, algorithm: 'sha1' } }) : Promise.resolve({});
const updateHashes = (hashes, loaders, game_versions) => hashes.length ? fetchJSON(`${API}/version_files/update`, { method: 'POST', body: { hashes, algorithm: 'sha1', loaders, game_versions } }) : Promise.resolve({});
const primaryFile = v => v.files.find(f => f.primary) || v.files[0];
// предпочитаем release > beta > alpha, внутри — самый свежий
const best = list => { const r = { release: 0, beta: 1, alpha: 2 }; return [...list].sort((a, b) => (r[a.version_type] - r[b.version_type]) || (new Date(b.date_published) - new Date(a.date_published)))[0]; };

module.exports = { search, project, projects, versions, version, lookupHashes, updateHashes, primaryFile, best };
