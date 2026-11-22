// Замена недоступных модов сборки SA похожими.   node scripts/test-alt.js
const assert = require('assert');
const MR = require('../src/main/core/modrinth');
const { Instances } = require('../src/main/core/instances');
const { BUILDS } = require('../src/main/core/builds');
const asked = [];
MR.search = async o => { asked.push(o); return { hits: o.query === 'inventory sorting' ? [
  { id: 'a', title: 'Tiny Mod', slug: 'tiny', downloads: 50 },        // слишком малоизвестный
  { id: 'b', title: 'Client Sort', slug: 'client-sort', downloads: 900000 },   // это сам искомый мод
  { id: 'c', title: 'Inventory Profiles Next', slug: 'ipn', downloads: 5e6 },
  { id: 'd', title: 'Other Sorter', slug: 'os', downloads: 2e6 }] : [] }; };
(async () => {
  const item = BUILDS[0].mods.find(m => m.n === 'Client Sort');
  assert(item.alt.length > 0);
  const r = await Instances.prototype.resolveAlt.call({}, item, 'mod', '1.21.8', 'fabric', new Set());
  assert.deepEqual(r, { id: 'c', title: 'Inventory Profiles Next' });
  assert.equal(asked[0].version, '1.21.8'); assert.equal(asked[0].loader, 'fabric');
  assert.deepEqual(await Instances.prototype.resolveAlt.call({}, item, 'mod', '1.21.8', 'fabric', new Set(['c'])), { id: 'd', title: 'Other Sorter' });
  assert.equal(await Instances.prototype.resolveAlt.call({}, { n: 'X', alt: [] }, 'mod', '1', 'fabric', new Set()), null);
  const withAlt = BUILDS[0].mods.concat(BUILDS[0].resourcepacks, BUILDS[0].shaders).filter(x => x.alt.length).length;
  assert(withAlt >= 30, 'у большинства пунктов есть замены: ' + withAlt);
  console.log('OK alt (' + withAlt + ' пунктов с заменами)');
})().catch(e => { console.error(e); process.exit(1); });
