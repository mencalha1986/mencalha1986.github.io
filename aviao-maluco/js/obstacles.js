/* =========================================================================
   OBSTÁCULOS REALISTAS — prédios, torres, farol, rocha, contêiner no guindaste,
   dirigível e balão. Cada um é desenhado uma vez num canvas próprio (com luz,
   sombra, reflexo e textura) e reaproveitado; só luzes e chama são animadas.
   ========================================================================= */
(function () {
  const U = CNB.U;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  const lin = (x, x0, y0, x1, y1, st) => { const g = x.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  const R = (seed) => U.mulberry32(Math.floor(seed * 1e6) + 7);
  const ROOF = 70;   // espaço acima do topo (antenas, caixa d'água)

  // ---------------- PRÉDIO COMERCIAL (pele de vidro) ----------------
  function office(o, H) {
    const w = o.w, c = mk(w + 70, H + ROOF), x = c.getContext('2d'), r = R(o.seed), L = 35, T = ROOF;
    const side = w * 0.16;                                     // face lateral em perspectiva
    // face lateral (sombra)
    x.fillStyle = lin(x, 0, T, 0, T + H, [[0, '#4b5a68'], [1, '#2f3a44']]);
    U.poly(x, [L + w, T, L + w + side, T + 10, L + w + side, T + H, L + w, T + H]); x.fill();
    // fachada de vidro refletindo o céu
    x.fillStyle = lin(x, 0, T, 0, T + H, [[0, '#9fd0ee'], [0.35, '#5f9dc6'], [1, '#2c5a7c']]); x.fillRect(L, T, w, H);
    // reflexo de nuvem / brilho diagonal
    x.fillStyle = 'rgba(255,255,255,0.18)'; U.poly(x, [L, T + H * 0.15, L + w * 0.55, T, L + w * 0.85, T, L, T + H * 0.45]); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.08)'; U.poly(x, [L, T + H * 0.6, L + w, T + H * 0.25, L + w, T + H * 0.35, L, T + H * 0.72]); x.fill();
    // montantes e lajes
    const fl = 26 + Math.floor(r() * 6), cols = Math.max(4, Math.round(w / 26));
    x.fillStyle = 'rgba(20,35,48,0.55)';
    for (let y = T + 14; y < T + H - 40; y += fl) x.fillRect(L, y, w, 3);
    for (let i = 1; i < cols; i++) x.fillRect(L + (w / cols) * i - 1, T, 2, H - 40);
    // algumas janelas com luz / persiana
    for (let y = T + 17; y < T + H - 44; y += fl) for (let i = 0; i < cols; i++) if (r() < 0.12) { x.fillStyle = r() < 0.5 ? 'rgba(255,236,170,0.55)' : 'rgba(230,236,240,0.5)'; x.fillRect(L + (w / cols) * i + 2, y + 2, w / cols - 4, fl - 6); }
    // térreo: portaria
    x.fillStyle = '#d7d4cc'; x.fillRect(L, T + H - 42, w, 42);
    x.fillStyle = lin(x, 0, T + H - 38, 0, T + H, [[0, '#2b3a45'], [1, '#1b252c']]); x.fillRect(L + 10, T + H - 36, w - 20, 36);
    x.fillStyle = 'rgba(180,215,235,0.35)'; for (let i = 0; i < 5; i++) x.fillRect(L + 14 + i * (w - 28) / 5, T + H - 34, (w - 28) / 5 - 4, 34);
    x.fillStyle = '#8c8a84'; x.fillRect(L - 4, T + H - 46, w + 8, 6);
    // coroamento e cobertura
    x.fillStyle = lin(x, L, 0, L + w, 0, [[0, '#e7e6e1'], [1, '#b9b8b1']]); x.fillRect(L - 3, T - 8, w + 6, 14);
    x.fillStyle = '#9a9890'; x.fillRect(L + w * 0.18, T - 34, w * 0.34, 26);             // casa de máquinas
    x.fillStyle = '#d8d6cf'; x.fillRect(L + w * 0.6, T - 26, w * 0.22, 18);              // caixa d'água
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(L + w * 0.18 + w * 0.26, T - 34, w * 0.08, 26);
    x.strokeStyle = '#6b6f73'; x.lineWidth = 2; x.beginPath(); x.moveTo(L + w * 0.3, T - 34); x.lineTo(L + w * 0.3, T - 66); x.moveTo(L + w * 0.3 - 8, T - 54); x.lineTo(L + w * 0.3 + 8, T - 54); x.stroke();
    return c;
  }

  // ---------------- PRÉDIO RESIDENCIAL (pastilha + sacadas) ----------------
  function residential(o, H, beach) {
    const w = o.w, c = mk(w + 70, H + ROOF), x = c.getContext('2d'), r = R(o.seed + 0.3), L = 35, T = ROOF, side = w * 0.16;
    const tones = beach ? [['#f6f4ee', '#d9d6cc']] : [['#e9dcc6', '#c9b89a'], ['#e6e1d8', '#c4bdb0'], ['#d9c9b8', '#b7a38f'], ['#dde3e6', '#b9c2c7']];
    const tn = tones[Math.floor(r() * tones.length)];
    x.fillStyle = lin(x, 0, T, 0, T + H, [[0, '#9c8f7c'], [1, '#6f6455']]); U.poly(x, [L + w, T, L + w + side, T + 10, L + w + side, T + H, L + w, T + H]); x.fill();
    x.fillStyle = lin(x, L, 0, L + w, 0, [[0, tn[0]], [1, tn[1]]]); x.fillRect(L, T, w, H);
    // textura de pastilha
    x.fillStyle = 'rgba(0,0,0,0.035)'; for (let y = T; y < T + H; y += 6) x.fillRect(L, y, w, 1);
    const fl = 30, glass = beach ? '#6fb3d6' : '#4f6f84';
    for (let y = T + 18, k = 0; y < T + H - 46; y += fl, k++) {
      // janelas com esquadria
      x.fillStyle = lin(x, 0, y, 0, y + 18, [[0, glass], [1, '#2d4352']]); x.fillRect(L + 10, y, w * 0.32, 18); x.fillRect(L + w * 0.56, y, w * 0.34, 18);
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(L + 12, y + 2, w * 0.12, 5);
      // sacada com guarda-corpo de vidro
      x.fillStyle = '#f2f1ec'; x.fillRect(L + w * 0.5, y + 19, w * 0.46, 4);
      x.fillStyle = 'rgba(160,200,220,0.45)'; x.fillRect(L + w * 0.5, y + 11, w * 0.46, 8);
      // ar-condicionado
      if (r() < 0.45) { x.fillStyle = '#e8e8e4'; x.fillRect(L + w * 0.08, y + 21, 18, 9); x.fillStyle = '#a8a8a2'; x.fillRect(L + w * 0.08 + 2, y + 23, 14, 1); }
      // vasos / roupas na sacada
      if (r() < 0.25) { x.fillStyle = '#3c7a46'; x.beginPath(); x.arc(L + w * 0.9, y + 9, 5, 0, 7); x.fill(); }
    }
    // térreo com grade e portaria
    x.fillStyle = '#bfb9ad'; x.fillRect(L, T + H - 46, w, 46);
    x.fillStyle = '#3a3f44'; for (let i = L + 4; i < L + w - 4; i += 7) x.fillRect(i, T + H - 30, 2, 30);
    x.fillRect(L, T + H - 32, w, 3);
    x.fillStyle = '#2b2f33'; x.fillRect(L + w / 2 - 14, T + H - 42, 28, 42);
    // cobertura
    x.fillStyle = '#efeeea'; x.fillRect(L - 3, T - 8, w + 6, 12);
    x.fillStyle = '#bdbab2'; x.fillRect(L + w * 0.55, T - 30, w * 0.3, 22); x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(L + w * 0.55 + w * 0.22, T - 30, w * 0.08, 22);
    x.strokeStyle = '#777'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(L + w * 0.2, T - 8); x.lineTo(L + w * 0.2, T - 40); x.stroke();
    return c;
  }

  // ---------------- TORRE METÁLICA (telecom / transmissão) ----------------
  function tower(o, H, painted) {
    const w = o.w * 0.9, c = mk(w + 80, H + ROOF), x = c.getContext('2d'), cx = (w + 80) / 2, T = ROOF;
    const half = (y) => U.lerp(9, w / 2, (y - T) / H);
    const col = (y) => painted ? (Math.floor((y - T) / (H / 7)) % 2 ? '#f2f2ef' : '#d2322a') : '#9aa3a8';
    x.lineCap = 'round';
    // pernas de trás (mais finas e escuras)
    x.strokeStyle = 'rgba(70,80,88,0.55)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx - half(T + H) * 0.55, T + H); x.lineTo(cx - 5, T); x.moveTo(cx + half(T + H) * 0.55, T + H); x.lineTo(cx + 5, T); x.stroke();
    // treliça em X por segmentos
    const segs = Math.round(H / 46);
    for (let i = 0; i < segs; i++) {
      const y0 = T + (H / segs) * i, y1 = T + (H / segs) * (i + 1), a = half(y0), b = half(y1);
      x.strokeStyle = col((y0 + y1) / 2); x.lineWidth = 2.6;
      x.beginPath(); x.moveTo(cx - a, y0); x.lineTo(cx + b, y1); x.moveTo(cx + a, y0); x.lineTo(cx - b, y1); x.stroke();
      x.lineWidth = 2; x.beginPath(); x.moveTo(cx - b, y1); x.lineTo(cx + b, y1); x.stroke();
    }
    // pernas da frente
    for (let i = 0; i < segs; i++) {
      const y0 = T + (H / segs) * i, y1 = T + (H / segs) * (i + 1);
      x.strokeStyle = col((y0 + y1) / 2); x.lineWidth = 5;
      x.beginPath(); x.moveTo(cx - half(y0), y0); x.lineTo(cx - half(y1), y1); x.moveTo(cx + half(y0), y0); x.lineTo(cx + half(y1), y1); x.stroke();
    }
    // plataformas com antenas painel e parabólicas
    [0.08, 0.3].forEach((f, k) => {
      const y = T + H * f, a = half(y) + 14;
      x.fillStyle = '#5b636a'; x.fillRect(cx - a, y, a * 2, 4);
      x.fillStyle = '#e9ecee'; for (let i = -1; i <= 1; i += 2) { x.fillRect(cx + i * a - (i > 0 ? 6 : 0), y - 30, 6, 28); }
      if (k === 1) { x.fillStyle = '#eceff1'; x.beginPath(); x.ellipse(cx + a - 4, y + 22, 9, 16, 0, -Math.PI / 2, Math.PI / 2); x.fill(); x.fillStyle = '#c3c9cd'; x.beginPath(); x.ellipse(cx + a - 6, y + 22, 4, 13, 0, 0, 7); x.fill(); }
    });
    // mastro
    x.strokeStyle = painted ? '#d2322a' : '#8a9399'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, T); x.lineTo(cx, T - 46); x.stroke();
    // base de concreto
    x.fillStyle = '#a7a39a'; x.fillRect(cx - half(T + H) - 12, T + H - 10, half(T + H) * 2 + 24, 12);
    return c;
  }

  // ---------------- FAROL ----------------
  function lighthouse(o, H) {
    const w = o.w, c = mk(w + 80, H + ROOF), x = c.getContext('2d'), cx = (w + 80) / 2, T = ROOF + 50;
    const bw = w * 0.42, tw = w * 0.27, body = H - 50;
    x.save(); x.beginPath(); x.moveTo(cx - bw, T + body); x.lineTo(cx - tw, T); x.lineTo(cx + tw, T); x.lineTo(cx + bw, T + body); x.closePath(); x.clip();
    for (let y = T; y < T + body; y += 64) { x.fillStyle = '#f5f4ef'; x.fillRect(cx - bw, y, bw * 2, 32); x.fillStyle = '#c8322b'; x.fillRect(cx - bw, y + 32, bw * 2, 32); }
    x.fillStyle = lin(x, cx - bw, 0, cx + bw, 0, [[0, 'rgba(255,255,255,0.18)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.38)']]); x.fillRect(cx - bw, T, bw * 2, body);
    x.restore();
    // varanda, lanterna e cúpula
    x.fillStyle = '#2f3438'; x.fillRect(cx - tw - 12, T - 6, (tw + 12) * 2, 8);
    x.strokeStyle = '#2f3438'; x.lineWidth = 2; for (let i = -tw - 10; i <= tw + 10; i += 8) { x.beginPath(); x.moveTo(cx + i, T - 6); x.lineTo(cx + i, T - 20); x.stroke(); }
    x.beginPath(); x.moveTo(cx - tw - 12, T - 20); x.lineTo(cx + tw + 12, T - 20); x.stroke();
    x.fillStyle = 'rgba(255,240,180,0.9)'; x.fillRect(cx - tw * 0.6, T - 52, tw * 1.2, 32);
    x.strokeStyle = '#2f3438'; x.lineWidth = 2; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(cx + i * tw * 0.3, T - 52); x.lineTo(cx + i * tw * 0.3, T - 20); x.stroke(); }
    x.fillStyle = '#2f3438'; x.beginPath(); x.moveTo(cx - tw * 0.75, T - 52); x.quadraticCurveTo(cx, T - 86, cx + tw * 0.75, T - 52); x.fill();
    // casa do faroleiro
    x.fillStyle = '#efe9dc'; x.fillRect(cx - bw - 20, T + body - 40, bw * 2 + 40, 40); x.fillStyle = '#9b4a3a'; U.poly(x, [cx - bw - 26, T + body - 40, cx, T + body - 64, cx + bw + 26, T + body - 40]); x.fill();
    return c;
  }

  // ---------------- ROCHA ----------------
  function rock(o, H) {
    const w = o.w, c = mk(w + 60, H + ROOF), x = c.getContext('2d'), r = R(o.seed + 0.6), L = 30, T = ROOF;
    const pts = [[0, H], [0.05, H * 0.55], [0.22, H * 0.12], [0.42, 0], [0.62, H * 0.08], [0.8, H * 0.3], [0.95, H * 0.62], [1, H]];
    const path = () => { x.beginPath(); pts.forEach(([px, py], i) => { const X = L + px * w, Y = T + py; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); };
    path(); x.fillStyle = lin(x, L, 0, L + w, 0, [[0, '#a59b8e'], [0.5, '#857b6f'], [1, '#5e564d']]); x.fill();
    x.save(); path(); x.clip();
    for (let i = 0; i < 60; i++) { x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.18)'; x.lineWidth = 1 + r() * 2.5; const sx = L + r() * w, sy = T + r() * H; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (r() - 0.5) * 30, sy + 20 + r() * 60); x.stroke(); }
    for (let i = 0; i < 26; i++) { x.fillStyle = ['#3f6b45', '#4f7d4f', '#5f8f55'][i % 3]; x.beginPath(); x.ellipse(L + r() * w, T + H * (0.2 + r() * 0.8), 8 + r() * 16, 6 + r() * 9, 0, 0, 7); x.fill(); }
    x.restore();
    return c;
  }

  // ---------------- CONTÊINER NO GUINDASTE ----------------
  function container(o) {
    const c = mk(200, 150), x = c.getContext('2d'), r = R(o.seed + 0.9);
    const col = [['#c2410c', '#8a2e08'], ['#0f5e93', '#0a3f63'], ['#2f7d3c', '#1f5428'], ['#7c3aed', '#5222a6'], ['#9a3412', '#6b240c']][Math.floor(r() * 5)];
    // gancho e moitão
    x.strokeStyle = '#2a2d31'; x.lineWidth = 2; x.beginPath(); x.moveTo(100, 0); x.lineTo(100, 26); x.stroke();
    x.fillStyle = lin(x, 86, 0, 114, 0, [[0, '#f2c230'], [1, '#c79a14']]); U.roundRect(x, 86, 24, 28, 22, 4); x.fill();
    x.fillStyle = '#1f2328'; for (let i = 0; i < 3; i++) x.fillRect(88 + i * 9, 26, 4, 18);
    // cabos do spreader
    x.strokeStyle = '#3a3e43'; x.lineWidth = 2; x.beginPath(); x.moveTo(100, 46); x.lineTo(34, 78); x.moveTo(100, 46); x.lineTo(166, 78); x.stroke();
    // caixa corrugada
    x.fillStyle = lin(x, 0, 78, 0, 148, [[0, col[0]], [1, col[1]]]); x.fillRect(30, 78, 140, 70);
    for (let i = 34; i < 168; i += 7) { x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(i, 80, 2, 66); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(i + 3, 80, 2, 66); }
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(30, 78, 140, 4); x.fillRect(30, 144, 140, 4); x.fillRect(30, 78, 4, 70); x.fillRect(166, 78, 4, 70);
    x.fillStyle = 'rgba(120,60,20,0.25)'; for (let i = 0; i < 10; i++) x.fillRect(34 + r() * 130, 84 + r() * 56, 3 + r() * 8, 2 + r() * 5);   // ferrugem
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.font = `20px ${U.FONT_TITLE}`; x.textAlign = 'center'; x.fillText('ACHADOS CARGO', 100, 118);
    x.font = `700 9px ${U.FONT_UI}`; x.fillText('ACHU 204718 · 45G1', 100, 132);
    return c;
  }

  // ---------------- DIRIGÍVEL com faixa ----------------
  function blimp() {
    const c = mk(420, 280), x = c.getContext('2d'), cx = 210, cy = 60;
    x.fillStyle = lin(x, 0, cy - 52, 0, cy + 52, [[0, '#ffffff'], [0.5, '#dfe5ea'], [1, '#9aa6b0']]);
    x.beginPath(); x.ellipse(cx, cy, 150, 52, 0, 0, 7); x.fill();
    x.fillStyle = '#2a9d8f'; x.beginPath(); x.ellipse(cx, cy, 150, 14, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.ellipse(cx - 30, cy - 28, 90, 12, -0.05, 0, 7); x.fill();
    x.fillStyle = '#1f2937'; [[-1], [1]].forEach(([s]) => { U.poly(x, [cx - 132, cy, cx - 178, cy + s * 50, cx - 160, cy + s * 50, cx - 120, cy + s * 8]); x.fill(); });
    x.fillStyle = '#0e3a4a'; x.font = `30px ${U.FONT_TITLE}`; x.textAlign = 'center'; x.fillText('ACHADOS ÚTEIS', cx + 6, cy - 8);
    x.fillStyle = lin(x, cx - 34, 0, cx + 34, 0, [[0, '#3f4a55'], [1, '#232a31']]); U.roundRect(x, cx - 34, cy + 46, 68, 22, 8); x.fill();
    x.fillStyle = 'rgba(160,210,240,0.7)'; for (let i = 0; i < 4; i++) x.fillRect(cx - 28 + i * 15, cy + 51, 10, 8);
    // faixa pendurada
    x.strokeStyle = '#4b5563'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx - 48, cy + 50); x.lineTo(cx - 58, 160); x.moveTo(cx + 48, cy + 50); x.lineTo(cx + 58, 160); x.stroke();
    x.fillStyle = lin(x, 0, 160, 0, 280, [[0, '#ff4d6d'], [1, '#c8163f']]); x.fillRect(cx - 60, 160, 120, 120);
    x.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 4; i++) x.fillRect(cx - 60 + i * 30, 160, 2, 120);
    x.fillStyle = '#fff'; x.font = `28px ${U.FONT_TITLE}`; x.fillText('ACHADOS', cx, 204); x.fillText('ÚTEIS', cx, 234); x.font = `800 13px ${U.FONT_UI}`; x.fillText('por aí', cx, 258);
    return c;
  }

  // ---------------- BALÃO DE AR QUENTE ----------------
  function balloon(o) {
    const c = mk(260, 260), x = c.getContext('2d'), cx = 130, r = R(o.seed + 0.4);
    const pal = [['#e63946', '#f1c453'], ['#1d4ed8', '#f8fafc'], ['#16a34a', '#f97316'], ['#7c3aed', '#fde68a']][Math.floor(r() * 4)];
    const env = () => { x.beginPath(); x.moveTo(cx - 30, 182); x.bezierCurveTo(cx - 128, 110, cx - 104, 6, cx, 6); x.bezierCurveTo(cx + 104, 6, cx + 128, 110, cx + 30, 182); x.closePath(); };
    env(); x.save(); x.clip();
    for (let i = -6; i < 6; i++) { x.fillStyle = pal[(i + 6) % 2]; x.beginPath(); x.moveTo(cx, -40); x.lineTo(cx + i * 26, 200); x.lineTo(cx + (i + 1) * 26, 200); x.closePath(); x.fill(); }
    x.fillStyle = lin(x, cx - 110, 0, cx + 110, 0, [[0, 'rgba(255,255,255,0.28)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.38)']]); x.fillRect(0, 0, 260, 200);
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 150, 260, 6);
    x.restore();
    x.strokeStyle = '#5b4632'; x.lineWidth = 1.5; [-26, -10, 10, 26].forEach((d) => { x.beginPath(); x.moveTo(cx + d * 1.1, 182); x.lineTo(cx + d * 0.8, 212); x.stroke(); });
    x.fillStyle = '#3a3f44'; x.fillRect(cx - 14, 196, 28, 8);
    x.fillStyle = lin(x, 0, 212, 0, 252, [[0, '#a0743f'], [1, '#6e4c27']]); U.roundRect(x, cx - 30, 212, 60, 40, 5); x.fill();
    x.strokeStyle = 'rgba(60,40,20,0.45)'; x.lineWidth = 1; for (let y = 218; y < 252; y += 6) { x.beginPath(); x.moveTo(cx - 30, y); x.lineTo(cx + 30, y); x.stroke(); }
    x.fillStyle = '#5a3c1e'; x.fillRect(cx - 32, 210, 64, 5);
    return c;
  }

  const cache = new WeakMap();
  function sprites(o, GY) {
    let s = cache.get(o); if (s) return s;
    const bot = o.gy + o.gap / 2, H = GY - bot;
    s = {};
    if (o.bot === 'predio') s.bot = (o.seed < 0.5 ? office : residential)(o, H, false);
    else if (o.bot === 'predioPraia') s.bot = residential(o, H, true);
    else if (o.bot === 'antena') s.bot = tower(o, H, true);
    else if (o.bot === 'torre') s.bot = tower(o, H, false);
    else if (o.bot === 'farol') s.bot = lighthouse(o, H);
    else s.bot = rock(o, H);
    s.top = o.top === 'guindaste' ? container(o) : o.top === 'dirigivel' ? blimp() : balloon(o);
    cache.set(o, s); return s;
  }

  // desenha um obstáculo (as partes animadas por cima)
  function draw(ctx, o, sx, t, GY) {
    const s = sprites(o, GY), top = o.gy - o.gap / 2, bot = o.gy + o.gap / 2;
    // de baixo
    const b = s.bot, yb = bot - (o.bot === 'farol' ? ROOF + 50 : ROOF);
    ctx.drawImage(b, sx - b.width / 2, yb);
    if (o.bot === 'antena' || o.bot === 'torre') { const on = Math.sin(t * 4 + o.seed * 9) > 0.2; ctx.fillStyle = on ? '#ff2d2d' : '#5a1010'; ctx.beginPath(); ctx.arc(sx, bot - 46, 5, 0, 7); ctx.fill(); if (on) { ctx.fillStyle = 'rgba(255,60,60,0.35)'; ctx.beginPath(); ctx.arc(sx, bot - 46, 14, 0, 7); ctx.fill(); } }
    if (o.bot === 'farol') { ctx.fillStyle = `rgba(255,236,160,${0.18 + 0.12 * Math.sin(t * 2.5)})`; U.poly(ctx, [sx, bot - 34, sx - 300, bot - 110, sx - 300, bot + 40]); ctx.fill(); }
    // de cima
    const k = s.top;
    if (o.top === 'guindaste') {
      const sw = Math.sin(t * 1.3 + o.seed * 6) * 3;
      ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + sw, top - 148); ctx.stroke();
      ctx.save(); ctx.translate(sx + sw, top - 148); ctx.rotate(sw * 0.004); ctx.drawImage(k, -100, 0); ctx.restore();
    } else if (o.top === 'dirigivel') {
      const bob = Math.sin(t * 1.1 + o.seed * 9) * 5;
      ctx.drawImage(k, sx - 210, top - 280 + bob);
    } else {
      const bob = Math.sin(t * 0.9 + o.seed * 7) * 6;
      ctx.drawImage(k, sx - 130, top - 255 + bob);
      const f = 0.6 + Math.random() * 0.4; ctx.fillStyle = `rgba(255,${150 + Math.random() * 80},40,0.85)`;
      ctx.beginPath(); ctx.ellipse(sx, top - 255 + bob + 192, 6 * f, 14 * f, 0, 0, 7); ctx.fill();
    }
  }

  CNB.Obstacles = { draw };
})();
