/* Utilidades matemáticas, ruído, cores e desenho */
(function () {
  const U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
  U.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.sign = (v) => (v < 0 ? -1 : 1);
  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeInCubic = (t) => t * t * t;
  U.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  U.easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  U.easeOutElastic = (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;

  U.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  U.noise = (t) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return U.lerp(U.hash(i), U.hash(i + 1), u) * 2 - 1; };

  // ---- cores ----
  const rgbCache = {};
  U.hexToRgb = (h) => {
    if (rgbCache[h]) return rgbCache[h];
    let s = h.replace('#', '');
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    const n = parseInt(s, 16);
    return (rgbCache[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  };
  const mixCache = new Map();
  U.mix = (c1, c2, t) => {
    t = U.clamp(Math.round(t * 32) / 32, 0, 1);
    const key = c1 + c2 + t;
    let v = mixCache.get(key);
    if (v) return v;
    const a = U.hexToRgb(c1), b = U.hexToRgb(c2);
    v = `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
    if (mixCache.size > 5000) mixCache.clear();
    mixCache.set(key, v);
    return v;
  };
  U.rgba = (hex, a) => { const c = U.hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

  // ---- desenho ----
  U.roundRect = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  U.poly = (ctx, pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  };
  U.star = (ctx, x, y, r1, r2, n = 5, rot = 0) => {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  };
  U.fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  U.truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  U.FONT_TITLE = '"Bebas Neue", Impact, "Arial Narrow Bold", sans-serif';
  U.FONT_UI = 'Rubik, "Segoe UI", Roboto, Arial, sans-serif';

  CNB.U = U;
})();
