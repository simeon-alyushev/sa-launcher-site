'use strict';
// Фон за интерфейсом (canvas #fx). Только то, что не живёт на поверхностях:
//   warm  — лёгкое тёплое свечение в углу (без дисков и лучей);
//   night — пиксельное звёздное небо: звёзды (часть мерцает), маленькая луна, изредка падающая звезда.
// Все объекты погоды, накапливающиеся на кнопках/панелях, рисует pane.js. Здесь — один холст, один rAF,
// остановка при скрытом окне, 30 к/с на слабых ПК, полная очистка при stop().
const SAFx = (() => {
  const cv = document.getElementById('fx'), cx = cv.getContext('2d');
  const MODES = ['warm', 'night', 'cold'];
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let snow = [], stars = [], shoot = null, W = 0, H = 0, raf = 0, T = 0, mode = '', A = 0, tA = 0, step = 1, last = 0, slow = 0, nFr = 0, nextShoot = 0;
  const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; cx.imageSmoothingEnabled = false; };

  function make() {
    const n = Math.round((weak ? 60 : 110) * Math.min(1.5, Math.max(.6, W * H / 1e6 / 1.1)));
    stars = Array.from({ length: n }, () => { const big = Math.random() < .12; return { x: Math.round(rnd(0, W) / 2) * 2, y: Math.round(rnd(0, H * .9) / 2) * 2, s: big ? 4 : 2, tw: Math.random() < .35, p: rnd(0, 6.28), sp: rnd(.6, 1.8), b: rnd(.35, .85) }; });
    shoot = null; nextShoot = rnd(5, 12);
  }
  // Фоновый снегопад за интерфейсом: мелкие пиксельные снежинки двух слоёв глубины (без накопления — оно в pane.js)
  function makeSnow() { const n = Math.round((weak ? 90 : 170) * Math.min(1.5, Math.max(.6, W * H / 1e6 / 1.1))); snow = Array.from({ length: n }, () => { const z = Math.random(); return { x: rnd(0, W), y: rnd(-20, H), z, s: z > .7 ? 4 : 2, v: 22 + z * 48, p: rnd(0, 6.28) }; }); }
  function snowfall(dt) {
    cx.fillStyle = '#fff';
    for (const f of snow) { f.y += f.v * dt; f.x += Math.sin(T * .8 + f.p) * 14 * dt; if (f.y > H + 6) { f.y = -6; f.x = rnd(0, W); } cx.globalAlpha = A * (.3 + .5 * f.z); cx.fillRect(Math.round(f.x / 2) * 2, Math.round(f.y / 2) * 2, f.s, f.s); }
  }
  function glow() {
    const x = W * .9, y = 0, M = Math.max(W, H), pu = .5 + .5 * Math.sin(T * .6), g = cx.createRadialGradient(x, y, 0, x, y, M * .75);
    g.addColorStop(0, `rgba(255,196,90,${.3 + .06 * pu})`); g.addColorStop(.35, 'rgba(255,170,70,.09)'); g.addColorStop(1, 'rgba(255,170,60,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  }
  function sky(dt, withMoon) {
    for (const s of stars) {
      const a = s.tw ? s.b * (.55 + .45 * Math.sin(T * s.sp + s.p)) : s.b; cx.globalAlpha = A * a; cx.fillStyle = '#fff'; cx.fillRect(s.x, s.y, s.s, s.s);
      if (s.s === 4) { cx.fillRect(s.x - 2, s.y + 1, 8, 2); cx.fillRect(s.x + 1, s.y - 2, 2, 8); }
    }
    cx.globalAlpha = A * .95; cx.drawImage(PX.moon, Math.round(W * .38 - PX.moon.width / 2), Math.round(H * .33 - PX.moon.height / 2));
    nextShoot -= dt;
    if (!shoot && nextShoot <= 0) { const x = rnd(W * .2, W * .9), y = rnd(30, H * .35); shoot = { x, y, vx: -rnd(380, 520), vy: rnd(170, 240), t: 0 }; nextShoot = rnd(9, 22); }
    if (shoot) {
      shoot.t += dt; shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt;
      for (let i = 0; i < 7; i++) { cx.globalAlpha = A * (1 - i / 7) * .85; cx.fillStyle = i ? '#cfe0ff' : '#fff'; cx.fillRect(Math.round((shoot.x - shoot.vx * .014 * i) / 2) * 2, Math.round((shoot.y - shoot.vy * .014 * i) / 2) * 2, 2, 2); }
      if (shoot.t > 1.1 || shoot.x < -20 || shoot.y > H) shoot = null;
    }
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const el = now - last; if (weak && el < 30) return;
    const dt = Math.min(.05, el / 1000); last = now; T += dt;
    if (A !== tA) { A = tA > A ? Math.min(tA, A + dt * step) : Math.max(tA, A - dt * step); if (A <= 0 && tA === 0) return halt(); }
    if (++nFr > 120) { nFr = 0; if (slow > 70) { if (stars.length > 20) stars.length = Math.ceil(stars.length / 2); } slow = 0; } else if (el > (weak ? 55 : 30)) slow++;
    cx.clearRect(0, 0, W, H); cx.globalAlpha = A;
    if (mode === 'warm') glow(); else if (mode === 'cold') snowfall(dt); else sky(dt);
    cx.globalAlpha = 1;
  }
  function halt() { cancelAnimationFrame(raf); raf = 0; cx.clearRect(0, 0, W, H); stars = []; snow = []; shoot = null; mode = ''; A = tA = 0; }
  function run() { if (!raf && !document.hidden) { last = performance.now(); nFr = slow = 0; raf = requestAnimationFrame(loop); } }
  function start(m, ms = 600) {
    if (!MODES.includes(m) || matchMedia('(prefers-reduced-motion:reduce)').matches) return stop(0);
    if (mode !== m) { halt(); mode = m; if (m === 'cold') makeSnow(); else make(); }
    tA = 1; step = ms > 0 ? 1000 / ms : 1e3; if (!ms) A = 1; run();
  }
  function stop(ms = 500) { if (!raf && !mode) return; tA = 0; step = ms > 0 ? 1000 / ms : 1e3; if (!ms) halt(); else run(); }
  // Статичное небо без анимации (режим «Экономия ресурсов»): один кадр, без rAF
  function still(m) {
    if (m !== 'night') return stop(0);
    halt(); mode = m; size(); make(); stars.forEach(s => { s.tw = false; }); cx.clearRect(0, 0, W, H);
    A = 1; tA = 1; T = 0; sky(0, true); cx.globalAlpha = 1; shoot = null;
  }
  size(); cx.imageSmoothingEnabled = false;
  addEventListener('resize', () => { size(); if (mode === 'cold') { makeSnow(); return; } if (mode) { const m = mode, a = A; make(); A = a; if (!raf) { if (m === 'night') { stars.forEach(s => { s.tw = false; }); sky(0, true); cx.globalAlpha = 1; } } } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (mode && tA) run(); });
  return { start, stop, still, MODES, get active() { return !!raf; }, get mode() { return mode; } };
})();
