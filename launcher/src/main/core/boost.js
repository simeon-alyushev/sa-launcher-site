'use strict';
// SA Boost — «умные пресеты»: подбор памяти и JVM-флагов под ПК и версию Java + безопасная правка options.txt.
// Ничего не скачивает, не ставит модов и не трогает файлы Mojang (клиент, библиотеки, ассеты).
// Меняет только: поля экземпляра (boost) и пользовательский options.txt — и только после явного нажатия «Применить».
const fs = require('fs'), os = require('os'), path = require('path');

const PRESETS = ['balanced', 'fps', 'weak'];
const BAK = 'options.txt.sa-boost.bak';
const r512 = n => Math.floor(n / 512) * 512;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// Java по версии игры, если реальная ещё неизвестна (до первого запуска)
function guessJava(mc) {
  const m = String(mc || '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/); if (!m) return 17;
  const mi = +m[2], pa = +(m[3] || 0);
  if (+m[1] > 1) return 21;
  if (mi <= 16) return 8; if (mi === 17) return 16; if (mi < 20 || (mi === 20 && pa < 5)) return 17; return 21;
}

function hardware() { return { ram: Math.floor(os.totalmem() / 1048576), cores: (os.cpus() || []).length || 4 }; }

function recommend(hw) {
  if (hw.ram < 6144 || hw.cores <= 4) return 'weak';
  if (hw.ram >= 12288 && hw.cores >= 8) return 'fps';
  return 'balanced';
}

// Чистая функция: план по пресету. Никаких обращений к диску.
function plan(preset, { ram, cores, java, loader } = {}) {
  if (!PRESETS.includes(preset)) throw new Error('err:badPreset');
  ram = ram || hardware().ram; cores = cores || hardware().cores; java = +java || 17;
  const modded = loader && loader !== 'vanilla', cap = Math.max(1536, r512(ram - 2560));   // 2.5 ГБ всегда остаются системе
  let mem, xms; const f = ['-XX:+UseG1GC', '-XX:+DisableExplicitGC'];
  if (preset === 'weak') {
    mem = clamp(r512(ram * .35), 1536, modded ? 4096 : 3072); xms = 512;
    f.push('-XX:MaxGCPauseMillis=200', '-XX:+UnlockExperimentalVMOptions', '-XX:G1NewSizePercent=20', '-XX:G1HeapRegionSize=4M');
    if (cores <= 2) f.push('-XX:ParallelGCThreads=2', '-XX:ConcGCThreads=1');
  } else if (preset === 'fps') {
    mem = clamp(r512(ram * .5), 3072, modded ? 12288 : 8192); xms = r512(mem / 2);
    const zgc = (java === 21 || java === 22) && cores >= 8 && mem >= 6144;                 // ZGenerational есть только в 21–22
    if (zgc) { f.length = 0; f.push('-XX:+UseZGC', '-XX:+ZGenerational', '-XX:+DisableExplicitGC'); }
    else f.push('-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=50', '-XX:+UnlockExperimentalVMOptions', '-XX:G1NewSizePercent=30', '-XX:G1MaxNewSizePercent=40', '-XX:G1HeapRegionSize=8M', '-XX:G1ReservePercent=20', '-XX:InitiatingHeapOccupancyPercent=15');
  } else {
    mem = clamp(r512(ram * .4), 2048, modded ? 8192 : 6144); xms = 1024;
    f.push('-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=100', '-XX:+UnlockExperimentalVMOptions', '-XX:G1NewSizePercent=25', '-XX:G1HeapRegionSize=8M');
  }
  mem = Math.min(mem, cap); xms = Math.min(xms, mem);
  const opts = OPTS[preset];
  return { preset, mem, xms, flags: f.join(' '), java, gc: f.includes('-XX:+UseZGC') ? 'ZGC' : 'G1', opts, hw: { ram, cores } };
}

// Параметры options.txt. mode: 'min' — только уменьшаем (если у игрока уже меньше — не трогаем), 'max' — только увеличиваем, 'set' — ставим.
const OPTS = {
  balanced: { renderDistance: ['min', 12], simulationDistance: ['min', 10], particles: ['max', 0], biomeBlendRadius: ['min', 3] },
  fps: { renderDistance: ['min', 8], simulationDistance: ['min', 6], particles: ['max', 1], biomeBlendRadius: ['min', 1], entityShadows: ['set', 'false'], fancyGraphics: ['set', 'false'], entityDistanceScaling: ['min', .75], mipmapLevels: ['min', 2] },
  weak: { renderDistance: ['min', 5], simulationDistance: ['min', 5], particles: ['max', 2], biomeBlendRadius: ['min', 0], entityShadows: ['set', 'false'], fancyGraphics: ['set', 'false'], entityDistanceScaling: ['min', .5], mipmapLevels: ['min', 0], maxFps: ['min', 60] }
};

function parse(txt) { return txt.split(/\r?\n/); }
// Возвращает список изменений; меняются ТОЛЬКО уже существующие ключи (если игра ещё не создала options.txt — ничего не делаем)
function diff(txt, preset) {
  const out = [], lines = parse(txt), spec = OPTS[preset];
  lines.forEach((ln, idx) => {
    const k = ln.indexOf(':'); if (k < 1) return; const key = ln.slice(0, k), val = ln.slice(k + 1), s = spec[key]; if (!s) return;
    let nv;
    if (s[0] === 'set') nv = String(s[1]);
    else { const cur = parseFloat(val); if (!Number.isFinite(cur)) return; const t = s[1]; if (s[0] === 'min' && cur > t) nv = String(t); else if (s[0] === 'max' && cur < t) nv = String(t); }
    if (nv !== undefined && nv !== val) out.push({ idx, key, from: val, to: nv });
  });
  return { changes: out, lines };
}

const file = gameDir => path.join(gameDir, 'options.txt');

function preview(gameDir, preset) {
  const f = file(gameDir);
  if (!fs.existsSync(f)) return { exists: false, changes: [], backup: false };
  const d = diff(fs.readFileSync(f, 'utf8'), preset);
  return { exists: true, changes: d.changes.map(({ key, from, to }) => ({ key, from, to })), backup: fs.existsSync(path.join(gameDir, BAK)) };
}

function applyOptions(gameDir, preset) {
  const f = file(gameDir); if (!fs.existsSync(f)) throw new Error('err:noOptions');
  const txt = fs.readFileSync(f, 'utf8'), d = diff(txt, preset), bak = path.join(gameDir, BAK);
  if (!d.changes.length) return { changed: 0 };
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, txt);                       // копия оригинала — только первая, чтобы откат вёл к «как было»
  for (const c of d.changes) d.lines[c.idx] = c.key + ':' + c.to;
  fs.writeFileSync(f + '.tmp', d.lines.join(txt.includes('\r\n') ? '\r\n' : '\n')); fs.renameSync(f + '.tmp', f);
  return { changed: d.changes.length };
}

function revertOptions(gameDir) {
  const bak = path.join(gameDir, BAK); if (!fs.existsSync(bak)) throw new Error('err:noBackup');
  fs.copyFileSync(bak, file(gameDir)); fs.unlinkSync(bak); return { ok: true };
}

module.exports = { PRESETS, BAK, guessJava, hardware, recommend, plan, diff, preview, applyOptions, revertOptions };
