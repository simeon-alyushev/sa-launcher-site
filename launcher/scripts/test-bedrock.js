// Проверка работы с папкой Bedrock на поддельных данных (без Windows и без игры).   node scripts/test-bedrock.js
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'br-'));
process.env.APPDATA = tmp; process.env.LOCALAPPDATA = path.join(tmp, 'local');
const BR = require('../src/main/core/bedrock');
const sh = path.join(tmp, 'Minecraft Bedrock', 'Users', 'Shared', 'games', 'com.mojang'), us = path.join(tmp, 'Minecraft Bedrock', 'Users', '123456', 'games', 'com.mojang');
fs.mkdirSync(path.join(us, 'minecraftWorlds', 'w1='), { recursive: true });
fs.writeFileSync(path.join(us, 'minecraftWorlds', 'w1=', 'levelname.txt'), 'Мой мир'); fs.writeFileSync(path.join(us, 'minecraftWorlds', 'w1=', 'level.dat'), 'x');
fs.mkdirSync(path.join(sh, 'resource_packs', 'rp'), { recursive: true });
fs.writeFileSync(path.join(sh, 'resource_packs', 'rp', 'manifest.json'), '// c\n{"header":{"name":"Test RP","version":[1,2,3],"description":"d"}}');
fs.mkdirSync(path.join(sh, 'behavior_packs', 'bp'), { recursive: true });
fs.writeFileSync(path.join(sh, 'behavior_packs', 'bp', 'manifest.json'), '{"header":{"name":"pack.name"}}');
const w = BR.worlds('release'); assert.equal(w.length, 1); assert.equal(w[0].name, 'Мой мир'); assert.equal(w[0].owner, '123456');
const p = BR.packs('release'); assert.equal(p.length, 2); assert.equal(p.find(x => x.kind === 'resource').name, 'Test RP'); assert.equal(p.find(x => x.kind === 'behavior').name, 'bp');
assert.equal(BR.mainDir('release'), sh);
const b = BR.backupWorld('release', '123456', 'w1=', path.join(tmp, 'bk')); assert(fs.existsSync(path.join(b.path, 'level.dat')));
assert.throws(() => BR.backupWorld('release', '123456', '../x', path.join(tmp, 'bk')));
assert.throws(() => BR.removePack('release', 'resource', '..'));
BR.removePack('release', 'resource', 'rp'); assert.equal(BR.packs('release').length, 1);
assert.throws(() => BR.folderPath('release', '../..'));
assert(BR.importable('a.MCWORLD') && !BR.importable('a.exe'));
let url = ''; try { BR.launch('release', { host: 'bad host!' }, () => {}); } catch (e) { url = e.message; } assert(/brWinOnly|brBadHost/.test(url));
assert(BR.addServerLink('release', { name: 'A|B', host: 'play.x.net', port: 19133 }).startsWith('minecraft://?addExternalServer=A%20B%7Cplay.x.net%3A19133'));
assert.throws(() => BR.addServerLink('preview', { host: 'a b' }));
// Определение установленных изданий: разные ответы PowerShell и папки
const env = { APPDATA: tmp, LOCALAPPDATA: path.join(tmp, 'local2'), SystemDrive: path.join(tmp, 'drv') };
assert.equal(BR.parsePs('мусор до\n{"pk":{"Name":"Microsoft.MinecraftUWP","Version":"1.21.1"},"sa":[]}\nмусор после').pk.length, 1);   // один объект вместо массива
assert.equal(BR.parsePs('нет json'), null);
let d = BR.detect('release', { pk: [{ Name: 'Microsoft.MinecraftUWP', Version: '1.21.1' }], sa: [] }, env);
assert(d.installed && d.via === 'package' && d.version === '1.21.1');
d = BR.detect('release', { pk: [], sa: [{ Name: 'Minecraft', AppID: 'Microsoft.MinecraftUWP_8wekyb3d8bbwe!Game' }] }, env);
assert(d.installed && d.via === 'start' && d.appId === 'Microsoft.MinecraftUWP_8wekyb3d8bbwe!Game');   // настоящий AppID из меню «Пуск»
d = BR.detect('preview', { pk: [], sa: [] }, env); assert(!d.installed && d.appId === 'Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe!App');
fs.mkdirSync(path.join(tmp, 'local2', 'Packages', BR.EDITIONS.preview.pfn), { recursive: true });
d = BR.detect('preview', { pk: [], sa: [] }, env); assert(d.installed && d.via === 'packages-folder');   // PowerShell ничего не нашёл, но папка пакета есть
d = BR.detect('release', null, env); assert(d.installed && d.via === 'data');   // PowerShell не ответил, есть папка данных
fs.rmSync(tmp, { recursive: true, force: true });
console.log('OK bedrock');
