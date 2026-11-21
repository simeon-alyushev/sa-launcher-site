// Предпросмотр интерфейса в обычном браузере (без Electron): подставляет «ненастоящий» мост sa с тестовыми данными.
// Ничего не скачивается и не сохраняется. Открывайте preview.html двойным щелчком (Chrome/Edge/Firefox).
// Параметры в адресе: ?mode=simple | advanced, ?welcome=1, ?theme=dark|light|amoled, ?lang=ru|en
(() => {
  const q = new URLSearchParams(location.search), now = Date.now();
  const svg = c => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${c}"/></svg>`);
  const settings = { lang: q.get('lang') || 'ru', theme: q.get('theme') || 'dark', accent: '#6c8cff', uiMode: q.get('mode') === 'simple' ? 'simple' : 'advanced', welcomed: q.get('welcome') !== '1', memory: 4096, selected: 'a1', checkUpdates: false, lite: q.get('lite') === '1', anims: q.get('anims') !== '0', customBg: '#12141a', customCard: '#1b1f29', customBgs: [], customBgSel: '' };
  const inst = [
    { id: 'i1', name: 'Vanilla SA', mc: '1.21.1', loader: 'fabric', loaderVersion: '0.16.9', iconData: '', playtime: 7200, lastPlayed: now - 36e5, group: '', memory: 4096 },
    { id: 'i2', name: 'Моя сборка', mc: '1.20.1', loader: 'forge', loaderVersion: '47.2.0', iconData: '', playtime: 0, lastPlayed: 0, group: 'Мои', memory: 6144,
      manual: [{ name: 'someblocked-mod.jar', reason: 'blocked', url: 'https://www.curseforge.com/projects/1', kind: 'mod' }] },
    { id: 'i3', name: 'Чистая 26.1', mc: '26.1', loader: 'vanilla', loaderVersion: '', iconData: '', playtime: 600, lastPlayed: now - 864e5, group: '' }
  ];
  const mcv = [['26.3', 'release', 2], ['26.2', 'release', 150], ['26.1', 'release', 240], ['1.21.1', 'release', 400], ['1.20.1', 'release', 900], ['25w14a', 'snapshot', 3], ['1.8.9', 'old_release', 3000]].map(([id, type, d]) => ({ id, type, time: now - d * 864e5 }));
  const hit = (n, i, src) => ({ id: String(i), title: n, desc: 'Описание сборки или мода для предпросмотра', icon: svg('#4a8'), downloads: 123456 * i, author: 'author', type: 'mod', src: src || 'modrinth', loaders: ['fabric'] });
  const png = svg('#a67');   // вместо настоящих скинов
  const F = {
    'app:init': () => ({ accounts: [{ id: 'a1', name: 'Steve', p: 'ms' }], site: 'https://sa.example', version: '1.7.0', locale: 'ru', settings }),
    'inst:list': () => inst, 'inst:recent': () => ({ worlds: [], servers: [] }), 'mc:versions': () => mcv,
    'loader:versions': () => ['0.16.9', '0.16.8'], 'loader:fallback': () => '26.2',
    'cat:search': o => ({ total: 40, limit: 20, hits: ['Sodium', 'Lithium', 'Iris Shaders', 'Create'].map((n, i) => hit(n, i + 1, o && o.src)) }),
    'build:list': () => [{ id: 'vanilla-sa', name: 'Vanilla SA', loader: 'fabric', desc: 'Ванильный опыт с оптимизацией и красотой', icon: '../src/renderer/builds/vanilla-sa.jpg', mods: ['Sodium', 'Lithium'], resourcepacks: ['Faithful'], shaders: ['Complementary'] }],
    'build:versions': () => ['26.1', '1.21.1'],
    'inst:content': o => o.kind === 'mods' || o.kind === 'mod' ? [{ file: 'sodium.jar', title: 'Sodium', version: '0.6.0', enabled: true, pid: 'AANobbMI', icon: svg('#48a'), size: 900000 }, { file: 'lithium.jar', title: 'Lithium', version: '0.14', enabled: false, pid: 'gvQqBUqZ', icon: svg('#8a4'), size: 500000 }] : [],
    'inst:worlds': () => [{ name: 'Новый мир', size: 52e6, time: now - 36e5 }, { name: 'Выживание', size: 310e6, time: now - 5 * 864e5 }],
    'inst:backups': () => [{ name: 'saves-manual-x', reason: 'manual', time: now - 864e5, size: 40e6, worlds: 2 }],
    'cloud:limits': () => ({ share: { maxBytes: 26214400, ttlDays: 7 }, cloud: { keep: 5, maxBytes: 157286400 } }),
    'cloud:list': () => { throw new Error('err:cloudNoServer'); },
    'skin:profile': () => ({ id: 'a1', name: 'Steve', variant: 'classic', skin: png, capes: [] }), 'skin:saved': () => [], 'skin:head': () => '',
    'wizard:plan': o => { const r = (o.items || []).map(i => ({ project: i.project, title: i.title, icon: i.icon, type: i.type, neededBy: [], ok: true, version: 'v1', versionName: '1.0' })); if (r.some(x => x.type === 'mod')) r.push({ project: 'DEPDEP01', title: 'Fabric API', icon: svg('#c84'), type: 'mod', neededBy: [r.find(x => x.type === 'mod').title], ok: true, version: 'v2', versionName: '0.100' }); return r; },
    'wizard:create': o => ({ instance: inst[0], installed: (o.items || []).length, failed: [] }),
    'bg:add': rid => window.__bgAdd ? window.__bgAdd(rid) : null, 'bg:remove': id => window.__bgRemove ? window.__bgRemove(id) : { list: [], sel: '' },
    'launcher:check': () => ({ available: false, current: '1.7.0' }), 'app:pendingLink': () => null
  };
  window.sa = {
    call: async (name, arg) => { const f = F[name]; if (f) return f(arg); console.log('[preview] нет данных для', name, arg); return []; },
    on: () => () => {}
  };
})();
