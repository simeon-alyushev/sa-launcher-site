'use strict';
/* SnowPane для SA Launcher — множество мелких пиксельных объектов, живущих на поверхностях интерфейса.
 *
 * Поверхности берутся из DOM (верхние кромки кнопок, карточек, панелей, левой панели) + нижняя граница окна.
 * На них накапливаются снег / вода / песок / листья (карта высот с шагом 2 px), по ним ходят и прыгают лягушки, белки и крабы,
 * а снегоуборщик снимает снег перед собой, довозит до края и ломает снеговиков.
 *
 * Архитектура и производительность:
 *  • один холст на всё окно, один requestAnimationFrame-цикл, расчёт по dt; на слабых ПК — 30 кадров/с и меньше объектов;
 *  • каждый объект — независимый автомат состояний (никто никого не ждёт, никаких промисов в цикле анимации);
 *  • жёсткие лимиты: существ (настройка), частиц, поверхностей; поверхности обновляются раз в 0,4 с и при прокрутке/ресайзе;
 *  • stop() плавно гасит всё и освобождает память; цикл останавливается, когда нечего рисовать или окно скрыто.
 */
const SAPane = (() => {
  const CELL = 2, G = 1000;
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const SEL = '.btn,.card,.inst,.hero,.nav,.pill,.search,.item,.rail-in,.modal-box';
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TH = {   // параметры накопления по темам
    night: { max: 0, slope: 1, col: ['#fff'], top: null, fall: null },
    cold: { max: 3, slope: 1, col: ['#eaf3fc'], top: '#ffffff', fall: 'flake' },
    spring: { max: 3, slope: 0, col: ['rgba(105,180,250,.82)'], top: 'rgba(185,225,255,.95)', fall: 'drop' },
    warm: { max: 5, slope: 1, col: ['#d4a94f', '#c4943c', '#dcb560'], top: '#ecc975', fall: 'grain' },
    autumn: { max: 5, slope: 2, col: ['#d9732a', '#b7421f', '#e8a62e', '#9a5230'], hi: ['#f0a060', '#e0704a', '#f6cc6a', '#c98a60'], top: null, fall: 'leaf' }
  };
  let cv, cx, W = 0, H = 0, raf = 0, last = 0, acc = 0, theme = '', run = false;
  let A = 0, tA = 0, aStep = 2, leaving = false, doneCb = null, maxEnt = weak ? 8 : 14;
  let surfs = new Map(), list = [], floor = null, ents = [], parts = [], tick = 0, spawnT = 0, plowT = 0, staticT = 0, nextRefresh = 0, dirty = true, frames = 0, slow = 0, nf = 0;
  const caps = () => ({ parts: weak ? 90 : 190, surf: weak ? 50 : 90 });

  // ---------- накопление ----------
  class Acc { constructor(n) { this.n = n; this.h = new Uint8Array(n); this.c = new Uint8Array(n); }
    resize(n) { if (n === this.n) return; const h = new Uint8Array(n), c = new Uint8Array(n); for (let i = 0; i < n; i++) { const j = Math.min(this.n - 1, (i * this.n / n) | 0); h[i] = this.h[j]; c[i] = this.c[j]; } this.n = n; this.h = h; this.c = c; } }
  const P = () => TH[theme] || TH.cold;
  function deposit(s, x, ci) {
    const a = s.acc; if (!a) return; const p = P(); let i = clamp(((x - s.l) / CELL) | 0, 0, a.n - 1);
    if (theme === 'autumn') for (let k = 0; k < 3; k++) { if (i + 1 < a.n && a.h[i + 1] > a.h[i]) i++; else if (i > 0 && a.h[i - 1] > a.h[i]) i--; }   // листья ложатся горкой
    if (a.h[i] >= p.max) { let j = -1; for (let d = 1; d <= 4 && j < 0; d++) { if (i - d >= 0 && a.h[i - d] < p.max) j = i - d; else if (i + d < a.n && a.h[i + d] < p.max) j = i + d; } if (j < 0) return; i = j; }
    a.h[i]++; a.c[i] = ci == null ? (Math.random() * p.col.length) | 0 : ci;
  }
  const colH = (s, x) => { if (!s.acc) return 0; const i = clamp(((x - s.l) / CELL) | 0, 0, s.acc.n - 1); return s.acc.h[i] * CELL; };
  const ground = (s, x) => s.t - colH(s, x);
  // Раз в ~0,12 с: растекание/осыпание, стекание воды с краёв, исчезновение воды внизу окна
  function relax() {
    const p = P(), water = theme === 'spring';
    for (const s of list) { const a = s.acc; if (!a) continue; const h = a.h, c = a.c, n = a.n;
      if (water) {
        for (let k = 0; k < 6; k++) { const i = (Math.random() * (n - 1)) | 0; if (h[i] > h[i + 1] + (h[i] > 1 ? 0 : 1)) { h[i]--; h[i + 1]++; c[i + 1] = c[i]; } else if (h[i + 1] > h[i] + (h[i + 1] > 1 ? 0 : 1)) { h[i + 1]--; h[i]++; } }
        if (s.floor) { for (let k = 0; k < 5; k++) { const i = (Math.random() * n) | 0; if (h[i] && Math.random() < .5) h[i]--; } }
        else {
          for (const i of [0, n - 1]) if (h[i] > 0 && Math.random() < .3) { h[i]--; if (parts.length < caps().parts + 40) parts.push({ t: 'drip', x: i ? s.r + 2 : s.l - 3, y: s.t - h[i] * CELL, vx: i ? 10 : -10, vy: 20, s: 2, src: s }); }   // за кромку: раньше капля рождалась внутри блока и тут же садилась обратно
          // Переполнение: если воды на блоке много (заполнено > 45%), излишек понемногу стекает вниз — чем больше воды, тем быстрее.
          // Часть стока показана ручейками по лицевой стороне блока (они доходят до нижних блоков и подпитывают их).
          let tot = 0; for (let i = 0; i < n; i++) tot += h[i];
          const fill = tot / (n * p.max);
          if (fill > .45) {
            const m = Math.min(20, Math.max(1, Math.round((fill - .45) * n * .07))); let fx = -1;   // сток пропорционален ширине блока
            for (let u = 0; u < m; u++) for (let tr = 0; tr < 5; tr++) { const i = (Math.random() * n) | 0; if (h[i] > 0) { h[i]--; fx = i; break; } }
            if (fx >= 0 && rillN < (weak ? 14 : 30) && parts.length < caps().parts + 40 && Math.random() < .55) { rillN++; parts.push({ t: 'rill', x: s.l + fx * CELL, y: s.t - h[fx] * CELL, vx: rnd(-3, 3), vy: 8, s: 1, src: s }); }
          }
        }
      } else for (let k = 0; k < 10; k++) { const i = (Math.random() * (n - 1)) | 0, d = h[i] - h[i + 1];
        if (d > p.slope + 0) { h[i]--; h[i + 1]++; c[i + 1] = c[i]; } else if (-d > p.slope) { h[i + 1]--; h[i]++; c[i] = c[i + 1]; } }
    }
  }

  // ---------- поверхности ----------
  function refresh() {
    const modal = document.getElementById('modal'), open = modal && !modal.classList.contains('hide'), view = document.getElementById('view'), vr = view ? view.getBoundingClientRect() : { top: 0, bottom: H };
    const seen = new Set(), cap = caps().surf; let n = 0;
    for (const el of (open ? modal : document).querySelectorAll(SEL)) {
      if (n >= cap) break; if (el.closest('#rail')) continue; const r = el.getBoundingClientRect();
      if (r.width < 36 || r.height < 16 || r.top < 50 || r.top > H - 8 || r.right < 0 || r.left > W) continue;
      if (!open && view.contains(el) && (r.top < vr.top + 6 || r.top > vr.bottom - 6)) continue;
      let s = surfs.get(el); if (!s) { s = { el, acc: null, dead: false, cw: -9 }; surfs.set(el, s); }
      // верхняя кромка скруглена: плоская часть начинается после радиуса углов
      if (Math.abs(r.width - s.cw) > 1) { const cs = getComputedStyle(el), m = Math.min(r.width, r.height) / 2; s.rl = Math.min(m, parseFloat(cs.borderTopLeftRadius) || 0); s.rr = Math.min(m, parseFloat(cs.borderTopRightRadius) || 0); s.cw = r.width; }
      const l = r.left + s.rl, rr = r.right - s.rr; if (rr - l < 24) { if (s.acc) { s.dead = true; surfs.delete(el); } continue; }
      s.l = l; s.r = rr; s.t = Math.round(r.top); s.b = r.bottom; s.w = rr - l; s.dead = false; seen.add(el); n++;
      const cells = Math.max(1, Math.ceil(s.w / CELL)); if (!s.acc) { s.acc = new Acc(cells); if (live && P().max) seed(s, .5); } else s.acc.resize(cells);
    }
    for (const [el, s] of surfs) if (!seen.has(el)) { s.dead = true; surfs.delete(el); }
    floor.r = W; floor.t = H; floor.b = H + 40; floor.acc.resize(Math.ceil(W / CELL));
    wet = []; wetTot = 0; for (const s of surfs.values()) if (s.acc) { wetTot += s.w; wet.push({ s, c: wetTot }); }
    list = [...surfs.values(), floor]; dirty = false;
  }
  let live = false, wet = [], wetTot = 0, rillN = 0;
  const pickWet = () => { const r = Math.random() * wetTot; for (const w of wet) if (r <= w.c) return w.s; return null; };
  function seed(s, f = 1) { const p = P(), a = s.acc; for (let k = 0; k < a.n / 40 * f; k++) { const c = (Math.random() * a.n) | 0, len = (rnd(4, 18)) | 0; for (let i = c; i < Math.min(a.n, c + len); i++) { a.h[i] = Math.min(p.max, 1 + ((Math.random() * 2) | 0)); a.c[i] = (Math.random() * p.col.length) | 0; } } }
  const surfAt = (x, y0, y1, skip) => { let best = null, bt = 1e9;
    for (const s of list) { if (s === skip || x < s.l || x > s.r) continue; const g = ground(s, x); if (y0 <= g + 1 && y1 >= g && g < bt) { best = s; bt = g; } } return best; };
  const randSurf = (minW = 60, notFloor = false) => { const c = list.filter(s => (s.floor ? !notFloor : s.w >= minW)); return c.length ? pick(c) : null; };

  // ---------- частицы ----------
  function spawnFall() {
    const p = P(), t = p.fall, x = rnd(0, W);
    if (t === 'flake') parts.push({ t, x, y: -4, vx: 0, vy: rnd(28, 52), ph: rnd(0, 6.3), s: Math.random() < .35 ? 1 : 2 });
    else if (t === 'drop') { const z = rnd(.55, 1); parts.push({ t, x, y: -8, vx: -40 * z, vy: rnd(420, 560) * (.7 + .3 * z), z, s: 1 }); }
    else if (t === 'grain') parts.push({ t, x: rnd(-40, W), y: rnd(-20, H * .4), vx: rnd(14, 34), vy: rnd(14, 28), s: 2 });
    else parts.push({ t, x, y: -8, vx: 0, vy: rnd(24, 40), ph: rnd(0, 6.3), s: 4, ci: (Math.random() * 4) | 0, fl: Math.random() < .5 });
  }
  const want = () => !P().fall ? 0 : Math.round((theme === 'spring' ? 100 : theme === 'cold' ? 120 : theme === 'autumn' ? 30 : 46) * (weak ? .55 : 1) * clamp(W * H / 900000, .7, 1.4));
  // Частица, достигшая поверхности/края, возвращается в случайную точку верхних ~3/4 окна (плавно проявляясь),
  // поэтому осадки равномерно достаются и нижним поверхностям, а не только самой верхней карточке.
  function respawn(q) { q.x = rnd(0, W); q.y = rnd(-30, H * .75); q.al = 0; if (q.t === 'grain') q.x = rnd(-40, W * .7); if (q.t === 'drop') { q.y = rnd(-60, H * .6); q.al = 0; q.z = rnd(.55, 1); q.vy = rnd(420, 560) * (.7 + .3 * q.z); q.vx = -40 * q.z;
      if (wet.length && Math.random() < .6) { const s = pickWet(); if (s) { q.x = rnd(s.l, s.r); q.y = Math.max(-40, s.t - rnd(16, 150)); } } } }   // над блоком: нижние кнопки мочит так же, как верхние
  
  function updParts(dt) {
    const lim = caps().parts; let fallers = 0, rn = 0;
    const wind = Math.sin(tick * .35) * 14 + Math.sin(tick * .9) * 5;   // плавный порыв ветра для капель
    for (let k = parts.length - 1; k >= 0; k--) {
      const q = parts[k]; let y0 = q.y; if (q.t === 'rill') rn++; if (q.al < 1) q.al = Math.min(1, q.al + dt * (q.t === 'drop' ? 7 : 1.5));
      if (q.t === 'flake' || q.t === 'leaf' || q.t === 'grain' || q.t === 'drop') fallers++;
      if (q.t === 'flake') { q.x += Math.sin(tick * 1.1 + q.ph) * 18 * dt; q.y += q.vy * dt; }
      else if (q.t === 'leaf') { q.x += Math.sin(tick * 1.3 + q.ph) * 34 * dt + 6 * dt; q.y += q.vy * dt; }
      else if (q.t === 'grain') { q.x += q.vx * dt; q.y += q.vy * dt; }
      else if (q.t === 'drop') { q.x += (q.vx + wind * q.z) * dt; q.y += q.vy * dt; }
      else if (q.t === 'splash') { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 500 * dt; if (q.life <= 0) { parts[k] = parts[parts.length - 1]; parts.pop(); } continue; }
      else { q.x += q.vx * dt; q.vy += (q.t === 'drip' ? 700 : q.t === 'rill' ? 220 : G) * dt; if (q.t === 'rill' && q.vy > 120) q.vy = 120; q.y += q.vy * dt; if (q.fade != null) { q.fade -= dt; if (q.fade <= 0) { parts[k] = parts[parts.length - 1]; parts.pop(); continue; } } }
      const s = q.vy > 0 || q.t !== 'chip' ? surfAt(q.x, y0, q.y, q.src) : null;
      if (s) {
        const dep = q.t === 'drop' ? Math.random() < .65 : q.t === 'flake' ? Math.random() < .95 : true;
        if (dep && !(s.floor && theme === 'spring')) deposit(s, q.x, q.t === 'leaf' ? q.ci : q.t === 'chip' ? 0 : null);
        if (q.t === 'drop' && parts.length < lim) for (let i = 0; i < 2; i++) parts.push({ t: 'splash', x: q.x, y: s.t - colH(s, q.x) - 1, vx: rnd(-26, 26), vy: rnd(-90, -50), life: .26, s: 1 });
        if (q.t === 'flake' || q.t === 'leaf' || q.t === 'grain' || q.t === 'drop') respawn(q);
        else { parts[k] = parts[parts.length - 1]; parts.pop(); }
        continue;
      }
      if (q.y > H + 12 || q.x > W + 60 || q.x < -60) {
        if (q.t === 'flake' || q.t === 'leaf' || q.t === 'grain' || q.t === 'drop') respawn(q);
        else { parts[k] = parts[parts.length - 1]; parts.pop(); }
      }
    }
    rillN = rn;
    if (!leaving) { const w = want(); while (fallers < w && parts.length < lim) { spawnFall(); fallers++; parts[parts.length - 1].y = rnd(-H * .5, H * .3); } }
  }

  // ---------- существа ----------
    function newEnt(type, s, x) { const sp = type === 'cat' ? PX.cat : type === 'frog' ? PX.frog : type === 'squirrel' ? PX.squirrel : type === 'crab' ? PX.crab : type === 'snowman' ? PX.snowman : type === 'castle' ? PX.castle : type === 'acorn' ? PX.acorn : PX.plow;
    const e = { type, sp, x, y: s ? ground(s, x) : 0, vx: 0, vy: 0, surf: s, off: s ? x - s.l : 0, face: Math.random() < .5 ? 1 : -1, st: 'idle', tm: rnd(.2, 1.6), fr: 0, ft: 0, a: 1, life: rnd(50, 120), stat: ['snowman', 'castle', 'acorn'].includes(type), carry: false, load: 0, ph: Math.random() * 4, bl: rnd(1, 4) };
    return e; }
  const limit = () => theme === 'night' ? (maxEnt ? Math.max(1, Math.round(maxEnt * .45)) : 0) : maxEnt;
  function moving() { let n = 0; for (const e of ents) if (!e.stat && e.type !== 'plow') n++; return n; }
  function spawnCreature() {
    const type = ({ spring: 'frog', autumn: 'squirrel', warm: 'crab', night: 'cat' })[theme]; if (!type) return;
    const up = list.filter(o => !o.floor && o.w >= 50 && o.t < H * .78), s = up.length ? pick(up) : randSurf(50); if (!s) return; const x = rnd(s.l + 10, s.r - 10), e = newEnt(type, s, clamp(x, 10, W - 10));
    e.surf = null; e.st = 'air'; e.y = s.t - colH(s, e.x) - rnd(26, 70); e.a = 0; e.fr = 1; ents.push(e);
  }
  function spawnStatic() {
    const cnt = t => ents.filter(e => e.type === t).length;
    if (theme === 'cold' && cnt('snowman') < 6) { const s = randSurf(90); if (s) ents.push(newEnt('snowman', s, rnd(s.l + 14, s.r - 14))); }
    if (theme === 'warm' && cnt('castle') < 5) { const s = randSurf(90); if (s) ents.push(newEnt('castle', s, rnd(s.l + 14, s.r - 14))); }
    if (theme === 'autumn' && cnt('acorn') < 6) { const s = randSurf(60); if (s) ents.push(newEnt('acorn', s, rnd(s.l + 8, s.r - 8))); }
  }
  function spawnPlow(onFloor) {
    if (theme !== 'cold' || ents.filter(e => e.type === 'plow').length >= 3) return;
    const top = list.filter(o => !o.floor && o.w >= 160 && o.t < H * .6); plowTop = !plowTop; const s = onFloor || !plowTop || !top.length ? floor : pick(top), dir = Math.random() < .5 ? 1 : -1, e = newEnt('plow', s, dir > 0 ? s.l - 30 : s.r + 30);
    e.face = dir; e.st = 'drive'; e.stat = false; e.life = 1e9; ents.push(e);
  }
  function breakSnowman(e) { for (let i = 0; i < 10; i++) if (parts.length < caps().parts + 20) parts.push({ t: 'chip', x: e.x + rnd(-5, 5), y: e.y - rnd(2, 20), vx: rnd(-70, 70), vy: rnd(-150, -40), s: 2, fade: 3 }); e.dead = true; }
  const hopTo = (e, tx, ty, T) => { e.surf = null; e.st = 'air'; e.vx = (tx - e.x) / T; e.vy = (ty - e.y) / T - .5 * G * T; e.face = tx >= e.x ? 1 : -1; e.fr = 1; };
  function nearSurf(e, maxDx, dy0, dy1) { const c = list.filter(o => o !== e.surf && !o.floor && o.t > 50 && o.r > e.x - maxDx && o.l < e.x + maxDx && o.t - e.y > dy0 && o.t - e.y < dy1); return c.length ? pick(c) : null; }

  function updEnt(e, dt) {
    if (leaving) e.a -= dt * (1 / .45); else if (e.a < 1 && e.st !== 'gone') e.a = Math.min(1, e.a + dt * 3);
    if (e.a <= 0 && (leaving || e.st === 'gone')) { e.dead = true; return; }
    if (!e.stat && e.type !== 'plow' && !leaving) { e.life -= dt; if (e.life <= 0) e.st = 'gone', e.a -= dt * 2; }
    if (e.surf && e.surf.dead) { e.surf = null; if (e.stat) { e.dead = true; return; } e.vx = e.vy = 0; if (e.type === 'plow') { e.surf = floor; e.off = clamp(e.x, -40, W + 40); e.st = 'drive'; } else { e.st = 'gone'; e.life = 0; spawnT = Math.min(spawnT, .15); } }   // вкладка сменилась: существо растворяется и появляется выше на новой поверхности
    if (e.surf) { e.x = e.surf.l + e.off; e.y = ground(e.surf, e.x); }
    if (e.st === 'air') {
      const y0 = e.y; e.x += e.vx * dt; e.y += e.vy * dt; e.vy += G * dt;
      if (e.vy > 0) { const s = surfAt(e.x, y0, e.y); if (s) { e.surf = s; e.off = e.x - s.l; e.y = ground(s, e.x); e.st = 'idle'; e.vx = e.vy = 0; e.fr = 0; e.tm = e.pend != null ? e.pend : rnd(.3, 1.4); e.pend = null; if (e.type === 'frog') e.squash = .12; } }
      if (e.y > H + 60 || e.x < -80 || e.x > W + 80) e.dead = true; return;
    }
    if (e.stat || e.st === 'gone') { return; }
    if (e.type === 'plow') return plowStep(e, dt);
    if (e.type === 'frog') { e.tm -= dt; e.fr = 0; if (e.squash > 0) e.squash -= dt;
      if (e.tm <= 0 && e.surf) { const S = e.surf, r = Math.random(); let tx, ty, T = .4;
        if (r < .28) { const o = nearSurf(e, 150, -80, 120); if (o) { tx = clamp(e.x + rnd(-50, 50), o.l + 6, o.r - 6); ty = ground(o, tx); T = .5 + Math.abs(tx - e.x) / 400; hopTo(e, tx, ty, T); return; } }
        if (r < .5) e.face *= -1; tx = e.x + e.face * rnd(14, 42); if (tx < S.l + 6 || tx > S.r - 6) { e.face *= -1; tx = clamp(e.x + e.face * rnd(14, 42), S.l + 6, S.r - 6); }
        hopTo(e, tx, ground(S, tx), .34 + Math.abs(tx - e.x) / 260); e.tm = Math.random() < .25 ? rnd(2.5, 6) : rnd(.5, 2.4); e.pend = e.tm; }
      return; }
    if (e.type === 'cat') return cat(e, dt);
    if (e.type === 'squirrel' || e.type === 'crab') return walker(e, dt);
  }

  // Кошка: независимый автомат состояний. Кадры: 0/1 шаг, 2/3 сидит (хвост), 4/5 смотрит вверх, 6 моргнула, 7/8 спит
  function catNext(e) {
    const r = Math.random(), S = e.surf, canSleep = S && S.w >= 70;
    if (r < .38) { e.st = 'walk'; e.tm = rnd(2.5, 7); if (Math.random() < .4) e.face *= -1; }
    else if (r < .6) { e.st = 'sit'; e.tm = rnd(2, 6); }
    else if (r < .82 || !canSleep) { e.st = 'look'; e.tm = rnd(4, 10); }
    else { e.st = 'sleep'; e.tm = rnd(10, 24); }
    e.ft = 0; e.bl = rnd(1.5, 5);
  }
  function cat(e, dt) {
    const S = e.surf; if (!S) return; e.tm -= dt; e.ft += dt;
    if (e.st === 'walk') {
      e.off += e.face * 22 * dt; if (e.ft > .16) { e.ft = 0; e.fr ^= 1; }
      const x = S.l + e.off;
      if (x < S.l + 8 || x > S.r - 8) { const dir = x < S.l + 8 ? -1 : 1, edge = dir > 0 ? S.r : S.l; e.off = clamp(e.off, 8, S.w - 8);
        const o = nearSurf(e, 90, -110, 110); if (o && Math.random() < .55) { const tx = clamp(edge + dir * 30, o.l + 8, o.r - 8); hopTo(e, tx, ground(o, tx), .5 + Math.abs(ground(o, tx) - e.y) / 500); e.pend = rnd(1, 3); return; }
        e.face = -dir; }
      if (e.tm <= 0) catNext(e); return;
    }
    if (e.st === 'idle') { e.st = 'sit'; e.tm = e.tm > 0 ? e.tm : rnd(1, 3); }
    const al = Math.floor(tick / (e.st === 'sleep' ? 1.3 : .8) + e.ph) & 1;
    if (e.st === 'sleep') e.fr = 7 + al;
    else { e.fr = (e.st === 'look' ? 4 : 2) + al; e.bl -= dt; if (e.bl < 0) { e.fr = 6; if (e.bl < -.14) e.bl = rnd(2, 6.5); } }
    if (e.tm <= 0) catNext(e);
  }
  function walker(e, dt) {
    const S = e.surf; if (!S) return; const sq = e.type === 'squirrel', spd = sq ? 38 : 24;
    if (e.st === 'climb') { e.cl.y -= 34 * dt; e.y = e.cl.y; e.x = e.cl.x; if (e.y <= e.cl.top) { const C = e.cl.to; e.surf = C; e.off = clamp(e.x - C.l + e.face * 10, 6, C.w - 6); e.st = 'idle'; e.cl = null; e.tm = rnd(.3, 1); } return; }
    if (e.st === 'eat') { e.tm -= dt; e.fr = 3; if (e.tm <= 0) { e.carry = false; e.st = 'idle'; e.tm = rnd(.4, 1.2); } return; }
    if (e.st === 'idle') { e.tm -= dt; e.fr = sq ? 2 : (Math.floor(tick * 2) % 2); if (e.tm <= 0) { e.st = 'walk'; e.tm = rnd(2, 6); if (Math.random() < .35) e.face *= -1;
      if (sq && !e.carry) { const a = ents.find(o => o.type === 'acorn' && !o.dead && o.surf === S && Math.abs(o.x - e.x) < 140); if (a && Math.random() < .7) { e.goal = a; e.face = a.x > e.x ? 1 : -1; } } } return; }
    // ходьба
    e.off += e.face * spd * dt; e.ft += dt; if (e.ft > (sq ? .11 : .09)) { e.ft = 0; e.fr = e.fr === 0 ? 1 : 0; } if (sq && e.fr > 1) e.fr = 0;
    e.tm -= dt;
    if (e.goal) { if (e.goal.dead) e.goal = null; else if (Math.abs(e.goal.x - (S.l + e.off)) < 7) { e.goal.dead = true; e.goal = null; e.carry = true; e.st = 'eat'; e.tm = rnd(2, 3.2); return; } }
    else if (e.tm <= 0) { e.st = 'idle'; e.tm = rnd(.7, 2.6); return; }
    const x = S.l + e.off;
    if (x < S.l + 5 || x > S.r - 5) {
      const dir = x < S.l + 5 ? -1 : 1, edge = dir > 0 ? S.r : S.l; e.off = clamp(e.off, 5, S.w - 5);
      if (sq) { const C = list.find(o => !o.floor && o !== S && o.t < S.t - 12 && o.t > S.t - 130 && S.t <= o.b + 4 && (dir > 0 ? Math.abs(o.l - edge) < 22 : Math.abs(o.r - edge) < 22)); if (C && Math.random() < .6) { e.st = 'climb'; e.face = dir; e.cl = { x: dir > 0 ? C.l - 3 : C.r + 3, y: e.y, top: C.t, to: C }; e.fr = 0; return; } }
      const o = nearSurf(e, 70, -26, 90); if (o && Math.random() < (sq ? .5 : .3)) { const tx = clamp(edge + dir * 26, o.l + 6, o.r - 6); hopTo(e, tx, ground(o, tx), .45); return; }
      e.face = -dir; }
  }
  function plowStep(e, dt) {
    const S = e.surf || floor, sp = S.floor ? 62 : 46; e.off += e.face * sp * dt; e.x = S.l + e.off; e.ft += dt; if (e.ft > .12) { e.ft = 0; e.fr ^= 1; }
    e.y = S.floor ? H : S.t; const fx = e.x + e.face * 20;
    if (S.acc) { const a = S.acc; for (let k = -2; k <= 2; k++) { const i = clamp((((fx + e.face * k * CELL) - S.l) / CELL) | 0, 0, a.n - 1); while (a.h[i] > 0 && e.load < 70) { a.h[i]--; e.load++; } } }
    for (const o of ents) if (o.type === 'snowman' && !o.dead && o.surf === S && Math.abs(o.x - fx) < 12) breakSnowman(o);
    const end = e.face > 0 ? (S.floor ? W + 50 : S.r) : (S.floor ? -50 : S.l);
    if ((e.face > 0 && e.x > end) || (e.face < 0 && e.x < end)) {
      if (!S.floor && e.load > 0) for (let i = 0; i < Math.min(12, e.load / 3); i++) parts.push({ t: 'chip', x: end, y: S.t - rnd(2, 10), vx: e.face * rnd(10, 60), vy: rnd(-90, -20), s: 2, fade: 2 });
      e.load = 0; e.dead = true; }
    if (!S.floor) e.surf = S;
  }

  // ---------- рисование ----------
  function drawAcc() {
    const p = P();
    for (const s of list) { const a = s.acc; if (!a || (s.t < 40 && !s.floor)) continue; const n = a.n, h = a.h, c = a.c; let i = 0;
      while (i < n) { if (!h[i]) { i++; continue; } let j = i + 1; while (j < n && h[j] === h[i] && c[j] === c[i]) j++;
        const hh = h[i] * CELL, x = Math.round(s.l + i * CELL), w = (j - i) * CELL; cx.fillStyle = p.col[c[i] % p.col.length]; cx.fillRect(x, s.t - hh, w, hh);
        if (p.hi) { cx.fillStyle = p.hi[c[i] % p.hi.length]; cx.fillRect(x, s.t - hh, w, CELL); cx.fillStyle = '#3d1c0c'; cx.fillRect(x, s.t - hh - 1, w, 1); if (hh > 4) { cx.fillRect(x + (i % 3) * CELL, s.t - hh + 4, CELL, 1); } }
        if (p.top) { cx.fillStyle = p.top; cx.fillRect(x, s.t - hh, w, CELL); } i = j; } }
  }
  function drawEnt(e) {
    const sp = e.sp; if (!sp) return; const f = sp.fr[Math.min(e.fr, sp.fr.length - 1)], img = f[e.face < 0 ? 1 : 0];
    cx.globalAlpha = A * clamp(e.a, 0, 1); const w = sp.w, h = sp.h, px = Math.round(e.x - w / 2);
    if (e.st === 'climb') { cx.save(); cx.translate(Math.round(e.x), Math.round(e.y)); cx.rotate(e.face > 0 ? -Math.PI / 2 : Math.PI / 2); cx.drawImage(sp.fr[0][e.face < 0 ? 1 : 0], -w / 2, -h); cx.restore(); }
    else if (e.type === 'plow') { cx.drawImage(img, px, Math.round(e.y - h)); if (e.load > 0) { cx.fillStyle = '#f4f9ff'; const n = Math.min(14, Math.ceil(e.load / 5)); for (let i = 0; i < n; i++) { const bx = e.x + e.face * (w / 2 + 2 + (i % 4) * 2), by = e.y - 2 - ((i / 4) | 0) * 2; cx.fillRect(Math.round(bx), Math.round(by), 2, 2); } } }
    else { let sy = 1; if (e.type === 'frog' && e.squash > 0) sy = .85; const yy = Math.round(e.y - h * sy); if (sy < 1) cx.drawImage(img, px, yy, w, Math.round(h * sy)); else cx.drawImage(img, px, yy);
      if (e.type === 'cat' && e.st === 'sleep') { const k = (tick * .7 + e.ph) % 1.6; cx.globalAlpha = A * clamp(1 - k / 1.6, 0, 1) * .8; cx.fillStyle = '#cfd8ff'; const zx = Math.round(e.x + 8 + k * 6), zy = Math.round(e.y - h - 2 - k * 10); cx.fillRect(zx, zy, 4, 2); cx.fillRect(zx + 2, zy + 2, 2, 2); cx.fillRect(zx, zy + 4, 4, 2); } }
    cx.globalAlpha = A;
  }
  function drawParts() {
    for (const q of parts) { cx.globalAlpha = q.al < 1 ? A * q.al : A; if (q.t === 'flake') { cx.fillStyle = '#fff'; cx.fillRect(q.x, q.y, q.s, q.s); }   // дробные координаты: снег плывёт плавно, без шагов по пикселям
      else if (q.t === 'drop') {   // капля со следом: длина ~ путь за 25 мс, хвост гаснет — без «рывков» штрихов
        const L = Math.max(6, q.vy * .025), a = A * q.al * (.3 + .5 * q.z), x = q.x;
        cx.fillStyle = '#aad7ff'; cx.globalAlpha = a; cx.fillRect(x, q.y - L * .4, 1, L * .4);
        cx.globalAlpha = a * .5; cx.fillRect(x, q.y - L * .75, 1, L * .35); cx.globalAlpha = a * .2; cx.fillRect(x, q.y - L, 1, L * .25); }
      else if (q.t === 'splash') { cx.fillStyle = '#bee2ff'; cx.globalAlpha = A * clamp(q.life / .26, 0, 1) * .85; cx.fillRect(q.x, q.y, 1.5, 1.5); }
      else if (q.t === 'rill') { cx.fillStyle = 'rgba(120,190,255,.85)'; cx.fillRect(Math.round(q.x), Math.round(q.y), 1, 3 + Math.min(3, (q.vy / 40) | 0)); }
      else if (q.t === 'drip') { cx.fillStyle = 'rgba(120,190,255,.9)'; cx.fillRect(Math.round(q.x), Math.round(q.y), 2, 3); }
      else if (q.t === 'grain') { cx.fillStyle = '#e8c97e'; cx.fillRect(q.x, q.y, 2, 2); }
      else if (q.t === 'chip') { cx.globalAlpha = A * (q.fade != null ? clamp(q.fade, 0, 1) : 1); cx.fillStyle = '#f4f9ff'; cx.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); cx.globalAlpha = A; }
      else { const L = PX.leaf[q.ci % PX.leaf.length]; cx.drawImage(L[(Math.floor(tick * 2.5 + q.ph) & 1)], Math.round(q.x), Math.round(q.y)); } }
    cx.globalAlpha = A;
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const el = now - last; if (weak && el < 22) return; const dt = Math.min(.05, el / 1000); last = now; tick += dt;
    if (A !== tA) { A = tA > A ? Math.min(tA, A + dt * aStep) : Math.max(tA, A - dt * aStep); if (A <= 0 && tA === 0) return finish(); }
    if (++nf > 150) { nf = 0; if (slow > 90) { maxEnt = Math.max(2, Math.floor(maxEnt * .7)); } slow = 0; } else if (el > (weak ? 55 : 30)) slow++;
    if (dirty || now > nextRefresh) { refresh(); nextRefresh = now + 400; }
    tick2(dt);
    cx.clearRect(0, 0, W, H); cx.globalAlpha = A; drawAcc(); for (const e of ents) drawEnt(e); drawParts(); cx.globalAlpha = 1;
  }
  let rx = 0, fl = 1, plowTop = false;
  function tick2(dt) {
    if (!leaving) { spawnT -= dt; if (spawnT <= 0) { spawnT = rnd(.4, 1.8); if (moving() < limit()) spawnCreature(); }
      staticT -= dt; if (staticT <= 0) { staticT = rnd(2, 5); spawnStatic(); } plowT -= dt; if (plowT <= 0) { plowT = rnd(6, 12); spawnPlow(); } }
    fl -= dt; if (fl <= 0) { fl = 1; let tot = 0, low = 0; for (const e of ents) if (!e.stat && e.type !== 'plow' && e.st !== 'gone') { tot++; if (e.surf === floor) low++; }
      if (tot >= 3 && low * 2 > tot) { for (const e of ents) if (e.surf === floor && !e.stat && e.type !== 'plow') { e.st = 'gone'; e.life = 0; } spawnT = 0; } }   // большинство внизу → растворяются и появляются выше
    rx -= dt; if (rx <= 0) { rx = .12; relax(); }
    updParts(dt); for (let i = ents.length - 1; i >= 0; i--) { const e = ents[i]; updEnt(e, dt); if (e.dead) { ents[i] = ents[ents.length - 1]; ents.pop(); } }
  }
  function finish() { live = false; cancelAnimationFrame(raf); raf = 0; run = false; ents = []; parts = []; surfs.clear(); list = []; cx.clearRect(0, 0, W, H); cv.width = cv.height = 1; W = H = 0; theme = ''; A = tA = 0; leaving = false; const d = doneCb; doneCb = null; if (d) d(); }
  function size() { W = cv.width = innerWidth; H = cv.height = innerHeight; cx.imageSmoothingEnabled = false; dirty = true; }
  function init() {
    cv = document.createElement('canvas'); cv.id = 'wx-pane'; (document.getElementById('app') || document.body).append(cv); cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
    floor = { el: null, floor: true, l: 0, r: 0, t: 0, b: 0, w: 1, acc: new Acc(1), dead: false }; size();
    addEventListener('resize', () => { if (run) size(); });
    const mark = () => { dirty = true; };
    document.addEventListener('scroll', mark, true); document.addEventListener('click', () => setTimeout(mark, 60), true);
    document.addEventListener('visibilitychange', () => { if (!run) return; if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } });
    addEventListener('pagehide', () => finish());
  }
  function start(th, instant, max) {
    if (!cv) init(); if (typeof max === 'number') maxEnt = clamp(max, 0, 24);
    if (run && theme === th && !leaving) { tA = 1; return; }
    finishNow(); theme = th; run = true; leaving = false; size(); ents = []; parts = []; floor.acc = new Acc(Math.ceil(W / CELL)); floor.l = 0; floor.r = W; floor.t = H;
    nextRefresh = 0; surfs.clear(); refresh(); live = true; if (P().max) { const f = instant ? 1 : .6; seed(floor, f); for (const s of surfs.values()) if (s.acc) seed(s, f); }
    spawnT = instant ? 0 : 1.2; staticT = instant ? 0 : 4; plowT = rnd(10, 22); A = instant ? 1 : 0; tA = 1; aStep = instant ? 9 : 1.6; last = performance.now(); if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    for (let i = 0; i < (instant ? 6 : 0); i++) spawnStatic();
  }
  function finishNow() { live = false; if (raf) cancelAnimationFrame(raf); raf = 0; run = false; ents = []; parts = []; if (cx) cx.clearRect(0, 0, W, H); const d = doneCb; doneCb = null; if (d) d(); }
  // Плавно убрать всё; промис выполняется, когда холст очищен
  function stop(fast) {
    return new Promise(res => { if (!run) return res(); leaving = true; tA = 0; aStep = fast ? 8 : 1.8; const prev = doneCb; doneCb = () => { if (prev) prev(); res(); }; if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } else if (document.hidden) finish(); });
  }
  const count = () => ents.filter(e => !e.stat && e.type !== 'plow').length;
  return { _t: { plow(f) { plowT = 1e9; spawnPlow(f); }, snowman() { spawnStatic(); } }, start, stop, setMax(n) { maxEnt = clamp(+n || 0, 0, 24); }, count, get max() { return maxEnt; },
    debug: () => ({ run, theme, ents: ents.length, moving: moving(), parts: parts.length, surfs: list.length, raf: !!raf, max: maxEnt, acc: list.reduce((n, s) => n + (s.acc ? s.acc.h.reduce((a, b) => a + b, 0) : 0), 0), plow: ents.some(e => e.type === 'plow'), floorAcc: floor ? floor.acc.h.reduce((a, b) => a + b, 0) : 0, load: (ents.find(e => e.type === 'plow') || {}).load || 0, snowmen: ents.filter(e => e.type === 'snowman').length }) };
})();
