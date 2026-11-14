'use strict';
// Анимированный фон тем «Снег / Солнце / Листопад / Дождь» — тот же, что на сайте SA Launcher.
const SAFx = (() => {
  const cv = document.getElementById('fx'), cx = cv.getContext('2d');
  const MODES = ['cold', 'warm', 'autumn', 'spring']; // cold=снег, warm=солнце, autumn=листопад, spring=дождь
  let P = [], W = 0, H = 0, raf = 0, T = 0, mode = '';
  const R = (a, b) => a + Math.random() * (b - a);
  const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
  const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };

  function make(m) {
    const sm = W < 700, n = m === 'spring' ? (sm ? 60 : 130) : m === 'cold' ? (sm ? 45 : 90) : m === 'autumn' ? (sm ? 18 : 34) : 30;
    P = Array.from({ length: n }, () => ({ x: R(0, W), y: R(-H, H), s: R(.4, 1), p: R(0, 6.28), r: R(0, 6.28), v: Math.random() }));
  }
  function sun() {
    const x = W * .88, y = H * .1, pu = .5 + .5 * Math.sin(T * .8), M = Math.max(W, H);
    const g = cx.createRadialGradient(x, y, 0, x, y, M * .7);
    g.addColorStop(0, `rgba(255,200,80,${.55 + .15 * pu})`); g.addColorStop(.25, `rgba(255,170,60,${.2 + .08 * pu})`); g.addColorStop(1, 'rgba(255,170,60,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    cx.save(); cx.translate(x, y); cx.rotate(T * .05); cx.fillStyle = 'rgba(255,210,100,.1)';
    for (let i = 0; i < 12; i++) { cx.rotate(Math.PI / 6); cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(-60, M * 1.2); cx.lineTo(60, M * 1.2); cx.fill(); }
    cx.restore(); cx.beginPath(); cx.arc(x, y, 46 + 4 * pu, 0, 6.28); cx.fillStyle = 'rgba(255,222,130,.92)'; cx.fill();
    for (const p of P) { p.y -= .25 * p.s; p.x += Math.sin(T + p.p) * .3; if (p.y < -10) { p.y = H + 10; p.x = R(0, W); } cx.beginPath(); cx.arc(p.x, p.y, 1.5 + p.s * 2, 0, 6.28); cx.fillStyle = `rgba(255,190,70,${.2 + .3 * p.s})`; cx.fill(); }
  }
  function loop() {
    T += .016; cx.clearRect(0, 0, W, H);
    if (mode === 'warm') sun();
    else for (const p of P) {
      if (mode === 'cold') { p.y += .6 + p.s * 1.2; p.x += Math.sin(T + p.p) * .5; cx.beginPath(); cx.arc(p.x, p.y, 1.5 + p.s * 3, 0, 6.28); cx.fillStyle = `rgba(255,255,255,${.45 + .4 * p.s})`; cx.fill(); }
      else if (mode === 'spring') { p.y += 11 + p.s * 8; p.x -= 1.5; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - 2, p.y - 10 - 8 * p.s); cx.strokeStyle = `rgba(160,210,255,${.3 + .3 * p.s})`; cx.lineWidth = 1.2; cx.stroke(); }
      else { p.y += .8 + p.s * 1.2; p.x += Math.sin(T * 1.2 + p.p) * 1.2; p.r += .02; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.font = (16 + p.s * 18) + 'px serif'; cx.fillText(p.v > .5 ? '🍁' : '🍂', 0, 0); cx.restore(); }
      if (p.y > H + 30 || p.x < -30 || p.x > W + 30) { p.y = -30; p.x = R(0, W); }
    }
    raf = requestAnimationFrame(loop);
  }
  const stop = () => { cancelAnimationFrame(raf); raf = 0; cx.clearRect(0, 0, W, H); };
  function set(m) {
    if (m === mode && (raf || !MODES.includes(m))) return;
    mode = m; stop(); P = [];
    if (!MODES.includes(m) || reduced()) return;
    make(m); loop();
  }
  size();
  addEventListener('resize', () => { size(); if (MODES.includes(mode)) { const m = mode; mode = ''; set(m); } });
  // не жжём процессор, пока окно свёрнуто
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (MODES.includes(mode)) { const m = mode; mode = ''; set(m); } });
  return { set };
})();
