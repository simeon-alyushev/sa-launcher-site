'use strict';
/* SA Launcher — погодные темы: аксессуары логотипа, фон (fx.js), пиксельная «живая панель» (pane.js) и плавные переходы.
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
  const KEY = { spring: 'rain', cold: 'snow', autumn: 'leaves', warm: 'sun', night: 'night' };
  const html = document.documentElement;
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mk = (cls, inner = '', tag = 'div') => { const e = document.createElement(tag); e.className = cls; if (inner) e.innerHTML = inner; return e; };
  let accRoot, ghostHost;
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

  // ---------- аксессуары логотипа (пиксельные картинки из pixels.js; размеры в em: 1em = размер логотипа) ----------
  // Положение подобрано под логотип 1em×1em: зонт — купол шире логотипа и накрывает его сверху донизу до нижней трети,
  // шапка — по центру верхней кромки, меховая опушка заходит на логотип, очки — на уровне «глаз» логотипа.
  const img = (cls, src) => `<img class="${cls}" src="${src}" alt="" draggable="false">`;
  const ACC = {
    spring: {
      html: () => `<div class="umw">${img('um', PX.assets.umbrella)}</div>`,
      async intro(c, r) {
        const um = r.querySelector('.um');
        await c.anim(um, [{ transform: 'translateY(-.9em) scale(.25,.25)', opacity: 0 }, { transform: 'translateY(.04em) scale(1.06,.94)', opacity: 1, offset: .55, easing: 'ease-out' }, { transform: 'translateY(-.02em) scale(.98,1.03)', offset: .8 }, { transform: 'none', opacity: 1 }], { duration: 640, easing: 'ease-in' });
      },
      async outro(c, r) { await c.anim(r.querySelector('.um'), [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-.9em) scale(.25,.25)', opacity: 0 }], { duration: 420, easing: 'ease-in' }); }
    },
    cold: {
      html: () => img('ht', PX.assets.hat),
      async intro(c, r) {
        await c.anim(r.querySelector('.ht'), [{ transform: 'translateY(-1em) rotate(-30deg)', opacity: 0, easing: 'ease-in' }, { transform: 'translateY(.04em) rotate(-2deg)', opacity: 1, offset: .55, easing: 'ease-out' }, { transform: 'translateY(-.03em) rotate(-5deg)', offset: .78, easing: 'ease-in-out' }, { transform: 'rotate(-4deg)', opacity: 1 }], { duration: 760 });
      },
      async outro(c, r) { await c.anim(r.querySelector('.ht'), [{ transform: 'rotate(-4deg)', opacity: 1 }, { transform: 'translateY(-.15em) rotate(-2deg)', offset: .3 }, { transform: 'translateY(-.8em) rotate(18deg)', opacity: 0 }], { duration: 520, easing: 'ease-in' }); }
    },
    warm: {
      html: () => img('sg', PX.assets.shades),
      async intro(c, r) {
        await c.anim(r.querySelector('.sg'), [{ transform: 'translateY(-.8em)', opacity: 0, easing: 'ease-in' }, { transform: 'translateY(.04em)', opacity: 1, offset: .6, easing: 'ease-out' }, { transform: 'translateY(-.03em)', offset: .82, easing: 'ease-in-out' }, { transform: 'none', opacity: 1 }], { duration: 680 });
      },
      async outro(c, r) { await c.anim(r.querySelector('.sg'), [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-.12em)', offset: .25 }, { transform: 'translateY(-.7em)', opacity: 0 }], { duration: 460, easing: 'ease-in' }); }
    }
  };

  // ---------- окружение темы: фон (fx.js) + живая панель (pane.js) ----------
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
  let paneMax = 14;
  async function ambStart(theme, instant) {
    amb.theme = theme; if (SAFx.MODES.includes(theme)) SAFx.start(theme, instant ? 0 : 700);
    SAPane.start(theme, instant, paneMax);
    if (!instant) { const c = makeCtx(interrupted ? 3 : 1); await c.wait(450); c.dispose(); }
  }
  async function ambStop() {
    const fast = interrupted; SAFx.stop(fast ? 120 : 450);
    await SAPane.stop(fast); amb.theme = null;
  }
  // Статичное ночное небо в «Экономии ресурсов» (без мерцания и кошек)
  function fxStill(w) {
    if (w.mode === 'static' && w.theme === 'night') { if (SAFx.mode !== 'night' || SAFx.active) SAFx.still('night'); }
    else if (w.mode !== 'full' && SAFx.mode) SAFx.stop(0);
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
        w.palette(); fxStill(w); break;
      }
    } finally { pumping = false; interrupted = false; sync(); }
  }
  // theme — ключ темы; mode — 'full' | 'static' | 'off'; palette() — применяет цвета темы (вызывается в нужный момент перехода)
  function apply({ theme, mode, instant, palette }) {
    if (!accRoot) init();
    const wx = !!KEY[theme] && mode !== 'off';
    want = { theme, mode: wx ? mode : 'off', instant: !!instant, palette: palette || (() => {}), accTheme: wx && ACC[theme] ? theme : null, ambTheme: wx && mode === 'full' ? theme : null };
    if (pumping) { interrupted = true; for (const c of ctxs) c.setRate(4); return; }   // идущий переход ускоряется и перечитывает цель
    if (acc.theme === want.accTheme && amb.theme === want.ambTheme && palTheme === theme) { if (acc.theme) acc.mode = want.mode; want.palette(); fxStill(want); return; }
    if (!acc.theme && !amb.theme && !want.accTheme && !want.ambTheme) { palTheme = theme; want.palette(); fxStill(want); return; }  // обычные темы — мгновенно
    pump();
  }
  let rz = 0;
  function init() {
    const app = document.getElementById('app') || document.body;
    ghostHost = mk('', '', 'i'); ghostHost.id = 'wx-g'; accRoot = mk('', ''); accRoot.id = 'wx-acc';
    app.append(accRoot, ghostHost);
    addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(sync, 120); });
    document.addEventListener('visibilitychange', () => ctxs.forEach(c => document.hidden ? c.pause() : c.play()));
  }
  const debug = () => ({ pumping, acc: acc.theme, amb: amb.theme, ctxs: ctxs.size, anims: [...ctxs].reduce((n, c) => n + c.size, 0), pane: SAPane.debug(), fx: SAFx.active, fxMode: SAFx.mode, accChildren: accRoot ? accRoot.children.length : 0 });
  const setMax = n => { paneMax = Math.max(0, Math.min(20, +n || 0)); SAPane.setMax(paneMax); };
  return { apply, sync, debug, setMax, reduced, KEY, get busy() { return pumping; } };
})();
