'use strict';
// Фоновые частицы погодных тем: снег (cold), солнце (warm), листопад (autumn), дождь (spring).
// Управляется из weather.js: start(режим, плавность) / stop(плавность). set() оставлен для совместимости.
// Экономия: холст без HiDPI-масштаба, ограничение FPS на слабых ПК, автоматическое упрощение при просадке кадров,
// полная остановка requestAnimationFrame, когда эффект погас или окно скрыто.
const SAFx = (() => {
  const cv = document.getElementById('fx'), cx = cv.getContext('2d');
  const MODES = ['cold', 'warm', 'autumn', 'spring'];
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const LEAF = (() => { const p = new Path2D(); p.moveTo(0, -9); p.bezierCurveTo(7, -6, 8, 3, 0, 9); p.bezierCurveTo(-8, 3, -7, -6, 0, -9); p.moveTo(0, -9); p.lineTo(0, 11); return p; })();
  const LEAFC = ['#e0782b', '#c8451f', '#e9a62c', '#a8512a', '#d9b23a'];
  let P = [], R = [], W = 0, H = 0, raf = 0, T = 0, mode = '', A = 0, tA = 0, step = 1, last = 0, slow = 0, nFr = 0, paused = false;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };

  function make(m) {
    const k = (weak ? .55 : 1) * (W < 700 ? .6 : 1) * Math.min(1.4, Math.max(.7, W * H / 1e6 / 1.1));
    const n = Math.round((m === 'spring' ? 110 : m === 'cold' ? 85 : m === 'autumn' ? 26 : 26) * k);
    P = Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(-H, H), s: rnd(.35, 1), p: rnd(0, 6.28), r: rnd(0, 6.28), c: LEAFC[(Math.random() * LEAFC.length) | 0] }));
    R = [];
  }
  function sun(dt) {
    const x = W * .88, y = H * .1, pu = .5 + .5 * Math.sin(T * .8), M = Math.max(W, H);
    const g = cx.createRadialGradient(x, y, 0, x, y, M * .7);
    g.addColorStop(0, `rgba(255,200,80,${.5 + .12 * pu})`); g.addColorStop(.25, `rgba(255,170,60,${.17 + .06 * pu})`); g.addColorStop(1, 'rgba(255,170,60,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    cx.save(); cx.translate(x, y); cx.rotate(T * .05); cx.fillStyle = 'rgba(255,210,100,.085)';
    for (let i = 0; i < 10; i++) { cx.rotate(Math.PI / 5); cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(-56, M * 1.2); cx.lineTo(56, M * 1.2); cx.fill(); }
    cx.restore(); cx.beginPath(); cx.arc(x, y, 44 + 4 * pu, 0, 6.28); cx.fillStyle = 'rgba(255,222,130,.9)'; cx.fill();
    for (const p of P) { p.y -= 15 * p.s * dt; p.x += Math.sin(T + p.p) * 18 * dt; if (p.y < -10) { p.y = H + 10; p.x = rnd(0, W); } cx.beginPath(); cx.arc(p.x, p.y, 1.4 + p.s * 1.8, 0, 6.28); cx.fillStyle = `rgba(255,190,70,${.18 + .27 * p.s})`; cx.fill(); }
  }
  function rain(dt) {
    cx.lineWidth = 1.2; cx.lineCap = 'round';
    for (const p of P) {
      const v = 640 + p.s * 480; p.y += v * dt; p.x -= 70 * dt; const len = 9 + 9 * p.s;
      cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x + 70 / v * len, p.y - len); cx.strokeStyle = `rgba(165,212,255,${.22 + .3 * p.s})`; cx.stroke();
      if (p.y > H + 10) { if (R.length < 10 && Math.random() < .3) R.push({ x: p.x, y: H - rnd(2, 40), t: 0 }); p.y = rnd(-80, -10); p.x = rnd(0, W + 80); }
    }
    for (let i = R.length - 1; i >= 0; i--) { const r = R[i]; r.t += dt * 2.4; if (r.t >= 1) { R.splice(i, 1); continue; } cx.beginPath(); cx.ellipse(r.x, r.y, 3 + 11 * r.t, 1.2 + 3.5 * r.t, 0, 0, 6.28); cx.strokeStyle = `rgba(185,225,255,${.35 * (1 - r.t)})`; cx.lineWidth = 1; cx.stroke(); }
  }
  function snow(dt) {
    for (const p of P) {
      p.y += (36 + p.s * 70) * dt; p.x += Math.sin(T * .9 + p.p) * 22 * dt * (.4 + p.s);
      cx.beginPath(); cx.arc(p.x, p.y, 1.3 + p.s * 2.8, 0, 6.28); cx.fillStyle = `rgba(255,255,255,${.4 + .45 * p.s})`; cx.fill();
      if (p.y > H + 10) { p.y = -10; p.x = rnd(0, W); }
    }
  }
  function leaves(dt) {
    for (const p of P) {
      p.y += (45 + p.s * 55) * dt; p.x += (Math.sin(T * 1.1 + p.p) * 55 + 10) * dt; p.r += (Math.sin(T * .8 + p.p) * 1.6) * dt;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r + Math.sin(T * 1.3 + p.p) * .5); const k = .55 + p.s * .65; cx.scale(k, k * (.6 + .4 * Math.abs(Math.cos(T + p.p))));
      cx.fillStyle = p.c; cx.fill(LEAF); cx.strokeStyle = 'rgba(70,30,10,.55)'; cx.lineWidth = 1 / k; cx.stroke(LEAF); cx.restore();
      if (p.y > H + 30 || p.x > W + 30) { p.y = -30; p.x = rnd(-20, W); }
    }
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (paused) return;
    const el = now - last; if (weak && el < 30) return;        // слабые ПК: ~30 кадров/с
    const dt = Math.min(.05, el / 1000); last = now; T += dt;
    // плавное появление/исчезновение
    if (A !== tA) { A = tA > A ? Math.min(tA, A + dt * step) : Math.max(tA, A - dt * step); if (A <= 0 && tA === 0) return halt(); }
    // автоупрощение: если кадр стабильно тяжёлый — вдвое меньше частиц, затем остановка эффекта
    if (++nFr > 120) { nFr = 0; if (slow > 70) { if (P.length > 12) P.length = Math.ceil(P.length / 2); else { tA = 0; A = 0; return halt(); } } slow = 0; } else if (el > (weak ? 50 : 28)) slow++;
    cx.clearRect(0, 0, W, H); cx.globalAlpha = A;
    if (mode === 'warm') sun(dt); else if (mode === 'spring') rain(dt); else if (mode === 'cold') snow(dt); else leaves(dt);
    cx.globalAlpha = 1;
  }
  function halt() { cancelAnimationFrame(raf); raf = 0; cx.clearRect(0, 0, W, H); P = []; R = []; mode = ''; A = tA = 0; }
  function run() { if (!raf && !document.hidden) { last = performance.now(); nFr = slow = 0; raf = requestAnimationFrame(loop); } }
  function start(m, ms = 600) {
    if (!MODES.includes(m) || matchMedia('(prefers-reduced-motion:reduce)').matches) return stop(0);
    if (mode !== m) { halt(); mode = m; make(m); }
    tA = 1; step = ms > 0 ? 1000 / ms : 1e3; if (!ms) A = 1; run();
  }
  function stop(ms = 500) { if (!raf && !mode) return; tA = 0; step = ms > 0 ? 1000 / ms : 1e3; if (!ms) halt(); }
  const set = m => MODES.includes(m) ? start(m, 0) : stop(0);
  size();
  addEventListener('resize', () => { size(); if (mode) { const m = mode; make(m); } });
  // не жжём процессор, пока окно свёрнуто
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (mode) run(); });
  return { start, stop, set, MODES, get active() { return !!raf; } };
})();
