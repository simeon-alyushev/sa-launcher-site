'use strict';
// Пиксельные спрайты (ASCII-карты). Один «пиксель арта» = 2 экранных пикселя, поэтому большинство существ ~20–30 px.
// Прозрачность — символ «.». Зеркальные варианты строятся один раз при загрузке.
const PX = (() => {
  const S = 2;
  const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // rows — массив строк; pal — { символ: цвет }
  function build(rows, pal, scale = S) {
    const w = Math.max(...rows.map(r => r.length)), h = rows.length, c = mkc(w * scale, h * scale), x = c.getContext('2d');
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const col = pal[r[i]]; if (col) { x.fillStyle = col; x.fillRect(i * scale, j * scale, scale, scale); } } });
    return c;
  }
  const flipC = c => { const f = mkc(c.width, c.height), x = f.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return f; };
  // Спрайт: несколько кадров, каждый в двух направлениях ([кадр][0 = вправо, 1 = влево])
  const sprite = (frames, pal) => { const fr = frames.map(r => { const c = build(r, pal); return [c, flipC(c)]; }); return { fr, w: fr[0][0].width, h: fr[0][0].height }; };

  // ---- лягушка (смотрит вправо) ----
  const FP = { k: '#10241b', g: '#5bb870', d: '#3d8c58', c: '#f2dfa2', w: '#ffffff', b: '#8bd49a' };
  const frog = sprite([[
    '......kkk.kkk',
    '.....kggwkwwk',
    '..kkkkgggwkwk',
    '.kggggggggggk',
    'kgdgggggggccc',
    'kgddgggggccck',
    'kgdddggggggck',
    '.kkggkkkgggk.',
    '...kkk..kkkk.'
  ], [
    '.............',
    '........kkkkk',
    '......kkgwkwk',
    '..kkkkggggwkk',
    '.kgggggggccck',
    'kgdggggggcck.',
    'kgddgggggkk..',
    '.kggkgggkk...',
    '..kkk.kkk....'
  ]], FP);
  // ---- краб ----
  const CP = { k: '#2a0a0a', c: '#c8261e', b: '#ee4a34', l: '#951a16', w: '#ffd8cc' };
  const crab = sprite([[
    'cc.......cc',
    'cbc.k.k.cbc',
    'cbbck.kcbbc',
    '.cbbbbbbbc.',
    '..cbwbbbc..',
    '..lbbbbbl..',
    '.l.l.l.l.l.'
  ], [
    'cc.......cc',
    'cbc.k.k.cbc',
    'cbbck.kcbbc',
    '.cbbbbbbbc.',
    '..cbwbbbc..',
    '..lbbbbbl..',
    'l.l.l.l.l.l'
  ]], CP);
  // ---- белка (смотрит вправо). Кадры: бег A/B, сидит, сидит с желудем ----
  const QP = { k: '#3a2416', b: '#b9825a', d: '#7d553a', c: '#f2d6ac', t: '#946447', a: '#8f2f1c', e: '#d9a47a' };
  const SQ_S = [
    '..tt..........',
    '.tddt....k.k..',
    'tdddt...kbbbk.',
    'tddddt..kbkbbc',
    'tdddtt..kbbbbc',
    '.tddtt...kbbk.',
    '..tddtkkbbbbk.',
    '..tdtkbbbbbbk.',
    '...ttkbbcccbk.',
    '....kbbcccbbk.',
    '....kdbbbbbdk.',
    '.....kkkkkkk..'];
  const SQ_A = SQ_S.map((r, i) => i === 11 ? '....kk.....kk.' : r);
  const SQ_B = SQ_S.slice(1).concat(['..............']);
  const SQ_E = SQ_S.map((r, i) => i === 5 ? '.tddt....kbbaa.' .slice(0, 14) : r);
  const squirrel = sprite([SQ_A, SQ_B, SQ_S, SQ_E], QP);
  // листья: объёмные 8×8 (контур, светлая и тёмная стороны, жилка), 4 цвета × 2 зеркальных кадра
  const shade = (hex, k) => '#' + [1, 3, 5].map(n => Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(n, 2), 16) * (1 + k)))).toString(16).padStart(2, '0')).join('');
  const LEAFR = ['...kk...', '..kLhk..', '.kLLhLk.', 'kLLLDLLk', 'kLLDLLLk', '.kLDLLk.', '..kDLk..', '...kD.k.'];
  const leaf = ['#e0782b', '#c8451f', '#e9a62c', '#a8512a'].map(c => { const b = build(LEAFR, { k: '#3d1c0c', L: c, D: shade(c, -.3), h: shade(c, .35) }, 1); return [b, flipC(b)]; });
  const acorn = sprite([['.kk.', 'kddk', 'kaak', '.ak.', '..k.']], { k: '#3a2416', d: '#7d553a', a: '#b3552a' });
  // ---- снеговик ----
  const MP = { k: '#1c2432', w: '#f7fbff', s: '#cfe0f2', o: '#ff8a2a', r: '#e5484d', b: '#6b4a2c' };
  const snowman = sprite([[
    '..kkkkk..',
    '.kwwwwwk.',
    '.kwkwkwk.',
    '.kwwowwk.',
    '..krrrk..',
    'bkwwwwwkb',
    '.kwwkwwk.',
    'kwwwwwwwk',
    'kwwwkwwwk',
    '.kwwwwwk.',
    '..kkkkk..'
  ]], MP);
  // ---- снегоуборочная машина (едет вправо, отвал впереди) ----
  const PP = { k: '#1c2432', y: '#f2a516', Y: '#f8c24a', e: '#c97d0a', s: '#dfe6ef', S: '#b4bfcd', g: '#9fd4f2', o: '#ff6a3d', t: '#3a4258' };
  const PL = [
    '.....oo.............',
    '.....kk.............',
    '..kkkkkkk...........',
    '..kYggkggk..........',
    '..kYggkggkkkkkkkk.ss',
    '.kyyyyyyyyyyyyyyykSs',
    '.kyyyyyyyyyyyyyyykSs',
    '.keeeeeeeeeeeeeeekSs',
    '..kttkkk...kkktkk.Ss',
    '...kkk........kkk.kk'];
  const plow = sprite([PL, PL.map((r, i) => i >= 8 ? r.split('').map(ch => ch === 't' ? 'k' : ch === 'k' ? 't' : ch).join('') : r)], PP);
  // ---- песчаный замок ----
  const CAP = { k: '#6b4a22', s: '#ecd08a', d: '#d4ac5e', r: '#e5484d', b: '#a8793a' };
  const castle = sprite([[
    '....r......',
    '....k......',
    's.s.sks.s.s',
    'sssssssssss',
    'sdsssbbsssd',
    'sdsssbbsssd',
    'ddddddddddd'
  ]], CAP);

  // ---- кошка (смотрит вправо), ~36x26 px. Кадры: 0/1 шаг, 2/3 сидит (хвост), 4/5 смотрит вверх, 6 моргнула, 7/8 спит ----
  const KP = { k: '#141824', b: '#aeb4c8', d: '#7b8199', e: '#ffe27a', p: '#ff9db0', w: '#e9ecf6' };
  const WALK1 = [
    '............kk..kk',
    '.k..........kbkkbk',
    '.kb.........kbbbbk',
    '.kb.........kebbek',
    '.kbkkkkkkkkkkbbbpk',
    'kbbbbbbbbbbbbbbbk.',
    'kdbbbbbbbbbbbbbbk.',
    '.kkbbbbbbbbbbbbk..',
    '...kbk.kbk.kbk.kbk',
    '...kdk.kdk.kdk.kdk'];
  const WALK2 = WALK1.slice(0, 8).concat(['..kbk.kbk.kbk.kbk.', '..kdk.kdk.kdk.kdk.']);
  const SITB = [
    '........kk..kk',
    '........kbbbbk',
    '........kebbek',
    '........kbbbpk',
    '.......kkbbbbk',
    '......kbbbbbbk',
    '.....kbbbbbbwk',
    '....kbbbbbbwwk',
    '...kbbbbbbbbbk',
    '.kkkbbbbbbbbbk',
    'kbbkbbbbbbbbbk',
    'kdbkkdkkkdkkdk'];
  const SITA = SITB.map((r, i) => i === 9 ? '..kkbbbbbbbbbk' : i === 10 ? '.kbbkbbbbbbbbk' : i === 11 ? 'kbdkkdkkkdkkdk' : r);
  const up = a => a.map((r, i) => i === 2 ? '........kbebbk' : i === 3 ? '........kbbbkp' : r);
  const blink = a => a.map((r, i) => i === 2 ? '........kkbbkk' : r);
  const SLP = [
    '..........k.k.',
    '...kkkkkkkkkbk',
    '..kbbbbbbbbbbk',
    '.kbbbbbbbbbkbk',
    'kbbbbbbbbbbkpk',
    'kdbbbbbbbbbkkk',
    '.kkdddddddkk..'];
  const SLP2 = SLP.map((r, i) => i === 1 ? '....kkkkkkkk.k' : r);
  const H = 12, Wd = 18;   // все кадры выравниваются по нижнему краю
  const fit = rs => Array(H - rs.length).fill('').concat(rs).map(r => r.padEnd(Wd, '.'));
  const cat = sprite([WALK1, WALK2, SITB, SITA, up(SITB), up(SITA), blink(SITB), SLP, SLP2].map(fit), KP);
  // ---- луна: пиксельный серп 12×12 «пикселей» по 5 px + мягкое свечение (отдельный холст 84×84) ----
  const makeMoon = (k = 16) => {   // полная луна 12×12 «пикселей» с кратерами и мягким свечением
    const pad = Math.round(k * 2.4), c = mkc(12 * k + pad * 2, 12 * k + pad * 2), x = c.getContext('2d'), R = 5.7, cr = [[4, 4], [7.5, 3], [7, 7.5], [3.6, 8]];
    x.shadowColor = 'rgba(255,240,190,.9)'; x.shadowBlur = k * 3;
    for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
      const d = Math.hypot(i + .5 - 6, j + .5 - 6); if (d > R) continue;
      const hole = cr.some(([a, b]) => Math.hypot(i + .5 - a, j + .5 - b) < 1.05), rim = d > R - 1.1 && i + j < 11;
      x.fillStyle = hole ? '#e3d08a' : rim ? '#fffbe0' : '#fff0b0'; x.fillRect(pad + i * k, pad + j * k, k, k);
    }
    return c;
  };
  const moon = makeMoon(16);   // большая луна для фона: 12×12 «пикселей» по 16 px (≈190 px) + свечение
  // ---- аксессуары логотипа (пиксель-арт, масштаб задаётся в em снаружи) ----
  const url = (rows, pal) => build(rows, pal, 1).toDataURL();
  const hat = url([
    '..........rrrr.....',
    '........rrrrrrrr...',
    '......rrrrrrrrrrr.w',
    '.....rrrrrrrrmrrrww',
    '...rrrrrrrrrmmrrrww',
    '..rrrrrrrrrmmrrrrr.',
    '.rrrrrrrrrmmrrrrrr.',
    'wwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwwwwww'
  ], { r: '#d93a42', m: '#a82430', w: '#ffffff' });
  const shades = url([
    'kkkkkkkkkkkkkkkk',
    'kggkkkk..kggkkkk',
    'kkkkkkk..kkkkkkk',
    '.kkkkk....kkkkk.',
    '..kkk......kkk..'
  ], { k: '#0c0f16', g: '#7f96c8' });
  // Зонт: купол (полуэллипс) 26x12 со спицами и фестонами по краю, полностью чёрный (спицы — чуть светлее)
  const dome = (() => {
    const W = 26, H = 12, rows = [];
    for (let y = 0; y < H; y++) {
      const t = (H - 1 - y) / (H - 1), half = Math.round(W / 2 * Math.sqrt(Math.max(0, 1 - t * t * .98))) , row = [];
      for (let x = 0; x < W; x++) { const dx = x - (W - 1) / 2; row.push(Math.abs(dx) <= half - .5 && y >= 1 - 0 ? 'k' : '.'); }
      for (const rx of [5, 10, 15, 20]) if (y > 2 && row[rx] === 'k') row[rx] = 'g';
      if (y === H - 1) for (let x = 0; x < W; x++) if (x % 5 === 2 || x % 5 === 3) row[x] = '.';
      rows.push(row.join(''));
    }
    rows.unshift('............kk............', '............kk............');
    // ручка: стержень вдоль центра, кулак (серый) и крюк внизу
    const pole = '............kk............';
    for (let i = 0; i < 15; i++) rows.push(i >= 9 && i <= 11 ? '...........gggg...........' : pole);
    rows.push('...........kkk............', '...........kk.............', '...........kkk............'.replace('kkk', 'kk.'));
    return url(rows, { k: '#050505', g: '#232323' });
  })();
  const umbrella = dome;
  return { S, build, sprite, frog, crab, squirrel, acorn, snowman, plow, castle, cat, leaf, moon, assets: { hat, shades, umbrella } };
})();
