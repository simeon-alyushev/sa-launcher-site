'use strict';
// Спрайты погодных тем — векторные (inline SVG, прозрачный фон), единый стиль: тёмный контур, плоская заливка, мягкий блик.
// Размеры задаются в em снаружи (weather.css), поэтому масштабируются под любое разрешение и масштаб интерфейса.
const SPR = (() => {
  const O = '#1c2432';                                         // общий цвет контура
  const sv = (vb, body, cls = '') => `<svg class="sp ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
  const ln = (w = 1.5) => `stroke="${O}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  const frog = () => sv('0 0 32 22', `
    <g ${ln()}>
      <path d="M4 15.5c-2.6 1-3.6 3.4-2.8 5h8.6l1.4-4.2z" fill="#4faa45"/>
      <path d="M28 15.5c2.6 1 3.6 3.4 2.8 5h-8.6l-1.4-4.2z" fill="#4faa45"/>
      <ellipse cx="16" cy="13.6" rx="11.4" ry="6.6" fill="#72d15c"/>
      <circle cx="10.4" cy="6.8" r="3.7" fill="#72d15c"/><circle cx="21.6" cy="6.8" r="3.7" fill="#72d15c"/>
    </g>
    <ellipse cx="16" cy="16.2" rx="6.2" ry="2.8" fill="#d5f6b4"/>
    <circle cx="10.6" cy="6.6" r="2.1" fill="#fff"/><circle cx="21.4" cy="6.6" r="2.1" fill="#fff"/>
    <g class="eyes"><circle cx="11" cy="6.9" r="1.05" fill="${O}"/><circle cx="21.8" cy="6.9" r="1.05" fill="${O}"/></g>
    <path d="M11.2 12.6c3 2 6.6 2 9.6 0" fill="none" stroke="${O}" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="8" cy="11.6" r="1.1" fill="#ff9c8a" opacity=".75"/><circle cx="24" cy="11.6" r="1.1" fill="#ff9c8a" opacity=".75"/>`, 'frog');

  const puddle = () => sv('0 0 44 10', `
    <ellipse cx="22" cy="5.6" rx="20.5" ry="3.8" fill="#5b9bd6" opacity=".55"/>
    <ellipse cx="22" cy="5" rx="17" ry="2.9" fill="#9fd0f6" opacity=".7"/>
    <ellipse cx="15" cy="4.2" rx="5.5" ry="1" fill="#fff" opacity=".7"/>`, 'puddle');
  const ripple = () => sv('0 0 30 8', `<ellipse cx="15" cy="4" rx="13" ry="2.6" fill="none" stroke="#d6ecff" stroke-width="1.2"/>`, 'ripple');

  const snowman = () => sv('0 -3 22 35', `
    <g ${ln()}>
      <circle cx="11" cy="24" r="7.4" fill="#f6fbff"/><circle cx="11" cy="14.2" r="5.4" fill="#f6fbff"/><circle cx="11" cy="6.6" r="4.2" fill="#fff"/>
    </g>
    <path d="M11 6.9l5.2.9-5.2 1.1z" fill="#ff8a2a" stroke="${O}" stroke-width="1" stroke-linejoin="round"/>
    <circle cx="9.3" cy="5.4" r=".85" fill="${O}"/><circle cx="12.7" cy="5.4" r=".85" fill="${O}"/>
    <g class="arm" ${ln(1.3)}><path d="M16 14l5.6-3.6M19 12.2l.2-2.6M19 12.2l2.4.4" fill="none" stroke="#6b4a2c"/></g>
    <path d="M5.8 14.8l-5-2.4M3.8 13.6l-.3-2.4" fill="none" stroke="#6b4a2c" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M6.2 11.2c3 1.6 6.6 1.6 9.6 0l-.5 2.6c-3 1.2-5.6 1.2-8.6 0z" fill="#e5484d" stroke="${O}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M14.4 13.2l1.6 4.2-2.4.5-.4-3.6z" fill="#e5484d" stroke="${O}" stroke-width="1" stroke-linejoin="round"/>
    <circle cx="11" cy="20.6" r=".9" fill="${O}"/><circle cx="11" cy="24" r=".9" fill="${O}"/>
    <path d="M7.2 2.6h7.6v-1.4h-7.6zM8.4 2.6l.3-2.6h4.6l.3 2.6z" fill="#2b3550" stroke="${O}" stroke-width="1" stroke-linejoin="round" class="hat"/>`, 'snowman');

  const plow = () => sv('0 0 50 26', `
    <g class="bk"><circle cx="21" cy="4.6" r="2.4" fill="#ffb02e" stroke="${O}" stroke-width="1"/><path d="M21 .6v-0M16.6 4.6h-2.4M27.4 4.6h-2.4" stroke="#ffd36b" stroke-width="1.3" stroke-linecap="round"/></g>
    <g ${ln()}>
      <path d="M6 20.5V11.6l3-1.6h20v10.5z" fill="#f2a516"/>
      <path d="M12 10l2.4-4.4h9.4l3.2 4.4z" fill="#f8c24a"/>
      <path d="M14.4 9.4l1.6-2.6h3.4v2.6zM21 9.4V6.8h3.4l1.6 2.6z" fill="#bfe6ff" stroke-width="1"/>
      <path d="M29 20.5v-7.4l5.6-1.2 6.6 3.4v5.2z" fill="#e6930b"/>
      <path d="M38.4 6.6l10 4.6-2 11.4-9.4.6z" fill="#e8e9ee"/><path d="M38.4 6.6l10 4.6" stroke="#fff" stroke-width="1" />
      <path d="M41 11.6l5.6 2.2M40.2 15.4l5.4 1.8" stroke="#b9c0cc" stroke-width="1" fill="none"/>
      <rect x="4" y="19.4" width="36" height="2.6" rx="1.2" fill="#3a4258"/>
    </g>
    <g class="wh" ${ln()}>
      <g class="w1"><circle cx="13" cy="21.6" r="3.9" fill="#2b3342"/><circle cx="13" cy="21.6" r="1.5" fill="#aab4c6" stroke="none"/><path d="M13 18v7.2M9.4 21.6h7.2" stroke="#6c778c" stroke-width="1"/></g>
      <g class="w2"><circle cx="31" cy="21.6" r="3.9" fill="#2b3342"/><circle cx="31" cy="21.6" r="1.5" fill="#aab4c6" stroke="none"/><path d="M31 18v7.2M27.4 21.6h7.2" stroke="#6c778c" stroke-width="1"/></g>
    </g>`, 'plow');

  const snowpile = () => sv('0 0 40 14', `
    <path d="M1 13c1-5 5-6.4 9-6.2 2-4.4 8-6.4 12.4-3.4 3.4-.6 7.4.6 9 4 3.2.6 6.4 2.2 7.6 5.6z" fill="#f2f8ff" stroke="${O}" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M7 12c3-2.2 6-2.2 9-.4M22 11.4c3-1.6 6.6-1.4 10 .6" stroke="#b5cde6" stroke-width="1.3" fill="none" stroke-linecap="round"/>`, 'pile');

  const crab = () => sv('0 0 32 20', `
    <g class="legs" ${ln(1.3)} fill="none"><path d="M7 12.4L2.6 10.6M7.4 14.4L2.4 15M9 16l-3.4 3M25 12.4l4.4-1.8M24.6 14.4l5 .6M23 16l3.4 3"/></g>
    <g ${ln()}>
      <g class="cl l"><path d="M7 8.4C3.2 8.2 2 4.6 3.6 2.4c1.4 1.2 3 1.2 3.8 2.6.6-1.6 2.2-2.4 3.6-1.6-.2 2.8-1.6 4.8-3.6 5z" fill="#ff7a52"/></g>
      <g class="cl r"><path d="M25 8.4c3.8-.2 5-3.8 3.4-6-1.4 1.2-3 1.2-3.8 2.6-.6-1.6-2.2-2.4-3.6-1.6.2 2.8 1.6 4.8 3.6 5z" fill="#ff7a52"/></g>
      <ellipse cx="16" cy="12.6" rx="10.4" ry="6" fill="#ff6a3d"/>
    </g>
    <ellipse cx="16" cy="14.4" rx="6" ry="2.6" fill="#ffb59c" opacity=".7"/>
    <path d="M12.4 7.4V5M19.6 7.4V5" stroke="${O}" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="12.4" cy="4.5" r="1.9" fill="#fff" stroke="${O}" stroke-width="1.1"/><circle cx="19.6" cy="4.5" r="1.9" fill="#fff" stroke="${O}" stroke-width="1.1"/>
    <circle cx="12.7" cy="4.6" r=".85" fill="${O}"/><circle cx="19.9" cy="4.6" r=".85" fill="${O}"/>
    <path d="M13.8 12.4c1.4 1 3 1 4.4 0" fill="none" stroke="${O}" stroke-width="1.1" stroke-linecap="round"/>`, 'crab');

  const castle = () => sv('0 0 36 30', `
    <g ${ln()}>
      <path d="M2 29V16h4v-2h2v2h2v-2h2v2h2v13z" fill="#e9c97e"/>
      <path d="M13 29V10.4h4v-2h2v2h2v-2h2v2h2V29z" fill="#f0d48f"/>
      <path d="M25 29V17h4v-2h2v2h2v-2h2v2h-1V29z" fill="#e9c97e"/>
      <path d="M15.4 29v-5.4a2.6 2.6 0 015.2 0V29z" fill="#b98b45"/>
      <path d="M19 8.4V1.6" fill="none"/><path d="M19 1.6l6 2-6 2z" fill="#e5484d" stroke-width="1.2"/>
    </g>
    <path d="M4.6 20.4h3.2M4.6 24h3.2M28.2 21.4h3.2M16 14h4M16 17.6h4" stroke="#c49a52" stroke-width="1.1" stroke-linecap="round"/>
    <ellipse cx="18" cy="29" rx="17" ry="1.4" fill="#d7b068" opacity=".8"/>`, 'castle');

  const acorn = () => sv('0 0 12 14', `
    <g ${ln(1.2)}><path d="M2.2 6.2c0 4.4 2.4 7 3.8 7s3.8-2.6 3.8-7z" fill="#c98f4a"/><path d="M1.2 6.4c0-3 2.2-4.6 4.8-4.6s4.8 1.6 4.8 4.6z" fill="#7a4a26"/><path d="M6 1.8V.4" fill="none"/></g>
    <path d="M3.6 8c.3 1.6 1 2.8 1.6 3.4" stroke="#e6b574" stroke-width="1" fill="none" stroke-linecap="round"/>`, 'acorn');

  const squirrel = () => sv('0 0 40 28', `
    <g ${ln()}>
      <path class="tail" d="M9 22C1.4 20-.4 10.6 5.6 4.6c3.4-2.6 8-1.6 7.6 2.6-.4 3.6-4 4-3.6 8 .2 2 2.4 3.4 2.4 3.4z" fill="#c4691f"/>
      <path d="M10.6 24.6c-2.4-6 .6-13.4 8.4-14.6 6-.6 10.4 3 10.4 8.2 0 3.4-2.2 6.4-5.2 6.4z" fill="#d97d2b"/>
      <circle cx="29.4" cy="11" r="6" fill="#d97d2b"/>
      <path d="M26.6 6.6l-.4-4.8 4.2 2.6z" fill="#c4691f"/>
      <ellipse cx="19.2" cy="21.2" rx="3.4" ry="3.6" fill="#f3d6ae" stroke="none"/>
      <path d="M12 26h6.6M24 26.4h6" fill="none"/>
    </g>
    <path d="M34 10.8c1.4.4 2.4 1.4 2.6 2.6" stroke="${O}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <circle cx="35.4" cy="12.8" r="1.4" fill="${O}"/>
    <circle cx="31.6" cy="9.4" r="1.2" fill="${O}"/><circle cx="32" cy="9" r=".4" fill="#fff"/>
    <g class="hold"><g transform="translate(31 15.4) scale(.95)"><g ${ln(1.1)}><path d="M0 .6c0 3.6 2 5.8 3.2 5.8s3.2-2.2 3.2-5.8z" fill="#c98f4a"/><path d="M-.8 1c0-2.6 1.9-4 4-4s4 1.4 4 4z" fill="#7a4a26"/></g></g></g>`, 'squirrel');

  const leaf = (c = '#e0782b') => sv('-10 -12 20 24', `<path d="M0-10C8-6 9 3 0 10C-9 3-8-6 0-10z" fill="${c}" stroke="#4a2410" stroke-width="1.3" stroke-linejoin="round"/><path d="M0-8V11M0-2l4-3M0 3l-4-3.4M0 3l4-3" stroke="#4a2410" stroke-width="1" fill="none" stroke-linecap="round" opacity=".7"/>`, 'leaf');
  const LC = ['#e0782b', '#c8451f', '#e9a62c', '#b4572a', '#d9b23a'];
  const leafpile = () => sv('0 0 40 14', `
    <g stroke="#4a2410" stroke-width="1.1" stroke-linejoin="round">
      <path d="M1 13c1-4 4-6 8-5.4 2-3.6 6.4-4.6 10-2.4 3.6-2 8.4-.8 10.2 2.8 3.4-.2 6.6 1.6 8.6 5z" fill="#c8451f"/>
      <ellipse cx="11" cy="9.6" rx="6" ry="2.6" fill="#e0782b" transform="rotate(-12 11 9.6)"/><ellipse cx="22" cy="7.4" rx="6.4" ry="2.8" fill="#e9a62c" transform="rotate(8 22 7.4)"/>
      <ellipse cx="31" cy="10" rx="6" ry="2.6" fill="#b4572a" transform="rotate(-8 31 10)"/><ellipse cx="17" cy="11.6" rx="5.4" ry="2.2" fill="#d9b23a" transform="rotate(6 17 11.6)"/>
    </g>`, 'lpile');

  // ---- аксессуары логотипа ----
  const canopy = () => sv('0 0 72 30', `
    <defs><clipPath id="uc"><path d="M2 28C2 12 16 1 36 1s34 11 34 27c-4.6-3.4-9.4-3.4-11.6 0-2.2-3.4-8-3.4-11.6 0-3.6-3.4-8.2-3.4-11.2 0-3-3.4-7.6-3.4-11.2 0C21 24.6 16.2 24.6 13.6 28 11.4 24.6 6.6 24.6 2 28z"/></clipPath></defs>
    <g clip-path="url(#uc)"><rect width="72" height="30" fill="#3f86e0"/>
      <path d="M36 0C30 8 26 18 25 30h-12C14 16 24 4 36 0zM36 0c6 8 10 18 11 30h12C58 16 48 4 36 0z" fill="#79b4ff" opacity=".9"/>
      <path d="M36 0c-3 8-4 18-4 30h8c0-12-1-22-4-30z" fill="#2f6fc4"/>
      <path d="M6 7c8-6 20-7 30-6" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round"/></g>
    <path d="M2 28C2 12 16 1 36 1s34 11 34 27c-4.6-3.4-9.4-3.4-11.6 0-2.2-3.4-8-3.4-11.6 0-3.6-3.4-8.2-3.4-11.2 0-3-3.4-7.6-3.4-11.2 0C21 24.6 16.2 24.6 13.6 28 11.4 24.6 6.6 24.6 2 28z" fill="none" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M36 1V-2" stroke="${O}" stroke-width="2" stroke-linecap="round"/>`, 'canopy');
  const pole = () => sv('0 0 14 80', `<path d="M7 0V68c0 5 5 7 5 1.6" fill="none" stroke="${O}" stroke-width="5.6" stroke-linecap="round"/><path d="M7 0V68c0 5 5 7 5 1.6" fill="none" stroke="#8b94a8" stroke-width="2.8" stroke-linecap="round"/>`, 'pole');
  const hand = () => sv('0 0 20 16', `<rect x="1.5" y="1.5" width="17" height="13" rx="6.5" fill="#f4f6fa" stroke="${O}" stroke-width="2"/><path d="M6 5v6M10 4.6v6.8M14 5v6" stroke="#b6bfce" stroke-width="1.4" stroke-linecap="round"/>`, 'hand');
  const hat = () => sv('0 0 60 52', `
    <g ${ln(2)}>
      <path d="M6 40C10 16 26 4 44 8c4 1 8 4 8 10-6-2-12 0-14 6 2 6 6 10 10 14z" fill="#e5484d"/>
      <path d="M2 38c0-4 4-6 9-6l36 6c5 1 8 4 6 8-2 3-6 3-9 2L9 45c-5-1-7-3-7-7z" fill="#fff"/>
    </g>
    <path d="M18 22c4-6 10-10 18-11" stroke="#ff9296" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M10 40c10 2 22 4 34 6" stroke="#cdd8e6" stroke-width="2" fill="none" stroke-linecap="round"/>`, 'hat');
  const pom = () => sv('0 0 20 20', `<circle cx="10" cy="10" r="8" fill="#fff" stroke="${O}" stroke-width="2"/><path d="M5.6 8c1-2 2.8-3 4.6-3.2" stroke="#cdd8e6" stroke-width="1.8" fill="none" stroke-linecap="round"/>`, 'pom');
  const shades = () => sv('0 0 64 26', `
    <path d="M2 6c-1 0-1 3 1 3M62 6c1 0 1 3-1 3" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
    <g ${ln(2.2)}>
      <path d="M3 5h58l-.5 3H3.5z" fill="#1c2432"/>
      <path d="M5 6h24c1.5 0 2.4 1 2.2 2.6-.7 8-4 13.6-11 13.6C13 22.2 7.6 17 5 7z" fill="#1d2434"/>
      <path d="M59 6H35c-1.5 0-2.4 1-2.2 2.6.7 8 4 13.6 11 13.6 7.2 0 12.6-5.2 15.2-15.2z" fill="#1d2434"/>
      <path d="M31 8c1.4-1.4 2.6-1.4 4 0" fill="none"/>
    </g>
    <path d="M9 9.6c3-.6 7-.6 11 0M38 9.6c3-.6 7-.6 11 0" stroke="#7fa6ff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".75"/>
    <path d="M10 14l4-3M39 14l4-3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>`, 'shades');
  const spark = () => sv('-8 -8 16 16', `<path d="M0-7C.6-2 2-.6 7 0 2 .6.6 2 0 7-.6 2-2 .6-7 0-2-.6-.6-2 0-7z" fill="#fff6c8" stroke="#ffd35a" stroke-width="1"/>`, 'spark');
  return { frog, puddle, ripple, snowman, plow, snowpile, crab, castle, acorn, squirrel, leaf, leafpile, canopy, pole, hand, hat, pom, shades, spark, LC };
})();
