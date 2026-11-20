'use strict';
/* SA Launcher — погодные темы: аксессуары логотипа, декор кнопок, «живая экосистема» внизу окна и плавные переходы.
 *
 * Режимы (считает app.js → wxMode()):
 *   full   — всё: частицы, аксессуар логотипа (с анимацией), декор кнопок, персонажи;
 *   static — «Экономия ресурсов» / prefers-reduced-motion: только статичный аксессуар на логотипе, без анимаций, частиц, персонажей и декора;
 *   off    — погодные эффекты выключены или тема не погодная.
 *
 * Переходы: два независимых слоя — «аксессуар» и «окружение» (частицы + декор + персонажи). Цикл pump() всегда идёт по порядку:
 *   1) убрать лишнее (анимация завершения прошлой темы) → 2) сменить палитру → 3) показать новое (вступительная анимация).
 * Новый запрос во время перехода не накладывается на текущий: текущий шаг ускоряется (playbackRate), цикл перечитывает актуальную цель,
 * промежуточные темы пропускаются. Все анимации — Web Animations, зарегистрированные в контексте: dispose() гасит их без остатка.
 */
const SAWeather = (() => {
  const KEY = { spring: 'rain', cold: 'snow', autumn: 'leaves', warm: 'sun' };
  const html = document.documentElement;
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const MAXACT = weak ? 1 : 2, MAXLEAF = weak ? 1 : 2;            // одновременно движущихся персонажей / летящих листьев
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mk = (cls, inner = '', tag = 'div') => { const e = document.createElement(tag); e.className = cls; if (inner) e.innerHTML = inner; return e; };
  let accRoot, fauna, ghostHost;
  const ctxs = new Set();

  // ---------- контекст: реестр анимаций с ускорением, паузой и полной очисткой ----------
  function makeCtx(rate = 1) {
    const anims = new Set(); let rt = rate; const ghost = mk('ghost', '', 'i'); ghostHost.append(ghost);
    const c = {
      dead: false, leaving: false, active: 0,
      get rate() { return rt; },
      setRate(r) { rt = r; anims.forEach(a => { try { a.updatePlaybackRate(r); } catch (_) {} }); },
      // Анимация элемента. Промис выполняется по завершении (и при отмене — тогда c.dead = true). commit:false — не оставлять итоговый стиль.
      anim(el, kf, o = {}) {
        if (c.dead || !el || !el.isConnected) return Promise.resolve();
        const { commit = true, ...opt } = o; let a;
        try { a = el.animate(kf, { fill: 'both', easing: 'ease', ...opt }); } catch (_) { return Promise.resolve(); }
        a.playbackRate = rt; if (document.hidden) a.pause(); anims.add(a);
        return a.finished.then(() => { anims.delete(a); if (commit && !c.dead) { try { a.commitStyles(); } catch (_) {} } try { a.cancel(); } catch (_) {} }, () => { anims.delete(a); });
      },
      wait: ms => c.anim(ghost, [{ opacity: 0 }, { opacity: 1 }], { duration: Math.max(1, ms), fill: 'none', commit: false }),
      skipWaits() { try { ghost.getAnimations().forEach(a => a.finish()); } catch (_) {} },   // обрывает паузы (уход темы не ждёт «отдыха» персонажей)
      pause() { anims.forEach(a => { try { a.pause(); } catch (_) {} }); },
      play() { anims.forEach(a => { try { a.play(); } catch (_) {} }); },
      get size() { return anims.size; },
      dispose() { c.dead = true; anims.forEach(a => { try { a.cancel(); } catch (_) {} }); anims.clear(); ghost.remove(); ctxs.delete(c); }
    };
    ctxs.add(c); return c;
  }

  // ---------- аксессуары логотипа (размеры в em: 1em = размер логотипа) ----------
  const LEAFPOS = [[-.06, -.04, -35, .36, 0], [.2, -.12, 22, .3, 2], [.6, -.08, -68, .34, 1], [.8, .06, 42, .38, 3], [.86, .6, -22, .36, 0], [.46, .76, 64, .32, 4], [-.08, .56, 14, .36, 1], [.08, .3, -50, .28, 2]];
  const ACC = {
    spring: {
      html: () => `<div class="um"><div class="pl">${SPR.pole()}</div><div class="cp">${SPR.canopy()}</div><div class="hd">${SPR.hand()}</div></div>`,
      async intro(c, r) {
        const um = r.querySelector('.um'), cp = r.querySelector('.cp');
        await Promise.all([
          c.anim(um, [{ transform: 'translate(.45em,.75em) rotate(-80deg) scale(.55)', opacity: 0 }, { transform: 'translate(0,0) rotate(-8deg) scale(1)', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.3,1.35,.5,1)' }),
          c.anim(cp, [{ transform: 'scaleX(.12)' }, { transform: 'scaleX(1.1)', offset: .6 }, { transform: 'scaleX(.97)', offset: .8 }, { transform: 'scaleX(1)' }], { duration: 700, delay: 460, easing: 'ease-out' })
        ]);
      },
      async outro(c, r) {
        const um = r.querySelector('.um'), cp = r.querySelector('.cp');
        await c.anim(cp, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(.12)' }], { duration: 380, easing: 'ease-in' });
        await c.anim(um, [{ transform: 'translate(0,0) rotate(-8deg) scale(1)', opacity: 1 }, { transform: 'translate(.45em,.75em) rotate(-80deg) scale(.55)', opacity: 0 }], { duration: 420, easing: 'ease-in' });
      }
    },
    cold: {
      html: () => `<div class="ht"><div class="hs">${SPR.hat()}</div><div class="pm">${SPR.pom()}</div></div>`,
      async intro(c, r) {
        const ht = r.querySelector('.ht'), pm = r.querySelector('.pm');
        await Promise.all([
          c.anim(ht, [{ transform: 'translateY(-1.1em) rotate(-48deg)', opacity: 0, easing: 'ease-in' }, { transform: 'translateY(.05em) rotate(-6deg)', opacity: 1, offset: .5, easing: 'ease-out' }, { transform: 'translateY(-.07em) rotate(-13deg)', offset: .74, easing: 'ease-in-out' }, { transform: 'translateY(0) rotate(-10deg)', opacity: 1 }], { duration: 900 }),
          c.anim(pm, [{ transform: 'rotate(46deg)' }, { transform: 'rotate(-24deg)', offset: .32 }, { transform: 'rotate(14deg)', offset: .58 }, { transform: 'rotate(-6deg)', offset: .8 }, { transform: 'rotate(0)' }], { duration: 1250, delay: 380, easing: 'ease-in-out' })
        ]);
      },
      async outro(c, r) {
        const ht = r.querySelector('.ht'), pm = r.querySelector('.pm');
        await Promise.all([
          c.anim(pm, [{ transform: 'rotate(0)' }, { transform: 'rotate(-26deg)', offset: .4 }, { transform: 'rotate(18deg)' }], { duration: 560, easing: 'ease-in-out' }),
          c.anim(ht, [{ transform: 'translateY(0) rotate(-10deg)', opacity: 1 }, { transform: 'translateY(-.2em) rotate(-2deg)', offset: .3 }, { transform: 'translateY(-.7em) rotate(22deg)', opacity: 0 }], { duration: 600, easing: 'ease-in' })
        ]);
      }
    },
    warm: {
      html: () => `<div class="sg">${SPR.shades()}</div><div class="sk">${SPR.spark()}</div>`,
      async intro(c, r) {
        const sg = r.querySelector('.sg'), sk = r.querySelector('.sk');
        await Promise.all([
          c.anim(sg, [{ transform: 'translateY(-.85em) rotate(-16deg)', opacity: 0, easing: 'ease-in' }, { transform: 'translateY(.04em) rotate(2deg)', opacity: 1, offset: .58, easing: 'ease-out' }, { transform: 'translateY(-.03em) rotate(-3deg)', offset: .8, easing: 'ease-in-out' }, { transform: 'translateY(0) rotate(-2deg)', opacity: 1 }], { duration: 800 }),
          c.anim(sk, [{ transform: 'scale(0) rotate(0)', opacity: 0 }, { transform: 'scale(1.25) rotate(70deg)', opacity: 1, offset: .5 }, { transform: 'scale(0) rotate(140deg)', opacity: 0 }], { duration: 640, delay: 760, easing: 'ease-out' })
        ]);
      },
      async outro(c, r) {
        await c.anim(r.querySelector('.sg'), [{ transform: 'translateY(0) rotate(-2deg)', opacity: 1 }, { transform: 'translateY(-.15em) rotate(-4deg)', offset: .25 }, { transform: 'translateY(-.7em) rotate(12deg)', opacity: 0 }], { duration: 520, easing: 'ease-in' });
      }
    },
    autumn: {
      html: () => LEAFPOS.map(([x, y, rot, s, ci], i) => `<div class="lf" data-r="${rot}" style="left:${x}em;top:${y}em;width:${s}em;transform:rotate(${rot}deg)">${SPR.leaf(SPR.LC[ci])}</div>`).join(''),
      async intro(c, r) {
        await Promise.all([...r.querySelectorAll('.lf')].map((l, i) => { const rot = +l.dataset.r, dir = i % 2 ? 1 : -1;
          return c.anim(l, [{ transform: `translate(${dir * .25}em,-1.3em) rotate(${rot - dir * 80}deg)`, opacity: 0, easing: 'ease-in' }, { opacity: 1, offset: .15 }, { transform: `translate(${-dir * .14}em,-.55em) rotate(${rot + dir * 40}deg)`, offset: .5, easing: 'ease-in-out' }, { transform: `translate(${dir * .07}em,-.2em) rotate(${rot - dir * 14}deg)`, offset: .8, easing: 'ease-out' }, { transform: `translate(0,0) rotate(${rot}deg)`, opacity: 1 }], { duration: 1050 + (i % 4) * 160, delay: i * 85 }); }));
      },
      async outro(c, r) {
        await Promise.all([...r.querySelectorAll('.lf')].map((l, i) => { const rot = +l.dataR || +l.dataset.r;
          return c.anim(l, [{ transform: `translate(0,0) rotate(${rot}deg)`, opacity: 1 }, { transform: `translate(${1.5 + (i % 3) * .2}em,${-.5 - (i % 2) * .3}em) rotate(${rot + 240}deg)`, opacity: 0 }], { duration: 620 + (i % 3) * 90, delay: i * 35, easing: 'ease-in' }); }));
      }
    }
  };

  // ---------- персонажи и объекты внизу окна ----------
  let active = 0;                                                  // сейчас движущихся персонажей (общий лимит)
  const rails = () => (document.querySelector('.rail') || { offsetWidth: 84 }).offsetWidth;
  const bounds = () => { const d = document.getElementById('dock'); return [rails() + 28, Math.max(rails() + 360, innerWidth - 22 - (d && d.children.length ? 326 : 0))]; };
  const place = (cls, inner, x, extra = '') => { const e = mk('cr ' + cls, `<div class="b">${inner}</div>`); e.style.left = x + 'px'; if (extra) e.style.cssText += extra; fauna.append(e); return e; };
  const flip = (e, dir) => { e.firstElementChild.style.transform = dir < 0 ? 'scaleX(-1)' : ''; e.dataset.d = dir; };
  const fadeOut = (c, els, ms = 420) => Promise.all(els.map(e => c.anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: ms, commit: false, fill: 'forwards' })));

  // Горизонтальное перемещение (transform), arc — высота дуги прыжка в px
  async function move(c, e, x1, { dur = 500, arc = 0, ease = 'ease-in-out' } = {}) {
    const x0 = parseFloat(e.style.left), dx = x1 - x0;
    const kf = arc ? [{ transform: 'translate(0,0)' }, { transform: `translate(${dx / 2}px,${-arc}px)`, offset: .5, easing: 'ease-in' }, { transform: `translate(${dx}px,0)` }] : [{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,0)` }];
    await c.anim(e, kf, { duration: dur, easing: arc ? 'ease-out' : ease, commit: false, fill: 'forwards' });
    if (!c.dead) e.style.left = x1 + 'px';
  }
  // Цикл «подождать → если есть свободное место для движущегося персонажа, запустить жизнь → отдохнуть»
  async function lane(c, first, minS, maxS, life) {
    await c.wait(first * 1000);
    while (!c.dead && !c.leaving) {
      if (active < MAXACT) { active++; c.active++; try { await life(); } catch (_) {} finally { active--; c.active--; } }
      if (c.dead || c.leaving) break;
      await c.wait(rnd(minS, maxS) * 1000);
    }
  }
  // Лист, слетающий с кучки и летящий по экрану (не персонаж: свой небольшой лимит)
  let flying = 0;
  async function flyLeaf(c, x, color) {
    if (flying >= MAXLEAF || c.dead) return; flying++;
    const e = mk('cr fl', SPR.leaf(color)); e.style.left = x + 'px'; fauna.append(e);
    try {
      const H = innerHeight, up = rnd(.22, .45) * H, dir = Math.random() < .75 ? 1 : -1, span = rnd(160, 420), n = 14, kf = [];
      for (let i = 0; i <= n; i++) { const t = i / n, rise = Math.sin(Math.min(1, t * 1.6) * Math.PI / 2) * up - Math.max(0, t - .45) * up * 1.1;
        kf.push({ transform: `translate(${dir * span * t + Math.sin(t * 9) * 28}px,${-Math.max(0, rise)}px) rotate(${t * 520 * dir + Math.sin(t * 7) * 40}deg)`, opacity: t < .08 ? t / .08 : t > .85 ? (1 - t) / .15 : 1 }); }
      await c.anim(e, kf, { duration: rnd(6500, 9500), easing: 'linear', commit: false, fill: 'forwards' });
    } finally { flying--; e.remove(); }
  }

  const SCENES = {
    // ---- дождь: лужи и лягушки ----
    spring(c, inst) {
      const [lo, hi] = bounds(), els = [], W = hi - lo, pud = [.12, .4, .66, .9].map((p, i) => place('puddle', SPR.puddle(), lo + W * p - 30 + rnd(-14, 14), `--d:${rnd(0, 3).toFixed(2)}s`));
      els.push(...pud);
      const frogLife = async k => {
        const [a, b] = bounds(), mid = (a + b) / 2, L = k === 0 ? [a, mid - 20] : [mid + 20, b - 50];
        const ps = pud.filter(p => { const x = parseFloat(p.style.left); return x >= L[0] - 40 && x <= L[1] + 40; }), start = parseFloat((pick(ps.length ? ps : pud)).style.left) + 8;
        const f = place('frog', SPR.frog(), clamp(start, L[0], L[1])); const body = f.firstElementChild; flip(f, Math.random() < .5 ? 1 : -1);
        c.frogs = (c.frogs || 0) + 1;
        try {
          await c.anim(f, [{ transform: 'translateY(.45em) scale(.3)', opacity: 0 }, { transform: 'translateY(-.15em) scale(1.08)', opacity: 1, offset: .65 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 420, easing: 'ease-out' });
          const hops = Math.round(rnd(3, 7));
          for (let i = 0; i < hops && !c.dead && !c.leaving; i++) {
            let dir = +f.dataset.d, x = parseFloat(f.style.left), dist = rnd(34, 82);
            if (x + dir * dist > L[1] || x + dir * dist < L[0]) dir = -dir; flip(f, dir);
            await c.anim(body, [{ transform: 'scale(1,1)' }, { transform: 'scale(1.14,.76)' }], { duration: 150, commit: false, fill: 'forwards' });
            c.anim(body, [{ transform: 'scale(.9,1.2)' }, { transform: 'scale(1,1)', offset: .55 }], { duration: 430, commit: false });
            await move(c, f, clamp(x + dir * dist, L[0], L[1]), { dur: 430, arc: 17 });
            await c.anim(body, [{ transform: 'scale(1.16,.72)' }, { transform: 'scale(1,1)' }], { duration: 220, commit: false });
            if (Math.random() < .5) { f.classList.add('sit'); await c.wait(rnd(1400, 3600)); f.classList.remove('sit'); }
            else await c.wait(rnd(120, 420));
          }
          await c.anim(f, [{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: 'translateY(.4em) scale(.3)', opacity: 0 }], { duration: 340, easing: 'ease-in', commit: false });
        } finally { f.remove(); }
      };
      return { els, lanes: [() => lane(c, rnd(2, 5), 5, 13, () => frogLife(0)), () => lane(c, rnd(5, 9), 6, 15, () => frogLife(1))] };
    },
    // ---- снег: снеговики и снегоуборочная машина ----
    cold(c, inst) {
      const [lo, hi] = bounds(), sm1 = place('snowman', SPR.snowman(), lo, `--d:${rnd(0, 3).toFixed(2)}s;--t:${rnd(3.2, 4.6).toFixed(2)}s`), sm2 = place('snowman sm', SPR.snowman(), hi - 36, `--d:${rnd(0, 3).toFixed(2)}s;--t:${rnd(3.4, 5).toFixed(2)}s`);
      const pl = place('pile', SPR.snowpile(), lo + 40), pr = place('pile', SPR.snowpile(), hi - 100), els = [sm1, sm2, pl, pr];
      let side = Math.random() < .5 ? 1 : -1;
      const drive = async () => {
        const a = parseFloat(pl.style.left) + 24, b = parseFloat(pr.style.left) - 30, from = side > 0 ? a : b, to = side > 0 ? b : a; side = -side;
        const p = place('plow run', SPR.plow(), from); p.style.zIndex = 0; flip(p, to > from ? 1 : -1);
        try {
          await c.anim(p, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, commit: true });
          await move(c, p, to, { dur: Math.abs(to - from) / 55 * 1000, ease: 'linear' });
          p.classList.remove('run'); await c.anim(p, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.88)' }], { duration: 420, commit: false });
        } finally { p.remove(); }
      };
      return { els, lanes: [() => lane(c, rnd(4, 8), 22, 44, drive)] };
    },
    // ---- солнце: песчаные замки и крабы ----
    warm(c, inst) {
      const [lo, hi] = bounds(), sand = place('sand', '', lo - 12); sand.style.width = (hi - lo + 52) + 'px';
      const c1 = place('castle', SPR.castle(), lo), c2 = place('castle sm', SPR.castle(), hi - 30), els = [sand, c1, c2];
      for (const p of [.3, .5, .72]) els.push(place('shell', `<svg class="sp" viewBox="0 0 10 8"><path d="M1 7c0-4 2-6 4-6s4 2 4 6z" fill="#f6b8c2" stroke="#1c2432" stroke-width="1" stroke-linejoin="round"/><path d="M5 1v6M3 2.6l.8 4.4M7 2.6l-.8 4.4" stroke="#d98a9a" stroke-width=".7" fill="none"/></svg>`, lo + (hi - lo) * p + rnd(-20, 20)));
      const crabLife = async k => {
        const [a, b] = bounds(), mid = (a + b) / 2, L = k === 0 ? [a + 50, mid - 24] : [mid + 24, b - 70];
        const e = place('crab', SPR.crab(), rnd(L[0], L[1])), body = e.firstElementChild; flip(e, Math.random() < .5 ? 1 : -1);
        try {
          await c.anim(e, [{ transform: 'translateY(.5em) scale(.4)', opacity: 0 }, { transform: 'translateY(-.1em) scale(1.05)', opacity: 1, offset: .7 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 420, easing: 'ease-out' });
          const runs = Math.round(rnd(3, 6));
          for (let i = 0; i < runs && !c.dead && !c.leaving; i++) {
            const x = parseFloat(e.style.left); let dir = Math.random() < .5 ? 1 : -1, dist = rnd(50, 150);
            if (x + dir * dist > L[1] || x + dir * dist < L[0]) dir = -dir; const to = clamp(x + dir * dist, L[0], L[1]); if (Math.abs(to - x) < 12) continue;
            flip(e, dir); e.classList.add('run'); await move(c, e, to, { dur: Math.abs(to - x) / 120 * 1000, ease: 'ease-in-out' }); e.classList.remove('run');
            const r = Math.random(); if (r < .5) { e.classList.add('wave'); await c.wait(rnd(1000, 2100)); e.classList.remove('wave'); } else await c.wait(rnd(300, 1100));
          }
          await c.anim(e, [{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: 'translateY(.45em) scale(.4)', opacity: 0 }], { duration: 360, easing: 'ease-in', commit: false });
        } finally { e.remove(); }
      };
      return { els, lanes: [() => lane(c, rnd(2, 5), 5, 12, () => crabLife(0)), () => lane(c, rnd(5, 9), 6, 14, () => crabLife(1))] };
    },
    // ---- листопад: белки, жёлуди, кучки листьев ----
    autumn(c, inst) {
      const [lo, hi] = bounds(), W = hi - lo, pl = place('lpile', SPR.leafpile(), lo), pr = place('lpile', SPR.leafpile(), hi - 52), els = [pl, pr], ac = [];
      for (const p of [.3, .7]) { const a = place('acorn', SPR.acorn(), lo + W * p); els.push(a); ac.push(a); }
      const respawn = async (a, k) => { await c.wait(rnd(4500, 8000)); if (c.dead) return; const [x, y] = bounds(), mid = (x + y) / 2, L = k === 0 ? [x + 80, mid - 40] : [mid + 40, y - 120]; a.style.left = rnd(L[0], L[1]) + 'px'; if (!c.leaving) await c.anim(a, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' }); };
      const run = async (e, to, spd = 130) => { const x = parseFloat(e.style.left); e.classList.add('run'); flip(e, to > x ? 1 : -1); const n = Math.max(1, Math.round(Math.abs(to - x) / 46)); for (let i = 1; i <= n && !c.dead; i++) await move(c, e, x + (to - x) * i / n, { dur: Math.abs(to - x) / n / spd * 1000, arc: 4, ease: 'linear' }); e.classList.remove('run'); };
      const squirrel = async k => {
        const a = ac[k], [x0, x1] = bounds(), fromLeft = k === 0 ? Math.random() < .7 : Math.random() < .3, start = fromLeft ? parseFloat(pl.style.left) + 20 : parseFloat(pr.style.left) + 10;
        const s = place('squirrel', SPR.squirrel(), start); s.style.zIndex = 0; const ax = parseFloat(a.style.left);
        try {
          await c.anim(s, [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 320 });
          const stand = ax + (fromLeft ? -34 : 6); await run(s, stand); if (c.dead) return;
          flip(s, fromLeft ? 1 : -1); s.classList.add('sit'); await c.wait(rnd(500, 900));
          a.style.opacity = 0; s.classList.add('has'); s.classList.add('nib'); await c.wait(rnd(1800, 3200)); s.classList.remove('nib', 'sit');
          const goLeft = Math.random() < .5, home = goLeft ? parseFloat(pl.style.left) + 20 : parseFloat(pr.style.left) + 10;
          await run(s, home, 140);
          await c.anim(s, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.8)' }], { duration: 300, commit: false });
        } finally { s.remove(); a.style.opacity = ''; respawn(a, k); }
      };
      const leaves = async () => { const side = Math.random() < .5 ? pl : pr; await flyLeaf(c, parseFloat(side.style.left) + rnd(8, 28), pick(SPR.LC)); };
      return { els, lanes: [() => lane(c, rnd(3, 6), 6, 14, () => squirrel(0)), () => lane(c, rnd(7, 11), 8, 18, () => squirrel(1)), () => lane(c, rnd(2, 5), 5, 11, leaves)] };
    }
  };

  // Запуск/остановка «окружения» темы (персонажи)
  function startFauna(theme, instant) {
    const c = makeCtx(1), sc = SCENES[theme](c, instant), tasks = [];
    html.dataset.wxf = '1';
    sc.els.forEach((e, i) => { e.classList.add('st'); if (!instant) { e.style.opacity = 0; c.anim(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: i * 70, commit: true }); } });
    sc.lanes.forEach(f => tasks.push(f()));
    const relayout = () => { if (c.dead) return; const [lo, hi] = bounds(); const L = sc.els; /* перераскладка неподвижных по краям при изменении размера окна */
      L.forEach((e, i) => { const s = e.dataset.side; if (s === 'r') e.style.left = hi - parseFloat(e.dataset.off || 0) + 'px'; }); };
    return {
      theme, c, relayout,
      async stop(fast) {
        c.leaving = true; c.skipWaits(); if (fast) c.setRate(4);
        await Promise.all(tasks);                               // персонажи заканчивают текущее движение и уходят
        await fadeOut(c, sc.els, fast ? 120 : 420);
        c.dispose(); sc.els.forEach(e => e.remove()); fauna.querySelectorAll('.cr').forEach(e => e.remove()); delete html.dataset.wxf; active = 0; flying = 0;
      },
      kill() { c.dead = true; c.dispose(); fauna.replaceChildren(); delete html.dataset.wxf; active = 0; flying = 0; }
    };
  }

  // ---------- состояние и переходы ----------
  const acc = { theme: null, mode: 'off', ctx: null }, amb = { theme: null, f: null };
  let want = null, pumping = false, interrupted = false, palTheme = undefined;
  const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches;

  function sync() {                                           // совместить слой аксессуаров с логотипом (он пересоздаётся при каждой перерисовке панели)
    if (!accRoot) return; const l = document.querySelector('.rail .logo'); if (!l) { accRoot.style.display = 'none'; return; }
    const r = l.getBoundingClientRect(); if (!r.width) return; accRoot.style.display = '';
    accRoot.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;--L:${r.width}px`;
  }
  async function accRemove(animate) {
    const t = acc.theme; if (!t) return; const c = makeCtx(interrupted ? 3 : 1); acc.ctx = c;
    if (animate) await ACC[t].outro(c, accRoot);
    c.dispose(); acc.ctx = null; accRoot.replaceChildren(); delete accRoot.dataset.t; acc.theme = null;
  }
  async function accAdd(theme, animate, mode) {
    sync(); accRoot.innerHTML = ACC[theme].html(); accRoot.dataset.t = theme; acc.theme = theme; acc.mode = mode;
    if (!animate) return; const c = makeCtx(interrupted ? 3 : 1); acc.ctx = c;
    await ACC[theme].intro(c, accRoot); c.dispose(); acc.ctx = null;
  }
  async function ambStart(theme, instant) {
    amb.theme = theme; html.dataset.wxd = theme; SAFx.start(theme, instant ? 0 : 700);
    amb.f = startFauna(theme, instant);
    if (!instant) { const c = makeCtx(interrupted ? 3 : 1); await c.wait(650); c.dispose(); }
  }
  async function ambStop() {
    const f = amb.f, fast = interrupted; delete html.dataset.wxd; SAFx.stop(fast ? 120 : 450);
    const c = makeCtx(fast ? 3 : 1);
    await Promise.all([f ? f.stop(fast) : 0, c.wait(450)]); c.dispose(); amb.theme = null; amb.f = null;
  }

  async function pump() {
    pumping = true;
    try {
      for (let guard = 0; guard < 40; guard++) {
        const w = want;
        const accOut = acc.theme && acc.theme !== w.accTheme, ambOut = amb.theme && amb.theme !== w.ambTheme;
        if (accOut || ambOut) { await Promise.all([accOut ? accRemove(acc.mode === 'full' && !w.instant) : 0, ambOut ? ambStop() : 0]); continue; }
        if (palTheme !== w.theme) { palTheme = w.theme; w.palette(); }
        const accIn = w.accTheme && !acc.theme, ambIn = w.ambTheme && !amb.theme;
        if (accIn || ambIn) { await Promise.all([accIn ? accAdd(w.accTheme, w.mode === 'full' && !w.instant, w.mode) : 0, ambIn ? ambStart(w.ambTheme, w.instant) : 0]); continue; }
        if (acc.theme) acc.mode = w.mode;
        w.palette(); break;
      }
    } finally { pumping = false; interrupted = false; sync(); }
  }
  // theme — ключ темы; mode — 'full' | 'static' | 'off'; palette() — применяет цвета темы (вызывается в нужный момент перехода)
  function apply({ theme, mode, instant, palette }) {
    if (!accRoot) init();
    const wx = !!KEY[theme] && mode !== 'off';
    want = { theme, mode: wx ? mode : 'off', instant: !!instant, palette: palette || (() => {}), accTheme: wx ? theme : null, ambTheme: wx && mode === 'full' ? theme : null };
    if (pumping) { interrupted = true; for (const c of ctxs) c.setRate(4); return; }   // идущий переход ускоряется и перечитывает цель
    if (acc.theme === want.accTheme && amb.theme === want.ambTheme && palTheme === theme) { if (acc.theme) acc.mode = want.mode; want.palette(); return; }
    if (!acc.theme && !amb.theme && !want.accTheme && !want.ambTheme) { palTheme = theme; want.palette(); return; }  // обычные темы — мгновенно
    pump();
  }
  let rz = 0;
  function init() {
    const app = document.getElementById('app') || document.body;
    ghostHost = mk('', '', 'i'); ghostHost.id = 'wx-g'; accRoot = mk('', ''); accRoot.id = 'wx-acc'; fauna = mk('', ''); fauna.id = 'wx-fauna';
    app.append(accRoot, fauna, ghostHost);
    addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { sync(); if (amb.f) amb.f.relayout(); }, 120); });
    document.addEventListener('visibilitychange', () => ctxs.forEach(c => document.hidden ? c.pause() : c.play()));
  }
  const debug = () => ({ pumping, acc: acc.theme, amb: amb.theme, ctxs: ctxs.size, anims: [...ctxs].reduce((n, c) => n + c.size, 0), creatures: fauna ? fauna.querySelectorAll('.cr').length : 0, moving: active, flying, fx: SAFx.active, decor: html.dataset.wxd || '', accChildren: accRoot ? accRoot.children.length : 0 });
  return { apply, sync, debug, reduced, KEY, get busy() { return pumping; } };
})();
